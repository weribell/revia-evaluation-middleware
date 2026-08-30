import tempfile
import unittest
from pathlib import Path

from prototype.api_server import PrototypeStore
from prototype.tests.test_reviewer_links import make_trace


class StudyPackageExportTest(unittest.TestCase):
    def test_study_package_includes_cases_reviews_and_sanitized_reviewer_plan(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            prototype_store = PrototypeStore(data_dir=Path(tmpdir))
            batch_id = prototype_store.evaluation_store.create_batch(
                batch_type="study_run",
                question_count=1,
                metadata={"frozen": True},
            )
            trace = make_trace("trace_study_export")
            trace["human_reviews"] = [
                {
                    "review_id": "review_trace_study_export_P01",
                    "trace_id": "trace_study_export",
                    "reviewer_id": "P01",
                    "reviewer_role": "reviewer",
                    "human_score": 5,
                    "label": "supported",
                    "criteria": {"factual_correctness": 5},
                    "final_decision": "accept",
                    "comment_text": "Looks good.",
                    "suggested_correction": "",
                    "submitted_at": "2026-07-01T12:00:00+00:00",
                },
            ]
            prototype_store.evaluation_store.save_trace(
                trace,
                run_type="study_run",
                provider="openai",
                batch_id=batch_id,
            )
            prototype_store.create_reviewer_plan(
                reviewer_count=1,
                reviews_per_question=1,
                base_url="https://example.invalid/reviewer",
                batch_id=batch_id,
            )

            package = prototype_store.study_package_export(batch_id)
            self.assertEqual(package["schema_version"], "study-package-v1")
            self.assertEqual(package["manifest"]["batch_id"], batch_id)
            self.assertEqual(package["manifest"]["case_count"], 1)
            self.assertEqual(package["manifest"]["human_review_count"], 1)
            self.assertEqual(package["cases"][0]["trace_id"], "trace_study_export")
            self.assertEqual(package["human_reviews"][0]["reviewer_id"], "P01")
            self.assertIn("retrieval_result", package["cases"][0])
            participant = package["reviewer_plan"]["participants"][0]
            self.assertNotIn("token", participant)
            self.assertNotIn("review_url", participant)


if __name__ == "__main__":
    unittest.main()
