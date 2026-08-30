import type { ReactNode } from "react"

import type { DashboardOverview, Language } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export type PlaceholderRole = {
  description: string
  icon: ReactNode
  title: string
}

export function DashboardPlaceholder({
  language,
  overview,
  role,
  t,
}: {
  language: Language
  overview: DashboardOverview | null
  role: PlaceholderRole
  t: (language: Language, text: string) => string
}) {
  return (
    <Card className="rounded-3xl border-border bg-card shadow-panel">
      <CardHeader>
        <div className="flex size-11 items-center justify-center rounded-2xl border bg-muted">
          {role.icon}
        </div>
        <CardTitle>{t(language, role.title)}</CardTitle>
        <CardDescription>{t(language, role.description)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t(language, "Questions")} value={overview?.question_count ?? "-"} />
          <Stat label={t(language, "Traces")} value={overview?.trace_count ?? "-"} />
          <Stat
            label={t(language, "Disagreements")}
            value={overview?.disagreement_count ?? "-"}
          />
          <Stat label={t(language, "Services")} value={overview?.service_count ?? "-"} />
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-surface-soft p-5 text-sm leading-6 text-muted-foreground">
          {t(
            language,
            "This role view remains visible so the stakeholder model is clear. Review Explorer and Review Batch are implemented first; this view can be filled next with the role-specific data shown above.",
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-right">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold leading-none">{value}</div>
    </div>
  )
}
