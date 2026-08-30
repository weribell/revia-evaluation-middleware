import json
import os
import tempfile
import threading
import time
import unittest
from pathlib import Path
from typing import Optional
from urllib import request as urllib_request
from unittest.mock import patch

from prototype.api_server import (
    JUDGE_CALIBRATION_CASES,
    PrototypeStore,
    apply_human_review_to_trace,
    calibration_answer_text,
    format_retrieved_context_for_judge,
    generate_openai_judge,
    build_server,
    normalize_openai_judge_decision,
    parse_json_object,
    trace_from_payload,
)


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


class ApiSQLiteIntegrationTest(unittest.TestCase):
    def request_json(
        self,
        base_url: str,
        path: str,
        payload: Optional[dict] = None,
        method: str = "GET",
    ) -> dict:
        data = None
        headers = {"Content-Type": "application/json"}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            method = "POST"
        request = urllib_request.Request(f"{base_url}{path}", data=data, headers=headers, method=method)
        with urllib_request.urlopen(request, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))

    def request_text(self, base_url: str, path: str) -> tuple[str, str]:
        request = urllib_request.Request(f"{base_url}{path}", method="GET")
        with urllib_request.urlopen(request, timeout=5) as response:
            return response.headers.get("Content-Type", ""), response.read().decode("utf-8")

    def write_minimal_service_data(self, data_dir: Path, question_count: int = 2) -> None:
        write_jsonl(
            data_dir / "services.jsonl",
            [
                {
                    "service_id": "service_1",
                    "title": "Residence certificate",
                    "url": "https://service.example/residence",
                    "description": "Residence certificate description",
                    "full_text": "Bring passport. Fee is 10 Euro.",
                    "sections": {
                        "required_documents": "You need a passport and the completed application form.",
                        "fees": "The fee is 10 Euro.",
                    },
                }
            ],
        )
        questions = []
        for index in range(question_count):
            target_section = "required_documents" if index % 2 == 0 else "fees"
            question_text = (
                "Which documents do I need?"
                if target_section == "required_documents"
                else "How much does it cost?"
            )
            questions.append(
                {
                    "question_id": f"question_{index + 1}",
                    "service_id": "service_1",
                    "service_title": "Residence certificate",
                    "source_url": "https://service.example/residence",
                    "question_text": question_text,
                    "target_section": target_section,
                    "style_label": "direct_clean",
                    "style_description": "Direct question",
                    "edge_case_label": "controlled_synthetic",
                    "intent_type": "single_intent",
                    "intent_count": 1,
                    "requires_clarification": False,
                    "expected_answer_behavior": "answer_requested_section",
                    "difficulty_label": "standard",
                }
            )
        write_jsonl(data_dir / "citizen_questions.jsonl", questions)

    def wait_for_batch_items(self, store: PrototypeStore, batch_id: str, expected_count: int = 1) -> dict:
        result = store.developer_worklist(batch_id=batch_id)
        for _ in range(50):
            if len(result["items"]) >= expected_count:
                return result
            time.sleep(0.05)
            result = store.developer_worklist(batch_id=batch_id)
        return result

    def test_public_api_v1_exposes_integration_status(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            server = build_server("127.0.0.1", 0, Path(tmpdir))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base_url = f"http://{server.server_address[0]}:{server.server_address[1]}"

            try:
                status = self.request_json(base_url, "/api/v1/integration/status")
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)

        self.assertEqual(status["status"], "ready")
        self.assertEqual(status["api_version"], "v1")
        self.assertEqual(status["public_base_path"], "/api/v1")
        self.assertEqual(status["authentication"]["mode"], "local")
        self.assertFalse(status["authentication"]["api_key_required"])
        self.assertIn("POST /api/v1/evaluations", status["integration_endpoints"])
        self.assertIn("GET /api/v1/metrics/overview", status["integration_endpoints"])
        self.assertIn("POST /developer/imported-answer-run", status["dashboard_internal_endpoints"])
        self.assertIn("POST /developer/judge-rerun", status["dashboard_internal_endpoints"])
        self.assertIn("POST /developer/reviewer-plan/close", status["dashboard_internal_endpoints"])
        self.assertIn("GET /api/v1/runs/{batch_id}/research-summary", status["integration_endpoints"])
        self.assertEqual(status["role_specific_read_models"]["research_summary"], "implemented")
        self.assertEqual(status["role_specific_read_models"]["management_summary"], "implemented")
        self.assertEqual(status["role_specific_read_models"]["audit_evidence"], "implemented")
        self.assertTrue(status["capabilities"]["external_source_context"])
        self.assertTrue(status["capabilities"]["role_specific_read_models"])
        self.assertNotIn("document_ingestion", status["capabilities"])
        self.assertNotIn("production_authentication", status["capabilities"])

    def test_public_api_v1_aliases_external_evaluation_metrics_and_trace_lookup(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            server = build_server("127.0.0.1", 0, Path(tmpdir))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base_url = f"http://{server.server_address[0]}:{server.server_address[1]}"

            try:
                trace = self.request_json(
                    base_url,
                    "/api/v1/evaluations",
                    {
                        "service_id": "external_service_1",
                        "service_title": "External appointment service",
                        "source_url": "https://example.gov/service/appointment",
                        "question_text": "Kann ich den Termin kostenlos buchen?",
                        "answer_text": "Ja, die Terminbuchung ist kostenlos.",
                        "source_context": "Die Terminbuchung ist kostenlos.",
                        "target_section": "fees",
                        "model_name": "external_qa_backend_v1",
                    },
                )
                trace_id = trace["trace_id"]
                fetched = self.request_json(base_url, f"/api/v1/traces/{trace_id}")
                metrics = self.request_json(base_url, "/api/v1/metrics/overview")
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)

        self.assertEqual(fetched["trace_id"], trace_id)
        self.assertEqual(fetched["retrieval_result"]["chunk_text"], "Die Terminbuchung ist kostenlos.")
        self.assertGreaterEqual(metrics["trace_count"], 1)

    def test_run_read_model_endpoints_return_role_summaries_and_exports(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            self.write_minimal_service_data(data_dir, question_count=2)
            server = build_server("127.0.0.1", 0, data_dir)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base_url = f"http://{server.server_address[0]}:{server.server_address[1]}"

            try:
                worklist = self.request_json(
                    base_url,
                    "/developer/test-run",
                    {"limit": 2, "settings": {"judge_mode": "rule_based_baseline"}},
                )
                batch_id = worklist["active_run"]["batch_id"]
                trace_id = worklist["items"][0]["trace_id"]
                self.request_json(
                    base_url,
                    "/api/v1/human-reviews",
                    {
                        "trace_id": trace_id,
                        "reviewer_id": "P01",
                        "final_decision": "needs_edit",
                        "label": "supported",
                        "human_score": 3,
                        "criteria": {
                            "factual_correctness": 4,
                            "source_support": 5,
                            "completeness": 3,
                            "clarity_actionability": 3,
                            "public_service_tone": 4,
                            "uncertainty_handling": 3,
                        },
                        "comment_text": "Answer needs a clearer next step.",
                        "suggested_correction": "Please bring a passport and the completed form.",
                    },
                )
                runs = self.request_json(base_url, "/api/v1/runs")
                research = self.request_json(base_url, f"/api/v1/runs/{batch_id}/research-summary")
                management = self.request_json(
                    base_url,
                    f"/api/v1/runs/{batch_id}/management-summary?available_reviewers=3&hourly_rate_eur=60",
                )
                audit = self.request_json(base_url, f"/api/v1/runs/{batch_id}/audit-evidence")
                research_content_type, research_csv = self.request_text(
                    base_url,
                    f"/api/v1/runs/{batch_id}/exports/research-cases.csv",
                )
                research_reviews_content_type, research_reviews_csv = self.request_text(
                    base_url,
                    f"/api/v1/runs/{batch_id}/exports/research-reviews.csv",
                )
                audit_csv_content_type, audit_csv = self.request_text(
                    base_url,
                    f"/api/v1/runs/{batch_id}/exports/audit-evidence.csv",
                )
                audit_json_content_type, audit_json = self.request_text(
                    base_url,
                    f"/api/v1/runs/{batch_id}/exports/audit-evidence.json",
                )
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)

        self.assertEqual(runs["schema_version"], "runs-v1")
        self.assertIn(batch_id, [item["batch_id"] for item in runs["items"]])
        self.assertEqual(research["schema_version"], "research-summary-v1")
        self.assertEqual(research["batch"]["batch_id"], batch_id)
        self.assertEqual(research["sample_context"]["total_cases"], 2)
        self.assertEqual(research["review_coverage"]["completed_reviews"], 1)
        self.assertIn("prioritized_cases", research)
        self.assertEqual(management["schema_version"], "management-summary-v1")
        self.assertEqual(management["assumptions"]["available_reviewers"], 3)
        self.assertEqual(management["assumptions"]["hourly_rate_eur"], 60)
        self.assertEqual(management["after_human_review"]["reviewed_cases"], 1)
        self.assertIn("action_backlog", management["after_human_review"])
        self.assertEqual(audit["schema_version"], "audit-evidence-v2")
        self.assertEqual(audit["completeness"]["total_traces"], 2)
        self.assertEqual(audit["completeness"]["with_human_review"], 1)
        self.assertIn("traceability_rows", audit)
        self.assertIn("text/csv", research_content_type)
        self.assertIn("trace_id,question_id", research_csv.splitlines()[0])
        self.assertIn("text/csv", research_reviews_content_type)
        self.assertIn("reviewer_id", research_reviews_csv.splitlines()[0])
        self.assertIn("text/csv", audit_csv_content_type)
        self.assertIn("missing_evidence", audit_csv.splitlines()[0])
        self.assertIn("application/json", audit_json_content_type)
        self.assertEqual(json.loads(audit_json)["schema_version"], "audit-evidence-v2")

    def test_openai_judge_keeps_quality_only_failures_as_needs_edit(self) -> None:
        criteria = {
            "clarity_actionability": {"score": 2},
            "completeness": {"score": 2},
            "factual_correctness": {"score": 2},
            "public_service_tone": {"score": 1},
            "source_support": {"score": 2},
            "uncertainty_handling": {"score": 2},
        }

        decision, reasons = normalize_openai_judge_decision(
            {
                "final_decision": "reject",
                "contradicted_claims": [],
                "unsupported_claims": [],
                "missing_or_incomplete_points": ["The answer does not answer the requested form and requirements."],
                "clarity_or_tone_problems": ["The answer is rude and unhelpful."],
                "context_limitations": [],
            },
            criteria,
        )

        self.assertEqual(decision, "needs_edit")
        self.assertTrue(any("action-critical" in reason for reason in reasons))

    def test_openai_judge_keeps_high_scoring_minor_gaps_as_accept(self) -> None:
        criteria = {
            "clarity_actionability": {"score": 5},
            "completeness": {"score": 4},
            "factual_correctness": {"score": 5},
            "public_service_tone": {"score": 5},
            "source_support": {"score": 5},
            "uncertainty_handling": {"score": 4},
        }

        decision, reasons = normalize_openai_judge_decision(
            {
                "final_decision": "accept",
                "contradicted_claims": [],
                "unsupported_claims": [],
                "missing_or_incomplete_points": ["No information about possible extra costs is available."],
                "clarity_or_tone_problems": [],
                "context_limitations": ["The context only states one fee amount."],
            },
            criteria,
        )

        self.assertEqual(decision, "accept")
        self.assertEqual(reasons, [])

    def test_openai_judge_changes_retrieval_dump_accept_to_needs_edit(self) -> None:
        criteria = {
            "clarity_actionability": {"score": 5},
            "completeness": {"score": 5},
            "factual_correctness": {"score": 5},
            "public_service_tone": {"score": 5},
            "source_support": {"score": 5},
            "uncertainty_handling": {"score": 5},
        }

        decision, reasons = normalize_openai_judge_decision(
            {
                "final_decision": "accept",
                "contradicted_claims": [],
                "unsupported_claims": [],
                "missing_or_incomplete_points": [],
                "clarity_or_tone_problems": [],
                "context_limitations": [],
            },
            criteria,
            answer_text=(
                "Die Frage enthält mehrere Teile. In der bereitgestellten offiziellen Quelle "
                "lassen sie sich so trennen:\n"
                "- Anerkennung ausländischer Berufsqualifikationen als Hebamme beantragen - forms: Antrag\n"
                "- Anerkennung ausländischer Berufsqualifikationen als Hebamme beantragen - fees: 115,00 Euro"
            ),
        )

        self.assertEqual(decision, "needs_edit")
        self.assertTrue(any("retrieval-style" in reason for reason in reasons))

    def test_openai_judge_still_rejects_unsupported_action_critical_claims(self) -> None:
        criteria = {
            "clarity_actionability": {"score": 4},
            "completeness": {"score": 2},
            "factual_correctness": {"score": 2},
            "public_service_tone": {"score": 5},
            "source_support": {"score": 2},
            "uncertainty_handling": {"score": 3},
        }

        decision, reasons = normalize_openai_judge_decision(
            {
                "final_decision": "needs_edit",
                "contradicted_claims": [],
                "unsupported_claims": ["The answer invents a 35 Euro fee."],
                "missing_or_incomplete_points": [],
                "clarity_or_tone_problems": [],
                "context_limitations": [],
            },
            criteria,
        )

        self.assertEqual(decision, "reject")
        self.assertTrue(any("unsupported claims" in reason for reason in reasons))

    def test_parse_json_object_hides_raw_decode_errors(self) -> None:
        with self.assertRaisesRegex(ValueError, "valid JSON object"):
            parse_json_object('{"final_decision": "accept"\n "scores": {}}')

    def test_calibration_good_multi_answer_is_citizen_facing(self) -> None:
        answer = calibration_answer_text(
            answer_kind="good_multi_citizen",
            question={"question_text": "Welche Voraussetzungen, Formulare und Online-Hinweise?", "intent_type": "multi_intent_same_service"},
            retrievals=[
                {
                    "service_title": "Approbation (EU/EWR/Schweiz) als Ärztin/Arzt beantragen",
                    "section_name": "requirements",
                    "chunk_text": (
                        "Abgeschlossene ärztliche Ausbildung\n"
                        "Gesundheitliche Eignung\n"
                        "Ausreichende Deutschkenntnisse"
                    ),
                },
                {
                    "service_title": "Approbation (EU/EWR/Schweiz) als Ärztin/Arzt beantragen",
                    "section_name": "forms",
                    "chunk_text": (
                        "Antrag auf Erteilung der Approbation bei Ausbildung in der Europäischen Union (EU)\n"
                        "Ärztliche Bescheinigung eines in Deutschland zugelassenen Arztes"
                    ),
                },
            ],
        )

        self.assertIn("Approbation (EU/EWR/Schweiz) als Ärztin/Arzt beantragen", answer)
        self.assertIn("Abgeschlossene ärztliche Ausbildung", answer)
        self.assertIn("Antrag auf Erteilung der Approbation", answer)
        self.assertNotIn("Hebamme", answer)
        self.assertNotIn("forms:", answer)
        self.assertNotIn("fees:", answer)
        self.assertNotIn("Prüfen Sie die jeweils verlinkte", answer)

    def test_calibration_good_seed_answers_follow_current_retrieval_context(self) -> None:
        processing_answer = calibration_answer_text(
            answer_kind="good_processing_time",
            question={"question_text": "Wie lange dauert das?"},
            retrievals=[
                {
                    "service_title": "Fictional professional permit renewal",
                    "section_name": "processing_time",
                    "chunk_text": (
                        "Eine vorläufige Bescheinigung kann direkt beim Termin ausgestellt werden.\n"
                        "Die reguläre digitale Bescheinigung dauert 4-6 Wochen."
                    ),
                }
            ],
        )
        no_fee_answer = calibration_answer_text(
            answer_kind="good_no_fee",
            question={"question_text": "Was kostet das?"},
            retrievals=[
                {
                    "service_title": "Fictional municipal support-card application",
                    "section_name": "fees",
                    "chunk_text": "keine",
                }
            ],
        )

        self.assertIn("4-6 Wochen", processing_answer)
        self.assertNotIn("sieben Tagen", processing_answer)
        self.assertIn("keine Gebühren", no_fee_answer)

    def test_calibration_cases_resolve_against_the_bundled_synthetic_questions(self) -> None:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        store = PrototypeStore(
            Path("examples/synthetic-demo"),
            database_path=Path(temp_dir.name) / "runs.sqlite3",
        )

        resolved = [store._calibration_question(case) for case in JUDGE_CALIBRATION_CASES]

        self.assertEqual(len(resolved), len(JUDGE_CALIBRATION_CASES))
        self.assertTrue(all(question.get("question_id") for question in resolved))

    def test_judge_context_keeps_source_section_metadata(self) -> None:
        context = format_retrieved_context_for_judge([
            {
                "service_title": "Nordhafen cultural exchange grant",
                "section_name": "fees",
                "chunk_text": "Keine",
                "source_ref": "https://services.example.invalid/cultural-grant/",
            }
        ])

        self.assertIn("Service: Nordhafen cultural exchange grant", context)
        self.assertIn("Section: fees", context)
        self.assertIn("Text:\nKeine", context)

    def test_calibration_bureaucratic_answer_is_source_grounded_but_hard_to_read(self) -> None:
        answer = calibration_answer_text(
            answer_kind="bureaucratic_answer",
            question={"question_text": "Welche Voraussetzungen nennt Nordhafen dafür?"},
            retrievals=[
                {
                    "service_title": "Nordhafen skilled-worker support procedure",
                    "section_name": "requirements",
                    "chunk_text": (
                        "Ausländische Fachkraft mit qualifizierter Berufsausbildung oder mit Hochschulabschluss\n"
                        "Arbeitsvertrag oder konkretes Arbeitsplatzangebot\n"
                        "Betriebsstätte in Nordhafen"
                    ),
                }
            ],
        )

        self.assertIn("qualifizierter Berufsausbildung", answer)
        self.assertIn("Arbeitsvertrag", answer)
        self.assertIn("Betriebsstätte in Nordhafen", answer)
        self.assertIn("verwaltungsverfahrensrechtlichen", answer)

    def test_retrieval_style_calibration_uses_final_decision_not_exact_score_threshold(self) -> None:
        case = next(
            item for item in JUDGE_CALIBRATION_CASES
            if item["calibration_id"] == "cal_raw_multi_001"
        )

        self.assertEqual(case["expected_final_decision"], "needs_edit")
        self.assertNotIn("expected_criteria_max", case)

    def test_runtime_generation_is_saved_to_sqlite_evaluation_store(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            write_jsonl(
                data_dir / "services.jsonl",
                [
                    {
                        "service_id": "service_1",
                        "title": "Test service",
                        "url": "https://service.example",
                        "description": "Test description",
                        "full_text": "Full text",
                        "sections": {
                            "required_documents": "Sie brauchen einen Antrag und einen Ausweis.",
                        },
                    }
                ],
            )
            write_jsonl(
                data_dir / "citizen_questions.jsonl",
                [
                    {
                        "question_id": "question_1",
                        "service_id": "service_1",
                        "service_title": "Test service",
                        "source_url": "https://service.example",
                        "question_text": "Welche Unterlagen brauche ich?",
                        "target_section": "required_documents",
                        "style_label": "direct_clean",
                        "style_description": "Direct question",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "answer_requested_section",
                        "difficulty_label": "standard",
                    }
                ],
            )

            store = PrototypeStore(data_dir)
            trace = trace_from_payload(
                store,
                {"question_id": "question_1"},
                mode="generate",
            )

            criteria = trace["automated_evaluation"]["criteria"]
            self.assertEqual(
                set(criteria),
                {
                    "factual_correctness",
                    "source_support",
                    "completeness",
                    "clarity_actionability",
                    "public_service_tone",
                    "uncertainty_handling",
                },
            )
            self.assertEqual(criteria["source_support"]["score"], 5)
            self.assertEqual(criteria["source_support"]["label"], "supported")
            self.assertIn("explanation", criteria["source_support"])

            self.assertEqual(store.get_trace(trace["trace_id"]), trace)
            self.assertEqual(store.runtime_traces(), [trace])
            self.assertEqual(store.evaluation_runs()[0]["trace_id"], trace["trace_id"])
            self.assertTrue((data_dir / "evaluation_runs.sqlite3").exists())

    def test_evaluation_accepts_external_question_answer_and_source_context(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = PrototypeStore(Path(tmpdir))

            trace = trace_from_payload(
                store,
                {
                    "service_id": "external_service_1",
                    "service_title": "External appointment service",
                    "source_url": "https://example.gov/service/appointment",
                    "question_text": "Kann ich den Termin kostenlos buchen?",
                    "answer_text": "Ja, die Terminbuchung ist kostenlos.",
                    "source_context": "Die Terminbuchung ist kostenlos.",
                    "target_section": "fees",
                    "model_name": "external_qa_backend_v1",
                },
                mode="evaluate",
            )

            self.assertEqual(trace["service_entry"]["service_id"], "external_service_1")
            self.assertEqual(trace["service_entry"]["title"], "External appointment service")
            self.assertEqual(trace["citizen_question"]["question_text"], "Kann ich den Termin kostenlos buchen?")
            self.assertEqual(trace["citizen_question"]["target_section"], "fees")
            self.assertEqual(trace["retrieval_result"]["chunk_text"], "Die Terminbuchung ist kostenlos.")
            self.assertEqual(trace["retrieval_result"]["source_ref"], "https://example.gov/service/appointment")
            self.assertEqual(trace["generated_answer"]["answer_text"], "Ja, die Terminbuchung ist kostenlos.")
            self.assertEqual(trace["generated_answer"]["model_name"], "external_qa_backend_v1")
            self.assertEqual(store.get_trace(trace["trace_id"]), trace)

    def test_generated_online_answer_includes_official_online_url(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            write_jsonl(
                data_dir / "services.jsonl",
                [
                    {
                        "service_id": "dog_tax",
                        "title": "Hundehaltung - Hund steuerlich anmelden",
                        "url": "https://services.example.invalid/dog-tax/",
                        "description": "Sie können diese Dienstleistung auch online in Anspruch nehmen.",
                        "full_text": "Jetzt online erledigen. Online-Anmeldung ist möglich.",
                        "online_metadata": {
                            "online_available": True,
                            "online_urls": [
                                {
                                    "label": "Jetzt online erledigen",
                                    "url": "https://forms.example.invalid/online-dog-tax",
                                }
                            ],
                            "online_labels": ["Jetzt online erledigen"],
                            "online_procedure_notes": "Für die Online-Anmeldung nutzen Sie den offiziellen Online-Dienst.",
                        },
                        "sections": {
                            "online_abwicklung": "Jetzt online erledigen\nSie können diese Dienstleistung auch online in Anspruch nehmen.",
                            "requirements": "Sie halten den Hund in Ihrem Haushalt in Nordhafen.",
                        },
                    }
                ],
            )
            write_jsonl(
                data_dir / "citizen_questions.jsonl",
                [
                    {
                        "question_id": "dog_online_question",
                        "service_id": "dog_tax",
                        "service_title": "Hundehaltung - Hund steuerlich anmelden",
                        "source_url": "https://services.example.invalid/dog-tax/",
                        "question_text": "Kann ich die Hundesteuer online anmelden?",
                        "target_section": "online_abwicklung",
                        "style_label": "online_question",
                        "style_description": "Online processing question",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "clarify_online_option",
                        "difficulty_label": "standard",
                    }
                ],
            )

            trace = trace_from_payload(
                PrototypeStore(data_dir),
                {"question_id": "dog_online_question"},
                mode="generate",
            )

        answer = trace["generated_answer"]["answer_text"]
        self.assertIn("https://forms.example.invalid/online-dog-tax", answer)
        self.assertIn("Jetzt online erledigen", answer)
        self.assertEqual(
            trace["retrieval_results"][0]["online_urls"][0]["url"],
            "https://forms.example.invalid/online-dog-tax",
        )
        judge_context = format_retrieved_context_for_judge(trace["retrieval_results"])
        self.assertIn("Official online links", judge_context)
        self.assertIn("https://forms.example.invalid/online-dog-tax", judge_context)

    def test_thin_primary_section_adds_related_service_context(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            write_jsonl(
                data_dir / "services.jsonl",
                [
                    {
                        "service_id": "dog_tax",
                        "title": "Hundehaltung - Hund steuerlich anmelden",
                        "url": "https://services.example.invalid/dog-tax/",
                        "description": "Die Anmeldung eines Hundes gilt gleichzeitig als steuerliche Anmeldung.",
                        "full_text": "Die Anmeldung eines Hundes gilt gleichzeitig als steuerliche Anmeldung.\nkeine\netwa 4 Wochen",
                        "online_metadata": {
                            "online_available": True,
                            "online_urls": [
                                {
                                    "label": "Jetzt online erledigen",
                                    "url": "https://forms.example.invalid/online-dog-tax",
                                }
                            ],
                            "online_labels": ["Jetzt online erledigen"],
                            "online_procedure_notes": "Online oder schriftlich möglich.",
                        },
                        "sections": {
                            "fees": "keine",
                            "requirements": "Sie müssen Ihren Hund innerhalb eines Monats anmelden.",
                            "required_documents": "Steuerliche Anmeldung eines Hundes online oder schriftlich möglich.",
                            "processing_time": "bis Sie einen Steuerbescheid erhalten: etwa 4 Wochen",
                            "online_abwicklung": "Jetzt online erledigen",
                        },
                    }
                ],
            )
            write_jsonl(
                data_dir / "citizen_questions.jsonl",
                [
                    {
                        "question_id": "dog_fees_question",
                        "service_id": "dog_tax",
                        "service_title": "Hundehaltung - Hund steuerlich anmelden",
                        "source_url": "https://services.example.invalid/dog-tax/",
                        "question_text": "Bei der Hundesteuer: Wie teuer ist das und muss ich sofort zahlen?",
                        "target_section": "fees",
                        "style_label": "thin_fee_question",
                        "style_description": "Fee question needing payment context",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "answer_fee_and_payment_context",
                        "difficulty_label": "standard",
                    }
                ],
            )

            trace = trace_from_payload(
                PrototypeStore(data_dir),
                {"question_id": "dog_fees_question"},
                mode="generate",
            )

        retrieval_sections = [item["section_name"] for item in trace["retrieval_results"]]
        answer = trace["generated_answer"]["answer_text"]
        judge_context = format_retrieved_context_for_judge(trace["retrieval_results"])
        self.assertIn("fees", retrieval_sections)
        self.assertIn("requirements", retrieval_sections)
        self.assertIn("processing_time", retrieval_sections)
        self.assertIn("keine", answer)
        self.assertIn("etwa 4 Wochen", answer)
        self.assertNotIn("https://forms.example.invalid/online-dog-tax", answer)
        self.assertIn("innerhalb eines Monats", judge_context)

    def test_online_question_adds_neighboring_application_context(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            write_jsonl(
                data_dir / "services.jsonl",
                [
                    {
                        "service_id": "fictional_access_card",
                        "title": "Kommunale Zugangskarte beantragen",
                        "url": "https://services.example.invalid/access-card/",
                        "description": "Sie stellen den Antrag auf Ausstellung einer kommunalen Zugangskarte.",
                        "full_text": (
                            "Sie stellen den Antrag auf Ausstellung einer kommunalen Zugangskarte. "
                            "Das können Sie ausschließlich vor Ort im Servicezentrum machen."
                        ),
                        "sections": {
                            "online_abwicklung": (
                                "Bei der Antragstellung erhalten Sie einen PIN-Brief zur Aktivierung der "
                                "Online-Funktion. Holen Sie die fertige Zugangskarte und das "
                                "Sperrkennwort im Servicezentrum ab."
                            ),
                            "requirements": (
                                "Persönliche Vorsprache ist erforderlich. Die antragstellende Person muss "
                                "bei der Antragstellung anwesend sein."
                            ),
                            "appointment": "Sie können diese Dienstleistung stadtweit in Anspruch nehmen.",
                        },
                    }
                ],
            )
            write_jsonl(
                data_dir / "citizen_questions.jsonl",
                [
                    {
                        "question_id": "access_card_online",
                        "service_id": "fictional_access_card",
                        "service_title": "Kommunale Zugangskarte beantragen",
                        "source_url": "https://services.example.invalid/access-card/",
                        "question_text": "Geht die Zugangskarte online oder muss ich zum Servicezentrum?",
                        "target_section": "online_abwicklung",
                        "style_label": "online_or_office",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "clarify_online_option",
                        "difficulty_label": "standard",
                    }
                ],
            )

            trace = trace_from_payload(
                PrototypeStore(data_dir),
                {"question_id": "access_card_online"},
                mode="generate",
            )

        retrieval_sections = [item["section_name"] for item in trace["retrieval_results"]]
        answer = trace["generated_answer"]["answer_text"]
        self.assertEqual(retrieval_sections[0], "online_abwicklung")
        self.assertIn("requirements", retrieval_sections)
        self.assertIn("Persönliche Vorsprache ist erforderlich", answer)

    def test_responsibility_question_adds_location_and_document_context(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            write_jsonl(
                data_dir / "services.jsonl",
                [
                    {
                        "service_id": "fictional_document_certification",
                        "title": "Internationale Dokumentenbestätigung",
                        "url": "https://services.example.invalid/document-certification/",
                        "description": (
                            "Die Apostille bekommen Sie direkt bei uns ausgestellt. Für andere Länder "
                            "benötigen Sie eine Legalisation durch die Auslandsvertretung."
                        ),
                        "full_text": "Apostille und Legalisation hängen vom Dokument und vom Zielland ab.",
                        "sections": {
                            "responsibility_notes": (
                                "Pro gebuchten Termin ist die Anzahl der zu beglaubigenden Dokumente auf "
                                "maximal 3 begrenzt. Falls mehrere Dokumente beglaubigt werden müssen, "
                                "buchen Sie bitte eine entsprechende Terminanzahl."
                            ),
                            "responsible_locations": (
                                "Zentrale Dokumentenstelle Nordhafen. "
                                "Internationale Dokumentenbestätigungen und Beglaubigungen."
                            ),
                            "required_documents": (
                                "Für Bildungsnachweise wenden Sie sich zuerst an die zuständige Bildungsbehörde. "
                                "Im Anschluss kann die Zentrale Dokumentenstelle die Bestätigung ausstellen."
                            ),
                        },
                    }
                ],
            )
            write_jsonl(
                data_dir / "citizen_questions.jsonl",
                [
                    {
                        "question_id": "document_certification_responsibility",
                        "service_id": "fictional_document_certification",
                        "service_title": "Internationale Dokumentenbestätigung",
                        "source_url": "https://services.example.invalid/document-certification/",
                        "question_text": "Ich brauche eine Dokumentenbestätigung und weiß nicht, welche Stelle zuständig ist.",
                        "target_section": "responsibility_notes",
                        "style_label": "responsible_office",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "answer_responsible_office",
                        "difficulty_label": "standard",
                    }
                ],
            )

            trace = trace_from_payload(
                PrototypeStore(data_dir),
                {"question_id": "document_certification_responsibility"},
                mode="generate",
            )

        retrieval_sections = [item["section_name"] for item in trace["retrieval_results"]]
        answer = trace["generated_answer"]["answer_text"]
        self.assertEqual(retrieval_sections[0], "responsibility_notes")
        self.assertIn("responsible_locations", retrieval_sections)
        self.assertIn("description", retrieval_sections)
        self.assertIn("required_documents", retrieval_sections)
        self.assertIn("Zentrale Dokumentenstelle Nordhafen", answer)

    def test_responsibility_answer_keeps_actionable_document_context_visible(self) -> None:
        long_document_intro = (
            "Für die Vorbeglaubigung dieser Urkunde müssen Sie zuerst prüfen, von welcher "
            "öffentlichen Stelle das Dokument stammt und ob eine Vorbeglaubigung notwendig ist. "
            "Bitte bringen Sie das Originaldokument mit und beachten Sie die Hinweise zum Zielland. "
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            write_jsonl(
                data_dir / "services.jsonl",
                [
                    {
                        "service_id": "fictional_certification_without_location",
                        "title": "Internationale Dokumentenbestätigung",
                        "url": "https://services.example.invalid/document-certification/",
                        "description": "Die zuständige Stelle hängt vom Dokument ab.",
                        "full_text": "Apostille und Legalisation hängen vom Dokument ab.",
                        "sections": {
                            "responsibility_notes": (
                                "Pro gebuchten Termin ist die Anzahl der zu beglaubigenden Dokumente auf "
                                "maximal 3 begrenzt."
                            ),
                            "required_documents": (
                                long_document_intro
                                + "Im Anschluss kann die Zentrale Dokumentenstelle Nordhafen die "
                                "Bestätigung ausstellen."
                            ),
                        },
                    }
                ],
            )
            write_jsonl(
                data_dir / "citizen_questions.jsonl",
                [
                    {
                        "question_id": "certification_without_location_responsibility",
                        "service_id": "fictional_certification_without_location",
                        "service_title": "Internationale Dokumentenbestätigung",
                        "source_url": "https://services.example.invalid/document-certification/",
                        "question_text": "Welche Stelle ist für meine Dokumentenbestätigung zuständig?",
                        "target_section": "responsibility_notes",
                        "style_label": "responsible_office",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "answer_responsible_office",
                        "difficulty_label": "standard",
                    }
                ],
            )

            trace = trace_from_payload(
                PrototypeStore(data_dir),
                {"question_id": "certification_without_location_responsibility"},
                mode="generate",
            )

        self.assertIn("required_documents", [item["section_name"] for item in trace["retrieval_results"]])
        self.assertIn(
            "Zentrale Dokumentenstelle Nordhafen",
            trace["generated_answer"]["answer_text"],
        )

    def test_developer_worklist_uses_only_sqlite_batch_cases(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            write_jsonl(
                data_dir / "services.jsonl",
                [
                    {
                        "service_id": "service_1",
                        "title": "Test service",
                        "url": "https://service.example",
                        "description": "Test description",
                        "full_text": "Full text",
                        "sections": {
                            "required_documents": "Sie brauchen einen Antrag und einen Ausweis.",
                        },
                    }
                ],
            )
            write_jsonl(
                data_dir / "citizen_questions.jsonl",
                [
                    {
                        "question_id": "question_1",
                        "service_id": "service_1",
                        "service_title": "Test service",
                        "source_url": "https://service.example",
                        "question_text": "Welche Unterlagen brauche ich?",
                        "target_section": "required_documents",
                        "style_label": "direct_clean",
                        "style_description": "Direct question",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "answer_requested_section",
                        "difficulty_label": "standard",
                    }
                ],
            )
            legacy_trace = {
                "trace_id": "legacy_runtime_trace",
                "citizen_question": {"question_id": "legacy_question"},
            }
            write_jsonl(data_dir / "sample_evaluation_traces.jsonl", [legacy_trace])
            write_jsonl(data_dir / "runtime_evaluation_traces.jsonl", [legacy_trace])

            store = PrototypeStore(data_dir)

            empty = store.developer_worklist()
            self.assertIsNone(empty["active_run"])
            self.assertEqual(empty["question_count"], 1)
            self.assertEqual(empty["items"], [])
            self.assertEqual(empty["legacy"]["sample_trace_count"], 1)
            self.assertEqual(empty["legacy"]["legacy_jsonl_runtime_trace_count"], 1)

            result = store.create_developer_test_run(limit=1)

            self.assertEqual(result["active_run"]["batch_type"], "test_run")
            self.assertEqual(result["active_run"]["question_count"], 1)
            self.assertEqual(len(result["items"]), 1)
            self.assertEqual(result["items"][0]["variant"], "test_run")
            self.assertNotIn("legacy_runtime_trace", {item["trace_id"] for item in result["items"]})

    def test_developer_worklist_can_select_previous_batch(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            write_jsonl(
                data_dir / "services.jsonl",
                [
                    {
                        "service_id": "service_1",
                        "title": "Test service",
                        "url": "https://service.example",
                        "description": "Test description",
                        "full_text": "Full text",
                        "sections": {
                            "required_documents": "Sie brauchen einen Antrag und einen Ausweis.",
                        },
                    }
                ],
            )
            write_jsonl(
                data_dir / "citizen_questions.jsonl",
                [
                    {
                        "question_id": "question_1",
                        "service_id": "service_1",
                        "service_title": "Test service",
                        "source_url": "https://service.example",
                        "question_text": "Welche Unterlagen brauche ich?",
                        "target_section": "required_documents",
                        "style_label": "direct_clean",
                        "style_description": "Direct question",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "answer_requested_section",
                        "difficulty_label": "standard",
                    }
                ],
            )

            store = PrototypeStore(data_dir)
            first = store.create_developer_test_run(
                limit=1,
                settings={"answer_prompt_version": "answer_first_batch"},
            )
            second = store.create_developer_test_run(
                limit=1,
                settings={"answer_prompt_version": "answer_second_batch"},
            )

            latest = store.developer_worklist()
            selected = store.developer_worklist(batch_id=first["active_run"]["batch_id"])

            self.assertEqual(latest["active_run"]["batch_id"], second["active_run"]["batch_id"])
            self.assertEqual(selected["active_run"]["batch_id"], first["active_run"]["batch_id"])
            self.assertEqual(selected["items"][0]["generated_answer"]["answer_prompt_version"], "answer_first_batch")
            self.assertEqual(
                [batch["batch_id"] for batch in selected["batch_history"]],
                [second["active_run"]["batch_id"], first["active_run"]["batch_id"]],
            )

    def test_developer_test_run_records_selected_prompt_settings(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            write_jsonl(
                data_dir / "services.jsonl",
                [
                    {
                        "service_id": "service_1",
                        "title": "Test service",
                        "url": "https://service.example",
                        "description": "Test description",
                        "full_text": "Full text",
                        "sections": {
                            "required_documents": "Sie brauchen einen Antrag und einen Ausweis.",
                        },
                    }
                ],
            )
            write_jsonl(
                data_dir / "citizen_questions.jsonl",
                [
                    {
                        "question_id": "question_1",
                        "service_id": "service_1",
                        "service_title": "Test service",
                        "source_url": "https://service.example",
                        "question_text": "Welche Unterlagen brauche ich?",
                        "target_section": "required_documents",
                        "style_label": "direct_clean",
                        "style_description": "Direct question",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "answer_requested_section",
                        "difficulty_label": "standard",
                    }
                ],
            )

            store = PrototypeStore(data_dir)
            result = store.create_developer_test_run(
                limit=1,
                settings={
                    "answer_prompt_version": "answer_local_v1",
                    "answer_prompt_text": "Answer from the retrieved source only.",
                    "judge_prompt_version": "judge_local_v1",
                    "judge_prompt_text": "Rate the answer using the shared criteria.",
                    "model_name": "no_llm_baseline",
                    "judge_mode": "rule_based_baseline",
                },
            )

            self.assertEqual(
                result["active_run"]["metadata"]["answer_prompt_version"],
                "answer_local_v1",
            )
            self.assertEqual(result["active_run"]["metadata"]["judge_prompt_version"], "judge_local_v1")
            self.assertEqual(result["active_run"]["metadata"]["model_name"], "no_llm_baseline")
            trace = result["items"][0]
            self.assertEqual(trace["generated_answer"]["answer_prompt_version"], "answer_local_v1")
            self.assertEqual(trace["generated_answer"]["answer_prompt_text"], "Answer from the retrieved source only.")
            self.assertEqual(trace["automated_evaluation"]["judge_prompt_version"], "judge_local_v1")
            self.assertEqual(trace["automated_evaluation"]["judge_prompt_text"], "Rate the answer using the shared criteria.")

    def test_judge_rerun_adds_second_judge_evaluation_without_replacing_human_review(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            write_jsonl(
                data_dir / "services.jsonl",
                [
                    {
                        "service_id": "service_1",
                        "title": "Test service",
                        "url": "https://service.example",
                        "description": "Test description",
                        "full_text": "Full text",
                        "sections": {
                            "required_documents": "Sie brauchen einen Antrag und einen Ausweis.",
                        },
                    }
                ],
            )
            write_jsonl(
                data_dir / "citizen_questions.jsonl",
                [
                    {
                        "question_id": "question_1",
                        "service_id": "service_1",
                        "service_title": "Test service",
                        "source_url": "https://service.example",
                        "question_text": "Welche Unterlagen brauche ich?",
                        "target_section": "required_documents",
                        "style_label": "direct_clean",
                        "style_description": "Direct question",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "answer_requested_section",
                        "difficulty_label": "standard",
                    }
                ],
            )

            store = PrototypeStore(data_dir)
            result = store.create_developer_test_run(
                limit=1,
                settings={
                    "judge_mode": "rule_based_baseline",
                    "judge_prompt_version": "judge_original_v1",
                    "judge_prompt_text": "Original judge prompt.",
                },
            )
            trace = result["items"][0]
            apply_human_review_to_trace(
                trace,
                {
                    "review_id": "review_p01",
                    "trace_id": trace["trace_id"],
                    "reviewer_id": "P01",
                    "reviewer_role": "participant",
                    "human_score": 3,
                    "label": "partly_supported",
                    "criteria": {"source_support": 3},
                    "final_decision": "needs_edit",
                    "reviewer_confidence": "medium",
                    "comment_text": "Useful but incomplete.",
                    "suggested_correction": "",
                    "submitted_at": "2026-05-27T10:10:00+00:00",
                },
            )
            store.update_trace(trace)

            rerun = store.rerun_judge(
                trace["trace_id"],
                settings={
                    "judge_mode": "rule_based_baseline",
                    "judge_prompt_version": "judge_rerun_v2",
                    "judge_prompt_text": "Rerun judge prompt.",
                    "judge_model_name": "rule_based_baseline",
                },
            )

            self.assertEqual(rerun["trace_id"], trace["trace_id"])
            self.assertEqual(rerun["human_reviews"][0]["reviewer_id"], "P01")
            self.assertEqual(rerun["automated_evaluation"]["judge_prompt_version"], "judge_original_v1")
            self.assertEqual(
                [item["judge_prompt_version"] for item in rerun["judge_evaluations"]],
                ["judge_original_v1", "judge_rerun_v2"],
            )
            self.assertEqual(rerun["judge_evaluations"][0]["evaluation_role"], "baseline")
            self.assertEqual(rerun["judge_evaluations"][1]["evaluation_role"], "rerun")
            self.assertEqual(rerun["judge_evaluations"][1]["judge_prompt_text"], "Rerun judge prompt.")
            self.assertNotEqual(
                rerun["judge_evaluations"][0]["auto_eval_id"],
                rerun["judge_evaluations"][1]["auto_eval_id"],
            )

    def test_developer_test_run_defaults_to_latest_saved_prompts(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            write_jsonl(
                data_dir / "services.jsonl",
                [
                    {
                        "service_id": "service_1",
                        "title": "Test service",
                        "url": "https://service.example",
                        "description": "Test description",
                        "full_text": "Full text",
                        "sections": {
                            "required_documents": "Sie brauchen einen Antrag und einen Ausweis.",
                        },
                    }
                ],
            )
            write_jsonl(
                data_dir / "citizen_questions.jsonl",
                [
                    {
                        "question_id": "question_1",
                        "service_id": "service_1",
                        "service_title": "Test service",
                        "source_url": "https://service.example",
                        "question_text": "Welche Unterlagen brauche ich?",
                        "target_section": "required_documents",
                        "style_label": "direct_clean",
                        "style_description": "Direct question",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "answer_requested_section",
                        "difficulty_label": "standard",
                    }
                ],
            )

            store = PrototypeStore(data_dir)
            store.save_prompt_version(
                {
                    "prompt_type": "answer",
                    "prompt_version": "answer_latest",
                    "prompt_text": "Latest answer prompt.",
                    "model_name": "gpt-4.1-mini",
                }
            )
            store.save_prompt_version(
                {
                    "prompt_type": "judge",
                    "prompt_version": "judge_latest",
                    "prompt_text": "Latest judge prompt.",
                    "model_name": "openai_judge_v1",
                }
            )

            result = store.create_developer_test_run(limit=1, settings={})

            metadata = result["active_run"]["metadata"]
            self.assertEqual(metadata["answer_prompt_version"], "answer_latest")
            self.assertEqual(metadata["judge_prompt_version"], "judge_latest")
            trace = result["items"][0]
            self.assertEqual(trace["generated_answer"]["answer_prompt_version"], "answer_latest")
            self.assertEqual(trace["automated_evaluation"]["judge_prompt_version"], "judge_latest")

    def test_developer_test_run_can_generate_answers_with_openai_model(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            write_jsonl(
                data_dir / "services.jsonl",
                [
                    {
                        "service_id": "service_1",
                        "title": "Test service",
                        "url": "https://service.example",
                        "description": "Test description",
                        "full_text": "Full text",
                        "sections": {
                            "required_documents": "Sie brauchen einen Antrag und einen Ausweis.",
                        },
                    }
                ],
            )
            write_jsonl(
                data_dir / "citizen_questions.jsonl",
                [
                    {
                        "question_id": "question_1",
                        "service_id": "service_1",
                        "service_title": "Test service",
                        "source_url": "https://service.example",
                        "question_text": "Welche Unterlagen brauche ich?",
                        "target_section": "required_documents",
                        "style_label": "direct_clean",
                        "style_description": "Direct question",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "answer_requested_section",
                        "difficulty_label": "standard",
                    }
                ],
            )

            store = PrototypeStore(data_dir)
            with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch(
                "prototype.api_openai.call_openai_response",
                return_value="OpenAI answer.",
            ) as openai_call:
                result = store.create_developer_test_run(
                    limit=1,
                    settings={
                        "answer_prompt_version": "answer_openai_v1",
                        "answer_prompt_text": "Answer clearly from the source.",
                        "judge_prompt_version": "judge_local_v1",
                        "judge_prompt_text": "Rate the answer using the shared criteria.",
                        "model_name": "gpt-4.1-mini",
                        "judge_mode": "rule_based_baseline",
                    },
                )
                result = self.wait_for_batch_items(store, result["active_run"]["batch_id"])

            trace = result["items"][0]
            self.assertEqual(trace["generated_answer"]["answer_text"], "OpenAI answer.")
            self.assertEqual(trace["generated_answer"]["generation_mode"], "openai_answer_v1")
            self.assertEqual(trace["generated_answer"]["model_name"], "gpt-4.1-mini")
            self.assertEqual(result["active_run"]["metadata"]["generation_mode"], "openai_answer_v1")
            self.assertEqual(result["active_run"]["metadata"]["model_name"], "gpt-4.1-mini")
            openai_call.assert_called_once()

    def test_openai_judge_normalizes_canonical_schema(self) -> None:
        raw_judge_response = json.dumps(
            {
                "answerability": "partly_answerable",
                "scores": {
                    "factual_correctness": 4,
                    "source_support": 2,
                    "completeness": 3,
                    "clarity_actionability": 5,
                    "public_service_tone": 5,
                    "uncertainty_handling": 4,
                },
                "final_decision": "needs_edit",
                "contradicted_claims": [],
                "unsupported_claims": ["Gebühren werden genannt, obwohl der Kontext sie nicht enthält."],
                "missing_or_incomplete_points": ["Gebühren fehlen im Kontext."],
                "clarity_or_tone_problems": [],
                "context_limitations": ["Retrieved context does not mention fees."],
                "short_explanation": "The answer is polite, but one claim is not source-supported.",
            }
        )

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch(
            "prototype.api_openai.call_openai_response",
            return_value=raw_judge_response,
        ) as openai_call:
            result = generate_openai_judge(
                question={"question_text": "Kostet der Antrag etwas?"},
                answer_text="Der Antrag kostet 10 Euro.",
                context="Fees\nKeine",
                model_name="gpt-4.1-mini",
                prompt_text="Evaluate using the canonical criteria.",
            )

        self.assertEqual(
            set(result["criteria"]),
            {
                "factual_correctness",
                "source_support",
                "completeness",
                "clarity_actionability",
                "public_service_tone",
                "uncertainty_handling",
            },
        )
        self.assertEqual(result["criteria"]["source_support"]["score"], 2)
        self.assertEqual(result["criteria"]["source_support"]["label"], "problem")
        self.assertEqual(result["criteria"]["public_service_tone"]["score"], 5)
        self.assertEqual(result["criteria"]["uncertainty_handling"]["score"], 4)
        self.assertEqual(result["label"], "unsupported")
        self.assertEqual(result["final_decision"], "needs_edit")
        self.assertEqual(result["answerability"], "partly_answerable")
        self.assertEqual(result["explanation"], "The answer is polite, but one claim is not source-supported.")
        self.assertEqual(json.loads(result["raw_judge_output"])["final_decision"], "needs_edit")
        text_format = openai_call.call_args.kwargs["text_format"]
        self.assertEqual(text_format["type"], "json_schema")
        self.assertTrue(text_format["strict"])
        self.assertIn("contradicted_claims", text_format["schema"]["required"])
        self.assertEqual(openai_call.call_args.kwargs["max_output_tokens"], 4000)
        self.assertEqual(openai_call.call_args.kwargs["text_verbosity"], "low")

    def test_openai_judge_uses_low_reasoning_for_gpt5_models(self) -> None:
        raw_judge_response = json.dumps(
            {
                "answerability": "answerable",
                "scores": {
                    "factual_correctness": 5,
                    "source_support": 5,
                    "completeness": 5,
                    "clarity_actionability": 5,
                    "public_service_tone": 5,
                    "uncertainty_handling": 5,
                },
                "final_decision": "accept",
                "contradicted_claims": [],
                "unsupported_claims": [],
                "missing_or_incomplete_points": [],
                "clarity_or_tone_problems": [],
                "context_limitations": [],
                "short_explanation": "The answer is grounded and complete.",
            }
        )

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch(
            "prototype.api_openai.call_openai_response",
            return_value=raw_judge_response,
        ) as openai_call:
            generate_openai_judge(
                question={"question_text": "Was kostet das?"},
                answer_text="Es kostet 164 Euro.",
                context="164 Euro",
                model_name="gpt-5-mini",
                prompt_text="Evaluate using the canonical criteria.",
            )

        self.assertEqual(openai_call.call_args.kwargs["reasoning_effort"], "low")

    def test_openai_judge_rejects_missing_canonical_scores(self) -> None:
        raw_judge_response = json.dumps(
            {
                "answerability": "answerable",
                "scores": {
                    "factual_correctness": 4,
                    "source_support": 4,
                    "completeness": 4,
                    "clarity_actionability": 4,
                    "public_service_tone": 4,
                },
                "final_decision": "accept",
                "unsupported_claims": [],
                "missing_or_incomplete_points": [],
                "clarity_or_tone_problems": [],
                "context_limitations": [],
                "short_explanation": "Looks supported.",
            }
        )

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch(
            "prototype.api_openai.call_openai_response",
            return_value=raw_judge_response,
        ):
            with self.assertRaisesRegex(ValueError, "uncertainty_handling"):
                generate_openai_judge(
                    question={"question_text": "Welche Unterlagen brauche ich?"},
                    answer_text="Sie brauchen einen Antrag.",
                    context="Sie brauchen einen Antrag.",
                    model_name="gpt-4.1-mini",
                    prompt_text="Evaluate using the canonical criteria.",
                )

    def test_openai_judge_rejects_invalid_score_values(self) -> None:
        raw_judge_response = json.dumps(
            {
                "answerability": "answerable",
                "scores": {
                    "factual_correctness": 4,
                    "source_support": 6,
                    "completeness": 4,
                    "clarity_actionability": 4,
                    "public_service_tone": 4,
                    "uncertainty_handling": 4,
                },
                "final_decision": "accept",
                "unsupported_claims": [],
                "missing_or_incomplete_points": [],
                "clarity_or_tone_problems": [],
                "context_limitations": [],
                "short_explanation": "Looks supported.",
            }
        )

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch(
            "prototype.api_openai.call_openai_response",
            return_value=raw_judge_response,
        ):
            with self.assertRaisesRegex(ValueError, "source_support"):
                generate_openai_judge(
                    question={"question_text": "Welche Unterlagen brauche ich?"},
                    answer_text="Sie brauchen einen Antrag.",
                    context="Sie brauchen einen Antrag.",
                    model_name="gpt-4.1-mini",
                    prompt_text="Evaluate using the canonical criteria.",
                )

    def test_developer_demo_run_uses_twenty_random_questions(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            write_jsonl(
                data_dir / "services.jsonl",
                [
                    {
                        "service_id": "service_1",
                        "title": "Test service",
                        "url": "https://service.example",
                        "description": "Test description",
                        "full_text": "Full text",
                        "sections": {
                            "fees": "10 Euro.",
                            "processing_time": "2 Wochen.",
                            "required_documents": "Sie brauchen einen Antrag und einen Ausweis.",
                        },
                    }
                ],
            )
            questions = []
            for index in range(1, 21):
                questions.append(
                    {
                        "question_id": f"question_direct_{index}",
                        "service_id": "service_1",
                        "service_title": "Test service",
                        "source_url": "https://service.example",
                        "question_text": f"Welche Unterlagen brauche ich? {index}",
                        "target_section": "required_documents",
                        "style_label": "direct_clean",
                        "style_description": "Direct question",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "answer_requested_section",
                        "difficulty_label": "standard",
                    }
                )
            questions.extend(
                [
                    {
                        "question_id": "question_fee_polite",
                        "service_id": "service_1",
                        "service_title": "Test service",
                        "source_url": "https://service.example",
                        "question_text": "Was kostet das bitte?",
                        "target_section": "fees",
                        "style_label": "polite_formal",
                        "style_description": "Polite question",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "answer_requested_section",
                        "difficulty_label": "standard",
                    },
                    {
                        "question_id": "question_time_vague",
                        "service_id": "service_1",
                        "service_title": "Test service",
                        "source_url": "https://service.example",
                        "question_text": "Wie lange dauert es ungefähr?",
                        "target_section": "processing_time",
                        "style_label": "vague_context",
                        "style_description": "Vague question",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "answer_requested_section",
                        "difficulty_label": "standard",
                    },
                ]
            )
            write_jsonl(data_dir / "citizen_questions.jsonl", questions)

            store = PrototypeStore(data_dir)
            result = store.create_developer_demo_run(settings={"answer_prompt_version": "answer_demo_v1"})

            self.assertEqual(result["active_run"]["batch_type"], "demo_run")
            self.assertEqual(result["active_run"]["question_count"], 20)
            self.assertEqual(
                result["active_run"]["metadata"]["label"],
                "Create random demo run",
            )
            self.assertEqual(result["active_run"]["metadata"]["selection_method"], "random")
            self.assertEqual(result["active_run"]["metadata"]["answer_prompt_version"], "answer_demo_v1")
            self.assertEqual(len(result["items"]), 20)
            self.assertEqual({item["variant"] for item in result["items"]}, {"demo_run"})
            selected_ids = {item["citizen_question"]["question_id"] for item in result["items"]}
            self.assertEqual(len(selected_ids), 20)
            self.assertTrue(selected_ids.issubset({question["question_id"] for question in questions}))

    def test_reviewer_plan_supports_flexible_counts_and_minimal_profile_fields(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            write_jsonl(
                data_dir / "services.jsonl",
                [
                    {
                        "service_id": "service_1",
                        "title": "Test service",
                        "url": "https://service.example",
                        "description": "Test description",
                        "full_text": "Full text",
                        "sections": {
                            "required_documents": "Sie brauchen einen Antrag und einen Ausweis.",
                        },
                    }
                ],
            )
            write_jsonl(
                data_dir / "citizen_questions.jsonl",
                [
                    {
                        "question_id": f"question_{index}",
                        "service_id": "service_1",
                        "service_title": "Test service",
                        "source_url": "https://service.example",
                        "question_text": f"Welche Unterlagen brauche ich? {index}",
                        "target_section": "required_documents",
                        "style_label": "direct_clean",
                        "style_description": "Direct question",
                        "edge_case_label": "realistic_synthetic",
                        "intent_type": "single_intent",
                        "intent_count": 1,
                        "requires_clarification": False,
                        "expected_answer_behavior": "answer_requested_section",
                        "difficulty_label": "standard",
                    }
                    for index in range(1, 4)
                ],
            )

            store = PrototypeStore(data_dir)
            store.create_developer_test_run(limit=3)
            plan = store.create_reviewer_plan(
                reviewer_count=2,
                reviews_per_question=2,
                base_url="http://127.0.0.1:5173/",
            )

            self.assertEqual(plan["reviewer_count"], 2)
            self.assertEqual(plan["reviews_per_question"], 2)
            self.assertEqual(plan["total_assignments"], 6)
            self.assertEqual(
                [participant["participant_id"] for participant in plan["participants"]],
                ["P01", "P02"],
            )
            self.assertEqual(
                [len(participant["assigned_trace_ids"]) for participant in plan["participants"]],
                [3, 3],
            )
            self.assertIn("participant=P01", plan["participants"][0]["review_url"])
            self.assertEqual(
                plan["profile_fields"],
                [
                    "reviewer_background",
                    "public_service_familiarity",
                    "llm_familiarity",
                    "language_confidence_de",
                ],
            )
            self.assertNotIn("age", plan["profile_fields"])
            self.assertNotIn("gender", plan["profile_fields"])
            self.assertEqual(store.developer_worklist()["reviewer_plan"]["reviewer_count"], 2)

    def test_human_reviews_are_appended_per_reviewer_without_losing_previous_review(self) -> None:
        trace = {
            "trace_id": "trace_reviews",
            "automated_evaluation": {"label": "supported", "judge_score": 5},
            "mock_human_review": None,
            "disagreement_case": None,
        }
        first_review = {
            "review_id": "review_p01",
            "trace_id": "trace_reviews",
            "reviewer_id": "P01",
            "reviewer_role": "participant",
            "final_decision": "accept",
            "label": "supported",
            "human_score": 5,
            "criteria": {"source_support": 5},
        }
        second_review = {
            "review_id": "review_p02",
            "trace_id": "trace_reviews",
            "reviewer_id": "P02",
            "reviewer_role": "participant",
            "final_decision": "reject",
            "label": "unsupported",
            "human_score": 1,
            "criteria": {"source_support": 1},
        }

        apply_human_review_to_trace(trace, first_review)
        apply_human_review_to_trace(trace, second_review)

        self.assertEqual([review["reviewer_id"] for review in trace["human_reviews"]], ["P01", "P02"])
        self.assertEqual(trace["mock_human_review"], second_review)
        self.assertEqual(trace["disagreement_case"]["disagreement_type"], "automated_human_decision_and_source_mismatch")

        updated_first_review = {
            **first_review,
            "final_decision": "needs_edit",
            "human_score": 3,
        }
        apply_human_review_to_trace(trace, updated_first_review)

        self.assertEqual(len(trace["human_reviews"]), 2)
        self.assertEqual(trace["human_reviews"][0]["final_decision"], "needs_edit")
        self.assertEqual(trace["human_reviews"][1]["final_decision"], "reject")


if __name__ == "__main__":
    unittest.main()
