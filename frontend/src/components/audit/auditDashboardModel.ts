import type { DeveloperRun, EvaluationTrace, HumanReview, JudgeEvaluation, ReviewDecision } from "@/types"
import {
  allHumanReviews,
  hasHumanReviewDisagreement,
  humanReviews,
} from "../shared/evaluationTraceModel.ts"

export type AuditFilter =
  | "all"
  | "missing_source_reference"
  | "missing_metadata"
  | "unsupported_claims"
  | "rejected"
  | "needs_edit"
  | "ai_human_mismatch"
  | "human_human_mismatch"
  | "no_human_review"
  | "no_source_check"

export type SourceReferenceKind = "url" | "document" | "none"

export type AuditCompletenessSummary = {
  totalTraces: number
  withCompleteAutomatedTrace: number
  withCompleteDecisionEvidence: number
  withAiJudgeResult: number
  withGeneratedAnswer: number
  withHumanReview: number
  withHumanHumanMismatch: number
  withMissingEvidence: number
  withModelPromptMetadata: number
  withPendingHumanReview: number
  withRetrievedExcerpt: number
  withSourceDocument: number
  withSourceReference: number
  withSourceUrl: number
  withTechnicalMissingEvidence: number
}

export type AuditFinalStatus =
  | "complete_evidence"
  | "missing_evidence"
  | "pending_review"
  | "review_conflict"
  | "risk_flagged"

export type AuditTraceabilityRow = {
  aiDecision: string
  evidenceGapLabels: string[]
  finalAuditStatus: AuditFinalStatus
  hasHumanHumanMismatch: boolean
  humanDecision: string
  judgeHistoryStatus: "decision changed" | "no rerun" | "rerun"
  missingEvidenceKeys: string[]
  missingEvidenceStatus: string
  questionId: string
  serviceTitle: string
  sourceKind: SourceReferenceKind
  sourceReference: string
  sourceSupport: string
  sourceUrl: string
  traceId: string
  unsupportedClaims: number
}

export type AuditCaseDetail = {
  adjudicationReview?: {
    comment: string
    decision: string
    reviewerId: string
    sourceSupport: string
    status: string
    submittedAt: string
    suggestedCorrection: string
  }
  aiExplanation: string
  answer: string
  auditIdentifiers: [string, string][]
  contradictedClaims: string[]
  evidenceGapLabels: string[]
  missingEvidenceKeys: string[]
  finalAuditStatus: AuditFinalStatus
  humanReviews: {
    comment: string
    decision: string
    excluded: boolean
    reviewerId: string
    sourceSupport: string
    submittedAt: string
    suggestedCorrection: string
  }[]
  hasHumanHumanMismatch: boolean
  judgeDecision: string
  judgeDecisionChanged: boolean
  judgeHistory: {
    decision: string
    evaluatedAt: string
    explanation: string
    id: string
    modelName: string
    promptVersion: string
    rerunId: string
    role: string
    schemaVersion: string
    sourceSupport: string
  }[]
  judgeHistoryStatus: "decision changed" | "no rerun" | "rerun"
  calibrationContext: string
  promptModelVersions: [string, string][]
  question: string
  questionId: string
  retrievedExcerpt: string
  serviceTitle: string
  sourceKind: SourceReferenceKind
  sourceReference: string
  sourceUrl: string
  timestamps: [string, string][]
  traceId: string
  unsupportedClaims: string[]
}

export type AuditExportRow = {
  batch_id: string
  run_type: string
  trace_id: string
  question_id: string
  service_id: string
  service_title: string
  source_reference: string
  source_reference_kind: string
  source_url: string
  generated_answer: string
  ai_decision: string
  human_decisions: string
  source_support: string
  human_human_mismatch: string
  initial_ai_decision: string
  latest_ai_decision: string
  judge_decision_changed: string
  judge_evaluation_count: string
  initial_judge_prompt_version: string
  latest_judge_prompt_version: string
  latest_judge_rerun_id: string
  calibration_context: string
  adjudication_status: string
  adjudication_decision: string
  adjudication_reviewer_id: string
  unsupported_claims: string
  missing_evidence: string
  answer_model: string
  answer_prompt_version: string
  judge_model: string
  judge_prompt_version: string
  judge_schema_version: string
}

