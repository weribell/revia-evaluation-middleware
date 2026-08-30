import unittest

from prototype.api_openai import build_judge_input_text


class JudgeInputFramingTest(unittest.TestCase):
    def test_clarification_annotation_is_withheld_from_judge(self):
        common = {
            "question": {"question_text": "Welcher Vorgang ist gemeint?"},
            "answer_text": "Bitte nennen Sie den konkreten Vorgang.",
            "context": "Zwei verschiedene Dienstleistungen kommen infrage.",
        }

        input_with_expected_clarification = build_judge_input_text(
            **common,
            requires_clarification=True,
        )
        input_without_expected_clarification = build_judge_input_text(
            **common,
            requires_clarification=False,
        )

        self.assertEqual(input_with_expected_clarification, input_without_expected_clarification)
        self.assertNotIn("Requires clarification", input_with_expected_clarification)
        self.assertIn("Citizen question:\nWelcher Vorgang ist gemeint?", input_with_expected_clarification)
        self.assertIn("Generated answer:\nBitte nennen Sie den konkreten Vorgang.", input_with_expected_clarification)
        self.assertIn(
            "Retrieved official-source context:\n"
            "Zwei verschiedene Dienstleistungen kommen infrage.",
            input_with_expected_clarification,
        )


if __name__ == "__main__":
    unittest.main()
