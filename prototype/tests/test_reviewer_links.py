import unittest
import tempfile
from pathlib import Path

from prototype.api_server import PrototypeStore, reviewer_url


def make_trace(trace_id: str) -> dict:
    return {
        "trace_id": trace_id,
        "created_at": "2026-06-11T12:00:00+00:00",
        "variant": "developer_demo_run",
        "service_entry": {
            "service_id": "service_1",
            "title": "Test service",
            "source_url": "https://service.example",
        },
        "citizen_question": {
            "question_id": f"question_{trace_id}",
            "service_id": "service_1",
            "question_text": "Welche Unterlagen brauche ich?",
        },
        "generated_answer": {"answer_text": "Sie brauchen einen Antrag."},
        "automated_evaluation": {"label": "supported", "judge_score": 5},
        "retrieval_result": {
            "service_title": "Test service",
            "section_name": "required_documents",
            "chunk_text": "Antrag",
            "source_ref": "https://service.example",
            "rank": 1,
        },
        "mock_human_review": None,
        "disagreement_case": None,
    }


def make_imported_reviewed_trace(trace_id: str) -> dict:
    trace = make_trace(trace_id)
    trace["generated_answer"]["generation_mode"] = "imported_chatbot_answer"
    trace["human_reviews"] = [
        {
            "review_id": f"review_{trace_id}_imported",
            "trace_id": trace_id,
            "reviewer_id": "imported_human_label",
            "reviewer_role": "imported_reference",
            "human_score": 4,
            "label": "supported",
            "criteria": {},
            "final_decision": "accept",
            "comment_text": "Imported label.",
            "suggested_correction": "",
            "submitted_at": "2026-06-11T12:00:00+00:00",
        }
    ]
    trace["mock_human_review"] = trace["human_reviews"][0]
    return trace


