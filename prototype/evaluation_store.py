"""SQLite persistence for generated answers and judge evaluation traces."""

from __future__ import annotations

import json
import sqlite3
import uuid
from pathlib import Path
from typing import Any

try:
    from prototype.api_time import now_iso
except ModuleNotFoundError:
    from api_time import now_iso


def _json_dumps(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _json_loads(value: str) -> dict[str, Any]:
    return json.loads(value)


def _strip_review_annotations(trace: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of the trace with read-time-only review annotations removed.

    The ``excluded`` flag on a human review is a read-time annotation applied at
    the API boundary from the reviewer plan (see ``annotate_excluded_reviews``);
    it must never be persisted into the stored trace_json. Returns the trace
    unchanged when no annotation is present so normal writes stay allocation-free.
    """
    reviews = trace.get("human_reviews")
    mock = trace.get("mock_human_review")
    needs_copy = (
        isinstance(reviews, list)
        and any(isinstance(review, dict) and "excluded" in review for review in reviews)
    ) or (isinstance(mock, dict) and "excluded" in mock)
    if not needs_copy:
        return trace
    cleaned = dict(trace)
    if isinstance(reviews, list):
        cleaned["human_reviews"] = [
            {key: value for key, value in review.items() if key != "excluded"}
            if isinstance(review, dict)
            else review
            for review in reviews
        ]
    if isinstance(mock, dict):
        cleaned["mock_human_review"] = {
            key: value for key, value in mock.items() if key != "excluded"
        }
    return cleaned


def _duration_seconds_value(value: Any) -> float | None:
    """Coerce a stored per-case review duration to a float, or None when absent."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class SQLiteEvaluationStore:
    """Small local database for reproducible evaluation runs."""

    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=30)
        connection.row_factory = sqlite3.Row
        return connection

    def _init_schema(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS evaluation_traces (
                    trace_id TEXT PRIMARY KEY,
                    batch_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    variant TEXT NOT NULL,
                    question_id TEXT,
                    service_id TEXT,
                    status TEXT NOT NULL,
                    trace_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS evaluation_runs (
                    run_id TEXT PRIMARY KEY,
                    batch_id TEXT,
                    trace_id TEXT NOT NULL,
                    run_type TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    model_name TEXT,
                    answer_prompt_version TEXT,
                    judge_prompt_version TEXT,
                    status TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    completed_at TEXT,
                    input_tokens INTEGER,
                    output_tokens INTEGER,
                    cost_estimate_usd REAL,
                    error_message TEXT,
                    metadata_json TEXT NOT NULL,
                    FOREIGN KEY (trace_id) REFERENCES evaluation_traces(trace_id)
                );

                CREATE TABLE IF NOT EXISTS evaluation_batches (
                    batch_id TEXT PRIMARY KEY,
                    batch_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    question_count INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    completed_at TEXT,
                    metadata_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS prompt_versions (
                    prompt_type TEXT NOT NULL,
                    prompt_version TEXT NOT NULL,
                    prompt_text TEXT NOT NULL,
                    model_name TEXT,
                    notes TEXT,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (prompt_type, prompt_version)
                );

                CREATE TABLE IF NOT EXISTS human_reviews (
                    trace_id TEXT NOT NULL,
                    reviewer_id TEXT NOT NULL,
                    review_id TEXT NOT NULL,
                    reviewer_role TEXT,
                    is_adjudication INTEGER NOT NULL DEFAULT 0,
                    adjudication_status TEXT,
                    human_score INTEGER,
                    label TEXT,
                    final_decision TEXT,
                    reviewer_confidence TEXT,
                    criteria_json TEXT NOT NULL,
                    comment_text TEXT,
                    suggested_correction TEXT,
                    reviewer_profile_json TEXT NOT NULL,
                    submitted_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (trace_id, reviewer_id),
                    FOREIGN KEY (trace_id) REFERENCES evaluation_traces(trace_id)
                );

                CREATE TABLE IF NOT EXISTS imported_datasets (
                    import_id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    status TEXT NOT NULL,
                    row_count INTEGER NOT NULL,
                    human_label_count INTEGER NOT NULL,
                    source_context_count INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    used_batch_id TEXT,
                    metadata_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS imported_dataset_records (
                    record_id TEXT PRIMARY KEY,
                    import_id TEXT NOT NULL,
                    case_id TEXT NOT NULL,
                    row_index INTEGER NOT NULL,
                    record_json TEXT NOT NULL,
                    FOREIGN KEY (import_id) REFERENCES imported_datasets(import_id)
                );

                CREATE INDEX IF NOT EXISTS idx_evaluation_traces_created_at
                    ON evaluation_traces(created_at);
                CREATE INDEX IF NOT EXISTS idx_evaluation_runs_trace_id
                    ON evaluation_runs(trace_id);
                CREATE INDEX IF NOT EXISTS idx_evaluation_runs_started_at
                    ON evaluation_runs(started_at);
                CREATE INDEX IF NOT EXISTS idx_evaluation_batches_created_at
                    ON evaluation_batches(created_at);
                CREATE INDEX IF NOT EXISTS idx_human_reviews_trace_id
                    ON human_reviews(trace_id);
                CREATE INDEX IF NOT EXISTS idx_human_reviews_reviewer_id
                    ON human_reviews(reviewer_id);
                CREATE INDEX IF NOT EXISTS idx_imported_datasets_created_at
                    ON imported_datasets(created_at);
                CREATE INDEX IF NOT EXISTS idx_imported_dataset_records_import_id
                    ON imported_dataset_records(import_id);
                """
            )
            self._ensure_column(connection, "evaluation_traces", "batch_id", "TEXT")
            self._ensure_column(connection, "evaluation_runs", "batch_id", "TEXT")
            self._ensure_column(
                connection,
                "human_reviews",
                "is_adjudication",
                "INTEGER NOT NULL DEFAULT 0",
            )
            self._ensure_column(connection, "human_reviews", "adjudication_status", "TEXT")
            self._ensure_column(connection, "human_reviews", "duration_seconds", "REAL")
            connection.executescript(
                """
                CREATE INDEX IF NOT EXISTS idx_evaluation_traces_batch_id
                    ON evaluation_traces(batch_id);
                CREATE INDEX IF NOT EXISTS idx_evaluation_runs_batch_id
                    ON evaluation_runs(batch_id);
                """
            )

    def _ensure_column(
        self,
        connection: sqlite3.Connection,
        table_name: str,
        column_name: str,
        column_type: str,
    ) -> None:
        columns = {
            str(row["name"])
            for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()
        }
        if column_name not in columns:
            connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")

    def create_batch(
        self,
        *,
        batch_type: str,
        question_count: int,
        status: str = "completed",
        metadata: dict[str, Any] | None = None,
    ) -> str:
        batch_id = f"batch_{uuid.uuid4().hex[:12]}"
        timestamp = now_iso()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO evaluation_batches (
                    batch_id,
                    batch_type,
                    status,
                    question_count,
                    created_at,
                    completed_at,
                    metadata_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    batch_id,
                    batch_type,
                    status,
                    question_count,
                    timestamp,
                    timestamp if status == "completed" else None,
                    _json_dumps(metadata or {}),
                ),
            )
        return batch_id

    def update_batch_metadata(self, batch_id: str, metadata: dict[str, Any]) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE evaluation_batches
                SET metadata_json = ?
                WHERE batch_id = ?
                """,
                (_json_dumps(metadata), batch_id),
            )

    def freeze_batch(self, batch_id: str) -> dict[str, Any] | None:
        """Mark a batch as frozen so its answers and judge results stay immutable."""
        batch = self.get_batch(batch_id)
        if batch is None:
            return None
        metadata = dict(batch.get("metadata") or {})
        metadata["frozen"] = True
        metadata.setdefault("frozen_at", now_iso())
        self.update_batch_metadata(batch_id, metadata)
        batch["metadata"] = metadata
        return batch

    def is_batch_frozen(self, batch_id: str | None) -> bool:
        batch = self.get_batch(batch_id)
        if batch is None:
            return False
        return bool((batch.get("metadata") or {}).get("frozen"))

    def get_trace_batch_id(self, trace_id: str) -> str | None:
        if not trace_id:
            return None
        with self._connect() as connection:
            row = connection.execute(
                "SELECT batch_id FROM evaluation_traces WHERE trace_id = ?",
                (trace_id,),
            ).fetchone()
        if row is None:
            return None
        return row["batch_id"]

    def update_batch_status(
        self,
        batch_id: str,
        *,
        status: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        completed_at = now_iso() if status in {"completed", "completed_with_errors", "failed"} else None
        with self._connect() as connection:
            if metadata is None:
                connection.execute(
                    """
                    UPDATE evaluation_batches
                    SET status = ?, completed_at = ?
                    WHERE batch_id = ?
                    """,
                    (status, completed_at, batch_id),
                )
            else:
                connection.execute(
                    """
                    UPDATE evaluation_batches
                    SET status = ?, completed_at = ?, metadata_json = ?
                    WHERE batch_id = ?
                    """,
                    (status, completed_at, _json_dumps(metadata), batch_id),
                )

    def save_trace(
        self,
        trace: dict[str, Any],
        *,
        run_type: str,
        provider: str,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        cost_estimate_usd: float | None = None,
        status: str = "completed",
        error_message: str = "",
        metadata: dict[str, Any] | None = None,
        batch_id: str | None = None,
    ) -> str:
        run_id = f"run_{uuid.uuid4().hex[:12]}"
        timestamp = now_iso()
        self.upsert_trace(trace, status=status, timestamp=timestamp, batch_id=batch_id)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO evaluation_runs (
                    run_id,
                    batch_id,
                    trace_id,
                    run_type,
                    provider,
                    model_name,
                    answer_prompt_version,
                    judge_prompt_version,
                    status,
                    started_at,
                    completed_at,
                    input_tokens,
                    output_tokens,
                    cost_estimate_usd,
                    error_message,
                    metadata_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    batch_id,
                    trace["trace_id"],
                    run_type,
                    provider,
                    trace.get("generated_answer", {}).get("model_name"),
                    trace.get("generated_answer", {}).get("answer_prompt_version")
                    or trace.get("generated_answer", {}).get("prompt_version"),
                    trace.get("automated_evaluation", {}).get("judge_prompt_version"),
                    status,
                    timestamp,
                    timestamp if status == "completed" else None,
                    input_tokens,
                    output_tokens,
                    cost_estimate_usd,
                    error_message,
                    _json_dumps(metadata or {}),
                ),
            )
        return run_id

    def update_trace(self, trace: dict[str, Any], *, status: str = "completed") -> None:
        trace = _strip_review_annotations(trace)
        timestamp = now_iso()
        self.upsert_trace(trace, status=status, timestamp=timestamp)
        self.sync_human_reviews_from_trace(trace, updated_at=timestamp)

    def upsert_trace(
        self,
        trace: dict[str, Any],
        *,
        status: str,
        timestamp: str,
        batch_id: str | None = None,
    ) -> None:
        created_at = trace.get("created_at") or timestamp
        question = trace.get("citizen_question", {})
        service = trace.get("service_entry", {})
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO evaluation_traces (
                    trace_id,
                    batch_id,
                    created_at,
                    updated_at,
                    variant,
                    question_id,
                    service_id,
                    status,
                    trace_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(trace_id) DO UPDATE SET
                    batch_id = COALESCE(excluded.batch_id, evaluation_traces.batch_id),
                    updated_at = excluded.updated_at,
                    variant = excluded.variant,
                    question_id = excluded.question_id,
                    service_id = excluded.service_id,
                    status = excluded.status,
                    trace_json = excluded.trace_json
                """,
                (
                    trace["trace_id"],
                    batch_id,
                    created_at,
                    timestamp,
                    trace.get("variant", "runtime"),
                    question.get("question_id"),
                    service.get("service_id") or question.get("service_id"),
                    status,
                    _json_dumps(trace),
                ),
            )

    def upsert_human_review(
        self,
        review: dict[str, Any],
        *,
        updated_at: str | None = None,
    ) -> None:
        trace_id = str(review.get("trace_id") or "")
        reviewer_id = str(
            review.get("reviewer_id")
            or review.get("reviewer_role")
            or review.get("review_id")
            or "reviewer"
        )
        if not trace_id:
            raise ValueError("human review trace_id is required")
        if not reviewer_id:
            raise ValueError("human review reviewer_id is required")

        timestamp = updated_at or now_iso()
        submitted_at = str(review.get("submitted_at") or timestamp)
        criteria = review.get("criteria") if isinstance(review.get("criteria"), dict) else {}
        reviewer_profile = (
            review.get("reviewer_profile")
            if isinstance(review.get("reviewer_profile"), dict)
            else {}
        )

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO human_reviews (
                    trace_id,
                    reviewer_id,
                    review_id,
                    reviewer_role,
                    is_adjudication,
                    adjudication_status,
                    human_score,
                    label,
                    final_decision,
                    reviewer_confidence,
                    criteria_json,
                    comment_text,
                    suggested_correction,
                    reviewer_profile_json,
                    duration_seconds,
                    submitted_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(trace_id, reviewer_id) DO UPDATE SET
                    review_id = excluded.review_id,
                    reviewer_role = excluded.reviewer_role,
                    is_adjudication = excluded.is_adjudication,
                    adjudication_status = excluded.adjudication_status,
                    human_score = excluded.human_score,
                    label = excluded.label,
                    final_decision = excluded.final_decision,
                    reviewer_confidence = excluded.reviewer_confidence,
                    criteria_json = excluded.criteria_json,
                    comment_text = excluded.comment_text,
                    suggested_correction = excluded.suggested_correction,
                    reviewer_profile_json = excluded.reviewer_profile_json,
                    duration_seconds = excluded.duration_seconds,
                    submitted_at = excluded.submitted_at,
                    updated_at = excluded.updated_at
                """,
                (
                    trace_id,
                    reviewer_id,
                    str(review.get("review_id") or f"review_{trace_id}_{reviewer_id}"),
                    str(review.get("reviewer_role") or ""),
                    1 if review.get("is_adjudication") else 0,
                    str(review.get("adjudication_status") or ""),
                    review.get("human_score"),
                    str(review.get("label") or ""),
                    str(review.get("final_decision") or ""),
                    str(review.get("reviewer_confidence") or ""),
                    _json_dumps(criteria),
                    str(review.get("comment_text") or ""),
                    str(review.get("suggested_correction") or ""),
                    _json_dumps(reviewer_profile),
                    _duration_seconds_value(review.get("duration_seconds")),
                    submitted_at,
                    timestamp,
                ),
            )

    def sync_human_reviews_from_trace(
        self,
        trace: dict[str, Any],
        *,
        updated_at: str | None = None,
    ) -> None:
        reviews = trace.get("human_reviews")
        if not isinstance(reviews, list):
            reviews = [trace.get("mock_human_review")] if trace.get("mock_human_review") else []
        for review in reviews:
            if not isinstance(review, dict):
                continue
            review_with_trace_id = {**review, "trace_id": review.get("trace_id") or trace.get("trace_id")}
            self.upsert_human_review(review_with_trace_id, updated_at=updated_at)

    def list_human_reviews(self, *, trace_id: str | None = None) -> list[dict[str, Any]]:
        query = """
            SELECT
                trace_id,
                reviewer_id,
                review_id,
                reviewer_role,
                is_adjudication,
                adjudication_status,
                human_score,
                label,
                final_decision,
                reviewer_confidence,
                criteria_json,
                comment_text,
                suggested_correction,
                reviewer_profile_json,
                duration_seconds,
                submitted_at,
                updated_at
            FROM human_reviews
        """
        params: list[Any] = []
        if trace_id is not None:
            query += " WHERE trace_id = ?"
            params.append(trace_id)
        query += " ORDER BY trace_id, reviewer_id"
        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()

        reviews: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["is_adjudication"] = bool(item.get("is_adjudication"))
            item["criteria"] = _json_loads(item.pop("criteria_json"))
            item["reviewer_profile"] = _json_loads(item.pop("reviewer_profile_json"))
            item["duration_seconds"] = _duration_seconds_value(item.get("duration_seconds"))
            reviews.append(item)
        return reviews

    def _hydrate_trace_reviews(self, trace: dict[str, Any]) -> dict[str, Any]:
        trace_id = str(trace.get("trace_id") or "")
        if not trace_id or "human_reviews" not in trace:
            return trace
        reviews = self.list_human_reviews(trace_id=trace_id)
        if not reviews:
            return trace
        hydrated = json.loads(json.dumps(trace, ensure_ascii=False))
        hydrated["human_reviews"] = reviews
        hydrated["mock_human_review"] = reviews[-1]
        return hydrated

    def get_trace(self, trace_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT trace_json FROM evaluation_traces WHERE trace_id = ?",
                (trace_id,),
            ).fetchone()
        if row is None:
            return None
        return self._hydrate_trace_reviews(_json_loads(row["trace_json"]))

    def list_traces(
        self,
        *,
        limit: int | None = None,
        offset: int = 0,
        batch_id: str | None = None,
    ) -> list[dict[str, Any]]:
        query = "SELECT trace_json FROM evaluation_traces ORDER BY created_at, trace_id"
        params: list[Any] = []
        if batch_id is not None:
            query = (
                "SELECT trace_json FROM evaluation_traces "
                "WHERE batch_id = ? ORDER BY created_at, trace_id"
            )
            params.append(batch_id)
        if limit is not None:
            query += " LIMIT ? OFFSET ?"
            params.extend([limit, offset])
        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()
        return [self._hydrate_trace_reviews(_json_loads(row["trace_json"])) for row in rows]

    def list_batches(self, *, limit: int | None = None, offset: int = 0) -> list[dict[str, Any]]:
        query = """
            SELECT
                batch_id,
                batch_type,
                status,
                question_count,
                created_at,
                completed_at,
                metadata_json
            FROM evaluation_batches
            ORDER BY created_at, rowid
        """
        params: list[Any] = []
        if limit is not None:
            query += " LIMIT ? OFFSET ?"
            params.extend([limit, offset])
        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()
        batches: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["metadata"] = _json_loads(item.pop("metadata_json"))
            batches.append(item)
        return batches

    def latest_batch(
        self,
        *,
        exclude_batch_types: tuple[str, ...] = (),
    ) -> dict[str, Any] | None:
        exclusions = tuple(str(item) for item in exclude_batch_types if str(item))
        where_clause = ""
        params: list[Any] = []
        if exclusions:
            placeholders = ", ".join("?" for _ in exclusions)
            where_clause = f"WHERE batch_type NOT IN ({placeholders})"
            params.extend(exclusions)
        with self._connect() as connection:
            row = connection.execute(
                f"""
                SELECT
                    batch_id,
                    batch_type,
                    status,
                    question_count,
                    created_at,
                    completed_at,
                    metadata_json
                FROM evaluation_batches
                {where_clause}
                ORDER BY created_at DESC, rowid DESC
                LIMIT 1
                """,
                params,
            ).fetchone()
        if row is None:
            return None
        item = dict(row)
        item["metadata"] = _json_loads(item.pop("metadata_json"))
        return item

    def get_batch(self, batch_id: str | None) -> dict[str, Any] | None:
        if not batch_id:
            return None
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT
                    batch_id,
                    batch_type,
                    status,
                    question_count,
                    created_at,
                    completed_at,
                    metadata_json
                FROM evaluation_batches
                WHERE batch_id = ?
                LIMIT 1
                """,
                (batch_id,),
            ).fetchone()
        if row is None:
            return None
        item = dict(row)
        item["metadata"] = _json_loads(item.pop("metadata_json"))
        return item

    def list_runs(self, *, limit: int | None = None, offset: int = 0) -> list[dict[str, Any]]:
        query = """
            SELECT
                run_id,
                batch_id,
                trace_id,
                run_type,
                provider,
                model_name,
                answer_prompt_version,
                judge_prompt_version,
                status,
                started_at,
                completed_at,
                input_tokens,
                output_tokens,
                cost_estimate_usd,
                error_message,
                metadata_json
            FROM evaluation_runs
            ORDER BY started_at, run_id
        """
        params: list[Any] = []
        if limit is not None:
            query += " LIMIT ? OFFSET ?"
            params.extend([limit, offset])
        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()
        runs: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["metadata"] = _json_loads(item.pop("metadata_json"))
            runs.append(item)
        return runs

    def create_imported_dataset(
        self,
        *,
        filename: str,
        records: list[dict[str, Any]],
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not records:
            raise ValueError("At least one imported answer record is required.")
        import_id = f"import_{uuid.uuid4().hex[:12]}"
        timestamp = now_iso()
        human_label_count = sum(1 for record in records if isinstance(record.get("human_review"), dict))
        source_context_count = sum(1 for record in records if str(record.get("source_context") or "").strip())
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO imported_datasets (
                    import_id,
                    filename,
                    status,
                    row_count,
                    human_label_count,
                    source_context_count,
                    created_at,
                    updated_at,
                    used_batch_id,
                    metadata_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    import_id,
                    filename,
                    "draft",
                    len(records),
                    human_label_count,
                    source_context_count,
                    timestamp,
                    timestamp,
                    None,
                    _json_dumps(metadata or {}),
                ),
            )
            for index, record in enumerate(records, start=1):
                case_id = str(record.get("case_id") or f"imported_{index:03d}")
                connection.execute(
                    """
                    INSERT INTO imported_dataset_records (
                        record_id,
                        import_id,
                        case_id,
                        row_index,
                        record_json
                    )
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        f"import_record_{uuid.uuid4().hex[:12]}",
                        import_id,
                        case_id,
                        index,
                        json.dumps(record, ensure_ascii=False, sort_keys=True),
                    ),
                )
        dataset = self.get_imported_dataset(import_id)
        if dataset is None:
            raise ValueError("Could not create imported dataset.")
        return dataset

    def _imported_dataset_from_row(self, row: sqlite3.Row) -> dict[str, Any]:
        item = dict(row)
        item["metadata"] = _json_loads(item.pop("metadata_json"))
        return item

    def list_imported_datasets(self, *, include_archived: bool = False) -> list[dict[str, Any]]:
        query = """
            SELECT
                import_id,
                filename,
                status,
                row_count,
                human_label_count,
                source_context_count,
                created_at,
                updated_at,
                used_batch_id,
                metadata_json
            FROM imported_datasets
        """
        params: list[Any] = []
        if not include_archived:
            query += " WHERE status != ?"
            params.append("archived")
        query += " ORDER BY created_at DESC, import_id DESC"
        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()
        return [self._imported_dataset_from_row(row) for row in rows]

    def get_imported_dataset(self, import_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT
                    import_id,
                    filename,
                    status,
                    row_count,
                    human_label_count,
                    source_context_count,
                    created_at,
                    updated_at,
                    used_batch_id,
                    metadata_json
                FROM imported_datasets
                WHERE import_id = ?
                LIMIT 1
                """,
                (import_id,),
            ).fetchone()
        if row is None:
            return None
        return self._imported_dataset_from_row(row)

    def list_imported_dataset_records(self, import_id: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT record_json
                FROM imported_dataset_records
                WHERE import_id = ?
                ORDER BY row_index
                """,
                (import_id,),
            ).fetchall()
        return [json.loads(row["record_json"]) for row in rows]

    def mark_imported_dataset_used(self, import_id: str, batch_id: str) -> dict[str, Any]:
        timestamp = now_iso()
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE imported_datasets
                SET status = ?, used_batch_id = ?, updated_at = ?
                WHERE import_id = ?
                """,
                ("used", batch_id, timestamp, import_id),
            )
        dataset = self.get_imported_dataset(import_id)
        if dataset is None:
            raise ValueError(f"Unknown import_id: {import_id}")
        return dataset

    def delete_or_archive_imported_dataset(self, import_id: str) -> dict[str, Any]:
        dataset = self.get_imported_dataset(import_id)
        if dataset is None:
            raise ValueError(f"Unknown import_id: {import_id}")
        if not dataset.get("used_batch_id"):
            with self._connect() as connection:
                connection.execute("DELETE FROM imported_dataset_records WHERE import_id = ?", (import_id,))
                connection.execute("DELETE FROM imported_datasets WHERE import_id = ?", (import_id,))
            return {"deleted": True, "import_id": import_id}

        timestamp = now_iso()
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE imported_datasets
                SET status = ?, updated_at = ?
                WHERE import_id = ?
                """,
                ("archived", timestamp, import_id),
            )
        return {"deleted": False, "dataset": self.get_imported_dataset(import_id)}

    def save_prompt_version(
        self,
        *,
        prompt_type: str,
        prompt_version: str,
        prompt_text: str,
        model_name: str = "",
        notes: str = "",
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO prompt_versions (
                    prompt_type,
                    prompt_version,
                    prompt_text,
                    model_name,
                    notes,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(prompt_type, prompt_version) DO UPDATE SET
                    prompt_text = excluded.prompt_text,
                    model_name = excluded.model_name,
                    notes = excluded.notes,
                    created_at = excluded.created_at
                """,
                (prompt_type, prompt_version, prompt_text, model_name, notes, now_iso()),
            )

    def list_prompt_versions(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    prompt_type,
                    prompt_version,
                    prompt_text,
                    model_name,
                    notes,
                    created_at
                FROM prompt_versions
                ORDER BY prompt_type, created_at, prompt_version
                """
            ).fetchall()
        return [dict(row) for row in rows]
