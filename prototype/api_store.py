from __future__ import annotations

try:
    from prototype.agreement_metrics import (
        DOMINANT_SHARE_WARN_THRESHOLD,
        agreement_stats,
        repeat_run_consistency,
    )
    from prototype.improvement_suggestions import ADJUDICATION_REVIEWER_ID, build_improvement_suggestions
    from prototype.api_common import *
    from prototype.api_generation import *
    from prototype.api_evaluation import *
    from prototype.api_openai import *
    from prototype.api_trace import *
except ModuleNotFoundError:
    from agreement_metrics import (
        DOMINANT_SHARE_WARN_THRESHOLD,
        agreement_stats,
        repeat_run_consistency,
    )
    from improvement_suggestions import ADJUDICATION_REVIEWER_ID, build_improvement_suggestions
    from api_common import *
    from api_generation import *
    from api_evaluation import *
    from api_openai import *
    from api_trace import *

class PrototypeStore:
    def __init__(self, data_dir: Path, database_path: Path | None = None) -> None:
        self.data_dir = data_dir
        self.services_path = data_dir / "services.jsonl"
        self.questions_path = data_dir / "citizen_questions.jsonl"
        self.llm_questions_path = data_dir / "llm_citizen_questions.jsonl"
        self.sample_traces_path = data_dir / "sample_evaluation_traces.jsonl"
        self.runtime_traces_path = data_dir / "runtime_evaluation_traces.jsonl"
        self.database_path = database_path or data_dir / "evaluation_runs.sqlite3"
        self.evaluation_store = SQLiteEvaluationStore(self.database_path)
        self.services = load_jsonl(self.services_path)
        self.controlled_questions = load_jsonl(self.questions_path)
        self.llm_questions = load_jsonl(self.llm_questions_path)
        self.questions = self.controlled_questions + self.llm_questions
        self.sample_traces = load_jsonl(self.sample_traces_path)
        self.services_by_id = {str(item["service_id"]): item for item in self.services}
        self.questions_by_id = {str(item["question_id"]): item for item in self.questions}

    def runtime_traces(self) -> list[dict]:
        by_id: dict[str, dict] = {}
        for trace in load_jsonl(self.runtime_traces_path):
            by_id[str(trace["trace_id"])] = trace
        for trace in self.evaluation_store.list_traces():
            by_id[str(trace["trace_id"])] = trace
        return list(by_id.values())

    def evaluation_runs(self) -> list[dict]:
        return self.evaluation_store.list_runs()

    def all_traces(self) -> list[dict]:
        by_id: dict[str, dict] = {}
        for trace in self.sample_traces:
            by_id[str(trace["trace_id"])] = trace
        for trace in self.runtime_traces():
            by_id[str(trace["trace_id"])] = trace
        return list(by_id.values())

    def get_trace(self, trace_id: str) -> dict | None:
        for trace in self.all_traces():
            if trace.get("trace_id") == trace_id:
                return trace
        return None

    def save_runtime_trace(
        self,
        trace: dict,
        *,
        run_type: str | None = None,
        batch_id: str | None = None,
    ) -> None:
        provider = "baseline"
        if str(trace.get("generated_answer", {}).get("generation_mode", "")).startswith("openai"):
            provider = "openai"
        self.evaluation_store.save_trace(
            trace,
            run_type=run_type or trace.get("variant", "runtime").replace("runtime_", "") or "runtime",
            provider=provider,
            metadata={
                "storage": "sqlite",
                "legacy_jsonl_path": str(self.runtime_traces_path),
            },
            batch_id=batch_id,
        )

    def update_trace(self, trace: dict) -> None:
        self.evaluation_store.update_trace(trace)

    def rerun_judge(self, trace_id: str, settings: dict | None = None) -> dict:
        trace = self.evaluation_store.get_trace(trace_id) or self.get_trace(trace_id)
        if not trace:
            raise KeyError(f"Unknown trace_id: {trace_id}")
        self._assert_trace_mutable(trace)

        settings = settings or {}
        question = trace.get("citizen_question", {})
        answer_text = str(trace.get("generated_answer", {}).get("answer_text") or "")
        retrievals = trace.get("retrieval_results")
        if not isinstance(retrievals, list) or not retrievals:
            retrieval = trace.get("retrieval_result")
            retrievals = [retrieval] if isinstance(retrieval, dict) else []
        context = "\n\n".join(str(item.get("chunk_text") or "") for item in retrievals)
        judge_context = format_retrieved_context_for_judge(retrievals)

        judge_mode = str(settings.get("judge_mode") or "rule_based_baseline")
        judge_prompt_version = str(settings.get("judge_prompt_version") or "rule_judge_v0")
        judge_prompt_text = str(settings.get("judge_prompt_text") or "")
        judge_question_label = str(settings.get("judge_question_label") or "") or None
        judge_context_label = str(settings.get("judge_context_label") or "") or None
        is_external_answer = (
            str(trace.get("generated_answer", {}).get("generation_mode") or "")
            == "imported_chatbot_answer"
        )
        judge_model_name = ""
        if judge_mode == "openai_judge_v1":
            judge_model_name = str(settings.get("judge_model_name") or default_openai_model())
            if not is_openai_model(judge_model_name):
                judge_model_name = default_openai_model()
            automated = generate_openai_judge(
                question=question,
                answer_text=answer_text,
                context=judge_context,
                model_name=judge_model_name,
                prompt_text=judge_prompt_text,
                requires_clarification=bool(question.get("requires_clarification")),
                question_label=judge_question_label,
                context_label=judge_context_label,
                is_external_answer=is_external_answer,
            )
        else:
            automated = evaluate_answer(
                str(question.get("question_text") or ""),
                answer_text,
                context,
                requires_clarification=bool(question.get("requires_clarification")),
            )
            judge_model_name = str(settings.get("judge_model_name") or "rule_based_baseline")

        rerun_id = f"judge_rerun_{uuid.uuid4().hex[:12]}"
        automated["auto_eval_id"] = f"auto_{rerun_id}"
        automated["trace_id"] = trace_id
        automated["judge_prompt_version"] = judge_prompt_version
        automated["judge_prompt_text"] = judge_prompt_text
        automated["judge_model_name"] = judge_model_name
        automated["judge_schema_version"] = str(settings.get("judge_schema_version") or JUDGE_SCHEMA_VERSION)
        automated["evaluation_role"] = "rerun"
        automated["judge_rerun_id"] = rerun_id
        automated["rerun_of_auto_eval_id"] = trace.get("automated_evaluation", {}).get("auto_eval_id")
        automated["created_at"] = now_iso()

        trace["judge_evaluations"] = judge_evaluation_history_with_rerun(trace, automated)
        self.evaluation_store.update_trace(trace)
        return self.evaluation_store.get_trace(trace_id) or trace

    def dashboard_overview(self) -> dict:
        traces = self.all_traces()
        variants = Counter(trace.get("variant", "runtime") for trace in traces)
        labels = Counter(
            trace.get("automated_evaluation", {}).get("label", "unknown") for trace in traces
        )
        styles = Counter(
            trace.get("citizen_question", {}).get("style_label", "unknown") for trace in traces
        )
        sections = Counter(
            trace.get("citizen_question", {}).get("target_section", "unknown")
            for trace in traces
        )
        disagreements = [trace for trace in traces if trace.get("disagreement_case")]
        service_counts: defaultdict[str, int] = defaultdict(int)
        faithfulness_values: list[float] = []
        relevance_values: list[float] = []

        for trace in traces:
            service_counts[trace.get("service_entry", {}).get("title", "unknown")] += 1
            auto = trace.get("automated_evaluation", {})
            if isinstance(auto.get("faithfulness_score"), (int, float)):
                faithfulness_values.append(float(auto["faithfulness_score"]))
            if isinstance(auto.get("relevance_score"), (int, float)):
                relevance_values.append(float(auto["relevance_score"]))

        avg_faithfulness = (
            round(sum(faithfulness_values) / len(faithfulness_values), 3)
            if faithfulness_values
            else 0.0
        )
        avg_relevance = (
            round(sum(relevance_values) / len(relevance_values), 3)
            if relevance_values
            else 0.0
        )

        return {
            "created_at": now_iso(),
            "service_count": len(self.services),
            "question_count": len(self.questions),
            "controlled_question_count": len(self.controlled_questions),
            "llm_question_count": len(self.llm_questions),
            "trace_count": len(traces),
            "sample_trace_count": len(self.sample_traces),
            "runtime_trace_count": len(self.runtime_traces()),
            "disagreement_count": len(disagreements),
            "average_automated_faithfulness": avg_faithfulness,
            "average_automated_relevance": avg_relevance,
            "variant_counts": dict(variants),
            "automated_label_counts": dict(labels),
            "question_style_counts": dict(styles),
            "target_section_counts": dict(sections),
            "top_services": dict(Counter(service_counts).most_common(10)),
            "note": (
                "Sample human-review fields are synthetic reference labels. "
                "Runtime human reviews are user-submitted local evaluation data."
            ),
        }

    def integration_status(self) -> dict:
        return {
            "status": "ready",
            "api_version": "v1",
            "public_base_path": "/api/v1",
            "authentication": {
                "mode": "local",
                "api_key_required": False,
                "header_name": "X-API-Key",
                "note": (
                    "Local research mode accepts requests without authentication. "
                    "A deployment should require an API key or reverse-proxy authentication."
                ),
            },
            "capabilities": {
                "external_source_context": True,
                "structured_retrieval_results": True,
                "ai_judge_evaluation": True,
                "human_review": True,
                "trace_lookup": True,
                "aggregate_metrics": True,
                "role_specific_read_models": True,
            },
            "role_specific_read_models": {
                "runs": "implemented",
                "research_summary": "implemented",
                "management_summary": "implemented",
                "audit_evidence": "implemented",
                "research_exports": "implemented",
                "audit_exports": "implemented",
            },
            "integration_endpoints": [
                "GET /api/v1/health",
                "GET /api/v1/integration/status",
                "POST /api/v1/evaluations",
                "POST /api/v1/human-reviews",
                "GET /api/v1/traces",
                "GET /api/v1/traces/{trace_id}",
                "GET /api/v1/metrics/overview",
                "GET /api/v1/runs",
                "GET /api/v1/runs/{batch_id}/research-summary",
                "GET /api/v1/runs/{batch_id}/management-summary",
                "GET /api/v1/runs/{batch_id}/audit-evidence",
                "GET /api/v1/runs/{batch_id}/exports/research-cases.csv",
                "GET /api/v1/runs/{batch_id}/exports/research-reviews.csv",
                "GET /api/v1/runs/{batch_id}/exports/audit-evidence.csv",
                "GET /api/v1/runs/{batch_id}/exports/audit-evidence.json",
            ],
            "dashboard_internal_endpoints": [
                "GET /developer/worklist",
                "GET /developer/prompts",
                "GET /developer/imported-datasets",
                "POST /developer/imported-datasets",
                "GET /developer/imported-datasets/{import_id}",
                "POST /developer/imported-datasets/{import_id}/run",
                "DELETE /developer/imported-datasets/{import_id}",
                "POST /developer/imported-answer-run",
                "POST /developer/prompts",
                "POST /developer/test-run",
                "POST /developer/demo-run",
                "GET /developer/judge-calibration",
                "POST /developer/judge-calibration",
                "POST /developer/judge-rerun",
                "POST /developer/reviewer-plan",
                "POST /developer/reviewer-plan/close",
                "GET /developer/repeat-consistency",
                "GET /developer/improvement-suggestions",
                "GET /developer/runs",
                "GET /developer/storage",
                "GET /reviewer/assignment",
            ],
            "counts": {
                "services": len(self.services),
                "questions": len(self.questions),
                "traces": len(self.all_traces()),
                "runtime_traces": len(self.runtime_traces()),
            },
            "updated_at": now_iso(),
        }

    def developer_batch_history(self) -> list[dict]:
        return [
            batch
            for batch in reversed(self.evaluation_store.list_batches())
            if batch.get("batch_type") not in HUMAN_REVIEW_BATCH_EXCLUSIONS
        ]

    def developer_worklist(self, batch_id: str | None = None) -> dict:
        batch_history = self.developer_batch_history()
        active_run = None
        if batch_id:
            active_run = next(
                (batch for batch in batch_history if batch.get("batch_id") == batch_id),
                None,
            )
            if active_run is None:
                raise ValueError("unknown developer batch")
        else:
            active_run = self.evaluation_store.latest_batch(
                exclude_batch_types=HUMAN_REVIEW_BATCH_EXCLUSIONS,
            )
        traces = (
            self.evaluation_store.list_traces(batch_id=active_run["batch_id"])
            if active_run
            else []
        )
        reviewer_plan = active_run.get("metadata", {}).get("reviewer_plan") if active_run else None
        excluded = excluded_reviewer_ids(reviewer_plan)
        if isinstance(reviewer_plan, dict):
            reviewer_plan = self._reviewer_plan_with_progress(reviewer_plan, traces)
        items = (
            [annotate_excluded_reviews(trace, excluded) for trace in traces]
            if excluded
            else traces
        )
        return {
            "question_count": len(self.questions),
            "active_run": active_run,
            "batch_history": batch_history,
            "count": len(traces),
            "items": items,
            "reviewer_plan": reviewer_plan,
            "legacy": {
                "sample_trace_count": len(self.sample_traces),
                "legacy_jsonl_runtime_trace_count": len(load_jsonl(self.runtime_traces_path)),
            },
        }

    def developer_improvement_suggestions(self, batch_id: str | None = None) -> dict:
        """Rule-based, evidence-backed improvement cards for one batch.

        Resolves the batch the same way ``developer_worklist`` does (explicit
        ``batch_id``, else the latest non-calibration batch), then hands the
        traces to the pure ``build_improvement_suggestions``. No LLM calls -
        this only aggregates already-collected judge/human review data.
        """
        batch_history = self.developer_batch_history()
        if batch_id:
            active_run = next(
                (batch for batch in batch_history if batch.get("batch_id") == batch_id),
                None,
            )
            if active_run is None:
                raise ValueError("unknown developer batch")
        else:
            active_run = self.evaluation_store.latest_batch(
                exclude_batch_types=HUMAN_REVIEW_BATCH_EXCLUSIONS,
            )
        traces = (
            self.evaluation_store.list_traces(batch_id=active_run["batch_id"])
            if active_run
            else []
        )
        result = build_improvement_suggestions(traces)
        metadata = active_run.get("metadata", {}) if active_run else {}
        response = {
            "schema_version": "improvement-suggestions-v1",
            "batch_id": active_run.get("batch_id") if active_run else None,
            **result,
        }
        if metadata.get("judge_model_name"):
            response["judge_model_name"] = metadata.get("judge_model_name")
        if metadata.get("judge_prompt_version"):
            response["judge_prompt_version"] = metadata.get("judge_prompt_version")
        response["llm"] = metadata.get("llm_improvement_suggestions") or None
        return response

    def _compile_improvement_evidence_text(self, traces: list[dict]) -> str:
        """Compile a batch's human review + judge evidence into one text blob.

        Per case: the question (trimmed), each non-adjudication human review's
        decision + comment, and the latest judge evaluation's decision,
        explanation (skipped when it is still a generated baseline note), and any
        non-empty evidence lists. Stops adding cases once
        ``IMPROVEMENT_EVIDENCE_MAX_CHARS`` is reached so a large batch cannot
        blow past the single OpenAI call's effective budget.
        """
        blocks: list[str] = []
        total_chars = 0
        for trace in traces:
            case_id = trace_external_case_id(trace)
            question = trace_question(trace)
            lines = [
                f"Case {case_id}:",
                f"Question: {short_text(str(question.get('question_text') or ''), 200)}",
            ]

            reviews = [
                review
                for review in trace_human_reviews(trace)
                if isinstance(review, dict)
                and not review.get("is_adjudication")
                and str(review.get("reviewer_id") or "") != ADJUDICATION_REVIEWER_ID
            ]
            for review in reviews:
                decision = str(review.get("final_decision") or "n/a")
                comment = str(review.get("comment_text") or "").strip()
                if comment:
                    lines.append(f"Human review decision: {decision}; comment: {comment}")
                else:
                    lines.append(f"Human review decision: {decision}")

            evaluation = self._repeat_case_latest_evaluation(trace)
            if evaluation:
                lines.append(f"AI judge decision: {derived_judge_final_decision(evaluation)}")
                explanation = str(evaluation.get("explanation") or "").strip()
                if explanation and explanation != "OpenAI judge evaluation.":
                    lines.append(f"AI judge explanation: {explanation}")
                for field_name in (
                    "contradicted_claims",
                    "unsupported_claims",
                    "missing_or_incomplete_points",
                    "clarity_or_tone_problems",
                    "context_limitations",
                ):
                    values = evaluation.get(field_name)
                    if isinstance(values, list) and values:
                        lines.append(f"AI judge {field_name}: {'; '.join(str(value) for value in values)}")

            block_text = "\n".join(lines) + "\n\n"
            if blocks and total_chars + len(block_text) > IMPROVEMENT_EVIDENCE_MAX_CHARS:
                break
            blocks.append(block_text)
            total_chars += len(block_text)

        return "".join(blocks).strip()

    def developer_generate_improvement_suggestions(self, batch_id: str | None = None) -> dict:
        """Run the one LLM call that turns a batch's evidence into suggestions.

        Resolves the batch the same way ``developer_improvement_suggestions``
        does, compiles its human-review + judge evidence into a single text
        blob, and asks the LLM (``generate_improvement_suggestions``) to
        synthesize concrete, case-referenced recommendations. The result is
        persisted into the batch metadata under ``llm_improvement_suggestions``
        so it survives reloads without another OpenAI call, and is returned to
        the caller.
        """
        batch_history = self.developer_batch_history()
        if batch_id:
            active_run = next(
                (batch for batch in batch_history if batch.get("batch_id") == batch_id),
                None,
            )
            if active_run is None:
                raise ValueError("unknown developer batch")
        else:
            active_run = self.evaluation_store.latest_batch(
                exclude_batch_types=HUMAN_REVIEW_BATCH_EXCLUSIONS,
            )
        if active_run is None:
            raise ValueError("No evaluation run available to summarize.")

        traces = self.evaluation_store.list_traces(batch_id=active_run["batch_id"])
        if not traces:
            raise ValueError("The selected run has no cases to summarize.")

        if not os.environ.get("OPENAI_API_KEY", "").strip():
            raise ValueError(
                "OpenAI API key not configured. Add OPENAI_API_KEY to .env and restart the "
                "backend to generate LLM improvement suggestions."
            )

        evidence_text = self._compile_improvement_evidence_text(traces)
        model_name = default_openai_model()
        result = generate_improvement_suggestions(evidence_text=evidence_text, model_name=model_name)

        llm_block = {
            "generated_at": now_iso(),
            "model_name": result.get("model_name") or model_name,
            "prompt_version": IMPROVEMENT_SUGGESTIONS_PROMPT_VERSION,
            "suggestions": result["suggestions"],
        }

        metadata = dict(active_run.get("metadata") or {})
        metadata["llm_improvement_suggestions"] = llm_block
        self.evaluation_store.update_batch_metadata(active_run["batch_id"], metadata)

        return llm_block

    def api_runs(self) -> dict:
        runs = self.developer_batch_history()
        return {
            "schema_version": "runs-v1",
            "count": len(runs),
            "items": [
                {
                    "batch_id": run.get("batch_id"),
                    "batch_type": run.get("batch_type"),
                    "status": run.get("status"),
                    "question_count": run.get("question_count"),
                    "created_at": run.get("created_at"),
                    "completed_at": run.get("completed_at"),
                    "metadata": run.get("metadata") or {},
                    "links": {
                        "research_summary": f"/api/v1/runs/{run.get('batch_id')}/research-summary",
                        "management_summary": f"/api/v1/runs/{run.get('batch_id')}/management-summary",
                        "audit_evidence": f"/api/v1/runs/{run.get('batch_id')}/audit-evidence",
                    },
                }
                for run in runs
            ],
        }

    @staticmethod
    def _repeat_case_latest_evaluation(trace: dict) -> dict:
        history = trace.get("judge_evaluations")
        if isinstance(history, list):
            for item in reversed(history):
                if isinstance(item, dict):
                    return item
        automated = trace.get("automated_evaluation")
        return automated if isinstance(automated, dict) else {}

    @staticmethod
    def _repeat_case_criteria(evaluation: dict) -> dict[str, int]:
        criteria = evaluation.get("criteria")
        if not isinstance(criteria, dict):
            return {}
        scores: dict[str, int] = {}
        for key in CANONICAL_EVALUATION_CRITERIA:
            for lookup_key in CRITERION_ALIASES.get(key, (key,)):
                entry = criteria.get(lookup_key)
                if isinstance(entry, dict) and isinstance(entry.get("score"), int):
                    scores[key] = entry["score"]
                    break
        return scores

    @staticmethod
    def _repeat_case_explanation(evaluation: dict, *, max_chars: int = 160) -> str:
        raw = evaluation.get("short_explanation") or evaluation.get("explanation") or ""
        normalized = normalize_space(str(raw))
        if len(normalized) <= max_chars:
            return normalized
        return normalized[:max_chars].rsplit(" ", 1)[0] + "..."

    def developer_repeat_consistency(
        self,
        *,
        import_id: str | None = None,
        batch_ids: list[str] | None = None,
        judge_prompt_version: str | None = None,
        judge_model_name: str | None = None,
        judge_context_label: str | None = None,
    ) -> dict:
        """Cross-run judge decision consistency for repeat runs over one dataset.

        Selects completed runs either by an explicit ``batch_ids`` list or by a
        shared ``import_id`` (the "repeat run" grouping key), optionally filtered
        by judge prompt/model/context-label so only comparable runs are pooled.
        The pure statistics live in ``agreement_metrics.repeat_run_consistency``;
        this method only loads batches/traces and shapes them into plain dicts.
        """
        if batch_ids:
            batches = [
                batch
                for batch in (self.evaluation_store.get_batch(bid) for bid in batch_ids)
                if batch is not None
            ]
        elif import_id:
            batches = [
                batch
                for batch in self.evaluation_store.list_batches()
                if (batch.get("metadata") or {}).get("import_id") == import_id
            ]
        else:
            raise ValueError("import_id or batch_ids query parameter is required")

        def keep(batch: dict) -> bool:
            if batch.get("status") not in {"completed", "completed_with_errors"}:
                return False
            metadata = batch.get("metadata") or {}
            if judge_prompt_version and str(metadata.get("judge_prompt_version") or "") != judge_prompt_version:
                return False
            if judge_model_name and str(metadata.get("judge_model_name") or "") != judge_model_name:
                return False
            if judge_context_label and str(metadata.get("judge_context_label") or "") != judge_context_label:
                return False
            return True

        batches = [batch for batch in batches if keep(batch)]
        batches.sort(key=lambda batch: (str(batch.get("created_at") or ""), str(batch.get("batch_id") or "")))

        runs: list[dict] = []
        for batch in batches:
            metadata = batch.get("metadata") or {}
            traces = self.evaluation_store.list_traces(batch_id=batch["batch_id"])
            cases = []
            for trace in traces:
                human_decision = trace_majority_human_decision(trace)
                evaluation = self._repeat_case_latest_evaluation(trace)
                cases.append(
                    {
                        "case_id": trace_external_case_id(trace),
                        "question": (trace_question(trace).get("question_text") or "")[:120],
                        "final_decision": trace_ai_decision(trace),
                        "human_decision": None if human_decision == "pending" else human_decision,
                        "criteria": self._repeat_case_criteria(evaluation),
                        "explanation": self._repeat_case_explanation(evaluation),
                    }
                )
            runs.append(
                {
                    "batch_id": batch.get("batch_id"),
                    "created_at": batch.get("created_at"),
                    "judge_prompt_version": metadata.get("judge_prompt_version"),
                    "judge_model_name": metadata.get("judge_model_name"),
                    "judge_context_label": metadata.get("judge_context_label"),
                    "cases": cases,
                }
            )

        result = repeat_run_consistency(runs)
        return {
            "schema_version": "repeat-consistency-v1",
            "import_id": import_id,
            "filters": {
                "judge_prompt_version": judge_prompt_version,
                "judge_model_name": judge_model_name,
                "judge_context_label": judge_context_label,
            },
            **result,
        }

    def _batch_with_traces(self, batch_id: str) -> tuple[dict, list[dict]]:
        batch = self.evaluation_store.get_batch(batch_id)
        if not batch:
            raise KeyError("unknown evaluation run")
        return batch, self.evaluation_store.list_traces(batch_id=batch_id)

    def _run_summary_batch(self, batch: dict) -> dict:
        metadata = batch.get("metadata") if isinstance(batch.get("metadata"), dict) else {}
        return {
            "batch_id": batch.get("batch_id"),
            "run_type": batch.get("batch_type"),
            "status": batch.get("status"),
            "created_at": batch.get("created_at"),
            "completed_at": batch.get("completed_at"),
            "question_count": batch.get("question_count"),
            "metadata": metadata,
        }

    @staticmethod
    def _with_dominant_share_warning(stats: dict) -> dict:
        """Annotate an agreement_stats dict with a class-imbalance warning flag.

        A low kappa on a heavily skewed decision distribution (e.g. ~90%
        accept) is expected and does not mean the AI judge disagrees with
        humans. The flag lets the Analysis tab surface that caveat next to the
        kappa value instead of presenting a misleadingly poor number.
        """
        share = stats.get("dominant_share")
        stats = dict(stats)
        stats["dominant_share_warning"] = (
            isinstance(share, (int, float)) and share > DOMINANT_SHARE_WARN_THRESHOLD
        )
        return stats

    def research_summary(self, batch_id: str) -> dict:
        batch, traces = self._batch_with_traces(batch_id)
        style_counts: Counter = Counter()
        target_section_counts: Counter = Counter()
        question_source_counts: Counter = Counter()
        completed_reviews = 0
        cases_with_missing_reviews = 0
        matches = 0
        comparable_cases = 0
        false_accepts = 0
        human_disagreement_cases = 0
        prioritized_cases: list[dict] = []
        failure_modes: Counter = Counter()
        # Reviewers never assign 1-5 criterion scores directly: the reviewer UI
        # folds checklist choices into scored criteria only when a signal
        # fires, so untouched criteria are absent. We therefore report AI
        # averages against human *signal counts*, never a human "average score":
        # an absent criterion means that no problem signal was recorded.
        ai_vs_individual_pairs: list[tuple[str, str]] = []
        ai_vs_majority_pairs: list[tuple[str, str]] = []
        reviewer_decision_counts: dict[str, Counter] = {}
        style_agreement: dict[str, dict[str, int]] = {}

        reviewer_plan = batch.get("metadata", {}).get("reviewer_plan") if isinstance(batch.get("metadata"), dict) else None
        excluded = excluded_reviewer_ids(reviewer_plan)
        required_reviews = 0
        reviews_per_case = 1
        if isinstance(reviewer_plan, dict):
            reviews_per_case = max(1, int(reviewer_plan.get("reviews_per_question") or 1))

        for trace in traces:
            question = trace_question(trace)
            reviews = trace_human_reviews(trace, excluded)
            ai_decision = trace_ai_decision(trace)
            human_decision = trace_majority_human_decision(trace, excluded)
            style_label = question.get("style_label") or "unknown"
            style_counts.update([style_label])
            target_section_counts.update([question.get("target_section") or "unknown"])
            question_source_counts.update([question.get("edge_case_label") or "unknown"])
            completed_reviews += len(reviews)
            required_reviews += reviews_per_case
            if len(reviews) < reviews_per_case:
                cases_with_missing_reviews += 1
            for review in reviews:
                human_review_decision = review.get("final_decision")
                if human_review_decision in JUDGE_FINAL_DECISIONS:
                    ai_vs_individual_pairs.append((ai_decision, str(human_review_decision)))
                    reviewer_id = str(review.get("reviewer_id") or "unknown")
                    reviewer_decision_counts.setdefault(reviewer_id, Counter())
                    reviewer_decision_counts[reviewer_id].update([str(human_review_decision)])
            style_bucket = style_agreement.setdefault(style_label, {"comparable_cases": 0, "matches": 0})
            if human_decision != "pending":
                comparable_cases += 1
                ai_vs_majority_pairs.append((ai_decision, human_decision))
                style_bucket["comparable_cases"] += 1
                if human_decision == ai_decision:
                    matches += 1
                    style_bucket["matches"] += 1
                if ai_decision == "accept" and human_decision != "accept":
                    false_accepts += 1
                    failure_modes.update(["AI false accept"])
            if trace_has_human_disagreement(trace, excluded):
                human_disagreement_cases += 1
                failure_modes.update(["Human-human disagreement"])
            if trace_has_ai_human_mismatch(trace, excluded):
                failure_modes.update(["AI-human mismatch"])
            automated = trace_automated(trace)
            unsupported = automated.get("unsupported_claims")
            if isinstance(unsupported, list) and unsupported:
                failure_modes.update(["Unsupported claims"])
            if (
                trace_has_ai_human_mismatch(trace, excluded)
                or trace_has_human_disagreement(trace, excluded)
                or (ai_decision == "accept" and human_decision not in {"accept", "pending"})
            ):
                prioritized_cases.append(
                    {
                        "trace_id": trace.get("trace_id"),
                        "question": question.get("question_text") or "",
                        "service": trace_service_title(trace),
                        "ai_decision": ai_decision,
                        "human_decision": human_decision,
                        "reason": "human disagreement" if trace_has_human_disagreement(trace, excluded) else "AI-human mismatch",
                    }
                )

        criterion_rows = []
        for key in CANONICAL_EVALUATION_CRITERIA:
            ai_scores = [
                score
                for score in (criterion_score(trace_automated(trace), key) for trace in traces)
                if score is not None
            ]
            # Human side: count optional problem signals, not an average. The
            # current reviewer UI does not collect matching positive signals;
            # an untouched criterion is simply absent. Absence therefore means
            # "no problem reported", not approval.
            human_problem_signals = 0
            for trace in traces:
                for review in trace_human_reviews(trace, excluded):
                    criteria = review.get("criteria")
                    if not isinstance(criteria, dict) or not isinstance(criteria.get(key), int):
                        continue
                    score = int(criteria[key])
                    if score <= 2:
                        human_problem_signals += 1
            criterion_rows.append(
                {
                    "criterion": key,
                    "ai_average": average(ai_scores),
                    "human_problem_signals": human_problem_signals,
                    "reviews_total": completed_reviews,
                }
            )

        match_rate = round(matches / comparable_cases, 3) if comparable_cases else 0.0
        agreement_metrics_summary = {
            "ai_vs_individual_reviews": self._with_dominant_share_warning(
                agreement_stats(ai_vs_individual_pairs)
            ),
            "ai_vs_majority_human": self._with_dominant_share_warning(
                agreement_stats(ai_vs_majority_pairs)
            ),
        }
        reviewer_breakdown = [
            {
                "reviewer_id": reviewer_id,
                "total": sum(counts.values()),
                "decisions": distribution_from_counter(counts),
            }
            for reviewer_id, counts in sorted(reviewer_decision_counts.items())
        ]
        agreement_by_style = [
            {
                "style": style_label,
                "comparable_cases": bucket["comparable_cases"],
                "matches": bucket["matches"],
                "match_rate": (
                    round(bucket["matches"] / bucket["comparable_cases"], 3)
                    if bucket["comparable_cases"]
                    else None
                ),
            }
            for style_label, bucket in sorted(style_agreement.items())
        ]
        return {
            "schema_version": "research-summary-v1",
            "batch": self._run_summary_batch(batch),
            "sample_context": {
                "total_cases": len(traces),
                "question_source_distribution": distribution_from_counter(question_source_counts),
                "question_style_distribution": distribution_from_counter(style_counts),
                "target_section_distribution": distribution_from_counter(target_section_counts),
            },
            "review_coverage": {
                "required_reviews": required_reviews,
                "completed_reviews": completed_reviews,
                "cases_with_missing_reviews": cases_with_missing_reviews,
            },
            "ai_human_agreement": {
                "comparable_cases": comparable_cases,
                "matches": matches,
                "match_rate": match_rate,
                "false_accepts": false_accepts,
                "human_human_disagreement_cases": human_disagreement_cases,
            },
            "agreement_stats": agreement_metrics_summary,
            "reviewer_breakdown": reviewer_breakdown,
            "agreement_by_style": agreement_by_style,
            "criterion_comparison": criterion_rows,
            "failure_modes": [
                {"label": label, "count": count}
                for label, count in failure_modes.most_common()
            ],
            "prioritized_cases": prioritized_cases,
            "export_links": [
                {
                    "rel": "research_cases_csv",
                    "href": f"/api/v1/runs/{batch_id}/exports/research-cases.csv",
                },
                {
                    "rel": "research_reviews_csv",
                    "href": f"/api/v1/runs/{batch_id}/exports/research-reviews.csv",
                },
            ],
        }

    def _management_assumptions(self, query: dict[str, list[str]] | None = None) -> dict:
        query = query or {}

        def number(name: str, default: int) -> int:
            raw = query.get(name, [default])[0]
            try:
                return max(0, int(raw))
            except (TypeError, ValueError):
                return default

        return {
            "reviews_per_case": max(1, number("reviews_per_case", 2)),
            "minutes_per_review": max(1, number("minutes_per_review", 5)),
            "available_reviewers": max(1, number("available_reviewers", 2)),
            "reviewer_minutes_per_day": max(1, number("reviewer_minutes_per_day", 60)),
            "hourly_rate_eur": number("hourly_rate_eur", 50),
            "minimum_reviewed_cases": max(1, number("minimum_reviewed_cases", 10)),
        }

    def _review_effort(self, cases: int, assumptions: dict) -> dict:
        assignments = cases * assumptions["reviews_per_case"]
        total_minutes = assignments * assumptions["minutes_per_review"]
        person_hours = round(total_minutes / 60, 1)
        daily_capacity = assumptions["available_reviewers"] * assumptions["reviewer_minutes_per_day"]
        return {
            "cases": cases,
            "assignments": assignments,
            "person_hours": person_hours,
            "cost_eur": round(person_hours * assumptions["hourly_rate_eur"]),
            "calendar_days": (total_minutes + daily_capacity - 1) // daily_capacity if total_minutes else 0,
            "reviewers_needed_for_one_day": (
                (total_minutes + assumptions["reviewer_minutes_per_day"] - 1)
                // assumptions["reviewer_minutes_per_day"]
                if total_minutes
                else 0
            ),
        }

    def management_summary(self, batch_id: str, query: dict[str, list[str]] | None = None) -> dict:
        batch, traces = self._batch_with_traces(batch_id)
        reviewer_plan = batch.get("metadata", {}).get("reviewer_plan") if isinstance(batch.get("metadata"), dict) else None
        excluded = excluded_reviewer_ids(reviewer_plan)
        assumptions = self._management_assumptions(query)
        total_cases = len(traces)
        reviewed_cases = 0
        accepted_cases = 0
        needs_edit_cases = 0
        rejected_cases = 0
        ai_flagged_risk_cases = 0
        thin_source_context_cases = 0
        human_disagreement_cases = 0
        ai_human_mismatch_cases = 0
        missing_review_assignments = 0
        risk_by_service: Counter = Counter()

        for trace in traces:
            reviews = trace_human_reviews(trace, excluded)
            human_decision = trace_majority_human_decision(trace, excluded)
            ai_decision = trace_ai_decision(trace)
            if ai_decision != "accept":
                ai_flagged_risk_cases += 1
            if len(trace_retrieved_excerpt(trace)) < 80:
                thin_source_context_cases += 1
            if reviews:
                reviewed_cases += 1
            if human_decision == "accept":
                accepted_cases += 1
            if human_decision == "needs_edit":
                needs_edit_cases += 1
            if human_decision == "reject":
                rejected_cases += 1
            if trace_has_human_disagreement(trace, excluded):
                human_disagreement_cases += 1
            if trace_has_ai_human_mismatch(trace, excluded):
                ai_human_mismatch_cases += 1
            missing_review_assignments += max(0, assumptions["reviews_per_case"] - len(reviews))
            if human_decision in {"needs_edit", "reject"} or trace_has_ai_human_mismatch(trace, excluded):
                risk_by_service.update([trace_service_title(trace)])

        minimum_reviewed_cases = min(total_cases, assumptions["minimum_reviewed_cases"])
        unresolved_actions = needs_edit_cases + rejected_cases + human_disagreement_cases + ai_human_mismatch_cases
        if reviewed_cases == 0:
            readiness_status = "No human review yet"
        elif reviewed_cases < minimum_reviewed_cases:
            readiness_status = "Insufficient evidence"
        elif human_disagreement_cases:
            readiness_status = "Needs adjudication"
        elif unresolved_actions:
            readiness_status = "Needs follow-up"
        else:
            readiness_status = "Ready for monitored pilot"

        return {
            "schema_version": "management-summary-v1",
            "batch": self._run_summary_batch(batch),
            "assumptions": assumptions,
            "before_human_review": {
                "total_cases": total_cases,
                "ai_flagged_risk_cases": ai_flagged_risk_cases,
                "ai_accepted_all_cases": max(0, total_cases - ai_flagged_risk_cases),
                "thin_source_context_cases": thin_source_context_cases,
                "review_effort_estimate": self._review_effort(total_cases, assumptions),
            },
            "after_human_review": {
                "total_cases": total_cases,
                "reviewed_cases": reviewed_cases,
                "pending_cases": max(0, total_cases - reviewed_cases),
                "review_coverage_percent": round((reviewed_cases / total_cases) * 100) if total_cases else 0,
                "accepted_cases": accepted_cases,
                "needs_edit_cases": needs_edit_cases,
                "rejected_cases": rejected_cases,
                "human_disagreement_cases": human_disagreement_cases,
                "ai_human_mismatch_cases": ai_human_mismatch_cases,
                "missing_review_assignments": missing_review_assignments,
                "readiness_status": readiness_status,
                "remaining_review_estimate": self._review_effort(missing_review_assignments, {**assumptions, "reviews_per_case": 1}),
                "action_backlog": [
                    {"id": "complete_missing_reviews", "label": "Complete missing reviews", "count": missing_review_assignments},
                    {"id": "resolve_human_disagreement", "label": "Resolve human disagreement", "count": human_disagreement_cases},
                    {"id": "inspect_ai_human_mismatch", "label": "Inspect AI-human mismatches", "count": ai_human_mismatch_cases},
                    {"id": "fix_needs_edit_answers", "label": "Fix needs-edit/rejected answers", "count": needs_edit_cases + rejected_cases},
                ],
                "risk_by_service": [
                    {"label": label, "risk_cases": count}
                    for label, count in risk_by_service.most_common()
                ],
            },
            "pilot_checklist": [
                {"id": "human_review_collected", "label": "Human review collected", "passed": reviewed_cases > 0},
                {"id": "minimum_coverage", "label": "Minimum reviewed cases reached", "passed": reviewed_cases >= minimum_reviewed_cases},
                {"id": "adjudication_clear", "label": "Human disagreement resolved", "passed": human_disagreement_cases == 0},
                {"id": "follow_up_clear", "label": "Follow-up cases cleared", "passed": unresolved_actions == 0},
            ],
            "export_links": [
                {
                    "rel": "audit_evidence_json",
                    "href": f"/api/v1/runs/{batch_id}/exports/audit-evidence.json",
                }
            ],
        }

    def audit_evidence(self, batch_id: str) -> dict:
        batch, traces = self._batch_with_traces(batch_id)
        reviewer_plan = batch.get("metadata", {}).get("reviewer_plan") if isinstance(batch.get("metadata"), dict) else None
        excluded = excluded_reviewer_ids(reviewer_plan)
        rows = []
        case_details = []
        with_source_reference = 0
        with_source_document = 0
        with_source_url = 0
        with_retrieved_excerpt = 0
        with_model_prompt_metadata = 0
        with_human_review = 0
        with_missing_evidence = 0
        with_generated_answer = 0
        with_ai_judge_result = 0
        with_human_human_mismatch = 0

        for trace in traces:
            question = trace_question(trace)
            # Filtered set drives aggregate counts/decisions; the full annotated
            # set is shown in case_details so the audit trail stays visible.
            reviews = trace_human_reviews(trace, excluded)
            all_reviews = [
                {**review, "excluded": str(review.get("reviewer_id") or "") in excluded}
                for review in trace_human_reviews(trace)
            ]
            automated = trace_automated(trace)
            source_kind, source_reference = trace_source_reference(trace)
            source_url = source_reference if source_kind == "url" else ""
            retrieved_excerpt = trace_retrieved_excerpt(trace)
            answer_text = trace_answer_text(trace)
            ai_decision = trace_ai_decision(trace)
            human_decision = trace_majority_human_decision(trace, excluded)
            metadata_present = bool(
                trace.get("generated_answer", {}).get("model_name")
                or trace.get("generated_answer", {}).get("answer_prompt_version")
                or automated.get("judge_model_name")
                or automated.get("judge_prompt_version")
            )
            missing_keys = []
            if source_kind == "none":
                missing_keys.append("source_reference")
            if not retrieved_excerpt:
                missing_keys.append("retrieved_excerpt")
            if not answer_text:
                missing_keys.append("generated_answer")
            if not automated:
                missing_keys.append("ai_judge_result")
            if not metadata_present:
                missing_keys.append("model_prompt_metadata")
            if source_kind != "none":
                with_source_reference += 1
            if source_kind == "document":
                with_source_document += 1
            if source_kind == "url":
                with_source_url += 1
            if retrieved_excerpt:
                with_retrieved_excerpt += 1
            if metadata_present:
                with_model_prompt_metadata += 1
            if reviews:
                with_human_review += 1
            if answer_text:
                with_generated_answer += 1
            if automated:
                with_ai_judge_result += 1
            if missing_keys:
                with_missing_evidence += 1
            if trace_has_human_disagreement(trace, excluded):
                with_human_human_mismatch += 1
            unsupported_claims = automated.get("unsupported_claims") if isinstance(automated.get("unsupported_claims"), list) else []
            row = {
                "trace_id": trace.get("trace_id"),
                "question_id": question.get("question_id") or "-",
                "service_id": trace_service_id(trace),
                "service_title": trace_service_title(trace),
                "source_reference": source_reference or "-",
                "source_reference_kind": source_kind,
                "source_url": source_url or "-",
                "ai_decision": ai_decision,
                "human_decision": human_decision,
                "source_support": "; ".join(
                    str(review.get("label"))
                    for review in reviews
                    if review.get("label")
                ) or "pending",
                "human_human_mismatch": "yes" if trace_has_human_disagreement(trace, excluded) else "no",
                "unsupported_claims": len(unsupported_claims),
                "missing_evidence": "; ".join(missing_keys) or "complete",
                "missing_evidence_keys": missing_keys,
            }
            rows.append(row)
            case_details.append(
                {
                    **row,
                    "question": question.get("question_text") or "-",
                    "generated_answer": answer_text or "-",
                    "retrieved_excerpt": retrieved_excerpt or "-",
                    "unsupported_claims_list": unsupported_claims,
                    "human_reviews": all_reviews,
                    "timestamps": {
                        "trace_created": trace.get("created_at") or "-",
                        "ai_judge": automated.get("evaluated_at") or automated.get("created_at") or "-",
                        "latest_human_review": all_reviews[-1].get("submitted_at") if all_reviews else "-",
                    },
                    "prompt_model_versions": {
                        "answer_model": trace.get("generated_answer", {}).get("model_name") or "-",
                        "answer_prompt_version": trace.get("generated_answer", {}).get("answer_prompt_version") or "-",
                        "judge_model": automated.get("judge_model_name") or "-",
                        "judge_prompt_version": automated.get("judge_prompt_version") or "-",
                    },
                }
            )

        return {
            # v2 replaced the URL-only "source_url" evidence key with the typed
            # "source_reference" (url | document | none) so imported documents
            # count as valid source evidence, and added the
            # source_reference/source_reference_kind columns.
            "schema_version": "audit-evidence-v2",
            "batch": self._run_summary_batch(batch),
            "completeness": {
                "total_traces": len(traces),
                "with_source_reference": with_source_reference,
                "with_source_document": with_source_document,
                "with_source_url": with_source_url,
                "with_retrieved_excerpt": with_retrieved_excerpt,
                "with_generated_answer": with_generated_answer,
                "with_ai_judge_result": with_ai_judge_result,
                "with_model_prompt_metadata": with_model_prompt_metadata,
                "with_human_review": with_human_review,
                "with_human_human_mismatch": with_human_human_mismatch,
                "with_missing_evidence": with_missing_evidence,
            },
            "run_metadata": [
                ["Batch ID", batch.get("batch_id") or "-"],
                ["Run type", batch.get("batch_type") or "-"],
                ["Status", batch.get("status") or "-"],
                ["Created", batch.get("created_at") or "-"],
                ["Completed", batch.get("completed_at") or "-"],
            ],
            "traceability_rows": rows,
            "case_details": case_details,
            "export_links": [
                {
                    "rel": "audit_evidence_json",
                    "href": f"/api/v1/runs/{batch_id}/exports/audit-evidence.json",
                },
                {
                    "rel": "audit_evidence_csv",
                    "href": f"/api/v1/runs/{batch_id}/exports/audit-evidence.csv",
                },
            ],
        }

    def research_case_export_csv(self, batch_id: str) -> str:
        batch, traces = self._batch_with_traces(batch_id)
        reviewer_plan = batch.get("metadata", {}).get("reviewer_plan") if isinstance(batch.get("metadata"), dict) else None
        excluded = excluded_reviewer_ids(reviewer_plan)
        rows = []
        for trace in traces:
            question = trace_question(trace)
            rows.append(
                {
                    "trace_id": trace.get("trace_id"),
                    "question_id": question.get("question_id") or "",
                    "service": trace_service_title(trace),
                    "question_style": question.get("style_label") or "",
                    "target_section": question.get("target_section") or "",
                    "ai_decision": trace_ai_decision(trace),
                    "human_decision": trace_majority_human_decision(trace, excluded),
                    "human_review_count": len(trace_human_reviews(trace, excluded)),
                    "ai_human_mismatch": "yes" if trace_has_ai_human_mismatch(trace, excluded) else "no",
                }
            )
        return csv_text(
            rows,
            [
                "trace_id",
                "question_id",
                "service",
                "question_style",
                "target_section",
                "ai_decision",
                "human_decision",
                "human_review_count",
                "ai_human_mismatch",
            ],
        )

    def research_review_export_csv(self, batch_id: str) -> str:
        batch, traces = self._batch_with_traces(batch_id)
        reviewer_plan = batch.get("metadata", {}).get("reviewer_plan") if isinstance(batch.get("metadata"), dict) else None
        excluded = excluded_reviewer_ids(reviewer_plan)
        rows = []
        for trace in traces:
            # Raw export keeps every review; the excluded column flags which
            # reviewers were removed from the primary analysis.
            for review in trace_human_reviews(trace):
                duration = review.get("duration_seconds")
                reviewer_id = review.get("reviewer_id") or review.get("reviewer_role") or ""
                rows.append(
                    {
                        "trace_id": trace.get("trace_id"),
                        "reviewer_id": reviewer_id,
                        "final_decision": review.get("final_decision") or "",
                        "source_support": review.get("label") or "",
                        "human_score": review.get("human_score") or "",
                        "duration_seconds": "" if duration is None else duration,
                        "submitted_at": review.get("submitted_at") or "",
                        "comment_text": review.get("comment_text") or "",
                        "excluded": "yes" if str(reviewer_id) in excluded else "no",
                    }
                )
        return csv_text(
            rows,
            ["trace_id", "reviewer_id", "final_decision", "source_support", "human_score", "duration_seconds", "submitted_at", "comment_text", "excluded"],
        )

    def audit_evidence_export_csv(self, batch_id: str) -> str:
        evidence = self.audit_evidence(batch_id)
        rows = evidence["traceability_rows"]
        return csv_text(
            rows,
            [
                "trace_id",
                "question_id",
                "service_id",
                "service_title",
                "source_reference",
                "source_reference_kind",
                "source_url",
                "ai_decision",
                "human_decision",
                "source_support",
                "human_human_mismatch",
                "unsupported_claims",
                "missing_evidence",
            ],
        )

    def study_package_export(self, batch_id: str) -> dict:
        batch, traces = self._batch_with_traces(batch_id)
        metadata = json.loads(json.dumps(batch.get("metadata") or {}, ensure_ascii=False))
        reviewer_plan = metadata.get("reviewer_plan")
        excluded = excluded_reviewer_ids(reviewer_plan)
        if isinstance(reviewer_plan, dict):
            for participant in reviewer_plan.get("participants", []):
                if isinstance(participant, dict):
                    participant.pop("token", None)
                    participant.pop("review_url", None)

        runs = [
            run
            for run in self.evaluation_store.list_runs()
            if run.get("batch_id") == batch_id
        ]
        cases = []
        human_reviews = []
        for trace in traces:
            question = trace_question(trace)
            service = trace.get("service_entry") or {}
            retrieval = trace.get("retrieval_result") or {}
            generated_answer = trace.get("generated_answer") or {}
            automated_evaluation = trace.get("automated_evaluation") or {}
            reviews = trace_human_reviews(trace)
            cases.append(
                {
                    "trace_id": trace.get("trace_id"),
                    "question_id": question.get("question_id") or "",
                    "service_id": service.get("service_id") or question.get("service_id") or "",
                    "service_title": trace_service_title(trace),
                    "source_url": service.get("source_url") or retrieval.get("source_ref") or "",
                    "question_text": question.get("question_text") or "",
                    "question_style": question.get("style_label") or "",
                    "target_section": question.get("target_section") or retrieval.get("section_name") or "",
                    "created_at": trace.get("created_at") or "",
                    "variant": trace.get("variant") or "",
                    "generated_answer": generated_answer,
                    "retrieval_result": retrieval,
                    "automated_evaluation": automated_evaluation,
                    "judge_evaluations": trace.get("judge_evaluations") or [],
                    "human_review_count": len(reviews),
                }
            )
            for review in reviews:
                human_reviews.append(
                    {
                        "trace_id": trace.get("trace_id"),
                        "review_id": review.get("review_id") or "",
                        "reviewer_id": review.get("reviewer_id") or "",
                        "reviewer_role": review.get("reviewer_role") or "",
                        "is_adjudication": bool(review.get("is_adjudication")),
                        "adjudication_status": review.get("adjudication_status") or "",
                        "final_decision": review.get("final_decision") or "",
                        "source_support": review.get("label") or "",
                        "human_score": review.get("human_score") or "",
                        "criteria": review.get("criteria") or {},
                        "reviewer_confidence": review.get("reviewer_confidence") or "",
                        "comment_text": review.get("comment_text") or "",
                        "suggested_correction": review.get("suggested_correction") or "",
                        "reviewer_profile": review.get("reviewer_profile") or {},
                        "duration_seconds": review.get("duration_seconds"),
                        "submitted_at": review.get("submitted_at") or "",
                        "excluded": str(review.get("reviewer_id") or "") in excluded,
                    }
                )

        return {
            "schema_version": "study-package-v1",
            "exported_at": now_iso(),
            "manifest": {
                "batch_id": batch.get("batch_id"),
                "batch_type": batch.get("batch_type"),
                "status": batch.get("status"),
                "created_at": batch.get("created_at"),
                "completed_at": batch.get("completed_at"),
                "case_count": len(cases),
                "human_review_count": len(human_reviews),
                "run_record_count": len(runs),
                "privacy_note": (
                    "Reviewer capability links and participant tokens are excluded. "
                    "Reviewer IDs are study pseudonyms such as P01."
                ),
            },
            "batch": {
                "batch_id": batch.get("batch_id"),
                "batch_type": batch.get("batch_type"),
                "status": batch.get("status"),
                "question_count": batch.get("question_count"),
                "created_at": batch.get("created_at"),
                "completed_at": batch.get("completed_at"),
                "metadata": metadata,
            },
            "reviewer_plan": reviewer_plan if isinstance(reviewer_plan, dict) else None,
            "runs": runs,
            "cases": cases,
            "human_reviews": human_reviews,
        }

    def developer_prompts(self) -> dict:
        prompts = self.evaluation_store.list_prompt_versions()
        latest_by_type: dict[str, dict] = {}
        for prompt in prompts:
            prompt_type = str(prompt.get("prompt_type", ""))
            if prompt_type in {"answer", "judge"}:
                latest_by_type[prompt_type] = prompt

        latest_answer = latest_by_type.get("answer") or {}
        latest_judge = latest_by_type.get("judge") or {}
        configured_openai_model = default_openai_model()
        saved_answer_model = str(latest_answer.get("model_name") or "").strip()
        saved_judge_model = str(latest_judge.get("model_name") or "").strip()
        default_model_name = (
            saved_answer_model
            if saved_answer_model and (os.environ.get("OPENAI_API_KEY") or not is_openai_model(saved_answer_model))
            else (
                default_openai_model()
                if os.environ.get("OPENAI_API_KEY")
                else "no_llm_baseline"
            )
        )
        default_judge_model_name = saved_judge_model if saved_judge_model.startswith("gpt-") else configured_openai_model
        default_judge_mode = "openai_judge_v1" if os.environ.get("OPENAI_API_KEY") else "rule_based_baseline"
        return {
            "items": prompts,
            "defaults": {
                "answer_prompt_version": latest_answer.get("prompt_version") or "api_baseline_v0",
                "answer_prompt_text": latest_answer.get("prompt_text") or DEFAULT_ANSWER_PROMPT,
                "judge_prompt_version": latest_judge.get("prompt_version") or "rule_judge_v0",
                "judge_prompt_text": latest_judge.get("prompt_text") or DEFAULT_JUDGE_PROMPT,
                "model_name": default_model_name,
                "judge_mode": default_judge_mode,
                "judge_model_name": default_judge_model_name,
            },
        }

    def save_prompt_version(self, payload: dict) -> dict:
        prompt_type = str(payload.get("prompt_type", "")).strip()
        prompt_version = str(payload.get("prompt_version", "")).strip()
        prompt_text = str(payload.get("prompt_text", "")).strip()
        model_name = str(payload.get("model_name", "")).strip()
        notes = str(payload.get("notes", "")).strip()
        if prompt_type not in {"answer", "judge"}:
            raise ValueError("prompt_type must be 'answer' or 'judge'")
        if not prompt_version:
            raise ValueError("prompt_version is required")
        if not prompt_text:
            raise ValueError("prompt_text is required")
        self.evaluation_store.save_prompt_version(
            prompt_type=prompt_type,
            prompt_version=prompt_version,
            prompt_text=prompt_text,
            model_name=model_name,
            notes=notes,
        )
        return self.developer_prompts()

    def _diverse_questions(self, limit: int) -> list[dict]:
        groups: dict[tuple[str, str], list[dict]] = {}
        for question in self.questions:
            key = (
                str(question.get("style_label", "")),
                str(question.get("target_section", "")),
            )
            groups.setdefault(key, []).append(question)
        selected: list[dict] = []
        seen_ids: set[str] = set()
        while len(selected) < limit:
            added = False
            for key in sorted(groups):
                group = groups[key]
                if not group:
                    continue
                question = group.pop(0)
                question_id = str(question.get("question_id", ""))
                if question_id in seen_ids:
                    continue
                selected.append(question)
                seen_ids.add(question_id)
                added = True
                if len(selected) >= limit:
                    break
            if not added:
                break
        if len(selected) < limit:
            for question in self.questions:
                question_id = str(question.get("question_id", ""))
                if question_id in seen_ids:
                    continue
                selected.append(question)
                seen_ids.add(question_id)
                if len(selected) >= limit:
                    break
        return selected

    def _run_needs_background_processing(self, *, model_name: str, judge_mode: str) -> bool:
        return is_openai_model(model_name) or judge_mode == "openai_judge_v1"

    def _require_openai_key_for_run(self, *, model_name: str, judge_mode: str) -> None:
        if not (is_openai_model(model_name) or judge_mode == "openai_judge_v1"):
            return
        if os.environ.get("OPENAI_API_KEY"):
            return
        raise ValueError(
            "OPENAI_API_KEY is not configured. Add it to the repository-root .env "
            "and restart the backend, or select the offline answer and judge baselines."
        )

    def _start_background_trace_batch(
        self,
        *,
        batch_id: str,
        payloads: list[dict],
        mode: str,
    ) -> None:
        worker = threading.Thread(
            target=self._process_background_trace_batch,
            kwargs={"batch_id": batch_id, "payloads": payloads, "mode": mode},
            daemon=True,
        )
        worker.start()

    def _process_background_trace_batch(
        self,
        *,
        batch_id: str,
        payloads: list[dict],
        mode: str,
    ) -> None:
        failures: list[dict[str, str]] = []
        with ThreadPoolExecutor(max_workers=DEVELOPER_RUN_MAX_WORKERS) as executor:
            futures = {
                executor.submit(trace_from_payload, self, payload, mode=mode): payload
                for payload in payloads
            }
            for future in as_completed(futures):
                payload = futures[future]
                try:
                    trace = future.result()
                    review = payload.get("_human_review")
                    if isinstance(review, dict):
                        self._apply_imported_human_review(trace, review)
                except Exception as exc:  # pragma: no cover - defensive status reporting
                    failures.append(
                        {
                            "question_id": str(payload.get("question_id") or payload.get("external_question_id") or ""),
                            "error": str(exc),
                        }
                    )

        batch = self.evaluation_store.get_batch(batch_id) or {}
        metadata = dict(batch.get("metadata") or {})
        metadata["completed_cases"] = max(0, len(payloads) - len(failures))
        metadata["failed_cases"] = len(failures)
        if failures:
            metadata["case_errors"] = failures[:10]
        if len(failures) == len(payloads):
            status = "failed"
        elif failures:
            status = "completed_with_errors"
        else:
            status = "completed"
        self.evaluation_store.update_batch_status(batch_id, status=status, metadata=metadata)

    def _create_developer_run(
        self,
        *,
        batch_type: str,
        label: str,
        limit: int,
        settings: dict | None = None,
        diverse: bool = False,
        question_ids: list[str] | None = None,
        randomize: bool = False,
        frozen: bool = False,
    ) -> dict:
        if question_ids or randomize:
            questions, selection_metadata = select_questions_for_developer_run(
                self.questions,
                question_ids=question_ids,
                limit=limit,
                randomize=randomize,
            )
        elif diverse:
            questions = self._diverse_questions(limit)
            selection_metadata = {
                "sample_pool": "question_bank",
                "selected_question_ids": [str(question["question_id"]) for question in questions],
                "selection_limit": limit,
                "selection_method": "diverse",
            }
        else:
            questions, selection_metadata = select_questions_for_developer_run(
                self.questions,
                limit=limit,
            )
        defaults = self.developer_prompts()["defaults"]
        settings = {
            **defaults,
            **{
                key: value
                for key, value in (settings or {}).items()
                if value not in (None, "")
            },
        }
        answer_prompt_version = str(settings.get("answer_prompt_version") or "api_baseline_v0")
        judge_prompt_version = str(settings.get("judge_prompt_version") or "rule_judge_v0")
        judge_schema_version = str(settings.get("judge_schema_version") or JUDGE_SCHEMA_VERSION)
        model_name = str(settings.get("model_name") or "no_llm_baseline")
        judge_model_name = str(settings.get("judge_model_name") or default_openai_model())
        answer_prompt_text = str(settings.get("answer_prompt_text") or "")
        judge_prompt_text = str(settings.get("judge_prompt_text") or "")
        judge_mode = str(settings.get("judge_mode") or "openai_judge_v1")
        judge_question_label = str(settings.get("judge_question_label") or "")
        judge_context_label = str(settings.get("judge_context_label") or "")
        self._require_openai_key_for_run(model_name=model_name, judge_mode=judge_mode)
        run_in_background = self._run_needs_background_processing(
            model_name=model_name,
            judge_mode=judge_mode,
        )
        metadata = {
            "label": label,
            "answer_prompt_version": answer_prompt_version,
            "judge_prompt_version": judge_prompt_version,
            "model_name": model_name,
            "judge_model_name": judge_model_name,
            "judge_schema_version": judge_schema_version,
            "generation_mode": "openai_answer_v1" if is_openai_model(model_name) else "deterministic_source_excerpt",
            "judge_mode": judge_mode,
            "judge_question_label": judge_question_label,
            "judge_context_label": judge_context_label,
            "processing_mode": "background" if run_in_background else "synchronous",
            "max_parallel_cases": DEVELOPER_RUN_MAX_WORKERS if run_in_background else 1,
            "question_bank_size": len(self.questions),
            "selected_question_count": len(questions),
            "selected_questions": selected_question_composition(questions),
            **selection_metadata,
        }
        batch_id = self.evaluation_store.create_batch(
            batch_type=batch_type,
            question_count=len(questions),
            status="running" if run_in_background else "completed",
            metadata=metadata,
        )
        # Frozen study runs tag every trace with a batch-specific variant so the
        # answer and judge result stay reproducible across multiple reviewers.
        trace_variant = f"study_run_{batch_id}" if frozen else batch_type
        payloads = [
            {
                "question_id": question["question_id"],
                "variant": trace_variant,
                "run_type": batch_type,
                "batch_id": batch_id,
                "answer_prompt_version": answer_prompt_version,
                "answer_prompt_text": answer_prompt_text,
                "judge_prompt_version": judge_prompt_version,
                "judge_schema_version": judge_schema_version,
                "judge_prompt_text": judge_prompt_text,
                "judge_mode": judge_mode,
                "judge_question_label": judge_question_label,
                "judge_context_label": judge_context_label,
                "model_name": model_name,
                "judge_model_name": judge_model_name,
            }
            for question in questions
        ]
        if run_in_background:
            # Freeze before generation starts: the background completion only
            # rewrites metadata at the very end and reads it back via get_batch,
            # so the frozen flag set here is preserved without a write race.
            if frozen:
                self.evaluation_store.freeze_batch(batch_id)
            self._start_background_trace_batch(batch_id=batch_id, payloads=payloads, mode="generate")
            return self.developer_worklist(batch_id=batch_id)

        for payload in payloads:
            trace_from_payload(
                self,
                payload,
                mode="generate",
            )
        if frozen:
            self.evaluation_store.freeze_batch(batch_id)
        return self.developer_worklist(batch_id=batch_id)

    def create_developer_test_run(self, limit: int = 5, settings: dict | None = None) -> dict:
        return self._create_developer_run(
            batch_type="test_run",
            label=f"Run {limit}-question test",
            limit=limit,
            settings=settings,
        )

    def create_developer_demo_run(
        self,
        settings: dict | None = None,
        question_ids: list[str] | None = None,
    ) -> dict:
        manual_selection = bool(question_ids)
        return self._create_developer_run(
            batch_type="demo_run",
            label=(
                "Create run from selected questions"
                if manual_selection
                else "Create random demo run"
            ),
            limit=len(question_ids or []) if manual_selection else 20,
            settings=settings,
            question_ids=question_ids,
            randomize=not manual_selection,
        )

    def create_developer_study_run(
        self,
        limit: int | None = None,
        settings: dict | None = None,
        question_ids: list[str] | None = None,
    ) -> dict:
        manual_selection = bool(question_ids)
        effective_limit = len(question_ids or []) if manual_selection else (
            limit if limit is not None else len(self.questions)
        )
        return self._create_developer_run(
            batch_type="study_run",
            label=f"Create frozen study run ({effective_limit} cases)",
            limit=effective_limit,
            settings=settings,
            question_ids=question_ids,
            randomize=False,
            frozen=True,
        )

    def _is_frozen_trace(self, trace: dict) -> bool:
        """A trace is frozen if its variant is a study-run variant or its batch is frozen."""
        if str(trace.get("variant") or "").startswith("study_run_"):
            return True
        batch_id = self.evaluation_store.get_trace_batch_id(str(trace.get("trace_id") or ""))
        return self.evaluation_store.is_batch_frozen(batch_id)

    def _assert_trace_mutable(self, trace: dict) -> None:
        if self._is_frozen_trace(trace):
            raise FrozenRunError(
                "This case belongs to a frozen study run. Its answer and judge result "
                "are locked so every reviewer evaluates the same case. Human reviews "
                "are still allowed."
            )

    def create_imported_answer_dataset(
        self,
        *,
        filename: str,
        records: list[dict],
    ) -> dict:
        if not records:
            raise ValueError("At least one imported answer record is required.")
        dataset = self.evaluation_store.create_imported_dataset(
            filename=filename or "imported_answers.csv",
            records=records,
            metadata={"import_type": "chatbot_answers"},
        )
        full_dataset = self.imported_answer_dataset(dataset["import_id"])
        if full_dataset is None:
            raise ValueError("Could not load imported dataset.")
        return full_dataset

    def imported_answer_datasets(self, *, include_archived: bool = False) -> dict:
        items = []
        for dataset in self.evaluation_store.list_imported_datasets(include_archived=include_archived):
            full_dataset = self.imported_answer_dataset(dataset["import_id"])
            if full_dataset:
                items.append(full_dataset)
        return {"items": items}

    def imported_answer_dataset(self, import_id: str) -> dict | None:
        dataset = self.evaluation_store.get_imported_dataset(import_id)
        if dataset is None:
            return None
        return {
            **dataset,
            "records": self.evaluation_store.list_imported_dataset_records(import_id),
        }

    def delete_imported_answer_dataset(self, import_id: str) -> dict:
        return self.evaluation_store.delete_or_archive_imported_dataset(import_id)

    def _apply_imported_human_review(self, trace: dict, review: dict) -> None:
        normalized_review = {
            "review_id": review.get("review_id") or f"review_{trace['trace_id']}_imported",
            "trace_id": trace["trace_id"],
            "reviewer_id": review.get("reviewer_id") or "imported_human_label",
            "reviewer_role": review.get("reviewer_role") or "imported_reference",
            "human_score": int(review.get("score") or review.get("human_score") or 3),
            "label": review.get("label") or "not_checked",
            "criteria": review.get("criteria") if isinstance(review.get("criteria"), dict) else {},
            "final_decision": review.get("decision") or review.get("final_decision") or "needs_edit",
            "reviewer_confidence": review.get("reviewer_confidence") or "",
            "comment_text": review.get("comment") or review.get("comment_text") or "",
            "suggested_correction": review.get("suggested_correction") or "",
            "submitted_at": review.get("submitted_at") or now_iso(),
        }
        apply_human_review_to_trace(trace, normalized_review)
        self.update_trace(trace)

    def create_imported_answer_run(
        self,
        *,
        import_id: str | None = None,
        records: list[dict] | None = None,
        settings: dict | None = None,
    ) -> dict:
        dataset = None
        if import_id:
            dataset = self.imported_answer_dataset(import_id)
            if dataset is None:
                raise ValueError(f"Unknown import_id: {import_id}")
            records = dataset["records"]

        if not records:
            raise ValueError("At least one imported answer record is required.")

        prepared_records: list[dict] = []

        def imported_bool(value: object) -> bool:
            if isinstance(value, bool):
                return value
            return str(value or "").strip().lower() in {"1", "true", "yes", "ja"}

        for index, record in enumerate(records, start=1):
            if not isinstance(record, dict):
                raise ValueError(f"Imported record {index} must be an object.")
            question_text = str(record.get("question") or record.get("question_text") or "").strip()
            answer_text = str(record.get("answer") or record.get("answer_text") or "").strip()
            if not question_text or not answer_text:
                raise ValueError(f"Imported record {index} requires question and answer.")
            case_id = str(record.get("case_id") or f"imported_{index:03d}").strip()
            external_system = str(record.get("external_system") or "imported_chatbot").strip()
            prepared_records.append(
                {
                    "answer_text": answer_text,
                    "case_id": case_id,
                    "external_system": external_system,
                    "question_text": question_text,
                    "record": record,
                }
            )

        defaults = self.developer_prompts()["defaults"]
        settings = {
            **defaults,
            **{
                key: value
                for key, value in (settings or {}).items()
                if value not in (None, "")
            },
        }
        judge_prompt_version = str(settings.get("judge_prompt_version") or "rule_judge_v0")
        judge_schema_version = str(settings.get("judge_schema_version") or JUDGE_SCHEMA_VERSION)
        judge_prompt_text = str(settings.get("judge_prompt_text") or "")
        judge_model_name = str(settings.get("judge_model_name") or default_openai_model())
        judge_mode = str(settings.get("judge_mode") or "openai_judge_v1")
        judge_question_label = str(settings.get("judge_question_label") or "")
        judge_context_label = str(settings.get("judge_context_label") or "")
        self._require_openai_key_for_run(model_name="no_llm_baseline", judge_mode=judge_mode)
        run_in_background = judge_mode == "openai_judge_v1"
        external_systems = sorted({
            str(item["external_system"])
            for item in prepared_records
        })
        imported_human_label_count = sum(
            1
            for item in prepared_records
            if isinstance(item["record"].get("human_review"), dict)
        )
        batch_id = self.evaluation_store.create_batch(
            batch_type="external_evaluation_run",
            question_count=len(prepared_records),
            status="running" if run_in_background else "completed",
            metadata={
                "label": (
                    f"Imported chatbot answers · {dataset['filename']}"
                    if isinstance(dataset, dict)
                    else "Imported chatbot answers"
                ),
                "input_source": "imported_chatbot_answers",
                "answer_generation": "skipped",
                "generation_mode": "imported_chatbot_answer",
                "judge_mode": judge_mode,
                "judge_model_name": judge_model_name,
                "judge_prompt_version": judge_prompt_version,
                "judge_schema_version": judge_schema_version,
                "judge_question_label": judge_question_label,
                "judge_context_label": judge_context_label,
                "processing_mode": "background" if run_in_background else "synchronous",
                "max_parallel_cases": DEVELOPER_RUN_MAX_WORKERS if run_in_background else 1,
                "external_systems": external_systems,
                "imported_human_label_count": imported_human_label_count,
                **(
                    {
                        "import_id": dataset["import_id"],
                        "import_filename": dataset["filename"],
                    }
                    if isinstance(dataset, dict)
                    else {}
                ),
            },
        )

        payloads: list[dict] = []
        for prepared in prepared_records:
            record = prepared["record"]
            case_id = prepared["case_id"]
            external_system = prepared["external_system"]
            payload = {
                "answer_text": prepared["answer_text"],
                "batch_id": batch_id,
                "external_question_id": f"imported_{case_id}",
                "generation_mode": "imported_chatbot_answer",
                "judge_mode": judge_mode,
                "judge_model_name": judge_model_name,
                "judge_prompt_text": judge_prompt_text,
                "judge_prompt_version": judge_prompt_version,
                "judge_schema_version": judge_schema_version,
                "judge_question_label": judge_question_label,
                "judge_context_label": judge_context_label,
                "model_name": external_system,
                "question_id": str(record.get("question_id") or record.get("questionId") or ""),
                "question_text": prepared["question_text"],
                "requires_clarification": imported_bool(
                    record.get("requires_clarification", record.get("requiresClarification"))
                ),
                "run_type": "external_evaluation_run",
                "service_id": str(record.get("service_id") or f"external_{case_id}"),
                "service_title": str(record.get("service_title") or external_system or "External chatbot"),
                "source_context": str(record.get("source_context") or ""),
                "source_url": str(record.get("source_url") or ""),
                "target_section": str(record.get("target_section") or "external_context"),
                "variant": "external_evaluation_run",
            }
            review = record.get("human_review")
            if isinstance(review, dict):
                payload["_human_review"] = review
            payloads.append(payload)

        if import_id:
            self.evaluation_store.mark_imported_dataset_used(import_id, batch_id)

        if run_in_background:
            self._start_background_trace_batch(batch_id=batch_id, payloads=payloads, mode="evaluate")
            return self.developer_worklist(batch_id=batch_id)

        for payload in payloads:
            trace = trace_from_payload(self, payload, mode="evaluate")
            review = payload.get("_human_review")
            if isinstance(review, dict):
                self._apply_imported_human_review(trace, review)

        return self.developer_worklist(batch_id=batch_id)

    def _calibration_question(self, case: dict) -> dict:
        question_id = str(case.get("question_id") or "")
        if question_id:
            question = self.questions_by_id.get(question_id)
            if question:
                return question
        target_section = str(case.get("target_section", ""))
        prefer_multi_intent = bool(case.get("prefer_multi_intent"))
        for question in self.questions:
            if prefer_multi_intent and int(question.get("intent_count", 1)) < 2:
                continue
            if target_section and target_section not in question.get("target_sections", [question.get("target_section")]):
                continue
            return question
        for question in self.questions:
            if not target_section or question.get("target_section") == target_section:
                return question
        if not self.questions:
            raise ValueError("no questions available for judge calibration")
        return self.questions[0]

    def create_judge_calibration_run(self, settings: dict | None = None) -> dict:
        defaults = self.developer_prompts()["defaults"]
        settings = {
            **defaults,
            **{
                key: value
                for key, value in (settings or {}).items()
                if value not in (None, "")
            },
        }
        answer_prompt_version = str(settings.get("answer_prompt_version") or "api_baseline_v0")
        judge_prompt_version = str(settings.get("judge_prompt_version") or "rule_judge_v0")
        judge_schema_version = str(settings.get("judge_schema_version") or JUDGE_SCHEMA_VERSION)
        model_name = str(settings.get("model_name") or "no_llm_baseline")
        judge_model_name = str(settings.get("judge_model_name") or default_openai_model())
        judge_prompt_text = str(settings.get("judge_prompt_text") or "")
        judge_mode = str(settings.get("judge_mode") or "openai_judge_v1")
        judge_question_label = str(settings.get("judge_question_label") or "")
        judge_context_label = str(settings.get("judge_context_label") or "")
        self._require_openai_key_for_run(model_name=model_name, judge_mode=judge_mode)
        run_in_background = judge_mode == "openai_judge_v1"
        batch_id = self.evaluation_store.create_batch(
            batch_type=CALIBRATION_BATCH_TYPE,
            question_count=len(JUDGE_CALIBRATION_CASES),
            status="running" if run_in_background else "completed",
            metadata={
                "label": "Test judge calibration",
                "answer_prompt_version": answer_prompt_version,
                "judge_prompt_version": judge_prompt_version,
                "judge_schema_version": judge_schema_version,
                "model_name": model_name,
                "judge_model_name": judge_model_name,
                "generation_mode": "calibration_fault_injection",
                "judge_mode": judge_mode,
                "judge_question_label": judge_question_label,
                "judge_context_label": judge_context_label,
                "processing_mode": "background" if run_in_background else "synchronous",
                "max_parallel_cases": DEVELOPER_RUN_MAX_WORKERS if run_in_background else 1,
                "exclude_from_human_review": True,
                "exclude_from_study_metrics": True,
            },
        )
        payloads = []
        for case in JUDGE_CALIBRATION_CASES:
            question = self._calibration_question(case)
            payloads.append({
                "question_id": question["question_id"],
                "variant": CALIBRATION_BATCH_TYPE,
                "run_type": CALIBRATION_BATCH_TYPE,
                "batch_id": batch_id,
                "answer_prompt_version": answer_prompt_version,
                "judge_prompt_version": judge_prompt_version,
                "judge_schema_version": judge_schema_version,
                "judge_prompt_text": judge_prompt_text,
                "judge_mode": judge_mode,
                "judge_question_label": judge_question_label,
                "judge_context_label": judge_context_label,
                "model_name": model_name,
                "judge_model_name": judge_model_name,
                "generation_mode": "calibration_fault_injection",
                "answer_kind": case["answer_kind"],
                "calibration": {
                    "calibration_id": case["calibration_id"],
                    "expected_final_decision": case["expected_final_decision"],
                    "expected_low_criteria": case["expected_low_criteria"],
                    "expected_criteria_max": case.get("expected_criteria_max", {}),
                    "fault_type": case["fault_type"],
                    "note": case["note"],
                },
            })

        if run_in_background:
            self._start_background_trace_batch(batch_id=batch_id, payloads=payloads, mode="evaluate")
            return self.judge_calibration_run(batch_id=batch_id)

        for payload in payloads:
            trace_from_payload(self, payload, mode="evaluate")

        calibration_run = self.evaluation_store.get_batch(batch_id)
        traces = self.evaluation_store.list_traces(batch_id=batch_id)
        return {
            "calibration_run": calibration_run,
            "count": len(traces),
            "history": self.judge_calibration_history(),
            "items": traces,
            "summary": build_calibration_summary(traces),
        }

    def judge_calibration_history(self, limit: int = 20) -> list[dict]:
        batches = [
            batch
            for batch in self.evaluation_store.list_batches()
            if batch.get("batch_type") == CALIBRATION_BATCH_TYPE
        ]
        history: list[dict] = []
        for batch in reversed(batches):
            traces = self.evaluation_store.list_traces(batch_id=batch["batch_id"])
            history.append({
                **batch,
                "summary": build_calibration_summary(traces),
            })
            if len(history) >= limit:
                break
        return history

    def judge_calibration_run(self, batch_id: str | None = None, limit: int = 20) -> dict:
        history = self.judge_calibration_history(limit=limit)
        if not history:
            return {
                "calibration_run": None,
                "count": 0,
                "history": [],
                "items": [],
                "summary": build_calibration_summary([]),
            }
        selected = None
        if batch_id:
            selected = next((item for item in history if item.get("batch_id") == batch_id), None)
            if selected is None:
                batches = [
                    batch
                    for batch in self.evaluation_store.list_batches()
                    if batch.get("batch_id") == batch_id
                    and batch.get("batch_type") == CALIBRATION_BATCH_TYPE
                ]
                selected = batches[0] if batches else None
        else:
            selected = history[0]
        if selected is None:
            raise ValueError("unknown judge calibration batch")
        traces = self.evaluation_store.list_traces(batch_id=selected["batch_id"])
        return {
            "calibration_run": selected,
            "count": len(traces),
            "history": history,
            "items": traces,
            "summary": build_calibration_summary(traces),
        }

    def _reviewer_plan_with_progress(self, reviewer_plan: dict, traces: list[dict]) -> dict:
        trace_by_id = {trace.get("trace_id"): trace for trace in traces}
        next_plan = json.loads(json.dumps(reviewer_plan, ensure_ascii=False))
        for participant in next_plan.get("participants", []):
            participant_id_value = participant.get("participant_id", "")
            completed = 0
            for trace_id in participant.get("assigned_trace_ids", []):
                trace = trace_by_id.get(trace_id)
                if not trace:
                    continue
                reviews = trace.get("human_reviews")
                if not isinstance(reviews, list):
                    reviews = [trace.get("mock_human_review")] if trace.get("mock_human_review") else []
                if any(
                    review.get("reviewer_id") == participant_id_value
                    for review in reviews
                    if isinstance(review, dict)
                ):
                    completed += 1
            participant["completed_reviews"] = completed
        return next_plan

    def create_reviewer_plan(
        self,
        *,
        reviewer_count: int,
        reviews_per_question: int,
        base_url: str,
        batch_id: str | None = None,
    ) -> dict:
        active_run = (
            self.evaluation_store.get_batch(batch_id)
            if batch_id
            else self.evaluation_store.latest_batch(
                exclude_batch_types=HUMAN_REVIEW_BATCH_EXCLUSIONS,
            )
        )
        if not active_run:
            raise ValueError("create an evaluation run before creating reviewer links")
        metadata = dict(active_run.get("metadata") or {})
        if isinstance(metadata.get("reviewer_plan"), dict):
            raise ValueError("reviewer plan already exists for this run")
        traces = self.evaluation_store.list_traces(batch_id=active_run["batch_id"])
        if int(metadata.get("imported_human_label_count") or 0) > 0 or any(
            trace_has_imported_human_label(trace)
            for trace in traces
        ):
            raise ValueError("this imported run already contains imported human labels")
        plan = build_reviewer_assignment_plan(
            traces=traces,
            reviewer_count=reviewer_count,
            reviews_per_question=reviews_per_question,
            base_url=base_url,
            batch_id=active_run["batch_id"],
        )
        metadata["reviewer_plan"] = plan
        self.evaluation_store.update_batch_metadata(active_run["batch_id"], metadata)
        return plan

    def close_reviewer_plan(self, batch_id: str | None = None) -> dict:
        active_run = (
            self.evaluation_store.get_batch(batch_id)
            if batch_id
            else self.evaluation_store.latest_batch(
                exclude_batch_types=HUMAN_REVIEW_BATCH_EXCLUSIONS,
            )
        )
        if not active_run:
            raise ValueError("no active run")
        metadata = dict(active_run.get("metadata") or {})
        reviewer_plan = metadata.get("reviewer_plan")
        if not isinstance(reviewer_plan, dict):
            raise ValueError("no reviewer plan has been created")

        next_plan = json.loads(json.dumps(reviewer_plan, ensure_ascii=False))
        next_plan["status"] = "closed"
        next_plan["closed_at"] = now_iso()
        metadata["reviewer_plan"] = next_plan
        self.evaluation_store.update_batch_metadata(active_run["batch_id"], metadata)

        traces = self.evaluation_store.list_traces(batch_id=active_run["batch_id"])
        return self._reviewer_plan_with_progress(next_plan, traces)

    def add_reviewer_participant(
        self,
        batch_id: str | None,
        source_participant_id: str,
        new_participant_id: str | None = None,
    ) -> dict:
        active_run = (
            self.evaluation_store.get_batch(batch_id)
            if batch_id
            else self.evaluation_store.latest_batch(
                exclude_batch_types=HUMAN_REVIEW_BATCH_EXCLUSIONS,
            )
        )
        if not active_run:
            raise ValueError("no active run")
        metadata = dict(active_run.get("metadata") or {})
        reviewer_plan = metadata.get("reviewer_plan")
        if not isinstance(reviewer_plan, dict):
            raise ValueError("no reviewer plan has been created")
        if reviewer_plan.get("status", "active") != "active":
            raise ValueError("reviewer plan is closed; cannot add participants")

        participants = reviewer_plan.get("participants", [])
        source = next(
            (
                participant
                for participant in participants
                if participant.get("participant_id") == source_participant_id
            ),
            None,
        )
        if source is None:
            raise ValueError(f"unknown source participant: {source_participant_id}")

        existing_ids = {
            participant.get("participant_id") for participant in participants
        }
        if new_participant_id:
            new_pid = str(new_participant_id).strip()
            if not new_pid:
                raise ValueError("new participant id may not be blank")
            if new_pid in existing_ids:
                raise ValueError(f"participant {new_pid} already exists")
        else:
            index = len(participants)
            new_pid = participant_id(index)
            while new_pid in existing_ids:
                index += 1
                new_pid = participant_id(index)

        # Same ordered set of cases as the source participant (deep copy so the
        # two participants never share the underlying list).
        assigned_trace_ids = json.loads(
            json.dumps(source.get("assigned_trace_ids", []) or [], ensure_ascii=False)
        )

        token = secrets.token_urlsafe(16)
        batch_id_value = reviewer_plan.get("batch_id") or active_run["batch_id"]
        # Rebuild the review URL exactly like build_reviewer_assignment_plan does,
        # deriving the base URL from an existing participant's link.
        source_url = source.get("review_url") or ""
        if source_url:
            parsed = urlparse(source_url)
            base_url = urlunparse((parsed.scheme, parsed.netloc, "/", "", "", ""))
        else:
            base_url = "http://127.0.0.1:5173/"
        review_url = reviewer_url(base_url, new_pid, batch_id_value, token)

        new_participant = {
            "participant_id": new_pid,
            "token": token,
            "assigned_trace_ids": assigned_trace_ids,
            "completed_reviews": 0,
            "review_url": review_url,
        }

        next_plan = json.loads(json.dumps(reviewer_plan, ensure_ascii=False))
        next_plan["participants"].append(new_participant)
        next_plan["reviewer_count"] = int(
            next_plan.get("reviewer_count", len(participants))
        ) + 1
        next_plan["total_assignments"] = int(
            next_plan.get("total_assignments", 0)
        ) + len(assigned_trace_ids)

        assignments_per_reviewer = [
            len(participant.get("assigned_trace_ids", []))
            for participant in next_plan["participants"]
        ]
        min_assignments = min(assignments_per_reviewer)
        max_assignments = max(assignments_per_reviewer)
        batch_size = (
            min_assignments
            if min_assignments == max_assignments
            else f"{min_assignments}-{max_assignments}"
        )
        reviewer_count = next_plan["reviewer_count"]
        total_assignments = next_plan["total_assignments"]
        next_plan["summary"] = (
            f"{reviewer_count} reviewers · {total_assignments} assignments · {batch_size} cases each"
        )
        # case_review_targets is intentionally left untouched.

        metadata["reviewer_plan"] = next_plan
        self.evaluation_store.update_batch_metadata(active_run["batch_id"], metadata)

        traces = self.evaluation_store.list_traces(batch_id=active_run["batch_id"])
        return self._reviewer_plan_with_progress(next_plan, traces)

    def set_reviewer_exclusion(
        self,
        batch_id: str | None,
        participant: str,
        excluded: bool,
        reason: str = "",
        replaced_by: str = "",
    ) -> dict:
        """Toggle a participant's excluded flag in the reviewer plan.

        Stored reviews are never touched: exclusion lives only in the plan
        metadata (per-participant ``excluded``/``excluded_reason``/``replaced_by``
        plus a synchronized ``excluded_reviewers`` list). Aggregates read this
        flag at compute time; the participant's raw reviews stay in the run.
        """
        participant = str(participant or "").strip()
        if not participant:
            raise ValueError("participant is required")
        active_run = (
            self.evaluation_store.get_batch(batch_id)
            if batch_id
            else self.evaluation_store.latest_batch(
                exclude_batch_types=HUMAN_REVIEW_BATCH_EXCLUSIONS,
            )
        )
        if not active_run:
            raise ValueError("no active run")
        metadata = dict(active_run.get("metadata") or {})
        reviewer_plan = metadata.get("reviewer_plan")
        if not isinstance(reviewer_plan, dict):
            raise ValueError("no reviewer plan has been created")

        next_plan = json.loads(json.dumps(reviewer_plan, ensure_ascii=False))
        participants = next_plan.get("participants", [])
        target = next(
            (
                candidate
                for candidate in participants
                if candidate.get("participant_id") == participant
            ),
            None,
        )
        if target is None:
            raise ValueError(f"unknown participant: {participant}")

        if excluded:
            target["excluded"] = True
            target["excluded_reason"] = str(reason or "").strip()
            target["excluded_at"] = now_iso()
            if str(replaced_by or "").strip():
                target["replaced_by"] = str(replaced_by).strip()
        else:
            target.pop("excluded", None)
            target.pop("excluded_reason", None)
            target.pop("excluded_at", None)
            target.pop("replaced_by", None)

        # Keep the convenience list in sync with the per-participant flags.
        next_plan["excluded_reviewers"] = sorted(
            str(candidate.get("participant_id") or "")
            for candidate in participants
            if candidate.get("excluded")
        )

        metadata["reviewer_plan"] = next_plan
        self.evaluation_store.update_batch_metadata(active_run["batch_id"], metadata)

        traces = self.evaluation_store.list_traces(batch_id=active_run["batch_id"])
        return self._reviewer_plan_with_progress(next_plan, traces)

    def reviewer_assignment(
        self,
        participant: str,
        batch_id: str | None = None,
        token: str | None = None,
    ) -> dict:
        active_run = (
            self.evaluation_store.get_batch(batch_id)
            if batch_id
            else self.evaluation_store.latest_batch(
                exclude_batch_types=HUMAN_REVIEW_BATCH_EXCLUSIONS,
            )
        )
        if not active_run:
            raise ValueError("no active run")
        traces = self.evaluation_store.list_traces(batch_id=active_run["batch_id"])
        reviewer_plan = active_run.get("metadata", {}).get("reviewer_plan")
        if not isinstance(reviewer_plan, dict):
            raise ValueError("no reviewer plan has been created")
        if reviewer_plan.get("status", "active") != "active":
            raise ValueError("reviewer links are inactive")
        reviewer_plan = self._reviewer_plan_with_progress(reviewer_plan, traces)
        for participant_plan in reviewer_plan.get("participants", []):
            if participant_plan.get("participant_id") == participant:
                if participant_plan.get("excluded"):
                    raise PermissionError("reviewer link is deactivated")
                if not reviewer_token_matches(participant_plan.get("token", ""), token or ""):
                    raise PermissionError("invalid reviewer token")
                assigned_trace_ids = participant_plan.get("assigned_trace_ids", [])
                trace_by_id = {trace.get("trace_id"): trace for trace in traces}
                participant_view = {
                    key: value for key, value in participant_plan.items() if key != "token"
                }
                return {
                    "active_run": active_run_without_reviewer_tokens(active_run),
                    "participant": participant_view,
                    "profile_fields": reviewer_plan.get("profile_fields", REVIEWER_PROFILE_FIELDS),
                    "traces": [trace_by_id[trace_id] for trace_id in assigned_trace_ids if trace_id in trace_by_id],
                }
        raise ValueError("unknown participant")

    def verify_reviewer_token(
        self,
        *,
        participant: str,
        token: str,
        batch_id: str | None = None,
    ) -> None:
        """Raise PermissionError if the token does not match the participant's plan token."""
        active_run = (
            self.evaluation_store.get_batch(batch_id)
            if batch_id
            else self.evaluation_store.latest_batch(
                exclude_batch_types=HUMAN_REVIEW_BATCH_EXCLUSIONS,
            )
        )
        reviewer_plan = (active_run or {}).get("metadata", {}).get("reviewer_plan")
        if not isinstance(reviewer_plan, dict):
            raise PermissionError("invalid reviewer token")
        for participant_plan in reviewer_plan.get("participants", []):
            if participant_plan.get("participant_id") == participant:
                if participant_plan.get("excluded"):
                    raise PermissionError("reviewer link is deactivated")
                if not reviewer_token_matches(participant_plan.get("token", ""), token):
                    raise PermissionError("invalid reviewer token")
                return
        raise PermissionError("invalid reviewer token")
