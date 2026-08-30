import assert from "node:assert/strict"
import test from "node:test"

import {
  allHumanReviews,
  automatedDecision,
  hasHumanDisagreement,
  humanMajorityDecision,
  humanReviews,
  judgeDecision,
} from "../src/components/shared/evaluationTraceModel.ts"

const baseTrace = {
  trace_id: "trace_test",
  citizen_question: {
    question_id: "q_test",
    service_id: "service_1",
    service_title: "Wohnsitz anmelden",
    source_url: "https://service.example/1",
    question_text: "Welche Unterlagen brauche ich?",
    target_section: "required_documents",
    style_label: "direct",
    style_description: "Direct question",
    edge_case_label: "controlled",
    intent_type: "single_intent",
    intent_count: 1,
    requires_clarification: false,
    expected_answer_behavior: "answer_requested_section",
    difficulty_label: "standard",
  },
  generated_answer: {
    answer_text: "Sie brauchen einen Ausweis.",
    generation_mode: "openai_answer_v1",
    model_name: "gpt-4.1-mini",
    prompt_version: "openai_answer_v3",
  },
  automated_evaluation: {
    label: "supported",
    faithfulness_score: 1,
    relevance_score: 1,
    judge_score: 5,
    evaluation_mode: "openai_judge_v1",
    explanation: "Supported.",
  },
  retrieval_result: {
    service_title: "Wohnsitz anmelden",
    section_name: "required_documents",
    chunk_text: "Ausweis",
    source_ref: "https://service.example/1",
    rank: 1,
  },
  human_reviews: [],
  mock_human_review: null,
  disagreement_case: null,
}

test("falls back from current multi-review traces to legacy mock human review", () => {
  const legacyReview = {
    final_decision: "needs_edit",
    label: "partly_supported",
    human_score: 3,
    criteria: {},
    comment_text: "",
    suggested_correction: "",
    submitted_at: "2026-06-03T00:00:00Z",
  }

  assert.deepEqual(
    humanReviews({
      ...baseTrace,
      mock_human_review: legacyReview,
    }),
    [legacyReview],
  )
})

test("hides excluded reviews from aggregates but keeps them for display", () => {
  const includedReview = {
    reviewer_id: "P01",
    final_decision: "accept",
    label: "supported",
    human_score: 5,
    criteria: {},
    comment_text: "",
    suggested_correction: "",
    submitted_at: "2026-06-03T00:00:00Z",
  }
  const excludedReview = {
    reviewer_id: "P02",
    excluded: true,
    final_decision: "reject",
    label: "unsupported",
    human_score: 1,
    criteria: {},
    comment_text: "",
    suggested_correction: "",
    submitted_at: "2026-06-03T00:01:00Z",
  }
  const trace = {
    ...baseTrace,
    human_reviews: [includedReview, excludedReview],
  }

  assert.deepEqual(humanReviews(trace), [includedReview])
  assert.deepEqual(allHumanReviews(trace), [includedReview, excludedReview])
  // The excluded reviewer must not create a false human-human disagreement.
  assert.equal(hasHumanDisagreement(trace), false)
  assert.equal(humanMajorityDecision(trace), "accept")
})

test("maps judge labels and scores to the shared final decision scale", () => {
  assert.equal(judgeDecision({ ...baseTrace.automated_evaluation, label: "unsupported" }), "reject")
  assert.equal(judgeDecision({ ...baseTrace.automated_evaluation, judge_score: 2 }), "reject")
  assert.equal(judgeDecision({ ...baseTrace.automated_evaluation, label: "partly_supported" }), "needs_edit")
  assert.equal(judgeDecision({ ...baseTrace.automated_evaluation, judge_score: 3 }), "needs_edit")
  assert.equal(
    automatedDecision({
      ...baseTrace,
      automated_evaluation: { ...baseTrace.automated_evaluation, final_decision: "accept" },
    }),
    "accept",
  )
})

test("returns no human majority when reviewers tie", () => {
  const trace = {
    ...baseTrace,
    human_reviews: [
      {
        final_decision: "accept",
        label: "supported",
        human_score: 5,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-06-03T00:00:00Z",
      },
      {
        final_decision: "reject",
        label: "unsupported",
        human_score: 1,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-06-03T00:01:00Z",
      },
    ],
  }

  assert.equal(humanMajorityDecision(trace), null)
  assert.equal(hasHumanDisagreement(trace), true)
})
