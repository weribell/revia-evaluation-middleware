import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCaseRunPolicy,
  buildCalibrationPromptDiagnosis,
  buildAdjudicationReviewPayload,
  buildAdjudicationState,
  buildCalibrationSummary,
  buildCompactRunInfo,
  buildHumanJudgeComparison,
  buildIntegrationEndpointDocs,
  buildHumanReviewStatus,
  buildJudgeExplanationItems,
  buildJudgeEvaluationHistory,
  buildDiagnosticCriteriaRows,
  buildRequiredComparisonMatrixRows,
  buildRequiredComparisonRows,
  buildNextPromptVersion,
  buildPromptJudgeSettings,
  buildPromptVersionOptions,
  hydrateRunSettingsFromPromptVersions,
  buildDefaultDeveloperLabTab,
  buildRunSetupOverview,
  buildRunInputSourceSummary,
  shouldShowAnswerPromptSettings,
  shouldShowJudgePromptSettings,
  developerLabCaseDetailTab,
  developerLabTabs,
  buildReviewerPlanCreateState,
  buildReviewerLinkForBatch,
  buildReviewerPlanStatus,
  buildReviewerParticipantLinkState,
  buildResultsEmptyState,
  buildResultsBatchDetailRows,
  buildReviewerRunSelectOptions,
  buildReviewerRunSummary,
  traceHasImportedHumanLabel,
  buildRunCaseRows,
  buildCalibrationCaseRows,
  buildPipelineStatus,
  buildReviewerAssignmentPlan,
  buildReviewerBatchPlan,
  buildSelectedCaseState,
  buildStudyRunSummary,
  formatActiveRunLabel,
  buildTraceSummary,
  buildWorklistItem,
  buildWorklistItemWithTarget,
  filterWorklistItems,
  firstWorklistTraceId,
  isWorklistFilter,
  resolveWorklistFilterForBatchSelection,
  sortWorklistItems,
} from "../src/components/developer/developerLabModel.ts"
import {
  buildDeveloperSourceExcerptLabel,
  developerTr,
} from "../src/components/developer/developerTraceModel.ts"

const baseTrace = {
  trace_id: "trace_test",
  variant: "runtime_generate",
  citizen_question: {
    question_id: "q_test",
    service_id: "service_1",
    service_title: "Test service",
    source_url: "https://service.example",
    question_text: "Welche Unterlagen brauche ich?",
    target_section: "required_documents",
    style_label: "direct_clean",
    style_description: "Direct question",
    edge_case_label: "realistic_synthetic",
    intent_type: "single_intent",
    intent_count: 1,
    requires_clarification: false,
    expected_answer_behavior: "answer_requested_section",
    difficulty_label: "standard",
  },
  generated_answer: {
    answer_text: "Laut der offiziellen Quelle werden Unterlagen genannt.",
    generation_mode: "deterministic_source_excerpt",
    model_name: "no_llm_baseline",
    prompt_version: "api_baseline_v0",
  },
  automated_evaluation: {
    label: "supported",
    faithfulness_score: 1,
    relevance_score: 0.85,
    judge_score: 5,
    evaluation_mode: "rule_based_baseline",
    explanation: "Rule-based baseline.",
  },
  retrieval_result: {
    service_title: "Test service",
    section_name: "required_documents",
    chunk_text: "Unterlagen",
    source_ref: "https://service.example",
    rank: 1,
    retrieval_score: 1,
  },
  mock_human_review: null,
  disagreement_case: null,
}

test("labels source excerpts with the retrieved section", () => {
  assert.equal(buildDeveloperSourceExcerptLabel("en", "fees"), "Source excerpt · Fees")
  assert.equal(buildDeveloperSourceExcerptLabel("de", "fees"), "Quellenauszug · Gebühren")
  assert.equal(buildDeveloperSourceExcerptLabel("en", ""), "Source excerpt")
})

test("builds an integration reference with read model and export endpoints", () => {
  const endpoints = buildIntegrationEndpointDocs("http://127.0.0.1:8765/api/v1")
  const paths = endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)

  assert.deepEqual(paths, [
    "GET /health",
    "GET /integration/status",
    "POST /evaluations",
    "POST /human-reviews",
    "GET /metrics/overview",
    "GET /runs",
    "GET /runs/{batch_id}/research-summary",
    "GET /runs/{batch_id}/management-summary",
    "GET /runs/{batch_id}/audit-evidence",
    "GET /runs/{batch_id}/exports/research-cases.csv",
    "GET /runs/{batch_id}/exports/research-reviews.csv",
    "GET /runs/{batch_id}/exports/audit-evidence.csv",
    "GET /runs/{batch_id}/exports/audit-evidence.json",
  ])
  assert.ok(endpoints.every((endpoint) => endpoint.requestExample.trim()))
  assert.ok(endpoints.every((endpoint) => endpoint.responseExample.trim()))
  assert.ok(paths.every((path) => !path.includes("/traces/")))
  assert.ok(!endpoints.some((endpoint) => endpoint.title.toLowerCase().includes("smoke")))
})

test("summarizes a trace without human review as pending developer context", () => {
  const summary = buildTraceSummary(baseTrace)

  assert.equal(summary.risk.label, "Pending review")
  assert.equal(summary.alignment.label, "Human review missing")
  assert.equal(summary.likelyIssue.label, "No human signal yet")
})

test("prioritizes recorded disagreement as high-risk developer work", () => {
  const summary = buildTraceSummary({
    ...baseTrace,
    mock_human_review: {
      final_decision: "reject",
      label: "unsupported",
      human_score: 1,
      criteria: { source_support: 2 },
      comment_text: "Not supported by the source.",
      suggested_correction: "",
      submitted_at: "2026-05-24T00:00:00Z",
    },
    disagreement_case: {
      flag_reason: "Automated evaluation label differs from the human review label.",
      severity: "high",
      disagreement_type: "automated_human_label_mismatch",
      created_at: "2026-05-24T00:00:00Z",
    },
  })

  assert.equal(summary.risk.label, "High risk")
  assert.equal(summary.alignment.label, "Auto-human mismatch")
  assert.equal(summary.likelyIssue.label, "Judge calibration")
})

test("marks clarification cases as question ambiguity when the answer is accepted automatically", () => {
  const summary = buildTraceSummary({
    ...baseTrace,
    citizen_question: {
      ...baseTrace.citizen_question,
      requires_clarification: true,
      intent_type: "ambiguous",
      expected_answer_behavior: "ask_clarification",
    },
    mock_human_review: {
      final_decision: "needs_edit",
      label: "supported",
      human_score: 3,
      criteria: { clarification_need: 2 },
      comment_text: "The answer should ask for clarification.",
      suggested_correction: "",
      submitted_at: "2026-05-24T00:00:00Z",
    },
  })

  assert.equal(summary.risk.label, "Needs attention")
  assert.equal(summary.alignment.label, "Same source label")
  assert.equal(summary.likelyIssue.label, "Question ambiguity")
})

test("builds a worklist item around evaluation status instead of raw trace state", () => {
  const item = buildWorklistItem(baseTrace)

  assert.equal(item.primaryStatus, "AI evaluated")
  assert.equal(item.humanReviewCount, 0)
  assert.equal(item.humanStatus, "Human review missing")
  assert.equal(item.disagreement, false)
})

test("shows pipeline status as observed steps instead of an inferred risk label", () => {
  const status = buildPipelineStatus(baseTrace)

  assert.deepEqual(
    status.map((item) => [item.label, item.value, item.tone]),
    [
      ["AI answer", "Generated", "ready"],
      ["AI judge", "Evaluated", "ready"],
      ["Human review", "Missing", "quiet"],
      ["Disagreement", "No disagreement", "ready"],
    ],
  )
})

test("summarizes human review status and judge-human comparison for the case page", () => {
  assert.equal(buildHumanReviewStatus(baseTrace).label, "No human review")
  assert.equal(buildHumanJudgeComparison(baseTrace).label, "Waiting for human review")

  const reviewed = {
    ...baseTrace,
    mock_human_review: {
      final_decision: "accept",
      label: "supported",
      human_score: 5,
      criteria: { source_support: 5 },
      comment_text: "Looks fine.",
      suggested_correction: "",
      reviewer_confidence: "high",
      submitted_at: "2026-05-27T10:10:00+00:00",
    },
  }

  assert.deepEqual(buildHumanReviewStatus(reviewed), {
    detail: "Decision: accept",
    label: "1 human review",
  })
  assert.equal(buildHumanJudgeComparison(reviewed).label, "Judge and human source support match")
})

test("builds required AI-human comparison rows from mandatory review fields", () => {
  const rows = buildRequiredComparisonRows({
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      final_decision: "accept",
      label: "supported",
      criteria: {
        source_support: {
          score: 5,
          label: "supported",
          explanation: "The answer is grounded in the retrieved source.",
        },
        completeness: {
          score: 2,
          label: "incomplete",
          explanation: "The answer misses one important document.",
        },
      },
    },
    mock_human_review: {
      final_decision: "needs_edit",
      label: "supported",
      human_score: 3,
      criteria: { completeness: 2 },
      comment_text: "A document is missing.",
      suggested_correction: "",
      submitted_at: "2026-05-27T10:10:00+00:00",
    },
  })

  const finalDecision = rows.find((row) => row.dimensionKey === "final_decision")
  const sourceSupport = rows.find((row) => row.dimensionKey === "source_support")

  assert.equal(finalDecision?.aiResult, "accept")
  assert.equal(finalDecision?.humanResult, "needs_edit")
  assert.equal(finalDecision?.status, "mismatch")
  assert.equal(sourceSupport?.aiResult, "supported")
  assert.equal(sourceSupport?.humanResult, "supported")
  assert.equal(sourceSupport?.status, "match")
})

