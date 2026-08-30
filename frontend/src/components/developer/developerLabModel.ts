import type {
  DeveloperPromptsResponse,
  DeveloperRunSettings,
  EvaluationCriterionKey,
  EvaluationTrace,
  HumanReview,
  Language,
  PromptType,
  PromptVersion,
  ReviewDecision,
  SourceSupport,
} from "@/types"
import {
  adjudicationReviewerId,
  automatedDecision,
  hasHumanDisagreement,
  hasHumanReviewDisagreement,
  humanReviews,
  isResolvedAdjudicationReview,
  isReviewDecision,
  judgeDecision,
  reviewIdentity,
} from "../shared/evaluationTraceModel.ts"
import { buildRunIssueNotice, runStatusLabel } from "../shared/runIssueNotice.ts"
import { formatBatchDate, runTypeLabel } from "./shared/developerFormatters.ts"

export type DeveloperLabTone = "danger" | "warning" | "ready" | "quiet"
export type DeveloperLabTabId =
  | "run_console"
  | "integrations"
  | "judge_calibration"
  | "human_study_setup"
  | "results_cases"
  | "analysis"
  | "improvement"

export type RunInputSource = "internal_demo" | "imported_answers"

export const developerLabTabs: { id: DeveloperLabTabId; label: string }[] = [
  { id: "results_cases", label: "Results" },
  { id: "run_console", label: "Setup & Run" },
  { id: "judge_calibration", label: "Judge Calibration" },
  { id: "human_study_setup", label: "Reviewer Links" },
  { id: "integrations", label: "Integrations" },
  { id: "analysis", label: "Analysis" },
  { id: "improvement", label: "Improvement Ideas" },
]
export const developerLabCaseDetailTab: DeveloperLabTabId = "results_cases"
// Lives in evaluationTraceModel now; re-exported so Developer Lab callers and
// tests keep importing it from here.
export { adjudicationReviewerId }

export function isDeveloperLabTabId(value: string | null | undefined): value is DeveloperLabTabId {
  return developerLabTabs.some((tab) => tab.id === value)
}

export type AdjudicationReviewPayload = {
  adjudication_status: "reopened" | "resolved"
  comment_text: string
  criteria: Record<string, number>
  final_decision: "accept" | "needs_edit" | "reject"
  human_score: number
  is_adjudication: true
  label: SourceSupport
  reviewer_id: string
  suggested_correction: string
}

export type AdjudicationState = {
  needsResolution: boolean
  primaryConflict: boolean
  resolution: HumanReview | null
  resolved: boolean
}

function isAdjudicationReview(review: HumanReview) {
  return review.is_adjudication === true || review.reviewer_id === adjudicationReviewerId
}

function primaryHumanReviews(trace: EvaluationTrace) {
  return humanReviews(trace).filter((review) => !isAdjudicationReview(review))
}

function resolvedAdjudicationReview(trace: EvaluationTrace) {
  return [...humanReviews(trace)]
    .reverse()
    .find((review) => isResolvedAdjudicationReview(review)) || null
}

function humanScoreForDecision(decision: AdjudicationReviewPayload["final_decision"]) {
  if (decision === "accept") return 5
  if (decision === "reject") return 1
  return 3
}

function sourceLabelFromPrimaryReviews(trace: EvaluationTrace): SourceSupport {
  const labels = primaryHumanReviews(trace)
    .map((review) => review.label)
    .filter((label): label is SourceSupport =>
      label === "supported" || label === "partly_supported" || label === "unsupported",
    )

  if (labels.length === 0) return "not_checked"

  const counts = labels.reduce<Record<SourceSupport, number>>(
    (accumulator, label) => {
      accumulator[label] += 1
      return accumulator
    },
    { not_checked: 0, partly_supported: 0, supported: 0, unsupported: 0 },
  )
  const topCount = Math.max(counts.supported, counts.partly_supported, counts.unsupported)
  const topLabels = (["supported", "partly_supported", "unsupported"] as const).filter(
    (label) => counts[label] === topCount,
  )

  return topLabels.length === 1 ? topLabels[0] : "not_checked"
}

export function buildAdjudicationState(trace: EvaluationTrace): AdjudicationState {
  const resolution = resolvedAdjudicationReview(trace)
  const primaryConflict = hasHumanReviewDisagreement(primaryHumanReviews(trace))
  return {
    needsResolution: primaryConflict && !resolution,
    primaryConflict,
    resolution,
    resolved: Boolean(resolution),
  }
}

export function buildAdjudicationReviewPayload({
  adjudicationStatus = "resolved",
  comment,
  decision,
  sourceLabel,
  trace,
}: {
  adjudicationStatus?: "reopened" | "resolved"
  comment: string
  decision: AdjudicationReviewPayload["final_decision"]
  sourceLabel?: SourceSupport
  trace: EvaluationTrace
}): AdjudicationReviewPayload {
  const existingResolution = resolvedAdjudicationReview(trace)
  const reviewerId = existingResolution?.reviewer_id || adjudicationReviewerId
  return {
    adjudication_status: adjudicationStatus,
    comment_text: comment.trim(),
    criteria: {},
    final_decision: decision,
    human_score: humanScoreForDecision(decision),
    is_adjudication: true,
    label: sourceLabel || sourceLabelFromPrimaryReviews(trace),
    reviewer_id: reviewerId,
    suggested_correction: "",
  }
}

export type DeveloperLabSignal = {
  detail: string
  label: string
  tone: DeveloperLabTone
}

export type DeveloperLabSummary = {
  alignment: DeveloperLabSignal
  likelyIssue: DeveloperLabSignal
  risk: DeveloperLabSignal
}

export type PipelineStatusTone = "ready" | "warning" | "quiet"

export type PipelineStatusItem = {
  detail?: string
  label: string
  tone: PipelineStatusTone
  value: string
}

export type CaseSummaryLine = {
  detail: string
  label: string
}

export type CaseRunPolicy = {
  canOverwrite: boolean
  detail: string
  label: string
  nextAction: string
}

export type StudyRunSummary = {
  answerCount: number
  caseCount: number
  frozenCaseCount: number
  judgeCount: number
  questionCount: number
  requiredHumanReviews: number
}

export type RunSetupOverview = {
  progressCards: { label: string; value: string }[]
  status: string
  technicalDetails: [string, string][]
  title: string
}

export type RunInputSourceSummary = {
  actionLabel: string
  detail: string
  title: string
}

export function buildRunInputSourceSummary(source: RunInputSource): RunInputSourceSummary {
  if (source === "imported_answers") {
    return {
      actionLabel: "Import question-answer file",
      detail: "Import provided question-answer pairs; answer generation is skipped.",
      title: "Imported data",
    }
  }

  return {
    actionLabel: "Choose questions from Question Bank",
    detail: "Generate answers from the Question Bank, then run the judge.",
    title: "Internal demo questions",
  }
}

export function shouldShowAnswerPromptSettings(source: RunInputSource) {
  return source === "internal_demo"
}

export function shouldShowJudgePromptSettings(source: RunInputSource) {
  void source
  return true
}

export type IntegrationEndpointDoc = {
  description: string
  method: "GET" | "POST"
  path: string
  requestExample: string
  responseExample: string
  title: string
}

