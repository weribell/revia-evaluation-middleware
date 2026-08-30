import { AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { dashboardBannerClass, dashboardBannerTextClass, type DashboardTone } from "@/lib/dashboardTones"
import type { RunIssueNotice } from "./runIssueNotice"

function bannerTone(tone: RunIssueNotice["tone"]): DashboardTone {
  return tone === "danger" ? "error" : "notice"
}

/**
 * The run-level notice strip above a dashboard. A `RunIssueNotice` renders the
 * full title/description/detail form; a plain string renders the single-line
 * load-error form, so both live in one place.
 */
export function RunIssueNoticeBanner({
  className = "",
  notice,
  translate = (value) => value,
}: {
  className?: string
  notice: RunIssueNotice | string
  translate?: (value: string) => string
}) {
  if (typeof notice === "string") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border px-7 py-6 text-[14.5px] leading-[1.55]",
          dashboardBannerClass.error,
          dashboardBannerTextClass.error,
          className,
        )}
      >
        <AlertCircle className="size-4" />
        {notice}
      </div>
    )
  }

  const tone = bannerTone(notice.tone)

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-2xl border px-7 py-6",
        dashboardBannerClass[tone],
        className,
      )}
    >
      <AlertCircle className={cn("mt-0.5 size-4 shrink-0", dashboardBannerTextClass[tone])} />
      <div className="min-w-0">
        <div className={cn("text-banner-title", dashboardBannerTextClass[tone])}>
          {translate(notice.title)}
        </div>
        <div className={cn("mt-0.5 text-[14.5px] leading-[1.55]", dashboardBannerTextClass[tone])}>
          {translate(notice.description)}
        </div>
        {notice.detail ? (
          <div className={cn("mt-1 break-words text-xs opacity-85", dashboardBannerTextClass[tone])}>
            {notice.detail}
          </div>
        ) : null}
      </div>
    </div>
  )
}
