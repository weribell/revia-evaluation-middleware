import type {
  DeveloperRun,
  EvaluationCriterionKey,
  EvaluationTrace,
  HumanReview,
  ReviewDecision,
  ReviewerPlan,
} from "@/types"
import {
  automatedDecision,
  hasHumanDisagreement,
  humanMajorityDecision,
  humanReviews,
  reviewDecisions,
  sourceConcernValue,
} from "../shared/evaluationTraceModel.ts"
import { roundOne } from "../../lib/numberUtils.ts"

export type ResearchAgreementStatus = "match" | "mismatch" | "pending" | "human_disagreement"

export type ResearchMetricCard = {
  detail: string
  label: string
  tone: "danger" | "warning" | "ready" | "quiet"
  value: string
}

export type ResearchDecisionDistribution = Record<ReviewDecision | "pending", number>

export type ResearchInterpretationStrength = "thin" | "interpretable" | "strong"

export type ResearchInterpretationSummary = {
  completedReviews: number
  detail: string
  headline: string
  humanDisagreementCount: number
  incompleteReviews: number
  matchRate: number
  multiReviewCases: number
  reviewedCases: number
  requiredReviews: number
  sampleSize: number
  sourceConcernCases: number
  strength: ResearchInterpretationStrength
  tone: ResearchMetricCard["tone"]
  warnings: string[]
}

export type ResearchRunSummary = {
  agreementCards: ResearchMetricCard[]
  coverageCards: ResearchMetricCard[]
  coreAnswerCards: ResearchMetricCard[]
  decisionDistribution: ResearchDecisionDistribution
  interpretation: ResearchInterpretationSummary
  metadata: [string, string][]
}

export type ResearchDisagreementRow = {
  aiDecision: string
  disagreementType: string
  finalDecisionStatus: ResearchAgreementStatus
  humanDecision: string
  issue: string
  priorityLabel: string
  priorityRank: number
  question: string
  severity: string
  service: string
  sourceSupportStatus: ResearchAgreementStatus
  style: string
  targetSection: string
  traceId: string
}

export type ResearchDistributionItem = {
  count: number
  label: string
}

export type ResearchSampleSummary = {
  clarificationDistribution: ResearchDistributionItem[]
  intentDistribution: ResearchDistributionItem[]
  questionSourceDistribution: ResearchDistributionItem[]
  styleDistribution: ResearchDistributionItem[]
  targetSectionDistribution: ResearchDistributionItem[]
  totalCases: number
}

export type ResearchSampleContextItem = {
  distribution: ResearchDistributionItem[]
  label: string
  primary: string
  summary: string
  total: number
}

export type ResearchReviewCompleteness = {
  caseBuckets: ResearchDistributionItem[]
  participantProgress: {
    assigned: number
    completed: number
    excluded: boolean
    participantId: string
    replacedBy: string
  }[]
  reviewerProfiles: Record<string, Record<string, number>>
}

export type ResearchConfusionCell = {
  aiDecision: ReviewDecision
  count: number
  humanDecision: ReviewDecision
}

export type ResearchConfusionMatrix = {
  cells: ResearchConfusionCell[]
  comparableCases: number
  falseAccepts: number
  falseRejects: number
  humanDecisionDisagreements: number
  matchRate: number
  matches: number
}

export type ResearchCriterionRow = {
  aiAverage: number | null
  aiDistribution: ResearchDistributionItem[]
  criterion: EvaluationCriterionKey
  humanDistribution: ResearchDistributionItem[]
  // Reviewers never assign 1-5 criterion scores directly; the reviewer UI only
  // writes a criterion when an optional problem checklist signal fires. We
  // therefore report problem-signal counts against the total number of reviews,
  // never a human "average score".
  humanProblemSignals: number
  reviewsTotal: number
}

export type ResearchAgreementStat = {
  dominantShare: number | null
  dominantShareWarning: boolean
  kappa: number | null
  kappaReason: string | null
  n: number
  percentAgreement: number | null
}

export type ResearchAgreementStats = {
  aiVsIndividual: ResearchAgreementStat
  aiVsMajority: ResearchAgreementStat
}

export type ResearchReviewerBreakdownRow = {
  decisions: ResearchDistributionItem[]
  reviewerId: string
  total: number
}

export type ResearchStyleAgreementRow = {
  comparableCases: number
  matchRate: number | null
  matches: number
  style: string
}

export type ResearchFailureMode = {
  count: number
  label: string
  traceIds: string[]
}

export type ResearchReviewerNote = {
  finalDecision: string
  note: string
  noteType: "Reviewer comment" | "Suggested correction"
  question: string
  reviewerId: string
  service: string
  sourceSupport: string
  traceId: string
}

export type ResearchDisagreementFilters = {
  decision: ReviewDecision | "all"
  query: string
  severity: string
  sourceSupport: ResearchAgreementStatus | "all"
  style: string
  targetSection: string
  type: string
}

export type ResearchCaseDetail = {
  aiDecision: string
  answerText: string
  disagreementReason: string
  humanReviews: {
    comment: string
    decision: string
    profileChips: string[]
    reviewerId: string
    sourceSupport: string
    suggestedCorrection: string
  }[]
  judgeExplanation: string
  question: string
  retrievedSource: string
  runMetadata: [string, string][]
  service: string
  sourceUrl: string
  traceId: string
}

export type ResearchEvidenceRow = {
  aiDecision: string
  disagreement: string
  humanDecision: string
  question: string
  reviewerContext: string
  service: string
  sourceSupport: string
  traceId: string
}

export type ResearchCaseExportRow = {
  batch_id: string
  trace_id: string
  question_id: string
  service: string
  question_type: string
  question_style: string
  target_section: string
  ai_decision: string
  human_majority_decision: string
  agreement_status: string
  source_concern: string
  failure_mode: string
  needs_follow_up: string
}

