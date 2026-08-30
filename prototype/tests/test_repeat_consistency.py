"""Tests for the pure repeat-run consistency computation.

`prototype.agreement_metrics.repeat_run_consistency` computes, over a group of
repeat evaluation runs on the same dataset, how stable the AI judge's decision
is per case, a majority-with-ties decision, agreement against an imported human
label, and which cases should be routed to a human. The function works on plain
dicts so it is testable without SQLite.
"""

from __future__ import annotations

import unittest

from prototype.agreement_metrics import repeat_run_consistency


def case(case_id, decision, *, question="", human=None):
    return {
        "case_id": case_id,
        "question": question,
        "final_decision": decision,
        "human_decision": human,
    }


def run(batch_id, cases, *, created_at="2026-07-01T00:00:00+00:00"):
    return {
        "batch_id": batch_id,
        "created_at": created_at,
        "judge_prompt_version": "openai_judge_external_v3",
        "judge_model_name": "gpt-5-mini",
        "judge_context_label": "Source document text",
        "cases": cases,
    }


class RepeatConsistencyTest(unittest.TestCase):
    def test_stable_case_across_all_runs(self):
        runs = [
            run("b1", [case("c1", "accept")]),
            run("b2", [case("c1", "accept")]),
            run("b3", [case("c1", "accept")]),
        ]
        result = repeat_run_consistency(runs)
        row = result["cases"][0]
        self.assertEqual(row["case_id"], "c1")
        self.assertEqual(row["decisions"], ["accept", "accept", "accept"])
        self.assertEqual(row["majority_decision"], "accept")
        self.assertFalse(row["tie"])
        self.assertEqual(row["judge_stability"], "stable")
        self.assertTrue(row["stable_across_all_runs"])
        self.assertFalse(row["route_to_human"])
        self.assertEqual(result["route_to_human"], [])
        self.assertEqual(result["aggregates"]["cases_stable_across_all_runs"], 1)
        self.assertEqual(result["aggregates"]["run_count"], 3)
        # Run metadata is echoed back for the reader.
        self.assertEqual(
            [r["batch_id"] for r in result["runs"]], ["b1", "b2", "b3"]
        )
        self.assertEqual(result["runs"][0]["judge_model_name"], "gpt-5-mini")

    def test_unstable_case_has_majority_and_routes_to_human(self):
        runs = [
            run("b1", [case("c1", "accept")]),
            run("b2", [case("c1", "accept")]),
            run("b3", [case("c1", "reject")]),
        ]
        result = repeat_run_consistency(runs)
        row = result["cases"][0]
        self.assertEqual(row["decisions"], ["accept", "accept", "reject"])
        self.assertEqual(row["majority_decision"], "accept")
        self.assertFalse(row["tie"])
        self.assertEqual(row["judge_stability"], "unstable")
        self.assertFalse(row["stable_across_all_runs"])
        self.assertTrue(row["route_to_human"])
        self.assertEqual(result["route_to_human"], ["c1"])
        self.assertEqual(result["aggregates"]["cases_stable_across_all_runs"], 0)
        self.assertEqual(result["aggregates"]["tie_count"], 0)
        self.assertEqual(result["aggregates"]["route_to_human_count"], 1)

    def test_two_two_tie_has_null_majority_and_tie_flag(self):
        runs = [
            run("b1", [case("c1", "accept")]),
            run("b2", [case("c1", "accept")]),
            run("b3", [case("c1", "reject")]),
            run("b4", [case("c1", "reject")]),
        ]
        result = repeat_run_consistency(runs)
        row = result["cases"][0]
        self.assertIsNone(row["majority_decision"])
        self.assertTrue(row["tie"])
        self.assertEqual(row["judge_stability"], "tie")
        self.assertFalse(row["stable_across_all_runs"])
        self.assertTrue(row["route_to_human"])
        self.assertEqual(result["aggregates"]["tie_count"], 1)

    def test_majority_vs_human_excludes_ties(self):
        runs = [
            run(
                "b1",
                [
                    case("c_match", "accept", human="accept"),
                    case("c_mismatch", "reject", human="accept"),
                    case("c_tie", "accept", human="accept"),
                ],
            ),
            run(
                "b2",
                [
                    case("c_match", "accept", human="accept"),
                    case("c_mismatch", "reject", human="accept"),
                    case("c_tie", "accept", human="accept"),
                ],
            ),
            run(
                "b3",
                [
                    case("c_match", "accept", human="accept"),
                    case("c_mismatch", "reject", human="accept"),
                    case("c_tie", "reject", human="accept"),
                ],
            ),
            run(
                "b4",
                [
                    case("c_match", "accept", human="accept"),
                    case("c_mismatch", "accept", human="accept"),
                    case("c_tie", "reject", human="accept"),
                ],
            ),
        ]
        result = repeat_run_consistency(runs)
        by_case = {row["case_id"]: row for row in result["cases"]}

        # c_match: unanimous accept, matches human accept.
        self.assertEqual(by_case["c_match"]["judge_stability"], "stable")
        self.assertTrue(by_case["c_match"]["majority_vs_human_match"])
        self.assertFalse(by_case["c_match"]["route_to_human"])

        # c_mismatch: majority reject (3-1) but human said accept -> mismatch.
        self.assertEqual(by_case["c_mismatch"]["majority_decision"], "reject")
        self.assertFalse(by_case["c_mismatch"]["majority_vs_human_match"])
        self.assertTrue(by_case["c_mismatch"]["route_to_human"])

        # c_tie: 2-2 split, excluded from majority-vs-human comparison.
        self.assertTrue(by_case["c_tie"]["tie"])
        self.assertIsNone(by_case["c_tie"]["majority_vs_human_match"])
        self.assertTrue(by_case["c_tie"]["route_to_human"])

        majority = result["aggregates"]["majority_vs_human"]
        self.assertEqual(majority["comparable_cases"], 2)
        self.assertEqual(majority["matches"], 1)
        self.assertEqual(majority["match_rate"], 0.5)
        self.assertEqual(majority["ties_excluded"], 1)
        self.assertAlmostEqual(majority["percent_agreement"], 0.5, places=6)

        # route order follows first-seen case order.
        self.assertEqual(result["route_to_human"], ["c_mismatch", "c_tie"])

        # Per-run human agreement + decision distribution reuse agreement_stats.
        per_run = {r["batch_id"]: r for r in result["aggregates"]["per_run_human_agreement"]}
        self.assertEqual(per_run["b4"]["comparable_cases"], 3)
        self.assertEqual(per_run["b4"]["matches"], 2)
        self.assertAlmostEqual(per_run["b4"]["percent_agreement"], 2 / 3, places=6)
        dist = {r["batch_id"]: r["distribution"] for r in result["aggregates"]["decision_distribution_per_run"]}
        self.assertEqual(dist["b4"], {"accept": 2, "reject": 1})

    def test_single_run_marks_every_case_stable(self):
        runs = [run("b1", [case("c1", "accept"), case("c2", "reject")])]
        result = repeat_run_consistency(runs)
        for row in result["cases"]:
            self.assertEqual(row["judge_stability"], "stable")
            self.assertTrue(row["stable_across_all_runs"])
            self.assertFalse(row["route_to_human"])
        self.assertEqual(result["aggregates"]["case_count"], 2)
        self.assertEqual(result["aggregates"]["cases_stable_across_all_runs"], 2)
        self.assertEqual(result["route_to_human"], [])

    def test_case_absent_from_one_run_is_not_stable_across_all(self):
        runs = [
            run("b1", [case("c1", "accept"), case("c2", "accept")]),
            run("b2", [case("c1", "accept")]),  # c2 missing here
        ]
        result = repeat_run_consistency(runs)
        by_case = {row["case_id"]: row for row in result["cases"]}
        self.assertEqual(by_case["c2"]["decisions"], ["accept", None])
        # Decisions that are present agree, so the judge did not disagree...
        self.assertEqual(by_case["c2"]["judge_stability"], "stable")
        # ...but the case is not present in every run.
        self.assertFalse(by_case["c2"]["stable_across_all_runs"])
        self.assertFalse(by_case["c2"]["route_to_human"])
        self.assertEqual(result["aggregates"]["cases_stable_across_all_runs"], 1)

    def test_empty_runs_return_empty_structure(self):
        result = repeat_run_consistency([])
        self.assertEqual(result["runs"], [])
        self.assertEqual(result["cases"], [])
        self.assertEqual(result["route_to_human"], [])
        aggregates = result["aggregates"]
        self.assertEqual(aggregates["run_count"], 0)
        self.assertEqual(aggregates["case_count"], 0)
        self.assertEqual(aggregates["cases_stable_across_all_runs"], 0)
        self.assertEqual(aggregates["tie_count"], 0)
        self.assertEqual(aggregates["per_run_human_agreement"], [])
        self.assertEqual(aggregates["decision_distribution_per_run"], [])
        self.assertIsNone(aggregates["majority_vs_human"]["match_rate"])
        self.assertEqual(aggregates["majority_vs_human"]["comparable_cases"], 0)


if __name__ == "__main__":
    unittest.main()
