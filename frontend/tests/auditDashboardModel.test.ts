import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAuditCaseDetail,
  buildAuditDashboardModel,
  buildAuditExportRows,
  filterAuditRows,
} from "../src/components/audit/auditDashboardModel.ts"

const completeTrace = {
  trace_id: "trace_complete",
  created_at: "2026-06-10T10:00:00Z",
  citizen_question: {
    question_id: "q_complete",
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
    prompt_version: "answer_v3",
    answer_prompt_version: "answer_v3",
  },
  automated_evaluation: {
    label: "supported",
    faithfulness_score: 1,
    relevance_score: 1,
    judge_score: 5,
    evaluation_mode: "openai_judge_v1",
    explanation: "Supported by the retrieved source.",
    final_decision: "accept",
    judge_model_name: "gpt-4.1-mini",
    judge_prompt_version: "judge_v2",
    judge_schema_version: "judge-schema-v1",
    unsupported_claims: [],
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
      comment_text: "Looks supported.",
      suggested_correction: "",
      submitted_at: "2026-06-11T10:00:00Z",
      reviewer_id: "P01",
    },
  ],
  mock_human_review: null,
  disagreement_case: null,
}

const activeRun = {
  batch_id: "batch_audit_demo",
  batch_type: "demo_run",
  created_at: "2026-06-10T09:00:00Z",
  completed_at: "2026-06-10T09:30:00Z",
  metadata: {
    answer_prompt_version: "answer_v3",
    judge_model_name: "gpt-4.1-mini",
    judge_prompt_version: "judge_v2",
    judge_schema_version: "judge-schema-v1",
    model_name: "gpt-4.1-mini",
    reviewer_plan: { status: "active" },
  },
  question_count: 3,
  status: "completed",
}

// Cases imported through the document API carry no public URL by
// construction: the source is an internal PDF. They stay reconstructable as long
// as the document is named and its verbatim extracted text is stored, so they
// must not be reported as an evidence gap.
test("accepts an imported document as source evidence when no URL exists", () => {
  const documentTrace = {
    ...completeTrace,
    trace_id: "trace_document",
    citizen_question: {
      ...completeTrace.citizen_question,
      question_id: "q_document",
      service_title: "!2022-08-04_EINSVORDREI_final.pdf",
      source_url: "",
    },
    retrieval_result: {
      ...completeTrace.retrieval_result,
      service_title: "!2022-08-04_EINSVORDREI_final.pdf",
      chunk_text: "Auszug aus dem importierten Dokument.",
      source_ref: "",
    },
  }

  const model = buildAuditDashboardModel({ activeRun, traces: [documentTrace] })
  assert.equal(model.completeness.withSourceReference, 1)
  assert.equal(model.completeness.withSourceDocument, 1)
  assert.equal(model.completeness.withSourceUrl, 0)
  assert.equal(model.completeness.withCompleteAutomatedTrace, 1)
  assert.equal(model.completeness.withCompleteDecisionEvidence, 1)
  assert.deepEqual(model.rows[0].evidenceGapLabels, [])
  assert.equal(model.rows[0].finalAuditStatus, "complete_evidence")
  assert.equal(model.rows[0].sourceKind, "document")
  assert.equal(model.rows[0].sourceReference, "!2022-08-04_EINSVORDREI_final.pdf")
  // The dossier renders sourceUrl as a link, so a file name must never land there.
  assert.equal(model.rows[0].sourceUrl, "-")

  const exportRow = buildAuditExportRows([buildAuditCaseDetail(documentTrace, activeRun)])[0]
  assert.equal(exportRow.source_reference_kind, "document")
  assert.equal(exportRow.source_reference, "!2022-08-04_EINSVORDREI_final.pdf")
  assert.equal(exportRow.source_url, "-")
})

// A document name alone proves nothing: without the stored excerpt the decision
// cannot be reconstructed, so this must stay a genuine evidence gap.
test("rejects a document name without a stored excerpt as source evidence", () => {
  const model = buildAuditDashboardModel({
    activeRun,
    traces: [
      {
        ...completeTrace,
        trace_id: "trace_document_no_text",
        citizen_question: {
          ...completeTrace.citizen_question,
          question_id: "q_document_no_text",
          service_title: "irgendein_dokument.pdf",
          source_url: "",
        },
        retrieval_result: {
          ...completeTrace.retrieval_result,
          service_title: "irgendein_dokument.pdf",
          chunk_text: "",
          source_ref: "",
        },
      },
    ],
  })

  assert.equal(model.completeness.withSourceReference, 0)
  assert.equal(model.rows[0].sourceKind, "none")
  assert.deepEqual(model.rows[0].evidenceGapLabels, ["Source reference", "Retrieved excerpt"])
})

