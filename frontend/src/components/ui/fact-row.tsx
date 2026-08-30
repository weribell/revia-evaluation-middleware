import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** A label/value line inside a panel: quiet label on the left, the figure right. */
function FactRow({
  className,
  label,
  value,
}: {
  className?: string
  label: ReactNode
  value: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm",
        className,
      )}
    >
      <span className="min-w-0 text-muted-foreground">{label}</span>
      <span className="shrink-0 font-semibold text-body">{value}</span>
    </div>
  )
}

export { FactRow }
