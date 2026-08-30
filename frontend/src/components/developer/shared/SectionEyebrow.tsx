import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * The small caps line that separates layers of a Developer Lab tab
 * ("More detail — click a row to expand"). Uses the shared --text-caps token
 * instead of the `text-xs font-medium uppercase tracking-wide` spelling that
 * had drifted across five panels.
 */
export function SectionEyebrow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("text-caps uppercase text-label", className)}>{children}</div>
  )
}
