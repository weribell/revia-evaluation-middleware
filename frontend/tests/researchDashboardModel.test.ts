import assert from "node:assert/strict"
import test from "node:test"

import {
  buildResearchAgreementByStyle,
  buildResearchAgreementStats,
  buildResearchCaseDetail,
  buildResearchCaseExportRows,
  buildResearchConfusionMatrix,
  buildResearchCriterionRows,
  buildResearchReviewerBreakdown,
  countFlaggedSourceConcerns,
  buildResearchDisagreementRows,
  buildResearchEvidenceRows,
  buildResearchFailureModes,
  buildResearchInterpretationSummary,
  buildResearchReviewerNotes,
  buildResearchReviewCompleteness,
  buildResearchReviewExportRows,
  buildResearchRunSummary,
  buildResearchSampleContext,
  buildResearchSampleSummary,
  filterResearchDisagreementRows,
} from "../src/components/research/researchDashboardModel.ts"

const baseTrace = {
  trace_id: "trace_accept",
  citizen_question: {
    question_id: "q_accept",
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
    final_decision: "accept",
  },
  retrieval_result: {
    service_title: "Wohnsitz anmelden",
    section_name: "required_documents",
    chunk_text: "Ausweis",
    source_ref: "https://service.example/1",
    rank: 1,
  },
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
  ],
  mock_human_review: null,
  disagreement_case: null,
}

const reviewedTrace = {
  ...baseTrace,
  automated_evaluation: {
    ...baseTrace.automated_evaluation,
    criteria: {
      factual_correctness: {
        score: 5,
        label: "correct",
        explanation: "No factual issue found.",
      },
      source_support: {
        score: 5,
        label: "supported",
        explanation: "Supported by the source.",
      },
      completeness: {
        score: 4,
        label: "mostly_complete",
        explanation: "Mostly complete.",
      },
      clarity_actionability: {
        score: 4,
        label: "clear",
        explanation: "Clear enough.",
      },
      public_service_tone: {
        score: 5,
        label: "appropriate",
        explanation: "Appropriate tone.",
      },
      uncertainty_handling: {
        score: 4,
        label: "handled",
        explanation: "No clarification needed.",
      },
    },
  },
  human_reviews: [
    {
      ...baseTrace.human_reviews[0],
      reviewer_id: "P01",
      criteria: {
        factual_correctness: 5,
        source_support: 5,
        completeness: 4,
        clarity_actionability: 4,
        public_service_tone: 5,
        uncertainty_handling: 4,
      },
      reviewer_profile: {
        background: "administration",
        public_service_familiarity: "high",
        llm_familiarity: "medium",
        german_confidence: "high",
      },
    },
  ],
}

test("summarizes selected run coverage and direct AI-human agreement", () => {
  const traces = [
    baseTrace,
    {
      ...baseTrace,
      trace_id: "trace_reject",
      citizen_question: {
        ...baseTrace.citizen_question,
        question_id: "q_reject",
        question_text: "Kostet das 10 Euro?",
      },
      automated_evaluation: {
        ...baseTrace.automated_evaluation,
        final_decision: "accept",
        label: "supported",
      },
      human_reviews: [
        {
          ...baseTrace.human_reviews[0],
          final_decision: "reject",
          label: "unsupported",
        },
      ],
      disagreement_case: {
        flag_reason: "AI accepted an unsupported answer.",
        severity: "high",
        disagreement_type: "automated_human_label_mismatch",
      },
    },
    {
      ...baseTrace,
      trace_id: "trace_pending",
      citizen_question: {
        ...baseTrace.citizen_question,
        question_id: "q_pending",
      },
      human_reviews: [],
    },
  ]

  const summary = buildResearchRunSummary({
    activeRun: {
      batch_id: "batch_demo",
      batch_type: "demo_run",
      created_at: "2026-06-03T00:00:00Z",
      metadata: {
        answer_prompt_version: "openai_answer_v3",
        judge_prompt_version: "openai_judge_v16",
      },
      question_count: 3,
      status: "completed",
    },
    reviewerPlan: {
      case_review_targets: {
        trace_accept: 2,
        trace_pending: 2,
        trace_reject: 2,
      },
      participants: [],
      profile_fields: [],
      reviewer_count: 2,
      reviews_per_question: 2,
      summary: "2 reviewers",
      total_assignments: 6,
    },
    traces,
  })

  assert.deepEqual(summary.decisionDistribution, {
    accept: 1,
    needs_edit: 0,
    pending: 1,
    reject: 1,
  })
  assert.equal(summary.coverageCards[0].value, "2/3")
  assert.equal(summary.coverageCards[1].value, "2/6")
  assert.equal(summary.agreementCards[0].value, "1")
  assert.equal(summary.agreementCards[2].value, "1")
  assert.deepEqual(summary.metadata.slice(0, 2), [
    ["Batch", "batch_demo"],
    ["Run type", "demo_run"],
  ])
})

