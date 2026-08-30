import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Euro,
  PieChart,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react"

import { getDeveloperWorklist } from "@/api"
import type { DeveloperRun, EvaluationTrace, Language } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTableHeader, DataTableRow } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { FactRow } from "@/components/ui/fact-row"
import { SectionCard } from "@/components/ui/section-card"
import { SelectField } from "@/components/ui/select-field"
import { StatTile, StatTileGrid } from "@/components/ui/stat-tile"
import { Toolbar } from "@/components/ui/toolbar"
import { DashboardBanner } from "@/components/shared/DashboardBanner"
import { RunIssueNoticeBanner } from "@/components/shared/RunIssueNoticeBanner"
import { buildRunIssueNotice } from "@/components/shared/runIssueNotice"
import { decisionLabel } from "@/lib/decisionDisplay"
import {
  dashboardBannerBadgeClass,
  dashboardBannerClass,
  dashboardBannerShade,
  dashboardToneClass,
} from "@/lib/dashboardTones"
import { cn } from "@/lib/utils"
import {
  buildManagementDashboardModel,
  deriveManagementAssumptionsForRun,
  hasReviewerAssignmentPlan,
  type AiJudgeReliabilitySummary,
  type ManagementCostComparison,
  type ManagementDashboardModel,
  type ManagementAssumptions,
  type PilotChecklistItem,
  type ReviewEffortEstimate,
  type ReviewScenario,
} from "./managementDashboardModel"
import {
  buildManagementCockpitModel,
  type CockpitSegment,
  type ManagementCockpitModel,
} from "./managementCockpitModel"
import { formatCurrency, formatHours, formatMoney } from "./managementFormatters"
import {
  batchOptionLabel,
  formatTokens,
  localizedAiJudgeExcludedDetail,
  localizedAiJudgeReliabilityDetail,
  localizedHeadlineDetail,
  localizedNextActionDetail,
  tr,
} from "./managementText"
import { cockpitBannerTone, cockpitColor } from "./managementTones"
import { ManagementSectionHeader } from "./ManagementSectionHeader"
import { AttentionList, CompactKpiGrid, RiskSignalBarChart } from "./ManagementCharts"

function ManagementConclusionCard({
  cockpit,
  language,
}: {
  cockpit: ManagementCockpitModel
  language: Language
}) {
  const Icon =
    cockpit.readinessTone === "ready"
      ? CheckCircle2
      : cockpit.readinessTone === "danger"
        ? AlertCircle
        : ShieldAlert

  const tone = cockpitBannerTone(cockpit.readinessTone)
  const shade = dashboardBannerShade[tone]

  return (
    <DashboardBanner
      body={localizedHeadlineDetail(language, cockpit.headlineDetail)}
      bodyClassName="max-w-2xl"
      eyebrow={tr(language, cockpit.phaseLabel)}
      icon={Icon}
      layoutClassName="md:grid-cols-[minmax(0,0.92fr)_minmax(24rem,0.56fr)] md:items-start"
      pill={tr(language, cockpit.readinessLabel)}
      title={tr(language, cockpit.headline)}
      tone={tone}
      trailing={
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border px-4 py-3.5",
            dashboardBannerBadgeClass[tone],
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border",
              shade.chip,
            )}
          >
            <ShieldAlert className={cn("size-4", shade.accent)} />
          </span>
          <div className="min-w-0">
            <div className={cn("text-caps-sm uppercase", shade.eyebrow)}>
              {tr(language, "Next action")}
            </div>
            <div className={cn("mt-0.5 text-sm font-semibold leading-5", shade.title)}>
              {tr(language, cockpit.nextActionLabel)}
            </div>
            <p className={cn("mt-0.5 text-xs leading-4", shade.body)}>
              {localizedNextActionDetail(language, cockpit.nextActionDetail)}
            </p>
          </div>
        </div>
      }
    />
  )
}

