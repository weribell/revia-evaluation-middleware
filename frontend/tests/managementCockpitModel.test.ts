import assert from "node:assert/strict"
import test from "node:test"

import { buildManagementDashboardModel } from "../src/components/management/managementDashboardModel.ts"
import { buildManagementCockpitModel } from "../src/components/management/managementCockpitModel.ts"

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

function reviewedTrace({
  automatedDecision = "accept",
  humanDecision = "accept",
  humanLabel = "supported",
  index,
}: {
  automatedDecision?: "accept" | "needs_edit" | "reject"
  humanDecision?: "accept" | "needs_edit" | "reject"
  humanLabel?: "partly_supported" | "supported" | "unsupported"
  index: number
}) {
  return {
    ...baseTrace,
    trace_id: `trace_reviewed_${index}`,
    citizen_question: {
      ...baseTrace.citizen_question,
      question_id: `q_reviewed_${index}`,
      service_id: `service_${index}`,
    },
    automated_evaluation: {
      ...baseTrace.automated_evaluation,
      final_decision: automatedDecision,
      label:
        automatedDecision === "reject"
          ? "unsupported"
          : automatedDecision === "needs_edit"
            ? "partly_supported"
            : "supported",
    },
    human_reviews: [
      {
        final_decision: humanDecision,
        label: humanLabel,
        human_score: humanDecision === "accept" ? 5 : 2,
        criteria: {},
        comment_text: "",
        suggested_correction: "",
        submitted_at: "2026-06-10T00:00:00Z",
      },
    ],
  }
}

test("builds a compact pre-review cockpit summary without readiness claims", () => {
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
        trace_id: "trace_ai_risk",
        automated_evaluation: {
          ...baseTrace.automated_evaluation,
          final_decision: "reject",
          judge_score: 2,
          label: "unsupported",
        },
      },
    ],
  })

  const cockpit = buildManagementCockpitModel(model)

  assert.equal(cockpit.phaseLabel, "Management decision")
  assert.equal(cockpit.readinessLabel, "Human review not started")
  assert.equal(cockpit.readinessPercent, 0)
  assert.equal(cockpit.headline, "Human review not started")
  assert.equal(
    cockpit.headlineDetail,
    "2 cases need a first human review before service-owner approval.",
  )
  assert.equal(cockpit.nextActionLabel, "Collect first human reviews")
  assert.equal(cockpit.nextActionDetail, "Collect 4 human reviews before a management decision.")
  assert.deepEqual(
    cockpit.kpis.map((kpi) => [kpi.id, kpi.value]),
    [
      ["review_progress", "0/2"],
      ["risk_signals", "1"],
      ["oversight_effort", "0.3 h / €15"],
      ["accepted_after_review", "Not reviewed"],
    ],
  )
  assert.deepEqual(
    cockpit.reviewCoverageSegments.map((segment) => [segment.label, segment.count]),
    [
      ["Reviewed", 0],
      ["Missing", 2],
    ],
  )
  assert.deepEqual(
    cockpit.decisionSegments.map((segment) => [segment.label, segment.count]),
    [
      ["Accepted", 0],
      ["Needs edit", 0],
      ["Rejected", 0],
      ["Needs adjudication", 0],
      ["Not reviewed", 2],
    ],
  )
  assert.deepEqual(
    cockpit.actionQueue.map((item) => [item.label, item.count]),
    [
      ["Human reviews needed", 4],
      ["AI-flagged cases", 1],
      ["Waiting for evidence", 0],
    ],
  )
})

test("explains insufficient evidence as missing second reviews", () => {
  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minimumReviewedCases: 1,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [reviewedTrace({ index: 1, humanDecision: "accept" })],
  })

  const cockpit = buildManagementCockpitModel(model)

  assert.equal(cockpit.readinessLabel, "Second review still missing")
  assert.equal(cockpit.headline, "Second review still missing")
  assert.equal(
    cockpit.headlineDetail,
    "1/1 cases have a first review, but 1 case still needs a second independent review before service-owner approval.",
  )
  assert.equal(cockpit.nextActionLabel, "Collect second reviews")
  assert.equal(
    cockpit.nextActionDetail,
    "Add 1 missing second review before the service owner makes an approval decision.",
  )
  assert.deepEqual(
    cockpit.actionQueue.map((item) => [item.label, item.count]),
    [["Second reviews needed", 1]],
  )
})