test("builds disagreement rows for mismatches and human-human disagreement", () => {
  const rows = buildResearchDisagreementRows([
    baseTrace,
    {
      ...baseTrace,
      trace_id: "trace_human_disagreement",
      citizen_question: {
        ...baseTrace.citizen_question,
        question_id: "q_human_disagreement",
      },
      human_reviews: [
        {
          ...baseTrace.human_reviews[0],
          final_decision: "accept",
          label: "supported",
          reviewer_id: "P01",
        },
        {
          ...baseTrace.human_reviews[0],
          final_decision: "needs_edit",
          label: "supported",
          reviewer_id: "P02",
        },
      ],
    },
    {
      ...baseTrace,
      trace_id: "trace_source_mismatch",
      human_reviews: [
        {
          ...baseTrace.human_reviews[0],
          final_decision: "accept",
          label: "unsupported",
        },
      ],
    },
  ])

  assert.equal(rows.length, 2)
  assert.equal(rows[0].traceId, "trace_human_disagreement")
  assert.equal(rows[0].finalDecisionStatus, "human_disagreement")
  assert.equal(rows[0].issue, "Human-human disagreement")
  assert.equal(rows[1].traceId, "trace_source_mismatch")
  assert.equal(rows[1].sourceSupportStatus, "mismatch")
})

test("builds research-ready case export rows with one row per case", () => {
  const rows = buildResearchCaseExportRows("batch_demo", [
    reviewedTrace,
    {
      ...reviewedTrace,
      trace_id: "trace_split_human_decision",
      citizen_question: {
        ...reviewedTrace.citizen_question,
        question_id: "q_split",
        generation_method: "llm_authored_synthetic",
        intent_type: "ambiguous_multi_intent",
        style_label: "time_pressure",
        target_section: "fees",
      },
      human_reviews: [
        { ...reviewedTrace.human_reviews[0], final_decision: "accept", reviewer_id: "P01" },
        { ...reviewedTrace.human_reviews[0], final_decision: "needs_edit", reviewer_id: "P02" },
      ],
    },
  ])

  assert.equal(rows.length, 2)
  assert.deepEqual(Object.keys(rows[0]), [
    "batch_id",
    "trace_id",
    "question_id",
    "service",
    "question_type",
    "question_style",
    "target_section",
    "ai_decision",
    "human_majority_decision",
    "agreement_status",
    "source_concern",
    "failure_mode",
    "needs_follow_up",
  ])
  assert.equal(rows[0].batch_id, "batch_demo")
  assert.equal(rows[0].human_majority_decision, "accept")
  assert.equal(rows[0].agreement_status, "match")
  assert.equal(rows[1].question_type, "llm_authored_synthetic")
  assert.equal(rows[1].human_majority_decision, "human_disagreement")
  assert.equal(rows[1].agreement_status, "human_disagreement")
  assert.equal(rows[1].needs_follow_up, "yes")
})