test("builds required comparison matrix rows for multiple human reviewers", () => {
  const rows = buildRequiredComparisonMatrixRows({
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      final_decision: "accept",
      label: "supported",
    },
    human_reviews: [
      {
        reviewer_id: "P01",
        final_decision: "accept",
        label: "supported",
        human_score: 5,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-27T10:10:00+00:00",
      },
      {
        reviewer_id: "P02",
        final_decision: "needs_edit",
        label: "supported",
        human_score: 3,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-27T10:12:00+00:00",
      },
    ],
  })

  assert.deepEqual(rows.map((row) => row.reviewerLabel), ["AI judge", "P01", "P02"])
  assert.equal(rows[1].canUse.status, "match")
  assert.equal(rows[1].canVerify.status, "match")
  assert.equal(rows[2].canUse.status, "mismatch")
  assert.equal(rows[2].canVerify.status, "match")
})

test("builds required comparison matrix rows for every judge evaluation version", () => {
  const rows = buildRequiredComparisonMatrixRows({
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      final_decision: "accept",
      label: "supported",
      judge_prompt_version: "openai_judge_v16",
    },
    judge_evaluations: [
      {
        ...baseTrace.automated_evaluation,
        final_decision: "accept",
        label: "supported",
        evaluation_role: "baseline",
        judge_prompt_version: "openai_judge_v16",
      },
      {
        ...baseTrace.automated_evaluation,
        final_decision: "needs_edit",
        label: "partly_supported",
        evaluation_role: "rerun",
        judge_prompt_version: "openai_judge_v17",
      },
    ],
    human_reviews: [
      {
        reviewer_id: "P01",
        final_decision: "needs_edit",
        label: "partly_supported",
        human_score: 3,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-27T10:10:00+00:00",
      },
    ],
  })

  assert.deepEqual(rows.map((row) => row.reviewerLabel), [
    "AI judge",
    "AI judge",
    "P01",
  ])
  assert.deepEqual(rows.map((row) => row.reviewerBadge || ""), [
    "openai_judge_v16 · baseline",
    "openai_judge_v17 · latest",
    "",
  ])
  assert.equal(rows[0].canUse.value, "accept")
  assert.equal(rows[1].canUse.value, "needs_edit")
  assert.equal(rows[1].canVerify.value, "partly_supported")
  assert.equal(rows[2].canUse.status, "match")
  assert.equal(rows[2].canVerify.status, "match")
})

test("builds diagnostic criteria evidence without treating missing optional fields as scores", () => {
  const rows = buildDiagnosticCriteriaRows({
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      criteria: {
        source_support: {
          score: 5,
          label: "supported",
          explanation: "The answer is grounded in the retrieved source.",
        },
        completeness: {
          score: 2,
          label: "incomplete",
          explanation: "The answer misses one important document.",
        },
        public_service_tone: {
          score: 5,
          label: "appropriate",
          explanation: "The tone is appropriate.",
        },
      },
    },
    mock_human_review: {
      final_decision: "needs_edit",
      label: "supported",
      human_score: 3,
      criteria: { completeness: 2 },
      comment_text: "A document is missing.",
      suggested_correction: "",
      submitted_at: "2026-05-27T10:10:00+00:00",
    },
  })

  const sourceSupport = rows.find((row) => row.criterionKey === "source_support")
  const completeness = rows.find((row) => row.criterionKey === "completeness")
  const tone = rows.find((row) => row.criterionKey === "public_service_tone")

  assert.equal(sourceSupport?.aiResult, "5 · supported")
  assert.equal(sourceSupport?.humanEvidence, "Source check: supported")
  assert.equal(sourceSupport?.status, "aligned_positive")
  assert.equal(completeness?.aiResult, "2 · incomplete")
  assert.equal(completeness?.humanEvidence, "2 · problem signal")
  assert.equal(completeness?.status, "shared_concern")
  assert.equal(tone?.humanEvidence, "No optional human signal collected")
  assert.equal(tone?.status, "no_human_signal")
})

test("shows when human clarification concern is missed by the AI uncertainty criterion", () => {
  const rows = buildDiagnosticCriteriaRows({
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      criteria: {
        uncertainty_handling: {
          score: 5,
          label: "handles_uncertainty",
          explanation: "The judge thinks uncertainty was handled.",
        },
      },
    },
    mock_human_review: {
      final_decision: "needs_edit",
      label: "supported",
      human_score: 3,
      criteria: { uncertainty_handling: 2 },
      comment_text: "The answer should ask for clarification.",
      suggested_correction: "",
      submitted_at: "2026-05-27T10:10:00+00:00",
    },
  })

  const uncertainty = rows.find((row) => row.criterionKey === "uncertainty_handling")

  assert.equal(uncertainty?.aiResult, "5 · handles_uncertainty")
  assert.equal(uncertainty?.humanEvidence, "2 · problem signal")
  assert.equal(uncertainty?.status, "human_concern_ai_missed")
})

test("shows mixed source evidence when a supported answer adds unverifiable information", () => {
  const rows = buildDiagnosticCriteriaRows({
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      criteria: {
        source_support: {
          score: 5,
          label: "supported",
          explanation: "The answer is grounded in the retrieved source.",
        },
      },
    },
    mock_human_review: {
      final_decision: "needs_edit",
      label: "supported",
      human_score: 3,
      criteria: { source_support: 2 },
      comment_text: "The answer adds a link that is not in the official source.",
      suggested_correction: "",
      submitted_at: "2026-06-01T10:10:00+00:00",
    },
  })

  const sourceSupport = rows.find((row) => row.criterionKey === "source_support")

  assert.equal(sourceSupport?.humanEvidence, "Source check: supported; Problem signal: 2 · problem signal")
  assert.equal(sourceSupport?.status, "mixed_or_partial")
})

test("shows mixed checklist evidence instead of a clean borderline score", () => {
  const rows = buildDiagnosticCriteriaRows({
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      criteria: {
        clarity_actionability: {
          score: 5,
          label: "clear",
          explanation: "The judge thinks the answer is actionable.",
        },
      },
    },
    mock_human_review: {
      final_decision: "needs_edit",
      label: "supported",
      human_score: 3,
      criteria: { clarity_actionability: 3 },
      comment_text: "Reviewer selected both easy wording and hard-to-use wording signals.",
      suggested_correction: "",
      submitted_at: "2026-06-01T10:12:00+00:00",
    },
  })

  const clarity = rows.find((row) => row.criterionKey === "clarity_actionability")

  assert.equal(clarity?.humanEvidence, "3 · mixed or borderline signal")
  assert.equal(clarity?.status, "mixed_or_partial")
})

test("detects legacy mixed clarity checklist comments saved before aggregation was fixed", () => {
  const rows = buildDiagnosticCriteriaRows({
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      criteria: {
        clarity_actionability: {
          score: 5,
          label: "clear",
          explanation: "The judge thinks the answer is actionable.",
        },
      },
    },
    mock_human_review: {
      final_decision: "needs_edit",
      label: "supported",
      human_score: 4,
      criteria: { clarity_actionability: 4 },
      comment_text:
        "Review checklist: The next step is clear; The wording is easy to understand; The answer is hard to understand",
      suggested_correction: "",
      submitted_at: "2026-06-02T10:12:00+00:00",
    },
  })

  const clarity = rows.find((row) => row.criterionKey === "clarity_actionability")

  assert.equal(clarity?.humanEvidence, "3 · mixed or borderline signal")
  assert.equal(clarity?.status, "mixed_or_partial")
})

test("maps legacy criterion keys into canonical comparison rows", () => {
  const rows = buildDiagnosticCriteriaRows({
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      criteria: {
        tone_public_service: {
          score: 5,
          label: "appropriate",
          explanation: "Legacy AI judge tone key.",
        },
        clarification_need: {
          score: 2,
          label: "should_ask_clarification",
          explanation: "Legacy AI judge clarification key.",
        },
      },
    },
    mock_human_review: {
      final_decision: "needs_edit",
      label: "supported",
      human_score: 3,
      criteria: {
        tone_public_service: 5,
        clarification_need: 2,
      },
      comment_text: "Legacy human review keys.",
      suggested_correction: "",
      submitted_at: "2026-05-27T10:10:00+00:00",
    },
  })

  const tone = rows.find((row) => row.criterionKey === "public_service_tone")
  const uncertainty = rows.find((row) => row.criterionKey === "uncertainty_handling")

  assert.equal(tone?.aiResult, "5 · appropriate")
  assert.equal(tone?.humanEvidence, "5 · positive signal")
  assert.equal(tone?.status, "aligned_positive")
  assert.equal(uncertainty?.aiResult, "2 · should_ask_clarification")
  assert.equal(uncertainty?.humanEvidence, "2 · problem signal")
  assert.equal(uncertainty?.status, "shared_concern")
})

