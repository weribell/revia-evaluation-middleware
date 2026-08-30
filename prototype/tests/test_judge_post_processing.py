import unittest

from prototype.api_server import (
    CANONICAL_EVALUATION_CRITERIA,
    build_criterion_result,
    normalize_openai_judge_decision,
)


def criteria_with_scores(**overrides):
    scores = {
        "factual_correctness": 5,
        "source_support": 5,
        "completeness": 4,
        "clarity_actionability": 5,
        "public_service_tone": 5,
        "uncertainty_handling": 4,
    }
    scores.update(overrides)
    return {
        key: build_criterion_result(score, "positive", "Test criterion.")
        for key, score in scores.items()
        if key in CANONICAL_EVALUATION_CRITERIA
    }


class JudgePostProcessingTest(unittest.TestCase):
    def test_downgrades_source_supported_answer_when_context_is_insufficient(self):
        parsed = {
            "answerability": "partly_answerable",
            "final_decision": "accept",
            "contradicted_claims": [],
            "unsupported_claims": [],
            "missing_or_incomplete_points": [
                "The answer does not provide the dog tax amount requested by the citizen.",
            ],
            "clarity_or_tone_problems": [],
            "context_limitations": [
                "The retrieved source does not contain the amount of the dog tax.",
            ],
        }

        final_decision, reasons = normalize_openai_judge_decision(
            parsed,
            criteria_with_scores(),
            answer_text="Die Höhe der fiktiven Marktgebühr ist im verfügbaren Kontext nicht angegeben.",
        )

        self.assertEqual(final_decision, "needs_edit")
        self.assertIn(
            "Flagged grounded insufficient context: the answer is source-supported but leaves "
            "an action-critical part of the question unanswered because the retrieved context is incomplete.",
            reasons,
        )

    def test_does_not_downgrade_without_explicit_context_limitation(self):
        parsed = {
            "answerability": "answerable",
            "final_decision": "accept",
            "contradicted_claims": [],
            "unsupported_claims": [],
            "missing_or_incomplete_points": [],
            "clarity_or_tone_problems": [],
            "context_limitations": [],
        }

        final_decision, reasons = normalize_openai_judge_decision(
            parsed,
            criteria_with_scores(),
            answer_text="Die Antwort beantwortet die Frage aus dem verfügbaren Kontext.",
        )

        self.assertEqual(final_decision, "accept")
        self.assertEqual(reasons, [])


if __name__ == "__main__":
    unittest.main()
