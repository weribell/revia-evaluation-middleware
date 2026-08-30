import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from prototype.evaluation_store import SQLiteEvaluationStore


def make_trace(trace_id: str = "runtime_test_trace") -> dict:
    return {
        "trace_id": trace_id,
        "created_at": "2026-05-27T10:00:00+00:00",
        "variant": "runtime_generate",
        "service_entry": {
            "service_id": "service_1",
            "title": "Test service",
            "source_url": "https://service.example",
        },
        "citizen_question": {
            "question_id": "question_1",
            "service_id": "service_1",
            "question_text": "Welche Unterlagen brauche ich?",
        },
        "generated_answer": {
            "answer_text": "Sie brauchen einen Antrag.",
            "generation_mode": "openai_responses",
            "model_name": "gpt-5.4-mini",
            "prompt_version": "answer_v1",
        },
        "automated_evaluation": {
            "label": "supported",
            "judge_score": 4,
            "evaluation_mode": "openai_judge",
            "judge_prompt_version": "judge_v1",
        },
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


class SQLiteEvaluationStoreTest(unittest.TestCase):
    def test_migrates_existing_database_before_creating_batch_indexes(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            database_path = Path(tmpdir) / "evaluation.sqlite3"
            with sqlite3.connect(database_path) as connection:
                connection.executescript(
                    """
                    CREATE TABLE evaluation_traces (
                        trace_id TEXT PRIMARY KEY,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        variant TEXT NOT NULL,
                        question_id TEXT,
                        service_id TEXT,
                        status TEXT NOT NULL,
                        trace_json TEXT NOT NULL
                    );

                    CREATE TABLE evaluation_runs (
                        run_id TEXT PRIMARY KEY,
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
                        metadata_json TEXT NOT NULL
                    );
                    """
                )

            store = SQLiteEvaluationStore(database_path)
            batch_id = store.create_batch(batch_type="test_run", question_count=1)
            store.save_trace(
                make_trace("migrated_trace"),
                run_type="test_run",
                provider="baseline",
                batch_id=batch_id,
            )

            self.assertEqual(
                [trace["trace_id"] for trace in store.list_traces(batch_id=batch_id)],
                ["migrated_trace"],
            )

    def test_saves_trace_and_run_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SQLiteEvaluationStore(Path(tmpdir) / "evaluation.sqlite3")
            trace = make_trace()

            run_id = store.save_trace(
                trace,
                run_type="full_evaluation",
                provider="openai",
                input_tokens=1200,
                output_tokens=350,
                cost_estimate_usd=0.004,
            )

            self.assertEqual(store.get_trace("runtime_test_trace"), trace)
            self.assertEqual(store.list_traces(), [trace])
            runs = store.list_runs()
            self.assertEqual(len(runs), 1)
            self.assertEqual(runs[0]["run_id"], run_id)
            self.assertEqual(runs[0]["trace_id"], "runtime_test_trace")
            self.assertEqual(runs[0]["run_type"], "full_evaluation")
            self.assertEqual(runs[0]["provider"], "openai")
            self.assertEqual(runs[0]["model_name"], "gpt-5.4-mini")
            self.assertEqual(runs[0]["answer_prompt_version"], "answer_v1")
            self.assertEqual(runs[0]["judge_prompt_version"], "judge_v1")
            self.assertEqual(runs[0]["input_tokens"], 1200)
            self.assertEqual(runs[0]["output_tokens"], 350)
            self.assertEqual(runs[0]["status"], "completed")

    def test_updates_existing_trace_without_duplicate_trace_rows(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SQLiteEvaluationStore(Path(tmpdir) / "evaluation.sqlite3")
            trace = make_trace()
            store.save_trace(trace, run_type="generate_answer", provider="baseline")

            updated = json.loads(json.dumps(trace))
            updated["mock_human_review"] = {
                "final_decision": "accept",
                "label": "supported",
                "human_score": 5,
                "criteria": {},
                "comment_text": "Looks fine.",
                "suggested_correction": "",
                "submitted_at": "2026-05-27T10:10:00+00:00",
            }
            store.update_trace(updated)

            self.assertEqual(store.list_traces(), [updated])
            self.assertEqual(len(store.list_runs()), 1)

    def test_groups_developer_traces_into_batches(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SQLiteEvaluationStore(Path(tmpdir) / "evaluation.sqlite3")

            batch_id = store.create_batch(
                batch_type="test_run",
                question_count=5,
                metadata={"label": "Run 5-question test"},
            )
            store.save_trace(
                make_trace("trace_in_batch"),
                run_type="test_run",
                provider="baseline",
                batch_id=batch_id,
            )
            store.save_trace(
                make_trace("trace_outside_batch"),
                run_type="generate",
                provider="baseline",
            )

            self.assertEqual(store.latest_batch()["batch_id"], batch_id)
            self.assertEqual(
                [trace["trace_id"] for trace in store.list_traces(batch_id=batch_id)],
                ["trace_in_batch"],
            )
            self.assertEqual(store.list_batches()[0]["metadata"]["label"], "Run 5-question test")

    def test_saves_and_lists_prompt_versions(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SQLiteEvaluationStore(Path(tmpdir) / "evaluation.sqlite3")

            store.save_prompt_version(
                prompt_type="answer",
                prompt_version="answer_v1",
                prompt_text="Answer using the retrieved source.",
                model_name="no_llm_baseline",
                notes="First local prompt version.",
            )
            store.save_prompt_version(
                prompt_type="judge",
                prompt_version="judge_v1",
                prompt_text="Judge factuality and source support.",
                model_name="rule_based_baseline",
                notes="First local judge version.",
            )

            prompts = store.list_prompt_versions()

            self.assertEqual([prompt["prompt_type"] for prompt in prompts], ["answer", "judge"])
            self.assertEqual(prompts[0]["prompt_version"], "answer_v1")
            self.assertEqual(prompts[0]["prompt_text"], "Answer using the retrieved source.")
            self.assertEqual(prompts[0]["model_name"], "no_llm_baseline")
            self.assertEqual(prompts[0]["notes"], "First local prompt version.")

    def test_updating_a_batched_trace_keeps_it_in_the_batch(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SQLiteEvaluationStore(Path(tmpdir) / "evaluation.sqlite3")
            batch_id = store.create_batch(batch_type="test_run", question_count=1)
            trace = make_trace("trace_in_batch")
            store.save_trace(
                trace,
                run_type="test_run",
                provider="baseline",
                batch_id=batch_id,
            )

            updated = json.loads(json.dumps(trace))
            updated["mock_human_review"] = {
                "final_decision": "accept",
                "label": "supported",
                "human_score": 5,
                "criteria": {},
                "comment_text": "Looks fine.",
                "suggested_correction": "",
                "submitted_at": "2026-05-27T10:10:00+00:00",
            }
            store.update_trace(updated)

            self.assertEqual(store.list_traces(batch_id=batch_id), [updated])

    def test_upserts_human_reviews_by_trace_and_reviewer(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SQLiteEvaluationStore(Path(tmpdir) / "evaluation.sqlite3")
            store.save_trace(make_trace("trace_for_reviews"), run_type="test_run", provider="baseline")

            first_review = {
                "review_id": "review_p01_first",
                "trace_id": "trace_for_reviews",
                "reviewer_id": "P01",
                "reviewer_role": "participant",
                "human_score": 5,
                "label": "supported",
                "criteria": {"source_support": 5},
                "final_decision": "accept",
                "reviewer_confidence": "high",
                "comment_text": "Looks good.",
                "suggested_correction": "",
                "reviewer_profile": {"llm_familiarity": "medium"},
                "submitted_at": "2026-05-27T10:10:00+00:00",
            }
            second_review = {
                "review_id": "review_p02",
                "trace_id": "trace_for_reviews",
                "reviewer_id": "P02",
                "reviewer_role": "participant",
                "human_score": 1,
                "label": "unsupported",
                "criteria": {"source_support": 1},
                "final_decision": "reject",
                "reviewer_confidence": "medium",
                "comment_text": "Unsupported fee claim.",
                "suggested_correction": "Remove the fee.",
                "reviewer_profile": {"llm_familiarity": "low"},
                "submitted_at": "2026-05-27T10:11:00+00:00",
            }
            updated_first_review = {
                **first_review,
                "review_id": "review_p01_updated",
                "human_score": 3,
                "final_decision": "needs_edit",
                "comment_text": "Useful, but incomplete.",
                "submitted_at": "2026-05-27T10:12:00+00:00",
            }

            store.upsert_human_review(first_review)
            store.upsert_human_review(second_review)
            store.upsert_human_review(updated_first_review)

            reviews = store.list_human_reviews(trace_id="trace_for_reviews")

            self.assertEqual([review["reviewer_id"] for review in reviews], ["P01", "P02"])
            self.assertEqual(reviews[0]["review_id"], "review_p01_updated")
            self.assertEqual(reviews[0]["final_decision"], "needs_edit")
            self.assertEqual(reviews[0]["criteria"], {"source_support": 5})
            self.assertEqual(reviews[0]["reviewer_profile"], {"llm_familiarity": "medium"})
            self.assertEqual(reviews[1]["review_id"], "review_p02")
            self.assertEqual(reviews[1]["final_decision"], "reject")

    def test_update_trace_syncs_human_reviews_to_normalized_table(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = SQLiteEvaluationStore(Path(tmpdir) / "evaluation.sqlite3")
            trace = make_trace("trace_with_synced_reviews")
            store.save_trace(trace, run_type="test_run", provider="baseline")

            updated = json.loads(json.dumps(trace))
            updated["human_reviews"] = [
                {
                    "review_id": "review_p01",
                    "trace_id": "trace_with_synced_reviews",
                    "reviewer_id": "P01",
                    "reviewer_role": "participant",
                    "human_score": 5,
                    "label": "supported",
                    "criteria": {"source_support": 5},
                    "final_decision": "accept",
                    "reviewer_confidence": "high",
                    "comment_text": "Ready.",
                    "suggested_correction": "",
                    "reviewer_profile": {"public_service_familiarity": "high"},
                    "submitted_at": "2026-05-27T10:10:00+00:00",
                },
                {
                    "review_id": "review_p02",
                    "trace_id": "trace_with_synced_reviews",
                    "reviewer_id": "P02",
                    "reviewer_role": "participant",
                    "human_score": 3,
                    "label": "partly_supported",
                    "criteria": {"source_support": 3},
                    "final_decision": "needs_edit",
                    "reviewer_confidence": "medium",
                    "comment_text": "Some details are missing.",
                    "suggested_correction": "Add the missing document.",
                    "reviewer_profile": {"public_service_familiarity": "medium"},
                    "submitted_at": "2026-05-27T10:11:00+00:00",
                },
            ]
            updated["mock_human_review"] = updated["human_reviews"][-1]

            store.update_trace(updated)

            reviews = store.list_human_reviews(trace_id="trace_with_synced_reviews")
            self.assertEqual([review["reviewer_id"] for review in reviews], ["P01", "P02"])
            self.assertEqual(reviews[1]["final_decision"], "needs_edit")
            self.assertEqual(store.get_trace("trace_with_synced_reviews")["human_reviews"], reviews)


if __name__ == "__main__":
    unittest.main()
