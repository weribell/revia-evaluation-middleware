import tempfile
import unittest
from pathlib import Path

from prototype.api_common import (
    trace_has_ai_human_mismatch,
    trace_majority_human_decision,
)
from prototype.api_evaluation import apply_human_review_to_trace
from prototype.api_server import PrototypeHandler, PrototypeStore


def make_reviewed_trace(*decisions: str) -> dict:
    return {
        "trace_id": "trace_majority",
        "citizen_question": {"question_id": "q_1", "service_id": "svc_1"},
        "generated_answer": {"answer_text": "Answer."},
        "automated_evaluation": {"final_decision": "accept", "label": "supported"},
        "retrieval_result": {"chunk_text": "Source."},
        "human_reviews": [
            {
                "review_id": f"review_{index}",
                "reviewer_id": f"P{index:02d}",
                "final_decision": decision,
                "label": "supported",
            }
            for index, decision in enumerate(decisions, start=1)
        ],
    }


class MajorityHumanDecisionTest(unittest.TestCase):
    def test_split_reviewers_are_not_a_settled_decision(self):
        trace = make_reviewed_trace("accept", "reject")
        self.assertEqual(trace_majority_human_decision(trace), "pending")
        # AI says accept, but a tied human vote is no decision -> no mismatch.
        self.assertFalse(trace_has_ai_human_mismatch(trace))

    def test_two_vs_one_still_returns_the_majority(self):
        trace = make_reviewed_trace("accept", "accept", "reject")
        self.assertEqual(trace_majority_human_decision(trace), "accept")
        self.assertFalse(trace_has_ai_human_mismatch(trace))

        reject_majority = make_reviewed_trace("reject", "reject", "accept")
        self.assertEqual(trace_majority_human_decision(reject_majority), "reject")
        # AI accept vs human reject majority -> genuine mismatch.
        self.assertTrue(trace_has_ai_human_mismatch(reject_majority))


class HumanReviewAdjudicationTest(unittest.TestCase):
    def make_store(self) -> PrototypeStore:
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        data_dir = Path(temp_dir.name)
        (data_dir / "services.jsonl").write_text("", encoding="utf-8")
        (data_dir / "citizen_questions.jsonl").write_text("", encoding="utf-8")
        (data_dir / "llm_citizen_questions.jsonl").write_text("", encoding="utf-8")
        (data_dir / "sample_evaluation_traces.jsonl").write_text("", encoding="utf-8")
        return PrototypeStore(data_dir, database_path=data_dir / "runs.sqlite3")

    def test_adjudication_flag_and_status_round_trip_in_stored_human_review(self):
        store = self.make_store()
        trace = {
            "trace_id": "trace_adjudication",
            "citizen_question": {"question_id": "q_1", "service_id": "svc_1"},
            "generated_answer": {"answer_text": "Answer."},
            "automated_evaluation": {"final_decision": "accept", "label": "supported"},
            "retrieval_result": {"chunk_text": "Source."},
            "human_reviews": [],
        }
        store.update_trace(trace)

        stored_trace = store.get_trace("trace_adjudication")
        review = {
            "review_id": "review_trace_adjudication_ADJ01",
            "trace_id": "trace_adjudication",
            "reviewer_id": "ADJ01",
            "reviewer_role": "adjudicator",
            "human_score": 3,
            "label": "supported",
            "criteria": {"factual_correctness": 3},
            "final_decision": "needs_edit",
            "comment_text": "Resolved conflict after adjudication.",
            "suggested_correction": "",
            "is_adjudication": True,
            "adjudication_status": "resolved",
        }

        apply_human_review_to_trace(stored_trace, review)
        store.update_trace(stored_trace)

        hydrated = store.get_trace("trace_adjudication")
        self.assertEqual(hydrated["human_reviews"][0]["reviewer_id"], "ADJ01")
        self.assertIs(hydrated["human_reviews"][0]["is_adjudication"], True)
        self.assertEqual(hydrated["human_reviews"][0]["adjudication_status"], "resolved")

    def test_human_review_post_accepts_adjudication_alias_flag(self):
        store = self.make_store()
        trace = {
            "trace_id": "trace_post_adjudication",
            "citizen_question": {"question_id": "q_1", "service_id": "svc_1"},
            "generated_answer": {"answer_text": "Answer."},
            "automated_evaluation": {"final_decision": "accept", "label": "supported"},
            "retrieval_result": {"chunk_text": "Source."},
            "human_reviews": [],
        }
        store.update_trace(trace)

        handler = PrototypeHandler.__new__(PrototypeHandler)
        handler.store = store
        updated = handler.post_human_review(
            {
                "trace_id": "trace_post_adjudication",
                "reviewer_id": "ADJ02",
                "reviewer_role": "adjudicator",
                "final_decision": "accept",
                "label": "supported",
                "criteria": {"factual_correctness": 5},
                "comment_text": "Conflict resolved.",
                "suggested_correction": "",
                "adjudication": True,
                "adjudication_status": "resolved",
            }
        )

        review = updated["human_reviews"][0]
        self.assertEqual(review["reviewer_id"], "ADJ02")
        self.assertIs(review["is_adjudication"], True)
        self.assertEqual(review["adjudication_status"], "resolved")

    def test_public_reviewer_review_post_requires_participant_token(self):
        store = self.make_store()
        trace = {
            "trace_id": "trace_public_review",
            "citizen_question": {"question_id": "q_1", "service_id": "svc_1"},
            "generated_answer": {"answer_text": "Answer."},
            "automated_evaluation": {"final_decision": "accept", "label": "supported"},
            "retrieval_result": {"chunk_text": "Source."},
            "human_reviews": [],
        }
        store.update_trace(trace)

        handler = PrototypeHandler.__new__(PrototypeHandler)
        handler.store = store
        with self.assertRaisesRegex(PermissionError, "participant token is required"):
            handler.post_human_review(
                {
                    "trace_id": "trace_public_review",
                    "reviewer_id": "anonymous_public_write",
                    "final_decision": "accept",
                    "label": "supported",
                    "criteria": {"factual_correctness": 5},
                    "comment_text": "",
                    "suggested_correction": "",
                },
                require_participant_token=True,
            )

    def test_public_reviewer_review_post_checks_token_before_payload_shape(self):
        handler = PrototypeHandler.__new__(PrototypeHandler)
        handler.store = self.make_store()
        with self.assertRaisesRegex(PermissionError, "participant token is required"):
            handler.post_human_review({}, require_participant_token=True)


if __name__ == "__main__":
    unittest.main()