test("builds research-ready review export rows with one row per human review", () => {
  const rows = buildResearchReviewExportRows([
    {
      ...reviewedTrace,
      human_reviews: [
        {
          ...reviewedTrace.human_reviews[0],
          comment_text: "Helpful, but should mention the appointment step.",
          reviewer_confidence: "high",
          reviewer_id: "P01",
          submitted_at: "2026-06-14T12:00:00Z",
        },
        {
          ...reviewedTrace.human_reviews[0],
          criteria: { completeness: 2 },
          final_decision: "needs_edit",
          label: "partly_supported",
          reviewer_id: "P02",
          reviewer_profile: {
            background: "student",
            german_confidence: "medium",
            llm_familiarity: "high",
            public_service_familiarity: "low",
          },
        },
      ],
    },
  ])

  assert.equal(rows.length, 2)
  assert.deepEqual(Object.keys(rows[0]), [
    "trace_id",
    "reviewer_id",
    "final_decision",
    "source_support_label",
    "criteria_factual_correctness",
    "criteria_source_support",
    "criteria_completeness",
    "criteria_clarity_actionability",
    "criteria_public_service_tone",
    "criteria_uncertainty_handling",
    "reviewer_confidence",
    "profile_background",
    "profile_public_service_familiarity",
    "profile_llm_familiarity",
    "profile_german_confidence",
    "comment_text",
    "submitted_at",
  ])
  assert.equal(rows[0].criteria_factual_correctness, 5)
  assert.equal(rows[0].reviewer_confidence, "high")
  assert.equal(rows[0].comment_text, "Helpful, but should mention the appointment step.")
  assert.equal(rows[1].final_decision, "needs_edit")
  assert.equal(rows[1].source_support_label, "partly_supported")
  assert.equal(rows[1].criteria_factual_correctness, "")
  assert.equal(rows[1].criteria_completeness, 2)
  assert.equal(rows[1].profile_background, "student")
})

test("builds compact qualitative reviewer notes for analysis", () => {
  const rows = buildResearchReviewerNotes([
    {
      ...reviewedTrace,
      trace_id: "trace_accept_note",
      human_reviews: [
        {
          ...reviewedTrace.human_reviews[0],
          comment_text: "Good enough for publication.",
          final_decision: "accept",
          reviewer_id: "P01",
        },
      ],
    },
    {
      ...reviewedTrace,
      trace_id: "trace_needs_edit_note",
      citizen_question: {
        ...reviewedTrace.citizen_question,
        question_text: "Welche Frist gilt?",
        service_title: "Fristservice",
      },
      human_reviews: [
        {
          ...reviewedTrace.human_reviews[0],
          comment_text: "The deadline is missing from the answer.",
          final_decision: "needs_edit",
          reviewer_id: "P02",
        },
      ],
    },
    {
      ...reviewedTrace,
      trace_id: "trace_correction_note",
      human_reviews: [
        {
          ...reviewedTrace.human_reviews[0],
          comment_text: "",
          final_decision: "reject",
          reviewer_id: "P03",
          suggested_correction: "Use only the official source text.",
        },
      ],
    },
    {
      ...reviewedTrace,
      trace_id: "trace_empty_note",
      human_reviews: [
        {
          ...reviewedTrace.human_reviews[0],
          comment_text: "",
          reviewer_id: "P04",
          suggested_correction: "",
        },
      ],
    },
  ])

  assert.deepEqual(
    rows.map((row) => [row.traceId, row.reviewerId, row.finalDecision]),
    [
      ["trace_correction_note", "P03", "reject"],
      ["trace_needs_edit_note", "P02", "needs_edit"],
      ["trace_accept_note", "P01", "accept"],
    ],
  )
  assert.equal(rows[0].note, "Use only the official source text.")
  assert.equal(rows[0].noteType, "Suggested correction")
  assert.equal(rows[1].question, "Welche Frist gilt?")
  assert.equal(rows[1].service, "Fristservice")
})