// source_ref holds a bare file name for imported cases; treating it as a URL
// would render an unusable link in the case dossier.
test("does not treat a non-URL source_ref as an openable source URL", () => {
  const model = buildAuditDashboardModel({
    activeRun,
    traces: [
      {
        ...completeTrace,
        trace_id: "trace_filename_ref",
        citizen_question: {
          ...completeTrace.citizen_question,
          question_id: "q_filename_ref",
          service_title: "open-data-volltext.pdf",
          source_url: "",
        },
        retrieval_result: {
          ...completeTrace.retrieval_result,
          service_title: "open-data-volltext.pdf",
          source_ref: "open-data-volltext.pdf",
        },
      },
    ],
  })

  assert.equal(model.completeness.withSourceUrl, 0)
  assert.equal(model.rows[0].sourceKind, "document")
  assert.equal(model.rows[0].sourceUrl, "-")
})

test("summarizes audit completeness across source, answer, metadata, judge, review, and gaps", () => {
  const model = buildAuditDashboardModel({
    activeRun,
    traces: [
      completeTrace,
      {
        ...completeTrace,
        trace_id: "trace_missing",
        citizen_question: {
          ...completeTrace.citizen_question,
          question_id: "q_missing",
          source_url: "",
        },
        generated_answer: {
          ...completeTrace.generated_answer,
          answer_text: "",
          model_name: "",
          answer_prompt_version: "",
          prompt_version: "",
        },
        automated_evaluation: {
          ...completeTrace.automated_evaluation,
          final_decision: undefined,
          judge_model_name: "",
          judge_prompt_version: "",
        },
        retrieval_result: {
          ...completeTrace.retrieval_result,
          chunk_text: "",
          source_ref: "",
        },
        human_reviews: [],
      },
    ],
  })

  assert.equal(model.completeness.totalTraces, 2)
  assert.equal(model.completeness.withSourceUrl, 1)
  assert.equal(model.completeness.withSourceReference, 1)
  assert.equal(model.completeness.withSourceDocument, 0)
  assert.equal(model.completeness.withRetrievedExcerpt, 1)
  assert.equal(model.completeness.withGeneratedAnswer, 1)
  assert.equal(model.completeness.withModelPromptMetadata, 2)
  assert.equal(model.completeness.withAiJudgeResult, 1)
  assert.equal(model.completeness.withHumanReview, 1)
  assert.equal(model.completeness.withHumanHumanMismatch, 0)
  assert.equal(model.completeness.withMissingEvidence, 1)
  assert.deepEqual(model.runMetadata.slice(0, 4), [
    ["Batch ID", "batch_audit_demo"],
    ["Run type", "demo_run"],
    ["Created", "2026-06-10T09:00:00Z"],
    ["Completed", "2026-06-10T09:30:00Z"],
  ])
  const missingRow = model.rows.find((row) => row.traceId === "trace_missing")
  const missingDetail = model.caseDetails.find((detail) => detail.traceId === "trace_missing")
  assert.equal(missingRow?.finalAuditStatus, "missing_evidence")
  assert.deepEqual(missingRow?.evidenceGapLabels, [
    "Source reference",
    "Retrieved excerpt",
    "Generated answer",
    "Complete automated judge decision",
    "Human review",
  ])
  assert.equal(
    buildAuditExportRows([missingDetail!])[0].missing_evidence,
    "Source reference | Retrieved excerpt | Generated answer | Complete automated judge decision | Human review",
  )
})

test("separates automated trace completeness from full decision evidence before human review", () => {
  const tracesWithoutHumanReview = Array.from({ length: 5 }, (_, index) => ({
    ...completeTrace,
    trace_id: `trace_ai_only_${index}`,
    citizen_question: {
      ...completeTrace.citizen_question,
      question_id: `q_ai_only_${index}`,
    },
    human_reviews: [],
  }))

  const model = buildAuditDashboardModel({
    activeRun: { ...activeRun, question_count: 5 },
    traces: tracesWithoutHumanReview,
  })

  assert.equal(model.completeness.withCompleteAutomatedTrace, 5)
  assert.equal(model.completeness.withCompleteDecisionEvidence, 0)
  assert.equal(model.completeness.withHumanReview, 0)
  assert.equal(model.completeness.withPendingHumanReview, 5)
  assert.equal(model.completeness.withTechnicalMissingEvidence, 0)
  assert.equal(model.completeness.withMissingEvidence, 5)
  assert.deepEqual(
    model.rows.map((row) => row.evidenceGapLabels),
    [["Human review"], ["Human review"], ["Human review"], ["Human review"], ["Human review"]],
  )
  assert.deepEqual(
    model.rows.map((row) => row.finalAuditStatus),
    ["pending_review", "pending_review", "pending_review", "pending_review", "pending_review"],
  )
})

