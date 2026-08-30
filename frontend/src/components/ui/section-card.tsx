import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The panel surface every dashboard section sits on. Before this existed the
 * same literal (`rounded-2xl border border-border bg-card p-3 shadow-card`) was
 * written out ~90 times across the dashboards, which is why panel padding and
 * radius drifted apart between Management, Audit and Research.
 *
 * `padding="none"` is for panels whose child owns the edges (tables, lists that
 * bleed to the border).
 */
const sectionCardPadding = {
  compact: "p-3",
  default: "p-4",
  none: "",
} as const

function SectionCard({
  className,
  padding = "default",
  ...props
}: React.ComponentProps<"div"> & { padding?: keyof typeof sectionCardPadding }) {
  return (
    <div
      data-slot="section-card"
      className={cn(
        "min-w-0 rounded-2xl border border-border bg-card shadow-card",
        sectionCardPadding[padding],
        className,
      )}
      {...props}
    />
  )
}

export { SectionCard }