test("summarizes the selected evaluation sample composition", () => {
  const summary = buildResearchSampleSummary([
    reviewedTrace,
    {
      ...reviewedTrace,
      trace_id: "trace_llm_multi",
      citizen_question: {
        ...reviewedTrace.citizen_question,
        question_id: "q_llm_multi",
        generation_method: "llm_authored",
        style_label: "time_pressure",
        target_section: "fees",
        intent_type: "multi_intent",
        intent_count: 3,
        requires_clarification: true,
      },
    },
  ])

  assert.equal(summary.totalCases, 2)
  assert.deepEqual(summary.questionSourceDistribution, [
    { label: "controlled", count: 1 },
    { label: "llm_authored", count: 1 },
  ])
  assert.deepEqual(summary.clarificationDistribution, [
    { label: "no clarification needed", count: 1 },
    { label: "requires clarification", count: 1 },
  ])
  assert.equal(summary.intentDistribution.find((item) => item.label === "multi_intent")?.count, 1)
  assert.equal(summary.targetSectionDistribution.find((item) => item.label === "fees")?.count, 1)
})

test("builds readable sample context items from sample distributions", () => {
  const summary = buildResearchSampleSummary([
    reviewedTrace,
    {
      ...reviewedTrace,
      trace_id: "trace_llm_multi",
      citizen_question: {
        ...reviewedTrace.citizen_question,
        question_id: "q_llm_multi",
        generation_method: "llm_authored",
        intent_type: "multi_intent",
        style_label: "runtime_user_input",
        target_section: "external_context",
        requires_clarification: true,
      },
    },
  ])

  const context = buildResearchSampleContext(summary)

  assert.deepEqual(context[0], {
    distribution: [
      { label: "controlled", count: 1 },
      { label: "llm_authored", count: 1 },
    ],
    label: "Question source",
    primary: "mixed",
    summary: "controlled 1, llm_authored 1",
    total: 2,
  })
  assert.deepEqual(context[1], {
    distribution: [
      { label: "no clarification needed", count: 1 },
      { label: "requires clarification", count: 1 },
    ],
    label: "Answerability",
    primary: "mixed",
    summary: "no clarification needed 1, requires clarification 1",
    total: 2,
  })
  assert.equal(context[2].primary, "mixed")
  assert.equal(context[3].primary, "mixed")
  assert.equal(context[4].label, "Intent type")
  assert.equal(context[4].primary, "mixed")
})

test("summarizes review completeness and reviewer background without personal data", () => {
  const completeness = buildResearchReviewCompleteness({
    reviewerPlan: {
      case_review_targets: {
        trace_accept: 2,
        trace_missing: 2,
        trace_multi: 2,
      },
      participants: [
        { assigned_trace_ids: ["trace_accept"], completed_reviews: 1, participant_id: "P01", review_url: "url-1" },
        { assigned_trace_ids: ["trace_multi"], completed_reviews: 1, participant_id: "P02", review_url: "url-2" },
      ],
      profile_fields: ["background", "public_service_familiarity", "llm_familiarity", "german_confidence"],
      reviewer_count: 2,
      reviews_per_question: 2,
      summary: "2 reviewers",
      total_assignments: 6,
    },
    traces: [
      reviewedTrace,
      { ...reviewedTrace, trace_id: "trace_missing", human_reviews: [] },
      {
        ...reviewedTrace,
        trace_id: "trace_multi",
        human_reviews: [
          reviewedTrace.human_reviews[0],
          {
            ...reviewedTrace.human_reviews[0],
            reviewer_id: "P02",
            reviewer_profile: {
              reviewer_background: "student",
              public_service_familiarity: "low",
              llm_familiarity: "high",
              language_confidence_de: "medium",
            },
          },
        ],
      },
    ],
  })

  assert.deepEqual(completeness.caseBuckets, [
    { label: "0 reviews", count: 1 },
    { label: "1 review", count: 1 },
    { label: "2+ reviews", count: 1 },
  ])
  assert.equal(completeness.reviewerProfiles.background.student, 1)
  assert.equal(completeness.reviewerProfiles.public_service_familiarity.high, 1)
  assert.equal(completeness.reviewerProfiles.public_service_familiarity.low, 1)
  assert.equal(completeness.reviewerProfiles.llm_familiarity.high, 1)
  assert.equal(completeness.reviewerProfiles.german_confidence.medium, 1)
  assert.equal(completeness.participantProgress[0].participantId, "P01")
})