class ReviewerLinksTest(unittest.TestCase):
    def test_reviewer_url_includes_batch_id(self):
        url = reviewer_url("http://127.0.0.1:5173/?language=de", "P01", "batch_2026_06_02")

        self.assertIn("/?", url)
        self.assertIn("participant=P01", url)
        self.assertIn("batch_id=batch_2026_06_02", url)
        self.assertIn("role=review_batch", url)

    def test_reviewer_url_includes_token(self):
        url = reviewer_url("http://127.0.0.1:5173/", "P01", "batch_x", "secret-token-123")

        self.assertTrue(url.startswith("http://127.0.0.1:5173/?"))
        self.assertIn("role=review_batch", url)
        self.assertIn("participant=P01", url)
        self.assertIn("token=secret-token-123", url)

    def _store_with_plan(self, tmpdir):
        prototype_store = PrototypeStore(data_dir=Path(tmpdir))
        batch_id = prototype_store.evaluation_store.create_batch(
            batch_type="demo_run",
            question_count=2,
        )
        prototype_store.evaluation_store.save_trace(
            make_trace("trace_1"),
            run_type="demo_run",
            provider="baseline",
            batch_id=batch_id,
        )
        prototype_store.evaluation_store.save_trace(
            make_trace("trace_2"),
            run_type="demo_run",
            provider="baseline",
            batch_id=batch_id,
        )
        plan = prototype_store.create_reviewer_plan(
            reviewer_count=2,
            reviews_per_question=2,
            base_url="http://127.0.0.1:5173/",
        )
        return prototype_store, batch_id, plan

    def test_reviewer_plan_assigns_unique_tokens(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            _, _, plan = self._store_with_plan(tmpdir)
            tokens = [participant["token"] for participant in plan["participants"]]
            self.assertTrue(all(tokens))
            self.assertEqual(len(tokens), len(set(tokens)))
            for participant in plan["participants"]:
                self.assertIn(f"token={participant['token']}", participant["review_url"])

    def test_reviewer_assignment_requires_correct_token(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            prototype_store, batch_id, plan = self._store_with_plan(tmpdir)
            token = plan["participants"][0]["token"]

            assignment = prototype_store.reviewer_assignment("P01", batch_id=batch_id, token=token)
            self.assertEqual(assignment["participant"]["participant_id"], "P01")
            self.assertNotIn("token", assignment["participant"])
            # Other participants' tokens must not leak through the active run payload.
            returned_plan = assignment["active_run"]["metadata"]["reviewer_plan"]
            self.assertTrue(
                all("token" not in p for p in returned_plan["participants"]),
            )
            self.assertTrue(
                all("review_url" not in p for p in returned_plan["participants"]),
            )

            with self.assertRaises(PermissionError):
                prototype_store.reviewer_assignment("P01", batch_id=batch_id, token="wrong")
            with self.assertRaises(PermissionError):
                prototype_store.reviewer_assignment("P01", batch_id=batch_id, token="")

    def test_verify_reviewer_token(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            prototype_store, batch_id, plan = self._store_with_plan(tmpdir)
            token = plan["participants"][0]["token"]

            prototype_store.verify_reviewer_token(participant="P01", token=token, batch_id=batch_id)
            with self.assertRaises(PermissionError):
                prototype_store.verify_reviewer_token(
                    participant="P01", token="wrong", batch_id=batch_id
                )
            with self.assertRaises(PermissionError):
                prototype_store.verify_reviewer_token(
                    participant="P99", token=token, batch_id=batch_id
                )

    def test_closing_reviewer_plan_blocks_participant_assignment(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            prototype_store = PrototypeStore(data_dir=Path(tmpdir))
            batch_id = prototype_store.evaluation_store.create_batch(
                batch_type="demo_run",
                question_count=2,
            )
            prototype_store.evaluation_store.save_trace(
                make_trace("trace_1"),
                run_type="demo_run",
                provider="baseline",
                batch_id=batch_id,
            )
            prototype_store.evaluation_store.save_trace(
                make_trace("trace_2"),
                run_type="demo_run",
                provider="baseline",
                batch_id=batch_id,
            )
            prototype_store.create_reviewer_plan(
                reviewer_count=2,
                reviews_per_question=2,
                base_url="http://127.0.0.1:5173/",
            )

            closed_plan = prototype_store.close_reviewer_plan(batch_id)

            self.assertEqual(closed_plan["status"], "closed")
            self.assertIn("closed_at", closed_plan)
            with self.assertRaisesRegex(ValueError, "reviewer links are inactive"):
                prototype_store.reviewer_assignment("P01", batch_id=batch_id)

    def test_reviewer_plan_can_only_be_created_once_per_batch(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            prototype_store = PrototypeStore(data_dir=Path(tmpdir))
            batch_id = prototype_store.evaluation_store.create_batch(
                batch_type="demo_run",
                question_count=1,
            )
            prototype_store.evaluation_store.save_trace(
                make_trace("trace_single_plan"),
                run_type="demo_run",
                provider="baseline",
                batch_id=batch_id,
            )

            prototype_store.create_reviewer_plan(
                reviewer_count=1,
                reviews_per_question=1,
                base_url="http://127.0.0.1:5173/",
            )

            with self.assertRaisesRegex(ValueError, "reviewer plan already exists"):
                prototype_store.create_reviewer_plan(
                    reviewer_count=1,
                    reviews_per_question=1,
                    base_url="http://127.0.0.1:5173/",
                )

    def test_reviewer_plan_can_be_created_for_selected_batch(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            prototype_store = PrototypeStore(data_dir=Path(tmpdir))
            selected_batch_id = prototype_store.evaluation_store.create_batch(
                batch_type="demo_run",
                question_count=1,
                metadata={"label": "Selected older run"},
            )
            prototype_store.evaluation_store.save_trace(
                make_trace("trace_selected_batch"),
                run_type="demo_run",
                provider="baseline",
                batch_id=selected_batch_id,
            )
            latest_batch_id = prototype_store.evaluation_store.create_batch(
                batch_type="demo_run",
                question_count=1,
                metadata={"label": "Latest run"},
            )
            prototype_store.evaluation_store.save_trace(
                make_trace("trace_latest_batch"),
                run_type="demo_run",
                provider="baseline",
                batch_id=latest_batch_id,
            )

            plan = prototype_store.create_reviewer_plan(
                reviewer_count=1,
                reviews_per_question=1,
                base_url="http://127.0.0.1:5173/",
                batch_id=selected_batch_id,
            )

            self.assertEqual(plan["batch_id"], selected_batch_id)
            self.assertEqual(plan["participants"][0]["assigned_trace_ids"], ["trace_selected_batch"])
            selected_batch = prototype_store.evaluation_store.get_batch(selected_batch_id)
            latest_batch = prototype_store.evaluation_store.get_batch(latest_batch_id)
            self.assertIn("reviewer_plan", selected_batch["metadata"])
            self.assertNotIn("reviewer_plan", latest_batch["metadata"])

    def test_imported_run_with_human_labels_cannot_create_normal_reviewer_plan(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            prototype_store = PrototypeStore(data_dir=Path(tmpdir))
            response = prototype_store.create_imported_answer_run(
                records=[
                    {
                        "case_id": "imported_reviewed",
                        "question": "Was kostet der Antrag?",
                        "answer": "Die Gebühr beträgt 10 Euro.",
                        "source_context": "Gebühr: 10 Euro.",
                        "human_review": {
                            "decision": "accept",
                            "label": "supported",
                            "score": 4,
                        },
                    }
                ],
                settings={"judge_mode": "rule_based_baseline"},
            )

            self.assertEqual(response["active_run"]["metadata"]["imported_human_label_count"], 1)
            with self.assertRaisesRegex(ValueError, "already contains imported human labels"):
                prototype_store.create_reviewer_plan(
                    reviewer_count=1,
                    reviews_per_question=1,
                    base_url="http://127.0.0.1:5173/",
                )

    def test_legacy_imported_run_with_trace_human_labels_cannot_create_normal_reviewer_plan(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            prototype_store = PrototypeStore(data_dir=Path(tmpdir))
            batch_id = prototype_store.evaluation_store.create_batch(
                batch_type="external_evaluation_run",
                question_count=1,
                metadata={
                    "input_source": "imported_chatbot_answers",
                    "generation_mode": "imported_chatbot_answer",
                },
            )
            prototype_store.evaluation_store.save_trace(
                make_imported_reviewed_trace("legacy_imported_reviewed"),
                run_type="external_evaluation_run",
                provider="baseline",
                batch_id=batch_id,
            )

            with self.assertRaisesRegex(ValueError, "already contains imported human labels"):
                prototype_store.create_reviewer_plan(
                    reviewer_count=1,
                    reviews_per_question=1,
                    base_url="http://127.0.0.1:5173/",
                )


if __name__ == "__main__":
    unittest.main()
