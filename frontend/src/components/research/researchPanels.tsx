import { useState, type ReactNode } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Gauge,
  ListChecks,
  MessageSquareText,
  ShieldAlert,
  Sigma,
} from "lucide-react"

import type { Language } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTableHeader, DataTableRow } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { PanelHeader } from "@/components/ui/panel-header"
import { SectionCard } from "@/components/ui/section-card"
import { StatTile } from "@/components/ui/stat-tile"
import {
  dashboardBannerBadgeClass,
  dashboardBannerClass,
  dashboardBannerShade,
  dashboardBannerTextClass,
  dashboardDotClass,
  dashboardToneClass,
} from "@/lib/dashboardTones"
import { decisionLabel, decisionTone } from "@/lib/decisionDisplay"
import { cn } from "@/lib/utils"
import {
  buildResearchConfusionMatrix,
  buildResearchSampleContext,
  type ResearchAgreementStat,
  type ResearchCriterionRow,
  type ResearchFailureMode,
  type ResearchInterpretationSummary,
  type ResearchMetricCard,
  type ResearchReviewerBreakdownRow,
  type ResearchReviewerNote,
  type ResearchStyleAgreementRow,
} from "./researchDashboardModel"
import {
  compactWarningLabel,
  criterionLabel,
  dashboardTone,
  displayValue,
  formatAverage,
  tr,
} from "./researchText"

export function MetricCard({ card, language }: { card: ResearchMetricCard; language: Language }) {
  const tone = dashboardTone(card.tone)
  return (
    <StatTile
      detail={tr(language, card.detail)}
      dotClassName={tone !== "neutral" ? dashboardDotClass[tone] : "bg-signal-grey"}
      label={
        <span className={tone !== "neutral" ? dashboardBannerTextClass[tone] : undefined}>
          {tr(language, card.label)}
        </span>
      }
      value={card.value}
    />
  )
}

function SectionHeader({
  description,
  icon,
  title,
}: {
  description?: string
  icon: ReactNode
  title: string
}) {
  return <PanelHeader className="mb-3" description={description} icon={icon} title={title} />
}