test("builds AI-human confusion matrix with false accept and false reject counts", () => {
  const matrix = buildResearchConfusionMatrix([
    reviewedTrace,
    {
      ...reviewedTrace,
      trace_id: "trace_false_accept",
      automated_evaluation: { ...reviewedTrace.automated_evaluation, final_decision: "accept" },
      human_reviews: [{ ...reviewedTrace.human_reviews[0], final_decision: "reject" }],
    },
    {
      ...reviewedTrace,
      trace_id: "trace_false_reject",
      automated_evaluation: { ...reviewedTrace.automated_evaluation, final_decision: "reject" },
      human_reviews: [{ ...reviewedTrace.human_reviews[0], final_decision: "accept" }],
    },
  ])

  assert.equal(matrix.comparableCases, 3)
  assert.equal(matrix.matches, 1)
  assert.equal(matrix.falseAccepts, 1)
  assert.equal(matrix.falseRejects, 1)
  assert.equal(matrix.cells.find((cell) => cell.aiDecision === "accept" && cell.humanDecision === "reject")?.count, 1)
})

test("counts human-human final decision disagreement separately from comparable matrix cases", () => {
  const matrix = buildResearchConfusionMatrix([
    reviewedTrace,
    {
      ...reviewedTrace,
      trace_id: "trace_split_human_decision",
      human_reviews: [
        { ...reviewedTrace.human_reviews[0], final_decision: "accept", reviewer_id: "P01" },
        { ...reviewedTrace.human_reviews[0], final_decision: "needs_edit", reviewer_id: "P02" },
      ],
    },
  ])

  assert.equal(matrix.comparableCases, 1)
  assert.equal(matrix.humanDecisionDisagreements, 1)
  assert.equal(matrix.matches, 1)
})

test("interprets whether a selected run is strong enough for research conclusions", () => {
  const thinInterpretation = buildResearchInterpretationSummary({
    reviewerPlan: {
      case_review_targets: {
        trace_accept: 2,
        trace_pending: 2,
      },
      participants: [],
      profile_fields: [],
      reviewer_count: 2,
      reviews_per_question: 2,
      summary: "2 reviewers",
      total_assignments: 4,
    },
    traces: [
      { ...reviewedTrace, trace_id: "trace_accept" },
      { ...reviewedTrace, trace_id: "trace_pending", human_reviews: [] },
    ],
  })

  assert.equal(thinInterpretation.strength, "thin")
  assert.match(thinInterpretation.headline, /not strong enough/)
  assert.equal(thinInterpretation.sampleSize, 2)
  assert.equal(thinInterpretation.reviewedCases, 1)
  assert.equal(thinInterpretation.multiReviewCases, 0)
  // Reviews carry the default "supported" label (no flagged problem), so there
  // are no source concerns and none is treated as a skipped check.
  assert.equal(thinInterpretation.sourceConcernCases, 0)
  assert.ok(
    thinInterpretation.warnings.some((warning) => warning.includes("2+ human reviews")),
  )
  assert.ok(
    !thinInterpretation.warnings.some((warning) => warning.includes("source checking")),
  )

  const interpretableInterpretation = buildResearchInterpretationSummary({
    reviewerPlan: {
      case_review_targets: {
        trace_accept: 2,
        trace_needs_edit: 2,
        trace_reject: 2,
      },
      participants: [],
      profile_fields: [],
      reviewer_count: 2,
      reviews_per_question: 2,
      summary: "2 reviewers",
      total_assignments: 6,
    },
    traces: [
      {
        ...reviewedTrace,
        trace_id: "trace_accept",
        human_reviews: [
          reviewedTrace.human_reviews[0],
          { ...reviewedTrace.human_reviews[0], reviewer_id: "P02" },
        ],
      },
      {
        ...reviewedTrace,
        trace_id: "trace_needs_edit",
        human_reviews: [
          { ...reviewedTrace.human_reviews[0], final_decision: "needs_edit", reviewer_id: "P01" },
          { ...reviewedTrace.human_reviews[0], final_decision: "needs_edit", reviewer_id: "P02" },
        ],
      },
      {
        ...reviewedTrace,
        trace_id: "trace_reject",
        human_reviews: [
          { ...reviewedTrace.human_reviews[0], final_decision: "reject", reviewer_id: "P01" },
          { ...reviewedTrace.human_reviews[0], final_decision: "reject", reviewer_id: "P02" },
        ],
      },
    ],
  })

  assert.equal(interpretableInterpretation.strength, "interpretable")
  assert.match(interpretableInterpretation.headline, /partly aligned|mostly aligned|poorly aligned/)
  assert.equal(interpretableInterpretation.reviewedCases, 3)
  assert.equal(interpretableInterpretation.multiReviewCases, 3)
  // No source problems were flagged, yet the run stays interpretable: a clean
  // source is the default and must not gate interpretability.
  assert.equal(interpretableInterpretation.sourceConcernCases, 0)
})

