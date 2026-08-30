import type { CitizenQuestion } from "@/types"

export const batchSize = 20
export const batchStorageKey = "revia_review_batch_v1"
export const participantProfileStorageKey = "revia_reviewer_profile_v1"

export type ReviewerProfile = {
  reviewer_background: string
  public_service_familiarity: string
  llm_familiarity: string
  language_confidence_de: string
}

export function createEmptyReviewerProfile(): ReviewerProfile {
  return {
    reviewer_background: "",
    public_service_familiarity: "",
    llm_familiarity: "",
    language_confidence_de: "",
  }
}

export function buildBatchQuestionIds(questions: CitizenQuestion[]) {
  const targetSize = Math.min(batchSize, questions.length)
  const controlled = questions.filter((question) => !question.generation_method)
  const ai = questions.filter((question) => question.generation_method)
  const result: string[] = []
  const maxLength = Math.max(controlled.length, ai.length)

  for (let index = 0; index < maxLength && result.length < targetSize; index += 1) {
    if (controlled[index]) result.push(controlled[index].question_id)
    if (ai[index] && result.length < targetSize) result.push(ai[index].question_id)
  }

  if (result.length < targetSize) {
    questions.forEach((question) => {
      if (result.length >= targetSize) return
      if (!result.includes(question.question_id)) result.push(question.question_id)
    })
  }

  return result.slice(0, targetSize)
}

export function restoreBatchQuestionIds(storedQuestionIds: unknown, questions: CitizenQuestion[]) {
  const availableQuestionIds = new Set(questions.map((question) => question.question_id))
  const targetSize = Math.min(batchSize, questions.length)
  const restoredIds: string[] = []

  if (Array.isArray(storedQuestionIds)) {
    storedQuestionIds.forEach((questionId) => {
      if (
        typeof questionId === "string" &&
        availableQuestionIds.has(questionId) &&
        !restoredIds.includes(questionId) &&
        restoredIds.length < targetSize
      ) {
        restoredIds.push(questionId)
      }
    })
  }

  if (restoredIds.length < targetSize) {
    buildBatchQuestionIds(questions).forEach((questionId) => {
      if (!restoredIds.includes(questionId) && restoredIds.length < targetSize) {
        restoredIds.push(questionId)
      }
    })
  }

  return restoredIds
}

export function saveBatchProgress(
  storageKey: string,
  questionIds: string[],
  index: number,
  started: boolean,
  completedCount = index,
  reachableCount = Math.max(completedCount, index + 1),
) {
  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      completedCount,
      index,
      questionIds,
      reachableCount,
      started,
    }),
  )
}
