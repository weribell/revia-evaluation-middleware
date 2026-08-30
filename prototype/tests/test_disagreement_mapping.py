import unittest

from prototype.api_server import make_disagreement


class DisagreementMappingTest(unittest.TestCase):
    def test_flags_final_decision_mismatch_even_when_source_label_matches(self):
        disagreement = make_disagreement(
            "trace_1",
            {
                "final_decision": "accept",
                "label": "supported",
                "judge_score": 5,
            },
            {
                "final_decision": "needs_edit",
                "label": "supported",
                "human_score": 3,
            },
        )

        self.assertIsNotNone(disagreement)
        self.assertEqual(
            disagreement["disagreement_type"],
            "automated_human_final_decision_mismatch",
        )

    def test_flags_source_support_mismatch_separately_from_final_decision(self):
        disagreement = make_disagreement(
            "trace_2",
            {
                "final_decision": "needs_edit",
                "label": "partly_supported",
                "judge_score": 3,
            },
            {
                "final_decision": "needs_edit",
                "label": "unsupported",
                "human_score": 3,
            },
        )

        self.assertIsNotNone(disagreement)
        self.assertEqual(
            disagreement["disagreement_type"],
            "automated_human_source_support_mismatch",
        )

    def test_does_not_flag_when_required_human_and_ai_signals_match(self):
        disagreement = make_disagreement(
            "trace_3",
            {
                "final_decision": "reject",
                "label": "unsupported",
                "judge_score": 1,
            },
            {
                "final_decision": "reject",
                "label": "unsupported",
                "human_score": 1,
            },
        )

        self.assertIsNone(disagreement)

    def test_does_not_treat_unchecked_source_as_source_mismatch(self):
        disagreement = make_disagreement(
            "trace_4",
            {
                "final_decision": "accept",
                "label": "supported",
                "judge_score": 5,
            },
            {
                "final_decision": "accept",
                "label": "not_checked",
                "human_score": 5,
            },
        )

        self.assertIsNone(disagreement)


if __name__ == "__main__":
    unittest.main()
