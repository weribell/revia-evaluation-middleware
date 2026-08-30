import assert from "node:assert/strict"
import test from "node:test"

import {
  buildManagementDashboardModel,
  deriveManagementAssumptionsForRun,
  estimateReviewEffort,
} from "../src/components/management/managementDashboardModel.ts"

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
    prompt_version: "openai_answer_v1",
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
  human_reviews: [],
  mock_human_review: null,
  disagreement_case: null,
}

test("estimates review staffing and cost from planning assumptions", () => {
  const estimate = estimateReviewEffort({
    availableReviewers: 2,
    cases: 12,
    hourlyRate: 50,
    minutesPerReview: 5,
    reviewerMinutesPerDay: 60,
    reviewsPerCase: 2,
  })

  assert.equal(estimate.assignments, 24)
  assert.equal(estimate.personHours, 2)
  assert.equal(estimate.cost, 100)
  assert.equal(estimate.calendarDays, 1)
  assert.equal(estimate.reviewersNeededForOneDay, 2)
})

test("derives management assumptions from the selected run reviewer assignment plan", () => {
  const assumptions = deriveManagementAssumptionsForRun(
    {
      availableReviewers: 2,
      hourlyRate: 50,
      minimumReviewedCases: 10,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    {
      batch_id: "batch_one_reviewer",
      batch_type: "demo_run",
      created_at: "2026-06-21T00:00:00Z",
      metadata: {
        reviewer_plan: {
          case_review_targets: {
            trace_1: 1,
            trace_2: 1,
          },
          participants: [],
          profile_fields: [],
          reviewer_count: 1,
          reviews_per_question: 1,
          summary: "1 reviewer · 2 assignments · 2 cases each",
          total_assignments: 2,
        },
      },
      question_count: 2,
      status: "completed",
    },
  )

  assert.equal(assumptions.availableReviewers, 1)
  assert.equal(assumptions.reviewsPerCase, 1)
  assert.equal(assumptions.minimumReviewedCases, 2)
})

test("builds before-review planning scenarios without human-risk assumptions", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [
      baseTrace,
      {
        ...baseTrace,
        trace_id: "trace_ai_triage",
        automated_evaluation: {
          ...baseTrace.automated_evaluation,
          final_decision: "reject",
          judge_score: 2,
          label: "unsupported",
        },
      },
    ],
  })

  assert.equal(model.before.totalCases, 2)
  assert.equal(model.before.aiFlaggedRiskCases, 1)
  assert.equal(model.before.aiAcceptedAllCases, 1)
  assert.equal(model.before.aiFoundIssueCases, 1)
  assert.equal(model.before.unsupportedClaimsCases, 1)
  assert.equal(model.before.triageStatus, "AI triage only")
  assert.match(model.before.triageMessage, /human review is still required/i)
  assert.equal(model.before.recommendedAction.label, "Prepare AI-prioritized review")
  assert.equal(model.before.decisionSummary.status, "No readiness decision yet")
  assert.match(model.before.decisionSummary.detail, /AI triage to plan human review/i)
  assert.equal(model.before.customEstimate.assignments, 4)
  assert.equal(model.before.customEstimate.personHours, 0.3)
  assert.equal(model.before.scenarios.find((scenario) => scenario.id === "ai_triage")?.cases, 2)
  assert.equal(model.after.hasHumanReview, false)
  assert.equal(model.after.readinessStatus, "No human review yet")
})