export function buildIntegrationEndpointDocs(baseUrl: string): IntegrationEndpointDoc[] {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "")

  return [
    {
      description: "Check whether the local public API is reachable.",
      method: "GET",
      path: "/health",
      requestExample: `curl ${normalizedBaseUrl}/health`,
      responseExample: `{
  "status": "ok"
}`,
      title: "Health check",
    },
    {
      description: "Read the current public API version, auth mode, and available capabilities.",
      method: "GET",
      path: "/integration/status",
      requestExample: `curl ${normalizedBaseUrl}/integration/status`,
      responseExample: `{
  "status": "ok",
  "api_version": "v1",
  "public_base_path": "/api/v1",
  "authentication": {
    "mode": "local"
  }
}`,
      title: "Integration status",
    },
    {
      description: "Submit a question, generated answer, and source context for automated evaluation.",
      method: "POST",
      path: "/evaluations",
      requestExample: `curl -X POST ${normalizedBaseUrl}/evaluations \\
  -H 'Content-Type: application/json' \\
  -d '{
    "service_id": "external_service_1",
    "service_title": "External appointment service",
    "source_url": "https://example.gov/service/appointment",
    "question_text": "Kann ich den Termin kostenlos buchen?",
    "answer_text": "Ja, die Terminbuchung ist kostenlos.",
    "source_context": "Die Terminbuchung ist kostenlos.",
    "target_section": "fees",
    "model_name": "external_qa_backend_v1"
  }'`,
      responseExample: `{
  "trace_id": "runtime_...",
  "automated_evaluation": {
    "final_decision": "accept",
    "label": "supported",
    "judge_score": 5
  }
}`,
      title: "Evaluate answer",
    },
    {
      description: "Submit or update a human review for an evaluated case.",
      method: "POST",
      path: "/human-reviews",
      requestExample: `curl -X POST ${normalizedBaseUrl}/human-reviews \\
  -H 'Content-Type: application/json' \\
  -d '{
    "trace_id": "runtime_...",
    "reviewer_id": "P01",
    "final_decision": "needs_edit",
    "label": "supported",
    "human_score": 3,
    "criteria": {
      "factual_correctness": 5,
      "source_support": 5,
      "completeness": 3,
      "clarity_actionability": 2,
      "public_service_tone": 4
    },
    "comment_text": "The answer is supported but not actionable enough.",
    "suggested_correction": ""
  }'`,
      responseExample: `{
  "trace_id": "runtime_...",
  "human_reviews": [
    {
      "reviewer_id": "P01",
      "final_decision": "needs_edit"
    }
  ],
  "disagreement_case": null
}`,
      title: "Submit human review",
    },
    {
      description: "Read aggregate evaluation metrics for monitoring or reporting.",
      method: "GET",
      path: "/metrics/overview",
      requestExample: `curl ${normalizedBaseUrl}/metrics/overview`,
      responseExample: `{
  "service_count": 1115,
  "question_count": 40,
  "trace_count": 20,
  "disagreement_count": 2
}`,
      title: "Metrics overview",
    },
    {
      description: "List saved evaluation runs and links to role-specific read models.",
      method: "GET",
      path: "/runs",
      requestExample: `curl ${normalizedBaseUrl}/runs`,
      responseExample: `{
  "schema_version": "runs-v1",
  "items": [
    {
      "batch_id": "batch_...",
      "links": {
        "research_summary": "/api/v1/runs/batch_.../research-summary"
      }
    }
  ]
}`,
      title: "List evaluation runs",
    },
    {
      description: "Return methodology-oriented metrics for the Research dashboard.",
      method: "GET",
      path: "/runs/{batch_id}/research-summary",
      requestExample: `curl ${normalizedBaseUrl}/runs/batch_.../research-summary`,
      responseExample: `{
  "schema_version": "research-summary-v1",
  "sample_context": {
    "total_cases": 20
  },
  "ai_human_agreement": {
    "match_rate": 0.72,
    "false_accepts": 3
  }
}`,
      title: "Research summary",
    },
    {
      description: "Return readiness, review effort, risk groups, and action backlog for management.",
      method: "GET",
      path: "/runs/{batch_id}/management-summary",
      requestExample: `curl "${normalizedBaseUrl}/runs/batch_.../management-summary?available_reviewers=3&hourly_rate_eur=60"`,
      responseExample: `{
  "schema_version": "management-summary-v1",
  "assumptions": {
    "available_reviewers": 3,
    "hourly_rate_eur": 60
  },
  "after_human_review": {
    "readiness_status": "Insufficient evidence"
  }
}`,
      title: "Management summary",
    },
    {
      description: "Return traceability completeness, audit rows, and reconstructable case evidence.",
      method: "GET",
      path: "/runs/{batch_id}/audit-evidence",
      requestExample: `curl ${normalizedBaseUrl}/runs/batch_.../audit-evidence`,
      responseExample: `{
  "schema_version": "audit-evidence-v2",
  "completeness": {
    "total_traces": 20,
    "with_source_reference": 20,
    "with_source_url": 12,
    "with_source_document": 8,
    "with_human_review": 12
  },
  "traceability_rows": []
}`,
      title: "Audit evidence",
    },
    {
      description: "Download a flat CSV table of research cases for analysis or reporting.",
      method: "GET",
      path: "/runs/{batch_id}/exports/research-cases.csv",
      requestExample: `curl ${normalizedBaseUrl}/runs/batch_.../exports/research-cases.csv`,
      responseExample: `trace_id,question_id,service,question_style,target_section,ai_decision,human_decision
runtime_...,question_1,Residence certificate,direct_clean,fees,accept,needs_edit`,
      title: "Research case CSV",
    },
    {
      description: "Download a flat CSV table of submitted human reviews.",
      method: "GET",
      path: "/runs/{batch_id}/exports/research-reviews.csv",
      requestExample: `curl ${normalizedBaseUrl}/runs/batch_.../exports/research-reviews.csv`,
      responseExample: `trace_id,reviewer_id,final_decision,source_support,human_score,submitted_at,comment_text
runtime_...,P01,needs_edit,supported,3,2026-06-15T09:00:00Z,Answer needs clearer next steps.`,
      title: "Research review CSV",
    },
    {
      description: "Download a flat CSV table of audit traceability fields.",
      method: "GET",
      path: "/runs/{batch_id}/exports/audit-evidence.csv",
      requestExample: `curl ${normalizedBaseUrl}/runs/batch_.../exports/audit-evidence.csv`,
      responseExample: `trace_id,question_id,service_id,service_title,source_reference,source_reference_kind,source_url,ai_decision,human_decision,missing_evidence
runtime_...,question_1,service_1,Residence certificate,https://service.example,url,https://service.example,accept,needs_edit,complete`,
      title: "Audit evidence CSV",
    },
    {
      description: "Download the full nested audit evidence package as JSON.",
      method: "GET",
      path: "/runs/{batch_id}/exports/audit-evidence.json",
      requestExample: `curl ${normalizedBaseUrl}/runs/batch_.../exports/audit-evidence.json`,
      responseExample: `{
  "schema_version": "audit-evidence-v2",
  "case_details": [],
  "export_links": []
}`,
      title: "Audit evidence JSON",
    },
  ]
}

export type ReviewerBatchPlan = {
  assignmentsPerReviewer: number[]
  reviewerCount: number
  reviewsPerQuestion: number
  summary: string
  totalAssignments: number
}

export type ReviewerAssignmentParticipant = {
  assignedTraceIds: string[]
  completedReviews: number
  participantId: string
  reviewUrl: string
}

export type ReviewerAssignmentPlan = {
  batchId?: string
  caseReviewTargets: Record<string, number>
  participants: ReviewerAssignmentParticipant[]
  profileFields: string[]
  reviewerCount: number
  reviewsPerQuestion: number
  summary: string
  totalAssignments: number
}

export type DeveloperActiveRun = {
  batch_id: string
  batch_type: string
  completed_at?: string | null
  created_at: string
  metadata?: Record<string, unknown>
  question_count: number
  status: string
} | null

export function buildDefaultDeveloperLabTab(
  activeRun: DeveloperActiveRun,
  requestedTab?: string | null,
): DeveloperLabTabId {
  if (isDeveloperLabTabId(requestedTab)) return requestedTab
  return activeRun ? "results_cases" : "run_console"
}

export type SelectedCaseState = {
  canOpen: boolean
  selectedTraceId: string
}

export const worklistFilters = [
  "all",
  "human_missing",
  "mismatch",
  "human_disagreement",
  "source_concern",
  "ai_false_accept",
  "needs_attention",
  "accept",
  "needs_edit",
  "reject",
  "judge_accept",
  "judge_needs_edit",
  "judge_reject",
] as const
export type WorklistFilter = (typeof worklistFilters)[number]
export type WorklistSort = "run_order" | "attention_first" | "human_missing_first" | "reviewed_first"

export type DeveloperWorklistItem = {
  disagreement: boolean
  humanDisagreement: boolean
  humanReviewCount: number
  humanStatus: string
  primaryStatus: string
  trace: EvaluationTrace
}

export function isWorklistFilter(value: string | null | undefined): value is WorklistFilter {
  return worklistFilters.includes(value as WorklistFilter)
}

export function resolveWorklistFilterForBatchSelection(
  currentFilter: WorklistFilter,
  currentBatchId: string,
  nextBatchId: string,
): WorklistFilter {
  return currentBatchId && currentBatchId === nextBatchId ? currentFilter : "all"
}

export type RunCaseAttentionTone = "danger" | "warning" | "notice" | "quiet" | "ready"

export type RunCaseRow = {
  attention: string
  attentionTone: RunCaseAttentionTone
  judgeChangedFrom: string
  humanDecisions: ReviewDecision[]
  humanStatus: string
  judgeStatus: string
  question: string
  traceId: string
}

export type CalibrationCaseRow = {
  actualDecision: string
  expectedDecision: string
  expectedSignal: string
  failureReason: string
  faultType: string
  missedCriteria: string
  question: string
  service: string
  status: string
  traceId: string
}

export type ResultsEmptyState = {
  description: string
  detail: string
  tone: "danger" | "notice" | "warning" | "quiet"
  title: string
}

export type CalibrationPromptDiagnosis = {
  likelyCause: string
  nextPromptChange: string
  promptArea: string
  whatHappened: string
}

export type CalibrationSummary = {
  cards: { label: string; value: string }[]
  failedCount: number
  falseAcceptCount: number
  falseRejectCount: number
  passedCount: number
  totalCount: number
}

export type RequiredComparisonStatus = "match" | "mismatch" | "pending" | "human_disagreement"
export type DiagnosticCriteriaStatus =
  | "aligned_positive"
  | "ai_concern_no_human_signal"
  | "ai_concern_not_confirmed"
  | "ai_not_available"
  | "human_concern_ai_missed"
  | "human_disagreement"
  | "mixed_or_partial"
  | "no_human_signal"
  | "shared_concern"

export type RequiredComparisonRow = {
  aiResult: string
  dimensionKey: "final_decision" | "source_support"
  dimensionLabel: string
  explanation: string
  humanResult: string
  status: RequiredComparisonStatus
}

export type RequiredComparisonMatrixCell = {
  status: RequiredComparisonStatus
  value: string
}

export type RequiredComparisonMatrixRow = {
  canUse: RequiredComparisonMatrixCell
  canVerify: RequiredComparisonMatrixCell
  reviewerBadge?: string
  reviewerKey: string
  reviewerLabel: string
  reviewerType: "ai" | "human"
}

export type DiagnosticCriteriaRow = {
  aiResult: string
  aiResultItems: DiagnosticAiResultItem[]
  criterionKey: EvaluationCriterionKey
  criterionLabel: string
  humanEvidence: string
  humanEvidenceItems: DiagnosticHumanEvidenceItem[]
  status: DiagnosticCriteriaStatus
}

export type DiagnosticAiResultItem = {
  label: string
  value: string
}

export type DiagnosticHumanEvidenceItem = {
  reviewerLabel: string
  value: string
}

export type PromptJudgeSettings = {
  answerPrompt: { description: string; mode: string; version: string }
  judgePrompt: { description: string; mode: string; version: string }
  model: { detail: string; value: string }
  rubric: { criteria: string[]; value: string }
  runMetadata: [string, string][]
}

export type PromptVersionOption = {
  label: string
  modelName: string
  promptText: string
  value: string
}

export type StudyRunSize = "test" | "all"

export type JudgeEvaluationHistoryItem = {
  decision: string
  evaluatedAt: string
  explanation: string
  id: string
  modelName: string
  promptVersion: string
  roleLabel: string
  score: string
  sourceSupport: string
}

export type JudgeExplanationItem = {
  decision: string
  explanation: string
  label: string
  modelName: string
}

export const criterionDefinitions: { key: EvaluationCriterionKey; label: string }[] = [
  { key: "source_support", label: "Source support" },
  { key: "factual_correctness", label: "Factual correctness" },
  { key: "completeness", label: "Completeness" },
  { key: "clarity_actionability", label: "Clarity and actionability" },
  { key: "public_service_tone", label: "Public-service tone" },
  { key: "uncertainty_handling", label: "Uncertainty handling" },
]

const criterionAliases: Partial<Record<EvaluationCriterionKey, string[]>> = {
  public_service_tone: ["tone_public_service"],
  uncertainty_handling: ["clarification_need"],
}

function criterionLookupKeys(criterionKey: EvaluationCriterionKey) {
  return [criterionKey, ...(criterionAliases[criterionKey] || [])]
}

function metadataText(
  metadata: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
) {
  const value = metadata?.[key]
  return typeof value === "string" && value.trim() ? value : fallback
}

