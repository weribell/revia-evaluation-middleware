import unittest


class ApiModuleSplitTest(unittest.TestCase):
    def test_core_api_concepts_are_importable_from_dedicated_modules(self):
        from prototype import api_evaluation, api_generation, api_openai
        from prototype.api_store import PrototypeStore

        self.assertTrue(api_evaluation.CANONICAL_EVALUATION_CRITERIA)
        self.assertTrue(callable(api_evaluation.evaluate_answer))
        self.assertTrue(callable(api_generation.generate_answer_from_retrievals))
        self.assertTrue(callable(api_openai.generate_openai_judge))
        self.assertTrue(callable(PrototypeStore))


if __name__ == "__main__":
    unittest.main()