test("summarizes recorded AI judge token usage and cost", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      judgeCostPer1kTokens: 0.01,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [
      {
        ...baseTrace,
        automated_evaluation: {
          ...baseTrace.automated_evaluation,
          usage: {
            completion_tokens: 200,
            prompt_tokens: 800,
            total_tokens: 1000,
          },
        },
      },
      {
        ...baseTrace,
        trace_id: "trace_usage_2",
        automated_evaluation: {
          ...baseTrace.automated_evaluation,
          token_usage: {
            total_tokens: 500,
          },
        },
      },
    ],
  })

  assert.equal(model.costComparison.humanReviewCost, 15)
  assert.equal(model.costComparison.judgeTokenUsage.recordedCases, 2)
  assert.equal(model.costComparison.judgeTokenUsage.totalTokens, 1500)
  assert.equal(model.costComparison.judgeTokenUsage.status, "recorded")
  assert.equal(model.costComparison.judgeTokenCost, 0.02)
})

test("uses recorded OpenAI judge cost estimate when available", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      judgeCostPer1kTokens: 99,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [
      {
        ...baseTrace,
        automated_evaluation: {
          ...baseTrace.automated_evaluation,
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
            total_tokens: 1500,
          },
          cost_estimate: {
            currency: "USD",
            estimated_cost_usd: 0.003,
            pricing_checked_at: "2026-06-20",
            pricing_source: "https://platform.openai.com/docs/pricing",
            status: "estimated",
          },
        },
      },
    ],
  })

  assert.equal(model.costComparison.judgeTokenCost, 0.003)
  assert.equal(model.costComparison.judgeCostCurrency, "USD")
  assert.equal(model.costComparison.judgeCostSource, "trace_estimate")
})

test("marks AI judge token usage as missing when traces do not record it", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [baseTrace],
  })

  assert.equal(model.costComparison.judgeTokenUsage.recordedCases, 0)
  assert.equal(model.costComparison.judgeTokenUsage.status, "not_recorded")
  assert.equal(model.costComparison.judgeTokenCost, null)
})

test("excludes controlled-question research signals from the management model", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [
      {
        ...baseTrace,
        citizen_question: {
          ...baseTrace.citizen_question,
          requires_clarification: true,
          style_label: "controlled_clarification_case",
        },
      },
    ],
  })

  assert.equal("clarificationNeededCases" in model.before, false)
  assert.equal("riskByQuestionType" in model.after, false)
})

test("builds after-review readiness from observed human review signals", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [
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
            submitted_at: "2026-06-10T00:00:00Z",
          },
        ],
      },
      {
        ...baseTrace,
        trace_id: "trace_mismatch",
        automated_evaluation: {
          ...baseTrace.automated_evaluation,
          final_decision: "accept",
        },
        human_reviews: [
          {
            final_decision: "reject",
            label: "unsupported",
            human_score: 1,
            criteria: {},
            comment_text: "Source issue.",
            suggested_correction: "",
            submitted_at: "2026-06-10T00:00:00Z",
          },
        ],
      },
    ],
  })

  assert.equal(model.after.hasHumanReview, true)
  assert.equal(model.after.reviewedCases, 2)
  assert.equal(model.after.pendingCases, 0)
  assert.equal(model.after.rejectedCases, 1)
  assert.equal(model.after.sourceConcernCases, 1)
  assert.equal(model.after.aiHumanMismatchCases, 1)
  assert.equal(model.after.aiJudgeReliability.comparableCases, 2)
  assert.equal(model.after.aiJudgeReliability.matches, 1)
  assert.equal(model.after.aiJudgeReliability.falseAcceptCases, 1)
  assert.equal(model.after.aiJudgeReliability.matchRate, 0.5)
  assert.equal(model.after.aiJudgeReliability.verdict.tone, "danger")
  assert.equal(model.after.unresolvedActionCases, 1)
  assert.equal(model.after.decisionSummary.status, "Needs follow-up")
  assert.match(model.after.decisionSummary.detail, /actionable human review issues/i)
  assert.equal(model.after.readinessStatus, "Needs follow-up")
  assert.match(model.after.readinessReason, /actionable human review issues/i)
  assert.equal(model.after.recommendedAction.label, "Resolve follow-up queue")
  assert.equal(model.after.recommendedAction.tone, "warning")
  assert.equal(model.after.actionBacklog.find((item) => item.id === "fix_needs_edit_answers")?.count, 1)
  assert.equal(model.after.actionBacklog.find((item) => item.id === "complete_missing_reviews")?.count, 2)
  assert.equal(model.after.actionBacklog.find((item) => item.id === "inspect_ai_false_accepts")?.count, 1)
  assert.equal(model.after.actionBacklog.find((item) => item.id === "check_source_concerns")?.count, 1)
  assert.equal(model.after.remainingEstimate.assignments, 2)
  assert.equal(model.after.remainingEstimate.cases, 2)
  assert.equal(model.after.remainingEstimate.personHours, 0.2)
  assert.equal(model.after.pilotChecklist.find((item) => item.id === "human_review_collected")?.passed, true)
  assert.equal(model.after.pilotChecklist.find((item) => item.id === "follow_up_clear")?.passed, false)
  assert.equal(model.after.auditEvidence.label, "Audit evidence available")
  assert.equal(model.after.monitoringSummary.label, "Monitoring not ready yet")
})

