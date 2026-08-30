import type { HumanReview, RetrievalResult } from "../../types"

export const decisions = [
  {
    value: "accept",
    title: "Can be used",
    description: "The answer is useful and can be shown as it is.",
  },
  {
    value: "needs_edit",
    title: "Needs edits",
    description: "The answer is useful, but something should be changed.",
  },
  {
    value: "reject",
    title: "Do not use",
    description: "The answer is too unclear, incomplete, or unreliable.",
  },
] as const

export const reviewBatchInstructions = [
  {
    title: "Read the resident question",
    description: "Focus on what the person is trying to find out.",
  },
  {
    title: "Check the proposed answer",
    description: "Decide whether it would be usable for a real resident.",
  },
  {
    title: "Use the source when needed",
    description: "If something seems unsupported, mark the source concern.",
  },
] as const

export const positiveReviewChecklist = [
  {
    id: "covered_by_source",
    title: "I can find the answer in the official information",
    description: "The important statements are visible in the source text.",
    criterion: "source_support",
    score: 5,
  },
  {
    id: "facts_look_correct",
    title: "I do not see factual mistakes",
    description: "The answer does not seem to contradict the official information.",
    criterion: "factual_correctness",
    score: 5,
  },
  {
    id: "covers_main_question",
    title: "It answers the concrete question directly and completely",
    description: "The central question is answered clearly, not only described in general terms.",
    criterion: "completeness",
    score: 5,
  },
  {
    id: "clear_next_steps",
    title: "The next step is clear",
    description: "The resident can understand what to do next.",
    criterion: "clarity_actionability",
    score: 5,
  },
  {
    id: "simple_language",
    title: "The wording is citizen-friendly enough to act on",
    description:
      "Formal public-administration wording is okay when needed, but the answer still makes the next step understandable.",
    criterion: "clarity_actionability",
    score: 5,
  },
  {
    id: "respectful_tone",
    title: "The tone is respectful and service-oriented",
    description: "It sounds suitable for a public-service answer.",
    criterion: "public_service_tone",
    score: 5,
  },
] as const

export const negativeReviewChecklist = [
  {
    id: "unverified_claims",
    title: "The answer adds links or details I cannot verify",
    description:
      "Use this for extra URLs, fees, deadlines, requirements, or instructions that are not clear from the official source.",
    criterion: "source_support",
    score: 2,
  },
  {
    id: "fact_problem",
    title: "Something looks wrong",
    description: "A fee, document, requirement, place, or time may be incorrect.",
    criterion: "factual_correctness",
    score: 1,
  },
  {
    id: "missing_important_part",
    title: "An important part is missing",
    description: "The resident would still need to ask again about a missing detail.",
    criterion: "completeness",
    score: 2,
  },
  {
    id: "not_direct_answer",
    title: "The answer does not answer the concrete question directly enough",
    description:
      "The answer contains relevant information, but the central question remains unclear or is only answered indirectly.",
    criterion: "completeness",
    score: 2,
  },
  {
    id: "should_ask_clarification",
    title: "The answer should ask for clarification",
    description: "The question or situation is too unclear for a definite answer.",
    criterion: "uncertainty_handling",
    score: 2,
  },
  {
    id: "too_hard_to_understand",
    title: "The answer is hard to use or act on",
    description:
      "The wording may be too abstract, too long, or not concrete enough for a resident, even if some formal terms are necessary.",
    criterion: "clarity_actionability",
    score: 2,
  },
  {
    id: "bad_tone",
    title: "The tone feels unfriendly or unsuitable",
    description: "It may sound dismissive, robotic, or not helpful.",
    criterion: "public_service_tone",
    score: 2,
  },
  {
    id: "other_problem",
    title: "Something else is a problem",
    description: "The problem does not fit the options above. Please describe it in the note.",
    criterion: "other",
    score: 2,
  },
] as const

export const reviewChecklist = [...positiveReviewChecklist, ...negativeReviewChecklist] as const
const problemChecklistIds = new Set<string>(negativeReviewChecklist.map((item) => item.id))

type ReviewCriterion = (typeof reviewChecklist)[number]["criterion"]
export type ReviewChecklistItem = (typeof reviewChecklist)[number]

export type ReviewDraft = {
  decision: string
  sourceSupport: string
  confidence: string
  comment: string
  correction: string
  checkedReviewItems: string[]
}

export type ReviewBatchStep = {
  disabled: boolean
  index: number
  number: number
  status: "current" | "saved" | "available" | "locked"
}

export type ReviewSourceGroup = {
  sourceRef: string
  serviceTitle: string
  sources: RetrievalResult[]
}

export function createEmptyReviewDraft(): ReviewDraft {
  return {
    decision: "",
    sourceSupport: "not_checked",
    confidence: "",
    comment: "",
    correction: "",
    checkedReviewItems: [],
  }
}

export function buildReviewBatchSteps({
  completedCount,
  currentIndex,
  reachableCount,
  total,
}: {
  completedCount: number
  currentIndex: number
  reachableCount?: number
  total: number
}): ReviewBatchStep[] {
  const safeTotal = Math.max(total, 0)
  const safeCompletedCount = Math.min(Math.max(completedCount, 0), safeTotal)
  const safeCurrentIndex = Math.min(Math.max(currentIndex, 0), safeTotal)
  const safeReachableCount = Math.min(
    Math.max(reachableCount ?? Math.max(safeCompletedCount, safeCurrentIndex + 1), 0),
    safeTotal,
  )

  return Array.from({ length: safeTotal }, (_, index) => {
    const status =
      index === safeCurrentIndex
        ? "current"
        : index < safeCompletedCount
          ? "saved"
          : index < safeReachableCount
            ? "available"
            : "locked"
    return {
      disabled: status === "locked",
      index,
      number: index + 1,
      status,
    }
  })
}