test("shows two human reviews and human-human disagreement in comparison rows", () => {
  const trace = {
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      criteria: {
        source_support: {
          score: 5,
          label: "supported",
          explanation: "The answer is grounded in the retrieved source.",
        },
      },
    },
    human_reviews: [
      {
        reviewer_id: "P01",
        final_decision: "accept",
        label: "supported",
        human_score: 5,
        criteria: { source_support: 5 },
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-27T10:10:00+00:00",
      },
      {
        reviewer_id: "P02",
        final_decision: "reject",
        label: "unsupported",
        human_score: 1,
        criteria: { source_support: 1 },
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-27T10:12:00+00:00",
      },
    ],
  }

  const requiredSourceSupport = buildRequiredComparisonRows(trace).find(
    (row) => row.dimensionKey === "source_support",
  )
  const diagnosticSourceSupport = buildDiagnosticCriteriaRows(trace).find(
    (row) => row.criterionKey === "source_support",
  )

  assert.equal(buildHumanReviewStatus(trace).label, "2 human reviews")
  assert.equal(buildHumanJudgeComparison(trace).label, "Human-human disagreement")
  assert.equal(requiredSourceSupport?.humanResult, "P01: supported; P02: unsupported")
  assert.equal(requiredSourceSupport?.status, "human_disagreement")
  assert.equal(
    diagnosticSourceSupport?.humanEvidence,
    "P01: Source check: supported; Problem signal: 5 · positive signal; P02: Source check: unsupported; Problem signal: 1 · problem signal",
  )
  assert.deepEqual(diagnosticSourceSupport?.humanEvidenceItems, [
    {
      reviewerLabel: "P01",
      value: "Source check: supported; Problem signal: 5 · positive signal",
    },
    {
      reviewerLabel: "P02",
      value: "Source check: unsupported; Problem signal: 1 · problem signal",
    },
  ])
  assert.equal(diagnosticSourceSupport?.status, "human_disagreement")
})

test("builds compact run info for the case page", () => {
  assert.deepEqual(buildCompactRunInfo(baseTrace), [
    ["Answer model", "no_llm_baseline"],
    ["Answer prompt", "api_baseline_v0"],
    ["Latest judge", "rule_based_baseline"],
    ["Judge prompt", "-"],
    ["Judge evaluations", "1"],
  ])

  assert.deepEqual(
    buildCompactRunInfo({
      ...baseTrace,
      automated_evaluation: {
        ...baseTrace.automated_evaluation,
        judge_model_name: "gpt-5-mini",
        judge_prompt_version: "judge_v1",
      },
      judge_evaluations: [
        {
          ...baseTrace.automated_evaluation,
          judge_model_name: "gpt-5-mini",
          judge_prompt_version: "judge_v1",
        },
        {
          ...baseTrace.automated_evaluation,
          judge_model_name: "gpt-5-mini",
          judge_prompt_version: "judge_v2",
        },
      ],
    }),
    [
      ["Answer model", "no_llm_baseline"],
      ["Answer prompt", "api_baseline_v0"],
      ["Latest judge", "gpt-5-mini"],
      ["Judge prompt", "judge_v2"],
      ["Judge evaluations", "2"],
    ],
  )
})

test("builds judge evaluation history from baseline and reruns", () => {
  const baselineOnly = buildJudgeEvaluationHistory({
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      auto_eval_id: "auto_baseline",
      final_decision: "accept",
      judge_prompt_version: "judge_v1",
    },
  })

  assert.equal(baselineOnly.length, 1)
  assert.equal(baselineOnly[0].roleLabel, "Baseline judge")
  assert.equal(baselineOnly[0].promptVersion, "judge_v1")
  assert.equal(baselineOnly[0].decision, "accept")

  const withRerun = buildJudgeEvaluationHistory({
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      auto_eval_id: "auto_baseline",
      final_decision: "accept",
      judge_prompt_version: "judge_v1",
    },
    judge_evaluations: [
      {
        ...baseTrace.automated_evaluation,
        auto_eval_id: "auto_baseline",
        evaluation_role: "baseline",
        final_decision: "accept",
        judge_prompt_version: "judge_v1",
      },
      {
        ...baseTrace.automated_evaluation,
        auto_eval_id: "auto_rerun",
        evaluation_role: "rerun",
        final_decision: "needs_edit",
        judge_prompt_version: "judge_v2",
      },
    ],
  })

  assert.equal(withRerun.length, 2)
  assert.equal(withRerun[1].roleLabel, "Judge rerun")
  assert.equal(withRerun[1].promptVersion, "judge_v2")
  assert.equal(withRerun[1].decision, "needs_edit")
})

test("builds judge explanation items for every judge version", () => {
  const items = buildJudgeExplanationItems({
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      explanation: "The baseline judge accepts the answer.",
      final_decision: "accept",
      judge_model_name: "gpt-5-mini",
      judge_prompt_version: "judge_v1",
    },
    judge_evaluations: [
      {
        ...baseTrace.automated_evaluation,
        evaluation_role: "baseline",
        explanation: "The baseline judge accepts the answer.",
        final_decision: "accept",
        judge_model_name: "gpt-5-mini",
        judge_prompt_version: "judge_v1",
      },
      {
        ...baseTrace.automated_evaluation,
        evaluation_role: "rerun",
        explanation: "The rerun judge identifies a missing practical detail.",
        final_decision: "needs_edit",
        judge_model_name: "gpt-5-mini",
        judge_prompt_version: "judge_v2",
      },
    ],
  })

  assert.deepEqual(items, [
    {
      decision: "accept",
      explanation: "The baseline judge accepts the answer.",
      label: "judge_v1",
      modelName: "gpt-5-mini",
    },
    {
      decision: "needs_edit",
      explanation: "The rerun judge identifies a missing practical detail.",
      label: "judge_v2",
      modelName: "gpt-5-mini",
    },
  ])
})

test("shows every judge version in diagnostic criterion rows and interprets the latest rerun", () => {
  const rows = buildDiagnosticCriteriaRows({
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      criteria: {
        completeness: {
          score: 5,
          label: "positive",
          explanation: "The original judge accepted completeness.",
        },
      },
      judge_prompt_version: "judge_v1",
    },
    judge_evaluations: [
      {
        ...baseTrace.automated_evaluation,
        evaluation_role: "baseline",
        criteria: {
          completeness: {
            score: 5,
            label: "positive",
            explanation: "The original judge accepted completeness.",
          },
        },
        judge_prompt_version: "judge_v1",
      },
      {
        ...baseTrace.automated_evaluation,
        evaluation_role: "rerun",
        criteria: {
          completeness: {
            score: 2,
            label: "problem",
            explanation: "The rerun judge catches the missing part.",
          },
        },
        judge_prompt_version: "judge_v2",
      },
    ],
    mock_human_review: {
      final_decision: "needs_edit",
      label: "supported",
      human_score: 3,
      criteria: { completeness: 2 },
      comment_text: "A required part is missing.",
      suggested_correction: "",
      submitted_at: "2026-05-27T10:10:00+00:00",
    },
  })

  const completeness = rows.find((row) => row.criterionKey === "completeness")

  assert.equal(completeness?.aiResult, "2 · problem")
  assert.deepEqual(completeness?.aiResultItems, [
    {
      label: "judge_v1",
      value: "5 · positive",
    },
    {
      label: "judge_v2",
      value: "2 · problem",
    },
  ])
  assert.equal(completeness?.status, "shared_concern")
})

test("builds read-only prompt and judge settings for the developer lab", () => {
  const settings = buildPromptJudgeSettings({
    batch_id: "batch_test",
    batch_type: "test_run",
    status: "completed",
    question_count: 5,
    created_at: "2026-05-27T10:00:00+00:00",
    completed_at: "2026-05-27T10:00:00+00:00",
    metadata: { label: "Run 5-question test" },
  })

  assert.equal(settings.answerPrompt.version, "api_baseline_v0")
  assert.equal(settings.answerPrompt.mode, "Source excerpt baseline")
  assert.equal(settings.judgePrompt.version, "rule_judge_v0")
  assert.equal(settings.judgePrompt.mode, "Rule-based judge")
  assert.equal(settings.model.value, "no_llm_baseline")
  assert.equal(settings.rubric.criteria.length, 6)
  assert.deepEqual(settings.runMetadata, [
    ["Run", "batch_test"],
    ["Run type", "test_run"],
    ["Status", "completed"],
    ["Created", "2026-05-27T10:00:00+00:00"],
  ])
})

test("builds prompt version options with a baseline fallback", () => {
  const options = buildPromptVersionOptions(
    [
      {
        created_at: "2026-05-28T10:00:00+00:00",
        model_name: "no_llm_baseline",
        notes: "Local answer prompt.",
        prompt_text: "Use only the retrieved source.",
        prompt_type: "answer",
        prompt_version: "answer_local_v1",
      },
      {
        created_at: "2026-05-28T10:05:00+00:00",
        model_name: "rule_based_baseline",
        notes: "Local judge prompt.",
        prompt_text: "Rate all shared criteria.",
        prompt_type: "judge",
        prompt_version: "judge_local_v1",
      },
    ],
    "answer",
    {
      promptText: "Baseline answer prompt.",
      promptVersion: "api_baseline_v0",
    },
  )

  assert.deepEqual(
    options.map((option) => [option.value, option.promptText]),
    [
      ["api_baseline_v0", "Baseline answer prompt."],
      ["answer_local_v1", "Use only the retrieved source."],
    ],
  )
})