test("keeps pre-review AI acceptance from becoming a readiness claim", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [baseTrace],
  })

  assert.equal(model.before.aiFlaggedRiskCases, 0)
  assert.equal(model.before.triageMessage, "No major AI triage signals, but human review is still required for trust assessment.")
  assert.equal(model.before.recommendedAction.label, "Plan minimum human review")
  assert.equal(model.after.recommendedAction.label, "Collect missing reviews")
  assert.equal(model.after.readinessStatus, "No human review yet")
  assert.equal(model.after.aiJudgeReliability.comparableCases, 0)
  assert.equal(model.after.aiJudgeReliability.matchRate, 0)
  assert.equal(model.after.aiJudgeReliability.verdict.tone, "quiet")
})

test("marks reviewed runs with too little evidence as insufficient", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [
      {
        ...baseTrace,
        human_reviews: [
          {
            final_decision: "accept",
            label: "not_checked",
            human_score: 5,
            criteria: {},
            comment_text: "",
            suggested_correction: "",
            submitted_at: "2026-06-10T00:00:00Z",
          },
        ],
      },
    ],
  })

  assert.equal(model.after.readinessStatus, "Insufficient evidence")
  assert.equal(model.after.recommendedAction.label, "Strengthen review evidence")
  assert.equal(model.after.casesNeedingSecondReview, 1)
})

test("uses a configurable minimum reviewed case threshold for pilot evidence", () => {
  const traces = Array.from({ length: 6 }, (_, index) => ({
    ...baseTrace,
    trace_id: `trace_threshold_${index}`,
    citizen_question: {
      ...baseTrace.citizen_question,
      question_id: `q_threshold_${index}`,
    },
    human_reviews:
      index < 4
        ? [
            {
              final_decision: "accept",
              label: "supported",
              human_score: 5,
              criteria: {},
              comment_text: "",
              suggested_correction: "",
              submitted_at: "2026-06-10T00:00:00Z",
            },
            {
              final_decision: "accept",
              label: "supported",
              human_score: 5,
              criteria: {},
              comment_text: "",
              suggested_correction: "",
              submitted_at: "2026-06-10T00:00:00Z",
            },
          ]
        : [],
  }))

  const defaultThresholdModel = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces,
  })
  const configuredThresholdModel = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minimumReviewedCases: 4,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces,
  })

  assert.equal(defaultThresholdModel.after.readinessStatus, "Insufficient evidence")
  assert.equal(
    defaultThresholdModel.after.pilotChecklist.find((item) => item.id === "minimum_coverage")?.detail,
    "4/6 minimum reviewed cases",
  )
  assert.equal(configuredThresholdModel.after.readinessStatus, "Ready for monitored pilot")
  assert.equal(
    configuredThresholdModel.after.pilotChecklist.find((item) => item.id === "minimum_coverage")?.detail,
    "4/4 minimum reviewed cases",
  )
})