export function readableGenerationMode(mode: string) {
  if (mode === "openai_answer_v1") {
    return "OpenAI answer generation"
  }
  if (mode === "deterministic_multi_context_summary") {
    return "Multi-source baseline"
  }
  if (mode === "deterministic_source_excerpt") {
    return "Source excerpt baseline"
  }
  if (mode === "provided_answer_or_baseline") {
    return "Provided answer"
  }
  return mode
}

export function readableJudgeMode(mode: string) {
  if (mode === "openai_judge_v1") {
    return "OpenAI judge"
  }
  if (mode === "rule_based_baseline") {
    return "Rule-based judge"
  }
  return mode
}

export function buildPromptJudgeSettings(activeRun: DeveloperActiveRun): PromptJudgeSettings {
  const metadata = activeRun?.metadata
  const answerPromptVersion = metadataText(metadata, "answer_prompt_version", "api_baseline_v0")
  const judgePromptVersion = metadataText(metadata, "judge_prompt_version", "rule_judge_v0")
  const modelName = metadataText(metadata, "model_name", "no_llm_baseline")
  const answerMode = metadataText(metadata, "generation_mode", "deterministic_source_excerpt")
  const judgeMode = metadataText(metadata, "judge_mode", "rule_based_baseline")

  return {
    answerPrompt: {
      description:
        "Answer the citizen question using only the retrieved official-source context. Write a concise, polite German answer. If the context is missing information, say what is missing and point to the official source.",
      mode: readableGenerationMode(answerMode),
      version: answerPromptVersion,
    },
    judgePrompt: {
      description:
        "Evaluate the answer against the citizen question and retrieved source. Score factual correctness, source support, completeness, clarity/actionability, public-service tone, and uncertainty handling. Flag unsupported claims.",
      mode: readableJudgeMode(judgeMode),
      version: judgePromptVersion,
    },
    model: {
      detail: modelName === "no_llm_baseline" ? "Deterministic baseline; no external LLM call." : "Configured generation model.",
      value: modelName,
    },
    rubric: {
      criteria: criterionDefinitions.map((criterion) => criterion.label),
      value: `${criterionDefinitions.length} shared criteria`,
    },
    runMetadata: activeRun
      ? [
          ["Run", activeRun.batch_id],
          ["Run type", activeRun.batch_type],
          ["Status", activeRun.status],
          ["Created", activeRun.created_at],
        ]
      : [],
  }
}

export function buildPromptVersionOptions(
  prompts: PromptVersion[],
  promptType: PromptType,
  fallback: { promptText: string; promptVersion: string },
): PromptVersionOption[] {
  const options = new Map<string, PromptVersionOption>()
  options.set(fallback.promptVersion, {
    label: `${fallback.promptVersion} · baseline`,
    modelName: "",
    promptText: fallback.promptText,
    value: fallback.promptVersion,
  })

  prompts
    .filter((prompt) => prompt.prompt_type === promptType)
    .forEach((prompt) => {
      options.set(prompt.prompt_version, {
        label: prompt.prompt_version,
        modelName: prompt.model_name,
        promptText: prompt.prompt_text,
        value: prompt.prompt_version,
      })
    })

  return [...options.values()]
}

function promptVersionPrefix(promptType: PromptType, modeName: string) {
  if (promptType === "judge") {
    return modeName === "openai_judge_v1" ? "openai_judge_v" : "rule_judge_v"
  }
  return modeName === "no_llm_baseline" ? "baseline_answer_v" : "openai_answer_v"
}

function promptVersionNumber(version: string) {
  const match = version.match(/_v(\d+)$/)
  return match ? Number(match[1]) : 0
}

export function buildNextPromptVersion(
  prompts: PromptVersion[],
  promptType: PromptType,
  modeName: string,
) {
  const maxVersion = prompts
    .filter((prompt) => prompt.prompt_type === promptType)
    .reduce((currentMax, prompt) => Math.max(currentMax, promptVersionNumber(prompt.prompt_version)), 0)
  return `${promptVersionPrefix(promptType, modeName)}${maxVersion + 1}`
}

function promptTextForVersion(
  prompts: DeveloperPromptsResponse,
  promptType: PromptType,
  promptVersion: string,
  fallbackText: string,
) {
  const item = prompts.items.find(
    (prompt) => prompt.prompt_type === promptType && prompt.prompt_version === promptVersion,
  )
  return item?.prompt_text || fallbackText
}

export function hydrateRunSettingsFromPromptVersions(
  current: DeveloperRunSettings,
  prompts: DeveloperPromptsResponse,
): DeveloperRunSettings {
  const answerPromptVersion = current.answer_prompt_version || prompts.defaults.answer_prompt_version
  const judgePromptVersion = current.judge_prompt_version || prompts.defaults.judge_prompt_version

  return {
    ...current,
    answer_prompt_text: promptTextForVersion(
      prompts,
      "answer",
      answerPromptVersion,
      prompts.defaults.answer_prompt_text,
    ),
    answer_prompt_version: answerPromptVersion,
    judge_mode: current.judge_mode || prompts.defaults.judge_mode,
    judge_prompt_text: promptTextForVersion(
      prompts,
      "judge",
      judgePromptVersion,
      prompts.defaults.judge_prompt_text,
    ),
    judge_prompt_version: judgePromptVersion,
    judge_model_name: current.judge_model_name || prompts.defaults.judge_model_name,
    model_name: current.model_name || prompts.defaults.model_name,
  }
}

function derivedJudgeDecision(trace: EvaluationTrace) {
  return automatedDecision(trace)
}

function judgeEvaluations(trace: EvaluationTrace): EvaluationTrace["automated_evaluation"][] {
  return trace.judge_evaluations?.length ? trace.judge_evaluations : [trace.automated_evaluation]
}

function judgeEvaluationVersionLabel(
  evaluation: EvaluationTrace["automated_evaluation"],
  index: number,
  total: number,
) {
  const promptVersion = evaluation.judge_prompt_version || "judge prompt unknown"
  const role = index === 0 ? "baseline" : index === total - 1 ? "latest" : "rerun"
  return `${promptVersion} · ${role}`
}

export function buildJudgeEvaluationHistory(trace: EvaluationTrace): JudgeEvaluationHistoryItem[] {
  const evaluations = judgeEvaluations(trace)

  return evaluations.map((evaluation, index) => {
    const role = evaluation.evaluation_role || (index === 0 ? "baseline" : "rerun")
    return {
      decision: judgeDecision(evaluation),
      evaluatedAt: evaluation.evaluated_at || evaluation.created_at || "-",
      explanation: evaluation.explanation || "-",
      id: evaluation.judge_rerun_id || evaluation.auto_eval_id || `${trace.trace_id}_judge_${index}`,
      modelName: evaluation.judge_model_name || "-",
      promptVersion: evaluation.judge_prompt_version || "-",
      roleLabel: role === "baseline" ? "Baseline judge" : "Judge rerun",
      score: typeof evaluation.judge_score === "number" ? String(evaluation.judge_score) : "-",
      sourceSupport: evaluation.label || "-",
    }
  })
}

export function buildJudgeExplanationItems(trace: EvaluationTrace): JudgeExplanationItem[] {
  return buildJudgeEvaluationHistory(trace)
    .filter((item) => item.explanation && item.explanation !== "-")
    .map((item) => ({
      decision: item.decision,
      explanation: item.explanation,
      label: item.promptVersion,
      modelName: item.modelName,
    }))
}

function expectedCriterionMaxima(trace: EvaluationTrace) {
  const maxima: Partial<Record<EvaluationCriterionKey, number>> = {}
  for (const criterion of trace.calibration?.expected_low_criteria || []) {
    maxima[criterion] = 2
  }
  for (const [criterion, maxScore] of Object.entries(trace.calibration?.expected_criteria_max || {})) {
    if (typeof maxScore === "number") {
      maxima[criterion as EvaluationCriterionKey] = maxScore
    }
  }
  return maxima
}

function expectedCriterionLabels(trace: EvaluationTrace) {
  return Object.entries(expectedCriterionMaxima(trace)).map(
    ([criterion, maxScore]) => `${criterion} <= ${maxScore}`,
  )
}

function missedExpectedCriteria(trace: EvaluationTrace) {
  const expected = expectedCriterionMaxima(trace)
  return (Object.entries(expected) as [EvaluationCriterionKey, number][]).filter(([criterionKey, maxScore]) => {
    const criterion = criterionLookupKeys(criterionKey)
      .map((key) => trace.automated_evaluation.criteria?.[key])
      .find(Boolean)
    return !criterion || criterion.score > maxScore
  }).map(([criterionKey]) => criterionKey)
}

function calibrationPassed(trace: EvaluationTrace) {
  if (!trace.calibration) return false
  return (
    derivedJudgeDecision(trace) === trace.calibration.expected_final_decision &&
    missedExpectedCriteria(trace).length === 0
  )
}

function readableFaultType(faultType: string | undefined) {
  if (faultType === "known_good_answer") return "Good control answer"
  if (faultType === "known_good_multi_intent_answer") return "Good multi-intent control"
  if (faultType === "known_good_no_fee_answer") return "Good no-fee control"
  if (faultType === "known_good_processing_time_answer") return "Good processing-time control"
  if (faultType === "unsupported_claim") return "Unsupported claim"
  if (faultType === "wrong_eligibility_claim") return "Wrong eligibility claim"
  if (faultType === "invented_online_option") return "Invented online option"
  if (faultType === "wrong_responsible_office") return "Wrong responsible office"
  if (faultType === "incomplete_answer") return "Incomplete answer"
  if (faultType === "overconfident_answer") return "Overconfident answer"
  if (faultType === "overconfident_ambiguous_answer") return "Overconfident ambiguous answer"
  if (faultType === "bad_public_service_tone") return "Bad public-service tone"
  if (faultType === "bureaucratic_answer") return "Bureaucratic answer"
  if (faultType === "retrieval_style_answer") return "Retrieval-style answer"
  if (faultType === "soft_incomplete_documents") return "Soft incomplete documents"
  if (faultType === "multi_intent_partial_answer") return "Only answers part of question"
  return faultType || "-"
}

function calibrationExpectedSignal(trace: EvaluationTrace) {
  const calibration = trace.calibration
  if (!calibration) return "-"
  const criteriaLabels = expectedCriterionLabels(trace)
  if (!criteriaLabels.length) {
    return calibration.expected_final_decision
  }
  return `${calibration.expected_final_decision} + ${criteriaLabels.join(", ")}`
}