test("deduplicates saved prompt versions that use the baseline version name", () => {
  const options = buildPromptVersionOptions(
    [
      {
        created_at: "2026-05-28T10:00:00+00:00",
        model_name: "gpt-4.1-mini",
        notes: "Saved over the baseline name.",
        prompt_text: "Saved local baseline text.",
        prompt_type: "answer",
        prompt_version: "api_baseline_v0",
      },
    ],
    "answer",
    {
      promptText: "Built-in baseline text.",
      promptVersion: "api_baseline_v0",
    },
  )

  assert.deepEqual(
    options.map((option) => [option.label, option.value, option.promptText]),
    [["api_baseline_v0", "api_baseline_v0", "Saved local baseline text."]],
  )
})

test("suggests the next prompt version from prompt type and selected mode", () => {
  const prompts = [
    {
      created_at: "2026-05-29T10:00:00+00:00",
      model_name: "openai_judge_v1",
      notes: "",
      prompt_text: "Judge v8.",
      prompt_type: "judge" as const,
      prompt_version: "rule_judge_v8",
    },
    {
      created_at: "2026-05-29T10:00:00+00:00",
      model_name: "gpt-4.1-mini",
      notes: "",
      prompt_text: "Answer v2.",
      prompt_type: "answer" as const,
      prompt_version: "api_baseline_v2",
    },
  ]

  assert.equal(buildNextPromptVersion(prompts, "judge", "openai_judge_v1"), "openai_judge_v9")
  assert.equal(buildNextPromptVersion(prompts, "judge", "rule_based_baseline"), "rule_judge_v9")
  assert.equal(buildNextPromptVersion(prompts, "answer", "gpt-4.1-mini"), "openai_answer_v3")
  assert.equal(buildNextPromptVersion(prompts, "answer", "no_llm_baseline"), "baseline_answer_v3")
})

test("hydrates selected prompt text from saved prompt versions after reload", () => {
  const hydrated = hydrateRunSettingsFromPromptVersions(
    {
      answer_prompt_text: "Default answer prompt.",
      answer_prompt_version: "api_baseline_v2",
      judge_mode: "rule_based_baseline",
      judge_prompt_text: "Default judge prompt.",
      judge_prompt_version: "rule_judge_v1",
      model_name: "gpt-4.1-mini",
    },
    {
      defaults: {
        answer_prompt_text: "Default answer prompt.",
        answer_prompt_version: "api_baseline_v0",
        judge_mode: "rule_based_baseline",
        judge_prompt_text: "Default judge prompt.",
        judge_prompt_version: "rule_judge_v0",
        model_name: "gpt-4.1-mini",
      },
      items: [
        {
          created_at: "2026-05-29T10:00:00+00:00",
          model_name: "gpt-4.1-mini",
          notes: "",
          prompt_text: "Saved answer prompt v2.",
          prompt_type: "answer",
          prompt_version: "api_baseline_v2",
        },
        {
          created_at: "2026-05-29T10:00:00+00:00",
          model_name: "openai_judge_v1",
          notes: "",
          prompt_text: "Saved judge prompt v1.",
          prompt_type: "judge",
          prompt_version: "rule_judge_v1",
        },
      ],
    },
  )

  assert.equal(hydrated.answer_prompt_text, "Saved answer prompt v2.")
  assert.equal(hydrated.judge_prompt_text, "Saved judge prompt v1.")
})

test("distinguishes frozen study cases from developer experiments", () => {
  const studyPolicy = buildCaseRunPolicy({
    ...baseTrace,
    variant: "study_run_v1",
  })
  const experimentPolicy = buildCaseRunPolicy({
    ...baseTrace,
    variant: "runtime_generate",
  })

  assert.equal(studyPolicy.label, "Frozen study case")
  assert.equal(studyPolicy.canOverwrite, false)
  assert.equal(experimentPolicy.label, "Developer experiment")
  assert.equal(experimentPolicy.canOverwrite, true)
})

test("summarizes study run preparation from dataset size and cases", () => {
  const summary = buildStudyRunSummary([
    buildWorklistItem(baseTrace),
    buildWorklistItem({
      ...baseTrace,
      trace_id: "study_trace",
      variant: "study_run_v1",
    }),
  ], 54)

  assert.equal(summary.questionCount, 54)
  assert.equal(summary.caseCount, 2)
  assert.equal(summary.answerCount, 2)
  assert.equal(summary.judgeCount, 2)
  assert.equal(summary.frozenCaseCount, 1)
  assert.equal(summary.requiredHumanReviews, 108)
})

test("builds a focused run setup overview with primary progress and technical details", () => {
  const overview = buildRunSetupOverview({
    activeRun: {
      batch_id: "batch_demo",
      batch_type: "demo_run",
      status: "completed",
      question_count: 20,
      created_at: "2026-05-27T10:00:00+00:00",
      completed_at: "2026-05-27T10:01:00+00:00",
      metadata: { label: "Create 20-case demo run" },
    },
    answerPromptVersion: "api_baseline_v2",
    answerCount: 20,
    humanReviewCount: 4,
    judgeCount: 20,
    judgePromptVersion: "rule_judge_v1",
    questionCount: 54,
    modelName: "gpt-4.1-mini",
  })

  assert.equal(overview.title, "Demo run · 20 cases")
  assert.equal(overview.status, "completed")
  assert.deepEqual(overview.progressCards, [
    { label: "Generated answers", value: "20/54" },
    { label: "Judge evaluations", value: "20/54" },
    { label: "Human reviews", value: "4/54" },
  ])
  assert.deepEqual(overview.technicalDetails, [
    ["Model", "gpt-4.1-mini"],
    ["Created", "2026-05-27T10:00:00+00:00"],
    ["Run type", "demo_run"],
    ["Answer prompt", "api_baseline_v2"],
    ["Judge prompt", "rule_judge_v1"],
  ])
})

test("describes run input source behavior without nested setup tabs", () => {
  assert.deepEqual(buildRunInputSourceSummary("internal_demo"), {
    title: "Internal demo questions",
    detail: "Generate answers from the Question Bank, then run the judge.",
    actionLabel: "Choose questions from Question Bank",
  })
  assert.deepEqual(buildRunInputSourceSummary("imported_answers"), {
    title: "Imported data",
    detail: "Import provided question-answer pairs; answer generation is skipped.",
    actionLabel: "Import question-answer file",
  })
})

test("keeps answer prompt settings only for internally generated runs", () => {
  assert.equal(shouldShowAnswerPromptSettings("internal_demo"), true)
  assert.equal(shouldShowAnswerPromptSettings("imported_answers"), false)
  assert.equal(shouldShowJudgePromptSettings("internal_demo"), true)
  assert.equal(shouldShowJudgePromptSettings("imported_answers"), true)
})

test("shows saved active-run metadata instead of transient editor settings", () => {
  const overview = buildRunSetupOverview({
    activeRun: {
      batch_id: "batch_test",
      batch_type: "test_run",
      status: "completed",
      question_count: 5,
      created_at: "2026-05-29T16:05:00+00:00",
      completed_at: "2026-05-29T16:06:00+00:00",
      metadata: {
        answer_prompt_version: "api_baseline_v2",
        judge_prompt_version: "rule_judge_v1",
        model_name: "gpt-4.1-mini",
      },
    },
    answerPromptVersion: "api_baseline_v0",
    answerCount: 5,
    humanReviewCount: 0,
    judgeCount: 5,
    judgePromptVersion: "rule_judge_v0",
    questionCount: 54,
    modelName: "no_llm_baseline",
  })

  assert.deepEqual(overview.technicalDetails, [
    ["Model", "gpt-4.1-mini"],
    ["Created", "2026-05-29T16:05:00+00:00"],
    ["Run type", "test_run"],
    ["Answer prompt", "api_baseline_v2"],
    ["Judge prompt", "rule_judge_v1"],
  ])
})

test("labels the empty developer worklist as having no active run", () => {
  assert.equal(formatActiveRunLabel(null), "No active run")
  assert.equal(
    formatActiveRunLabel({
      batch_id: "batch_test",
      batch_type: "test_run",
      status: "completed",
      question_count: 5,
      created_at: "2026-05-27T10:00:00+00:00",
      completed_at: "2026-05-27T10:00:00+00:00",
      metadata: { label: "Run 5-question test" },
    }),
    "Test run · 5 cases",
  )
  assert.equal(
    formatActiveRunLabel({
      batch_id: "batch_demo",
      batch_type: "demo_run",
      status: "completed",
      question_count: 20,
      created_at: "2026-05-27T10:00:00+00:00",
      completed_at: "2026-05-27T10:00:00+00:00",
      metadata: { label: "Create 20-case demo run" },
    }),
    "Demo run · 20 cases",
  )
  assert.equal(
    formatActiveRunLabel({
      batch_id: "batch_import",
      batch_type: "external_evaluation_run",
      status: "completed",
      question_count: 3,
      created_at: "2026-05-27T10:00:00+00:00",
      completed_at: "2026-05-27T10:00:00+00:00",
      metadata: { input_source: "imported_chatbot_answers" },
    }),
    "Imported run · 3 cases",
  )
  assert.equal(
    formatActiveRunLabel({
      batch_id: "batch_import_named",
      batch_type: "external_evaluation_run",
      status: "completed",
      question_count: 12,
      created_at: "2026-08-20T13:15:00+00:00",
      completed_at: "2026-08-20T13:16:00+00:00",
      metadata: {
        import_filename: "municipal_assistant_reference_v2_12.csv",
      },
    }, "de"),
    "Importierter Lauf · municipal_assistant_reference_v2_12.csv · 12 Fälle",
  )
})