test("does not require positive source-check labels when reviewers only flag source concerns", () => {
  const traces = Array.from({ length: 5 }, (_, index) => ({
    ...baseTrace,
    trace_id: `trace_no_source_problem_${index}`,
    citizen_question: {
      ...baseTrace.citizen_question,
      question_id: `q_no_source_problem_${index}`,
    },
    human_reviews: [
      {
        final_decision: "accept",
        label: "not_checked",
        human_score: 5,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-06-10T00:00:00Z",
      },
    ],
  }))

  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minimumReviewedCases: 5,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 1,
    },
    traces,
  })

  assert.equal(model.after.sourceConcernCases, 0)
  assert.equal(model.after.readinessStatus, "Ready for monitored pilot")
  assert.equal(model.after.auditEvidence.label, "Audit evidence available")
  assert.equal(model.after.pilotChecklist.find((item) => item.id === "source_concerns")?.passed, true)
})

test("marks human disagreement as adjudication work", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [
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
            submitted_at: "2026-06-10T00:00:00Z",
          },
          {
            final_decision: "reject",
            label: "unsupported",
            human_score: 1,
            criteria: {},
            comment_text: "Conflict.",
            suggested_correction: "",
            submitted_at: "2026-06-10T00:00:00Z",
          },
        ],
      },
    ],
  })

  assert.equal(model.after.readinessStatus, "Needs adjudication")
  assert.equal(model.after.recommendedAction.label, "Assign adjudication")
  assert.equal(model.after.humanDisagreementCases, 1)
  assert.equal(model.after.unresolvedDecisionCases, 1)
  assert.equal(model.after.actionBacklog.find((item) => item.id === "resolve_human_disagreement")?.count, 1)
})

test("keeps incomplete review coverage ahead of adjudication readiness", () => {
  const reviewedTraces = Array.from({ length: 8 }, (_, index) => ({
    ...baseTrace,
    trace_id: `trace_partial_reviewed_${index}`,
    citizen_question: {
      ...baseTrace.citizen_question,
      question_id: `q_partial_reviewed_${index}`,
    },
    human_reviews: [
      {
        final_decision: "accept",
        label: "supported",
        human_score: 5,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-06-10T00:00:00Z",
      },
    ],
  }))
  const conflictTraces = Array.from({ length: 2 }, (_, index) => ({
    ...baseTrace,
    trace_id: `trace_partial_conflict_${index}`,
    citizen_question: {
      ...baseTrace.citizen_question,
      question_id: `q_partial_conflict_${index}`,
    },
    human_reviews: [
      {
        final_decision: "accept",
        label: "supported",
        human_score: 5,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-06-10T00:00:00Z",
      },
      {
        final_decision: "reject",
        label: "supported",
        human_score: 2,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-06-10T00:00:00Z",
      },
    ],
  }))
  const unreviewedTraces = Array.from({ length: 40 }, (_, index) => ({
    ...baseTrace,
    trace_id: `trace_partial_unreviewed_${index}`,
    citizen_question: {
      ...baseTrace.citizen_question,
      question_id: `q_partial_unreviewed_${index}`,
    },
  }))

  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minimumReviewedCases: 50,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [...reviewedTraces, ...conflictTraces, ...unreviewedTraces],
  })

  assert.equal(model.after.reviewedCases, 10)
  assert.equal(model.after.pendingCases, 40)
  assert.equal(model.after.humanDisagreementCases, 2)
  assert.equal(model.after.readinessStatus, "Insufficient evidence")
  assert.equal(model.after.actionBacklog.find((item) => item.id === "resolve_human_disagreement")?.count, 2)
})

