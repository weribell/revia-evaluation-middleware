import tempfile
import unittest
from pathlib import Path

from prototype.api_server import PrototypeStore


class ImportedAnswerRunTest(unittest.TestCase):
    def make_store(self) -> PrototypeStore:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        data_dir = Path(temp_dir.name)
        (data_dir / "services.jsonl").write_text(
            '{"service_id":"external_service","title":"External source","url":"https://example.gov","sections":{},"full_text":""}\n',
            encoding="utf-8",
        )
        (data_dir / "citizen_questions.jsonl").write_text("", encoding="utf-8")
        (data_dir / "llm_citizen_questions.jsonl").write_text("", encoding="utf-8")
        (data_dir / "sample_evaluation_traces.jsonl").write_text("", encoding="utf-8")
        return PrototypeStore(data_dir, database_path=data_dir / "runs.sqlite3")

    def test_stages_imported_answers_before_creating_external_run(self):
        store = self.make_store()

        dataset = store.create_imported_answer_dataset(
            filename="external_answers.csv",
            records=[
                {
                    "case_id": "external_001",
                    "question": "Was kostet der Antrag?",
                    "answer": "Die Gebühr beträgt 10 Euro.",
                    "source_context": "Gebühr: 10 Euro.",
                    "source_url": "https://example.gov/fees",
                    "external_system": "example_chatbot",
                    "human_review": {
                        "label": "supported",
                        "score": 4,
                        "decision": "accept",
                        "comment": "Already reviewed.",
                        "reviewer_id": "synthetic_reference",
                    },
                }
            ],
        )

        self.assertEqual(dataset["filename"], "external_answers.csv")
        self.assertEqual(dataset["row_count"], 1)
        self.assertEqual(dataset["human_label_count"], 1)
        self.assertEqual(dataset["status"], "draft")
        self.assertEqual(store.evaluation_store.list_traces(), [])

        response = store.create_imported_answer_run(
            import_id=dataset["import_id"],
            settings={"judge_mode": "rule_based_baseline", "judge_prompt_version": "rule_judge_v0"},
        )

        self.assertEqual(response["active_run"]["batch_type"], "external_evaluation_run")
        self.assertEqual(response["active_run"]["question_count"], 1)
        self.assertEqual(response["active_run"]["metadata"]["import_id"], dataset["import_id"])
        self.assertEqual(response["active_run"]["metadata"]["import_filename"], "external_answers.csv")
        self.assertEqual(
            response["active_run"]["metadata"]["label"],
            "Imported chatbot answers · external_answers.csv",
        )
        self.assertEqual(response["active_run"]["metadata"]["input_source"], "imported_chatbot_answers")
        self.assertEqual(response["active_run"]["metadata"]["judge_schema_version"], "judge-schema-v1")
        self.assertEqual(len(response["items"]), 1)
        trace = response["items"][0]
        self.assertEqual(trace["automated_evaluation"]["judge_schema_version"], "judge-schema-v1")
        self.assertEqual(trace["generated_answer"]["answer_text"], "Die Gebühr beträgt 10 Euro.")
        self.assertEqual(trace["generated_answer"]["generation_mode"], "imported_chatbot_answer")
        self.assertEqual(trace["citizen_question"]["question_id"], "imported_external_001")
        self.assertEqual(trace["retrieval_result"]["chunk_text"], "Gebühr: 10 Euro.")
        self.assertEqual(trace["human_reviews"][0]["reviewer_id"], "synthetic_reference")
        self.assertEqual(trace["mock_human_review"]["final_decision"], "accept")
        used_dataset = store.imported_answer_dataset(dataset["import_id"])
        self.assertEqual(used_dataset["status"], "used")
        self.assertEqual(used_dataset["used_batch_id"], response["active_run"]["batch_id"])

    def test_deletes_draft_import_but_archives_used_import(self):
        store = self.make_store()
        draft = store.create_imported_answer_dataset(
            filename="draft.csv",
            records=[
                {
                    "case_id": "draft_001",
                    "question": "Was kostet der Antrag?",
                    "answer": "Die Gebühr beträgt 10 Euro.",
                }
            ],
        )

        delete_result = store.delete_imported_answer_dataset(draft["import_id"])
        self.assertTrue(delete_result["deleted"])
        self.assertIsNone(store.imported_answer_dataset(draft["import_id"]))

        used = store.create_imported_answer_dataset(
            filename="used.csv",
            records=[
                {
                    "case_id": "used_001",
                    "question": "Was kostet der Antrag?",
                    "answer": "Die Gebühr beträgt 10 Euro.",
                    "source_context": "Gebühr: 10 Euro.",
                }
            ],
        )
        store.create_imported_answer_run(
            import_id=used["import_id"],
            settings={"judge_mode": "rule_based_baseline"},
        )
        archive_result = store.delete_imported_answer_dataset(used["import_id"])

        self.assertFalse(archive_result["deleted"])
        self.assertEqual(archive_result["dataset"]["status"], "archived")

    def test_preserves_known_question_metadata_for_imported_answers(self):
        store = self.make_store()
        question = {
            "question_id": "q_clarification",
            "service_id": "external_service",
            "service_title": "External source",
            "source_url": "https://example.gov",
            "question_text": "Welcher Vorgang ist gemeint?",
            "target_section": "requirements",
            "requires_clarification": True,
            "intent_type": "ambiguous_multi_intent",
            "intent_count": 2,
        }
        store.questions.append(question)
        store.questions_by_id[question["question_id"]] = question

        response = store.create_imported_answer_run(
            records=[
                {
                    "case_id": "external_001",
                    "question_id": "q_clarification",
                    "requires_clarification": True,
                    "question": "Welcher Vorgang ist gemeint?",
                    "answer": "Bitte nennen Sie den konkreten Vorgang.",
                    "source_context": "Zwei Verfahren kommen infrage.",
                    "service_id": "external_service",
                }
            ],
            settings={"judge_mode": "rule_based_baseline"},
        )

        trace = response["items"][0]
        self.assertEqual(trace["citizen_question"]["question_id"], "q_clarification")
        self.assertTrue(trace["citizen_question"]["requires_clarification"])
        self.assertEqual(trace["citizen_question"]["intent_type"], "ambiguous_multi_intent")


if __name__ == "__main__":
    unittest.main()