test("localizes stored judge and review categories in German case details", () => {
  assert.equal(developerTr("de", "accept"), "Akzeptiert")
  assert.equal(developerTr("de", "needs_edit"), "Überarbeitung nötig")
  assert.equal(developerTr("de", "supported"), "Belegt")
  assert.equal(developerTr("de", "partly_supported"), "Teilweise belegt")
  assert.equal(developerTr("de", "unsupported"), "Nicht belegt")
})

test("plans two reviews per question across five reviewers", () => {
  const plan = buildReviewerBatchPlan({
    questionCount: 54,
    reviewerCount: 5,
    reviewsPerQuestion: 2,
  })

  assert.equal(plan.totalAssignments, 108)
  assert.deepEqual(plan.assignmentsPerReviewer, [22, 22, 22, 21, 21])
  assert.equal(plan.summary, "5 reviewers · 108 assignments · 21-22 cases each")
})

test("keeps developer lab areas separated into workflow tabs", () => {
  assert.deepEqual(
    developerLabTabs.map((tab) => tab.id),
    ["results_cases", "run_console", "judge_calibration", "human_study_setup", "integrations", "analysis", "improvement"],
  )
  assert.equal(developerLabTabs[0].label, "Results")
  assert.equal(developerLabTabs[1].label, "Setup & Run")
  assert.equal(developerLabTabs[2].label, "Judge Calibration")
  assert.equal(developerLabTabs[3].label, "Reviewer Links")
  assert.equal(developerLabTabs[4].label, "Integrations")
  assert.equal(developerLabTabs[5].label, "Analysis")
  assert.equal(developerLabTabs[6].label, "Improvement Ideas")
  assert.equal(developerLabCaseDetailTab, "results_cases")
})

test("opens results first when an active run exists", () => {
  assert.equal(buildDefaultDeveloperLabTab(null), "run_console")
  assert.equal(
    buildDefaultDeveloperLabTab({
      batch_id: "batch_demo",
      batch_type: "demo_run",
      status: "completed",
      question_count: 20,
      created_at: "2026-05-27T10:00:00+00:00",
      completed_at: "2026-05-27T10:00:00+00:00",
      metadata: { label: "Create 20-case demo run" },
    }),
    "results_cases",
  )
})

test("honors a valid requested developer lab tab", () => {
  assert.equal(buildDefaultDeveloperLabTab(null, "human_study_setup"), "human_study_setup")
  assert.equal(
    buildDefaultDeveloperLabTab({
      batch_id: "batch_demo",
      batch_type: "demo_run",
      status: "completed",
      question_count: 20,
      created_at: "2026-05-27T10:00:00+00:00",
      completed_at: "2026-05-27T10:00:00+00:00",
      metadata: { label: "Create 20-case demo run" },
    }, "human_study_setup"),
    "human_study_setup",
  )
  assert.equal(buildDefaultDeveloperLabTab(null, "unknown"), "run_console")
})

test("creates participant links and balanced trace assignments for flexible reviewer counts", () => {
  const traces = Array.from({ length: 5 }, (_, index) => ({
    ...baseTrace,
    trace_id: `trace_${index + 1}`,
  }))

  const plan = buildReviewerAssignmentPlan({
    baseUrl: "http://localhost:5173/",
    batchId: "batch_demo",
    reviewerCount: 3,
    reviewsPerQuestion: 2,
    traces,
  })

  assert.equal(plan.totalAssignments, 10)
  assert.deepEqual(
    plan.participants.map((participant) => participant.participantId),
    ["P01", "P02", "P03"],
  )
  assert.deepEqual(
    plan.participants.map((participant) => participant.assignedTraceIds.length),
    [4, 3, 3],
  )
  assert.equal(plan.caseReviewTargets.trace_1, 2)
  assert.equal(plan.caseReviewTargets.trace_5, 2)
  assert.match(plan.participants[0].reviewUrl, /role=review_batch/)
  assert.match(plan.participants[0].reviewUrl, /participant=P01/)
  assert.match(plan.participants[0].reviewUrl, /batch_id=batch_demo/)
  assert.deepEqual(plan.profileFields, [
    "reviewer_background",
    "public_service_familiarity",
    "llm_familiarity",
    "language_confidence_de",
  ])
})

test("normalizes legacy reviewer paths and adds the selected batch id before display", () => {
  const link = buildReviewerLinkForBatch(
    "http://localhost:5173/reviewer?participant=P01",
    "batch_2026_06_02",
  )

  assert.equal(
    link,
    "http://localhost:5173/?participant=P01&role=review_batch&batch_id=batch_2026_06_02",
  )
})

test("labels reviewer plan status for the human evaluation setup", () => {
  assert.deepEqual(buildReviewerPlanStatus(null), {
    badgeLabel: "No reviewer links yet",
    canClose: false,
    isClosed: false,
  })
  assert.deepEqual(buildReviewerPlanStatus({ status: "active" }), {
    badgeLabel: "Reviewer links ready",
    canClose: true,
    isClosed: false,
  })
  assert.deepEqual(buildReviewerPlanStatus({ status: "closed" }), {
    badgeLabel: "Reviewer links closed",
    canClose: false,
    isClosed: true,
  })
})

test("keeps closed reviewer links visible but not clickable", () => {
  assert.deepEqual(
    buildReviewerParticipantLinkState(
      "http://localhost:5173/?role=review_batch&participant=P01",
      "batch_demo",
      { status: "active" },
    ),
    {
      canOpen: true,
      displayUrl: "http://localhost:5173/?role=review_batch&participant=P01&batch_id=batch_demo",
    },
  )
  assert.deepEqual(
    buildReviewerParticipantLinkState(
      "http://localhost:5173/?role=review_batch&participant=P01",
      "batch_demo",
      { status: "closed" },
    ),
    {
      canOpen: false,
      displayUrl: "http://localhost:5173/?role=review_batch&participant=P01&batch_id=batch_demo",
    },
  )
})

test("summarizes the run that reviewer links belong to", () => {
  assert.deepEqual(
    buildReviewerRunSummary({
      batch_id: "batch_533f413a6942",
      batch_type: "demo_run",
      status: "completed",
      question_count: 6,
      created_at: "2026-06-14T12:27:00+00:00",
      completed_at: "2026-06-14T12:30:00+00:00",
      metadata: {
        answer_prompt_version: "openai_answer_v4",
        judge_prompt_version: "openai_judge_v18",
        model_name: "gpt-4.1-mini",
      },
    }),
    {
      summary:
        "batch_533f413a6942 · Demo run · 14/06, 14:27 · 6 cases · #3a6942 · Answer prompt: openai_answer_v4 · Judge prompt: openai_judge_v18",
      title: "Demo run · 6 cases",
    },
  )
  assert.deepEqual(buildReviewerRunSummary(null), {
    summary: "",
    title: "No active run",
  })
})

test("builds reviewer link run selector options from saved evaluation runs", () => {
  const runs = [
    {
      batch_id: "batch_new",
      batch_type: "demo_run",
      status: "completed",
      question_count: 20,
      created_at: "2026-06-12T12:00:00+00:00",
      completed_at: "2026-06-12T12:10:00+00:00",
      metadata: { model_name: "gpt-4.1-mini" },
    },
    {
      batch_id: "batch_old",
      batch_type: "test_run",
      status: "completed",
      question_count: 5,
      created_at: "2026-06-11T09:00:00+00:00",
      completed_at: "2026-06-11T09:05:00+00:00",
      metadata: {},
    },
  ]

  assert.deepEqual(buildReviewerRunSelectOptions(runs, "batch_old", "en"), {
    disabled: false,
    emptyLabel: "No saved runs yet",
    options: [
      {
        detail: "12/06, 14:00 · Demo run · 20 cases · gpt-4.1-mini",
        label: "Demo run · 12/06, 14:00 · 20 cases · #new",
        shortId: "#new",
        title: "Demo run",
        value: "batch_new",
      },
      {
        detail: "11/06, 11:00 · Test run · 5 cases",
        label: "Test run · 11/06, 11:00 · 5 cases · #old",
        shortId: "#old",
        title: "Test run",
        value: "batch_old",
      },
    ],
    selectedBatchId: "batch_old",
  })
})

test("keeps the imported filename in saved-run selectors", () => {
  const runs = [{
    batch_id: "batch_import",
    batch_type: "external_evaluation_run",
    status: "completed",
    question_count: 12,
    created_at: "2026-08-20T13:15:00+00:00",
    completed_at: "2026-08-20T13:16:00+00:00",
    metadata: {
      import_filename: "municipal_assistant_reference_v2_12.csv",
      model_name: "gpt-5-mini",
    },
  }]

  assert.equal(
    buildReviewerRunSelectOptions(runs, "batch_import", "de").options[0].label,
    "municipal_assistant_reference_v2_12.csv · 20.08., 15:15 · 12 Fälle · #import",
  )
  assert.deepEqual(buildReviewerRunSelectOptions(runs, "batch_import", "de").options[0], {
    detail: "20.08., 15:15 · Importierter Lauf · 12 Fälle · gpt-5-mini",
    label: "municipal_assistant_reference_v2_12.csv · 20.08., 15:15 · 12 Fälle · #import",
    shortId: "#import",
    title: "municipal_assistant_reference_v2_12.csv",
    value: "batch_import",
  })
})

