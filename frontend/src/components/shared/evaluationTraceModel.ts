import type { EvaluationTrace, HumanReview, JudgeEvaluation, ReviewDecision, SourceSupport } from "@/types"

export const reviewDecisions: ReviewDecision[] = ["accept", "needs_edit", "reject"]

// The synthetic reviewer id the adjudication (conflict-resolution) review is
// written under. Older rows carry only this id and no `is_adjudication` flag,
// so both the id and the flag have to be recognised.
export const adjudicationReviewerId = "ADJ01"

export function isReviewDecision(value: string | undefined): value is ReviewDecision {
  return Boolean(value && reviewDecisions.includes(value as ReviewDecision))
}

// Every human review on the trace, including reviews the API has marked as
// `excluded`. Use this only for display/audit contexts where an excluded
// reviewer's work must stay visible (with a badge). For any aggregate,
// comparison, or agreement computation use `humanReviews` instead.
export function allHumanReviews(trace: EvaluationTrace): HumanReview[] {
  if (Array.isArray(trace.human_reviews) && trace.human_reviews.length) return trace.human_reviews
  return trace.mock_human_review ? [trace.mock_human_review] : []
}

// Human reviews that count toward aggregates: reviews from reviewers excluded
// from the plan (annotated with `excluded: true` by the API) are dropped. This
// is the chokepoint every computation accessor routes through.
export function humanReviews(trace: EvaluationTrace): HumanReview[] {
  return allHumanReviews(trace).filter((review) => !review.excluded)
}

export function judgeDecision(evaluation: JudgeEvaluation): ReviewDecision {
  const finalDecision = evaluation.final_decision
  if (isReviewDecision(finalDecision)) return finalDecision
  if (evaluation.label === "unsupported") return "reject"
  if (evaluation.judge_score <= 2) return "reject"
  if (evaluation.label === "partly_supported") return "needs_edit"
  if (evaluation.judge_score === 3) return "needs_edit"
  return "accept"
}

export function automatedDecision(trace: EvaluationTrace): ReviewDecision {
  return judgeDecision(trace.automated_evaluation)
}

export function sourceConcernValue(review: HumanReview): SourceSupport | "" {
  return review.label === "not_checked" ? "" : review.label
}

export function majorityValue<T extends string>(values: T[]): T | null {
  if (!values.length) return null
  const counts = new Map<T, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1))
  const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1])
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return null
  return sorted[0][0]
}

export function humanMajorityDecision(trace: EvaluationTrace): ReviewDecision | null {
  return majorityValue(
    humanReviews(trace)
      .map((review) => review.final_decision)
      .filter(isReviewDecision),
  )
}

export function hasHumanReviewDisagreement(reviews: HumanReview[]): boolean {
  if (reviews.length < 2) return false
  return (
    new Set(reviews.map((review) => review.final_decision)).size > 1 ||
    new Set(reviews.map(sourceConcernValue).filter(Boolean)).size > 1
  )
}

export function hasHumanDisagreement(trace: EvaluationTrace): boolean {
  return hasHumanReviewDisagreement(humanReviews(trace))
}

// Note: the audit dashboard deliberately keeps its own, stricter
// `isAdjudicationReview` (flag only, no legacy id fallback), so this local one
// is not exported for reuse.
function isAdjudicationReview(review: HumanReview) {
  return review.is_adjudication === true || review.reviewer_id === adjudicationReviewerId
}

// An adjudication review only counts as a resolution once it carries a real
// decision and has not been reopened. Rows written before `adjudication_status`
// existed have no status and are treated as resolved.
export function isResolvedAdjudicationReview(review: HumanReview) {
  if (!isAdjudicationReview(review) || !isReviewDecision(review.final_decision)) return false
  if (review.adjudication_status === "reopened") return false
  return review.adjudication_status === "resolved" || !review.adjudication_status
}

// Display name for a review row: the reviewer id, else their role, else a
// positional fallback so two anonymous reviews never render as the same person.
export function reviewIdentity(review: HumanReview, index: number) {
  return review.reviewer_id || review.reviewer_role || `Reviewer ${index + 1}`
}
