import tempfile
import unittest
from pathlib import Path

from prototype.api_server import FrozenRunError, PrototypeStore, trace_from_payload


class FrozenStudyRunTest(unittest.TestCase):
    def make_store(self, question_count: int = 4) -> PrototypeStore:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        data_dir = Path(temp_dir.name)
        (data_dir / "services.jsonl").write_text(
            '{"service_id":"svc_1","title":"Service 1","url":"https://example.gov/1",'
            '"description":"Service description.",'
            '"sections":{"fees":"Gebühr: 10 Euro.","forms":"Formular A."},'
            '"full_text":"Gebühr: 10 Euro."}\n',
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

    def test_study_run_is_frozen_and_tags_traces(self):
        store = self.make_store(question_count=3)
        response = store.create_developer_study_run(limit=3)

        active_run = response["active_run"]
        self.assertEqual(active_run["batch_type"], "study_run")
        self.assertEqual(active_run["status"], "completed")

        batch = store.evaluation_store.get_batch(active_run["batch_id"])
        self.assertTrue(batch["metadata"].get("frozen"))
        self.assertTrue(batch["metadata"].get("frozen_at"))
        self.assertTrue(store.evaluation_store.is_batch_frozen(active_run["batch_id"]))

        self.assertEqual(len(response["items"]), 3)
        for trace in response["items"]:
            variant = trace["variant"]
            self.assertTrue(
            variant.startswith(f"study_run_{active_run['batch_id']}"),
                msg=f"unexpected variant {variant}",
            )

    def test_study_run_defaults_to_full_bank_in_stable_order(self):
        store = self.make_store(question_count=6)

        test_response = store.create_developer_study_run(limit=5)
        first_full_response = store.create_developer_study_run()
        second_full_response = store.create_developer_study_run()

        test_batch = test_response["active_run"]
        first_full_batch = first_full_response["active_run"]
        second_full_batch = second_full_response["active_run"]

        self.assertNotEqual(test_batch["batch_id"], first_full_batch["batch_id"])
        self.assertNotEqual(first_full_batch["batch_id"], second_full_batch["batch_id"])
        self.assertEqual(test_batch["question_count"], 5)
        self.assertEqual(first_full_batch["question_count"], 6)
        self.assertEqual(second_full_batch["question_count"], 6)

        expected_full_ids = [f"q_{index:03d}" for index in range(1, 7)]
        first_metadata = store.evaluation_store.get_batch(first_full_batch["batch_id"])["metadata"]
        second_metadata = store.evaluation_store.get_batch(second_full_batch["batch_id"])["metadata"]

        self.assertEqual(first_metadata["selection_method"], "first_n")
        self.assertEqual(first_metadata["selection_limit"], 6)
        self.assertEqual(first_metadata["selected_question_count"], 6)
        self.assertEqual(first_metadata["selected_question_ids"], expected_full_ids)
        self.assertEqual(second_metadata["selected_question_ids"], expected_full_ids)
        self.assertEqual(
            [item["question_id"] for item in first_metadata["selected_questions"]],
            expected_full_ids,
        )

    def test_regeneration_and_judge_rerun_blocked_on_frozen_trace(self):
        store = self.make_store(question_count=2)
        response = store.create_developer_study_run(limit=2)
        trace = response["items"][0]
        trace_id = trace["trace_id"]

        self.assertTrue(store._is_frozen_trace(trace))

        with self.assertRaises(FrozenRunError):
            store.rerun_judge(trace_id, settings={"judge_mode": "rule_based_baseline"})

        with self.assertRaises(FrozenRunError):
            trace_from_payload(
                store,
                {"question_id": trace["citizen_question"]["question_id"], "trace_id": trace_id},
                mode="generate",
            )

    def test_human_review_still_allowed_on_frozen_trace(self):
        store = self.make_store(question_count=2)
        response = store.create_developer_study_run(limit=2)
        trace_id = response["items"][0]["trace_id"]

        # Human review must NOT be blocked on a frozen case. Writing a review goes
        # through update_trace, which never calls the frozen guard.
        trace = store.evaluation_store.get_trace(trace_id)
        self.assertTrue(store._is_frozen_trace(trace))
        trace.setdefault("human_reviews", [])
        trace["human_reviews"].append(
            {
                "trace_id": trace_id,
                "reviewer_id": "P01",
                "review_id": "review_test_1",
                "reviewer_role": "reviewer",
                "human_score": 4,
                "label": "supported",
                "final_decision": "accept",
                "criteria": {"factual_correctness": 4},
            }
        )
        store.update_trace(trace)  # must not raise FrozenRunError

        stored = store.evaluation_store.get_trace(trace_id)
        reviewer_ids = {review.get("reviewer_id") for review in stored.get("human_reviews", [])}
        self.assertIn("P01", reviewer_ids)

    def test_demo_run_remains_mutable(self):
        store = self.make_store(question_count=2)
        response = store.create_developer_demo_run(question_ids=["q_001", "q_002"])
        trace = response["items"][0]

        self.assertFalse(store._is_frozen_trace(trace))
        self.assertFalse(store.evaluation_store.is_batch_frozen(response["active_run"]["batch_id"]))
        # Re-running the judge on a non-frozen run must keep working.
        updated = store.rerun_judge(
            trace["trace_id"], settings={"judge_mode": "rule_based_baseline"}
        )
        self.assertTrue(updated.get("judge_evaluations"))
        self.assertEqual(updated["judge_evaluations"][-1]["judge_schema_version"], "judge-schema-v1")


if __name__ == "__main__":
    unittest.main()