test("builds a ready management decision after sufficient clean review", () => {
  const reviewedTraces = Array.from({ length: 2 }, (_, index) => ({
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
      minimumReviewedCases: 2,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: reviewedTraces,
  })

  const cockpit = buildManagementCockpitModel(model)

  assert.equal(cockpit.phaseLabel, "Management decision")
  assert.equal(cockpit.readinessLabel, "Ready to continue with oversight")
  assert.equal(cockpit.readinessPercent, 100)
  assert.equal(cockpit.headline, "Ready to continue with oversight")
  assert.equal(
    cockpit.headlineDetail,
    "2/2 cases reviewed; the service owner can approve the next controlled step.",
  )
  assert.equal(cockpit.nextActionLabel, "Approve next controlled step")
  assert.equal(cockpit.kpis.find((kpi) => kpi.id === "accepted_after_review")?.value, "2")
  assert.deepEqual(
    cockpit.riskBars.map((bar) => [bar.label, bar.count]),
    [
      ["AI-approved issues", 0],
      ["Answers to correct", 0],
      ["Source checks", 0],
      ["Review conflicts", 0],
    ],
  )
  assert.deepEqual(
    cockpit.actionQueue.map((item) => [item.label, item.count]),
    [
      ["No team action needed", 0],
      ["Approve next controlled step", 0],
    ],
  )
})

test("summarizes reviewed runs with follow-up as team-owned work before approval", () => {
  const reviewedTraces = [
    ...Array.from({ length: 15 }, (_, index) =>
      reviewedTrace({ index, humanDecision: "accept" }),
    ),
    ...Array.from({ length: 3 }, (_, index) =>
      reviewedTrace({
        automatedDecision: "accept",
        humanDecision: "needs_edit",
        index: index + 15,
      }),
    ),
    reviewedTrace({
      automatedDecision: "needs_edit",
      humanDecision: "needs_edit",
      index: 18,
    }),
    reviewedTrace({
      automatedDecision: "accept",
      humanDecision: "reject",
      humanLabel: "unsupported",
      index: 19,
    }),
  ]

  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minimumReviewedCases: 10,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: reviewedTraces,
  })

  const cockpit = buildManagementCockpitModel(model)

  assert.equal(cockpit.phaseLabel, "Management decision")
  assert.equal(cockpit.readinessLabel, "Team follow-up needed")
  assert.equal(cockpit.readinessPercent, 0)
  assert.equal(cockpit.headline, "Open batch issues")
  assert.equal(
    cockpit.headlineDetail,
    "20/20 cases reviewed, but 5 cases need team follow-up before service owner approval.",
  )
  assert.equal(cockpit.nextActionLabel, "Document answer follow-up evidence")
  assert.equal(
    cockpit.nextActionDetail,
    "5 cases are marked needs edit or rejected. Document them as follow-up evidence, then correct, rerun, or exclude them before service owner approval.",
  )
  assert.equal(cockpit.kpis.find((kpi) => kpi.id === "review_progress")?.value, "20/20")
  assert.equal(cockpit.kpis.find((kpi) => kpi.id === "accepted_after_review")?.value, "15")
  assert.deepEqual(
    cockpit.riskBars.map((bar) => [bar.label, bar.count]),
    [
      ["AI-approved issues", 4],
      ["Answers to correct", 5],
      ["Source checks", 1],
      ["Review conflicts", 0],
    ],
  )
  assert.deepEqual(
    cockpit.actionQueue.map((item) => [item.label, item.count]),
    [
      ["AI-approved issues", 4],
      ["Answers to correct", 5],
      ["Source checks", 1],
    ],
  )
  assert.ok(
    cockpit.actionQueue.every((item) => item.label !== "Complete missing reviews"),
    "Second-review assignments should not be presented as missing reviewed cases.",
  )
})