test("builds result batch details for the metadata tooltip", () => {
  const rows = buildResultsBatchDetailRows({
    batch_id: "batch_demo",
    batch_type: "demo_run",
    status: "completed",
    question_count: 6,
    created_at: "2026-06-14T11:39:00+00:00",
    completed_at: "2026-06-14T11:40:00+00:00",
    metadata: {
      answer_prompt_version: "openai_answer_v3",
      judge_prompt_version: "openai_judge_v18",
      model_name: "gpt-4.1-mini",
    },
  })

  assert.deepEqual(rows, [
    ["Batch ID", "batch_demo"],
    ["Created", "2026-06-14T11:39:00+00:00"],
    ["Run type", "demo_run"],
    ["Cases", "6"],
    ["Model", "gpt-4.1-mini"],
    ["Answer prompt", "openai_answer_v3"],
    ["Judge prompt", "openai_judge_v18"],
  ])
})

test("blocks creating duplicate or imported-label reviewer plans", () => {
  const baseRun = {
    batch_id: "batch_demo",
    batch_type: "demo_run",
    status: "completed",
    question_count: 2,
    created_at: "2026-06-11T12:00:00+00:00",
    completed_at: "2026-06-11T12:00:00+00:00",
    metadata: {},
  }

  assert.deepEqual(buildReviewerPlanCreateState(baseRun, null), {
    canCreate: true,
    reason: "",
  })
  assert.deepEqual(buildReviewerPlanCreateState(baseRun, { status: "active" }), {
    canCreate: false,
    reason: "Reviewer links already exist for this run.",
  })
  assert.deepEqual(
    buildReviewerPlanCreateState(
      {
        ...baseRun,
        batch_type: "external_evaluation_run",
        metadata: {
          imported_human_label_count: 2,
          input_source: "imported_chatbot_answers",
        },
      },
      null,
    ),
    {
      canCreate: false,
      reason: "This imported run already contains human labels. Normal reviewer links are disabled.",
    },
  )
  assert.deepEqual(buildReviewerPlanCreateState(baseRun, null, true), {
    canCreate: false,
    reason: "This imported run already contains human labels. Normal reviewer links are disabled.",
  })
  assert.deepEqual(
    buildReviewerPlanCreateState(
      {
        ...baseRun,
        batch_id: "batch_failed",
        metadata: {
          case_errors: [{ error: "OpenAI API request failed", question_id: "q_0001" }],
          failed_cases: 1,
        },
        question_count: 1,
        status: "failed",
      },
      null,
    ),
    {
      canCreate: false,
      reason: "This run failed before creating evaluation cases. Retry or create another run before generating reviewer links.",
    },
  )
})

test("detects imported human labels in legacy imported traces", () => {
  assert.equal(traceHasImportedHumanLabel(baseTrace), false)
  assert.equal(
    traceHasImportedHumanLabel({
      ...baseTrace,
      generated_answer: {
        ...baseTrace.generated_answer,
        generation_mode: "imported_chatbot_answer",
      },
      human_reviews: [
        {
          reviewer_id: "imported_human_label",
          reviewer_role: "imported_reference",
          final_decision: "accept",
          label: "supported",
          human_score: 4,
          criteria: {},
          comment_text: "Imported label.",
          suggested_correction: "",
          submitted_at: "2026-06-11T12:00:00+00:00",
        },
      ],
    }),
    true,
  )
})

test("keeps case selection separate from opening the detail screen", () => {
  const items = [
    buildWorklistItem(baseTrace),
    buildWorklistItem({ ...baseTrace, trace_id: "trace_second" }),
  ]

  assert.deepEqual(buildSelectedCaseState(items, ""), {
    canOpen: false,
    selectedTraceId: "",
  })
  assert.deepEqual(buildSelectedCaseState(items, "trace_second"), {
    canOpen: true,
    selectedTraceId: "trace_second",
  })
})

test("marks human-reviewed disagreements as developer attention cases", () => {
  const item = buildWorklistItem({
    ...baseTrace,
    mock_human_review: {
      final_decision: "reject",
      label: "unsupported",
      human_score: 1,
      criteria: { source_support: 2 },
      comment_text: "Not supported by the source.",
      suggested_correction: "",
      submitted_at: "2026-05-24T00:00:00Z",
    },
    disagreement_case: {
      flag_reason: "Automated evaluation label differs from the human review label.",
      severity: "high",
      disagreement_type: "automated_human_label_mismatch",
      created_at: "2026-05-24T00:00:00Z",
    },
  })

  assert.equal(item.primaryStatus, "Needs attention")
  assert.equal(item.humanReviewCount, 1)
  assert.equal(item.humanStatus, "1/2 human reviews")
  assert.equal(item.disagreement, true)
})

test("uses reviewer assignment targets when summarizing human review progress", () => {
  const item = buildWorklistItemWithTarget(
    {
      ...baseTrace,
      human_reviews: [
        {
          final_decision: "accept",
          label: "supported",
          human_score: 5,
          criteria: {},
          comment_text: "",
          suggested_correction: "",
          submitted_at: "2026-05-27T10:12:00+00:00",
        },
      ],
    },
    1,
  )
  const [row] = buildRunCaseRows([item], { [item.trace.trace_id]: 1 })

  assert.equal(item.humanStatus, "1/1 human reviews")
  assert.equal(row.humanStatus, "1/1 reviews")
})

test("uses imported human labels as their own target when no reviewer plan exists", () => {
  const item = buildWorklistItemWithTarget({
    ...baseTrace,
    generated_answer: {
      ...baseTrace.generated_answer,
      generation_mode: "imported_chatbot_answer",
    },
    human_reviews: [
      {
        reviewer_id: "agency_reference",
        reviewer_role: "imported_reference",
        final_decision: "accept",
        label: "supported",
        human_score: 5,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-06-10T10:12:00+00:00",
      },
    ],
  })
  const [row] = buildRunCaseRows([item])

  assert.equal(item.humanStatus, "1/1 human reviews")
  assert.equal(row.humanStatus, "1/1 reviews")
})

test("filters worklist items by review, mismatch, and human decision status", () => {
  const pending = buildWorklistItem(baseTrace)
  const disagreement = buildWorklistItem({
    ...baseTrace,
    trace_id: "trace_disagreement",
    mock_human_review: {
      final_decision: "reject",
      label: "unsupported",
      human_score: 1,
      criteria: {},
      comment_text: "",
      suggested_correction: "",
      submitted_at: "2026-05-24T00:00:00Z",
    },
    disagreement_case: {
      flag_reason: "Mismatch.",
      severity: "high",
      disagreement_type: "automated_human_label_mismatch",
      created_at: "2026-05-24T00:00:00Z",
    },
  })
  const humanDisagreement = buildWorklistItem({
    ...baseTrace,
    trace_id: "trace_human_disagreement",
    human_reviews: [
      {
        final_decision: "accept",
        label: "supported",
        human_score: 5,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-24T00:00:00Z",
      },
      {
        final_decision: "reject",
        label: "unsupported",
        human_score: 1,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-24T00:00:00Z",
      },
    ],
  })
  const sourceConcern = buildWorklistItem({
    ...baseTrace,
    trace_id: "trace_source_concern",
    mock_human_review: {
      final_decision: "needs_edit",
      label: "partly_supported",
      human_score: 3,
      criteria: {},
      comment_text: "",
      suggested_correction: "",
      submitted_at: "2026-05-24T00:00:00Z",
    },
  })
  const aiFalseAccept = buildWorklistItem({
    ...baseTrace,
    trace_id: "trace_ai_false_accept",
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      final_decision: "accept",
    },
    mock_human_review: {
      final_decision: "reject",
      label: "supported",
      human_score: 2,
      criteria: {},
      comment_text: "",
      suggested_correction: "",
      submitted_at: "2026-05-24T00:00:00Z",
    },
  })
  const items = [pending, disagreement, humanDisagreement, sourceConcern, aiFalseAccept]

  assert.deepEqual(filterWorklistItems(items, "human_missing"), [pending])
  assert.deepEqual(filterWorklistItems(items, "mismatch"), [disagreement])
  assert.deepEqual(filterWorklistItems(items, "human_disagreement"), [humanDisagreement])
  assert.deepEqual(filterWorklistItems(items, "source_concern"), [disagreement, humanDisagreement, sourceConcern])
  assert.deepEqual(filterWorklistItems(items, "ai_false_accept"), [
    disagreement,
    humanDisagreement,
    sourceConcern,
    aiFalseAccept,
  ])
  assert.deepEqual(filterWorklistItems(items, "needs_attention"), [
    disagreement,
    humanDisagreement,
    sourceConcern,
    aiFalseAccept,
  ])
  assert.deepEqual(filterWorklistItems(items, "reject"), [disagreement, humanDisagreement, aiFalseAccept])
})

test("validates developer result filter URL values", () => {
  assert.equal(isWorklistFilter("source_concern"), true)
  assert.equal(isWorklistFilter("ai_false_accept"), true)
  assert.equal(isWorklistFilter("judge_needs_edit"), true)
  assert.equal(isWorklistFilter("unknown"), false)
  assert.equal(isWorklistFilter(null), false)
})