test("builds traceability rows with risk status and filters audit cases", () => {
  const unsupportedTrace = {
    ...completeTrace,
    trace_id: "trace_unsupported",
    automated_evaluation: {
      ...completeTrace.automated_evaluation,
      final_decision: "accept",
      label: "unsupported",
      unsupported_claims: ["Fee amount was not present in the source."],
    },
    human_reviews: [
      {
        ...completeTrace.human_reviews[0],
        final_decision: "reject",
        label: "not_checked",
      },
    ],
  }

  const model = buildAuditDashboardModel({
    activeRun,
    traces: [completeTrace, unsupportedTrace],
  })

  const row = model.rows.find((item) => item.traceId === "trace_unsupported")
  assert.equal(row?.unsupportedClaims, 1)
  assert.equal(row?.humanDecision, "reject")
  assert.equal(row?.hasHumanHumanMismatch, false)
  assert.equal(row?.sourceSupport, "AI: unsupported / Human: no source concern recorded")
  assert.equal(row?.missingEvidenceStatus, "complete")
  assert.equal(row?.finalAuditStatus, "risk_flagged")

  assert.deepEqual(
    filterAuditRows(model.rows, "unsupported_claims").map((item) => item.traceId),
    ["trace_unsupported"],
  )
  assert.deepEqual(
    filterAuditRows(model.rows, "rejected").map((item) => item.traceId),
    ["trace_unsupported"],
  )
  assert.deepEqual(
    filterAuditRows(model.rows, "no_source_check").map((item) => item.traceId),
    [],
  )
})

test("treats not_checked as no source concern when reviewers only flag source problems", () => {
  const noSourceConcernTrace = {
    ...completeTrace,
    trace_id: "trace_no_source_concern",
    human_reviews: [
      {
        ...completeTrace.human_reviews[0],
        final_decision: "accept",
        label: "not_checked",
      },
    ],
  }

  const model = buildAuditDashboardModel({
    activeRun,
    traces: [noSourceConcernTrace],
  })
  const row = model.rows[0]

  assert.equal(row.sourceSupport, "AI: supported / Human: no source concern recorded")
  assert.equal(row.missingEvidenceStatus, "complete")
  assert.deepEqual(row.evidenceGapLabels, [])
  assert.equal(row.finalAuditStatus, "complete_evidence")
  assert.deepEqual(filterAuditRows(model.rows, "no_source_check"), [])
})

test("surfaces human-human mismatch as an audit conflict", () => {
  const conflictTrace = {
    ...completeTrace,
    trace_id: "trace_human_conflict",
    human_reviews: [
      {
        ...completeTrace.human_reviews[0],
        final_decision: "accept",
        label: "supported",
        reviewer_id: "P01",
      },
      {
        ...completeTrace.human_reviews[0],
        final_decision: "needs_edit",
        label: "partly_supported",
        reviewer_id: "P02",
      },
    ],
  }

  const model = buildAuditDashboardModel({
    activeRun,
    traces: [completeTrace, conflictTrace],
  })
  const row = model.rows.find((item) => item.traceId === "trace_human_conflict")
  const detail = model.caseDetails.find((item) => item.traceId === "trace_human_conflict")

  assert.equal(model.completeness.withHumanHumanMismatch, 1)
  assert.equal(row?.hasHumanHumanMismatch, true)
  assert.equal(row?.finalAuditStatus, "review_conflict")
  assert.deepEqual(
    filterAuditRows(model.rows, "human_human_mismatch").map((item) => item.traceId),
    ["trace_human_conflict"],
  )
  assert.equal(detail?.hasHumanHumanMismatch, true)

  const exportRows = buildAuditExportRows([detail!])
  assert.equal(exportRows[0].human_human_mismatch, "yes")
})

