import type { Language } from "@/types"
import { developerTr as tr } from "../developerTraceModel.ts"

// Numeric run timestamp (`26.07., 14:30`). Used wherever a run has to be
// identified in a dense list, so the shape has to stay stable across callers.
function numericDateTime(date: Date, language: Language) {
  return new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date)
}

export function formatBatchDate(value: string | undefined, language: Language) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return "-"
  return numericDateTime(date, language)
}

// Textual-month timestamp (`26. Jul., 14:30`). Deliberately a different shape
// from numericDateTime: it labels a single generated artefact rather than a row
// in a list. Do not merge the two - the rendered dates would change.
export function formatShortMonthDateTime(value: string | undefined, language: Language) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return null
  return date.toLocaleString(language === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  })
}

const runTypeLabels: Record<string, { de: string; en: string }> = {
  demo_run: { de: "Demo-Lauf", en: "Demo run" },
  external_evaluation_run: { de: "Importierter Lauf", en: "Imported run" },
  study_run: { de: "Eingefrorener Studienlauf", en: "Frozen study run" },
  test_run: { de: "Testlauf", en: "Test run" },
}

// The one run-type vocabulary. Returns null for unknown batch types so each
// caller keeps its own fallback (raw id, `tr()`, or underscore-stripped text).
export function runTypeLabel(batchType: string, language: Language) {
  const entry = runTypeLabels[batchType]
  if (!entry) return null
  return language === "de" ? entry.de : entry.en
}

export function formatRunDetailValue(label: string, value: string, language: Language) {
  if (label === "Created") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return numericDateTime(date, language)
  }
  if (label === "Run type") {
    const runType = runTypeLabel(value, language)
    if (runType) return runType
  }
  return tr(language, value)
}