export type AuditDashboardModel = {
  caseDetails: AuditCaseDetail[]
  completeness: AuditCompletenessSummary
  rows: AuditTraceabilityRow[]
  runMetadata: [string, string][]
}

const auditFilters: AuditFilter[] = [
  "all",
  "missing_source_reference",
  "missing_metadata",
  "unsupported_claims",
  "rejected",
  "needs_edit",
  "ai_human_mismatch",
  "human_human_mismatch",
  "no_human_review",
  "no_source_check",
]

export { auditFilters }

const NOT_RECORDED = "not recorded"

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function normalizedText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function metadataValue(activeRun: DeveloperRun | null, key: string) {
  return textValue(activeRun?.metadata?.[key])
}

function serviceTitle(trace: EvaluationTrace) {
  return (
    textValue(trace.citizen_question?.service_title) ||
    textValue(trace.service_entry?.title) ||
    textValue(trace.retrieval_result?.service_title)
  )
}

// Only an actual web address may be treated as an openable source: the audit
// dossier renders this value as a link, and imported documents put a plain file
// name into source_ref. Each candidate is checked individually so a file name in
// an earlier field cannot mask a real URL in a later one.
function sourceUrl(trace: EvaluationTrace) {
  return (
    [
      trace.citizen_question?.source_url,
      trace.service_entry?.source_url,
      trace.service_entry?.url,
      trace.retrieval_result?.source_ref,
    ]
      .map(textValue)
      .find((candidate) => /^https?:\/\//i.test(candidate)) || ""
  )
}

// Audit evidence for the source can take two valid forms. Web-retrieved cases
// carry an official URL a reviewer can open. Cases imported as documents have
// no public URL by construction, but are still reconstructable when the
// document is identified by name AND its verbatim extracted text is stored in
// the trace. Both conditions are required: a file name without the retrieved
// text proves nothing.
function sourceReference(trace: EvaluationTrace): {
  kind: SourceReferenceKind
  value: string
} {
  const url = sourceUrl(trace)
  if (url) return { kind: "url", value: url }
  const documentName = serviceTitle(trace)
  if (documentName && retrievedExcerpt(trace)) {
    return { kind: "document", value: documentName }
  }
  return { kind: "none", value: "" }
}

function retrievedExcerpt(trace: EvaluationTrace) {
  return (
    textValue(trace.retrieval_result?.chunk_text) ||
    textValue(trace.citizen_question?.source_excerpt)
  )
}

function serviceId(trace: EvaluationTrace) {
  return textValue(trace.citizen_question?.service_id) || textValue(trace.service_entry?.service_id)
}

function answerText(trace: EvaluationTrace) {
  return textValue(trace.generated_answer?.answer_text)
}

function answerModel(trace: EvaluationTrace, activeRun: DeveloperRun | null) {
  return textValue(trace.generated_answer?.model_name) || metadataValue(activeRun, "model_name")
}

function answerPromptVersion(trace: EvaluationTrace, activeRun: DeveloperRun | null) {
  return (
    textValue(trace.generated_answer?.answer_prompt_version) ||
    textValue(trace.generated_answer?.prompt_version) ||
    metadataValue(activeRun, "answer_prompt_version")
  )
}

function judgeEvaluations(trace: EvaluationTrace): JudgeEvaluation[] {
  return trace.judge_evaluations?.length ? trace.judge_evaluations : [trace.automated_evaluation]
}

function initialJudgeEvaluation(trace: EvaluationTrace) {
  return judgeEvaluations(trace)[0] || trace.automated_evaluation
}

function latestJudgeEvaluation(trace: EvaluationTrace) {
  return judgeEvaluations(trace).at(-1) || trace.automated_evaluation
}

function judgeModel(trace: EvaluationTrace, activeRun: DeveloperRun | null) {
  const latest = latestJudgeEvaluation(trace)
  return (
    textValue(latest?.judge_model_name) ||
    metadataValue(activeRun, "judge_model_name") ||
    textValue(latest?.evaluation_mode)
  )
}

function judgePromptVersion(trace: EvaluationTrace, activeRun: DeveloperRun | null) {
  const latest = latestJudgeEvaluation(trace)
  return (
    textValue(latest?.judge_prompt_version) ||
    metadataValue(activeRun, "judge_prompt_version")
  )
}

function judgeSchemaVersion(trace: EvaluationTrace, activeRun: DeveloperRun | null) {
  const latest = latestJudgeEvaluation(trace)
  return (
    textValue(latest?.judge_schema_version) ||
    metadataValue(activeRun, "judge_schema_version") ||
    NOT_RECORDED
  )
}

function runJudgeSchemaVersion(activeRun: DeveloperRun | null, traces: EvaluationTrace[]) {
  return (
    metadataValue(activeRun, "judge_schema_version") ||
    traces.map((trace) => textValue(trace.automated_evaluation?.judge_schema_version)).find(Boolean) ||
    NOT_RECORDED
  )
}

function aiDecision(trace: EvaluationTrace) {
  const latest = latestJudgeEvaluation(trace)
  return textValue(latest?.final_decision) || textValue(latest?.label)
}

function hasAiJudgeResult(trace: EvaluationTrace) {
  const latest = latestJudgeEvaluation(trace)
  return Boolean(
    textValue(latest?.final_decision) &&
      (textValue(latest?.explanation) ||
        typeof latest?.judge_score === "number"),
  )
}

function hasMetadata(trace: EvaluationTrace, activeRun: DeveloperRun | null) {
  return Boolean(
    answerModel(trace, activeRun) &&
      answerPromptVersion(trace, activeRun) &&
      judgeModel(trace, activeRun) &&
      judgePromptVersion(trace, activeRun),
  )
}

function humanDecision(reviews: HumanReview[]) {
  if (!reviews.length) return "pending"
  const decisions = reviews.map((review) => review.final_decision).filter(Boolean)
  return [...new Set(decisions)].join("; ") || "pending"
}

function isAdjudicationReview(review: HumanReview) {
  return review.is_adjudication === true
}

function primaryHumanReviews(trace: EvaluationTrace) {
  return humanReviews(trace).filter((review) => !isAdjudicationReview(review))
}

// Display list for the audit trail: keeps excluded reviews visible so the
// evidence stays complete. Computations still use `primaryHumanReviews`.
function primaryHumanReviewsForDisplay(trace: EvaluationTrace) {
  return allHumanReviews(trace).filter((review) => !isAdjudicationReview(review))
}

function adjudicationReview(trace: EvaluationTrace) {
  return humanReviews(trace).findLast(isAdjudicationReview)
}

function humanSourceSupport(reviews: HumanReview[]) {
  if (!reviews.length) return "pending"
  const labels = reviews
    .map((review) => review.label === "not_checked" ? "no source concern recorded" : review.label)
    .filter(Boolean)
  return [...new Set(labels)].join("; ") || "pending"
}

function hasHumanHumanMismatch(reviews: HumanReview[]) {
  return hasHumanReviewDisagreement(reviews)
}

function unsupportedClaims(trace: EvaluationTrace) {
  return latestJudgeEvaluation(trace)?.unsupported_claims || []
}

function contradictedClaims(trace: EvaluationTrace) {
  return latestJudgeEvaluation(trace)?.contradicted_claims || []
}

function judgeHistoryItems(trace: EvaluationTrace, activeRun: DeveloperRun | null): AuditCaseDetail["judgeHistory"] {
  return judgeEvaluations(trace).map((evaluation, index) => ({
    decision: textValue(evaluation.final_decision) || textValue(evaluation.label) || "pending",
    evaluatedAt: evaluation.evaluated_at || evaluation.created_at || "-",
    explanation: textValue(evaluation.explanation) || "-",
    id: evaluation.judge_rerun_id || evaluation.auto_eval_id || `${trace.trace_id}_judge_${index + 1}`,
    modelName:
      textValue(evaluation.judge_model_name) ||
      metadataValue(activeRun, "judge_model_name") ||
      textValue(evaluation.evaluation_mode) ||
      "-",
    promptVersion:
      textValue(evaluation.judge_prompt_version) ||
      metadataValue(activeRun, "judge_prompt_version") ||
      "-",
    rerunId: textValue(evaluation.judge_rerun_id) || "-",
    role: textValue(evaluation.evaluation_role) || (index === 0 ? "baseline" : "rerun"),
    schemaVersion:
      textValue(evaluation.judge_schema_version) ||
      metadataValue(activeRun, "judge_schema_version") ||
      NOT_RECORDED,
    sourceSupport: textValue(evaluation.label) || "pending",
  }))
}

function judgeDecisionChanged(history: AuditCaseDetail["judgeHistory"]) {
  if (history.length < 2) return false
  return history[0].decision !== history.at(-1)?.decision
}

function judgeHistoryStatus(history: AuditCaseDetail["judgeHistory"]) {
  if (history.length < 2) return "no rerun"
  return judgeDecisionChanged(history) ? "decision changed" : "rerun"
}

function calibrationContext(trace: EvaluationTrace) {
  const calibration = trace.calibration
  if (!calibration) return NOT_RECORDED
  return [
    calibration.calibration_id,
    calibration.status,
    calibration.expected_final_decision ? `expected ${calibration.expected_final_decision}` : "",
  ].filter(Boolean).join(" / ") || NOT_RECORDED
}

function sourceCheckPerformed(reviews: HumanReview[]) {
  return reviews.length > 0
}

function missingEvidenceKeys(trace: EvaluationTrace, activeRun: DeveloperRun | null) {
  const reviews = primaryHumanReviews(trace)
  const missing: string[] = []
  if (sourceReference(trace).kind === "none") missing.push("source_reference")
  if (!retrievedExcerpt(trace)) missing.push("retrieved_excerpt")
  if (!answerText(trace)) missing.push("generated_answer")
  if (!hasMetadata(trace, activeRun)) missing.push("model_prompt_metadata")
  if (!hasAiJudgeResult(trace)) missing.push("ai_judge_result")
  if (!reviews.length) missing.push("human_review")
  return missing
}

function technicalMissingEvidenceKeys(trace: EvaluationTrace, activeRun: DeveloperRun | null) {
  return missingEvidenceKeys(trace, activeRun).filter((key) => key !== "human_review")
}

const evidenceGapLabels: Record<string, string> = {
  ai_judge_result: "Complete automated judge decision",
  generated_answer: "Generated answer",
  human_review: "Human review",
  model_prompt_metadata: "Prompt/model metadata",
  retrieved_excerpt: "Retrieved excerpt",
  source_reference: "Source reference",
}

// Ordered list of the six audit evidence categories, used by the case dossier
// checklist to render both present and missing fields. Order matches the
// missing-field detection in missingEvidenceKeys().
export const auditEvidenceFields: { key: string; label: string }[] = [
  { key: "source_reference", label: evidenceGapLabels.source_reference },
  { key: "retrieved_excerpt", label: evidenceGapLabels.retrieved_excerpt },
  { key: "generated_answer", label: evidenceGapLabels.generated_answer },
  { key: "model_prompt_metadata", label: evidenceGapLabels.model_prompt_metadata },
  { key: "ai_judge_result", label: evidenceGapLabels.ai_judge_result },
  { key: "human_review", label: evidenceGapLabels.human_review },
]

function evidenceGapLabel(key: string) {
  return evidenceGapLabels[key] || key
}

function missingEvidenceStatus(trace: EvaluationTrace, activeRun: DeveloperRun | null) {
  const missing = missingEvidenceKeys(trace, activeRun)
  const reviews = primaryHumanReviews(trace)
  if (!missing.length && reviews.length && !sourceCheckPerformed(reviews)) {
    return "source check not performed"
  }
  return missing.length ? missing.join(", ") : "complete"
}

function finalAuditStatus(trace: EvaluationTrace, activeRun: DeveloperRun | null): AuditFinalStatus {
  const missing = missingEvidenceKeys(trace, activeRun)
  if (missing.length && missing.every((key) => key === "human_review")) return "pending_review"
  if (missing.length) return "missing_evidence"
  const reviews = primaryHumanReviews(trace)
  if (hasHumanHumanMismatch(reviews)) return "review_conflict"
  const humanDecisions = new Set(reviews.map((review) => review.final_decision))
  const ai = aiDecision(trace)
  const hasHumanRisk = humanDecisions.has("reject") || humanDecisions.has("needs_edit")
  const hasAiHumanMismatch =
    reviews.length > 0 && Boolean(ai) && !humanDecisions.has(ai as ReviewDecision)
  if (
    unsupportedClaims(trace).length ||
    contradictedClaims(trace).length ||
    hasHumanRisk ||
    hasAiHumanMismatch ||
    !sourceCheckPerformed(reviews)
  ) {
    return "risk_flagged"
  }
  return "complete_evidence"
}

export function buildAuditTraceabilityRow(
  trace: EvaluationTrace,
  activeRun: DeveloperRun | null = null,
): AuditTraceabilityRow {
  const reviews = primaryHumanReviews(trace)
  const missing = missingEvidenceKeys(trace, activeRun)
  const latestJudge = latestJudgeEvaluation(trace)
  const history = judgeHistoryItems(trace, activeRun)
  const aiSource = textValue(latestJudge?.label) || "pending"
  const reference = sourceReference(trace)
  return {
    aiDecision: aiDecision(trace) || "pending",
    evidenceGapLabels: missing.map(evidenceGapLabel),
    finalAuditStatus: finalAuditStatus(trace, activeRun),
    hasHumanHumanMismatch: hasHumanHumanMismatch(reviews),
    humanDecision: humanDecision(reviews),
    judgeHistoryStatus: judgeHistoryStatus(history),
    missingEvidenceKeys: missing,
    missingEvidenceStatus: missingEvidenceStatus(trace, activeRun),
    questionId: trace.citizen_question?.question_id || "-",
    serviceTitle: serviceTitle(trace) || "-",
    sourceKind: reference.kind,
    sourceReference: reference.value || "-",
    sourceSupport: `AI: ${aiSource} / Human: ${humanSourceSupport(reviews)}`,
    sourceUrl: reference.kind === "url" ? reference.value : "-",
    traceId: trace.trace_id,
    unsupportedClaims: unsupportedClaims(trace).length + contradictedClaims(trace).length,
  }
}

function reviewerPlanStatus(activeRun: DeveloperRun | null) {
  const reviewerPlan = activeRun?.metadata?.reviewer_plan
  if (reviewerPlan && typeof reviewerPlan === "object" && "status" in reviewerPlan) {
    return textValue((reviewerPlan as { status?: unknown }).status) || "configured"
  }
  return "not configured"
}

export function buildRunMetadata(
  activeRun: DeveloperRun | null,
  traces: EvaluationTrace[],
): [string, string][] {
  return [
    ["Batch ID", activeRun?.batch_id || "-"],
    ["Run type", activeRun?.batch_type || "-"],
    ["Created", activeRun?.created_at || "-"],
    ["Completed", activeRun?.completed_at || "-"],
    ["Answer model", metadataValue(activeRun, "model_name") || "-"],
    ["Answer prompt version", metadataValue(activeRun, "answer_prompt_version") || "-"],
    ["Judge model", metadataValue(activeRun, "judge_model_name") || "-"],
    ["Judge prompt version", metadataValue(activeRun, "judge_prompt_version") || "-"],
    ["Judge schema version", runJudgeSchemaVersion(activeRun, traces)],
    ["Reviewer plan status", reviewerPlanStatus(activeRun)],
    ["Number of cases", String(activeRun?.question_count || traces.length)],
  ]
}

export function buildAuditCaseDetail(
  trace: EvaluationTrace,
  activeRun: DeveloperRun | null = null,
): AuditCaseDetail {
  const reviews = primaryHumanReviews(trace)
  const resolutionReview = adjudicationReview(trace)
  const questionId = trace.citizen_question?.question_id || "-"
  const resolvedServiceId = serviceId(trace) || "-"
  const missing = missingEvidenceKeys(trace, activeRun)
  const history = judgeHistoryItems(trace, activeRun)
  const initialJudge = initialJudgeEvaluation(trace)
  const latestJudge = latestJudgeEvaluation(trace)
  const reference = sourceReference(trace)
  return {
    aiExplanation: textValue(latestJudge?.explanation) || "-",
    answer: answerText(trace) || "-",
    auditIdentifiers: [
      ["Batch ID", activeRun?.batch_id || "-"],
      ["Trace ID", trace.trace_id],
      ["Question ID", questionId],
      ["Service ID", resolvedServiceId],
      ["Run type", activeRun?.batch_type || "-"],
    ],
    contradictedClaims: contradictedClaims(trace),
    adjudicationReview: resolutionReview
      ? {
          comment: resolutionReview.comment_text || "",
          decision: resolutionReview.final_decision || "pending",
          reviewerId: resolutionReview.reviewer_id || resolutionReview.reviewer_role || "adjudication",
          sourceSupport: resolutionReview.label || "pending",
          status: resolutionReview.adjudication_status || "recorded",
          submittedAt: resolutionReview.submitted_at || "-",
          suggestedCorrection: resolutionReview.suggested_correction || "",
        }
      : undefined,
    humanReviews: primaryHumanReviewsForDisplay(trace).map((review, index) => {
      const comment = review.comment_text || ""
      const suggestedCorrection = review.suggested_correction || ""
      const correctionDuplicatesComment =
        Boolean(comment && suggestedCorrection) &&
        normalizedText(comment) === normalizedText(suggestedCorrection)
      return {
        comment,
        decision: review.final_decision || "pending",
        excluded: Boolean(review.excluded),
        reviewerId: review.reviewer_id || `review ${index + 1}`,
        sourceSupport: review.label || "pending",
        submittedAt: review.submitted_at || "-",
        suggestedCorrection: correctionDuplicatesComment ? "" : suggestedCorrection,
      }
    }),
    evidenceGapLabels: missing.map(evidenceGapLabel),
    missingEvidenceKeys: missing,
    finalAuditStatus: finalAuditStatus(trace, activeRun),
    hasHumanHumanMismatch: hasHumanHumanMismatch(reviews),
    judgeDecision: aiDecision(trace) || "pending",
    judgeDecisionChanged: judgeDecisionChanged(history),
    judgeHistory: history,
    judgeHistoryStatus: judgeHistoryStatus(history),
    calibrationContext: calibrationContext(trace),
    promptModelVersions: [
      ["Answer model", answerModel(trace, activeRun) || "-"],
      ["Answer prompt", answerPromptVersion(trace, activeRun) || "-"],
      ["Judge model", judgeModel(trace, activeRun) || "-"],
      ["Judge prompt", judgePromptVersion(trace, activeRun) || "-"],
      ["Judge schema", judgeSchemaVersion(trace, activeRun)],
    ],
    question: trace.citizen_question?.question_text || "-",
    questionId,
    retrievedExcerpt: retrievedExcerpt(trace) || "-",
    serviceTitle: serviceTitle(trace) || "-",
    sourceKind: reference.kind,
    sourceReference: reference.value || "-",
    sourceUrl: reference.kind === "url" ? reference.value : "-",
    timestamps: [
      ["Trace created", trace.created_at || "-"],
      ["Initial AI judge", initialJudge?.evaluated_at || initialJudge?.created_at || "-"],
      ["Latest AI judge", latestJudge?.evaluated_at || latestJudge?.created_at || "-"],
      ["Latest human review", reviews.at(-1)?.submitted_at || "-"],
    ],
    traceId: trace.trace_id,
    unsupportedClaims: unsupportedClaims(trace),
  }
}

export function buildAuditDashboardModel({
  activeRun,
  traces,
}: {
  activeRun: DeveloperRun | null
  traces: EvaluationTrace[]
}): AuditDashboardModel {
  const rows = traces.map((trace) => buildAuditTraceabilityRow(trace, activeRun))
  const technicalMissingEvidenceCount = traces.filter(
    (trace) => technicalMissingEvidenceKeys(trace, activeRun).length > 0,
  ).length
  return {
    caseDetails: traces.map((trace) => buildAuditCaseDetail(trace, activeRun)),
    completeness: {
      totalTraces: traces.length,
      withCompleteAutomatedTrace: traces.length - technicalMissingEvidenceCount,
      withCompleteDecisionEvidence: rows.filter((row) => row.missingEvidenceKeys.length === 0).length,
      withAiJudgeResult: traces.filter(hasAiJudgeResult).length,
      withGeneratedAnswer: traces.filter((trace) => Boolean(answerText(trace))).length,
      withHumanReview: traces.filter((trace) => primaryHumanReviews(trace).length > 0).length,
      withHumanHumanMismatch: traces.filter((trace) =>
        hasHumanHumanMismatch(primaryHumanReviews(trace)),
      ).length,
      withMissingEvidence: rows.filter((row) => row.missingEvidenceKeys.length > 0).length,
      withModelPromptMetadata: traces.filter((trace) => hasMetadata(trace, activeRun)).length,
      withPendingHumanReview: rows.filter((row) => row.missingEvidenceKeys.includes("human_review")).length,
      withRetrievedExcerpt: traces.filter((trace) => Boolean(retrievedExcerpt(trace))).length,
      withSourceDocument: traces.filter((trace) => sourceReference(trace).kind === "document")
        .length,
      withSourceReference: traces.filter((trace) => sourceReference(trace).kind !== "none").length,
      withSourceUrl: traces.filter((trace) => sourceReference(trace).kind === "url").length,
      withTechnicalMissingEvidence: technicalMissingEvidenceCount,
    },
    rows,
    runMetadata: buildRunMetadata(activeRun, traces),
  }
}

export function filterAuditRows(rows: AuditTraceabilityRow[], filter: AuditFilter) {
  switch (filter) {
    case "missing_source_reference":
      return rows.filter((row) => row.missingEvidenceKeys.includes("source_reference"))
    case "missing_metadata":
      return rows.filter((row) => row.missingEvidenceKeys.includes("model_prompt_metadata"))
    case "unsupported_claims":
      return rows.filter((row) => row.unsupportedClaims > 0)
    case "rejected":
      return rows.filter((row) => row.humanDecision.includes("reject") || row.aiDecision === "reject")
    case "needs_edit":
      return rows.filter((row) => row.humanDecision.includes("needs_edit") || row.aiDecision === "needs_edit")
    case "ai_human_mismatch":
      return rows.filter(
        (row) =>
          row.humanDecision !== "pending" &&
          row.aiDecision !== "pending" &&
          !row.humanDecision.split("; ").includes(row.aiDecision),
      )
    case "human_human_mismatch":
      return rows.filter((row) => row.hasHumanHumanMismatch)
    case "no_human_review":
      return rows.filter((row) => row.humanDecision === "pending")
    case "no_source_check":
      return rows.filter((row) => row.missingEvidenceStatus === "source check not performed")
    case "all":
    default:
      return rows
  }
}

export function buildAuditExportRows(details: AuditCaseDetail[]): AuditExportRow[] {
  return details.map((detail) => {
    const versions = Object.fromEntries(detail.promptModelVersions)
    const identifiers = Object.fromEntries(detail.auditIdentifiers)
    return {
      batch_id: identifiers["Batch ID"] || "-",
      run_type: identifiers["Run type"] || "-",
      trace_id: detail.traceId,
      question_id: detail.questionId,
      service_id: identifiers["Service ID"] || "-",
      service_title: detail.serviceTitle,
      source_reference: detail.sourceReference,
      source_reference_kind: detail.sourceKind,
      source_url: detail.sourceUrl,
      generated_answer: detail.answer,
      ai_decision: detail.judgeDecision,
      human_decisions: detail.humanReviews.map((review) => review.decision).join("; ") || "pending",
      source_support: detail.humanReviews.map((review) => review.sourceSupport).join("; ") || "pending",
      human_human_mismatch: detail.hasHumanHumanMismatch ? "yes" : "no",
      initial_ai_decision: detail.judgeHistory[0]?.decision || detail.judgeDecision,
      latest_ai_decision: detail.judgeHistory.at(-1)?.decision || detail.judgeDecision,
      judge_decision_changed: detail.judgeDecisionChanged ? "yes" : "no",
      judge_evaluation_count: String(detail.judgeHistory.length || 1),
      initial_judge_prompt_version: detail.judgeHistory[0]?.promptVersion || "-",
      latest_judge_prompt_version: detail.judgeHistory.at(-1)?.promptVersion || "-",
      latest_judge_rerun_id: detail.judgeHistory.at(-1)?.rerunId || "-",
      calibration_context: detail.calibrationContext,
      adjudication_status: detail.adjudicationReview?.status || "not recorded",
      adjudication_decision: detail.adjudicationReview?.decision || "not recorded",
      adjudication_reviewer_id: detail.adjudicationReview?.reviewerId || "not recorded",
      unsupported_claims: [...detail.unsupportedClaims, ...detail.contradictedClaims].join(" | "),
      missing_evidence: detail.evidenceGapLabels.join(" | ") || "complete",
      answer_model: versions["Answer model"] || "-",
      answer_prompt_version: versions["Answer prompt"] || "-",
      judge_model: versions["Judge model"] || "-",
      judge_prompt_version: versions["Judge prompt"] || "-",
      judge_schema_version: versions["Judge schema"] || NOT_RECORDED,
    }
  })
}
