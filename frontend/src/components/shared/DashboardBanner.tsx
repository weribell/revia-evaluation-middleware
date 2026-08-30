import type { ComponentType, ReactNode } from "react"

import { cn } from "@/lib/utils"
import { dashboardBannerClass, dashboardBannerShade, type DashboardTone } from "@/lib/dashboardTones"

/**
 * The page-level banner that opens a dashboard: a tone-tinted surface, an icon
 * chip, a small-caps eyebrow, the headline with an optional status pill, and one
 * line of body copy. An optional `trailing` block sits beside it in a second
 * column.
 *
 * The shade ramp (eyebrow / title / accent / chip / dot / body) comes from
 * `dashboardBannerShade`, so a banner reads as one tone. Every arbitrary utility
 * is written out here as a complete literal — Tailwind v4 only generates the
 * ones it can find literally in the source, so they cannot be composed.
 */
export function DashboardBanner({
  ariaLabel,
  body,
  bodyClassName,
  eyebrow,
  icon: Icon,
  layoutClassName,
  pill,
  title,
  tone,
  trailing,
}: {
  ariaLabel?: string
  body: ReactNode
  /** Extra classes for the body paragraph, e.g. `"max-w-2xl"`. */
  bodyClassName?: string
  eyebrow: ReactNode
  icon: ComponentType<{ className?: string }>
  /** Column template for the row holding the banner and `trailing`. */
  layoutClassName?: string
  /** Status pill content; rendered after the tone dot. */
  pill?: ReactNode
  title: ReactNode
  tone: DashboardTone
  trailing?: ReactNode
}) {
  const shade = dashboardBannerShade[tone]

  const main = (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-13 shrink-0 items-center justify-center rounded-lg border",
          shade.chip,
        )}
      >
        <Icon className={cn("size-5", shade.accent)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn("text-caps-sm uppercase", shade.eyebrow)}>{eyebrow}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className={cn("text-banner-title-lg", shade.title)}>{title}</h2>
          {pill ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-[11px] py-[3px] text-xs font-bold",
                shade.chip,
              )}
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", shade.dot)} />
              {pill}
            </span>
          ) : null}
        </div>
        <p className={cn("mt-2 text-[13.5px] leading-[1.55]", bodyClassName, shade.body)}>{body}</p>
      </div>
    </div>
  )

  return (
    <div aria-label={ariaLabel} className={cn("rounded-2xl border px-7 py-6", dashboardBannerClass[tone])}>
      {trailing ? (
        <div className={cn("grid gap-3", layoutClassName)}>
          {main}
          {trailing}
        </div>
      ) : (
        main
      )}
    </div>
  )
}
