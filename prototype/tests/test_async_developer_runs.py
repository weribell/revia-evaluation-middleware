import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from prototype.api_server import PrototypeStore


class AsyncDeveloperRunTest(unittest.TestCase):
    def make_store(self, question_count: int = 6) -> PrototypeStore:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        data_dir = Path(temp_dir.name)
        (data_dir / "services.jsonl").write_text(
            "\n".join(
                [
                    '{"service_id":"svc_1","title":"Service 1","url":"https://example.gov/1",'
                    '"description":"Service description.",'
                    '"sections":{"fees":"Gebühr: 10 Euro.","forms":"Formular A."},"full_text":"Gebühr: 10 Euro."}'
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        questions = [
            (
                '{"question_id":"q_%03d","service_id":"svc_1","service_title":"Service 1",'
                '"source_url":"https://example.gov/1","question_text":"Was kostet der Antrag %d?",'
                '"target_section":"fees","style_label":"short","edge_case_label":"normal",'
                '"intent_type":"single_intent","intent_count":1,"requires_clarification":false,'
                '"expected_answer_behavior":"answer_requested_section","difficulty_label":"easy"}'
            )
            % (index, index)
            for index in range(1, question_count + 1)
        ]
        (data_dir / "citizen_questions.jsonl").write_text("\n".join(questions) + "\n", encoding="utf-8")
        (data_dir / "llm_citizen_questions.jsonl").write_text("", encoding="utf-8")
        (data_dir / "sample_evaluation_traces.jsonl").write_text("", encoding="utf-8")
        return PrototypeStore(data_dir, database_path=data_dir / "runs.sqlite3")

    def wait_for_batch(self, store: PrototypeStore, batch_id: str, timeout: float = 3.0) -> dict:
        deadline = time.time() + timeout
        last_response = store.developer_worklist(batch_id=batch_id)
        while time.time() < deadline:
            last_response = store.developer_worklist(batch_id=batch_id)
            if last_response["active_run"]["status"] in {"completed", "completed_with_errors", "failed"}:
                return last_response
            time.sleep(0.02)
        return last_response

    def wait_for_calibration_batch(self, store: PrototypeStore, batch_id: str, timeout: float = 3.0) -> dict:
        deadline = time.time() + timeout
        last_response = store.judge_calibration_run(batch_id=batch_id)
        while time.time() < deadline:
            last_response = store.judge_calibration_run(batch_id=batch_id)
            status = last_response["calibration_run"]["status"]
            if status in {"completed", "completed_with_errors", "failed"}:
                return last_response
            time.sleep(0.02)
        return last_response

    def test_openai_demo_run_returns_running_batch_and_processes_at_most_three_cases(self):
        store = self.make_store(question_count=6)
        active_count = 0
        max_active_count = 0
        lock = threading.Lock()

        def fake_openai_answer(*args, **kwargs):
            nonlocal active_count, max_active_count
            with lock:
                active_count += 1
                max_active_count = max(max_active_count, active_count)
            try:
                time.sleep(0.08)
                return "Die Gebühr beträgt 10 Euro."
            finally:
                with lock:
                    active_count -= 1

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}), patch(
            "prototype.api_trace.generate_openai_answer",
            side_effect=fake_openai_answer,
        ):
            response = store.create_developer_demo_run(
                settings={
                    "model_name": "gpt-test",
                    "judge_mode": "rule_based_baseline",
                }
            )

            self.assertEqual(response["active_run"]["status"], "running")
            self.assertLess(len(response["items"]), 6)

            completed = self.wait_for_batch(store, response["active_run"]["batch_id"])

        self.assertEqual(completed["active_run"]["status"], "completed")
        self.assertEqual(len(completed["items"]), 6)
        self.assertLessEqual(max_active_count, 3)
        self.assertGreater(max_active_count, 1)

    def test_imported_openai_judge_run_keeps_dataset_link_while_running_in_background(self):
        store = self.make_store(question_count=0)
        dataset = store.create_imported_answer_dataset(
            filename="external.csv",
            records=[
                {
                    "case_id": f"case_{index}",
                    "question": f"Was kostet der Antrag {index}?",
                    "answer": "Die Gebühr beträgt 10 Euro.",
                    "source_context": "Gebühr: 10 Euro.",
                    "external_system": "external_bot",
                }
                for index in range(1, 5)
            ],
        )

        def fake_openai_judge(*args, **kwargs):
            time.sleep(0.05)
            return {
                "faithfulness_score": 1.0,
                "relevance_score": 1.0,
                "judge_score": 5,
                "label": "supported",
                "criteria": {},
                "evaluation_mode": "openai_judge_v1",
                "explanation": "Synthetic test judge.",
                "final_decision": "accept",
                "evaluated_at": "2026-01-01T00:00:00Z",
            }

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}), patch(
            "prototype.api_trace.generate_openai_judge",
            side_effect=fake_openai_judge,
        ):
            response = store.create_imported_answer_run(
                import_id=dataset["import_id"],
                settings={
                    "judge_mode": "openai_judge_v1",
                    "judge_model_name": "gpt-test",
                    "judge_prompt_version": "judge_test_v1",
                },
            )

            self.assertEqual(response["active_run"]["status"], "running")
            self.assertEqual(response["active_run"]["metadata"]["import_id"], dataset["import_id"])
            self.assertEqual(response["active_run"]["metadata"]["judge_schema_version"], "judge-schema-v1")
            used_dataset = store.imported_answer_dataset(dataset["import_id"])
            self.assertEqual(used_dataset["status"], "used")
            self.assertEqual(used_dataset["used_batch_id"], response["active_run"]["batch_id"])

            completed = self.wait_for_batch(store, response["active_run"]["batch_id"])

        self.assertEqual(completed["active_run"]["status"], "completed")
        self.assertEqual(len(completed["items"]), 4)
        self.assertEqual(completed["items"][0]["generated_answer"]["generation_mode"], "imported_chatbot_answer")
        self.assertEqual(completed["items"][0]["automated_evaluation"]["judge_schema_version"], "judge-schema-v1")

    def test_openai_judge_calibration_runs_in_background(self):
        store = self.make_store(question_count=6)
        active_count = 0
        max_active_count = 0
        lock = threading.Lock()

        def fake_openai_judge(*args, **kwargs):
            nonlocal active_count, max_active_count
            with lock:
                active_count += 1
                max_active_count = max(max_active_count, active_count)
            try:
                time.sleep(0.05)
                return {
                    "faithfulness_score": 1.0,
                    "relevance_score": 1.0,
                    "judge_score": 5,
                    "label": "supported",
                    "criteria": {},
                    "evaluation_mode": "openai_judge_v1",
                    "explanation": "Synthetic calibration judge.",
                    "final_decision": "accept",
                    "evaluated_at": "2026-01-01T00:00:00Z",
                }
            finally:
                with lock:
                    active_count -= 1

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}), patch(
            "prototype.api_trace.generate_openai_judge",
            side_effect=fake_openai_judge,
        ):
            response = store.create_judge_calibration_run(
                settings={
                    "judge_mode": "openai_judge_v1",
                    "judge_model_name": "gpt-test",
                    "judge_prompt_version": "judge_test_v1",
                },
            )
            batch_id = response["calibration_run"]["batch_id"]

            self.assertEqual(response["calibration_run"]["status"], "running")
            self.assertEqual(response["calibration_run"]["metadata"]["processing_mode"], "background")
            self.assertLess(len(response["items"]), response["calibration_run"]["question_count"])

            completed = self.wait_for_calibration_batch(store, batch_id)

        self.assertEqual(completed["calibration_run"]["status"], "completed")
        self.assertEqual(len(completed["items"]), completed["calibration_run"]["question_count"])
        self.assertLessEqual(max_active_count, 3)
        self.assertGreater(max_active_count, 1)

    def test_missing_openai_key_rejects_run_before_creating_batch(self):
        store = self.make_store(question_count=3)

        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}):
            with self.assertRaisesRegex(ValueError, "OPENAI_API_KEY is not configured"):
                store.create_developer_demo_run(
                    settings={
                        "model_name": "no_llm_baseline",
                        "judge_mode": "openai_judge_v1",
                        "judge_model_name": "gpt-test",
                    }
                )

        self.assertEqual(store.evaluation_store.list_batches(), [])


if __name__ == "__main__":
    unittest.main()