test("filters worklist items by latest judge decision independently from human decisions", () => {
  const humanRejectJudgeAccept = buildWorklistItem({
    ...baseTrace,
    trace_id: "trace_human_reject_judge_accept",
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      final_decision: "accept",
    },
    mock_human_review: {
      final_decision: "reject",
      label: "supported",
      human_score: 2,
      criteria: {},
      comment_text: "",
      suggested_correction: "",
      submitted_at: "2026-05-24T00:00:00Z",
    },
  })
  const humanAcceptJudgeNeedsEdit = buildWorklistItem({
    ...baseTrace,
    trace_id: "trace_human_accept_judge_needs_edit",
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      final_decision: "needs_edit",
    },
    mock_human_review: {
      final_decision: "accept",
      label: "supported",
      human_score: 5,
      criteria: {},
      comment_text: "",
      suggested_correction: "",
      submitted_at: "2026-05-24T00:00:00Z",
    },
  })
  const latestJudgeReject = buildWorklistItem({
    ...baseTrace,
    trace_id: "trace_latest_judge_reject",
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      final_decision: "accept",
    },
    judge_evaluations: [
      {
        ...baseTrace.automated_evaluation,
        final_decision: "accept",
      },
      {
        ...baseTrace.automated_evaluation,
        final_decision: "reject",
      },
    ],
    mock_human_review: {
      final_decision: "accept",
      label: "supported",
      human_score: 5,
      criteria: {},
      comment_text: "",
      suggested_correction: "",
      submitted_at: "2026-05-24T00:00:00Z",
    },
  })
  const noJudge = buildWorklistItem({
    ...baseTrace,
    trace_id: "trace_no_judge",
    automated_evaluation: undefined,
  })
  const items = [humanRejectJudgeAccept, humanAcceptJudgeNeedsEdit, latestJudgeReject, noJudge]

  assert.deepEqual(filterWorklistItems(items, "reject"), [humanRejectJudgeAccept])
  assert.deepEqual(filterWorklistItems(items, "judge_accept"), [humanRejectJudgeAccept])
  assert.deepEqual(filterWorklistItems(items, "judge_needs_edit"), [humanAcceptJudgeNeedsEdit])
  assert.deepEqual(filterWorklistItems(items, "judge_reject"), [latestJudgeReject])
})

test("resets result filters when selecting a different evaluation batch", () => {
  assert.equal(
    resolveWorklistFilterForBatchSelection("human_missing", "batch_old", "batch_new"),
    "all",
  )
  assert.equal(
    resolveWorklistFilterForBatchSelection("human_missing", "batch_current", "batch_current"),
    "human_missing",
  )
})

test("sorts the results worklist while preserving stable case navigation order", () => {
  const readyReviewed = buildWorklistItem({
    ...baseTrace,
    trace_id: "ready_reviewed",
    mock_human_review: {
      final_decision: "accept",
      label: "supported",
      human_score: 5,
      criteria: { source_support: 5 },
      comment_text: "",
      suggested_correction: "",
      submitted_at: "2026-05-29T10:00:00Z",
    },
  })
  const missingHuman = buildWorklistItem({
    ...baseTrace,
    trace_id: "missing_human",
  })
  const needsAttention = buildWorklistItem({
    ...baseTrace,
    trace_id: "needs_attention",
    mock_human_review: {
      final_decision: "reject",
      label: "unsupported",
      human_score: 1,
      criteria: { source_support: 1 },
      comment_text: "",
      suggested_correction: "",
      submitted_at: "2026-05-29T10:06:00Z",
    },
    disagreement_case: {
      flag_reason: "Automated and human review differ.",
      severity: "high",
      disagreement_type: "automated_human_label_mismatch",
      created_at: "2026-05-29T10:05:00Z",
    },
  })
  const items = [readyReviewed, missingHuman, needsAttention]

  assert.deepEqual(
    sortWorklistItems(items, "attention_first").map((item) => item.trace.trace_id),
    ["needs_attention", "ready_reviewed", "missing_human"],
  )
  assert.deepEqual(
    sortWorklistItems(items, "human_missing_first").map((item) => item.trace.trace_id),
    ["missing_human", "ready_reviewed", "needs_attention"],
  )
  assert.deepEqual(
    sortWorklistItems(items, "reviewed_first").map((item) => item.trace.trace_id),
    ["ready_reviewed", "needs_attention", "missing_human"],
  )
  assert.equal(firstWorklistTraceId(sortWorklistItems(items, "human_missing_first")), "missing_human")
  assert.equal(firstWorklistTraceId([]), "")
})

test("builds run case table rows with compact status and attention reasons", () => {
  const rows = buildRunCaseRows([
    buildWorklistItem(baseTrace),
    buildWorklistItem({
      ...baseTrace,
      trace_id: "trace_reject",
      citizen_question: {
        ...baseTrace.citizen_question,
        question_text: "Kann ich das ohne Unterlagen machen?",
        service_title: "Rejected service",
      },
      mock_human_review: {
        final_decision: "reject",
        label: "unsupported",
        human_score: 1,
        criteria: { source_support: 2 },
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-24T00:00:00Z",
      },
      disagreement_case: {
        flag_reason: "Judge says supported, human says unsupported.",
        severity: "high",
        disagreement_type: "automated_human_label_mismatch",
      },
    }),
  ])

  assert.deepEqual(rows.map((row) => row.traceId), ["trace_test", "trace_reject"])
  assert.equal(rows[0].judgeStatus, "accept")
  assert.equal(rows[0].judgeChangedFrom, "")
  assert.equal(rows[0].humanStatus, "Human pending")
  assert.deepEqual(rows[0].humanDecisions, [])
  assert.equal(rows[0].attention, "Waiting for human review")
  assert.equal(rows[1].humanStatus, "1/2 reviews")
  assert.deepEqual(rows[1].humanDecisions, ["reject"])
  assert.equal(rows[1].attention, "AI-human mismatch")
  assert.equal(rows[1].attentionTone, "danger")
})

test("builds run case table rows from the latest judge and marks changed decisions", () => {
  const trace = {
    ...baseTrace,
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      final_decision: "accept",
      label: "supported",
      judge_prompt_version: "openai_judge_v16",
    },
    judge_evaluations: [
      {
        ...baseTrace.automated_evaluation,
        final_decision: "accept",
        label: "supported",
        evaluation_role: "baseline",
        judge_prompt_version: "openai_judge_v16",
      },
      {
        ...baseTrace.automated_evaluation,
        final_decision: "needs_edit",
        label: "partly_supported",
        evaluation_role: "rerun",
        judge_prompt_version: "openai_judge_v17",
      },
    ],
  }

  const [row] = buildRunCaseRows([buildWorklistItem(trace)])

  assert.equal(row.judgeStatus, "needs_edit")
  assert.equal(row.judgeChangedFrom, "accept")
})

test("summarizes judge calibration cases separately from human review work", () => {
  const acceptedBadCase = {
    ...baseTrace,
    trace_id: "cal_false_accept",
    variant: "judge_calibration",
    calibration: {
      calibration_id: "cal_src_001",
      expected_final_decision: "reject",
      expected_low_criteria: ["source_support", "factual_correctness"],
      fault_type: "unsupported_claim",
    },
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      final_decision: "accept",
      criteria: {
        source_support: {
          score: 5,
          label: "supported",
          explanation: "Judge missed the injected unsupported claim.",
        },
        factual_correctness: {
          score: 5,
          label: "likely_correct",
          explanation: "Judge missed the factual error.",
        },
      },
    },
  }
  const rejectedBadCase = {
    ...acceptedBadCase,
    trace_id: "cal_caught",
    automated_evaluation: {
      ...acceptedBadCase.automated_evaluation,
      final_decision: "reject",
      criteria: {
        source_support: {
          score: 1,
          label: "unsupported",
          explanation: "The claim is not in the source.",
        },
        factual_correctness: {
          score: 1,
          label: "not_verifiable",
          explanation: "The answer contradicts the source.",
        },
      },
    },
  }

  const rows = buildCalibrationCaseRows([acceptedBadCase, rejectedBadCase])
  const summary = buildCalibrationSummary([acceptedBadCase, rejectedBadCase])

  assert.equal(rows[0].status, "Calibration failed")
  assert.equal(rows[0].actualDecision, "accept")
  assert.equal(rows[0].faultType, "Unsupported claim")
  assert.equal(
    rows[0].failureReason,
    "Expected reject, judge returned accept; Did not meet expected scores: source_support <= 2, factual_correctness <= 2",
  )
  assert.equal(rows[1].status, "Calibration passed")
  assert.deepEqual(summary.cards, [
    { label: "Seeded cases", value: "2" },
    { label: "Calibration pass rate", value: "1/2" },
    { label: "Failed calibration cases", value: "1" },
    { label: "False accepts", value: "1" },
    { label: "False rejects", value: "0" },
  ])
})

test("allows calibration cases to use criterion-specific maximum scores", () => {
  const partialMultiIntentCase = {
    ...baseTrace,
    trace_id: "cal_partial_multi",
    variant: "judge_calibration",
    calibration: {
      calibration_id: "cal_multi_001",
      expected_final_decision: "needs_edit",
      expected_low_criteria: [],
      expected_criteria_max: {
        completeness: 3,
        uncertainty_handling: 3,
      },
      fault_type: "multi_intent_partial_answer",
    },
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      final_decision: "needs_edit",
      criteria: {
        completeness: {
          score: 3,
          label: "borderline",
          explanation: "One requested part is omitted.",
        },
        uncertainty_handling: {
          score: 4,
          label: "positive",
          explanation: "The judge did not penalize missing-context handling.",
        },
      },
    },
  }

  const [row] = buildCalibrationCaseRows([partialMultiIntentCase])

  assert.equal(row.status, "Calibration failed")
  assert.equal(row.expectedSignal, "needs_edit + completeness <= 3, uncertainty_handling <= 3")
  assert.equal(row.failureReason, "Did not meet expected scores: uncertainty_handling <= 3")
})