test("separates adjudication review from primary human reviews in audit detail and export", () => {
  const conflictTrace = {
    ...completeTrace,
    trace_id: "trace_resolved_conflict",
    human_reviews: [
      {
        ...completeTrace.human_reviews[0],
        final_decision: "accept",
        label: "supported",
        reviewer_id: "P01",
      },
      {
        ...completeTrace.human_reviews[0],
        final_decision: "needs_edit",
        label: "partly_supported",
        reviewer_id: "P02",
      },
      {
        ...completeTrace.human_reviews[0],
        final_decision: "needs_edit",
        label: "supported",
        comment_text: "Resolved after comparing both primary reviews.",
        reviewer_id: "ADJ01",
        is_adjudication: true,
        adjudication_status: "resolved",
      },
    ],
  }

  const detail = buildAuditCaseDetail(conflictTrace, activeRun)
  assert.deepEqual(
    detail.humanReviews.map((review) => review.reviewerId),
    ["P01", "P02"],
  )
  assert.equal(detail.adjudicationReview?.reviewerId, "ADJ01")
  assert.equal(detail.adjudicationReview?.status, "resolved")
  assert.equal(detail.adjudicationReview?.decision, "needs_edit")
  assert.equal(detail.adjudicationReview?.comment, "Resolved after comparing both primary reviews.")

  const exportRows = buildAuditExportRows([detail])
  assert.equal(exportRows[0].human_decisions, "accept; needs_edit")
  assert.equal(exportRows[0].adjudication_decision, "needs_edit")
  assert.equal(exportRows[0].adjudication_status, "resolved")
  assert.equal(exportRows[0].adjudication_reviewer_id, "ADJ01")
})

test("surfaces judge rerun history and exports initial and latest judge context", () => {
  const rerunTrace = {
    ...completeTrace,
    trace_id: "trace_judge_rerun",
    automated_evaluation: {
      ...completeTrace.automated_evaluation,
      final_decision: "needs_edit",
      explanation: "Initial judge found the answer incomplete.",
      judge_model_name: "gpt-4.1-mini",
      judge_prompt_version: "openai_judge_v12",
      evaluated_at: "2026-06-10T10:01:00Z",
    },
    judge_evaluations: [
      {
        ...completeTrace.automated_evaluation,
        auto_eval_id: "auto_initial",
        evaluation_role: "baseline",
        final_decision: "needs_edit",
        explanation: "Initial judge found the answer incomplete.",
        judge_model_name: "gpt-4.1-mini",
        judge_prompt_version: "openai_judge_v12",
        evaluated_at: "2026-06-10T10:01:00Z",
      },
      {
        ...completeTrace.automated_evaluation,
        auto_eval_id: "auto_rerun",
        evaluation_role: "rerun",
        final_decision: "accept",
        explanation: "Calibrated judge accepts the answer.",
        judge_model_name: "gpt-5-mini",
        judge_prompt_version: "openai_judge_v16",
        judge_rerun_id: "judge_rerun_001",
        evaluated_at: "2026-06-12T12:00:00Z",
      },
    ],
  }

  const detail = buildAuditCaseDetail(rerunTrace, activeRun)
  const row = buildAuditDashboardModel({ activeRun, traces: [rerunTrace] }).rows[0]
  const exportRows = buildAuditExportRows([detail])

  assert.equal(detail.judgeDecision, "accept")
  assert.equal(detail.aiExplanation, "Calibrated judge accepts the answer.")
  assert.equal(detail.judgeHistory.length, 2)
  assert.equal(detail.judgeHistory[0].promptVersion, "openai_judge_v12")
  assert.equal(detail.judgeHistory[1].promptVersion, "openai_judge_v16")
  assert.equal(detail.judgeHistory[1].rerunId, "judge_rerun_001")
  assert.equal(detail.judgeDecisionChanged, true)
  assert.deepEqual(
    detail.promptModelVersions.filter(([label]) => label.startsWith("Judge")),
    [
      ["Judge model", "gpt-5-mini"],
      ["Judge prompt", "openai_judge_v16"],
      ["Judge schema", "judge-schema-v1"],
    ],
  )
  assert.deepEqual(detail.timestamps, [
    ["Trace created", "2026-06-10T10:00:00Z"],
    ["Initial AI judge", "2026-06-10T10:01:00Z"],
    ["Latest AI judge", "2026-06-12T12:00:00Z"],
    ["Latest human review", "2026-06-11T10:00:00Z"],
  ])
  assert.equal(row.judgeHistoryStatus, "decision changed")
  assert.equal(exportRows[0].ai_decision, "accept")
  assert.equal(exportRows[0].initial_ai_decision, "needs_edit")
  assert.equal(exportRows[0].latest_ai_decision, "accept")
  assert.equal(exportRows[0].judge_decision_changed, "yes")
  assert.equal(exportRows[0].judge_evaluation_count, "2")
  assert.equal(exportRows[0].initial_judge_prompt_version, "openai_judge_v12")
  assert.equal(exportRows[0].latest_judge_prompt_version, "openai_judge_v16")
  assert.equal(exportRows[0].latest_judge_rerun_id, "judge_rerun_001")
  assert.equal(exportRows[0].calibration_context, "not recorded")
})

