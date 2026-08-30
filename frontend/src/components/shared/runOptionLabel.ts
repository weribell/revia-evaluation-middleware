import type { DeveloperRun, Language } from "@/types"
import { runStatusLabel } from "./runIssueNotice.ts"

// The run picker on the Management and Audit dashboards renders the same string
// (`batch_type · N case(s) · status · YYYY-MM-DD`). Each dashboard keeps its own
// German dictionary, so the translator is passed in rather than imported; both
// dictionaries map "case"/"cases" identically.
export function runOptionLabel(
  batch: DeveloperRun,
  language: Language,
  tr: (language: Language, value: string) => string,
) {
  const created = batch.created_at ? batch.created_at.slice(0, 10) : ""
  const caseLabel = tr(language, batch.question_count === 1 ? "case" : "cases")
  return [
    batch.batch_type,
    `${batch.question_count} ${caseLabel}`,
    runStatusLabel(batch.status, language),
    created,
  ].filter(Boolean).join(" · ")
}