test("treats resolved adjudication as the final human decision in management readiness", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minimumReviewedCases: 1,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [
      {
        ...baseTrace,
        human_reviews: [
          {
            final_decision: "accept",
            label: "supported",
            human_score: 5,
            criteria: {},
            comment_text: "",
            reviewer_id: "P01",
            suggested_correction: "",
            submitted_at: "2026-06-10T00:00:00Z",
          },
          {
            final_decision: "reject",
            label: "unsupported",
            human_score: 1,
            criteria: {},
            comment_text: "Primary reviewers disagreed.",
            reviewer_id: "P02",
            suggested_correction: "",
            submitted_at: "2026-06-10T00:00:00Z",
          },
          {
            adjudication_status: "resolved",
            final_decision: "accept",
            human_score: 5,
            is_adjudication: true,
            label: "supported",
            criteria: {},
            comment_text: "Final team decision after adjudication.",
            reviewer_id: "ADJ01",
            suggested_correction: "",
            submitted_at: "2026-06-11T00:00:00Z",
          },
        ],
      },
    ],
  })

  assert.equal(model.after.humanDisagreementCases, 0)
  assert.equal(model.after.unresolvedDecisionCases, 0)
  assert.equal(model.after.acceptedCases, 1)
  assert.equal(model.after.readinessStatus, "Ready for monitored pilot")
  assert.equal(model.after.actionBacklog.find((item) => item.id === "resolve_human_disagreement")?.count, 0)
})

test("treats legacy ADJ01 rows as resolved adjudication evidence", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [
      {
        ...baseTrace,
        human_reviews: [
          {
            final_decision: "accept",
            label: "supported",
            human_score: 5,
            criteria: {},
            comment_text: "",
            reviewer_id: "P01",
            suggested_correction: "",
            submitted_at: "2026-06-10T00:00:00Z",
          },
          {
            final_decision: "needs_edit",
            label: "supported",
            human_score: 3,
            criteria: {},
            comment_text: "Primary reviewers disagreed.",
            reviewer_id: "P02",
            suggested_correction: "",
            submitted_at: "2026-06-10T00:00:00Z",
          },
          {
            final_decision: "needs_edit",
            human_score: 3,
            label: "partly_supported",
            criteria: {},
            comment_text: "Legacy final team decision.",
            reviewer_id: "ADJ01",
            suggested_correction: "",
            submitted_at: "2026-06-11T00:00:00Z",
          },
        ],
      },
    ],
  })

  assert.equal(model.after.humanDisagreementCases, 0)
  assert.equal(model.after.unresolvedDecisionCases, 0)
  assert.equal(model.after.needsEditCases, 1)
  assert.equal(model.after.actionBacklog.find((item) => item.id === "resolve_human_disagreement")?.count, 0)
})

test("marks sufficiently reviewed clean runs as ready for monitored pilot", () => {
  const traces = Array.from({ length: 10 }, (_, index) => ({
    ...baseTrace,
    trace_id: `trace_ready_${index}`,
    citizen_question: {
      ...baseTrace.citizen_question,
      question_id: `q_ready_${index}`,
    },
    human_reviews: [
      {
        final_decision: "accept",
        label: "supported",
        human_score: 5,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-06-10T00:00:00Z",
      },
      {
        final_decision: "accept",
        label: "supported",
        human_score: 5,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-06-10T00:00:00Z",
      },
    ],
  }))

  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces,
  })

  assert.equal(model.after.readinessStatus, "Ready for monitored pilot")
  assert.equal(model.after.recommendedAction.label, "Prepare monitored pilot")
  assert.equal(model.after.reviewCoveragePercent, 100)
  assert.equal(model.after.pilotChecklist.every((item) => item.passed), true)
  assert.equal(model.after.auditEvidence.label, "Audit evidence available")
  assert.equal(model.after.monitoringSummary.label, "Monitoring required after launch")
  assert.equal(model.after.aiJudgeReliability.comparableCases, 10)
  assert.equal(model.after.aiJudgeReliability.matches, 10)
  assert.equal(model.after.aiJudgeReliability.matchRate, 1)
  assert.equal(model.after.aiJudgeReliability.falseAcceptCases, 0)
  assert.equal(model.after.aiJudgeReliability.verdict.tone, "ready")
})