export type ResearchReviewExportRow = {
  trace_id: string
  reviewer_id: string
  final_decision: string
  source_support_label: string
  criteria_factual_correctness: number | ""
  criteria_source_support: number | ""
  criteria_completeness: number | ""
  criteria_clarity_actionability: number | ""
  criteria_public_service_tone: number | ""
  criteria_uncertainty_handling: number | ""
  reviewer_confidence: string
  profile_background: string
  profile_public_service_familiarity: string
  profile_llm_familiarity: string
  profile_german_confidence: string
  comment_text: string
  submitted_at: string
}

const canonicalCriteria: EvaluationCriterionKey[] = [
  "factual_correctness",
  "source_support",
  "completeness",
  "clarity_actionability",
  "public_service_tone",
  "uncertainty_handling",
]

// A criterion scored at or below this is a reviewer problem signal. The current
// reviewer form does not collect matching positive criterion signals.
const PROBLEM_SIGNAL_MAX_SCORE = 2

// Above this share of one decision category, a low Cohen's kappa is an
// artefact of class imbalance (e.g. ~90% accept) rather than genuine
// AI-human disagreement, and the Analysis tab flags it as such. Matches
// prototype/agreement_metrics.py so the interactive and offline analyses agree.
const DOMINANT_SHARE_WARN_THRESHOLD = 0.75

function requiredHumanValue(
  reviews: HumanReview[],
  valueForReview: (review: HumanReview) => string,
) {
  const values = reviews.map(valueForReview).filter(Boolean)
  const uniqueValues = new Set(values)
  return {
    display: values.length
      ? uniqueValues.size === 1
        ? values[0]
        : values.join("; ")
      : "pending",
    hasDisagreement: uniqueValues.size > 1,
    value: uniqueValues.size === 1 ? values[0] : "",
  }
}

function comparisonStatus(
  aiValue: string,
  human: ReturnType<typeof requiredHumanValue>,
): ResearchAgreementStatus {
  if (!human.value && !human.hasDisagreement) return "pending"
  if (human.hasDisagreement) return "human_disagreement"
  return aiValue === human.value ? "match" : "mismatch"
}

function sourceComparisonStatus(
  trace: EvaluationTrace,
  human: ReturnType<typeof requiredHumanValue>,
): ResearchAgreementStatus {
  const status = comparisonStatus(trace.automated_evaluation?.label || "", human)
  if (
    status === "match" &&
    trace.disagreement_case?.disagreement_type?.includes("source_support")
  ) {
    return "mismatch"
  }
  return status
}

function reviewTargetForTrace(trace: EvaluationTrace, reviewerPlan?: ReviewerPlan | null) {
  const target = reviewerPlan?.case_review_targets?.[trace.trace_id]
  return Math.max(1, typeof target === "number" ? target : reviewerPlan?.reviews_per_question || 1)
}

function promptMetadata(activeRun: DeveloperRun | null, key: string, fallback: string) {
  const value = activeRun?.metadata?.[key]
  return typeof value === "string" && value.trim() ? value : fallback
}

function countHumanDisagreement(traces: EvaluationTrace[]) {
  return traces.filter(hasHumanDisagreement).length
}

function reviewCoverage(traces: EvaluationTrace[], reviewerPlan?: ReviewerPlan | null) {
  let completedReviews = 0
  let requiredReviews = 0
  let reviewedCases = 0
  let multiReviewCases = 0
  let sourceConcernCases = 0

  traces.forEach((trace) => {
    const reviews = humanReviews(trace)
    const target = reviewTargetForTrace(trace, reviewerPlan)
    requiredReviews += target
    completedReviews += Math.min(reviews.length, target)
    if (reviews.length) reviewedCases += 1
    if (reviews.length >= 2) multiReviewCases += 1
    // A "source concern" is an explicitly flagged problem, not the default:
    // the reviewer UI only records partly_supported/unsupported, so a clean
    // source leaves no label and must not be read as a skipped check.
    if (reviews.some((review) => review.label === "partly_supported" || review.label === "unsupported")) {
      sourceConcernCases += 1
    }
  })

  return {
    completedReviews,
    incompleteReviews: Math.max(0, requiredReviews - completedReviews),
    multiReviewCases,
    requiredReviews,
    reviewedCases,
    sourceConcernCases,
  }
}

function incrementCounter(counter: Record<string, number>, label: string) {
  counter[label] = (counter[label] || 0) + 1
}

function distribution(counter: Record<string, number>): ResearchDistributionItem[] {
  return Object.entries(counter).map(([label, count]) => ({ count, label }))
}

function questionSource(trace: EvaluationTrace) {
  const method = trace.citizen_question.generation_method
  if (method?.trim()) return "llm_authored"
  const sample = trace.citizen_question.sample_label || trace.variant || ""
  if (sample.toLowerCase().includes("llm")) return "llm_authored"
  return "controlled"
}

function average(values: number[]) {
  return values.length ? roundOne(values.reduce((sum, value) => sum + value, 0) / values.length) : null
}

function reviewerProfileEntries(review: HumanReview) {
  const profile = review.reviewer_profile || {}
  return [
    ["background", profileValue(profile, "background", "reviewer_background")],
    ["public_service_familiarity", profileValue(profile, "public_service_familiarity")],
    ["llm_familiarity", profileValue(profile, "llm_familiarity")],
    ["german_confidence", profileValue(profile, "german_confidence", "language_confidence_de")],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1]))
}

function profileValue(profile: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = profile[key]
    if (typeof value === "string" && value.trim()) return value
  }
  return ""
}

function reviewerId(review: HumanReview, index: number) {
  return review.reviewer_id || review.reviewer_role || `Reviewer ${index + 1}`
}

