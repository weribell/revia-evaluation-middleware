import { decisionLabel, normalizeDecision } from "@/lib/decisionDisplay"
import { cn } from "@/lib/utils"
import type { Language } from "@/types"
import { developerTr as tr } from "../developerTraceModel"
import { semanticToneClasses, type DashboardSemanticTone } from "./developerToneClasses"

export function StatusText({
  language,
  tone = "neutral",
  truncate = false,
  value,
}: {
  language?: Language
  tone?: DashboardSemanticTone
  truncate?: boolean
  value: string
}) {
  const colored = tone !== "neutral"
  const displayValue = language
    ? normalizeDecision(value)
      ? decisionLabel(language, value)
      : tr(language, value)
    : value

  return (
    <div
      className={cn(
        "min-w-0 pr-4 text-sm font-medium text-body",
        colored && "inline-flex max-w-full rounded-full border px-2 py-1 text-xs font-semibold leading-none",
        colored && semanticToneClasses(tone),
        truncate && "truncate",
      )}
      title={truncate ? displayValue : undefined}
    >
      {displayValue}
    </div>
  )
}
