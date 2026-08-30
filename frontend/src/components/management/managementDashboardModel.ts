import type { DeveloperRun, EvaluationTrace, HumanReview, JudgeEvaluation, ReviewDecision, TokenUsage } from "@/types"
import {
  adjudicationReviewerId,
  automatedDecision,
  hasHumanReviewDisagreement,
  humanReviews,
  isResolvedAdjudicationReview,
  isReviewDecision,
  majorityValue,
} from "../shared/evaluationTraceModel.ts"
import { roundOne } from "../../lib/numberUtils.ts"

export type ManagementAssumptions = {
  availableReviewers: number
  hourlyRate: number
  judgeCostPer1kTokens?: number
  minimumReviewedCases?: number
  minutesPerReview: number
  reviewerMinutesPerDay: number
  reviewsPerCase: number
}

export type ReviewEffortEstimate = {
  assignments: number
  calendarDays: number
  cases: number
  cost: number
  personHours: number
  reviewersNeededForOneDay: number
}

export type ReviewScenario = {
  cases: number
  description: string
  estimate: ReviewEffortEstimate
  id: "minimum_pilot" | "balanced_review" | "high_assurance" | "ai_triage"
  label: string
}

export type ActionBacklogItem = {
  count: number
  id:
    | "check_source_concerns"
    | "complete_missing_reviews"
    | "fix_needs_edit_answers"
    | "inspect_ai_false_accepts"
    | "resolve_human_disagreement"
  label: string
}

export type ManagementSignal = {
  detail: string
  label: string
  tone: "danger" | "ready" | "warning"
}

export type AiJudgeReliabilitySummary = {
  comparableCases: number
  excludedSplitCases: number
  falseAcceptCases: number
  matchRate: number
  matches: number
  verdict: {
    detail: string
    // Local tone union: importing CockpitTone from managementCockpitModel.ts would be
    // circular, and the structural type is compatible.
    tone: "danger" | "quiet" | "ready" | "warning"
  }
}

export type ManagementDecisionSummary = {
  detail: string
  nextActionLabel: string
  status: string
  tone: "danger" | "ready" | "warning"
}

export type JudgeTokenUsageSummary = {
  recordedCases: number
  status: "not_recorded" | "partial" | "recorded"
  totalCases: number
  totalTokens: number
}

export type ManagementCostComparison = {
  humanReviewAssignments: number
  humanReviewCost: number
  humanReviewHours: number
  judgeCostCurrency: "EUR" | "USD"
  judgeCostPer1kTokens: number
  judgeCostSource: "manual_per_1k" | "trace_estimate"
  judgePricingDetail: string
  judgeTokenCost: number | null
  judgeTokenUsage: JudgeTokenUsageSummary
}

export type PilotChecklistItem = {
  detail: string
  id:
    | "adjudication_clear"
    | "follow_up_clear"
    | "human_review_collected"
    | "minimum_coverage"
    | "second_review"
    | "source_concerns"
  label: string
  passed: boolean
}

export type RiskGroup = {
  cases: number
  label: string
  rate: number
  riskCases: number
}

export type OversightStatus =
  | "Insufficient evidence"
  | "Needs adjudication"
  | "Needs follow-up"
  | "No human review yet"
  | "Ready for monitored pilot"

export type ManagementDashboardModel = {
  after: {
    acceptedCases: number
    actionBacklog: ActionBacklogItem[]
    auditEvidence: ManagementSignal
    aiHumanMismatchCases: number
    aiJudgeReliability: AiJudgeReliabilitySummary
    casesNeedingSecondReview: number
    decisionSummary: ManagementDecisionSummary
    hasHumanReview: boolean
    humanDisagreementCases: number
    minimumReviewedCases: number
    missingReviewAssignments: number
    needsEditCases: number
    pendingCases: number
    pilotChecklist: PilotChecklistItem[]
    readinessReason: string
    readinessStatus: OversightStatus
    recommendedAction: ManagementSignal
    rejectedCases: number
    remainingEstimate: ReviewEffortEstimate
    resolvedAdjudicationCases: number
    reviewCoveragePercent: number
    reviewedCases: number
    riskByService: RiskGroup[]
    sourceConcernCases: number
    totalCases: number
    totalReviews: number
    unresolvedDecisionCases: number
    unresolvedActionCases: number
    monitoringSummary: ManagementSignal
  }
  before: {
    aiAcceptedAllCases: number
    aiFlaggedRiskCases: number
    aiFoundIssueCases: number
    aiTriageCases: number
    customEstimate: ReviewEffortEstimate
    decisionSummary: ManagementDecisionSummary
    recommendedAction: ManagementSignal
    scenarios: ReviewScenario[]
    suggestedReviewStrategy: string
    thinSourceContextCases: number
    totalCases: number
    triageMessage: string
    triageStatus: "AI triage only"
    unsupportedClaimsCases: number
  }
  costComparison: ManagementCostComparison
}

function clampPositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function positiveInteger(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numberValue) || numberValue < 1) return null
  return Math.round(numberValue)
}

function reviewerPlanMetadata(run: DeveloperRun | null | undefined) {
  const plan = run?.metadata?.reviewer_plan
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return null
  return plan as Record<string, unknown>
}

export function hasReviewerAssignmentPlan(run: DeveloperRun | null | undefined) {
  return Boolean(reviewerPlanMetadata(run))
}

export function deriveManagementAssumptionsForRun(
  assumptions: ManagementAssumptions,
  run: DeveloperRun | null | undefined,
): ManagementAssumptions {
  const plan = reviewerPlanMetadata(run)
  const reviewerCount = positiveInteger(plan?.reviewer_count)
  const reviewsPerQuestion = positiveInteger(plan?.reviews_per_question)
  const questionCount = positiveInteger(run?.question_count)
  const nextAssumptions = { ...assumptions }

  if (reviewerCount) nextAssumptions.availableReviewers = reviewerCount
  if (reviewsPerQuestion) nextAssumptions.reviewsPerCase = reviewsPerQuestion
  if (questionCount && nextAssumptions.minimumReviewedCases) {
    nextAssumptions.minimumReviewedCases = Math.min(
      nextAssumptions.minimumReviewedCases,
      questionCount,
    )
  }

  return nextAssumptions
}

export function estimateReviewEffort({
  availableReviewers,
  cases,
  hourlyRate,
  minutesPerReview,
  reviewerMinutesPerDay,
  reviewsPerCase,
}: ManagementAssumptions & { cases: number }): ReviewEffortEstimate {
  const safeCases = Math.max(0, Math.round(cases))
  const safeReviewsPerCase = clampPositive(reviewsPerCase, 1)
  const safeMinutes = clampPositive(minutesPerReview, 5)
  const safeHourlyRate = Math.max(0, hourlyRate)
  const safeReviewers = clampPositive(availableReviewers, 1)
  const safeReviewerMinutesPerDay = clampPositive(reviewerMinutesPerDay, 60)
  const assignments = Math.ceil(safeCases * safeReviewsPerCase)
  const totalMinutes = assignments * safeMinutes
  const personHours = roundOne(totalMinutes / 60)
  const dailyCapacity = safeReviewers * safeReviewerMinutesPerDay

  return {
    assignments,
    calendarDays: totalMinutes ? Math.ceil(totalMinutes / dailyCapacity) : 0,
    cases: safeCases,
    cost: Math.round(personHours * safeHourlyRate),
    personHours,
    reviewersNeededForOneDay: totalMinutes
      ? Math.ceil(totalMinutes / safeReviewerMinutesPerDay)
      : 0,
  }
}

function estimateReviewAssignments({
  assignments,
  availableReviewers,
  cases,
  hourlyRate,
  minutesPerReview,
  reviewerMinutesPerDay,
}: ManagementAssumptions & { assignments: number; cases: number }): ReviewEffortEstimate {
  const safeAssignments = Math.max(0, Math.round(assignments))
  const safeCases = Math.max(0, Math.round(cases))
  const safeMinutes = clampPositive(minutesPerReview, 5)
  const safeHourlyRate = Math.max(0, hourlyRate)
  const safeReviewers = clampPositive(availableReviewers, 1)
  const safeReviewerMinutesPerDay = clampPositive(reviewerMinutesPerDay, 60)
  const totalMinutes = safeAssignments * safeMinutes
  const personHours = roundOne(totalMinutes / 60)
  const dailyCapacity = safeReviewers * safeReviewerMinutesPerDay

  return {
    assignments: safeAssignments,
    calendarDays: totalMinutes ? Math.ceil(totalMinutes / dailyCapacity) : 0,
    cases: safeCases,
    cost: Math.round(personHours * safeHourlyRate),
    personHours,
    reviewersNeededForOneDay: totalMinutes
      ? Math.ceil(totalMinutes / safeReviewerMinutesPerDay)
      : 0,
  }
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
    .find((review) => isResolvedAdjudicationReview(review))
}

