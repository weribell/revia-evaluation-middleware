import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * The single header treatment for a SectionCard or a group of cards: an
 * optional icon badge, a title, a supporting line, and a trailing action slot.
 *
 * One component on purpose. The Management screen alone used to show three
 * different header shapes side by side (no icon; a bare icon; an icon in a
 * bordered badge), which made panels of equal importance look unequal.
 *
 * `size="lg"` is for the leading panel of a screen; `sm` is the workhorse.
 */
function PanelHeader({
  action,
  className,
  description,
  icon,
  size = "sm",
  title,
}: {
  action?: ReactNode
  className?: string
  description?: ReactNode
  icon?: ReactNode
  size?: "lg" | "sm"
  title: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 justify-between gap-3",
        description ? "items-start" : "items-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 gap-3",
          description ? "items-start" : "items-center",
        )}
      >
        {icon ? (
          <span
            className={cn(
              "grid shrink-0 place-items-center border border-border bg-card text-body shadow-control",
              size === "lg" ? "size-11 rounded-xl" : "size-9 rounded-lg",
            )}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3
            className={cn(
              "text-foreground",
              size === "lg" ? "text-panel-title" : "text-section-title",
            )}
          >
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  )
}

export { PanelHeader }