test("excludes a split 1-vs-1 case from AI-judge agreement and reports it", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [
      {
        ...baseTrace,
        human_reviews: [
          {
            final_decision: "accept",
            label: "supported",
            human_score: 5,
            criteria: {},
            comment_text: "",
            reviewer_id: "P01",
            suggested_correction: "",
            submitted_at: "2026-06-10T00:00:00Z",
          },
          {
            final_decision: "reject",
            label: "unsupported",
            human_score: 1,
            criteria: {},
            comment_text: "Split with no majority.",
            reviewer_id: "P02",
            suggested_correction: "",
            submitted_at: "2026-06-10T00:00:00Z",
          },
        ],
      },
    ],
  })

  assert.equal(model.after.aiJudgeReliability.excludedSplitCases, 1)
  assert.equal(model.after.aiJudgeReliability.comparableCases, 0)
  assert.equal(model.after.aiJudgeReliability.matches, 0)
  assert.equal(model.after.aiJudgeReliability.verdict.tone, "warning")
  assert.match(
    model.after.aiJudgeReliability.verdict.detail,
    /Agreement cannot be computed yet — reviewer decisions are split and await adjudication\./,
  )
})

test("counts a resolved split case as comparable with the adjudicated decision", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minimumReviewedCases: 1,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [
      {
        ...baseTrace,
        human_reviews: [
          {
            final_decision: "accept",
            label: "supported",
            human_score: 5,
            criteria: {},
            comment_text: "",
            reviewer_id: "P01",
            suggested_correction: "",
            submitted_at: "2026-06-10T00:00:00Z",
          },
          {
            final_decision: "reject",
            label: "unsupported",
            human_score: 1,
            criteria: {},
            comment_text: "Split with no majority.",
            reviewer_id: "P02",
            suggested_correction: "",
            submitted_at: "2026-06-10T00:00:00Z",
          },
          {
            adjudication_status: "resolved",
            final_decision: "accept",
            label: "supported",
            human_score: 5,
            is_adjudication: true,
            criteria: {},
            comment_text: "Final team decision after adjudication.",
            reviewer_id: "ADJ01",
            suggested_correction: "",
            submitted_at: "2026-06-11T00:00:00Z",
          },
        ],
      },
    ],
  })

  assert.equal(model.after.aiJudgeReliability.excludedSplitCases, 0)
  assert.equal(model.after.aiJudgeReliability.comparableCases, 1)
  assert.equal(model.after.aiJudgeReliability.matches, 1)
})

test("counts a 2-vs-1 split with the human majority, not as excluded", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minimumReviewedCases: 1,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 3,
    },
    traces: [
      {
        ...baseTrace,
        human_reviews: [
          {
            final_decision: "accept",
            label: "supported",
            human_score: 5,
            criteria: {},
            comment_text: "",
            reviewer_id: "P01",
            suggested_correction: "",
            submitted_at: "2026-06-10T00:00:00Z",
          },
          {
            final_decision: "accept",
            label: "supported",
            human_score: 5,
            criteria: {},
            comment_text: "",
            reviewer_id: "P02",
            suggested_correction: "",
            submitted_at: "2026-06-10T00:00:00Z",
          },
          {
            final_decision: "reject",
            label: "unsupported",
            human_score: 1,
            criteria: {},
            comment_text: "Outvoted.",
            reviewer_id: "P03",
            suggested_correction: "",
            submitted_at: "2026-06-10T00:00:00Z",
          },
        ],
      },
    ],
  })

  assert.equal(model.after.aiJudgeReliability.excludedSplitCases, 0)
  assert.equal(model.after.aiJudgeReliability.comparableCases, 1)
  assert.equal(model.after.aiJudgeReliability.matches, 1)
})
