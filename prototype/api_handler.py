from __future__ import annotations

import gzip
import threading

try:
    from prototype.api_common import *
    from prototype.api_generation import *
    from prototype.api_evaluation import *
    from prototype.api_trace import *
    from prototype.api_store import PrototypeStore
    from prototype.api_views import render_dashboard, render_home
except ModuleNotFoundError:
    from api_common import *
    from api_generation import *
    from api_evaluation import *
    from api_trace import *
    from api_store import PrototypeStore
    from api_views import render_dashboard, render_home

_HUMAN_REVIEW_WRITE_LOCK = threading.Lock()

class PrototypeHandler(BaseHTTPRequestHandler):
    store: PrototypeStore

    def log_message(self, format: str, *args: object) -> None:
        print(f"[{now_iso()}] {self.address_string()} {format % args}", file=sys.stderr)

    def _send_json(self, data: object, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        accepts_gzip = "gzip" in self.headers.get("Accept-Encoding", "").lower()
        if accepts_gzip:
            body = gzip.compress(body)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        if accepts_gzip:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Vary", "Accept-Encoding")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, body: str, status: HTTPStatus = HTTPStatus.OK) -> None:
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _send_text(
        self,
        body: str,
        *,
        content_type: str,
        status: HTTPStatus = HTTPStatus.OK,
    ) -> None:
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.end_headers()
        self.wfile.write(encoded)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON body: {exc}") from exc

    def do_OPTIONS(self) -> None:
        self._send_json({"status": "ok"})

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = parse_qs(parsed.query)

        try:
            if path == "/":
                self._send_html(render_home(self.store))
            elif path == "/dashboard":
                self._send_html(render_dashboard(self.store))
            elif path == "/health":
                self._send_json({"status": "ok", "time": now_iso()})
            elif path == "/api/v1/health":
                self._send_json({"status": "ok", "api_version": "v1", "time": now_iso()})
            elif path == "/api/v1/integration/status":
                self._send_json(self.store.integration_status())
            elif path == "/api/v1/runs":
                self._send_json(self.store.api_runs())
            elif path.startswith("/api/v1/runs/"):
                self.get_api_run_read_model(path, query)
            elif path == "/services":
                self._send_json(self.get_services(query))
            elif path.startswith("/services/"):
                self._send_json(self.get_service(path))
            elif path == "/questions":
                self._send_json(self.get_questions(query))
            elif path.startswith("/questions/"):
                self._send_json(self.get_question(path))
            elif path == "/traces":
                self._send_json(self.get_traces(query))
            elif path.startswith("/traces/"):
                self._send_json(self.get_trace(path))
            elif path == "/api/v1/traces":
                self._send_json(self.get_traces(query))
            elif path.startswith("/api/v1/traces/"):
                self._send_json(self.get_trace_by_id(unquote(path.split("/", 4)[4])))
            elif path == "/developer/worklist":
                batch_id = query.get("batch_id", [""])[0].strip() or None
                self._send_json(self.store.developer_worklist(batch_id=batch_id))
            elif path == "/developer/prompts":
                self._send_json(self.store.developer_prompts())
            elif path == "/developer/imported-datasets":
                include_archived = query.get("include_archived", ["false"])[0].lower() == "true"
                self._send_json(self.store.imported_answer_datasets(include_archived=include_archived))
            elif path.startswith("/developer/imported-datasets/"):
                import_id = unquote(path.split("/", 3)[3])
                self._send_json(self.get_imported_dataset(import_id))
            elif path == "/developer/judge-calibration":
                batch_id = query.get("batch_id", [""])[0].strip() or None
                limit = int(query.get("limit", ["20"])[0])
                self._send_json(self.store.judge_calibration_run(batch_id=batch_id, limit=limit))
            elif path == "/developer/repeat-consistency":
                raw_batch_ids = query.get("batch_ids", [""])[0].strip()
                batch_ids = [part.strip() for part in raw_batch_ids.split(",") if part.strip()]
                self._send_json(
                    self.store.developer_repeat_consistency(
                        import_id=query.get("import_id", [""])[0].strip() or None,
                        batch_ids=batch_ids or None,
                        judge_prompt_version=query.get("judge_prompt_version", [""])[0].strip() or None,
                        judge_model_name=query.get("judge_model_name", [""])[0].strip() or None,
                        judge_context_label=query.get("judge_context_label", [""])[0].strip() or None,
                    )
                )
            elif path == "/developer/improvement-suggestions":
                batch_id = query.get("batch_id", [""])[0].strip() or None
                self._send_json(self.store.developer_improvement_suggestions(batch_id=batch_id))
            elif path == "/developer/runs":
                self._send_json(self.get_evaluation_runs(query))
            elif path == "/developer/storage":
                self._send_json(self.get_storage_status())
            elif path == "/reviewer/assignment":
                participant = query.get("participant", [""])[0]
                batch_id = query.get("batch_id", [""])[0].strip() or None
                token = query.get("token", [""])[0]
                self._send_json(
                    self.store.reviewer_assignment(participant, batch_id=batch_id, token=token),
                )
            elif path == "/dashboard/overview":
                self._send_json(self.store.dashboard_overview())
            elif path == "/api/v1/metrics/overview":
                self._send_json(self.store.dashboard_overview())
            else:
                self._send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        except PermissionError as exc:
            self._send_json({"error": str(exc)}, HTTPStatus.FORBIDDEN)
        except KeyError as exc:
            self._send_json({"error": str(exc)}, HTTPStatus.NOT_FOUND)
        except ValueError as exc:
            self._send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)

    def get_api_run_read_model(self, path: str, query: dict[str, list[str]]) -> None:
        suffix = path.removeprefix("/api/v1/runs/")
        parts = [unquote(part) for part in suffix.split("/") if part]
        if len(parts) < 2:
            self._send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
            return
        batch_id, resource = parts[0], parts[1]
        if resource == "research-summary" and len(parts) == 2:
            self._send_json(self.store.research_summary(batch_id))
            return
        if resource == "management-summary" and len(parts) == 2:
            self._send_json(self.store.management_summary(batch_id, query))
            return
        if resource == "audit-evidence" and len(parts) == 2:
            self._send_json(self.store.audit_evidence(batch_id))
            return
        if resource == "exports" and len(parts) == 3:
            export_name = parts[2]
            if export_name == "research-cases.csv":
                self._send_text(
                    self.store.research_case_export_csv(batch_id),
                    content_type="text/csv; charset=utf-8",
                )
                return
            if export_name == "research-reviews.csv":
                self._send_text(
                    self.store.research_review_export_csv(batch_id),
                    content_type="text/csv; charset=utf-8",
                )
                return
            if export_name == "audit-evidence.csv":
                self._send_text(
                    self.store.audit_evidence_export_csv(batch_id),
                    content_type="text/csv; charset=utf-8",
                )
                return
            if export_name == "audit-evidence.json":
                self._send_text(
                    json.dumps(self.store.audit_evidence(batch_id), ensure_ascii=False, indent=2),
                    content_type="application/json; charset=utf-8",
                )
                return
            if export_name == "study-package.json":
                self._send_text(
                    json.dumps(self.store.study_package_export(batch_id), ensure_ascii=False, indent=2),
                    content_type="application/json; charset=utf-8",
                )
                return
        self._send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        try:
            payload = self._read_json()
            if path == "/answers/generate":
                trace = trace_from_payload(self.store, payload, mode="generate")
                self._send_json(trace, HTTPStatus.CREATED)
            elif path in {"/evaluations", "/api/v1/evaluations"}:
                trace = trace_from_payload(self.store, payload, mode="evaluate")
                self._send_json(trace, HTTPStatus.CREATED)
            elif path == "/reviewer/reviews/human":
                self._send_json(
                    self.post_human_review(payload, require_participant_token=True),
                    HTTPStatus.CREATED,
                )
            elif path in {"/reviews/human", "/api/v1/human-reviews"}:
                self._send_json(self.post_human_review(payload), HTTPStatus.CREATED)
            elif path == "/developer/test-run":
                limit = int(payload.get("limit", 5))
                settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else payload
                self._send_json(
                    self.store.create_developer_test_run(limit=limit, settings=settings),
                    HTTPStatus.CREATED,
                )
            elif path == "/developer/demo-run":
                settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else payload
                question_ids = payload.get("question_ids") if isinstance(payload.get("question_ids"), list) else None
                self._send_json(
                    self.store.create_developer_demo_run(settings=settings, question_ids=question_ids),
                    HTTPStatus.CREATED,
                )
            elif path == "/developer/study-run":
                raw_limit = payload.get("limit")
                limit = int(raw_limit) if raw_limit not in (None, "") else None
                settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else payload
                question_ids = payload.get("question_ids") if isinstance(payload.get("question_ids"), list) else None
                self._send_json(
                    self.store.create_developer_study_run(
                        limit=limit,
                        settings=settings,
                        question_ids=question_ids,
                    ),
                    HTTPStatus.CREATED,
                )
            elif path == "/developer/imported-answer-run":
                settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
                records = payload.get("records") if isinstance(payload.get("records"), list) else []
                import_id = str(payload.get("import_id") or "").strip() or None
                self._send_json(
                    self.store.create_imported_answer_run(import_id=import_id, records=records, settings=settings),
                    HTTPStatus.CREATED,
                )
            elif path == "/developer/imported-datasets":
                filename = str(payload.get("filename") or "imported_answers.csv")
                records = payload.get("records") if isinstance(payload.get("records"), list) else []
                self._send_json(
                    self.store.create_imported_answer_dataset(filename=filename, records=records),
                    HTTPStatus.CREATED,
                )
            elif path.startswith("/developer/imported-datasets/") and path.endswith("/run"):
                import_id = unquote(path.split("/", 3)[3].removesuffix("/run"))
                settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
                self._send_json(
                    self.store.create_imported_answer_run(import_id=import_id, settings=settings),
                    HTTPStatus.CREATED,
                )
            elif path == "/developer/judge-calibration":
                settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else payload
                self._send_json(
                    self.store.create_judge_calibration_run(settings=settings),
                    HTTPStatus.CREATED,
                )
            elif path == "/developer/judge-rerun":
                trace_id = str(payload.get("trace_id") or "").strip()
                settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else payload
                self._send_json(
                    self.store.rerun_judge(trace_id, settings=settings),
                    HTTPStatus.CREATED,
                )
            elif path == "/developer/improvement-suggestions/generate":
                batch_id = str(payload.get("batch_id") or "").strip() or None
                self._send_json(
                    self.store.developer_generate_improvement_suggestions(batch_id=batch_id),
                    HTTPStatus.CREATED,
                )
            elif path == "/developer/prompts":
                self._send_json(self.store.save_prompt_version(payload), HTTPStatus.CREATED)
            elif path == "/developer/reviewer-plan":
                self._send_json(self.post_reviewer_plan(payload), HTTPStatus.CREATED)
            elif path == "/developer/reviewer-plan/participants":
                self._send_json(self.post_add_reviewer_participant(payload))
            elif path == "/developer/reviewer-plan/participants/exclude":
                self._send_json(self.post_reviewer_exclusion(payload))
            elif path == "/developer/reviewer-plan/close":
                self._send_json(self.post_close_reviewer_plan(payload))
            else:
                self._send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        except FrozenRunError as exc:
            self._send_json({"error": str(exc)}, HTTPStatus.CONFLICT)
        except PermissionError as exc:
            self._send_json({"error": str(exc)}, HTTPStatus.FORBIDDEN)
        except KeyError as exc:
            self._send_json({"error": str(exc)}, HTTPStatus.NOT_FOUND)
        except ValueError as exc:
            self._send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        try:
            if path.startswith("/developer/imported-datasets/"):
                import_id = unquote(path.split("/", 3)[3])
                self._send_json(self.store.delete_imported_answer_dataset(import_id))
            else:
                self._send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        except KeyError as exc:
            self._send_json({"error": str(exc)}, HTTPStatus.NOT_FOUND)
        except ValueError as exc:
            self._send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)

    def get_services(self, query: dict[str, list[str]]) -> dict:
        limit = int(query.get("limit", ["20"])[0])
        offset = int(query.get("offset", ["0"])[0])
        search = query.get("search", [""])[0].lower().strip()
        services = self.store.services
        if search:
            services = [
                service
                for service in services
                if search in service.get("title", "").lower()
                or search in service.get("full_text", "").lower()
            ]
        return {
            "count": len(services),
            "limit": limit,
            "offset": offset,
            "items": [response_summary(item) for item in services[offset : offset + limit]],
        }

    def get_service(self, path: str) -> dict:
        service_id = unquote(path.split("/", 2)[2])
        service = self.store.services_by_id.get(service_id)
        if not service:
            raise KeyError(f"Unknown service_id: {service_id}")
        return service

    def get_questions(self, query: dict[str, list[str]]) -> dict:
        limit = int(query.get("limit", ["40"])[0])
        offset = int(query.get("offset", ["0"])[0])
        style = query.get("style", [""])[0].strip()
        questions = self.store.questions
        if style:
            questions = [item for item in questions if item.get("style_label") == style]
        return {
            "count": len(questions),
            "limit": limit,
            "offset": offset,
            "items": [
                question_with_source_preview(self.store, question)
                for question in questions[offset : offset + limit]
            ],
        }

    def get_question(self, path: str) -> dict:
        question_id = unquote(path.split("/", 2)[2])
        question = self.store.questions_by_id.get(question_id)
        if not question:
            raise KeyError(f"Unknown question_id: {question_id}")
        return question_with_source_preview(self.store, question)

    def get_imported_dataset(self, import_id: str) -> dict:
        dataset = self.store.imported_answer_dataset(import_id)
        if dataset is None:
            raise KeyError(f"Unknown import_id: {import_id}")
        return dataset

    def get_traces(self, query: dict[str, list[str]]) -> dict:
        limit = int(query.get("limit", ["20"])[0])
        offset = int(query.get("offset", ["0"])[0])
        disagreement_only = query.get("disagreements", ["false"])[0].lower() == "true"
        traces = self.store.all_traces()
        if disagreement_only:
            traces = [trace for trace in traces if trace.get("disagreement_case")]
        return {
            "count": len(traces),
            "limit": limit,
            "offset": offset,
            "items": traces[offset : offset + limit],
        }

    def get_trace(self, path: str) -> dict:
        trace_id = unquote(path.split("/", 2)[2])
        return self.get_trace_by_id(trace_id)

    def get_trace_by_id(self, trace_id: str) -> dict:
        trace = self.store.get_trace(trace_id)
        if not trace:
            raise KeyError(f"Unknown trace_id: {trace_id}")
        return trace

    def get_evaluation_runs(self, query: dict[str, list[str]]) -> dict:
        limit = int(query.get("limit", ["50"])[0])
        offset = int(query.get("offset", ["0"])[0])
        runs = self.store.evaluation_runs()
        return {
            "count": len(runs),
            "limit": limit,
            "offset": offset,
            "items": runs[offset : offset + limit],
        }

    def post_reviewer_plan(self, payload: dict) -> dict:
        batch_id = str(payload.get("batch_id") or "").strip() or None
        reviewer_count = int(payload.get("reviewer_count", 0))
        reviews_per_question = int(payload.get("reviews_per_question", 2))
        base_url = payload.get("base_url") or "http://127.0.0.1:5173/"
        return self.store.create_reviewer_plan(
            batch_id=batch_id,
            reviewer_count=reviewer_count,
            reviews_per_question=reviews_per_question,
            base_url=base_url,
        )

    def post_add_reviewer_participant(self, payload: dict) -> dict:
        batch_id = str(payload.get("batch_id") or "").strip() or None
        source_participant = str(payload.get("source_participant") or "").strip()
        if not source_participant:
            raise ValueError("source_participant is required")
        new_participant = str(payload.get("new_participant") or "").strip() or None
        return self.store.add_reviewer_participant(
            batch_id,
            source_participant,
            new_participant,
        )

    def post_reviewer_exclusion(self, payload: dict) -> dict:
        batch_id = str(payload.get("batch_id") or "").strip() or None
        participant = str(payload.get("participant") or "").strip()
        if not participant:
            raise ValueError("participant is required")
        excluded_raw = payload.get("excluded", True)
        if isinstance(excluded_raw, str):
            excluded = excluded_raw.strip().lower() in {"true", "1", "yes"}
        else:
            excluded = bool(excluded_raw)
        reason = str(payload.get("reason") or "").strip()
        replaced_by = str(payload.get("replaced_by") or "").strip()
        return self.store.set_reviewer_exclusion(
            batch_id,
            participant,
            excluded,
            reason=reason,
            replaced_by=replaced_by,
        )

    def post_close_reviewer_plan(self, payload: dict) -> dict:
        batch_id = str(payload.get("batch_id") or "").strip() or None
        return self.store.close_reviewer_plan(batch_id)

    def get_storage_status(self) -> dict:
        runs = self.store.evaluation_runs()
        return {
            "database_path": str(self.store.database_path),
            "sqlite_runtime_trace_count": len(self.store.evaluation_store.list_traces()),
            "legacy_jsonl_runtime_trace_count": len(load_jsonl(self.store.runtime_traces_path)),
            "evaluation_run_count": len(runs),
        }

    def post_human_review(self, payload: dict, require_participant_token: bool = False) -> dict:
        # Public reviewer submissions must prove possession of the participant
        # capability token before payload validation reveals anything else.
        participant = str(payload.get("participant_id") or "").strip()
        if require_participant_token and not participant:
            raise PermissionError("participant token is required")
        if participant:
            self.store.verify_reviewer_token(
                participant=participant,
                token=str(payload.get("token") or ""),
                batch_id=str(payload.get("batch_id") or "").strip() or None,
            )

        trace_id = str(payload.get("trace_id", ""))
        if not trace_id:
            raise ValueError("trace_id is required")

        with _HUMAN_REVIEW_WRITE_LOCK:
            trace = self.store.get_trace(trace_id)
            if not trace:
                raise KeyError(f"Unknown trace_id: {trace_id}")

            criteria_payload = payload.get("criteria") or payload.get("review_criteria") or {}
            criteria: dict[str, int] = {}
            for field_name in CANONICAL_EVALUATION_CRITERIA:
                rating_value = None
                for lookup_key in criterion_lookup_keys(field_name):
                    rating_value = criteria_payload.get(lookup_key, payload.get(lookup_key))
                    if rating_value not in (None, ""):
                        break
                rating = normalize_optional_rating(rating_value, field_name)
                if rating is not None:
                    criteria[field_name] = rating

            final_decision = payload.get("final_decision", "")
            if final_decision not in {"accept", "needs_edit", "reject"}:
                raise ValueError("final_decision must be accept, needs_edit, or reject")

            if "human_score" in payload and payload.get("human_score") not in (None, ""):
                human_score = normalize_rating(payload.get("human_score"), "human_score")
            elif criteria:
                human_score = round(sum(criteria.values()) / len(criteria))
            else:
                human_score = {"accept": 5, "needs_edit": 3, "reject": 1}[final_decision]

            label = payload.get("label", "")
            if label not in {"not_checked", "supported", "unsupported", "partly_supported"}:
                raise ValueError("label must be not_checked, supported, unsupported, or partly_supported")
            reviewer_confidence = payload.get("reviewer_confidence", "")
            if reviewer_confidence not in {"", "low", "medium", "high"}:
                raise ValueError("reviewer_confidence must be low, medium, high, or empty")
            adjudication_flag = payload.get("is_adjudication", payload.get("adjudication", False))
            is_adjudication = (
                adjudication_flag is True
                or (
                    isinstance(adjudication_flag, str)
                    and adjudication_flag.strip().lower() in {"1", "true", "yes", "adjudication"}
                )
            )

            review = {
                "review_id": payload.get("review_id") or f"review_{trace_id}_{uuid.uuid4().hex[:8]}",
                "trace_id": trace_id,
                "reviewer_id": payload.get("reviewer_id")
                or payload.get("participant_id")
                or payload.get("reviewer_role", "reviewer"),
                "reviewer_role": payload.get("reviewer_role", "reviewer"),
                "is_adjudication": is_adjudication,
                "adjudication_status": str(payload.get("adjudication_status") or "").strip(),
                "human_score": human_score,
                "label": label,
                "criteria": criteria,
                "final_decision": final_decision,
                "reviewer_confidence": reviewer_confidence,
                "comment_text": payload.get("comment_text", ""),
                "suggested_correction": payload.get("suggested_correction", ""),
                "submitted_at": now_iso(),
            }
            duration_value = payload.get("duration_seconds")
            duration_seconds: float | None = None
            if duration_value not in (None, ""):
                try:
                    parsed_duration = float(duration_value)
                except (TypeError, ValueError):
                    parsed_duration = None
                if parsed_duration is not None and parsed_duration >= 0:
                    duration_seconds = round(parsed_duration, 1)
            if duration_seconds is not None:
                review["duration_seconds"] = duration_seconds
            reviewer_profile = payload.get("reviewer_profile")
            if isinstance(reviewer_profile, dict):
                review["reviewer_profile"] = {
                    field: str(reviewer_profile.get(field, ""))
                    for field in REVIEWER_PROFILE_FIELDS
                    if reviewer_profile.get(field)
                }
            apply_human_review_to_trace(trace, review)
            self.store.update_trace(trace)
        return trace