test("builds case detail and export rows for evidence reconstruction", () => {
  const detail = buildAuditCaseDetail(completeTrace, activeRun)
  assert.equal(detail.question, "Welche Unterlagen brauche ich?")
  assert.equal(detail.sourceUrl, "https://service.example/1")
  assert.equal(detail.judgeDecision, "accept")
  assert.deepEqual(detail.auditIdentifiers, [
    ["Batch ID", "batch_audit_demo"],
    ["Trace ID", "trace_complete"],
    ["Question ID", "q_complete"],
    ["Service ID", "service_1"],
    ["Run type", "demo_run"],
  ])
  assert.deepEqual(detail.promptModelVersions.slice(0, 2), [
    ["Answer model", "gpt-4.1-mini"],
    ["Answer prompt", "answer_v3"],
  ])
  assert.deepEqual(detail.promptModelVersions.slice(2), [
    ["Judge model", "gpt-4.1-mini"],
    ["Judge prompt", "judge_v2"],
    ["Judge schema", "judge-schema-v1"],
  ])
  assert.equal(detail.humanReviews[0].reviewerId, "P01")

  const exportRows = buildAuditExportRows([detail])
  assert.equal(exportRows[0].batch_id, "batch_audit_demo")
  assert.equal(exportRows[0].run_type, "demo_run")
  assert.equal(exportRows[0].service_id, "service_1")
  assert.deepEqual(Object.keys(exportRows[0]), [
    "batch_id",
    "run_type",
    "trace_id",
    "question_id",
    "service_id",
    "service_title",
    "source_reference",
    "source_reference_kind",
    "source_url",
    "generated_answer",
    "ai_decision",
    "human_decisions",
    "source_support",
    "human_human_mismatch",
    "initial_ai_decision",
    "latest_ai_decision",
    "judge_decision_changed",
    "judge_evaluation_count",
    "initial_judge_prompt_version",
    "latest_judge_prompt_version",
    "latest_judge_rerun_id",
    "calibration_context",
    "adjudication_status",
    "adjudication_decision",
    "adjudication_reviewer_id",
    "unsupported_claims",
    "missing_evidence",
    "answer_model",
    "answer_prompt_version",
    "judge_model",
    "judge_prompt_version",
    "judge_schema_version",
  ])
  assert.equal(exportRows[0].judge_schema_version, "judge-schema-v1")
})

test("marks missing judge schema version as not recorded", () => {
  const traceWithoutSchema = {
    ...completeTrace,
    automated_evaluation: {
      ...completeTrace.automated_evaluation,
      judge_schema_version: "",
    },
  }
  const runWithoutSchema = {
    ...activeRun,
    metadata: {
      ...activeRun.metadata,
      judge_schema_version: "",
    },
  }

  const model = buildAuditDashboardModel({
    activeRun: runWithoutSchema,
    traces: [traceWithoutSchema],
  })
  const detail = model.caseDetails[0]
  const exportRows = buildAuditExportRows([detail])

  assert.deepEqual(
    model.runMetadata.find(([label]) => label === "Judge schema version"),
    ["Judge schema version", "not recorded"],
  )
  assert.deepEqual(
    detail.promptModelVersions.find(([label]) => label === "Judge schema"),
    ["Judge schema", "not recorded"],
  )
  assert.equal(exportRows[0].judge_schema_version, "not recorded")
})

test("deduplicates repeated human review comment and suggested correction", () => {
  const duplicatedText =
    "Review checklist: The answer should ask for clarification"
  const detail = buildAuditCaseDetail(
    {
      ...completeTrace,
      human_reviews: [
        {
          ...completeTrace.human_reviews[0],
          comment_text: duplicatedText,
          suggested_correction: duplicatedText,
        },
      ],
    },
    activeRun,
  )

  assert.equal(detail.humanReviews[0].comment, duplicatedText)
  assert.equal(detail.humanReviews[0].suggestedCorrection, "")
})