test("summarizes research core answer cards as rates and process risks", () => {
  const summary = buildResearchRunSummary({
    activeRun: null,
    reviewerPlan: {
      case_review_targets: {},
      participants: [],
      profile_fields: [],
      reviewer_count: 2,
      reviews_per_question: 2,
      summary: "2 reviewers",
      total_assignments: 8,
    },
    traces: [
      reviewedTrace,
      {
        ...reviewedTrace,
        trace_id: "trace_ai_too_positive_edit",
        automated_evaluation: { ...reviewedTrace.automated_evaluation, final_decision: "accept" },
        human_reviews: [
          { ...reviewedTrace.human_reviews[0], final_decision: "needs_edit", label: "supported" },
        ],
      },
      {
        ...reviewedTrace,
        trace_id: "trace_source_mismatch",
        automated_evaluation: {
          ...reviewedTrace.automated_evaluation,
          final_decision: "accept",
          label: "supported",
        },
        human_reviews: [
          { ...reviewedTrace.human_reviews[0], final_decision: "accept", label: "unsupported" },
        ],
      },
      { ...reviewedTrace, trace_id: "trace_pending", human_reviews: [] },
    ],
  })

  assert.equal(summary.coreAnswerCards.find((card) => card.label === "AI-human final decision match rate")?.value, "67%")
  assert.equal(summary.coreAnswerCards.find((card) => card.label === "AI too positive cases")?.value, "1")
  assert.equal(summary.coreAnswerCards.find((card) => card.label === "Source-support mismatch")?.value, "1")
  assert.equal(summary.coreAnswerCards.find((card) => card.label === "Pending / incomplete reviews")?.value, "5")
})

test("builds criterion rows from AI scores and human ratings", () => {
  const rows = buildResearchCriterionRows([
    reviewedTrace,
    {
      ...reviewedTrace,
      trace_id: "trace_low_completeness",
      automated_evaluation: {
        ...reviewedTrace.automated_evaluation,
        criteria: {
          ...reviewedTrace.automated_evaluation.criteria,
          completeness: {
            score: 5,
            label: "complete",
            explanation: "Complete.",
          },
        },
      },
      human_reviews: [
        {
          ...reviewedTrace.human_reviews[0],
          criteria: {
            ...reviewedTrace.human_reviews[0].criteria,
            completeness: 2,
          },
        },
      ],
    },
  ])

  const completeness = rows.find((row) => row.criterion === "completeness")
  assert.equal(completeness?.aiAverage, 4.5)
  // Only the selected problem is counted. A high legacy value is not presented
  // as a positive signal because the current reviewer form cannot collect one.
  assert.equal(completeness?.humanProblemSignals, 1)
  assert.equal("humanPositiveSignals" in (completeness || {}), false)
  assert.equal(completeness?.reviewsTotal, 2)
})