function profileChips(review: HumanReview) {
  const profile = review.reviewer_profile || {}
  const background = profileValue(profile, "background", "reviewer_background")
  const publicService = profileValue(profile, "public_service_familiarity")
  const llm = profileValue(profile, "llm_familiarity")
  const german = profileValue(profile, "german_confidence", "language_confidence_de")
  return [
    background ? `background: ${background}` : "",
    publicService ? `public service: ${publicService}` : "",
    llm ? `LLM: ${llm}` : "",
    german ? `German: ${german}` : "",
  ].filter(Boolean)
}

export function buildResearchSampleSummary(traces: EvaluationTrace[]): ResearchSampleSummary {
  const questionSources: Record<string, number> = {}
  const styles: Record<string, number> = {}
  const targetSections: Record<string, number> = {}
  const intents: Record<string, number> = {}
  const clarifications: Record<string, number> = {}

  traces.forEach((trace) => {
    incrementCounter(questionSources, questionSource(trace))
    incrementCounter(styles, trace.citizen_question.style_label || "unknown")
    incrementCounter(targetSections, trace.citizen_question.target_section || "unknown")
    incrementCounter(intents, trace.citizen_question.intent_type || "unknown")
    incrementCounter(
      clarifications,
      trace.citizen_question.requires_clarification
        ? "requires clarification"
        : "no clarification needed",
    )
  })

  return {
    clarificationDistribution: distribution(clarifications),
    intentDistribution: distribution(intents),
    questionSourceDistribution: distribution(questionSources),
    styleDistribution: distribution(styles),
    targetSectionDistribution: distribution(targetSections),
    totalCases: traces.length,
  }
}

function sampleContextItem(
  label: string,
  distributionItems: ResearchDistributionItem[],
): ResearchSampleContextItem {
  const total = distributionItems.reduce((sum, item) => sum + item.count, 0)
  const sorted = [...distributionItems].sort((left, right) => right.count - left.count)
  const primary = sorted.length === 1 ? sorted[0].label : sorted.length ? "mixed" : "-"
  const summary = sorted.length
    ? sorted.map((item) => `${item.label} ${item.count}`).join(", ")
    : "-"

  return {
    distribution: distributionItems,
    label,
    primary,
    summary,
    total,
  }
}

export function buildResearchSampleContext(
  sampleSummary: ResearchSampleSummary,
): ResearchSampleContextItem[] {
  return [
    sampleContextItem("Question source", sampleSummary.questionSourceDistribution),
    sampleContextItem("Answerability", sampleSummary.clarificationDistribution),
    sampleContextItem("Question style", sampleSummary.styleDistribution),
    sampleContextItem("Target section", sampleSummary.targetSectionDistribution),
    sampleContextItem("Intent type", sampleSummary.intentDistribution),
  ]
}

export function buildResearchReviewCompleteness({
  reviewerPlan,
  traces,
}: {
  reviewerPlan?: ReviewerPlan | null
  traces: EvaluationTrace[]
}): ResearchReviewCompleteness {
  const caseBuckets = {
    "0 reviews": 0,
    "1 review": 0,
    "2+ reviews": 0,
  }
  const reviewerProfiles: Record<string, Record<string, number>> = {
    background: {},
    german_confidence: {},
    llm_familiarity: {},
    public_service_familiarity: {},
  }
  const seenReviewers = new Set<string>()

  traces.forEach((trace) => {
    const reviews = humanReviews(trace)
    if (!reviews.length) caseBuckets["0 reviews"] += 1
    else if (reviews.length === 1) caseBuckets["1 review"] += 1
    else caseBuckets["2+ reviews"] += 1

    reviews.forEach((review, index) => {
      const id = reviewerId(review, index)
      reviewerProfileEntries(review).forEach(([key, value]) => {
        const profileKey = `${id}:${key}`
        if (seenReviewers.has(profileKey)) return
        seenReviewers.add(profileKey)
        incrementCounter(reviewerProfiles[key], value)
      })
    })
  })

  return {
    caseBuckets: distribution(caseBuckets),
    participantProgress: (reviewerPlan?.participants || []).map((participant) => ({
      assigned: participant.assigned_trace_ids.length,
      completed: participant.completed_reviews,
      excluded: Boolean(participant.excluded),
      participantId: participant.participant_id,
      replacedBy: participant.replaced_by || "",
    })),
    reviewerProfiles,
  }
}

export function buildResearchConfusionMatrix(traces: EvaluationTrace[]): ResearchConfusionMatrix {
  const cells = reviewDecisions.flatMap((aiDecision) =>
    reviewDecisions.map((humanDecision) => ({ aiDecision, count: 0, humanDecision })),
  )
  let matches = 0
  let comparableCases = 0
  let falseAccepts = 0
  let falseRejects = 0
  let humanDecisionDisagreements = 0

  traces.forEach((trace) => {
    const humanDecisions = humanReviews(trace).map((review) => review.final_decision)
    if (new Set(humanDecisions).size > 1) humanDecisionDisagreements += 1
    const humanDecision = humanMajorityDecision(trace)
    if (!humanDecision) return
    const aiDecision = automatedDecision(trace)
    comparableCases += 1
    if (aiDecision === humanDecision) matches += 1
    if (aiDecision === "accept" && (humanDecision === "reject" || humanDecision === "needs_edit")) {
      falseAccepts += 1
    }
    if (aiDecision === "reject" && humanDecision === "accept") falseRejects += 1
    const cell = cells.find(
      (item) => item.aiDecision === aiDecision && item.humanDecision === humanDecision,
    )
    if (cell) cell.count += 1
  })

  return {
    cells,
    comparableCases,
    falseAccepts,
    falseRejects,
    humanDecisionDisagreements,
    matches,
    matchRate: comparableCases ? roundOne((matches / comparableCases) * 100) : 0,
  }
}

