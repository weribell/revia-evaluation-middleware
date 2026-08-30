import type { Language } from "@/types"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  buildReviewerRunSelectOptions,
  type DeveloperActiveRun,
} from "./developerLabModel"

/**
 * base-ui Select cannot hold an empty string as a value, so the "no saved runs"
 * state needs a sentinel. It is never selectable — the trigger is disabled
 * whenever it is showing.
 */
const emptyRunValue = "__no_runs__"

export function DeveloperRunSelect({
  batchHistory,
  className = "",
  disabled = false,
  emptyLabel,
  label,
  language,
  onSelectBatch,
  selectedBatchId,
}: {
  batchHistory: NonNullable<DeveloperActiveRun>[]
  className?: string
  disabled?: boolean
  emptyLabel: string
  label: string
  language: Language
  onSelectBatch: (batchId: string) => void
  selectedBatchId: string
}) {
  const runSelect = buildReviewerRunSelectOptions(batchHistory, selectedBatchId, language)
  const isDisabled = disabled || runSelect.disabled
  // Resolve the display text ourselves. SelectValue renders the raw value, which
  // here would be the bare batch id rather than "10.07. · Imported run · 3 cases".
  const selectedLabel =
    runSelect.options.find((option) => option.value === runSelect.selectedBatchId)?.label ||
    emptyLabel

  return (
    <label
      className={cn(
        "flex min-w-[18rem] max-w-full flex-1 items-center gap-2 text-sm font-medium text-muted-foreground",
        className,
      )}
    >
      {label}
      <Select
        disabled={isDisabled}
        value={runSelect.disabled ? emptyRunValue : runSelect.selectedBatchId}
        onValueChange={(value) => {
          if (value && value !== emptyRunValue) onSelectBatch(value)
        }}
      >
        {/* `w-full` is needed to beat the trigger's own `w-fit` base class. */}
        <SelectTrigger className="h-9 w-full min-w-0 flex-1 rounded-lg border-border bg-card px-2.5 text-sm font-semibold text-foreground shadow-control">
          <span className="min-w-0 truncate text-left">{selectedLabel}</span>
        </SelectTrigger>
        <SelectContent
          align="start"
          className="max-h-[min(24rem,var(--available-height))] min-w-[--anchor-width]"
        >
          {runSelect.disabled ? (
            <SelectItem value={emptyRunValue}>{emptyLabel}</SelectItem>
          ) : null}
          {runSelect.options.map((option) => (
            <SelectItem className="py-2" key={option.value} value={option.value}>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex min-w-0 items-baseline justify-between gap-3">
                  <span className="min-w-0 whitespace-normal break-all font-semibold" title={option.title}>
                    {option.title}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {option.shortId}
                  </span>
                </span>
                <span className="whitespace-normal text-xs leading-4 font-normal text-muted-foreground">
                  {option.detail}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}
