import assert from "node:assert/strict"
import test from "node:test"

import { questionSampleLabel } from "../src/components/review/questionFilters.ts"
import type { CitizenQuestion } from "../src/types.ts"

const baseQuestion: CitizenQuestion = {
  difficulty_label: "standard",
  edge_case_label: "realistic_synthetic",
  expected_answer_behavior: "answer_requested_section",
  intent_count: 1,
  intent_type: "single_intent",
  question_id: "q_1",
  question_text: "Welche Unterlagen brauche ich?",
  requires_clarification: false,
  service_id: "fictional_community_garden",
  service_title: "Community garden plot permit",
  source_url: "https://example.invalid/services/community-garden",
  style_description: "Clean direct question",
  style_label: "direct_clean",
  target_section: "required_documents",
}

test("labels controlled and LLM-generated question samples for the question bank", () => {
  assert.equal(questionSampleLabel(baseQuestion), "Controlled question set")
  assert.equal(
    questionSampleLabel({
      ...baseQuestion,
      generation_method: "llm_authored_synthetic",
      question_id: "llm_q_1",
    }),
    "LLM-generated question set",
  )
  assert.equal(
    questionSampleLabel({
      ...baseQuestion,
      sample_label: "balanced 100 service subset",
    }),
    "balanced 100 service subset",
  )
})