export function InterpretationPanel({
  interpretation,
  language,
}: {
  interpretation: ResearchInterpretationSummary
  language: Language
}) {
  const facts = [
    ["sample size", interpretation.sampleSize],
    ["reviewed cases", interpretation.reviewedCases],
    ["2+ reviews", interpretation.multiReviewCases],
    ["source concerns", interpretation.sourceConcernCases],
  ]

  // "warning" here means a data-quality/system message (e.g. sample too thin),
  // not the needs_edit decision, so it renders as the neutral "notice" tone
  // instead of the amber tone reserved for that decision.
  const tone = interpretation.tone === "warning" ? "notice" : dashboardTone(interpretation.tone)
  return (
    <div className={cn("rounded-2xl border px-7 py-6", dashboardBannerClass[tone])}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-start">
        <div className="min-w-0">
          <div
            className={cn(
              "flex items-center gap-2 text-caps uppercase",
              dashboardBannerTextClass[tone],
            )}
          >
            {interpretation.strength === "thin" ? (
              <AlertTriangle className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {tr(language, "Research interpretation summary")}
          </div>
          <div
            className={cn(
              "mt-2 text-banner-title",
              dashboardBannerTextClass[tone],
            )}
          >
            {tr(language, interpretation.headline)}
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
          {facts.map(([label, value]) => (
            <div
              key={label}
              className={cn(
                "rounded-lg border px-2.5 py-2 sm:px-3 sm:py-2",
                dashboardBannerBadgeClass[tone],
              )}
            >
              <div
                className={cn(
                  // No nowrap: "Quellenprobleme" is wider than the tile at any
                  // size the label is still legible at, so it has to wrap.
                  "break-words hyphens-auto text-caps-sm uppercase leading-tight [overflow-wrap:anywhere]",
                  dashboardBannerShade[tone].eyebrow,
                )}
              >
                {tr(language, String(label))}
              </div>
              {/* Same --text-metric as every other stat card: these four tiles
                  used to render one step smaller, so the Analysis tab showed
                  two different metric sizes on one screen. */}
              <div className="mt-1 text-metric text-foreground">{value}</div>
            </div>
          ))}
        </div>
      </div>
      {interpretation.warnings.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {interpretation.warnings.map((warning) => (
            <Badge key={warning} variant="outline" className="gap-1.5 border-current/20 bg-card/60">
              <AlertTriangle className="size-3.5" />
              {tr(language, compactWarningLabel(warning))}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function SampleContextPanel({
  items,
  language,
  showHeader = true,
}: {
  items: ReturnType<typeof buildResearchSampleContext>
  language: Language
  showHeader?: boolean
}) {
  const description = tr(
    language,
    "Breakdown by Question source, Answerability, Question style, Target section, and Intent type.",
  )
  return (
    <SectionCard>
      {showHeader ? (
        <SectionHeader
          title={tr(language, "Sample composition")}
          icon={<ClipboardList className="size-4" />}
          description={description}
        />
      ) : (
        <div className="mb-3 text-xs leading-5 text-muted-foreground">{description}</div>
      )}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="min-w-0 overflow-hidden rounded-md border border-border bg-surface-soft p-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-caps uppercase text-label">
                {tr(language, item.label)}
              </div>
              <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[11px]">
                n={item.total}
              </Badge>
            </div>
            <div className="mt-1 min-w-0 break-words text-sm font-semibold leading-5 text-body">
              {displayValue(language, item.primary)}
            </div>
            <div className="mt-2 grid min-w-0 gap-1.5">
              {item.distribution.map((part) => {
                const percent = item.total ? Math.round((part.count / item.total) * 100) : 0
                return (
                  <div key={part.label} className="min-w-0">
                    <div className="mb-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="min-w-0 truncate">{displayValue(language, part.label)}</span>
                      <span className="shrink-0 font-medium">{part.count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-chart-track">
                      <div
                        className={cn("h-full rounded-full", dashboardDotClass.source)}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

export function ConfusionMatrix({
  cells,
  humanDecisionDisagreements,
  language,
}: {
  cells: ReturnType<typeof buildResearchConfusionMatrix>["cells"]
  humanDecisionDisagreements: number
  language: Language
}) {
  const decisions = ["accept", "needs_edit", "reject"] as const
  return (
    <DataTable columns="repeat(4, minmax(0, 1fr))" minWidth="34rem">
      <div className="border-b border-border bg-surface-soft px-3 py-3">
        <div className="text-section-title text-body">
          {tr(language, "Final decision table")}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {tr(
            language,
            "Rows show the AI judge decision. Columns show the human reviewer majority decision.",
          )}{" "}
          {tr(
            language,
            "Split human decisions without a majority are counted above and excluded here.",
          )}
        </div>
      </div>
      <DataTableHeader>
        <div />
        {decisions.map((decision) => (
          <div key={decision} className="text-center">
            {tr(language, "Human decision")}: {decisionLabel(language, decision)}
          </div>
        ))}
      </DataTableHeader>
      {decisions.map((aiDecision) => (
        <DataTableRow key={aiDecision} className="items-center">
          <div className="font-semibold text-body">
            {tr(language, "AI")}: {decisionLabel(language, aiDecision)}
          </div>
          {decisions.map((humanDecision) => {
            const count =
              cells.find(
                (cell) =>
                  cell.aiDecision === aiDecision && cell.humanDecision === humanDecision,
              )?.count || 0
            const isDiagonal = aiDecision === humanDecision
            // The central research risk: the AI judge accepted an answer
            // humans would revise or reject. Emphasized beyond the normal
            // risk fill so it reads as the headline signal in the matrix.
            const isFalseAccept =
              aiDecision === "accept" && (humanDecision === "needs_edit" || humanDecision === "reject")
            return (
              <div
                key={humanDecision}
                className={cn(
                  "mx-auto flex h-9 w-14 items-center justify-center rounded-lg border text-sm font-semibold",
                  isDiagonal && count
                    ? dashboardToneClass.ready
                    : !isDiagonal && count
                      ? dashboardToneClass.risk
                      : "border-border bg-card text-muted-foreground",
                  isFalseAccept && count
                    ? "text-base font-bold ring-2 ring-[color:var(--dashboard-risk-border)] ring-offset-1 ring-offset-card"
                    : null,
                )}
              >
                {count}
              </div>
            )
          })}
        </DataTableRow>
      ))}
      {cells.some(
        (cell) =>
          cell.count > 0 &&
          cell.aiDecision === "accept" &&
          (cell.humanDecision === "needs_edit" || cell.humanDecision === "reject"),
      ) ? (
        <div className="border-t border-border bg-surface-soft px-3 py-2 text-xs text-muted-foreground">
          {tr(
            language,
            "Highlighted cells are false accepts: the AI judge accepted answers that humans would revise or reject.",
          )}
        </div>
      ) : null}
      {humanDecisionDisagreements ? (
        <div className="border-t border-border bg-[var(--dashboard-human)] px-3 py-2 text-xs text-[color:var(--dashboard-human-foreground)]">
          {humanDecisionDisagreements}{" "}
          {tr(
            language,
            humanDecisionDisagreements === 1
              ? "split human decision"
              : "split human decisions",
          )}{" "}
          {tr(language, "excluded from this majority table.")}{" "}
          {tr(
            language,
            "Split cases stay separate instead of being counted as fractional votes.",
          )}
        </div>
      ) : null}
    </DataTable>
  )
}

export function CriterionComparisonPanel({
  language,
  rows,
  showHeader = true,
}: {
  language: Language
  rows: ResearchCriterionRow[]
  showHeader?: boolean
}) {
  const description = tr(
    language,
    "Reviewers can flag optional problems; an unselected item means only that no problem was reported, not that the criterion was approved.",
  )
  return (
    <DataTable columns="1.3fr 0.6fr 1.6fr 1.1fr" minWidth="42rem">
      {showHeader ? (
        <div className="border-b border-border bg-surface-soft px-3 py-3">
          <div className="flex items-center gap-2 text-section-title text-body">
            <ListChecks className="size-4" />
            {tr(language, "Criterion-level comparison")}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        </div>
      ) : (
        <div className="border-b border-border bg-surface-soft px-3 py-2 text-xs leading-5 text-muted-foreground">
          {description}
        </div>
      )}
      <DataTableHeader>
        <div>{tr(language, "Criterion")}</div>
        <div>{tr(language, "AI avg")}</div>
        <div>{tr(language, "Human problem signals")}</div>
        <div>{tr(language, "Score evidence")}</div>
      </DataTableHeader>
      {rows.map((row) => (
        <DataTableRow key={row.criterion} className="items-center">
          <div className="font-semibold text-body">
            {tr(language, criterionLabel(row.criterion))}
          </div>
          <div className="text-body">{formatAverage(row.aiAverage)}</div>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant={row.humanProblemSignals ? "destructive" : "outline"}>
              {row.humanProblemSignals}{" "}
              {tr(language, row.humanProblemSignals === 1 ? "problem reported" : "problems reported")}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {tr(language, "across")} {row.reviewsTotal} {tr(language, "reviews")}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {row.aiDistribution.length ? (
              <Badge variant="outline">
                AI {row.aiDistribution.map((item) => `${item.label}:${item.count}`).join(" ")}
              </Badge>
            ) : null}
            {row.humanDistribution.length ? (
              <Badge variant="secondary">
                H {row.humanDistribution.map((item) => `${item.label}:${item.count}`).join(" ")}
              </Badge>
            ) : null}
            {!row.aiDistribution.length && !row.humanDistribution.length ? (
              <span className="text-xs text-muted-foreground">
                {tr(language, "No score data")}
              </span>
            ) : null}
          </div>
        </DataTableRow>
      ))}
    </DataTable>
  )
}

export function FailureModesPanel({
  language,
  modes,
  showHeader = true,
}: {
  language: Language
  modes: ResearchFailureMode[]
  showHeader?: boolean
}) {
  const totalSignals = modes.reduce((sum, mode) => sum + mode.count, 0)
  const maxFailureModeCount = Math.max(0, ...modes.map((mode) => mode.count))
  const description = tr(
    language,
    "Distribution of recurring answer, retrieval, and judge-process risks visible in this run.",
  )
  return (
    <SectionCard>
      {showHeader ? (
        <SectionHeader
          description={description}
          icon={<ShieldAlert className="size-4" />}
          title={tr(language, "Failure mode distribution")}
        />
      ) : (
        <div className="mb-3 text-xs leading-5 text-muted-foreground">{description}</div>
      )}
      {modes.length ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-soft px-3 py-2">
            <div>
              <div className="text-caps uppercase text-label">
                {tr(language, "Recorded failure signals")}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {tr(language, "Failure mode signals can overlap across the same case.")}
              </div>
            </div>
            <div className="text-base font-semibold text-body">{totalSignals}</div>
          </div>
          {modes.map((mode) => (
            <div key={mode.label} className="rounded-lg border border-border bg-card px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-body">
                    {tr(language, mode.label)}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground font-mono">
                    {mode.traceIds.slice(0, 4).join(", ")}
                    {mode.traceIds.length > 4 ? " ..." : ""}
                  </div>
                </div>
                <Badge variant={mode.count ? "outline" : "secondary"}>{mode.count}</Badge>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-chart-track">
                <div
                  className={cn("h-full rounded-full", dashboardDotClass.risk)}
                  style={{
                    width: `${maxFailureModeCount ? Math.max(6, (mode.count / maxFailureModeCount) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>{tr(language, "No failure modes recorded for this run.")}</EmptyState>
      )}
    </SectionCard>
  )
}

const REVIEWER_NOTES_COLLAPSED_LIMIT = 8

export function ReviewerNotesPanel({
  language,
  notes,
  onSelectTrace,
  showHeader = true,
}: {
  language: Language
  notes: ResearchReviewerNote[]
  onSelectTrace?: (traceId: string) => void
  showHeader?: boolean
}) {
  const [showAll, setShowAll] = useState(false)
  const canCollapse = notes.length > REVIEWER_NOTES_COLLAPSED_LIMIT
  const visibleNotes = showAll ? notes : notes.slice(0, REVIEWER_NOTES_COLLAPSED_LIMIT)

  return (
    <SectionCard>
      {showHeader ? (
        <SectionHeader
          description={tr(
            language,
            "Free-text reviewer comments and corrections that can support the discussion chapter.",
          )}
          icon={<MessageSquareText className="size-4" />}
          title={tr(language, "Qualitative reviewer notes")}
        />
      ) : (
        <div className="mb-3 text-xs leading-5 text-muted-foreground">
          {tr(
            language,
            "Free-text reviewer comments and corrections that can support the discussion chapter.",
          )}
        </div>
      )}
      {visibleNotes.length ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-muted-foreground">
              {visibleNotes.length}/{notes.length} {tr(language, "showing")}
            </div>
            {canCollapse ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => setShowAll((value) => !value)}
              >
                {tr(language, showAll ? "Show fewer" : "Show all")}
              </Button>
            ) : null}
          </div>
          {visibleNotes.map((note) => (
            <div
              key={`${note.traceId}-${note.reviewerId}-${note.noteType}`}
              className="rounded-md border border-border bg-surface-soft px-3 py-2"
            >
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <Badge variant={note.finalDecision === "accept" ? "outline" : "secondary"}>
                  {decisionLabel(language, note.finalDecision)}
                </Badge>
                <Badge variant="outline">{tr(language, note.noteType)}</Badge>
                <Badge variant="outline" className="font-mono">
                  {note.reviewerId}
                </Badge>
              </div>
              <div className="text-sm leading-5 text-body">{note.note}</div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="line-clamp-1 min-w-0 text-xs text-muted-foreground">
                  {note.reviewerId} · {note.service} · {note.question}
                </div>
                {onSelectTrace ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 shrink-0 gap-1 px-2 text-xs"
                    onClick={() => onSelectTrace(note.traceId)}
                  >
                    {tr(language, "Open case")}
                    <ArrowUpRight className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>{tr(language, "No reviewer notes collected for this run yet.")}</EmptyState>
      )}
    </SectionCard>
  )
}

function formatKappa(value: number | null) {
  return value === null ? "n/a" : value.toFixed(2)
}

export function KappaCard({
  language,
  stat,
}: {
  language: Language
  stat: ResearchAgreementStat
}) {
  // Class-imbalance warning is a data-quality note, not a needs_edit decision,
  // so it uses the neutral "notice" tone rather than amber.
  const tone = stat.dominantShareWarning ? "notice" : dashboardTone("quiet")
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2",
        dashboardBannerClass[tone],
        dashboardBannerTextClass[tone],
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        <Sigma className="size-3.5" />
        {tr(language, "Cohen's kappa (final decision)")}
      </div>
      <div className="mt-1 text-metric">{formatKappa(stat.kappa)}</div>
      <div className="mt-1 text-xs leading-4 opacity-75">
        n={stat.n}
        {stat.percentAgreement !== null
          ? ` · ${Math.round(stat.percentAgreement * 100)}% ${tr(language, "agreement")}`
          : ""}
      </div>
      {stat.dominantShareWarning ? (
        <div className="mt-1 flex items-start gap-1 text-[11px] leading-4 opacity-80">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          {tr(
            language,
            "Low kappa reflects class imbalance (most cases accepted), not poor agreement.",
          )}
        </div>
      ) : null}
    </div>
  )
}

export function SourceConcernCard({
  flaggedReviews,
  language,
}: {
  flaggedReviews: number
  language: Language
}) {
  const none = flaggedReviews === 0
  // Flagged source concerns are a system signal, not a needs_edit decision,
  // so the non-zero state uses the neutral "notice" tone rather than amber.
  const tone = none ? dashboardTone("quiet") : "notice"
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2",
        dashboardBannerClass[tone],
        dashboardBannerTextClass[tone],
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        <Gauge className="size-3.5" />
        {tr(language, "Source concerns flagged")}
      </div>
      <div className="mt-1 text-metric">{flaggedReviews}</div>
      <div className="mt-1 text-xs leading-4 opacity-75">
        {none
          ? tr(
              language,
              "Reviewers flag a source problem only when they see one, so 0 is the expected default, not a skipped check.",
            )
          : tr(language, "Reviews where a reviewer could not confirm the answer from the shown source.")}
      </div>
    </div>
  )
}

function decisionDotClass(value: string) {
  const tone = decisionTone(value)
  return tone === "neutral" ? dashboardDotClass.risk : dashboardDotClass[tone]
}

function StackedDecisionBar({
  accept,
  needsEdit,
  reject,
}: {
  accept: number
  needsEdit: number
  reject: number
}) {
  const total = accept + needsEdit + reject || 1
  const segments: [number, string][] = [
    [accept, decisionDotClass("accept")],
    [needsEdit, decisionDotClass("needs_edit")],
    [reject, decisionDotClass("reject")],
  ]
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-chart-track">
      {segments.map(([count, colorClass], index) =>
        count ? (
          <div
            key={index}
            className={cn("h-full", colorClass)}
            style={{ width: `${(count / total) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  )
}

export function ReviewerStrictnessPanel({
  language,
  rows,
  showHeader = true,
}: {
  language: Language
  rows: ResearchReviewerBreakdownRow[]
  showHeader?: boolean
}) {
  const description = tr(
    language,
    "Share of accept vs needs-edit / reject decisions per reviewer.",
  )
  const decisionCount = (row: ResearchReviewerBreakdownRow, label: string) =>
    row.decisions.find((item) => item.label === label)?.count || 0

  return (
    <SectionCard>
      {showHeader ? (
        <SectionHeader
          description={description}
          icon={<Gauge className="size-4" />}
          title={tr(language, "Reviewer strictness")}
        />
      ) : (
        <div className="mb-3 text-xs leading-5 text-muted-foreground">{description}</div>
      )}
      {rows.length ? (
        <div className="grid gap-2">
          {rows.map((row) => {
            const accept = decisionCount(row, "accept")
            const needsEdit = decisionCount(row, "needs_edit")
            const reject = decisionCount(row, "reject")
            return (
              <div key={row.reviewerId} className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-semibold text-body">{row.reviewerId}</span>
                  <span className="text-muted-foreground">
                    {decisionLabel(language, "accept")} {accept} ·{" "}
                    {decisionLabel(language, "needs_edit")} {needsEdit} ·{" "}
                    {decisionLabel(language, "reject")} {reject}
                  </span>
                </div>
                <StackedDecisionBar accept={accept} needsEdit={needsEdit} reject={reject} />
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState>{tr(language, "No reviewer decisions recorded for this run yet.")}</EmptyState>
      )}
    </SectionCard>
  )
}

export function StyleAgreementPanel({
  language,
  rows,
  showHeader = true,
}: {
  language: Language
  rows: ResearchStyleAgreementRow[]
  showHeader?: boolean
}) {
  const description = tr(
    language,
    "AI-human final-decision match rate grouped by question style.",
  )
  return (
    <SectionCard>
      {showHeader ? (
        <SectionHeader
          description={description}
          icon={<ListChecks className="size-4" />}
          title={tr(language, "Agreement by question style")}
        />
      ) : (
        <div className="mb-3 text-xs leading-5 text-muted-foreground">{description}</div>
      )}
      {rows.length ? (
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.style} className="min-w-0">
              <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium text-body">
                  {displayValue(language, row.style)}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {row.matchRate === null
                    ? tr(language, "no comparable cases")
                    : `${row.matchRate}% · ${row.matches}/${row.comparableCases}`}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-chart-track">
                <div
                  className={cn("h-full rounded-full", dashboardDotClass.source)}
                  style={{ width: `${row.matchRate ?? 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>{tr(language, "No question-style groups available for this run yet.")}</EmptyState>
      )}
    </SectionCard>
  )
}
