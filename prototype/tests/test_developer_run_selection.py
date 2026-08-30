import unittest

from prototype.api_server import select_questions_for_developer_run


QUESTIONS = [
    {"question_id": "q_1", "style_label": "short", "target_section": "fees"},
    {"question_id": "q_2", "style_label": "long", "target_section": "forms"},
    {"question_id": "q_3", "style_label": "short", "target_section": "fees"},
]


class DeveloperRunSelectionTest(unittest.TestCase):
    def test_manual_selection_preserves_question_order_and_metadata(self):
        selected, metadata = select_questions_for_developer_run(
            QUESTIONS,
            question_ids=["q_3", "q_1"],
            limit=20,
        )

        self.assertEqual([question["question_id"] for question in selected], ["q_3", "q_1"])
        self.assertEqual(metadata["selection_method"], "manual")
        self.assertEqual(metadata["selected_question_ids"], ["q_3", "q_1"])

    def test_random_selection_records_exact_question_ids(self):
        selected, metadata = select_questions_for_developer_run(
            QUESTIONS,
            limit=2,
            randomize=True,
            random_seed=7,
        )

        self.assertEqual(len(selected), 2)
        self.assertEqual(metadata["selection_method"], "random")
        self.assertEqual(metadata["selection_limit"], 2)
        self.assertEqual(
            metadata["selected_question_ids"],
            [question["question_id"] for question in selected],
        )

    def test_manual_selection_rejects_unknown_question_ids(self):
        with self.assertRaisesRegex(ValueError, "Unknown question_id"):
            select_questions_for_developer_run(QUESTIONS, question_ids=["missing"], limit=20)


if __name__ == "__main__":
    unittest.main()
