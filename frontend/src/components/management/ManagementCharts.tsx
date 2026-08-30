import { BarChart3, CheckCircle2 } from "lucide-react"

import type { Language } from "@/types"
import { Badge } from "@/components/ui/badge"
import { SectionCard } from "@/components/ui/section-card"
import { StatTile, StatTileGrid } from "@/components/ui/stat-tile"
import type {
  CockpitActionItem,
  CockpitKpi,
  CockpitRiskBar,
} from "./managementCockpitModel"
import { ManagementSectionHeader } from "./ManagementSectionHeader"
import { tr } from "./managementText"
import { cockpitColor } from "./managementTones"

export function CompactKpiGrid({
  items,
  language,
}: {
  items: CockpitKpi[]
  language: Language
}) {
  return (
    <StatTileGrid>
      {items.map((item) => (
        <StatTile
          key={item.id}
          detail={tr(language, item.detail)}
          dotColor={cockpitColor(item.tone)}
          label={tr(language, item.label)}
          value={tr(language, item.value)}
        />
      ))}
    </StatTileGrid>
  )
}

export function RiskSignalBarChart({
  bars,
  language,
}: {
  bars: CockpitRiskBar[]
  language: Language
}) {
  const max = Math.max(1, ...bars.map((bar) => bar.count))

  return (
    <SectionCard className="flex flex-col">
      <ManagementSectionHeader
        detail="Most frequent problem types in reviewed answers."
        icon={<BarChart3 className="size-4" />}
        language={language}
        title="Batch problems"
      />
      {/* flex-1 so content-center can actually centre the bars: this card sits
          beside the taller decision donut and used to leave the slack below. */}
      <div
        aria-label={tr(language, "Batch problems")}
        className="mt-4 grid min-h-48 flex-1 content-center gap-3.5"
        role="img"
      >
        {bars.map((bar) => {
          const width = bar.count ? Math.max(8, (bar.count / max) * 100) : 0
          return (
            <div key={bar.label} className="grid gap-1.5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
                <span className="min-w-0 break-words font-medium leading-5 text-muted-foreground">
                  {tr(language, bar.label)}
                </span>
                <span className="font-semibold text-body">{bar.count}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-chart-track">
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: cockpitColor(bar.count ? bar.tone : "quiet"),
                    width: `${width}%`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

export function AttentionList({
  items,
  language,
}: {
  items: CockpitActionItem[]
  language: Language
}) {
  return (
    <SectionCard>
      <ManagementSectionHeader
        detail="These cases need a decision before the service can go live."
        icon={<CheckCircle2 className="size-4" />}
        language={language}
        title="Before approval"
      />
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-surface-soft px-3 py-2"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: cockpitColor(item.tone) }}
              />
              <span className="min-w-0 break-words text-sm font-semibold leading-5 text-body">
                {tr(language, item.label)}
              </span>
            </span>
            <Badge className="shrink-0" variant={item.count ? "outline" : "secondary"}>
              {item.count}
            </Badge>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