test("explains how a failed calibration case should guide judge prompt changes", () => {
  const strictGoodCase = {
    ...baseTrace,
    trace_id: "cal_good_strict",
    variant: "judge_calibration",
    calibration: {
      calibration_id: "cal_good_001",
      expected_final_decision: "accept",
      expected_low_criteria: [],
      fault_type: "known_good_answer",
    },
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      evaluation_mode: "openai_judge_v1",
      final_decision: "needs_edit",
      criteria: {
        completeness: {
          score: 3,
          label: "borderline",
          explanation: "The answer is concise but not exhaustive.",
        },
      },
    },
  }

  const diagnosis = buildCalibrationPromptDiagnosis(strictGoodCase)

  assert.equal(diagnosis.whatHappened, "Expected accept; judge returned needs_edit.")
  assert.match(diagnosis.likelyCause, /too strict/)
  assert.match(diagnosis.promptArea, /accept vs needs_edit/)
  assert.match(diagnosis.nextPromptChange, /Do not turn every non-exhaustive answer into needs_edit/)
})

test("flags high criterion scores with a non-accept final decision as inconsistent", () => {
  const contradictoryCase = {
    ...baseTrace,
    trace_id: "cal_high_scores_needs_edit",
    variant: "judge_calibration",
    calibration: {
      calibration_id: "cal_good_001",
      expected_final_decision: "accept",
      expected_low_criteria: [],
      fault_type: "known_good_answer",
    },
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      evaluation_mode: "openai_judge_v1",
      final_decision: "needs_edit",
      criteria: {
        clarity_actionability: { score: 4, label: "positive", explanation: "" },
        completeness: { score: 4, label: "positive", explanation: "" },
        factual_correctness: { score: 5, label: "positive", explanation: "" },
        public_service_tone: { score: 5, label: "positive", explanation: "" },
        source_support: { score: 5, label: "positive", explanation: "" },
        uncertainty_handling: { score: 5, label: "positive", explanation: "" },
      },
    },
  }

  const diagnosis = buildCalibrationPromptDiagnosis(contradictoryCase)

  assert.match(diagnosis.likelyCause, /internally inconsistent/)
  assert.match(diagnosis.nextPromptChange, /consistency rule/)
})

test("marks cases with two conflicting human reviews as needing adjudication", () => {
  const item = buildWorklistItem({
    ...baseTrace,
    human_reviews: [
      {
        reviewer_id: "P01",
        final_decision: "accept",
        label: "supported",
        human_score: 5,
        criteria: { source_support: 5 },
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-27T10:10:00+00:00",
      },
      {
        reviewer_id: "P02",
        final_decision: "reject",
        label: "unsupported",
        human_score: 1,
        criteria: { source_support: 1 },
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-27T10:12:00+00:00",
      },
    ],
  })
  const [row] = buildRunCaseRows([item])

  assert.equal(item.humanReviewCount, 2)
  assert.equal(item.humanStatus, "2/2 human reviews")
  assert.equal(row.humanStatus, "2/2 reviews")
  assert.deepEqual(row.humanDecisions, ["accept", "reject"])
  assert.equal(row.attention, "Human-human disagreement")
  assert.equal(row.attentionTone, "notice")
})

test("builds a lightweight adjudication action for unresolved human conflicts", () => {
  const trace = {
    ...baseTrace,
    human_reviews: [
      {
        reviewer_id: "P01",
        final_decision: "accept",
        label: "supported",
        human_score: 5,
        criteria: { source_support: 5 },
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-27T10:10:00+00:00",
      },
      {
        reviewer_id: "P02",
        final_decision: "reject",
        label: "supported",
        human_score: 1,
        criteria: { source_support: 5 },
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-27T10:12:00+00:00",
      },
    ],
  }

  const state = buildAdjudicationState(trace)
  const payload = buildAdjudicationReviewPayload({
    comment: "Final team decision after review.",
    decision: "needs_edit",
    trace,
  })

  assert.equal(state.needsResolution, true)
  assert.equal(state.resolved, false)
  assert.equal(payload.reviewer_id, "ADJ01")
  assert.equal(payload.is_adjudication, true)
  assert.equal(payload.adjudication_status, "resolved")
  assert.equal(payload.final_decision, "needs_edit")
  assert.equal(payload.label, "supported")
  assert.equal(payload.comment_text, "Final team decision after review.")
})

test("builds an undo payload for resolved adjudication", () => {
  const trace = {
    ...baseTrace,
    human_reviews: [
      {
        reviewer_id: "P01",
        final_decision: "accept",
        label: "supported",
        human_score: 5,
        criteria: { source_support: 5 },
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-27T10:10:00+00:00",
      },
      {
        reviewer_id: "P02",
        final_decision: "reject",
        label: "unsupported",
        human_score: 1,
        criteria: { source_support: 1 },
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-27T10:12:00+00:00",
      },
      {
        reviewer_id: "ADJ01",
        final_decision: "accept",
        label: "supported",
        human_score: 5,
        criteria: {},
        comment_text: "Resolved.",
        suggested_correction: "",
        submitted_at: "2026-05-28T10:12:00+00:00",
        is_adjudication: true,
        adjudication_status: "resolved",
      },
    ],
  }

  const state = buildAdjudicationState(trace)
  const payload = buildAdjudicationReviewPayload({
    adjudicationStatus: "reopened",
    comment: "Reopened for another team decision.",
    decision: "accept",
    trace,
  })

  assert.equal(state.needsResolution, false)
  assert.equal(state.resolved, true)
  assert.equal(state.resolution?.reviewer_id, "ADJ01")
  assert.equal(payload.reviewer_id, "ADJ01")
  assert.equal(payload.adjudication_status, "reopened")
})

test("treats legacy ADJ01 reviews as resolved adjudication state", () => {
  const trace = {
    ...baseTrace,
    human_reviews: [
      {
        reviewer_id: "P01",
        final_decision: "accept",
        label: "supported",
        human_score: 5,
        criteria: { source_support: 5 },
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-27T10:10:00+00:00",
      },
      {
        reviewer_id: "P02",
        final_decision: "needs_edit",
        label: "supported",
        human_score: 3,
        criteria: { source_support: 5 },
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-05-27T10:12:00+00:00",
      },
      {
        reviewer_id: "ADJ01",
        final_decision: "needs_edit",
        label: "partly_supported",
        human_score: 3,
        criteria: {},
        comment_text: "Final team decision recorded after reviewer disagreement.",
        suggested_correction: "",
        submitted_at: "2026-06-21T17:38:49+00:00",
      },
    ],
  }

  const state = buildAdjudicationState(trace)
  const adjudicationRow = buildRequiredComparisonMatrixRows(trace).find(
    (row) => row.reviewerLabel === "ADJ01",
  )

  assert.equal(state.needsResolution, false)
  assert.equal(state.resolved, true)
  assert.equal(state.resolution?.final_decision, "needs_edit")
  assert.equal(adjudicationRow?.canUse.value, "needs_edit")
  assert.equal(adjudicationRow?.canVerify.status, "pending")
  assert.equal(adjudicationRow?.canVerify.value, "not checked")
})

test("marks failed runs in the results batch selector", () => {
  const options = buildReviewerRunSelectOptions(
    [
      {
        batch_id: "batch_failed",
        batch_type: "demo_run",
        created_at: "2026-06-20T17:59:43+00:00",
        metadata: { model_name: "gpt-4.1-mini" },
        question_count: 1,
        status: "failed",
      },
    ],
    "batch_failed",
    "en",
  )

  assert.match(options.options[0].label, /failed/)
})

test("shows a failed batch explanation instead of the generic empty worklist copy", () => {
  const state = buildResultsEmptyState({
    activeRun: {
      batch_id: "batch_failed",
      batch_type: "demo_run",
      created_at: "2026-06-20T17:59:43+00:00",
      metadata: {
        case_errors: [
          {
            error: "OpenAI API request failed with HTTP 500: server_error",
            question_id: "q_0001",
          },
        ],
        failed_cases: 1,
      },
      question_count: 1,
      status: "failed",
    },
    itemCount: 0,
    loading: false,
  })

  assert.equal(state?.title, "Batch failed")
  assert.match(state?.description || "", /No evaluation cases were created/)
  assert.match(state?.detail || "", /OpenAI API request failed with HTTP 500/)
  assert.match(state?.detail || "", /q_0001/)
})

test("warns when a run has saved cases but also failed cases", () => {
  const state = buildResultsEmptyState({
    activeRun: {
      batch_id: "batch_partial",
      batch_type: "demo_run",
      created_at: "2026-06-20T18:01:43+00:00",
      metadata: {
        case_errors: [{ error: "OpenAI API timeout", question_id: "q_timeout" }],
        completed_cases: 5,
        failed_cases: 1,
      },
      question_count: 6,
      status: "completed_with_errors",
    },
    itemCount: 5,
    loading: false,
  })

  assert.equal(state?.title, "Run completed with errors")
  assert.match(state?.description || "", /5 of 6 cases were created/)
  assert.match(state?.detail || "", /OpenAI API timeout/)
})