function calibrationFailureReason(trace: EvaluationTrace, passed: boolean, missedCriteria: string[]) {
  if (passed) return "-"
  if (trace.calibration?.failure_reasons?.length) {
    return trace.calibration.failure_reasons.join("; ")
  }
  const actualDecision = trace.calibration?.actual_final_decision || derivedJudgeDecision(trace)
  const expectedDecision = trace.calibration?.expected_final_decision
  const reasons: string[] = []
  if (expectedDecision && actualDecision !== expectedDecision) {
    reasons.push(`Expected ${expectedDecision}, judge returned ${actualDecision}`)
  }
  if (missedCriteria.length) {
    const expected = expectedCriterionMaxima(trace)
    const labels = missedCriteria.map((criterion) => `${criterion} <= ${expected[criterion as EvaluationCriterionKey] ?? 2}`)
    reasons.push(`Did not meet expected scores: ${labels.join(", ")}`)
  }
  return reasons.join("; ") || "Calibration expectation was not met."
}

function criterionScore(trace: EvaluationTrace, criterion: EvaluationCriterionKey) {
  return criterionLookupKeys(criterion)
    .map((key) => trace.automated_evaluation.criteria?.[key]?.score)
    .find((score) => typeof score === "number")
}

function allKnownCriterionScores(trace: EvaluationTrace) {
  return criterionDefinitions
    .map((definition) => criterionScore(trace, definition.key))
    .filter((score): score is number => typeof score === "number")
}

function hasHighScoresButNonAccept(trace: EvaluationTrace, actualDecision: string) {
  const scores = allKnownCriterionScores(trace)
  return scores.length >= 4 && scores.every((score) => score >= 4) && actualDecision !== "accept"
}

function hasOpenAiJudge(trace: EvaluationTrace) {
  return trace.automated_evaluation.evaluation_mode === "openai_judge_v1"
}

function promptAreaForFault(trace: EvaluationTrace) {
  const faultType = trace.calibration?.fault_type
  if (!hasOpenAiJudge(trace)) {
    return "Prompt changes will not affect this run because it used the rule-based baseline. Switch Judge mode to OpenAI judge, select a judge prompt version, and run calibration again."
  }
  if (faultType === "known_good_answer") {
    return "Edit the accept vs needs_edit threshold in the judge prompt."
  }
  if (faultType === "unsupported_claim") {
    return "Edit the source-support and factual-correctness rules in the judge prompt."
  }
  if (faultType === "incomplete_answer" || faultType === "multi_intent_partial_answer") {
    return "Edit the completeness rule and the final-decision threshold in the judge prompt."
  }
  if (faultType === "overconfident_answer") {
    return "Edit the uncertainty-handling and unsupported-precision rules in the judge prompt."
  }
  if (faultType === "bad_public_service_tone") {
    return "Edit the public-service tone rule and when tone should be needs_edit vs reject."
  }
  return "Edit the judge prompt version selected in this calibration run."
}

function promptAdviceForFault(trace: EvaluationTrace, actualDecision: string) {
  const faultType = trace.calibration?.fault_type
  const expectedDecision = trace.calibration?.expected_final_decision || "-"
  const completeness = criterionScore(trace, "completeness")
  if (!hasOpenAiJudge(trace)) {
    return "Prompt iteration cannot be diagnosed from this result until the OpenAI judge mode is used."
  }
  if (hasHighScoresButNonAccept(trace, actualDecision)) {
    return "Add a consistency rule: if all major criterion scores are 4-5, the final decision should normally be accept. Use needs_edit only when the explanation names an action-critical missing point; use reject only for severe unsupported, wrong, or unsafe answers."
  }
  if (faultType === "known_good_answer" && actualDecision !== "accept") {
    return "Add guidance that a concise, source-grounded answer can be accepted when it answers the citizen's concrete question, contains no invented facts, and any omitted source details do not change the practical next step. Do not turn every non-exhaustive answer into needs_edit."
  }
  if (faultType === "known_good_answer" && completeness === 3) {
    return "Clarify what score 3 means: borderline completeness alone should not automatically force needs_edit for a control answer unless the missing information is necessary for the citizen to act."
  }
  if (faultType === "unsupported_claim") {
    return "Add a hard rule: invented concrete facts such as fees, deadlines, required documents, eligibility rules, or legal claims must get low source_support and factual_correctness. If the unsupported claim could mislead a citizen, the final decision should be reject."
  }
  if (faultType === "incomplete_answer") {
    return "Tell the judge to mark needs_edit when the answer is source-grounded but misses required documents, steps, costs, deadlines, or conditions that the citizen needs to complete the service."
  }
  if (faultType === "overconfident_answer") {
    return "Tell the judge to penalize precise claims that the source does not support. If processing time or certainty is not in the source, the answer should express uncertainty instead of inventing precision."
  }
  if (faultType === "bad_public_service_tone") {
    return `Tell the judge that unfriendly or dismissive public-service tone usually means needs_edit. Reserve reject for tone that is harmful, discriminatory, or combined with factual/source problems. Current expected decision: ${expectedDecision}.`
  }
  if (faultType === "multi_intent_partial_answer") {
    return "Tell the judge to check every intent in the citizen question. If the answer handles only one part, completeness should be low and the final decision should be needs_edit."
  }
  return "Compare the expected behavior with the judge explanation and add a concrete rule or example to the selected judge prompt."
}

function likelyCauseForFault(trace: EvaluationTrace, actualDecision: string, missedCriteria: string[]) {
  const faultType = trace.calibration?.fault_type
  const expectedDecision = trace.calibration?.expected_final_decision || "-"
  if (!trace.calibration) return "This is not a calibration case."
  if (hasHighScoresButNonAccept(trace, actualDecision)) {
    return "The judge output is internally inconsistent: the criterion scores are high, but the final decision is not accept."
  }
  if (actualDecision !== expectedDecision) {
    if (faultType === "known_good_answer") {
      return "The judge is too strict for this control case. It found a possible completeness issue and converted that into needs_edit, even though this seeded case is meant to be acceptable."
    }
    if (actualDecision === "accept") {
      return "The judge is too lenient. It accepted an answer that the calibration library says should require correction."
    }
    if (actualDecision === "reject" && expectedDecision === "needs_edit") {
      return "The judge is too harsh. It noticed the problem, but escalated it further than the expected calibration decision."
    }
    return "The judge noticed something, but mapped it to the wrong final decision."
  }
  if (missedCriteria.length) {
    return `The final decision matches, but the judge did not score the expected problem criteria low enough: ${missedCriteria.join(", ")}.`
  }
  return "The judge matched the expected calibration behavior."
}

export function buildCalibrationPromptDiagnosis(trace: EvaluationTrace): CalibrationPromptDiagnosis {
  const missedCriteria = trace.calibration?.missed_criteria?.length
    ? trace.calibration.missed_criteria
    : missedExpectedCriteria(trace)
  const actualDecision = trace.calibration?.actual_final_decision || derivedJudgeDecision(trace)
  const expectedDecision = trace.calibration?.expected_final_decision || "-"
  return {
    likelyCause: likelyCauseForFault(trace, actualDecision, missedCriteria),
    nextPromptChange: promptAdviceForFault(trace, actualDecision),
    promptArea: promptAreaForFault(trace),
    whatHappened: `Expected ${expectedDecision}; judge returned ${actualDecision}.`,
  }
}

export function buildCalibrationCaseRows(traces: EvaluationTrace[]): CalibrationCaseRow[] {
  return traces.map((trace) => {
    const missedCriteria = trace.calibration?.missed_criteria?.length
      ? trace.calibration.missed_criteria
      : missedExpectedCriteria(trace)
    const passed = trace.calibration?.status
      ? trace.calibration.status === "passed"
      : calibrationPassed(trace)

    return {
      actualDecision: trace.calibration?.actual_final_decision || derivedJudgeDecision(trace),
      expectedDecision: trace.calibration?.expected_final_decision || "-",
      expectedSignal: calibrationExpectedSignal(trace),
      failureReason: calibrationFailureReason(trace, passed, missedCriteria),
      faultType: readableFaultType(trace.calibration?.fault_type),
      missedCriteria: missedCriteria.length ? missedCriteria.join(", ") : "-",
      question: trace.citizen_question.question_text,
      service: trace.citizen_question.service_title || trace.service_entry?.title || "-",
      status: passed ? "Calibration passed" : "Calibration failed",
      traceId: trace.trace_id,
    }
  })
}

export function buildCalibrationSummary(traces: EvaluationTrace[]): CalibrationSummary {
  const rows = buildCalibrationCaseRows(traces)
  const passedCount = rows.filter((row) => row.status === "Calibration passed").length
  const failedCount = rows.length - passedCount
  const falseAcceptCount = rows.filter(
    (row) => row.expectedDecision !== "accept" && row.actualDecision === "accept",
  ).length
  const falseRejectCount = rows.filter(
    (row) => row.expectedDecision === "accept" && row.actualDecision === "reject",
  ).length

  return {
    cards: [
      { label: "Seeded cases", value: String(rows.length) },
      { label: "Calibration pass rate", value: `${passedCount}/${rows.length}` },
      { label: "Failed calibration cases", value: String(failedCount) },
      { label: "False accepts", value: String(falseAcceptCount) },
      { label: "False rejects", value: String(falseRejectCount) },
    ],
    failedCount,
    falseAcceptCount,
    falseRejectCount,
    passedCount,
    totalCount: rows.length,
  }
}

function latestHumanReview(trace: EvaluationTrace) {
  return humanReviews(trace).at(-1)
}

function reviewDecision(trace: EvaluationTrace) {
  return latestHumanReview(trace)?.final_decision
}

function sameSourceLabel(trace: EvaluationTrace) {
  const humanLabel = latestHumanReview(trace)?.label
  return Boolean(
    humanLabel &&
      humanLabel !== "not_checked" &&
      humanLabel === trace.automated_evaluation.label,
  )
}

function scoreBand(score: number | undefined) {
  if (typeof score !== "number") return "unknown"
  if (score >= 4) return "positive"
  if (score <= 2) return "problem"
  return "borderline"
}

