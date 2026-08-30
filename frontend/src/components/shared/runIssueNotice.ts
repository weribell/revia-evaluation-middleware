import type { Language } from "@/types"

/**
 * "notice" is the neutral, non-amber tone for system-level run problems (see
 * lib/dashboardTones.ts). "danger" stays reserved for genuinely failed runs so
 * it doesn't compete visually with the amber "needs_edit" human decision.
 */
export type RunIssueNoticeTone = "danger" | "notice"

export type RunIssueNotice = {
  description: string
  detail: string
  title: string
  tone: RunIssueNoticeTone
}

export type RunIssueSource = {
  metadata?: Record<string, unknown>
  question_count?: number
  status?: string
} | null | undefined

function numericMetadataValue(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key]
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) return Number(value) || 0
  return 0
}

function firstBatchCaseError(metadata: Record<string, unknown> | undefined) {
  const errors = metadata?.case_errors
  if (!Array.isArray(errors)) return { error: "", questionId: "" }
  const [first] = errors
  if (!first || typeof first !== "object") return { error: "", questionId: "" }
  const record = first as Record<string, unknown>

  return {
    error: String(record.error || "").trim(),
    questionId: String(record.question_id || "").trim(),
  }
}

// Composes the full sentence per language instead of interpolating into an
// English template: consumers translate `title` via an exact-match dict, but
// `detail`/`description` are rendered as-is, so any interpolated string would
// always stay English regardless of the active language.
function batchErrorDetail(metadata: Record<string, unknown> | undefined, language: Language) {
  const firstError = firstBatchCaseError(metadata)
  const questionLabel = language === "de" ? "Frage" : "Question"
  return [
    firstError.questionId ? `${questionLabel}: ${firstError.questionId}` : "",
    firstError.error,
  ].filter(Boolean).join(" · ")
}

export function buildRunIssueNotice(run: RunIssueSource, language: Language = "en"): RunIssueNotice | null {
  if (!run) return null

  if (run.status === "failed") {
    return {
      description:
        language === "de"
          ? "Es wurden keine Evaluationsfälle erzeugt."
          : "No evaluation cases were created.",
      detail: batchErrorDetail(run.metadata, language),
      title: "Batch failed",
      tone: "danger",
    }
  }

  if (run.status === "completed_with_errors") {
    const completedCases = numericMetadataValue(run.metadata, "completed_cases")
    const failedCases = numericMetadataValue(run.metadata, "failed_cases")
    const totalCases = run.question_count || completedCases + failedCases

    const description =
      language === "de"
        ? `${completedCases} von ${totalCases} ${totalCases === 1 ? "Fall" : "Fällen"} ${totalCases === 1 ? "wurde" : "wurden"} erstellt. ${failedCases} ${failedCases === 1 ? "Fall" : "Fälle"} fehlgeschlagen.`
        : `${completedCases} of ${totalCases} cases were created. ${failedCases} ${failedCases === 1 ? "case failed" : "cases failed"}.`

    return {
      description,
      detail: batchErrorDetail(run.metadata, language),
      title: "Run completed with errors",
      tone: "notice",
    }
  }

  return null
}

export function runStatusLabel(status: string | undefined, language: "de" | "en") {
  if (status === "failed") return language === "de" ? "fehlgeschlagen" : "failed"
  if (status === "completed_with_errors") {
    return language === "de" ? "mit Fehlern abgeschlossen" : "completed with errors"
  }
  if (status === "running") return language === "de" ? "läuft" : "running"
  return ""
}
