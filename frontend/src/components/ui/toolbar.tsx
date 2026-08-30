import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The strip above a dashboard that carries the run selector and screen-level
 * actions. Same surface as a SectionCard but shorter, so it reads as a control
 * bar rather than as the first panel of content.
 */
function Toolbar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="toolbar"
      className={cn(
        "flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card",
        className,
      )}
      {...props}
    />
  )
}

export { Toolbar }
