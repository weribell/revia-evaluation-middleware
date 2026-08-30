import { developerTr as tr } from "../developerTraceModel"
import { cn } from "@/lib/utils"
import type { Language } from "@/types"
import { formatRunDetailValue } from "./developerFormatters"

export function RunDetailPill({
  label,
  language,
  value,
}: {
  label: string
  language: Language
  value: string
}) {
  const displayValue = formatRunDetailValue(label, value, language)

  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-border bg-card/70 px-3 py-2",
      )}
    >
      <div className="text-xs font-medium leading-tight text-muted-foreground">{tr(language, label)}</div>
      <div
        className={cn(
          "mt-0.5 text-sm font-semibold leading-tight text-foreground",
          label === "Created" ? "whitespace-nowrap" : "truncate",
        )}
      >
        {displayValue}
      </div>
    </div>
  )
}