function humanReviewBand(review: HumanReview, criterionKey: EvaluationCriterionKey) {
  if (criterionKey === "source_support") {
    const optionalScore = optionalHumanCriterionScore(review, criterionKey)
    if (review.label === "not_checked") {
      return typeof optionalScore === "number" ? humanScoreEvidenceBand(optionalScore) : "pending"
    }
    const requiredBand = sourceSupportBand(review.label)
    if (typeof optionalScore !== "number") return requiredBand
    const optionalBand = humanScoreEvidenceBand(optionalScore)
    if (requiredBand === optionalBand) return requiredBand
    if (requiredBand === "borderline" && optionalBand === "problem") return "problem"
    return "mixed"
  }
  const score = optionalHumanCriterionScore(review, criterionKey)
  if (typeof score !== "number") return "pending"
  if (hasLegacyMixedChecklistEvidence(review, criterionKey)) return "mixed"
  return humanScoreEvidenceBand(score)
}

function humanReviewValue(review: HumanReview, criterionKey: EvaluationCriterionKey) {
  if (criterionKey === "source_support") {
    if (review.label === "not_checked") return "not checked"
    return review.label
  }
  const score = optionalHumanCriterionScore(review, criterionKey)
  if (typeof score !== "number") return "not rated"
  if (hasLegacyMixedChecklistEvidence(review, criterionKey)) {
    return humanScoreEvidenceValue(3)
  }
  return humanScoreEvidenceValue(score)
}

function optionalHumanCriterionScore(review: HumanReview, criterionKey: EvaluationCriterionKey) {
  return criterionLookupKeys(criterionKey)
    .map((key) => review.criteria?.[key])
    .find((value) => typeof value === "number")
}

function sourceSupportBand(label: string) {
  if (label === "not_checked") return "pending"
  return label === "supported" ? "positive" : label === "unsupported" ? "problem" : "borderline"
}

function humanScoreEvidenceBand(score: number) {
  if (score >= 4) return "positive"
  if (score <= 2) return "problem"
  return "mixed"
}

function humanScoreEvidenceValue(score: number) {
  const band = humanScoreEvidenceBand(score)
  const suffix =
    band === "positive"
      ? "positive signal"
      : band === "problem"
        ? "problem signal"
        : "mixed or borderline signal"
  return `${score} · ${suffix}`
}

const legacyMixedChecklistPhrases: Partial<
  Record<EvaluationCriterionKey, { positive: string[]; problem: string[] }>
> = {
  clarity_actionability: {
    positive: [
      "the next step is clear",
      "the wording is easy to understand",
      "the wording is citizen-friendly enough to act on",
      "der nächste schritt ist klar",
      "die formulierung ist leicht verständlich",
      "die formulierung ist bürgerfreundlich genug",
    ],
    problem: [
      "the answer is hard to understand",
      "the answer is hard to use or act on",
      "die antwort ist schwer verständlich",
      "die antwort ist schwer zu nutzen",
    ],
  },
}

function hasLegacyMixedChecklistEvidence(
  review: HumanReview,
  criterionKey: EvaluationCriterionKey,
) {
  const phrases = legacyMixedChecklistPhrases[criterionKey]
  const comment = review.comment_text?.toLowerCase() || ""
  if (!phrases || !comment.includes("review checklist")) return false
  return (
    phrases.positive.some((phrase) => comment.includes(phrase)) &&
    phrases.problem.some((phrase) => comment.includes(phrase))
  )
}

type HumanEvidenceBand =
  | "borderline"
  | "human_disagreement"
  | "mixed"
  | "pending"
  | "positive"
  | "problem"

function humanCriteriaEvidenceValue(review: HumanReview, criterionKey: EvaluationCriterionKey) {
  if (criterionKey === "source_support") {
    const optionalScore = optionalHumanCriterionScore(review, criterionKey)
    const requiredEvidence =
      review.label === "not_checked"
        ? "No source audit requested"
        : `Source check: ${review.label}`
    if (typeof optionalScore !== "number") return requiredEvidence
    return `${requiredEvidence}; Problem signal: ${humanScoreEvidenceValue(optionalScore)}`
  }
  return humanReviewValue(review, criterionKey)
}

function humanCriteriaResult(trace: EvaluationTrace, criterionKey: EvaluationCriterionKey): {
  band: HumanEvidenceBand
  evidenceItems: DiagnosticHumanEvidenceItem[]
  hasEvidence: boolean
  value: string
} {
  const reviews = humanReviews(trace)
  if (!reviews.length) {
    return {
      band: "pending",
      evidenceItems: [{ reviewerLabel: "", value: "No human review yet" }],
      hasEvidence: false,
      value: "No human review yet",
    }
  }
  const ratedReviews = reviews
    .map((review, index) => ({
      band: humanReviewBand(review, criterionKey),
      identity: reviewIdentity(review, index),
      value: humanCriteriaEvidenceValue(review, criterionKey),
    }))
    .filter((item) => item.band !== "pending")

  if (!ratedReviews.length) {
    return {
      band: "pending",
      evidenceItems: [{ reviewerLabel: "", value: "No optional human signal collected" }],
      hasEvidence: false,
      value: "No optional human signal collected",
    }
  }
  const bands = new Set(ratedReviews.map((item) => item.band))
  if (reviews.length === 1) {
    return {
      band: ratedReviews[0].band as HumanEvidenceBand,
      evidenceItems: [{ reviewerLabel: "", value: ratedReviews[0].value }],
      hasEvidence: true,
      value: ratedReviews[0].value,
    }
  }
  return {
    band: (bands.size > 1 ? "human_disagreement" : ratedReviews[0].band) as HumanEvidenceBand,
    evidenceItems: ratedReviews.map((item) => ({
      reviewerLabel: item.identity,
      value: item.value,
    })),
    hasEvidence: true,
    value: ratedReviews.map((item) => `${item.identity}: ${item.value}`).join("; "),
  }
}

function aggregateRequiredHumanValue(
  reviews: HumanReview[],
  valueForReview: (review: HumanReview) => string | undefined,
) {
  if (!reviews.length) {
    return {
      comparableValue: "",
      displayValue: "No human review yet",
      hasDisagreement: false,
      hasValue: false,
    }
  }
  const values = reviews
    .map((review, index) => ({
      identity: reviewIdentity(review, index),
      value: valueForReview(review) || "",
    }))
    .filter((item) => item.value)
  if (!values.length) {
    return {
      comparableValue: "",
      displayValue: "Not available",
      hasDisagreement: false,
      hasValue: false,
    }
  }
  const uniqueValues = new Set(values.map((item) => item.value))
  return {
    comparableValue: uniqueValues.size === 1 ? values[0].value : "",
    displayValue:
      values.length === 1
        ? values[0].value
        : values.map((item) => `${item.identity}: ${item.value}`).join("; "),
    hasDisagreement: uniqueValues.size > 1,
    hasValue: true,
  }
}

function requiredComparisonStatus(
  aiValue: string,
  human: ReturnType<typeof aggregateRequiredHumanValue>,
): RequiredComparisonStatus {
  if (!human.hasValue) return "pending"
  if (human.hasDisagreement) return "human_disagreement"
  return aiValue === human.comparableValue ? "match" : "mismatch"
}

function requiredCellStatus(aiValue: string, humanValue: string | undefined): RequiredComparisonStatus {
  if (!humanValue) return "pending"
  if (humanValue === "not_checked") return "pending"
  return aiValue === humanValue ? "match" : "mismatch"
}

export function buildRequiredComparisonRows(trace: EvaluationTrace): RequiredComparisonRow[] {
  const reviews = humanReviews(trace)
  const judgeDecision = derivedJudgeDecision(trace)
  const judgeSourceSupport = trace.automated_evaluation.label || "not available"
  const humanDecision = aggregateRequiredHumanValue(reviews, (review) => review.final_decision)
  const humanSourceSupport = aggregateRequiredHumanValue(reviews, (review) =>
    review.label === "not_checked" ? "" : review.label,
  )

  return [
    {
      aiResult: judgeDecision,
      dimensionKey: "final_decision",
      dimensionLabel: "Can it be used?",
      explanation:
        "Direct comparison: AI final decision and mandatory human usability decision use the same accept / needs_edit / reject categories.",
      humanResult: humanDecision.displayValue,
      status: requiredComparisonStatus(judgeDecision, humanDecision),
    },
    {
      aiResult: judgeSourceSupport,
      dimensionKey: "source_support",
      dimensionLabel: "Source concern",
      explanation:
        "Compared only when a human reviewer explicitly marks a source concern. Lightweight reviews may leave source audit unchecked.",
      humanResult: humanSourceSupport.displayValue,
      status: requiredComparisonStatus(judgeSourceSupport, humanSourceSupport),
    },
  ]
}

export function buildRequiredComparisonMatrixRows(trace: EvaluationTrace): RequiredComparisonMatrixRow[] {
  const reviews = humanReviews(trace)
  const evaluations = judgeEvaluations(trace)
  const latestJudgeEvaluation = evaluations.at(-1) || trace.automated_evaluation
  const latestJudgeDecision = judgeDecision(latestJudgeEvaluation)
  const latestJudgeSourceSupport = latestJudgeEvaluation.label || "not available"

  const aiRows: RequiredComparisonMatrixRow[] = evaluations.map((evaluation, index) => ({
    canUse: { status: "pending", value: judgeDecision(evaluation) },
    canVerify: { status: "pending", value: evaluation.label || "not available" },
    reviewerBadge: judgeEvaluationVersionLabel(evaluation, index, evaluations.length),
    reviewerKey: evaluation.judge_rerun_id || evaluation.auto_eval_id || `ai_judge_${index + 1}`,
    reviewerLabel: "AI judge",
    reviewerType: "ai",
  }))

  if (!reviews.length) {
    return [
      ...aiRows,
      {
        canUse: { status: "pending", value: "pending" },
        canVerify: { status: "pending", value: "pending" },
        reviewerKey: "human_pending",
        reviewerLabel: "Human review",
        reviewerType: "human",
      },
    ]
  }

  return [
    ...aiRows,
    ...reviews.map((review, index) => {
      const adjudication = isAdjudicationReview(review)
      return {
        canUse: {
          status: requiredCellStatus(latestJudgeDecision, review.final_decision),
          value: review.final_decision || "pending",
        },
        canVerify: adjudication
          ? { status: "pending" as const, value: "not checked" }
          : {
              status: requiredCellStatus(latestJudgeSourceSupport, review.label),
              value: review.label === "not_checked" ? "not checked" : review.label || "pending",
            },
        reviewerKey: review.review_id || review.reviewer_id || `human_${index + 1}`,
        reviewerLabel: reviewIdentity(review, index),
        reviewerType: "human" as const,
      }
    }),
  ]
}

