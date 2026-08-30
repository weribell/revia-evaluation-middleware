import type { Language } from "@/types"

import { DeveloperRunSelect } from "../DeveloperRunSelect"
import { developerTr as tr } from "../developerTraceModel"
import type { DeveloperActiveRun } from "../developerLabModel"

/**
 * "Which run am I looking at?" — the strip that opens a Developer Lab tab.
 * Analysis and Improvement carried byte-identical copies of this markup, so a
 * change to one silently left the other behind.
 */
export function RunSelectorBar({
  batchHistory,
  disabled,
  language,
  onSelectBatch,
  selectedBatchId,
}: {
  batchHistory: NonNullable<DeveloperActiveRun>[]
  disabled: boolean
  language: Language
  onSelectBatch: (batchId: string) => void
  selectedBatchId: string
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-soft px-4 py-3">
      <div className="text-section-title text-foreground">{tr(language, "Evaluation run")}</div>
      <DeveloperRunSelect
        batchHistory={batchHistory}
        disabled={disabled}
        emptyLabel={tr(language, "No saved runs yet")}
        label={tr(language, "View")}
        language={language}
        onSelectBatch={onSelectBatch}
        selectedBatchId={selectedBatchId}
      />
    </div>
  )
}