function managementDecisionReviews(trace: EvaluationTrace) {
  const adjudication = resolvedAdjudicationReview(trace)
  return adjudication ? [adjudication] : primaryHumanReviews(trace)
}

function majorityDecision(trace: EvaluationTrace): ReviewDecision | "" {
  const adjudication = resolvedAdjudicationReview(trace)
  if (adjudication) return adjudication.final_decision
  return majorityValue(
    primaryHumanReviews(trace)
      .map((review) => review.final_decision)
      .filter(isReviewDecision),
  ) ?? ""
}

function hasUnresolvedHumanDisagreement(trace: EvaluationTrace) {
  if (resolvedAdjudicationReview(trace)) return false
  return hasHumanReviewDisagreement(primaryHumanReviews(trace))
}

function hasSourceConcern(trace: EvaluationTrace) {
  return managementDecisionReviews(trace).some((review) =>
    ["partly_supported", "unsupported"].includes(review.label),
  )
}

function hasAiUnsupportedClaim(trace: EvaluationTrace) {
  const evaluation = trace.automated_evaluation
  return (
    evaluation?.label === "unsupported" ||
    Boolean(evaluation?.unsupported_claims?.length) ||
    Boolean(evaluation?.contradicted_claims?.length)
  )
}

function hasThinSourceContext(trace: EvaluationTrace) {
  const chunkText = trace.retrieval_result?.chunk_text?.trim() || ""
  return (
    chunkText.length < 140 ||
    Boolean(trace.automated_evaluation?.context_limitations?.length)
  )
}

function isAiTriageCase(trace: EvaluationTrace) {
  const evaluation = trace.automated_evaluation
  return (
    automatedDecision(trace) !== "accept" ||
    ["partly_supported", "unsupported"].includes(evaluation?.label || "") ||
    (evaluation?.judge_score || 0) <= 3 ||
    Boolean(evaluation?.unsupported_claims?.length) ||
    Boolean(evaluation?.contradicted_claims?.length)
  )
}

function buildScenario(
  id: ReviewScenario["id"],
  label: string,
  description: string,
  cases: number,
  assumptions: ManagementAssumptions,
  overrides: Partial<Pick<ManagementAssumptions, "minutesPerReview" | "reviewsPerCase">> = {},
): ReviewScenario {
  return {
    cases,
    description,
    estimate: estimateReviewEffort({
      ...assumptions,
      ...overrides,
      cases,
    }),
    id,
    label,
  }
}

function reviewTarget(assumptions: ManagementAssumptions) {
  return Math.max(1, Math.round(clampPositive(assumptions.reviewsPerCase, 1)))
}

function minimumEvidenceCases(totalCases: number, assumptions: ManagementAssumptions) {
  const defaultThreshold = Math.min(totalCases, 10)
  const configuredThreshold = assumptions.minimumReviewedCases ?? defaultThreshold
  return Math.min(totalCases, Math.round(clampPositive(configuredThreshold, defaultThreshold)))
}

function buildRiskGroups(
  traces: EvaluationTrace[],
  riskCaseIds: Set<string>,
  getLabel: (trace: EvaluationTrace) => string,
): RiskGroup[] {
  const groups = new Map<string, { cases: number; riskCases: number }>()
  traces.forEach((trace) => {
    const label = getLabel(trace) || "Unknown"
    const current = groups.get(label) || { cases: 0, riskCases: 0 }
    current.cases += 1
    if (riskCaseIds.has(trace.trace_id)) current.riskCases += 1
    groups.set(label, current)
  })

  return [...groups.entries()]
    .map(([label, group]) => ({
      cases: group.cases,
      label,
      rate: group.cases ? roundOne((group.riskCases / group.cases) * 100) : 0,
      riskCases: group.riskCases,
    }))
    .filter((group) => group.riskCases > 0)
    .sort((left, right) => right.riskCases - left.riskCases || right.rate - left.rate)
    .slice(0, 5)
}