function diagnosticCriteriaStatus(
  aiBand: string,
  human: ReturnType<typeof humanCriteriaResult>,
): DiagnosticCriteriaStatus {
  if (aiBand === "unknown") return "ai_not_available"
  if (human.band === "human_disagreement") return "human_disagreement"
  if (!human.hasEvidence) {
    return aiBand === "problem" ? "ai_concern_no_human_signal" : "no_human_signal"
  }
  if (human.band === "mixed" || human.band === "borderline") return "mixed_or_partial"
  if (human.band === "problem" && aiBand === "problem") return "shared_concern"
  if (human.band === "problem") return "human_concern_ai_missed"
  if (aiBand === "problem") return "ai_concern_not_confirmed"
  if (human.band === "positive" && aiBand === "positive") return "aligned_positive"
  return "mixed_or_partial"
}

export function buildDiagnosticCriteriaRows(trace: EvaluationTrace): DiagnosticCriteriaRow[] {
  return criterionDefinitions.map(({ key, label }) => {
    const evaluations = trace.judge_evaluations?.length
      ? trace.judge_evaluations
      : [trace.automated_evaluation]
    const aiResultItems = evaluations.flatMap((evaluation, index) => {
      const criterion = criterionLookupKeys(key)
        .map((criterionKey) => evaluation.criteria?.[criterionKey])
        .find(Boolean)
      if (!criterion) return []
      return [{
        label: evaluation.judge_prompt_version || (index === 0 ? "baseline" : `rerun ${index}`),
        value: `${criterion.score} · ${criterion.label}`,
      }]
    })
    const latestAiItem = aiResultItems.at(-1)
    const latestEvaluation = evaluations.at(-1)
    const ai = latestEvaluation
      ? criterionLookupKeys(key)
          .map((criterionKey) => latestEvaluation.criteria?.[criterionKey])
          .find(Boolean)
      : undefined
    const human = humanCriteriaResult(trace, key)
    const aiBand = scoreBand(ai?.score)

    return {
      aiResult: latestAiItem?.value || (ai ? `${ai.score} · ${ai.label}` : "not available"),
      aiResultItems,
      criterionKey: key,
      criterionLabel: label,
      humanEvidence: human.value,
      humanEvidenceItems: human.evidenceItems,
      status: diagnosticCriteriaStatus(aiBand, human),
    }
  })
}

export function buildTraceSummary(trace: EvaluationTrace): DeveloperLabSummary {
  const review = latestHumanReview(trace)
  const disagreement = trace.disagreement_case
  const humanDisagreement = hasHumanDisagreement(trace)
  const decision = reviewDecision(trace)

  const risk: DeveloperLabSignal = (() => {
    if (humanDisagreement) {
      return {
        label: "Human-human disagreement",
        detail: "Independent human reviews disagree and need adjudication.",
        tone: "warning",
      }
    }
    if (disagreement?.severity === "high") {
      return {
        label: "High risk",
        detail: "Recorded disagreement needs technical inspection.",
        tone: "danger",
      }
    }
    if (disagreement || decision === "reject" || decision === "needs_edit") {
      return {
        label: "Needs attention",
        detail: "Human feedback or disagreement indicates a quality issue.",
        tone: "warning",
      }
    }
    if (!review) {
      return {
        label: "Pending review",
        detail: "Automated result exists, but the human side is missing.",
        tone: "quiet",
      }
    }
    return {
      label: "Low risk",
      detail: "No disagreement is recorded for this trace.",
      tone: "ready",
    }
  })()

  const alignment: DeveloperLabSignal = (() => {
    if (!review) {
      return {
        label: "Human review missing",
        detail: "The trace cannot yet be compared with human feedback.",
        tone: "quiet",
      }
    }
    if (humanDisagreement) {
      return {
        label: "Human-human disagreement",
        detail: "Human reviewers disagree before AI-human comparison.",
        tone: "warning",
      }
    }
    if (disagreement) {
      return {
        label: "Auto-human mismatch",
        detail: disagreement.flag_reason,
        tone: "danger",
      }
    }
    if (sameSourceLabel(trace)) {
      return {
        label: "Same source label",
        detail: "Automated and human source-support labels currently align.",
        tone: "ready",
      }
    }
    return {
      label: "Different quality signal",
      detail: "Final human decision differs from the automated quality impression.",
      tone: "warning",
    }
  })()

  const likelyIssue: DeveloperLabSignal = (() => {
    if (!review) {
      return {
        label: "No human signal yet",
        detail: "Generate or collect a human review before diagnosing the case.",
        tone: "quiet",
      }
    }
    if (trace.citizen_question.requires_clarification) {
      return {
        label: "Question ambiguity",
        detail: "The citizen question may need clarification before a confident answer.",
        tone: "warning",
      }
    }
    if (disagreement?.disagreement_type?.includes("label_mismatch") || disagreement) {
      return {
        label: "Judge calibration",
        detail: "The automated evaluator may be too lenient, too strict, or using the wrong label.",
        tone: "danger",
      }
    }
    if ((review.criteria?.completeness ?? 5) <= 2) {
      return {
        label: "Completeness",
        detail: "Human feedback suggests that important parts may be missing.",
        tone: "warning",
      }
    }
    if ((review.criteria?.clarity_actionability ?? 5) <= 2) {
      return {
        label: "Answer usability",
        detail: "The answer may be difficult to understand or act on.",
        tone: "warning",
      }
    }
    return {
      label: "No obvious issue",
      detail: "Use the detail panels if deeper inspection is needed.",
      tone: "ready",
    }
  })()

  return { alignment, likelyIssue, risk }
}

export function buildWorklistItem(trace: EvaluationTrace): DeveloperWorklistItem {
  return buildWorklistItemWithTarget(trace, 2)
}

export function buildWorklistItemWithTarget(
  trace: EvaluationTrace,
  requiredHumanReviews?: number,
): DeveloperWorklistItem {
  const reviews = humanReviews(trace)
  const hasHumanReview = reviews.length > 0
  const humanDisagreement = hasHumanDisagreement(trace)
  const disagreement = Boolean(trace.disagreement_case)
  const decision = reviewDecision(trace)
  const needsAttention = humanDisagreement || disagreement || decision === "reject" || decision === "needs_edit"
  const importedAnswer = trace.generated_answer?.generation_mode === "imported_chatbot_answer"
  const defaultTarget = importedAnswer && reviews.length ? reviews.length : 2
  const target = Math.max(1, requiredHumanReviews ?? defaultTarget)

  return {
    disagreement,
    humanDisagreement,
    humanReviewCount: reviews.length,
    humanStatus: hasHumanReview ? `${reviews.length}/${target} human reviews` : "Human review missing",
    primaryStatus: needsAttention ? "Needs attention" : "AI evaluated",
    trace,
  }
}

export function buildRunCaseRows(
  items: DeveloperWorklistItem[],
  reviewTargets: Record<string, number> = {},
): RunCaseRow[] {
  return items.map((item) => {
    const trace = item.trace
    const reviews = humanReviews(trace)
    const review = reviews.at(-1)
    const hasAnswer = Boolean(trace.generated_answer?.answer_text)
    const hasJudge = Boolean(trace.automated_evaluation)
    const evaluations = hasJudge ? judgeEvaluations(trace) : []
    const baselineJudgeDecision = evaluations.length ? judgeDecision(evaluations[0]) : ""
    const latestJudgeEvaluation = evaluations.at(-1)
    const latestJudgeDecision = latestJudgeEvaluation ? judgeDecision(latestJudgeEvaluation) : "Judge missing"
    const judgeChangedFrom =
      evaluations.length > 1 && baselineJudgeDecision && latestJudgeDecision !== baselineJudgeDecision
        ? baselineJudgeDecision
        : ""
    const attention = (() => {
      // A missing answer outranks every other signal: there is nothing to judge
      // and nothing to review, so the case cannot progress at all. This used to
      // be its own table column, which printed "Answer generated" on every row
      // of every completed run — a column whose value never varied. Folding the
      // exception into the attention chain keeps the information and drops the
      // column.
      if (!hasAnswer) {
        return {
          label: "Answer missing",
          tone: "danger" as const,
        }
      }
      if (item.humanDisagreement) {
        return {
          label: "Human-human disagreement",
          tone: "notice" as const,
        }
      }
      if (item.disagreement) {
        return {
          label: "AI-human mismatch",
          tone: "danger" as const,
        }
      }
      if (review?.final_decision === "reject" || review?.final_decision === "needs_edit") {
        return {
          label: "Human marked issue",
          tone: "warning" as const,
        }
      }
      if (!review) {
        return {
          label: "Waiting for human review",
          tone: "quiet" as const,
        }
      }
      return {
        label: "No attention signal",
        tone: "ready" as const,
      }
    })()

    return {
      attention: attention.label,
      attentionTone: attention.tone,
      // Show the actual human decision(s) as pills (like the judge column)
      // instead of a review count; an empty list falls back to "Human pending".
      humanDecisions: reviews
        .map((entry) => entry.final_decision)
        .filter((decision): decision is ReviewDecision => isReviewDecision(decision)),
      humanStatus: reviews.length
        ? `${reviews.length}/${Math.max(
            1,
            reviewTargets[trace.trace_id] ??
              (trace.generated_answer?.generation_mode === "imported_chatbot_answer" ? reviews.length : 2),
          )} reviews`
        : "Human pending",
      judgeChangedFrom,
      judgeStatus: hasJudge ? latestJudgeDecision : "Judge missing",
      question: trace.citizen_question.question_text,
      traceId: trace.trace_id,
    }
  })
}

export function buildPipelineStatus(trace: EvaluationTrace): PipelineStatusItem[] {
  const hasAnswer = Boolean(trace.generated_answer?.answer_text)
  const hasJudge = Boolean(trace.automated_evaluation)
  const reviews = humanReviews(trace)
  const hasHumanReview = reviews.length > 0
  const hasDisagreement = Boolean(trace.disagreement_case)

  return [
    {
      label: "AI answer",
      value: hasAnswer ? "Generated" : "Missing",
      tone: hasAnswer ? "ready" : "warning",
      detail: trace.generated_answer?.generation_mode,
    },
    {
      label: "AI judge",
      value: hasJudge ? "Evaluated" : "Missing",
      tone: hasJudge ? "ready" : "warning",
      detail: trace.automated_evaluation?.evaluation_mode,
    },
    {
      label: "Human review",
      value: hasHumanReview ? "Available" : "Missing",
      tone: hasHumanReview ? "ready" : "quiet",
      detail: reviews.length ? `${reviews.length}/2 reviews` : undefined,
    },
    {
      label: "Disagreement",
      value: hasDisagreement ? "Recorded" : "No disagreement",
      tone: hasDisagreement ? "warning" : "ready",
      detail: trace.disagreement_case?.severity,
    },
  ]
}

