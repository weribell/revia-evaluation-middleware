import json
import unittest
from unittest.mock import patch

from prototype.api_server import (
    estimate_openai_response_cost,
    format_retrieved_context,
    generate_openai_judge,
    normalize_openai_usage,
)


class OpenAIUsageCostTest(unittest.TestCase):
    def test_formats_retrieved_context_once_for_answer_and_judge_prompts(self):
        context = format_retrieved_context(
            [
                {
                    "service_title": "Wohnsitz anmelden",
                    "section_name": "required_documents",
                    "source_ref": "https://service.example/1",
                    "chunk_text": "Bringen Sie einen Ausweis mit.",
                    "online_urls": [
                        {"label": "Online erledigen", "url": "https://service.example/online"}
                    ],
                },
                {
                    "service_title": "Wohnsitz anmelden",
                    "section_name": "fees",
                    "source_ref": "https://service.example/1",
                    "chunk_text": "Die Anmeldung ist kostenlos.",
                    "online_urls": [
                        {"label": "Online erledigen", "url": "https://service.example/online"}
                    ],
                },
            ]
        )

        self.assertIn("Source 1:", context)
        self.assertIn("Service: Wohnsitz anmelden", context)
        self.assertIn("Text:\nBringen Sie einen Ausweis mit.", context)
        self.assertIn("Source 2:", context)
        self.assertIn("Text:\nDie Anmeldung ist kostenlos.", context)
        self.assertEqual(context.count("Official online links:"), 1)

    def test_estimates_cost_from_usage_and_model_pricing_snapshot(self):
        usage = normalize_openai_usage(
            {
                "input_tokens": 1000,
                "input_tokens_details": {"cached_tokens": 200},
                "output_tokens": 500,
                "output_tokens_details": {"reasoning_tokens": 50},
                "total_tokens": 1500,
            }
        )

        estimate = estimate_openai_response_cost("gpt-5.4-mini", usage)

        self.assertEqual(estimate["status"], "estimated")
        self.assertEqual(estimate["currency"], "USD")
        self.assertEqual(estimate["model"], "gpt-5.4-mini")
        self.assertEqual(estimate["input_tokens"], 1000)
        self.assertEqual(estimate["cached_input_tokens"], 200)
        self.assertEqual(estimate["output_tokens"], 500)
        self.assertEqual(estimate["reasoning_tokens"], 50)
        self.assertAlmostEqual(estimate["estimated_cost_usd"], 0.002865)

    def test_marks_cost_unconfigured_when_model_has_no_pricing_snapshot(self):
        usage = normalize_openai_usage({"input_tokens": 100, "output_tokens": 20, "total_tokens": 120})

        estimate = estimate_openai_response_cost("gpt-custom", usage)

        self.assertEqual(estimate["status"], "pricing_unconfigured")
        self.assertEqual(estimate["estimated_cost_usd"], None)
        self.assertEqual(estimate["model"], "gpt-custom")

    def test_estimates_cost_for_current_default_gpt5_mini(self):
        usage = normalize_openai_usage(
            {
                "input_tokens": 187839,
                "input_tokens_details": {"cached_tokens": 86400},
                "output_tokens": 18297,
                "total_tokens": 206136,
            }
        )

        estimate = estimate_openai_response_cost("gpt-5-mini", usage)

        self.assertEqual(estimate["status"], "estimated")
        self.assertAlmostEqual(estimate["estimated_cost_usd"], 0.06411375)

    def test_openai_judge_preserves_usage_and_cost_estimate(self):
        raw_judge_output = json.dumps(
            {
                "answerability": "answerable",
                "scores": {
                    "factual_correctness": 5,
                    "source_support": 5,
                    "completeness": 5,
                    "clarity_actionability": 5,
                    "public_service_tone": 5,
                    "uncertainty_handling": 5,
                },
                "criteria": {},
                "final_decision": "accept",
                "contradicted_claims": [],
                "unsupported_claims": [],
                "missing_or_incomplete_points": [],
                "clarity_or_tone_problems": [],
                "context_limitations": [],
                "short_explanation": "The answer is grounded and complete.",
            }
        )
        usage = normalize_openai_usage({"input_tokens": 1000, "output_tokens": 500, "total_tokens": 1500})
        cost_estimate = estimate_openai_response_cost("gpt-5.4-mini", usage)

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}), patch(
            "prototype.api_openai.call_openai_response",
            return_value={
                "text": raw_judge_output,
                "response_id": "resp_test",
                "model": "gpt-5.4-mini-2026-01-01",
                "usage": usage,
                "cost_estimate": cost_estimate,
            },
        ):
            result = generate_openai_judge(
                question={"question_text": "Was kostet der Antrag?"},
                answer_text="Der Antrag kostet 10 Euro.",
                context="Gebühr: 10 Euro.",
                model_name="gpt-5.4-mini",
                prompt_text="Judge the answer.",
            )

        self.assertEqual(result["openai_response_id"], "resp_test")
        self.assertEqual(result["judge_model_name"], "gpt-5.4-mini-2026-01-01")
        self.assertEqual(result["usage"]["total_tokens"], 1500)
        self.assertEqual(result["cost_estimate"]["status"], "estimated")
        self.assertAlmostEqual(result["cost_estimate"]["estimated_cost_usd"], 0.003)


if __name__ == "__main__":
    unittest.main()