export function buildResearchInterpretationSummary({
  reviewerPlan,
  traces,
}: {
  reviewerPlan?: ReviewerPlan | null
  traces: EvaluationTrace[]
}): ResearchInterpretationSummary {
  const coverage = reviewCoverage(traces, reviewerPlan)
  const matrix = buildResearchConfusionMatrix(traces)
  const humanDisagreementCount = countHumanDisagreement(traces)
  const warnings: string[] = []

  if (traces.length < 10) {
    warnings.push("Data is too thin for stable conclusions; treat this as a preliminary signal.")
  }
  if (coverage.reviewedCases < traces.length) {
    warnings.push("Some cases still have no human review.")
  }
  if (coverage.multiReviewCases < coverage.reviewedCases) {
    warnings.push("Some reviewed cases do not yet have 2+ human reviews for reliability checks.")
  }
  // No source-checking warning: reviewers only flag source problems, so the
  // absence of a flag means "no concern", not "not comparable".

  const hasMinimumInterpretation =
    traces.length >= 3 && coverage.reviewedCases >= 3 && coverage.multiReviewCases > 0
  const hasStrongerCoverage =
    traces.length >= 20 &&
    coverage.reviewedCases / Math.max(1, traces.length) >= 0.8 &&
    coverage.multiReviewCases / Math.max(1, coverage.reviewedCases) >= 0.5
  const strength: ResearchInterpretationStrength = !hasMinimumInterpretation
    ? "thin"
    : hasStrongerCoverage
      ? "strong"
      : "interpretable"
  const alignment =
    matrix.matchRate >= 75 ? "mostly aligned" : matrix.matchRate >= 50 ? "partly aligned" : "poorly aligned"
  const headline =
    strength === "thin"
      ? "This run is not strong enough for conclusions yet."
      : `In this run, the AI judge ${alignment} with human reviewers.`
  const detail =
    "The highest-risk cases are false accepts and unresolved human disagreement."

  return {
    ...coverage,
    detail,
    headline,
    humanDisagreementCount,
    matchRate: matrix.matchRate,
    sampleSize: traces.length,
    strength,
    tone: strength === "thin" ? "warning" : matrix.falseAccepts ? "danger" : "ready",
    warnings,
  }
}

function scoreDistribution(values: number[]) {
  const counter: Record<string, number> = {}
  values.forEach((value) => incrementCounter(counter, String(value)))
  return distribution(counter)
}

export function buildResearchCriterionRows(traces: EvaluationTrace[]): ResearchCriterionRow[] {
  const reviewsTotal = traces.reduce((sum, trace) => sum + humanReviews(trace).length, 0)

  return canonicalCriteria.map((criterion) => {
    const aiScores: number[] = []
    const humanScores: number[] = []
    let humanProblemSignals = 0

    traces.forEach((trace) => {
      const aiScore = trace.automated_evaluation.criteria?.[criterion]?.score
      if (typeof aiScore === "number") aiScores.push(aiScore)
      humanReviews(trace).forEach((review) => {
        const score = review.criteria?.[criterion]
        if (typeof score !== "number") return
        humanScores.push(score)
        if (score <= PROBLEM_SIGNAL_MAX_SCORE) humanProblemSignals += 1
      })
    })

    return {
      aiAverage: average(aiScores),
      aiDistribution: scoreDistribution(aiScores),
      criterion,
      humanDistribution: scoreDistribution(humanScores),
      humanProblemSignals,
      reviewsTotal,
    }
  })
}

function percentAgreement(pairs: [string, string][]): number | null {
  if (!pairs.length) return null
  return pairs.filter(([a, b]) => a === b).length / pairs.length
}

function dominantShare(pairs: [string, string][]): number | null {
  if (!pairs.length) return null
  const counts: Record<string, number> = {}
  pairs.forEach(([a, b]) => {
    counts[a] = (counts[a] || 0) + 1
    counts[b] = (counts[b] || 0) + 1
  })
  const values = Object.values(counts)
  const total = values.reduce((sum, count) => sum + count, 0)
  return total ? Math.max(...values) / total : null
}

function cohensKappa(pairs: [string, string][]): { kappa: number | null; reason: string | null } {
  const n = pairs.length
  if (!n) return { kappa: null, reason: "no comparable pairs (n=0)" }
  const aCounts: Record<string, number> = {}
  const bCounts: Record<string, number> = {}
  pairs.forEach(([a, b]) => {
    aCounts[a] = (aCounts[a] || 0) + 1
    bCounts[b] = (bCounts[b] || 0) + 1
  })
  const categories = new Set([...Object.keys(aCounts), ...Object.keys(bCounts)])
  const po = pairs.filter(([a, b]) => a === b).length / n
  let pe = 0
  categories.forEach((c) => {
    pe += ((aCounts[c] || 0) / n) * ((bCounts[c] || 0) / n)
  })
  if (pe >= 1) {
    return { kappa: null, reason: "pe=1 (degenerate distribution; chance agreement already total)" }
  }
  return { kappa: (po - pe) / (1 - pe), reason: null }
}

// Client-side port of prototype/agreement_metrics.agreement_stats. Both build
// identical (AI, human) decision pairs and share the same kappa formula, so
// the Analysis tab and the offline analysis script report the same numbers.
function agreementStat(pairs: [string, string][]): ResearchAgreementStat {
  const share = dominantShare(pairs)
  const dominantShareWarning = share !== null && share > DOMINANT_SHARE_WARN_THRESHOLD
  if (!pairs.length) {
    return {
      dominantShare: share,
      dominantShareWarning,
      kappa: null,
      kappaReason: "no comparable pairs (n=0)",
      n: 0,
      percentAgreement: null,
    }
  }
  const { kappa, reason } = cohensKappa(pairs)
  return {
    dominantShare: share,
    dominantShareWarning,
    kappa,
    kappaReason: reason,
    n: pairs.length,
    percentAgreement: percentAgreement(pairs),
  }
}