export function buildHumanReviewStatus(trace: EvaluationTrace): CaseSummaryLine {
  const reviews = humanReviews(trace)
  if (!reviews.length) {
    return {
      label: "No human review",
      detail: "Waiting for reviewer feedback.",
    }
  }
  const latest = reviews[reviews.length - 1]
  if (hasHumanDisagreement(trace)) {
    return {
      label: `${reviews.length} human reviews`,
      detail: "Human reviewers disagree; adjudication is needed.",
    }
  }
  return {
    label: reviews.length === 1 ? "1 human review" : `${reviews.length} human reviews`,
    detail: `Decision: ${latest.final_decision}`,
  }
}

export function buildHumanJudgeComparison(trace: EvaluationTrace): CaseSummaryLine {
  const reviews = humanReviews(trace)
  const review = reviews.at(-1)
  if (!review) {
    return {
      label: "Waiting for human review",
      detail: "The AI judge result cannot be compared yet.",
    }
  }
  if (hasHumanDisagreement(trace)) {
    return {
      label: "Human-human disagreement",
      detail: "Human reviewers disagree; adjudication is needed.",
    }
  }
  if (review.label === trace.automated_evaluation.label) {
    return {
      label: "Judge and human source support match",
      detail: `Both use: ${review.label}`,
    }
  }
  return {
    label: "Judge and human source support differ",
    detail: `Judge: ${trace.automated_evaluation.label}; human: ${review.label}`,
  }
}

export function buildCompactRunInfo(trace: EvaluationTrace): [string, string][] {
  const evaluations = judgeEvaluations(trace)
  const latestJudge = evaluations.at(-1) || trace.automated_evaluation

  return [
    ["Answer model", trace.generated_answer.model_name || "-"],
    [
      "Answer prompt",
      trace.generated_answer.answer_prompt_version || trace.generated_answer.prompt_version || "-",
    ],
    ["Latest judge", latestJudge.judge_model_name || latestJudge.evaluation_mode || "-"],
    ["Judge prompt", latestJudge.judge_prompt_version || "-"],
    ["Judge evaluations", String(evaluations.length || 1)],
  ]
}

export function buildCaseRunPolicy(trace: EvaluationTrace): CaseRunPolicy {
  const variant = trace.variant || ""
  if (variant.startsWith("study_run")) {
    return {
      canOverwrite: false,
      label: "Frozen study case",
      detail: "This answer and judge result should stay unchanged so multiple reviewers evaluate the same case.",
      nextAction: "Create a new experiment if prompts need to change.",
    }
  }
  if (variant.startsWith("sample")) {
    return {
      canOverwrite: false,
      label: "Demo seed case",
      detail: "This tracked sample case is used for reproducible demos and should not be overwritten.",
      nextAction: "Create an experiment run from this case.",
    }
  }
  return {
    canOverwrite: true,
    label: "Developer experiment",
    detail: "This case can be regenerated while testing prompts, models, and judge settings.",
    nextAction: "Promote a stable batch to a frozen study run before human review.",
  }
}

export function buildStudyRunSummary(
  items: DeveloperWorklistItem[],
  questionCount: number,
  reviewsPerQuestion = 2,
): StudyRunSummary {
  const traces = items.map((item) => item.trace)
  const frozenTraces = traces.filter((trace) => (trace.variant || "").startsWith("study_run"))
  return {
    answerCount: traces.filter((trace) => Boolean(trace.generated_answer?.answer_text)).length,
    caseCount: traces.length,
    frozenCaseCount: frozenTraces.length,
    judgeCount: traces.filter((trace) => Boolean(trace.automated_evaluation)).length,
    questionCount,
    requiredHumanReviews: questionCount * reviewsPerQuestion,
  }
}

export function formatActiveRunLabel(
  activeRun: DeveloperActiveRun,
  language: Language = "en",
): string {
  if (!activeRun) return language === "de" ? "Kein aktiver Lauf" : "No active run"
  const runType = runTypeLabel(activeRun.batch_type, language) || activeRun.batch_type
  const importFilename = activeRun.batch_type === "external_evaluation_run"
    ? String(activeRun.metadata?.import_filename || "").trim()
    : ""
  const caseLabel = language === "de"
    ? activeRun.question_count === 1 ? "Fall" : "Fälle"
    : activeRun.question_count === 1 ? "case" : "cases"
  return [runType, importFilename, `${activeRun.question_count} ${caseLabel}`]
    .filter(Boolean)
    .join(" · ")
}

function localizedRunTypeLabel(batchType: string, language: Language) {
  return runTypeLabel(batchType, language) || batchType.replaceAll("_", " ")
}

export function formatReviewerRunOptionLabel(
  batch: NonNullable<DeveloperActiveRun>,
  language: Language,
) {
  const importFilename = batch.batch_type === "external_evaluation_run"
    ? String(batch.metadata?.import_filename || "").trim()
    : ""
  const status = runStatusLabel(batch.status, language)
  const caseLabel = language === "de"
    ? batch.question_count === 1 ? "Fall" : "Fälle"
    : batch.question_count === 1 ? "case" : "cases"
  return [
    importFilename || localizedRunTypeLabel(batch.batch_type, language),
    formatBatchDate(batch.created_at, language),
    `${batch.question_count} ${caseLabel}`,
    status,
    shortRunId(batch.batch_id),
  ].filter(Boolean).join(" · ")
}

function shortRunId(batchId: string) {
  const normalized = batchId.replace(/^batch_/, "")
  return `#${normalized.slice(-6)}`
}

function reviewerRunOptionDetail(
  batch: NonNullable<DeveloperActiveRun>,
  language: Language,
) {
  const model = String(batch.metadata?.model_name || "").trim()
  const status = runStatusLabel(batch.status, language)
  const caseLabel = language === "de"
    ? batch.question_count === 1 ? "Fall" : "Fälle"
    : batch.question_count === 1 ? "case" : "cases"
  return [
    formatBatchDate(batch.created_at, language),
    localizedRunTypeLabel(batch.batch_type, language),
    `${batch.question_count} ${caseLabel}`,
    status,
    model,
  ].filter(Boolean).join(" · ")
}

export function buildResultsEmptyState({
  activeRun,
  itemCount,
  loading,
}: {
  activeRun: DeveloperActiveRun
  itemCount: number
  loading: boolean
}): ResultsEmptyState | null {
  if (loading) return null

  if (!activeRun) {
    return {
      description: "No active run yet. Run a 5-question test to create the first cases.",
      detail: "",
      title: "No active run",
      tone: "quiet",
    }
  }

  const runIssueNotice = buildRunIssueNotice(activeRun)
  if (runIssueNotice) return runIssueNotice

  if (!itemCount) {
    return {
      description: "No active run yet. Run a 5-question test to create the first cases.",
      detail: "",
      title: "No active run",
      tone: "quiet",
    }
  }

  return null
}

export function buildResultsBatchDetailRows(batch: NonNullable<DeveloperActiveRun>) {
  const metadata = batch.metadata || {}
  const rows: [string, string][] = [
    ["Batch ID", batch.batch_id],
    ["Created", batch.created_at],
    ["Run type", batch.batch_type],
    ["Cases", String(batch.question_count)],
    ["Model", String(metadata.model_name || "").trim()],
    ["Answer prompt", String(metadata.answer_prompt_version || "").trim()],
    ["Judge prompt", String(metadata.judge_prompt_version || "").trim()],
  ]

  return rows.filter(([, value]) => Boolean(value))
}

export function buildReviewerRunSelectOptions(
  batchHistory: NonNullable<DeveloperActiveRun>[],
  selectedBatchId: string,
  language: Language,
) {
  return {
    disabled: !batchHistory.length,
    emptyLabel: "No saved runs yet",
    options: batchHistory.map((batch) => ({
      detail: reviewerRunOptionDetail(batch, language),
      label: formatReviewerRunOptionLabel(batch, language),
      shortId: shortRunId(batch.batch_id),
      title: batch.batch_type === "external_evaluation_run"
        ? String(batch.metadata?.import_filename || "").trim() || localizedRunTypeLabel(batch.batch_type, language)
        : localizedRunTypeLabel(batch.batch_type, language),
      value: batch.batch_id,
    })),
    selectedBatchId,
  }
}

export function buildRunSetupOverview({
  activeRun,
  answerCount,
  answerPromptVersion,
  humanReviewCount,
  judgeCount,
  judgePromptVersion,
  language = "en",
  modelName,
  questionCount,
}: {
  activeRun: DeveloperActiveRun
  answerCount: number
  answerPromptVersion: string
  humanReviewCount: number
  judgeCount: number
  judgePromptVersion: string
  language?: Language
  modelName: string
  questionCount: number
}): RunSetupOverview {
  const title = formatActiveRunLabel(activeRun, language)
  const metadata = activeRun?.metadata
  const isFrozen = Boolean(metadata?.frozen) || activeRun?.batch_type === "study_run"
  const status = isFrozen ? "frozen" : activeRun?.status || "not started"
  const persistedModelName = metadataText(metadata, "model_name", modelName)
  const persistedAnswerPromptVersion = metadataText(metadata, "answer_prompt_version", answerPromptVersion)
  const persistedJudgePromptVersion = metadataText(metadata, "judge_prompt_version", judgePromptVersion)
  const technicalDetails: [string, string][] = activeRun
    ? [
        ["Model", persistedModelName],
        ["Created", activeRun.created_at],
        ["Run type", activeRun.batch_type],
        ["Answer prompt", persistedAnswerPromptVersion],
        ["Judge prompt", persistedJudgePromptVersion],
      ]
    : [
        ["Model", modelName],
        ["Answer prompt", answerPromptVersion],
        ["Judge prompt", judgePromptVersion],
      ]

  return {
    progressCards: [
      { label: "Generated answers", value: `${answerCount}/${questionCount}` },
      { label: "Judge evaluations", value: `${judgeCount}/${questionCount}` },
      { label: "Human reviews", value: `${humanReviewCount}/${questionCount}` },
    ],
    status,
    technicalDetails,
    title,
  }
}

