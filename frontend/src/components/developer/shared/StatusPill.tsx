import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { statusPillIcon, type StatusPillTone } from "./statusPillTones"

/**
 * The one status shape on the case screen: a neutral pill carrying a small
 * coloured icon, with the text left in the ordinary foreground.
 *
 * Judge decisions, human decisions and the attention column all draw through
 * this, so a run with several flagged cases no longer fills the table with
 * saturated blocks in which nothing stands out. What still shouts is the red
 * rail on a flagged row — one loud signal, spent where it is scarce.
 *
 * See `statusPillTones` for why the hue sits on the icon.
 */
export function StatusPill({
  children,
  className,
  tone,
}: {
  children: ReactNode
  className?: string
  tone: StatusPillTone
}) {
  const { Icon, className: iconClassName } = statusPillIcon[tone]

  return (
    <span
      className={cn(
        // `w-fit`, because a pill is often a direct grid child and a grid item
        // stretches to its column by default — which made the attention badge
        // draw a pill the full width of its cell.
        "inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold leading-none",
        "border-[color:var(--chip-neutral-border)] bg-[var(--chip-neutral)] text-[color:var(--chip-neutral-foreground)]",
        className,
      )}
    >
      <Icon className={cn("size-3.5 shrink-0", iconClassName)} aria-hidden />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}
