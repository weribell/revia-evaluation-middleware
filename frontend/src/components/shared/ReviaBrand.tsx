import { cn } from "@/lib/utils"

import { buildDashboardBrandContext } from "../../branding"
import type { Language } from "../../types"

type ReviaBrandHeaderProps = {
  compact?: boolean
  description?: string
  language: Language
  title: string
  t: (language: Language, text: string) => string
}

export function ReviaBrandHeader({
  compact = false,
  description,
  language,
  title,
  t,
}: ReviaBrandHeaderProps) {
  const context = buildDashboardBrandContext({
    title: t(language, title),
  })

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5 lg:gap-6">
      <div className="min-w-0 shrink-0">
        <img
          alt={context.productName}
          className={cn(
            "block h-auto object-contain",
            compact ? "w-[140px]" : "w-[12rem] sm:w-[14rem] lg:w-[15rem]",
          )}
          src={context.productLogoPath}
        />
        <p
          className={cn(
            "mt-1 text-center font-medium text-primary",
            compact ? "text-[0.7rem] leading-3" : "text-sm leading-4",
          )}
        >
          {context.productSubtitleLines.map((line) => (
            <span className="block" key={line}>
              {line}
            </span>
          ))}
        </p>
      </div>
      <div
        className={cn(
          "min-w-0 border-l border-[color:var(--dashboard-human-border)] pl-5 leading-tight text-foreground",
          compact ? "max-w-[42rem]" : "max-w-[50rem]",
        )}
      >
        <div className={cn("font-semibold", compact ? "text-xl lg:text-2xl" : "text-2xl lg:text-3xl")}>
          {context.workspaceTitle}
        </div>
        {description ? (
          <p
            className={cn(
              "mt-1 max-w-prose font-medium leading-snug text-muted-foreground",
              compact ? "text-sm" : "text-base",
            )}
          >
            {t(language, description)}
          </p>
        ) : null}
      </div>
    </div>
  )
}