test("asks for answer corrections after a reviewer conflict has final adjudication", () => {
  const reviewedTraces = Array.from({ length: 20 }, (_, index) =>
    reviewedTrace({ index, humanDecision: "accept" }),
  )
  reviewedTraces[0] = {
    ...reviewedTrace({ index: 0, humanDecision: "accept" }),
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
        comment_text: "",
        reviewer_id: "P02",
        suggested_correction: "",
        submitted_at: "2026-06-10T00:00:00Z",
      },
      {
        final_decision: "needs_edit",
        label: "partly_supported",
        human_score: 3,
        criteria: {},
        comment_text: "Final team decision.",
        reviewer_id: "ADJ01",
        suggested_correction: "",
        submitted_at: "2026-06-11T00:00:00Z",
      },
    ],
  }

  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minimumReviewedCases: 10,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: reviewedTraces,
  })

  const cockpit = buildManagementCockpitModel(model)

  assert.equal(cockpit.readinessLabel, "Team follow-up needed")
  assert.equal(cockpit.headline, "Open batch issues")
  assert.equal(cockpit.nextActionLabel, "Document answer follow-up evidence")
  assert.equal(
    cockpit.nextActionDetail,
    "The reviewer conflict has a final team decision. This batch should not be approved as clean; 1 needs-edit case can be documented for correction or excluded from a monitored pilot.",
  )
})

test("keeps partial review coverage ahead of conflict resolution in the management headline", () => {
  const reviewedTraces = Array.from({ length: 8 }, (_, index) =>
    reviewedTrace({ index, humanDecision: "accept" }),
  )
  const conflictTraces = Array.from({ length: 2 }, (_, index) => ({
    ...reviewedTrace({ index: index + 8, humanDecision: "accept" }),
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
    trace_id: `trace_unreviewed_${index}`,
    citizen_question: {
      ...baseTrace.citizen_question,
      question_id: `q_unreviewed_${index}`,
      service_id: `service_unreviewed_${index}`,
    },
  }))

  const model = buildManagementDashboardModel({
    assumptions: {
      availableReviewers: 2,
      hourlyRate: 50,
      minimumReviewedCases: 10,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: [...reviewedTraces, ...conflictTraces, ...unreviewedTraces],
  })

  const cockpit = buildManagementCockpitModel(model)

  assert.equal(cockpit.readinessLabel, "Review still in progress")
  assert.equal(cockpit.headline, "Review still in progress")
  assert.equal(
    cockpit.headlineDetail,
    "10/50 cases reviewed so far; 40 cases still need human review. Reviewers already disagreed on 2 reviewed cases, so those conflicts also need adjudication before service-owner approval.",
  )
  assert.equal(cockpit.nextActionLabel, "Collect remaining reviews")
  assert.equal(
    cockpit.nextActionDetail,
    "Continue human review for 40 unreviewed cases. Also resolve 2 review conflicts before service-owner approval.",
  )
})

test("summarizes reviewer disagreement as decision-blocking team work, not manager-owned adjudication", () => {
  const reviewedTraces = Array.from({ length: 20 }, (_, index) => ({
    ...reviewedTrace({ index, humanDecision: "accept" }),
    human_reviews:
      index === 0
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
              final_decision: "reject",
              label: "unsupported",
              human_score: 2,
              criteria: {},
              comment_text: "",
              suggested_correction: "",
              submitted_at: "2026-06-10T00:00:00Z",
            },
          ]
        : [
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
      minimumReviewedCases: 10,
      minutesPerReview: 5,
      reviewerMinutesPerDay: 60,
      reviewsPerCase: 2,
    },
    traces: reviewedTraces,
  })

  const cockpit = buildManagementCockpitModel(model)

  assert.equal(cockpit.readinessTone, "warning")
  assert.equal(cockpit.headline, "Reviewer conflict needs resolution")
  assert.equal(cockpit.readinessLabel, "Review conflict needs resolution")
  assert.equal(
    cockpit.headlineDetail,
    "All cases were reviewed, but reviewers disagreed on 1 case. The service owner should wait for the evaluation team to resolve it.",
  )
  assert.equal(cockpit.nextActionLabel, "Ask evaluation team to resolve review conflict")
  assert.equal(
    cockpit.nextActionDetail,
    "The service owner should not approve continuation until the review conflict has a final team decision.",
  )
  assert.deepEqual(
    cockpit.decisionSegments.map((segment) => [segment.label, segment.count]),
    [
      ["Accepted", 19],
      ["Needs edit", 0],
      ["Rejected", 0],
      ["Needs adjudication", 1],
      ["Not reviewed", 0],
    ],
  )
  assert.deepEqual(
    cockpit.actionQueue.map((item) => [item.label, item.count, item.tone]),
    [["Review conflicts", 1, "conflict"]],
  )
})
