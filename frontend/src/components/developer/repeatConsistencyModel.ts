import type { EvaluationCriterionKey, RepeatConsistencyCase, RepeatConsistencyResponse } from "@/types"
import { criterionDefinitions, type DeveloperActiveRun, type DeveloperWorklistItem } from "./developerLabModel"

const IMPORTED_QUESTION_PREFIX = "imported_"

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string {
  const value = metadata?.[key]
  return typeof value === "string" ? value.trim() : ""
}

/** Import id of the active/selected run, or "" for non-imported runs. */
export function readImportId(activeRun: DeveloperActiveRun): string {
  return metadataString(activeRun?.metadata, "import_id")
}

export type RepeatConsistencyRequest = {
  importId: string
  judgePromptVersion?: string
  judgeModelName?: string
  judgeContextLabel?: string
}

/**
 * Build the repeat-consistency request for a run, passing the run's own judge
 * settings as filters so only truly comparable repeat runs are pooled. Empty
 * filter values are omitted (older runs may carry empty labels). Returns null
 * for internally generated runs without an import id, so callers can skip
 * the fetch entirely.
 */
export function repeatConsistencyRequestForRun(
  activeRun: DeveloperActiveRun,
): RepeatConsistencyRequest | null {
  const importId = readImportId(activeRun)
  if (!importId) return null
  const metadata = activeRun?.metadata
  const request: RepeatConsistencyRequest = { importId }
  const judgePromptVersion = metadataString(metadata, "judge_prompt_version")
  const judgeModelName = metadataString(metadata, "judge_model_name")
  const judgeContextLabel = metadataString(metadata, "judge_context_label")
  if (judgePromptVersion) request.judgePromptVersion = judgePromptVersion
  if (judgeModelName) request.judgeModelName = judgeModelName
  if (judgeContextLabel) request.judgeContextLabel = judgeContextLabel
  return request
}

/** True only when at least two comparable repeat runs were pooled. */
export function hasComparableRepeatRuns(
  data: RepeatConsistencyResponse | null | undefined,
): data is RepeatConsistencyResponse {
  return Boolean(data && data.aggregates.run_count >= 2)
}

/** Strip the synthetic `imported_` prefix used on imported question ids. */
export function caseIdFromQuestionId(questionId: string | undefined): string {
  const raw = (questionId || "").trim()
  return raw.startsWith(IMPORTED_QUESTION_PREFIX)
    ? raw.slice(IMPORTED_QUESTION_PREFIX.length)
    : raw
}

/**
 * Map each worklist trace id to its repeat-consistency case (if any), so the
 * Results table can flag traces whose judge decision was unstable across runs.
 */
export function buildTraceStabilityMap(
  items: DeveloperWorklistItem[],
  data: RepeatConsistencyResponse | null | undefined,
): Map<string, RepeatConsistencyCase> {
  const byTrace = new Map<string, RepeatConsistencyCase>()
  if (!hasComparableRepeatRuns(data)) return byTrace
  const byCaseId = new Map(data.cases.map((entry) => [entry.case_id, entry]))
  for (const item of items) {
    const caseId = caseIdFromQuestionId(item.trace.citizen_question?.question_id)
    const entry = caseId ? byCaseId.get(caseId) : undefined
    if (entry && (entry.route_to_human || entry.judge_stability !== "stable")) {
      byTrace.set(item.trace.trace_id, entry)
    }
  }
  return byTrace
}

const criterionLabelByKey = new Map(criterionDefinitions.map((definition) => [definition.key, definition.label]))

export type RepeatConsistencyCriterionBadge = {
  key: string
  label: string
  minScore: number
  maxScore: number
}

/**
 * Compact "label min→max" badges for a case's flipped criteria, resolving the
 * label from the shared criterion definitions and dropping any criterion left
 * with fewer than two numeric scores (nothing meaningful to show as a range).
 */
export function flippedCriteriaBadges(entry: RepeatConsistencyCase): RepeatConsistencyCriterionBadge[] {
  return (entry.flipped_criteria ?? []).flatMap((criterion) => {
    const present = criterion.scores.filter((score): score is number => typeof score === "number")
    if (present.length < 2) return []
    return [
      {
        key: criterion.key,
        label: criterionLabelByKey.get(criterion.key as EvaluationCriterionKey) || criterion.key,
        minScore: Math.min(...present),
        maxScore: Math.max(...present),
      },
    ]
  })
}
