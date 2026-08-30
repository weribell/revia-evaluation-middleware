import type { ReactNode } from "react"

import type { CitizenQuestion, Language } from "@/types"
import { Badge } from "@/components/ui/badge"
import { dashboardToneClass } from "@/lib/dashboardTones"
import { cn } from "@/lib/utils"

/**
 * The badge pair that says where a citizen question came from and which service section it
 * targets: origin first, target section last. Anything passed as `children` renders between
 * the two, which is where the question picker puts its work tags.
 */
export function QuestionOriginBadges({
  children,
  language,
  question,
  sectionLabel,
  t,
}: {
  children?: ReactNode
  language: Language
  question: CitizenQuestion
  sectionLabel: (language: Language, sectionName: string) => string
  t: (language: Language, text: string) => string
}) {
  return (
    <>
      <Badge
        variant={question.generation_method ? "default" : "secondary"}
        className={cn(
          question.generation_method
            ? "bg-[var(--dashboard-active)] text-[var(--dashboard-active-foreground)]"
            : dashboardToneClass.source,
        )}
      >
        {question.generation_method ? t(language, "AI") : t(language, "Controlled")}
      </Badge>
      {children}
      <Badge variant="outline" className={dashboardToneClass.judge}>
        {sectionLabel(language, question.target_section)}
      </Badge>
    </>
  )
}