export function buildReviewerBatchPlan({
  questionCount,
  reviewerCount,
  reviewsPerQuestion,
}: {
  questionCount: number
  reviewerCount: number
  reviewsPerQuestion: number
}): ReviewerBatchPlan {
  const totalAssignments = questionCount * reviewsPerQuestion
  const base = Math.floor(totalAssignments / reviewerCount)
  const remainder = totalAssignments % reviewerCount
  const assignmentsPerReviewer = Array.from({ length: reviewerCount }, (_, index) =>
    index < remainder ? base + 1 : base,
  )
  const min = Math.min(...assignmentsPerReviewer)
  const max = Math.max(...assignmentsPerReviewer)
  return {
    assignmentsPerReviewer,
    reviewerCount,
    reviewsPerQuestion,
    totalAssignments,
    summary: `${reviewerCount} reviewers · ${totalAssignments} assignments · ${
      min === max ? min : `${min}-${max}`
    } cases each`,
  }
}

export function buildReviewerAssignmentPlan({
  baseUrl,
  batchId = "",
  reviewerCount,
  reviewsPerQuestion,
  traces,
}: {
  baseUrl: string
  batchId?: string
  reviewerCount: number
  reviewsPerQuestion: number
  traces: EvaluationTrace[]
}): ReviewerAssignmentPlan {
  const participants: ReviewerAssignmentParticipant[] = Array.from(
    { length: reviewerCount },
    (_, index) => {
      const participantId = `P${String(index + 1).padStart(2, "0")}`
      const reviewUrl = new URL(baseUrl)
      reviewUrl.searchParams.set("role", "review_batch")
      reviewUrl.searchParams.set("participant", participantId)
      if (batchId) {
        reviewUrl.searchParams.set("batch_id", batchId)
      }
      return {
        assignedTraceIds: [],
        completedReviews: 0,
        participantId,
        reviewUrl: reviewUrl.toString(),
      }
    },
  )

  const caseReviewTargets: Record<string, number> = {}
  let assignmentIndex = 0
  traces.forEach((trace) => {
    caseReviewTargets[trace.trace_id] = reviewsPerQuestion
    for (let reviewIndex = 0; reviewIndex < reviewsPerQuestion; reviewIndex += 1) {
      const participant = participants[assignmentIndex % participants.length]
      participant.assignedTraceIds.push(trace.trace_id)
      assignmentIndex += 1
    }
  })

  const batchPlan = buildReviewerBatchPlan({
    questionCount: traces.length,
    reviewerCount,
    reviewsPerQuestion,
  })

  return {
    batchId,
    caseReviewTargets,
    participants,
    profileFields: [
      "reviewer_background",
      "public_service_familiarity",
      "llm_familiarity",
      "language_confidence_de",
    ],
    reviewerCount,
    reviewsPerQuestion,
    summary: batchPlan.summary,
    totalAssignments: batchPlan.totalAssignments,
  }
}

export function buildReviewerLinkForBatch(reviewUrl: string, batchId: string) {
  try {
    const nextUrl = new URL(reviewUrl)
    nextUrl.pathname = "/"
    nextUrl.searchParams.set("role", "review_batch")
    if (batchId.trim()) {
      nextUrl.searchParams.set("batch_id", batchId.trim())
    }
    return nextUrl.toString()
  } catch {
    if (!batchId.trim()) return reviewUrl
    const separator = reviewUrl.includes("?") ? "&" : "?"
    return `${reviewUrl}${separator}batch_id=${encodeURIComponent(batchId.trim())}`
  }
}

export function buildReviewerParticipantLinkState(
  reviewUrl: string,
  batchId: string,
  reviewerPlan: { status?: string } | null,
): {
  canOpen: boolean
  displayUrl: string
} {
  return {
    canOpen: reviewerPlan?.status !== "closed",
    displayUrl: buildReviewerLinkForBatch(reviewUrl, batchId),
  }
}

export function buildReviewerPlanStatus(
  reviewerPlan: { status?: string } | null,
): {
  badgeLabel: string
  canClose: boolean
  isClosed: boolean
} {
  if (!reviewerPlan) {
    return {
      badgeLabel: "No reviewer links yet",
      canClose: false,
      isClosed: false,
    }
  }
  const isClosed = reviewerPlan.status === "closed"
  return {
    badgeLabel: isClosed ? "Reviewer links closed" : "Reviewer links ready",
    canClose: !isClosed,
    isClosed,
  }
}

export function buildReviewerRunSummary(
  activeRun: DeveloperActiveRun,
  language: Language = "en",
): {
  summary: string
  title: string
} {
  if (!activeRun) {
    return {
      summary: "",
      title: formatActiveRunLabel(null, language),
    }
  }
  const metadata = activeRun.metadata || {}
  const answerPrompt = metadataText(metadata, "answer_prompt_version", "")
  const judgePrompt = metadataText(metadata, "judge_prompt_version", "")
  return {
    summary: [
      activeRun.batch_id,
      formatReviewerRunOptionLabel(activeRun, language),
      answerPrompt ? `Answer prompt: ${answerPrompt}` : "",
      judgePrompt ? `Judge prompt: ${judgePrompt}` : "",
    ].filter(Boolean).join(" · "),
    title: formatActiveRunLabel(activeRun, language),
  }
}

function numericMetadataValue(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key]
  if (typeof value === "number") return value
  if (typeof value === "string" && value.trim()) return Number(value) || 0
  return 0
}

export function buildReviewerPlanCreateState(
  activeRun: DeveloperActiveRun,
  reviewerPlan: { status?: string } | null,
  hasImportedHumanLabels = false,
): {
  canCreate: boolean
  reason: string
} {
  if (!activeRun) {
    return {
      canCreate: false,
      reason: "Create an evaluation run before generating reviewer links.",
    }
  }
  if (activeRun.status === "failed") {
    return {
      canCreate: false,
      reason: "This run failed before creating evaluation cases. Retry or create another run before generating reviewer links.",
    }
  }
  if (reviewerPlan) {
    if (reviewerPlan.status === "closed") {
      return {
        canCreate: false,
        reason: "Reviewer links are closed and kept for traceability.",
      }
    }
    return {
      canCreate: false,
      reason: "Reviewer links already exist for this run.",
    }
  }
  if (
    hasImportedHumanLabels ||
    (
      activeRun.metadata?.input_source === "imported_chatbot_answers" &&
      numericMetadataValue(activeRun.metadata, "imported_human_label_count") > 0
    )
  ) {
    return {
      canCreate: false,
      reason: "This imported run already contains human labels. Normal reviewer links are disabled.",
    }
  }
  return {
    canCreate: true,
    reason: "",
  }
}

export function traceHasImportedHumanLabel(trace: EvaluationTrace) {
  if (trace.generated_answer?.generation_mode !== "imported_chatbot_answer") return false
  return humanReviews(trace).some(
    (review) =>
      review.reviewer_role === "imported_reference" ||
      review.reviewer_id === "imported_human_label",
  )
}

function hasSourceConcern(trace: EvaluationTrace) {
  return humanReviews(trace).some((review) =>
    ["partly_supported", "unsupported"].includes(review.label),
  )
}

function isAiFalseAccept(trace: EvaluationTrace) {
  const humanDecision = reviewDecision(trace)
  return (
    Boolean(trace.automated_evaluation) &&
    derivedJudgeDecision(trace) === "accept" &&
    Boolean(humanDecision) &&
    humanDecision !== "accept"
  )
}

function latestJudgeFilterDecision(trace: EvaluationTrace) {
  if (!trace.automated_evaluation) return ""
  const latestEvaluation = judgeEvaluations(trace).at(-1)
  return latestEvaluation ? judgeDecision(latestEvaluation) : ""
}

export function buildSelectedCaseState(
  items: DeveloperWorklistItem[],
  selectedTraceId: string,
): SelectedCaseState {
  const exists = items.some((item) => item.trace.trace_id === selectedTraceId)
  return {
    canOpen: exists,
    selectedTraceId: exists ? selectedTraceId : "",
  }
}

export function filterWorklistItems(
  items: DeveloperWorklistItem[],
  filter: WorklistFilter,
) {
  if (filter === "human_missing") {
    return items.filter((item) => item.humanReviewCount === 0)
  }
  if (filter === "mismatch") {
    return items.filter((item) => item.disagreement)
  }
  if (filter === "human_disagreement") {
    return items.filter((item) => item.humanDisagreement)
  }
  if (filter === "source_concern") {
    return items.filter((item) => hasSourceConcern(item.trace))
  }
  if (filter === "ai_false_accept") {
    return items.filter((item) => isAiFalseAccept(item.trace))
  }
  if (filter === "accept" || filter === "needs_edit" || filter === "reject") {
    return items.filter((item) => reviewDecision(item.trace) === filter)
  }
  if (filter === "judge_accept") {
    return items.filter((item) => latestJudgeFilterDecision(item.trace) === "accept")
  }
  if (filter === "judge_needs_edit") {
    return items.filter((item) => latestJudgeFilterDecision(item.trace) === "needs_edit")
  }
  if (filter === "judge_reject") {
    return items.filter((item) => latestJudgeFilterDecision(item.trace) === "reject")
  }
  if (filter === "needs_attention") {
    return items.filter((item) => item.primaryStatus === "Needs attention")
  }
  return items
}

export function sortWorklistItems(
  items: DeveloperWorklistItem[],
  sort: WorklistSort,
) {
  return items
    .map((item, index) => ({ index, item }))
    .sort((left, right) => {
      const leftValue = worklistSortRank(left.item, sort)
      const rightValue = worklistSortRank(right.item, sort)
      return (
        leftValue - rightValue ||
        compareByQuestionId(left.item, right.item) ||
        left.index - right.index
      )
    })
    .map(({ item }) => item)
}

function compareByQuestionId(
  left: DeveloperWorklistItem,
  right: DeveloperWorklistItem,
) {
  const leftKey = left.trace.citizen_question?.question_id ?? ""
  const rightKey = right.trace.citizen_question?.question_id ?? ""
  return leftKey.localeCompare(rightKey)
}

function worklistSortRank(item: DeveloperWorklistItem, sort: WorklistSort) {
  if (sort === "attention_first") {
    return item.primaryStatus === "Needs attention" ? 0 : 1
  }
  if (sort === "human_missing_first") {
    return item.humanReviewCount === 0 ? 0 : 1
  }
  if (sort === "reviewed_first") {
    return item.humanReviewCount > 0 ? 0 : 1
  }
  return 0
}

export function firstWorklistTraceId(items: DeveloperWorklistItem[]) {
  return items[0]?.trace.trace_id || ""
}