const agreementFixture = [
  {
    ...baseTrace,
    trace_id: "trace_style_direct",
    citizen_question: { ...baseTrace.citizen_question, style_label: "direct" },
    human_reviews: [
      { ...baseTrace.human_reviews[0], final_decision: "accept", reviewer_id: "P01" },
      { ...baseTrace.human_reviews[0], final_decision: "accept", reviewer_id: "P02" },
    ],
  },
  {
    ...baseTrace,
    trace_id: "trace_style_vague_mismatch",
    citizen_question: { ...baseTrace.citizen_question, style_label: "vague" },
    human_reviews: [
      { ...baseTrace.human_reviews[0], final_decision: "needs_edit", reviewer_id: "P01" },
    ],
  },
  {
    ...baseTrace,
    trace_id: "trace_style_vague_reject",
    citizen_question: { ...baseTrace.citizen_question, style_label: "vague" },
    automated_evaluation: { ...baseTrace.automated_evaluation, final_decision: "reject" },
    human_reviews: [
      { ...baseTrace.human_reviews[0], final_decision: "reject", reviewer_id: "P01" },
    ],
  },
]

test("builds AI-human agreement stats with kappa and dominant share", () => {
  const stats = buildResearchAgreementStats(agreementFixture)
  assert.equal(stats.aiVsIndividual.n, 4)
  assert.equal(stats.aiVsIndividual.percentAgreement, 0.75)
  assert.equal(typeof stats.aiVsIndividual.kappa, "number")
  assert.equal(typeof stats.aiVsIndividual.dominantShareWarning, "boolean")
  assert.equal(stats.aiVsMajority.n, 3)
})

test("builds reviewer decision breakdown per participant", () => {
  const breakdown = buildResearchReviewerBreakdown(agreementFixture)
  const byId = Object.fromEntries(breakdown.map((row) => [row.reviewerId, row]))
  assert.equal(byId.P01.total, 3)
  assert.equal(byId.P02.total, 1)
  const p01 = Object.fromEntries(byId.P01.decisions.map((item) => [item.label, item.count]))
  assert.deepEqual(p01, { accept: 1, needs_edit: 1, reject: 1 })
})

test("builds agreement-by-style match rates", () => {
  const rows = buildResearchAgreementByStyle(agreementFixture)
  const byStyle = Object.fromEntries(rows.map((row) => [row.style, row]))
  assert.equal(byStyle.direct.matchRate, 100)
  assert.equal(byStyle.vague.comparableCases, 2)
  assert.equal(byStyle.vague.matches, 1)
  assert.equal(byStyle.vague.matchRate, 50)
})

test("counts only flagged source concerns, not the healthy default", () => {
  const count = countFlaggedSourceConcerns([
    {
      ...baseTrace,
      trace_id: "t_not_checked",
      human_reviews: [{ ...baseTrace.human_reviews[0], label: "not_checked" }],
    },
    {
      ...baseTrace,
      trace_id: "t_partly",
      human_reviews: [{ ...baseTrace.human_reviews[0], label: "partly_supported" }],
    },
    {
      ...baseTrace,
      trace_id: "t_mixed",
      human_reviews: [
        { ...baseTrace.human_reviews[0], label: "unsupported", reviewer_id: "P01" },
        { ...baseTrace.human_reviews[0], label: "supported", reviewer_id: "P02" },
      ],
    },
  ])
  // partly_supported + unsupported are flagged; not_checked and supported are not.
  assert.equal(count, 2)
})

