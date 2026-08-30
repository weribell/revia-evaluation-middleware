import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * One stat card for the whole app: caps label, a single metric size, and an
 * optional supporting line. `--text-metric` already documents the intent ("one
 * metric size for every stat card"), but the dashboards each rolled their own
 * tile and drifted to different value sizes (22px here, 18px there).
 *
 * `variant="raised"` sits directly on the page; `inset` sits inside another
 * card or a tinted banner, where a second shadow would read as clutter.
 */
const statValueTone = {
  default: "text-foreground",
  negative: "text-value-negative",
  positive: "text-value-positive",
} as const

const statTileColumns = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 xl:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
} as const

function StatTile({
  action,
  className,
  detail,
  dotColor,
  dotClassName,
  label,
  tone = "default",
  value,
  variant = "raised",
}: {
  action?: ReactNode
  className?: string
  detail?: ReactNode
  /** Ampel colour for the leading dot, e.g. `var(--signal-green)`. */
  dotColor?: string
  /** Tailwind class for the leading dot, for callers that already own a tone map. */
  dotClassName?: string
  label: ReactNode
  tone?: keyof typeof statValueTone
  value: ReactNode
  variant?: "inset" | "raised"
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border px-4 py-3.5",
        variant === "raised" ? "bg-card shadow-card" : "bg-surface-soft",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {dotColor || dotClassName ? (
            <span
              className={cn("size-2 shrink-0 rounded-full", dotClassName)}
              style={dotColor ? { backgroundColor: dotColor } : undefined}
            />
          ) : null}
          <div className="truncate text-caps-sm uppercase text-label">{label}</div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("mt-1.5 truncate text-metric", statValueTone[tone])}>{value}</div>
      {/* The supporting line wraps rather than truncating: it is often a whole
          sentence ("AI accepts while humans reject or request edits"), and a
          clipped explanation is worse than an uneven tile height. */}
      {detail ? (
        <div className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</div>
      ) : null}
    </div>
  )
}

function StatTileGrid({
  children,
  className,
  columns = 4,
}: {
  children: ReactNode
  className?: string
  columns?: keyof typeof statTileColumns
}) {
  return (
    <div className={cn("grid gap-3", statTileColumns[columns], className)}>{children}</div>
  )
}

export { StatTile, StatTileGrid }