function DecisionDonutChart({
  language,
  segments,
}: {
  language: Language
  segments: CockpitSegment[]
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0)
  const accepted = segments.find((segment) => segment.decision === "accept")?.count || 0
  const acceptedRate = total ? Math.round((accepted / total) * 100) : 0
  const visibleSegments = segments.filter((segment) => segment.count > 0)
  const chartSegments: CockpitSegment[] = visibleSegments.length
    ? visibleSegments
    : [{ count: 1, label: "Not reviewed", tone: "quiet" }]
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const segmentOffsets = chartSegments.map((_, index) =>
    chartSegments.slice(0, index).reduce((sum, item) => sum + item.count, 0),
  )

  return (
    <SectionCard>
      <ManagementSectionHeader
        action={<Badge variant="secondary">{total}</Badge>}
        detail="Share of answers reviewers would approve without edits."
        icon={<PieChart className="size-4" />}
        language={language}
        title="Decision mix"
      />
      <div className="relative mt-4 h-40">
        <svg
          aria-label={tr(language, "Decision outcomes")}
          className="h-full w-full"
          role="img"
          viewBox="0 0 180 180"
        >
          <circle
            cx="90"
            cy="90"
            fill="none"
            r={radius}
            stroke="var(--chart-track)"
            strokeWidth="24"
          />
          {chartSegments.map((segment, index) => {
            const dash = (segment.count / Math.max(1, total || 1)) * circumference
            const currentOffset =
              (segmentOffsets[index] / Math.max(1, total || 1)) * circumference
            return (
              <circle
                key={segment.label}
                cx="90"
                cy="90"
                fill="none"
                r={radius}
                stroke={cockpitColor(segment.tone)}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-currentOffset}
                strokeWidth="24"
                transform="rotate(-90 90 90)"
              >
                <title>{`${segment.decision ? decisionLabel(language, segment.decision) : tr(language, segment.label)}: ${segment.count}`}</title>
              </circle>
            )
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-metric text-foreground">{acceptedRate}%</div>
            <div className="text-xs font-medium text-muted-foreground">{decisionLabel(language, "accept")}</div>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: cockpitColor(segment.tone) }}
              />
              <span className="truncate text-muted-foreground">
                {segment.decision ? decisionLabel(language, segment.decision) : tr(language, segment.label)}
              </span>
            </span>
            <span className="font-semibold text-body">{segment.count}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function AiJudgeReliabilityCard({
  language,
  reliability,
}: {
  language: Language
  reliability: AiJudgeReliabilitySummary
}) {
  const { comparableCases, excludedSplitCases, falseAcceptCases, matchRate, matches, verdict } =
    reliability
  const excludedDetail =
    excludedSplitCases === 1
      ? `${excludedSplitCases} reviewed case excluded — reviewers split, awaiting adjudication.`
      : `${excludedSplitCases} reviewed cases excluded — reviewers split, awaiting adjudication.`
  const Icon =
    verdict.tone === "ready"
      ? ShieldCheck
      : verdict.tone === "danger"
        ? ShieldAlert
        : AlertCircle
  const agreementPercent = Math.round(matchRate * 100)
  const tone = cockpitBannerTone(verdict.tone)
  const shade = dashboardBannerShade[tone]

  return (
    <div className={cn("rounded-2xl border px-7 py-6", dashboardBannerClass[tone])}>
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
          <h2 className={cn("text-panel-title", shade.title)}>
            {tr(language, "AI judge reliability")}
          </h2>
          <p className={cn("mt-0.5 text-[13.5px] leading-[1.55]", shade.body)}>
            {tr(language, "Do AI judge decisions match the human majority?")}
          </p>
        </div>
      </div>
      {comparableCases === 0 && excludedSplitCases === 0 ? (
        <EmptyState className="mt-4 bg-card">
          {tr(language, "Agreement with the AI judge appears once human reviews exist.")}
        </EmptyState>
      ) : (
        <>
          {comparableCases > 0 ? (
            <StatTileGrid className="mt-4" columns={2}>
              <StatTile
                className="bg-card"
                detail={`${matches} ${tr(language, "of")} ${comparableCases} ${tr(language, "cases")}`}
                label={tr(language, "Agreement rate")}
                value={`${agreementPercent}%`}
                variant="inset"
              />
              <StatTile
                action={
                  <Badge variant={falseAcceptCases > 0 ? "destructive" : "secondary"}>
                    {falseAcceptCases}
                  </Badge>
                }
                className="bg-card"
                detail={tr(language, "AI accepted, but reviewers did not.")}
                label={tr(language, "AI false accepts")}
                tone={falseAcceptCases > 0 ? "negative" : "default"}
                value={falseAcceptCases}
                variant="inset"
              />
            </StatTileGrid>
          ) : null}
          {excludedSplitCases > 0 ? (
            <p
              className="mt-3 flex items-start gap-2 text-sm font-medium leading-5"
              style={{ color: "var(--dashboard-judge-foreground)" }}
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{localizedAiJudgeExcludedDetail(language, excludedDetail)}</span>
            </p>
          ) : null}
          <p className={cn("mt-4 text-sm font-medium leading-5", shade.title)}>
            {localizedAiJudgeReliabilityDetail(language, verdict.detail)}
          </p>
        </>
      )}
    </div>
  )
}

function PilotChecklistPanel({
  items,
  language,
}: {
  items: PilotChecklistItem[]
  language: Language
}) {
  return (
    <SectionCard>
      <ManagementSectionHeader
        detail="Requirements for an approval decision."
        icon={<CheckCircle2 className="size-4" />}
        language={language}
        title="Pilot readiness checklist"
      />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
              // An unmet requirement is what blocks approval, so it carries the
              // attention tone. It used to render in muted grey, which made the
              // blockers the quietest thing on a readiness checklist.
              item.passed ? dashboardToneClass.ready : dashboardToneClass.judge,
            )}
          >
            {item.passed ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-semibold leading-5">{tr(language, item.label)}</div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function NumberInput({
  label,
  min = 0,
  step = 1,
  value,
  onChange,
}: {
  label: string
  min?: number
  step?: number
  value: number
  onChange: (value: number) => void
}) {
  const stepValue = (direction: 1 | -1) => {
    onChange(Math.max(min, value + direction * step))
  }

  return (
    <label className="flex min-w-0 items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="flex h-7 w-24 shrink-0 items-center rounded-lg border border-border bg-card pl-2 pr-1">
        <input
          className="min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          min={min}
          step={step}
          type="number"
          value={value}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
        <span className="ml-2 flex h-5 w-4 shrink-0 flex-col overflow-hidden rounded bg-surface-soft text-muted-foreground">
          <button
            aria-label={`${label} increase`}
            className="flex h-2.5 items-center justify-center hover:bg-border"
            type="button"
            onClick={() => stepValue(1)}
          >
            <ChevronUp className="size-3" strokeWidth={2.5} />
          </button>
          <button
            aria-label={`${label} decrease`}
            className="flex h-2.5 items-center justify-center hover:bg-border"
            type="button"
            onClick={() => stepValue(-1)}
          >
            <ChevronDown className="size-3" strokeWidth={2.5} />
          </button>
        </span>
      </span>
    </label>
  )
}

function CostComparisonPanel({
  comparison,
  language,
}: {
  comparison: ManagementCostComparison
  language: Language
}) {
  const tokenUsage = comparison.judgeTokenUsage
  const tokenDetail =
    tokenUsage.status === "not_recorded"
      ? tr(language, "Token usage not recorded yet")
      : `${tokenUsage.recordedCases}/${tokenUsage.totalCases} ${tr(language, "cases with token usage")}`

  return (
    <SectionCard>
      <ManagementSectionHeader
        icon={<Euro className="size-4" />}
        language={language}
        title="Oversight effort and budget"
      />
      <StatTileGrid className="mt-4">
        <StatTile
          detail={`${comparison.humanReviewAssignments} ${tr(language, "Assignments")}`}
          label={tr(language, "Human review budget")}
          value={formatCurrency(comparison.humanReviewCost)}
          variant="inset"
        />
        <StatTile
          detail={tr(language, "Total human effort")}
          label={tr(language, "Human review hours")}
          value={formatHours(comparison.humanReviewHours)}
          variant="inset"
        />
        <StatTile
          detail={tokenDetail}
          label={tr(language, "AI judge tokens")}
          value={
            tokenUsage.status === "not_recorded"
              ? tr(language, "not recorded yet")
              : formatTokens(tokenUsage.totalTokens)
          }
          variant="inset"
        />
        <StatTile
          detail={
            comparison.judgeCostSource === "trace_estimate"
              ? tr(language, comparison.judgePricingDetail)
              : `${formatCurrency(comparison.judgeCostPer1kTokens)} / 1k`
          }
          label={tr(language, "AI judge oversight budget")}
          value={
            comparison.judgeTokenCost === null
              ? tr(language, "not recorded yet")
              : formatMoney(comparison.judgeTokenCost, comparison.judgeCostCurrency)
          }
          variant="inset"
        />
      </StatTileGrid>
    </SectionCard>
  )
}

function ScenarioTable({ language, scenarios }: { language: Language; scenarios: ReviewScenario[] }) {
  return (
    <DataTable columns="1.25fr 0.45fr 0.55fr 0.55fr 0.55fr" minWidth="48rem">
      <DataTableHeader>
        <div>{tr(language, "Scenario")}</div>
        <div>{tr(language, "Cases")}</div>
        <div>{tr(language, "Assignments")}</div>
        <div>{tr(language, "Hours")}</div>
        <div>{tr(language, "Budget")}</div>
      </DataTableHeader>
      {scenarios.map((scenario) => (
        <DataTableRow key={scenario.id}>
          <div className="min-w-0">
            <div className="font-semibold text-body">{tr(language, scenario.label)}</div>
            <div className="mt-1 text-sm leading-5 text-muted-foreground">
              {tr(language, scenario.description)}
            </div>
          </div>
          <div className="font-semibold text-body">{scenario.cases}</div>
          <div>{scenario.estimate.assignments}</div>
          <div>{formatHours(scenario.estimate.personHours)}</div>
          <div>{formatCurrency(scenario.estimate.cost)}</div>
        </DataTableRow>
      ))}
    </DataTable>
  )
}

function RiskGroupList({
  emptyText,
  groups,
  language,
}: {
  emptyText: string
  groups: { cases: number; label: string; rate: number; riskCases: number }[]
  language: Language
}) {
  if (!groups.length) {
    return <EmptyState>{tr(language, emptyText)}</EmptyState>
  }

  return (
    <div className="grid gap-2">
      {groups.map((group) => (
        <div key={group.label} className="rounded-lg border border-border px-3 py-2.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold text-body">{group.label}</span>
            <Badge variant="outline">{group.riskCases}</Badge>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              {group.riskCases}/{group.cases} {tr(language, "with follow-up signals")}
            </span>
            <span>{group.rate}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}

type UpdateManagementAssumption = (key: keyof ManagementAssumptions, value: number) => void

function RunPlanPanel({
  before,
  language,
}: {
  before: ManagementDashboardModel["before"]
  language: Language
}) {
  return (
    <SectionCard>
      <ManagementSectionHeader
        detail="Estimate the review work needed before reviewer links are sent."
        icon={<ShieldAlert className="size-4" />}
        language={language}
        title="Review plan"
      />
      <div className="mt-4 grid gap-2">
        <FactRow
          label={tr(language, "Run size")}
          value={`${before.totalCases} ${tr(language, "cases")}`}
        />
        <FactRow
          label={tr(language, "Cases to review first")}
          value={`${before.aiFlaggedRiskCases}`}
        />
        <FactRow
          label={tr(language, "Planned assignments")}
          value={`${before.customEstimate.assignments} ${tr(language, "Assignments")}`}
        />
        <FactRow
          label={tr(language, "Estimated review budget")}
          value={formatCurrency(before.customEstimate.cost)}
        />
        <FactRow
          label={tr(language, "Estimated days")}
          value={`${before.customEstimate.calendarDays}`}
        />
      </div>
      <div className="mt-3 rounded-lg border border-border bg-surface-soft px-3 py-2.5 text-sm leading-5 text-muted-foreground">
        {tr(language, "Approval planning estimate, not accounting data.")}
      </div>
    </SectionCard>
  )
}

function ReviewAssumptionsPanel({
  assumptions,
  hasRunReviewerPlan,
  language,
  updateAssumption,
}: {
  assumptions: ManagementAssumptions
  hasRunReviewerPlan: boolean
  language: Language
  updateAssumption: UpdateManagementAssumption
}) {
  return (
    <SectionCard>
      <ManagementSectionHeader
        action={
          <Badge variant={hasRunReviewerPlan ? "secondary" : "outline"}>
            {tr(
              language,
              hasRunReviewerPlan ? "From reviewer assignment plan" : "Fallback planning assumption",
            )}
          </Badge>
        }
        detail="Adjust the simple assumptions behind staffing and budget estimates."
        icon={<Users className="size-4" />}
        language={language}
        title="Review assumptions"
      />
      <div className="mt-4 grid gap-2">
        <NumberInput
          label={tr(language, "Reviews per case")}
          min={1}
          value={assumptions.reviewsPerCase}
          onChange={(value) => updateAssumption("reviewsPerCase", value)}
        />
        <NumberInput
          label={tr(language, "Minimum reviewed cases")}
          min={1}
          value={assumptions.minimumReviewedCases || 10}
          onChange={(value) => updateAssumption("minimumReviewedCases", value)}
        />
        <NumberInput
          label={tr(language, "Minutes per review")}
          min={1}
          value={assumptions.minutesPerReview}
          onChange={(value) => updateAssumption("minutesPerReview", value)}
        />
        <NumberInput
          label={tr(language, "Available reviewers")}
          min={1}
          value={assumptions.availableReviewers}
          onChange={(value) => updateAssumption("availableReviewers", value)}
        />
        <NumberInput
          label={tr(language, "Hourly rate EUR")}
          min={0}
          value={assumptions.hourlyRate}
          onChange={(value) => updateAssumption("hourlyRate", value)}
        />
      </div>
    </SectionCard>
  )
}

function PlanningScenarioPanel({
  assumptions,
  customEstimate,
  language,
  scenarios,
  updateAssumption,
}: {
  assumptions: ManagementAssumptions
  customEstimate: ReviewEffortEstimate
  language: Language
  scenarios: ReviewScenario[]
  updateAssumption: UpdateManagementAssumption
}) {
  return (
    <div className="grid gap-4">
      <ManagementSectionHeader
        detail="Compare review strategies for the cost model."
        icon={<BarChart3 className="size-4" />}
        language={language}
        title="Oversight effort and budget scenarios"
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <ScenarioTable language={language} scenarios={scenarios} />
        {/* self-start: the card holds three controls, so stretching it to the
            table's height left a large empty area below them. */}
        <SectionCard className="grid content-start gap-3 self-start">
          <ManagementSectionHeader
            detail="How long one working day of review covers, and what the AI judge adds."
            icon={<Clock className="size-4" />}
            language={language}
            title="Throughput and judge cost"
          />
          <FactRow
            label={tr(language, "Reviewers needed for 1 day")}
            value={customEstimate.reviewersNeededForOneDay}
          />
          <NumberInput
            label={tr(language, "Minutes per reviewer/day")}
            min={1}
            value={assumptions.reviewerMinutesPerDay}
            onChange={(value) => updateAssumption("reviewerMinutesPerDay", value)}
          />
          <NumberInput
            label={tr(language, "Judge price per 1k tokens EUR")}
            min={0}
            step={0.001}
            value={assumptions.judgeCostPer1kTokens || 0}
            onChange={(value) => updateAssumption("judgeCostPer1kTokens", value)}
          />
        </SectionCard>
      </div>
    </div>
  )
}

function PlanningSections({
  assumptions,
  costComparison,
  hasRunReviewerPlan,
  language,
  model,
  showHeader = true,
  updateAssumption,
}: {
  assumptions: ManagementAssumptions
  costComparison: ManagementCostComparison
  hasRunReviewerPlan: boolean
  language: Language
  model: ManagementDashboardModel
  showHeader?: boolean
  updateAssumption: UpdateManagementAssumption
}) {
  return (
    <div className="grid gap-4">
      {showHeader ? (
        <ManagementSectionHeader
          detail="Plan review staffing, timing, and budget before collecting evidence."
          icon={<ShieldAlert className="size-4" />}
          language={language}
          title="Pre-review planning"
        />
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <RunPlanPanel before={model.before} language={language} />
        <ReviewAssumptionsPanel
          assumptions={assumptions}
          hasRunReviewerPlan={hasRunReviewerPlan}
          language={language}
          updateAssumption={updateAssumption}
        />
      </div>
      <PlanningScenarioPanel
        assumptions={assumptions}
        customEstimate={model.before.customEstimate}
        language={language}
        scenarios={model.before.scenarios}
        updateAssumption={updateAssumption}
      />
      {/* The panel carries its own header now, so the outer wrapper that used to
          repeat the same title verbatim is gone. */}
      <CostComparisonPanel comparison={costComparison} language={language} />
    </div>
  )
}

function CollapsedPlanningAssumptions({
  assumptions,
  costComparison,
  hasRunReviewerPlan,
  language,
  model,
  updateAssumption,
}: {
  assumptions: ManagementAssumptions
  costComparison: ManagementCostComparison
  hasRunReviewerPlan: boolean
  language: Language
  model: ManagementDashboardModel
  updateAssumption: UpdateManagementAssumption
}) {
  return (
    <details className="group rounded-2xl border border-border bg-card p-4 shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <ManagementSectionHeader
          detail="Review workload, capacity, and budget assumptions kept for the cost model."
          icon={<SlidersHorizontal className="size-4" />}
          language={language}
          title="Planning assumptions"
        />
        <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4">
        <PlanningSections
          assumptions={assumptions}
          costComparison={costComparison}
          hasRunReviewerPlan={hasRunReviewerPlan}
          language={language}
          model={model}
          showHeader={false}
          updateAssumption={updateAssumption}
        />
      </div>
    </details>
  )
}

function DecisionSections({
  cockpit,
  language,
  model,
}: {
  cockpit: ManagementCockpitModel
  language: Language
  model: ManagementDashboardModel
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <DecisionDonutChart
          language={language}
          segments={cockpit.decisionSegments}
        />
        <RiskSignalBarChart bars={cockpit.riskBars} language={language} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <AttentionList items={cockpit.actionQueue} language={language} />
        <SectionCard>
          <ManagementSectionHeader
            detail="Problem concentration by service area."
            icon={<BarChart3 className="size-4" />}
            language={language}
            title="Risk by service"
          />
          <div className="mt-4">
            <RiskGroupList
              emptyText="No reviewed service-risk concentration is visible yet."
              groups={model.after.riskByService}
              language={language}
            />
          </div>
        </SectionCard>
      </div>
      <PilotChecklistPanel items={model.after.pilotChecklist} language={language} />
    </div>
  )
}

export function ManagementDashboard({
  language,
}: {
  language: Language
}) {
  const [assumptions, setAssumptions] = useState<ManagementAssumptions>({
    availableReviewers: 2,
    hourlyRate: 50,
    judgeCostPer1kTokens: 0.01,
    minimumReviewedCases: 10,
    minutesPerReview: 5,
    reviewerMinutesPerDay: 60,
    reviewsPerCase: 2,
  })
  const [activeRun, setActiveRun] = useState<DeveloperRun | null>(null)
  const [batchHistory, setBatchHistory] = useState<DeveloperRun[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState("")
  const [traces, setTraces] = useState<EvaluationTrace[]>([])

  const loadManagementRun = useCallback(async (batchId?: string) => {
    setLoading(true)
    setError("")
    try {
      const response = await getDeveloperWorklist(batchId)
      setActiveRun(response.active_run)
      setBatchHistory(response.batch_history || [])
      setSelectedBatchId(response.active_run?.batch_id || "")
      setAssumptions((current) => deriveManagementAssumptionsForRun(current, response.active_run))
      setTraces(response.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : tr(language, "Could not load management dashboard"))
    } finally {
      setLoading(false)
    }
  }, [language])

  useEffect(() => {
    loadManagementRun().catch(() => undefined)
  }, [loadManagementRun])

  const model = useMemo(
    () => buildManagementDashboardModel({ assumptions, traces }),
    [assumptions, traces],
  )
  const cockpit = useMemo(() => buildManagementCockpitModel(model), [model])
  const runIssueNotice = useMemo(() => buildRunIssueNotice(activeRun, language), [activeRun, language])
  const hasRunReviewerPlan = useMemo(() => hasReviewerAssignmentPlan(activeRun), [activeRun])

  function updateAssumption(key: keyof ManagementAssumptions, value: number) {
    setAssumptions((current) => ({ ...current, [key]: value }))
  }

  return (
    <section className="flex min-h-[32rem] flex-col gap-4">
      <Toolbar>
        <div className="flex items-center gap-2 text-section-title text-foreground">
          <Users className="size-4 text-body" />
          {tr(language, "Selected run")}
        </div>
        <div className="flex min-w-[18rem] max-w-full flex-wrap items-center justify-end gap-2">
          <label className="flex min-w-[16rem] flex-1 items-center gap-2 text-sm font-medium text-muted-foreground">
            {tr(language, "View")}
            <SelectField
              className="flex-1"
              disabled={loading || !batchHistory.length}
              options={batchHistory.map((batch) => ({
                label: batchOptionLabel(batch, language),
                value: batch.batch_id,
              }))}
              placeholder={tr(
                language,
                "No saved evaluation runs yet. Create a test or demo run in Developer Lab first.",
              )}
              value={selectedBatchId}
              onChange={loadManagementRun}
            />
          </label>
          <Button
            disabled={loading}
            size="sm"
            variant="outline"
            onClick={() => loadManagementRun(selectedBatchId)}
          >
            <RefreshCw />
            {tr(language, "Refresh")}
          </Button>
        </div>
      </Toolbar>

      {error ? (
        <div className={cn("flex items-center gap-2 rounded-xl border px-4 py-3 text-sm", dashboardToneClass.risk)}>
          <AlertCircle className="size-4" />
          {error}
        </div>
      ) : null}

      {runIssueNotice ? (
        <RunIssueNoticeBanner
          notice={runIssueNotice}
          translate={(value) => tr(language, value)}
        />
      ) : null}

      <section className="grid gap-4">
        <ManagementConclusionCard cockpit={cockpit} language={language} />
        <CompactKpiGrid items={cockpit.kpis} language={language} />
        <AiJudgeReliabilityCard
          language={language}
          reliability={model.after.aiJudgeReliability}
        />
        {model.after.hasHumanReview ? (
          <>
            <DecisionSections cockpit={cockpit} language={language} model={model} />
            <CollapsedPlanningAssumptions
              assumptions={assumptions}
              costComparison={model.costComparison}
              hasRunReviewerPlan={hasRunReviewerPlan}
              language={language}
              model={model}
              updateAssumption={updateAssumption}
            />
          </>
        ) : (
          <PlanningSections
            assumptions={assumptions}
            costComparison={model.costComparison}
            hasRunReviewerPlan={hasRunReviewerPlan}
            language={language}
            model={model}
            updateAssumption={updateAssumption}
          />
        )}
      </section>
    </section>
  )
}