test("builds failure modes and filters disagreement rows", () => {
  const unsupportedTrace = {
    ...reviewedTrace,
    trace_id: "trace_unsupported",
    citizen_question: {
      ...reviewedTrace.citizen_question,
      style_label: "low_german",
      target_section: "fees",
    },
    automated_evaluation: {
      ...reviewedTrace.automated_evaluation,
      unsupported_claims: ["The answer invents a fee."],
    },
    disagreement_case: {
      flag_reason: "Unsupported claim.",
      severity: "high",
      disagreement_type: "automated_human_source_support_mismatch",
    },
  }
  const rows = buildResearchDisagreementRows([unsupportedTrace])
  const modes = buildResearchFailureModes([unsupportedTrace])
  const filtered = filterResearchDisagreementRows(rows, {
    decision: "all",
    query: "wohn",
    severity: "high",
    sourceSupport: "mismatch",
    style: "low_german",
    targetSection: "fees",
    type: "automated_human_source_support_mismatch",
  })

  assert.equal(modes.find((mode) => mode.label === "Unsupported claims")?.count, 1)
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].traceId, "trace_unsupported")
})

test("shows when human reviewers accept clarification-needed cases", () => {
  const clarificationAcceptedTrace = {
    ...reviewedTrace,
    trace_id: "trace_human_accepts_clarification_needed",
    citizen_question: {
      ...reviewedTrace.citizen_question,
      requires_clarification: true,
    },
    automated_evaluation: {
      ...reviewedTrace.automated_evaluation,
      final_decision: "reject",
    },
    human_reviews: [
      {
        ...reviewedTrace.human_reviews[0],
        final_decision: "accept",
      },
    ],
  }

  const modes = buildResearchFailureModes([clarificationAcceptedTrace])

  assert.equal(
    modes.find((mode) => mode.label === "Clarification need accepted by humans")?.count,
    1,
  )
  assert.equal(
    modes.find((mode) => mode.label === "Clarification need accepted by AI")?.count,
    undefined,
  )
})

test("prioritizes cases to inspect by research risk", () => {
  const rows = buildResearchDisagreementRows([
    {
      ...reviewedTrace,
      trace_id: "trace_rejected",
      automated_evaluation: { ...reviewedTrace.automated_evaluation, final_decision: "reject" },
      human_reviews: [{ ...reviewedTrace.human_reviews[0], final_decision: "reject" }],
    },
    {
      ...reviewedTrace,
      trace_id: "trace_source_mismatch",
      automated_evaluation: {
        ...reviewedTrace.automated_evaluation,
        final_decision: "accept",
        label: "supported",
      },
      human_reviews: [
        { ...reviewedTrace.human_reviews[0], final_decision: "accept", label: "unsupported" },
      ],
    },
    {
      ...reviewedTrace,
      trace_id: "trace_human_disagreement",
      human_reviews: [
        { ...reviewedTrace.human_reviews[0], final_decision: "accept", reviewer_id: "P01" },
        { ...reviewedTrace.human_reviews[0], final_decision: "needs_edit", reviewer_id: "P02" },
      ],
    },
    {
      ...reviewedTrace,
      trace_id: "trace_ai_too_positive",
      automated_evaluation: { ...reviewedTrace.automated_evaluation, final_decision: "accept" },
      human_reviews: [
        { ...reviewedTrace.human_reviews[0], final_decision: "needs_edit", label: "supported" },
      ],
    },
  ])

  assert.deepEqual(
    rows.map((row) => [row.traceId, row.priorityLabel]),
    [
      ["trace_ai_too_positive", "AI too positive"],
      ["trace_human_disagreement", "Human disagreement"],
      ["trace_source_mismatch", "Source mismatch"],
      ["trace_rejected", "Rejected / needs edit"],
    ],
  )
})

test("builds case detail and export-ready evidence rows with reviewer context", () => {
  const detail = buildResearchCaseDetail(reviewedTrace)
  const evidenceRows = buildResearchEvidenceRows([reviewedTrace])

  assert.equal(detail.traceId, "trace_accept")
  assert.equal(detail.humanReviews[0].reviewerId, "P01")
  assert.deepEqual(detail.humanReviews[0].profileChips, [
    "background: administration",
    "public service: high",
    "LLM: medium",
    "German: high",
  ])
  assert.equal(evidenceRows[0].traceId, "trace_accept")
  assert.equal(evidenceRows[0].reviewerContext, "P01 public service=high; LLM=medium; German=high")
})