function readinessStatus({
  casesNeedingSecondReview,
  hasHumanReview,
  humanDisagreementCases,
  minimumReviewedCases,
  unresolvedActionCases,
  reviewedCases,
}: {
  casesNeedingSecondReview: number
  hasHumanReview: boolean
  humanDisagreementCases: number
  minimumReviewedCases: number
  unresolvedActionCases: number
  reviewedCases: number
}): { reason: string; status: OversightStatus } {
  if (!hasHumanReview) {
    return {
      reason: "No human review has been collected for this run yet.",
      status: "No human review yet",
    }
  }
  if (reviewedCases < minimumReviewedCases) {
    return {
      reason: "Some reviews exist, but review coverage or second-review evidence is still too thin.",
      status: "Insufficient evidence",
    }
  }
  if (humanDisagreementCases > 0) {
    return {
      reason: "Human reviewers disagree on at least one case and need an adjudication decision.",
      status: "Needs adjudication",
    }
  }
  if (unresolvedActionCases > 0) {
    return {
      reason: "Human review found actionable human review issues that still need follow-up.",
      status: "Needs follow-up",
    }
  }
  if (casesNeedingSecondReview > 0) {
    return {
      reason: "Some reviews exist, but review coverage or second-review evidence is still too thin.",
      status: "Insufficient evidence",
    }
  }
  return {
    reason: "Review coverage is sufficient for a cautious pilot and no severe unresolved cases remain.",
    status: "Ready for monitored pilot",
  }
}

function triageMessage(aiFlaggedRiskCases: number) {
  if (aiFlaggedRiskCases === 0) {
    return "No major AI triage signals, but human review is still required for trust assessment."
  }
  return "AI triage found cases that should be reviewed early. These signals are planning cues, not evidence of operational readiness; human review is still required."
}

function suggestedReviewStrategy({
  aiAcceptedAllCases,
  aiFlaggedRiskCases,
  totalCases,
}: {
  aiAcceptedAllCases: number
  aiFlaggedRiskCases: number
  totalCases: number
}) {
  if (totalCases === 0) return "Create an evaluation run before planning human review."
  if (aiFlaggedRiskCases > 0) {
    const acceptedSample = aiAcceptedAllCases > 0 ? " plus a small spot-check sample of AI-accepted cases" : ""
    return `AI-prioritized review: start with ${aiFlaggedRiskCases} AI-flagged cases${acceptedSample}.`
  }
  if (totalCases <= 20) return "Minimum pilot review: 10-20 cases with 1 reviewer."
  if (totalCases <= 40) return "Balanced review: 20-40 cases with 2 reviewers per case."
  return "High-assurance review: all selected cases, 2 reviewers, source check required."
}

function beforeDecisionSummary(action: ManagementSignal): ManagementDecisionSummary {
  return {
    detail: "Use AI triage to plan human review. No readiness decision is possible until human review evidence exists.",
    nextActionLabel: action.label,
    status: "No readiness decision yet",
    tone: "warning",
  }
}

function afterDecisionSummary({
  action,
  detail,
  status,
}: {
  action: ManagementSignal
  detail: string
  status: OversightStatus
}): ManagementDecisionSummary {
  return {
    detail,
    nextActionLabel: action.label,
    status,
    tone: action.tone,
  }
}

function tokenTotalFromUsage(usage?: TokenUsage) {
  if (!usage) return 0
  if (Number.isFinite(usage.total_tokens)) return Number(usage.total_tokens)
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0
  const completionTokens = usage.completion_tokens ?? usage.output_tokens ?? 0
  const total = promptTokens + completionTokens
  return Number.isFinite(total) ? total : 0
}

function costEstimateUsd(evaluation: JudgeEvaluation) {
  const value = evaluation.cost_estimate?.estimated_cost_usd
  return Number.isFinite(value) ? Number(value) : null
}