export function buildReviewBatchStorageKey(
  baseKey: string,
  participantId = "",
  batchId = "",
) {
  const keyParts = [baseKey]
  if (batchId.trim()) keyParts.push(batchId.trim())
  if (participantId.trim()) keyParts.push(participantId.trim())
  return keyParts.join("_")
}

export function buildReviewSourceGroups(sources: RetrievalResult[]): ReviewSourceGroup[] {
  const groups: ReviewSourceGroup[] = []
  const groupBySourceRef = new Map<string, ReviewSourceGroup>()

  sources.forEach((source) => {
    const sourceRef = source.source_ref || ""
    const groupKey = sourceRef || `${source.service_title}-${groups.length}`
    const existingGroup = groupBySourceRef.get(groupKey)

    if (existingGroup) {
      existingGroup.sources.push(source)
      return
    }

    const nextGroup = {
      sourceRef,
      serviceTitle: source.service_title,
      sources: [source],
    }
    groupBySourceRef.set(groupKey, nextGroup)
    groups.push(nextGroup)
  })

  return groups
}

export function buildReviewDraftFromHumanReview(review?: HumanReview | null): ReviewDraft {
  if (!review) return createEmptyReviewDraft()

  return {
    decision: review.final_decision,
    sourceSupport: review.label,
    confidence: review.reviewer_confidence || "",
    comment: stripSavedChecklistComment(review.comment_text || ""),
    correction: review.suggested_correction || "",
    checkedReviewItems: inferChecklistItemsFromCriteria(review.criteria || {}),
  }
}

export function buildSavedReviewComment(comment: string, checkedIds: string[] = []) {
  void checkedIds
  return comment.trim()
}

function stripSavedChecklistComment(comment: string) {
  return comment.replace(/\n\n(?:Review checklist|Review-Checkliste):.*$/s, "").trim()
}

function inferChecklistItemsFromCriteria(criteria: Record<string, number>) {
  const checked = new Set<string>()
  const mappings = [
    ["source_support", "covered_by_source", "unverified_claims"],
    ["factual_correctness", "facts_look_correct", "fact_problem"],
    ["completeness", "covers_main_question", "missing_important_part"],
    ["clarity_actionability", "clear_next_steps", "too_hard_to_understand"],
    ["public_service_tone", "respectful_tone", "bad_tone"],
    ["uncertainty_handling", "", "should_ask_clarification"],
  ] as const

  for (const [criterion, positiveId, problemId] of mappings) {
    const score = criteria[criterion]
    if (typeof score !== "number") continue
    if (score >= 4 && positiveId) checked.add(positiveId)
    if (score <= 2 && problemId) checked.add(problemId)
  }

  return Array.from(checked)
}

export function reviewRequiresProblemSignal(draft: ReviewDraft) {
  return draft.decision === "needs_edit" || draft.decision === "reject"
}

export function hasProblemSignal(draft: ReviewDraft) {
  return draft.checkedReviewItems.some((itemId) => problemChecklistIds.has(itemId))
}

export function canSaveReviewDraft(draft: ReviewDraft) {
  if (!draft.decision) {
    return {
      canSave: false,
      reason: "Choose whether this answer can be used.",
    }
  }
  if (reviewRequiresProblemSignal(draft) && !hasProblemSignal(draft)) {
    return {
      canSave: false,
      reason: "Choose at least one problem signal before saving this review.",
    }
  }
  if (draft.checkedReviewItems.includes("other_problem") && !draft.comment.trim()) {
    return {
      canSave: false,
      reason: "Please describe the problem in the note.",
    }
  }
  return {
    canSave: true,
    reason: "",
  }
}

export function canAdvanceReviewStep(stepIndex: number, draft: ReviewDraft) {
  if (stepIndex === 0) return Boolean(draft.decision)
  if (stepIndex === 2 && reviewRequiresProblemSignal(draft)) {
    return hasProblemSignal(draft)
  }
  return true
}

export function buildCriteriaFromChecklist(checkedIds: string[]) {
  const grouped = new Map<ReviewCriterion, number[]>()
  reviewChecklist.forEach((item) => {
    if (!checkedIds.includes(item.id)) return
    // "other" is a free-text problem signal, not one of the canonical criteria.
    // Keep it out of the scored criteria so AI/human comparison stays clean.
    if (item.criterion === "other") return
    const values = grouped.get(item.criterion) || []
    values.push(item.score)
    grouped.set(item.criterion, values)
  })

  return Object.fromEntries(
    Array.from(grouped.entries()).map(([criterion, scores]) => [
      criterion,
      aggregateChecklistScores(scores),
    ]),
  ) as Record<string, number>
}

function aggregateChecklistScores(scores: number[]) {
  const hasPositiveSignal = scores.some((score) => score >= 4)
  const hasProblemSignal = scores.some((score) => score <= 2)
  if (hasPositiveSignal && hasProblemSignal) return 3
  if (hasProblemSignal) return Math.min(...scores)
  if (hasPositiveSignal) return Math.max(...scores)
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}