export function buildResearchAgreementStats(traces: EvaluationTrace[]): ResearchAgreementStats {
  const individualPairs: [string, string][] = []
  const majorityPairs: [string, string][] = []

  traces.forEach((trace) => {
    const aiDecision = automatedDecision(trace)
    humanReviews(trace).forEach((review) => {
      if (reviewDecisions.includes(review.final_decision as ReviewDecision)) {
        individualPairs.push([aiDecision, review.final_decision])
      }
    })
    const majority = humanMajorityDecision(trace)
    if (majority) majorityPairs.push([aiDecision, majority])
  })

  return {
    aiVsIndividual: agreementStat(individualPairs),
    aiVsMajority: agreementStat(majorityPairs),
  }
}

export function buildResearchReviewerBreakdown(
  traces: EvaluationTrace[],
): ResearchReviewerBreakdownRow[] {
  const byReviewer = new Map<string, Record<string, number>>()
  traces.forEach((trace) => {
    humanReviews(trace).forEach((review, index) => {
      if (!reviewDecisions.includes(review.final_decision as ReviewDecision)) return
      const id = reviewerId(review, index)
      if (!byReviewer.has(id)) byReviewer.set(id, {})
      incrementCounter(byReviewer.get(id)!, review.final_decision)
    })
  })

  return [...byReviewer.entries()]
    .map(([reviewerId, counts]) => ({
      decisions: distribution(counts),
      reviewerId,
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    }))
    .sort((left, right) => left.reviewerId.localeCompare(right.reviewerId))
}

export function buildResearchAgreementByStyle(
  traces: EvaluationTrace[],
): ResearchStyleAgreementRow[] {
  const byStyle = new Map<string, { comparableCases: number; matches: number }>()
  traces.forEach((trace) => {
    const style = trace.citizen_question.style_label || "unknown"
    const bucket = byStyle.get(style) || { comparableCases: 0, matches: 0 }
    const majority = humanMajorityDecision(trace)
    if (majority) {
      bucket.comparableCases += 1
      if (majority === automatedDecision(trace)) bucket.matches += 1
    }
    byStyle.set(style, bucket)
  })

  return [...byStyle.entries()]
    .map(([style, bucket]) => ({
      comparableCases: bucket.comparableCases,
      matchRate: bucket.comparableCases
        ? roundOne((bucket.matches / bucket.comparableCases) * 100)
        : null,
      matches: bucket.matches,
      style,
    }))
    .sort((left, right) => left.style.localeCompare(right.style))
}

// Counts human reviews that flagged an actual source concern. The reviewer UI
// exposes source support as a single optional "source problem" toggle
// (not_checked <-> partly_supported), so "no flag" is the healthy default, not
// a skipped check - reporting a coverage ratio here would misread that default
// as neglect, just as it would for the optional criterion signals.
export function countFlaggedSourceConcerns(traces: EvaluationTrace[]): number {
  return traces.reduce(
    (sum, trace) =>
      sum +
      humanReviews(trace).filter(
        (review) => review.label === "partly_supported" || review.label === "unsupported",
      ).length,
    0,
  )
}

function addFailureMode(modes: Map<string, Set<string>>, label: string, traceId: string) {
  if (!modes.has(label)) modes.set(label, new Set())
  modes.get(label)?.add(traceId)
}

function failureModeLabelsForTrace(trace: EvaluationTrace) {
  const labels: string[] = []
  if (trace.automated_evaluation.unsupported_claims?.length) labels.push("Unsupported claims")
  if (trace.automated_evaluation.contradicted_claims?.length) labels.push("Contradicted claims")
  if (trace.automated_evaluation.missing_or_incomplete_points?.length) {
    labels.push("Missing or incomplete points")
  }
  if (trace.automated_evaluation.clarity_or_tone_problems?.length) {
    labels.push("Clarity or tone problems")
  }
  if (trace.citizen_question.requires_clarification && automatedDecision(trace) === "accept") {
    labels.push("Clarification need accepted by AI")
  }
  if (trace.citizen_question.requires_clarification && humanMajorityDecision(trace) === "accept") {
    labels.push("Clarification need accepted by humans")
  }
  if ((trace.retrieval_result.chunk_text || "").trim().length < 80) {
    labels.push("Thin retrieved context")
  }
  if (trace.disagreement_case) labels.push("Recorded disagreement")
  return labels
}