function judgeEvaluationsForCost(trace: EvaluationTrace): JudgeEvaluation[] {
  const evaluations = trace.judge_evaluations?.length
    ? [trace.automated_evaluation, ...trace.judge_evaluations]
    : [trace.automated_evaluation]
  const seen = new Set<string>()
  return evaluations.filter((evaluation) => {
    const id =
      evaluation.judge_rerun_id ||
      evaluation.auto_eval_id ||
      [
        trace.trace_id,
        evaluation.evaluation_role || "",
        evaluation.evaluation_mode,
        evaluation.evaluated_at || evaluation.created_at || "",
        evaluation.judge_score,
        evaluation.final_decision || evaluation.label,
      ].join("|")
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function buildJudgeTokenUsage(traces: EvaluationTrace[]): JudgeTokenUsageSummary {
  let recordedCases = 0
  let totalTokens = 0

  traces.forEach((trace) => {
    let traceTokens = 0
    judgeEvaluationsForCost(trace).forEach((evaluation) => {
      traceTokens +=
        tokenTotalFromUsage(evaluation.usage) ||
        tokenTotalFromUsage(evaluation.token_usage) ||
        tokenTotalFromUsage(evaluation.usage_metadata)
    })
    if (traceTokens > 0) {
      recordedCases += 1
      totalTokens += traceTokens
    }
  })

  const status =
    recordedCases === 0
      ? "not_recorded"
      : recordedCases < traces.length
        ? "partial"
        : "recorded"

  return {
    recordedCases,
    status,
    totalCases: traces.length,
    totalTokens,
  }
}

function buildCostComparison({
  assumptions,
  estimate,
  traces,
}: {
  assumptions: ManagementAssumptions
  estimate: ReviewEffortEstimate
  traces: EvaluationTrace[]
}): ManagementCostComparison {
  const judgeCostPer1kTokens = Math.max(0, assumptions.judgeCostPer1kTokens ?? 0)
  const judgeTokenUsage = buildJudgeTokenUsage(traces)
  let recordedCostUsd = 0
  let recordedCostCount = 0
  traces.forEach((trace) => {
    judgeEvaluationsForCost(trace).forEach((evaluation) => {
      const estimate = costEstimateUsd(evaluation)
      if (estimate !== null) {
        recordedCostUsd += estimate
        recordedCostCount += 1
      }
    })
  })
  const hasRecordedCost = recordedCostCount > 0
  return {
    humanReviewAssignments: estimate.assignments,
    humanReviewCost: estimate.cost,
    humanReviewHours: estimate.personHours,
    judgeCostCurrency: hasRecordedCost ? "USD" : "EUR",
    judgeCostPer1kTokens,
    judgeCostSource: hasRecordedCost ? "trace_estimate" : "manual_per_1k",
    judgePricingDetail: hasRecordedCost
      ? "OpenAI pricing snapshot"
      : "Fallback planning assumption",
    judgeTokenCost: judgeTokenUsage.totalTokens
      ? hasRecordedCost
        ? Math.round(recordedCostUsd * 1_000_000) / 1_000_000
        : Math.round((judgeTokenUsage.totalTokens / 1000) * judgeCostPer1kTokens * 100) / 100
      : null,
    judgeTokenUsage,
  }
}

function beforeRecommendedAction({
  aiAcceptedAllCases,
  aiFlaggedRiskCases,
  totalCases,
}: {
  aiAcceptedAllCases: number
  aiFlaggedRiskCases: number
  totalCases: number
}): ManagementSignal {
  if (totalCases === 0) {
    return {
      detail: "Create a saved evaluation run before planning review effort.",
      label: "Create evaluation run",
      tone: "warning",
    }
  }
  if (aiFlaggedRiskCases > 0) {
    return {
      detail:
        aiAcceptedAllCases > 0
          ? "Review AI-flagged cases early and include a spot-check sample of AI-accepted cases."
          : "Review AI-flagged cases early.",
      label: "Prepare AI-prioritized review",
      tone: "warning",
    }
  }
  return {
    detail: "No major AI triage signals, but trust assessment still needs human review.",
    label: "Plan minimum human review",
    tone: "ready",
  }
}

function afterRecommendedAction({
  readinessStatus,
  sourceConcernCases,
}: {
  readinessStatus: OversightStatus
  sourceConcernCases: number
}): ManagementSignal {
  if (readinessStatus === "No human review yet") {
    return {
      detail: "Review assignments are still missing for this run.",
      label: "Collect missing reviews",
      tone: "warning",
    }
  }
  if (readinessStatus === "Needs adjudication") {
    return {
      detail: "Human disagreement needs a final adjudication decision before readiness can be assessed.",
      label: "Assign adjudication",
      tone: "danger",
    }
  }
  if (readinessStatus === "Needs follow-up") {
    return {
      detail:
        sourceConcernCases > 0
          ? "Actionable cases and source concerns need resolution before pilot."
          : "Actionable cases need resolution before pilot.",
      label: "Resolve follow-up queue",
      tone: "warning",
    }
  }
  if (readinessStatus === "Insufficient evidence") {
    return {
      detail: "Add review coverage or second reviews before making a pilot decision.",
      label: "Strengthen review evidence",
      tone: "warning",
    }
  }
  return {
    detail: "Review evidence is sufficient for a cautious pilot with continued monitoring.",
    label: "Prepare monitored pilot",
    tone: "ready",
  }
}

// Mirrors backend research_summary() agreement / false-accept logic, but the counts fed in
// use the page's own majorityDecision/automatedDecision (adjudication-aware: resolved
// adjudication overrides the majority). The backend votes all reviews equally. This
// frontend/backend divergence is intentional and keeps the management page internally
// consistent with its other readiness signals.
function aiJudgeReliabilityVerdict({
  comparableCases,
  excludedSplitCases,
  falseAcceptCases,
  matchRate,
  matches,
}: {
  comparableCases: number
  excludedSplitCases: number
  falseAcceptCases: number
  matchRate: number
  matches: number
}): AiJudgeReliabilitySummary["verdict"] {
  if (comparableCases === 0) {
    if (excludedSplitCases > 0) {
      return {
        detail:
          "Agreement cannot be computed yet — reviewer decisions are split and await adjudication.",
        tone: "warning",
      }
    }
    return {
      detail: "Agreement cannot be assessed yet — no human reviews.",
      tone: "quiet",
    }
  }
  if (falseAcceptCases > 0) {
    return {
      detail: `AI-prioritized review is not yet safe: ${falseAcceptCases} ${
        falseAcceptCases === 1 ? "case" : "cases"
      } approved by the AI judge but rejected or flagged by reviewers.`,
      tone: "danger",
    }
  }
  if (matchRate >= 0.8) {
    return {
      detail: `AI judge matched the human majority in ${matches} of ${comparableCases} cases; AI-prioritized review looks safe so far.`,
      tone: "ready",
    }
  }
  return {
    detail: `AI judge matched the human majority in ${matches} of ${comparableCases} cases; review more cases before relying on AI-prioritized triage.`,
    tone: "warning",
  }
}

function buildPilotChecklist({
  casesNeedingSecondReview,
  humanDisagreementCases,
  minimumReviewedCases,
  reviewedCases,
  sourceConcernCases,
  totalCases,
  unresolvedActionCases,
}: {
  casesNeedingSecondReview: number
  humanDisagreementCases: number
  minimumReviewedCases: number
  reviewedCases: number
  sourceConcernCases: number
  totalCases: number
  unresolvedActionCases: number
}): PilotChecklistItem[] {
  return [
    {
      detail: `${reviewedCases}/${totalCases} cases reviewed`,
      id: "human_review_collected",
      label: "Human review collected",
      passed: reviewedCases > 0,
    },
    {
      detail: `${reviewedCases}/${minimumReviewedCases} minimum reviewed cases`,
      id: "minimum_coverage",
      label: "Minimum review coverage",
      passed: totalCases > 0 && reviewedCases >= minimumReviewedCases,
    },
    {
      detail: `${casesNeedingSecondReview} reviewed cases still need another reviewer`,
      id: "second_review",
      label: "Second-review coverage",
      passed: reviewedCases > 0 && casesNeedingSecondReview === 0,
    },
    {
      detail: `${sourceConcernCases} source concerns raised`,
      id: "source_concerns",
      label: "No source concerns",
      passed: sourceConcernCases === 0,
    },
    {
      detail: `${humanDisagreementCases} human disagreement cases`,
      id: "adjudication_clear",
      label: "No adjudication open",
      passed: humanDisagreementCases === 0,
    },
    {
      detail: `${unresolvedActionCases} unresolved action cases`,
      id: "follow_up_clear",
      label: "No unresolved follow-up",
      passed: unresolvedActionCases === 0,
    },
  ]
}

function auditEvidenceSummary({
  reviewedCases,
  totalCases,
}: {
  reviewedCases: number
  totalCases: number
}): ManagementSignal {
  if (totalCases === 0) {
    return {
      detail: "No saved run evidence is available yet.",
      label: "Audit evidence unavailable",
      tone: "warning",
    }
  }
  if (reviewedCases > 0) {
    return {
      detail: "Human review records are available.",
      label: "Audit evidence available",
      tone: "ready",
    }
  }
  return {
    detail: "Evaluation traces exist, but no human review records are available yet.",
    label: "Audit evidence incomplete",
    tone: "warning",
  }
}

function monitoringSummary(readinessStatus: OversightStatus): ManagementSignal {
  if (readinessStatus === "Ready for monitored pilot") {
    return {
      detail: "Start the pilot with a review checkpoint and escalation path for serious issues.",
      label: "Monitoring required after launch",
      tone: "ready",
    }
  }
  return {
    detail: "Monitoring should start after review evidence and follow-up work are complete.",
    label: "Monitoring not ready yet",
    tone: "warning",
  }
}

export function buildManagementDashboardModel({
  assumptions,
  traces,
}: {
  assumptions: ManagementAssumptions
  traces: EvaluationTrace[]
}): ManagementDashboardModel {
  const totalCases = traces.length
  const aiFlaggedRiskCases = traces.filter(isAiTriageCase).length
  const aiAcceptedAllCases = totalCases - aiFlaggedRiskCases
  const unsupportedClaimsCases = traces.filter(hasAiUnsupportedClaim).length
  const thinSourceContextCases = traces.filter(hasThinSourceContext).length
  const reviewedCases = traces.filter((trace) => managementDecisionReviews(trace).length > 0).length
  const pendingCases = totalCases - reviewedCases
  const targetReviewsPerCase = reviewTarget(assumptions)
  const minimumReviewedCases = minimumEvidenceCases(totalCases, assumptions)
  let acceptedCases = 0
  let needsEditCases = 0
  let rejectedCases = 0
  let aiHumanMismatchCases = 0
  let humanDisagreementCases = 0
  let sourceConcernCases = 0
  let totalReviews = 0
  let missingReviewAssignments = 0
  let casesNeedingSecondReview = 0
  let casesWithMissingReviews = 0
  let resolvedAdjudicationCases = 0
  let comparableCases = 0
  let aiHumanMatches = 0
  let aiFalseAcceptCases = 0
  let excludedSplitCases = 0

  traces.forEach((trace) => {
    const humanDecision = majorityDecision(trace)
    const aiDecision = automatedDecision(trace)
    const reviews = primaryHumanReviews(trace)
    totalReviews += humanReviews(trace).length
    const missingReviews = Math.max(0, targetReviewsPerCase - reviews.length)
    missingReviewAssignments += missingReviews
    if (missingReviews > 0) casesWithMissingReviews += 1
    if (reviews.length > 0 && missingReviews > 0) casesNeedingSecondReview += 1
    if (humanDecision === "accept") acceptedCases += 1
    if (humanDecision === "needs_edit") needsEditCases += 1
    if (humanDecision === "reject") rejectedCases += 1
    if (humanDecision) {
      comparableCases += 1
      if (humanDecision === aiDecision) aiHumanMatches += 1
      else aiHumanMismatchCases += 1
      if (aiDecision === "accept" && humanDecision !== "accept") aiFalseAcceptCases += 1
    } else if (reviews.some((review) => isReviewDecision(review.final_decision))) {
      // Reviewers cast valid decisions but split with no majority and no resolved
      // adjudication, so the case is excluded from the agreement comparison.
      excludedSplitCases += 1
    }
    if (hasUnresolvedHumanDisagreement(trace)) humanDisagreementCases += 1
    if (resolvedAdjudicationReview(trace)) resolvedAdjudicationCases += 1
    if (hasSourceConcern(trace)) sourceConcernCases += 1
  })
  const aiJudgeMatchRate = comparableCases
    ? Math.round((aiHumanMatches / comparableCases) * 1000) / 1000
    : 0
  const unresolvedDecisionCases = Math.max(
    0,
    reviewedCases - acceptedCases - needsEditCases - rejectedCases,
  )

  const observedRiskCases = new Set<string>()
  traces.forEach((trace) => {
    const humanDecision = majorityDecision(trace)
    if (
      humanDecision === "needs_edit" ||
      humanDecision === "reject" ||
      (humanDecision && humanDecision !== automatedDecision(trace)) ||
      hasUnresolvedHumanDisagreement(trace) ||
      hasSourceConcern(trace)
    ) {
      observedRiskCases.add(trace.trace_id)
    }
  })

  const unresolvedActionCases = [...observedRiskCases].filter((traceId) => {
    const trace = traces.find((item) => item.trace_id === traceId)
    if (!trace || hasUnresolvedHumanDisagreement(trace)) return false
    return true
  }).length
  const readiness = readinessStatus({
    casesNeedingSecondReview,
    hasHumanReview: reviewedCases > 0,
    humanDisagreementCases,
    minimumReviewedCases,
    unresolvedActionCases,
    reviewedCases,
  })
  const recommendedAction = afterRecommendedAction({
    readinessStatus: readiness.status,
    sourceConcernCases,
  })
  const beforeAction = beforeRecommendedAction({
    aiAcceptedAllCases,
    aiFlaggedRiskCases,
    totalCases,
  })
  const beforeEstimate = estimateReviewEffort({ ...assumptions, cases: totalCases })

  return {
    after: {
      acceptedCases,
      actionBacklog: [
        {
          count: missingReviewAssignments,
          id: "complete_missing_reviews",
          label: "Complete missing reviews",
        },
        {
          count: humanDisagreementCases,
          id: "resolve_human_disagreement",
          label: "Resolve human disagreement",
        },
        {
          count: aiFalseAcceptCases,
          id: "inspect_ai_false_accepts",
          label: "Inspect AI false accepts",
        },
        {
          count: needsEditCases + rejectedCases,
          id: "fix_needs_edit_answers",
          label: "Fix needs-edit/rejected answers",
        },
        {
          count: sourceConcernCases,
          id: "check_source_concerns",
          label: "Check source concerns",
        },
      ],
      auditEvidence: auditEvidenceSummary({
        reviewedCases,
        totalCases,
      }),
      aiHumanMismatchCases,
      aiJudgeReliability: {
        comparableCases,
        excludedSplitCases,
        falseAcceptCases: aiFalseAcceptCases,
        matchRate: aiJudgeMatchRate,
        matches: aiHumanMatches,
        verdict: aiJudgeReliabilityVerdict({
          comparableCases,
          excludedSplitCases,
          falseAcceptCases: aiFalseAcceptCases,
          matchRate: aiJudgeMatchRate,
          matches: aiHumanMatches,
        }),
      },
      casesNeedingSecondReview,
      decisionSummary: afterDecisionSummary({
        action: recommendedAction,
        detail: readiness.reason,
        status: readiness.status,
      }),
      hasHumanReview: reviewedCases > 0,
      humanDisagreementCases,
      minimumReviewedCases,
      missingReviewAssignments,
      needsEditCases,
      pendingCases,
      pilotChecklist: buildPilotChecklist({
        casesNeedingSecondReview,
        humanDisagreementCases,
        minimumReviewedCases,
        reviewedCases,
        sourceConcernCases,
        totalCases,
        unresolvedActionCases,
      }),
      readinessReason: readiness.reason,
      readinessStatus: readiness.status,
      recommendedAction,
      rejectedCases,
      remainingEstimate: estimateReviewAssignments({
        ...assumptions,
        assignments: missingReviewAssignments,
        cases: casesWithMissingReviews,
      }),
      resolvedAdjudicationCases,
      reviewCoveragePercent: totalCases ? Math.round((reviewedCases / totalCases) * 100) : 0,
      reviewedCases,
      riskByService: buildRiskGroups(
        traces,
        observedRiskCases,
        (trace) => trace.citizen_question.service_title || trace.retrieval_result.service_title,
      ),
      sourceConcernCases,
      totalCases,
      totalReviews,
      unresolvedDecisionCases,
      unresolvedActionCases,
      monitoringSummary: monitoringSummary(readiness.status),
    },
    before: {
      aiAcceptedAllCases,
      aiFlaggedRiskCases,
      aiFoundIssueCases: aiFlaggedRiskCases,
      aiTriageCases: aiFlaggedRiskCases,
      customEstimate: beforeEstimate,
      decisionSummary: beforeDecisionSummary(beforeAction),
      recommendedAction: beforeAction,
      scenarios: [
        buildScenario(
          "minimum_pilot",
          "Minimum pilot review",
          "10-20 cases with 1 reviewer to estimate review burden before scaling.",
          Math.min(20, totalCases),
          assumptions,
          { reviewsPerCase: 1 },
        ),
        buildScenario(
          "balanced_review",
          "Balanced review",
          "20-40 cases with 2 reviewers per case for broader reliability evidence.",
          Math.min(40, totalCases),
          assumptions,
          { reviewsPerCase: 2 },
        ),
        buildScenario(
          "high_assurance",
          "High-assurance review",
          "All selected cases with 2 reviewers; source concerns must be flagged when found.",
          totalCases,
          assumptions,
          { minutesPerReview: Math.max(8, assumptions.minutesPerReview), reviewsPerCase: 2 },
        ),
        buildScenario(
          "ai_triage",
          "AI-prioritized review",
          "Review AI-flagged cases first, but include a small spot-check sample of AI-accepted cases.",
          Math.min(totalCases, aiFlaggedRiskCases + Math.min(10, aiAcceptedAllCases)),
          assumptions,
          { reviewsPerCase: 2 },
        ),
      ],
      suggestedReviewStrategy: suggestedReviewStrategy({
        aiAcceptedAllCases,
        aiFlaggedRiskCases,
        totalCases,
      }),
      thinSourceContextCases,
      totalCases,
      triageMessage: triageMessage(aiFlaggedRiskCases),
      triageStatus: "AI triage only",
      unsupportedClaimsCases,
    },
    costComparison: buildCostComparison({
      assumptions,
      estimate: beforeEstimate,
      traces,
    }),
  }
}
