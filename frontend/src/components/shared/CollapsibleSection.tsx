import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The native `<details>` disclosure used across the dashboards.
 *
 * - `panel`: a standalone bordered summary bar with an icon, sitting above its
 *   content (Analysis accordion sections, repeat-run consistency).
 * - `compact`: a card that wraps summary and content together in one surface
 *   (audit case dossier sections).
 *
 * Every class is written out longhand per variant: Tailwind v4 only generates
 * arbitrary utilities it can find as complete literals in the source, so they
 * cannot be composed from a template string.
 */
export type CollapsibleSectionVariant = "compact" | "panel"

const rootClass: Record<CollapsibleSectionVariant, string> = {
  compact: "group grid gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-card",
  panel: "group",
}

const summaryClass: Record<CollapsibleSectionVariant, string> = {
  compact:
    "flex cursor-pointer list-none items-center justify-between gap-3 text-section-title text-foreground [&::-webkit-details-marker]:hidden",
  panel:
    "flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-section-title text-foreground shadow-card marker:content-none [&::-webkit-details-marker]:hidden",
}

const chevronClass: Record<CollapsibleSectionVariant, string> = {
  compact: "size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180",
  panel: "size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180",
}

const contentClass: Record<CollapsibleSectionVariant, string> = {
  compact: "grid gap-3",
  panel: "mt-3",
}

export function CollapsibleSection({
  children,
  contentClassName,
  defaultOpen = false,
  icon,
  title,
  variant = "panel",
}: {
  children: ReactNode
  /** Extra classes for the content wrapper, e.g. `"grid gap-3"`. */
  contentClassName?: string
  defaultOpen?: boolean
  /** Rendered before the title. Only the `panel` variant carries an icon. */
  icon?: ReactNode
  title: ReactNode
  variant?: CollapsibleSectionVariant
}) {
  return (
    <details className={rootClass[variant]} open={defaultOpen}>
      <summary className={summaryClass[variant]}>
        {variant === "panel" ? (
          <span className="flex min-w-0 items-center gap-2.5">
            {icon}
            {title}
          </span>
        ) : (
          <span>{title}</span>
        )}
        <ChevronDown className={chevronClass[variant]} />
      </summary>
      <div className={cn(contentClass[variant], contentClassName)}>{children}</div>
    </details>
  )
}
