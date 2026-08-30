import tempfile
import unittest
from pathlib import Path

from prototype.agreement_metrics import agreement_stats, cohens_kappa, dominant_share
from prototype.api_server import PrototypeStore
from prototype.tests.test_reviewer_links import make_trace


def _review(reviewer_id, decision, criteria=None, label="supported"):
    return {
        "review_id": f"review_{reviewer_id}_{decision}",
        "reviewer_id": reviewer_id,
        "reviewer_role": "reviewer",
        "label": label,
        "criteria": criteria or {},
        "final_decision": decision,
        "comment_text": "",
        "suggested_correction": "",
        "submitted_at": "2026-07-01T12:00:00+00:00",
    }


def _trace(trace_id, style, label, judge_score, reviews):
    trace = make_trace(trace_id)
    trace["citizen_question"]["style_label"] = style
    trace["automated_evaluation"] = {"label": label, "judge_score": judge_score}
    for review in reviews:
        review["trace_id"] = trace_id
    trace["human_reviews"] = reviews
    return trace


class AgreementMetricsModuleTest(unittest.TestCase):
    def test_percent_and_kappa(self):
        pairs = [("accept", "accept"), ("accept", "accept"), ("reject", "reject")]
        stats = agreement_stats(pairs)
        self.assertEqual(stats["n"], 3)
        self.assertEqual(stats["percent_agreement"], 1.0)
        self.assertEqual(stats["kappa"], 1.0)
        self.assertIn("dominant_share", stats)

    def test_dominant_share_flags_imbalance(self):
        pairs = [("accept", "accept")] * 9 + [("accept", "reject")]
        share = dominant_share(pairs)
        self.assertIsNotNone(share)
        self.assertGreater(share, 0.75)

    def test_kappa_degenerate_returns_reason(self):
        kappa, reason = cohens_kappa([("accept", "accept")])
        self.assertIsNone(kappa)
        self.assertIsNotNone(reason)


class ResearchSummaryMetricsTest(unittest.TestCase):
    def _summary(self):
        self.tmp = tempfile.TemporaryDirectory()
        store = PrototypeStore(data_dir=Path(self.tmp.name))
        batch_id = store.evaluation_store.create_batch(
            batch_type="study_run", question_count=3, metadata={"frozen": True}
        )
        traces = [
            _trace(
                "trace_a",
                "clean",
                "supported",
                5,
                [
                    _review(
                        "P01",
                        "accept",
                        {"completeness": 5, "factual_correctness": 2},
                    ),
                    _review("P02", "accept"),
                ],
            ),
            _trace("trace_b", "vague", "supported", 5, [_review("P01", "needs_edit")]),
            _trace("trace_c", "vague", "unsupported", 1, [_review("P01", "reject")]),
        ]
        for trace in traces:
            store.evaluation_store.save_trace(
                trace, run_type="study_run", provider="openai", batch_id=batch_id
            )
        return store.research_summary(batch_id)

    def test_agreement_stats_present_with_kappa_and_dominant_share(self):
        summary = self._summary()
        stats = summary["agreement_stats"]
        self.assertIn("ai_vs_individual_reviews", stats)
        self.assertIn("ai_vs_majority_human", stats)
        individual = stats["ai_vs_individual_reviews"]
        self.assertEqual(individual["n"], 4)
        self.assertEqual(individual["percent_agreement"], 0.75)
        self.assertIn("dominant_share", individual)
        self.assertIn("dominant_share_warning", individual)
        self.assertIsInstance(individual["dominant_share_warning"], bool)
        self.assertEqual(stats["ai_vs_majority_human"]["n"], 3)

    def test_criterion_comparison_reports_signals_not_human_average(self):
        summary = self._summary()
        rows = {row["criterion"]: row for row in summary["criterion_comparison"]}
        completeness = rows["completeness"]
        self.assertNotIn("human_average", completeness)
        self.assertNotIn("human_positive_signals", completeness)
        self.assertEqual(completeness["reviews_total"], 4)
        self.assertEqual(completeness["human_problem_signals"], 0)
        self.assertEqual(rows["factual_correctness"]["human_problem_signals"], 1)

    def test_reviewer_breakdown_counts_decisions_per_participant(self):
        summary = self._summary()
        breakdown = {row["reviewer_id"]: row for row in summary["reviewer_breakdown"]}
        self.assertEqual(breakdown["P01"]["total"], 3)
        self.assertEqual(breakdown["P02"]["total"], 1)
        p01_decisions = {item["label"]: item["count"] for item in breakdown["P01"]["decisions"]}
        self.assertEqual(p01_decisions, {"accept": 1, "needs_edit": 1, "reject": 1})

    def test_agreement_by_style_match_rate(self):
        summary = self._summary()
        by_style = {row["style"]: row for row in summary["agreement_by_style"]}
        self.assertEqual(by_style["clean"]["match_rate"], 1.0)
        self.assertEqual(by_style["vague"]["comparable_cases"], 2)
        self.assertEqual(by_style["vague"]["matches"], 1)
        self.assertEqual(by_style["vague"]["match_rate"], 0.5)


if __name__ == "__main__":
    unittest.main()