export function buildResearchFailureModes(traces: EvaluationTrace[]): ResearchFailureMode[] {
  const modes = new Map<string, Set<string>>()

  traces.forEach((trace) => {
    failureModeLabelsForTrace(trace).forEach((label) => {
      addFailureMode(modes, label, trace.trace_id)
    })
  })

  return [...modes.entries()]
    .map(([label, traceIds]) => ({
      count: traceIds.size,
      label,
      traceIds: [...traceIds],
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}

export function buildResearchRunSummary({
  activeRun,
  reviewerPlan,
  traces,
}: {
  activeRun: DeveloperRun | null
  reviewerPlan?: ReviewerPlan | null
  traces: EvaluationTrace[]
}): ResearchRunSummary {
  const decisionDistribution: ResearchDecisionDistribution = {
    accept: 0,
    needs_edit: 0,
    pending: 0,
    reject: 0,
  }

  let finalMatches = 0
  let finalMismatches = 0
  let sourceMatches = 0
  let sourceMismatches = 0
  let pendingComparisons = 0
  let severeMismatches = 0

  traces.forEach((trace) => {
    const reviews = humanReviews(trace)
    const humanDecision = requiredHumanValue(reviews, (review) => review.final_decision)
    const humanSource = requiredHumanValue(reviews, sourceConcernValue)
    const aiDecision = automatedDecision(trace)
    const finalStatus = comparisonStatus(aiDecision, humanDecision)
    const sourceStatus = sourceComparisonStatus(trace, humanSource)

    if (!reviews.length || finalStatus === "pending") {
      decisionDistribution.pending += 1
      pendingComparisons += 1
    } else if (finalStatus === "human_disagreement") {
      pendingComparisons += 1
    } else {
      decisionDistribution[humanDecision.value as ReviewDecision] += 1
      if (finalStatus === "match") finalMatches += 1
      if (finalStatus === "mismatch") finalMismatches += 1
      if (
        aiDecision === "accept" &&
        (humanDecision.value === "reject" || humanDecision.value === "needs_edit")
      ) {
        severeMismatches += 1
      }
    }

    if (sourceStatus === "match") sourceMatches += 1
    if (sourceStatus === "mismatch") sourceMismatches += 1
  })

  const humanDisagreementCount = countHumanDisagreement(traces)
  const coverage = reviewCoverage(traces, reviewerPlan)
  const interpretableCases = Math.max(0, traces.length - pendingComparisons)
  const interpretation = buildResearchInterpretationSummary({ reviewerPlan, traces })
  const finalMatchRate = interpretableCases ? Math.round((finalMatches / interpretableCases) * 100) : 0

  return {
    agreementCards: [
      {
        detail: `${finalMatches}/${interpretableCases || traces.length} comparable cases`,
        label: "Final-decision match",
        tone: finalMismatches ? "warning" : "ready",
        value: String(finalMatches),
      },
      {
        detail: `${sourceMatches} explicit source-concern matches`,
        label: "Source concerns compared",
        tone: sourceMismatches ? "warning" : "ready",
        value: String(sourceMatches),
      },
      {
        detail: "AI accepts while humans reject or request edits",
        label: "AI too positive",
        tone: severeMismatches ? "danger" : "ready",
        value: String(severeMismatches),
      },
      {
        detail: "Cases where human reviewers disagree",
        label: "Human-human disagreement",
        tone: humanDisagreementCount ? "warning" : "ready",
        value: String(humanDisagreementCount),
      },
    ],
    coverageCards: [
      {
        detail: "Cases with at least one human review",
        label: "Reviewed cases",
        tone: coverage.reviewedCases === traces.length ? "ready" : "warning",
        value: `${coverage.reviewedCases}/${traces.length}`,
      },
      {
        detail: "Completed human reviews against assignment target",
        label: "Review coverage",
        tone: coverage.completedReviews >= coverage.requiredReviews ? "ready" : "warning",
        value: `${coverage.completedReviews}/${coverage.requiredReviews}`,
      },
      {
        detail: "Cases still waiting for a first review",
        label: "Pending cases",
        tone: traces.length - coverage.reviewedCases ? "warning" : "ready",
        value: String(traces.length - coverage.reviewedCases),
      },
      {
        detail: "Traces in selected batch",
        label: "Evaluation cases",
        tone: traces.length ? "quiet" : "warning",
        value: String(traces.length),
      },
    ],
    coreAnswerCards: [
      {
        detail: `${finalMatches}/${interpretableCases || 0} comparable final decisions`,
        label: "AI-human final decision match rate",
        tone: finalMismatches ? "warning" : "ready",
        value: `${finalMatchRate}%`,
      },
      {
        detail: "AI accepted while humans rejected or requested edits",
        label: "AI too positive cases",
        tone: severeMismatches ? "danger" : "ready",
        value: String(severeMismatches),
      },
      {
        detail: "Cases where human reviewers disagree",
        label: "Human-human disagreement",
        tone: humanDisagreementCount ? "warning" : "ready",
        value: String(humanDisagreementCount),
      },
      {
        detail: "Human source check disagrees with judge source label",
        label: "Source-support mismatch",
        tone: sourceMismatches ? "warning" : "ready",
        value: String(sourceMismatches),
      },
      {
        detail: "Missing assigned human reviews",
        label: "Pending / incomplete reviews",
        tone: coverage.incompleteReviews ? "warning" : "ready",
        value: String(coverage.incompleteReviews),
      },
    ],
    decisionDistribution,
    interpretation,
    metadata: [
      ["Batch", activeRun?.batch_id || "No run selected"],
      ["Run type", activeRun?.batch_type || "-"],
      ["Status", activeRun?.status || "-"],
      ["Answer prompt", promptMetadata(activeRun, "answer_prompt_version", "-")],
      ["Judge prompt", promptMetadata(activeRun, "judge_prompt_version", "-")],
      ["Created", activeRun?.created_at || "-"],
    ],
  }
}

function likelyIssue(trace: EvaluationTrace, finalStatus: ResearchAgreementStatus) {
  if (finalStatus === "human_disagreement") return "Human-human disagreement"
  if (trace.disagreement_case?.flag_reason) return trace.disagreement_case.flag_reason
  if (trace.citizen_question.requires_clarification) return "Clarification handling"
  if (trace.automated_evaluation?.unsupported_claims?.length) return "Unsupported claims"
  if (trace.automated_evaluation?.contradicted_claims?.length) return "Contradicted claims"
  if (finalStatus === "mismatch") return "AI-human decision mismatch"
  return "Review attention"
}

function disagreementPriority({
  aiDecision,
  finalDecisionStatus,
  humanDecision,
  sourceSupportStatus,
  trace,
}: {
  aiDecision: ReviewDecision
  finalDecisionStatus: ResearchAgreementStatus
  humanDecision: ReturnType<typeof requiredHumanValue>
  sourceSupportStatus: ResearchAgreementStatus
  trace: EvaluationTrace
}) {
  if (
    aiDecision === "accept" &&
    (humanDecision.value === "needs_edit" || humanDecision.value === "reject")
  ) {
    return { priorityLabel: "AI too positive", priorityRank: 1 }
  }
  if (finalDecisionStatus === "human_disagreement") {
    return { priorityLabel: "Human disagreement", priorityRank: 2 }
  }
  if (sourceSupportStatus === "mismatch" || sourceSupportStatus === "human_disagreement") {
    return { priorityLabel: "Source mismatch", priorityRank: 3 }
  }
  if (humanDecision.value === "needs_edit" || humanDecision.value === "reject") {
    return { priorityLabel: "Rejected / needs edit", priorityRank: 4 }
  }
  if (trace.disagreement_case) return { priorityLabel: "Recorded disagreement", priorityRank: 5 }
  return { priorityLabel: "Review attention", priorityRank: 6 }
}

export function buildResearchDisagreementRows(traces: EvaluationTrace[]): ResearchDisagreementRow[] {
  return traces.flatMap((trace) => {
    const reviews = humanReviews(trace)
    const humanDecision = requiredHumanValue(reviews, (review) => review.final_decision)
    const humanSource = requiredHumanValue(reviews, sourceConcernValue)
    const aiDecision = automatedDecision(trace)
    const finalDecisionStatus = comparisonStatus(aiDecision, humanDecision)
    const normalizedSourceSupportStatus = sourceComparisonStatus(trace, humanSource)
    const needsAttention =
      finalDecisionStatus === "mismatch" ||
      finalDecisionStatus === "human_disagreement" ||
      normalizedSourceSupportStatus === "mismatch" ||
      normalizedSourceSupportStatus === "human_disagreement" ||
      reviews.some((review) => review.final_decision !== "accept") ||
      Boolean(trace.disagreement_case)

    if (!needsAttention) return []
    const priority = disagreementPriority({
      aiDecision,
      finalDecisionStatus,
      humanDecision,
      sourceSupportStatus: normalizedSourceSupportStatus,
      trace,
    })

    return [
      {
        aiDecision,
        disagreementType: trace.disagreement_case?.disagreement_type || "",
        finalDecisionStatus,
        humanDecision: humanDecision.display,
        issue: likelyIssue(trace, finalDecisionStatus),
        ...priority,
        question: trace.citizen_question.question_text,
        severity: trace.disagreement_case?.severity || "",
        service: trace.citizen_question.service_title || trace.service_entry?.title || "-",
        sourceSupportStatus: normalizedSourceSupportStatus,
        style: trace.citizen_question.style_label || "",
        targetSection: trace.citizen_question.target_section || "",
        traceId: trace.trace_id,
      },
    ]
  }).sort((left, right) => {
    if (left.priorityRank !== right.priorityRank) return left.priorityRank - right.priorityRank
    const severityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
    const leftSeverity = severityRank[left.severity] ?? 3
    const rightSeverity = severityRank[right.severity] ?? 3
    return leftSeverity - rightSeverity || left.question.localeCompare(right.question)
  })
}

export function filterResearchDisagreementRows(
  rows: ResearchDisagreementRow[],
  filters: ResearchDisagreementFilters,
) {
  const query = filters.query.trim().toLowerCase()
  return rows.filter((row) => {
    if (filters.decision !== "all" && row.humanDecision !== filters.decision) return false
    if (filters.severity && row.severity !== filters.severity) return false
    if (filters.sourceSupport !== "all" && row.sourceSupportStatus !== filters.sourceSupport) {
      return false
    }
    if (filters.style && row.style !== filters.style) return false
    if (filters.targetSection && row.targetSection !== filters.targetSection) return false
    if (filters.type && row.disagreementType !== filters.type) return false
    if (!query) return true
    return [row.question, row.service, row.traceId, row.issue]
      .join(" ")
      .toLowerCase()
      .includes(query)
  })
}

function selectedHumanDecision(trace: EvaluationTrace) {
  const majority = humanMajorityDecision(trace)
  if (majority) return majority
  const reviews = humanReviews(trace)
  if (!reviews.length) return "pending"
  return requiredHumanValue(reviews, (review) => review.final_decision).display
}

function selectedHumanSource(trace: EvaluationTrace) {
  const reviews = humanReviews(trace)
  if (!reviews.length) return "pending"
  return requiredHumanValue(reviews, sourceConcernValue).display
}

function reviewerContext(review: HumanReview, index: number) {
  const profile = review.reviewer_profile || {}
  const publicService = profileValue(profile, "public_service_familiarity")
  const llm = profileValue(profile, "llm_familiarity")
  const german = profileValue(profile, "german_confidence", "language_confidence_de")
  const parts = [
    publicService ? `public service=${publicService}` : "",
    llm ? `LLM=${llm}` : "",
    german ? `German=${german}` : "",
  ].filter(Boolean)
  return `${reviewerId(review, index)}${parts.length ? ` ${parts.join("; ")}` : ""}`
}

function reviewerNotePriority(note: ResearchReviewerNote) {
  if (note.finalDecision === "reject") return 0
  if (note.finalDecision === "needs_edit") return 1
  if (note.sourceSupport === "unsupported" || note.sourceSupport === "partly_supported") return 2
  return 3
}

export function buildResearchReviewerNotes(traces: EvaluationTrace[]): ResearchReviewerNote[] {
  const rows = traces.flatMap((trace) =>
    humanReviews(trace).flatMap((review, index) => {
      const comment = String(review.comment_text || "").trim()
      const correction = String(review.suggested_correction || "").trim()
      const note = comment || correction
      if (!note) return []
      const noteType: ResearchReviewerNote["noteType"] = comment
        ? "Reviewer comment"
        : "Suggested correction"

      return [
        {
          finalDecision: review.final_decision || "",
          note,
          noteType,
          question: trace.citizen_question.question_text,
          reviewerId: reviewerId(review, index),
          service: trace.citizen_question.service_title || trace.service_entry?.title || "-",
          sourceSupport: review.label || "",
          traceId: trace.trace_id,
        },
      ]
    }),
  )

  return rows.sort((left, right) => {
    const priorityDelta = reviewerNotePriority(left) - reviewerNotePriority(right)
    if (priorityDelta !== 0) return priorityDelta
    return `${left.traceId}:${left.reviewerId}`.localeCompare(`${right.traceId}:${right.reviewerId}`)
  })
}

export function buildResearchCaseDetail(trace: EvaluationTrace): ResearchCaseDetail {
  return {
    aiDecision: automatedDecision(trace),
    answerText: trace.generated_answer.answer_text,
    disagreementReason: trace.disagreement_case?.flag_reason || "No recorded disagreement",
    humanReviews: humanReviews(trace).map((review, index) => ({
      comment: review.comment_text || "",
      decision: review.final_decision,
      profileChips: profileChips(review),
      reviewerId: reviewerId(review, index),
      sourceSupport: review.label,
      suggestedCorrection: review.suggested_correction || "",
    })),
    judgeExplanation: trace.automated_evaluation.explanation || "",
    question: trace.citizen_question.question_text,
    retrievedSource: trace.retrieval_result.chunk_text || "",
    runMetadata: [
      ["Answer model", trace.generated_answer.model_name || "-"],
      [
        "Answer prompt",
        trace.generated_answer.answer_prompt_version ||
          trace.generated_answer.prompt_version ||
          "-",
      ],
      ["Judge model", trace.automated_evaluation.judge_model_name || "-"],
      ["Judge prompt", trace.automated_evaluation.judge_prompt_version || "-"],
      ["Created", trace.created_at || "-"],
    ],
    service: trace.citizen_question.service_title || trace.service_entry?.title || "-",
    sourceUrl:
      trace.citizen_question.source_url ||
      trace.service_entry?.source_url ||
      trace.retrieval_result.source_ref ||
      "",
    traceId: trace.trace_id,
  }
}

export function buildResearchEvidenceRows(traces: EvaluationTrace[]): ResearchEvidenceRow[] {
  return traces.map((trace) => {
    const reviews = humanReviews(trace)
    return {
      aiDecision: automatedDecision(trace),
      disagreement: trace.disagreement_case?.flag_reason || "",
      humanDecision: selectedHumanDecision(trace),
      question: trace.citizen_question.question_text,
      reviewerContext: reviews.map(reviewerContext).join(" | "),
      service: trace.citizen_question.service_title || trace.service_entry?.title || "-",
      sourceSupport: selectedHumanSource(trace),
      traceId: trace.trace_id,
    }
  })
}

function questionType(trace: EvaluationTrace) {
  return (
    trace.citizen_question.generation_method ||
    trace.citizen_question.sample_label ||
    trace.citizen_question.edge_case_label ||
    trace.variant ||
    ""
  )
}

function caseSourceConcern(sourceStatus: ResearchAgreementStatus) {
  if (sourceStatus === "mismatch") return "source_mismatch"
  if (sourceStatus === "human_disagreement") return "human_source_disagreement"
  if (sourceStatus === "pending") return "source_not_checked_or_pending"
  return ""
}

export function buildResearchCaseExportRows(
  batchId: string,
  traces: EvaluationTrace[],
): ResearchCaseExportRow[] {
  return traces.map((trace) => {
    const reviews = humanReviews(trace)
    const humanDecision = requiredHumanValue(reviews, (review) => review.final_decision)
    const humanSource = requiredHumanValue(reviews, sourceConcernValue)
    const aiDecision = automatedDecision(trace)
    const agreementStatus = comparisonStatus(aiDecision, humanDecision)
    const sourceStatus = sourceComparisonStatus(trace, humanSource)
    const failureModes = failureModeLabelsForTrace(trace)
    const needsFollowUp =
      agreementStatus !== "match" ||
      sourceStatus === "mismatch" ||
      sourceStatus === "human_disagreement" ||
      failureModes.length > 0 ||
      reviews.some((review) => review.final_decision !== "accept")

    return {
      batch_id: batchId,
      trace_id: trace.trace_id,
      question_id: trace.citizen_question.question_id,
      service: trace.citizen_question.service_title || trace.service_entry?.title || "",
      question_type: questionType(trace),
      question_style: trace.citizen_question.style_label || "",
      target_section: trace.citizen_question.target_section || "",
      ai_decision: aiDecision,
      human_majority_decision: humanDecision.hasDisagreement
        ? "human_disagreement"
        : humanDecision.value || humanDecision.display,
      agreement_status: agreementStatus,
      source_concern: caseSourceConcern(sourceStatus),
      failure_mode: failureModes.join("; "),
      needs_follow_up: needsFollowUp ? "yes" : "no",
    }
  })
}

function criterionScore(review: HumanReview, criterion: EvaluationCriterionKey) {
  const value = review.criteria?.[criterion]
  return typeof value === "number" ? value : ""
}

export function buildResearchReviewExportRows(
  traces: EvaluationTrace[],
): ResearchReviewExportRow[] {
  return traces.flatMap((trace) =>
    humanReviews(trace).map((review, index) => {
      const profile = review.reviewer_profile || {}
      return {
        trace_id: trace.trace_id,
        reviewer_id: reviewerId(review, index),
        final_decision: review.final_decision,
        source_support_label: review.label,
        criteria_factual_correctness: criterionScore(review, "factual_correctness"),
        criteria_source_support: criterionScore(review, "source_support"),
        criteria_completeness: criterionScore(review, "completeness"),
        criteria_clarity_actionability: criterionScore(review, "clarity_actionability"),
        criteria_public_service_tone: criterionScore(review, "public_service_tone"),
        criteria_uncertainty_handling: criterionScore(review, "uncertainty_handling"),
        reviewer_confidence: review.reviewer_confidence || "",
        profile_background: profileValue(profile, "background", "reviewer_background"),
        profile_public_service_familiarity: profileValue(profile, "public_service_familiarity"),
        profile_llm_familiarity: profileValue(profile, "llm_familiarity"),
        profile_german_confidence: profileValue(
          profile,
          "german_confidence",
          "language_confidence_de",
        ),
        comment_text: review.comment_text || "",
        submitted_at: review.submitted_at || "",
      }
    }),
  )
}
