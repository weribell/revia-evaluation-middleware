import { useMemo } from "react"
import {
  ArrowRight,
  ClipboardList,
  Download,
  Gauge,
  ListChecks,
  MessageSquareText,
  ShieldAlert,
  Table2,
} from "lucide-react"

import type { Language, RepeatConsistencyResponse, ReviewerPlan } from "@/types"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { SectionCard } from "@/components/ui/section-card"
import { StatTileGrid } from "@/components/ui/stat-tile"
import { RunSelectorBar } from "./shared/RunSelectorBar"
import { SectionEyebrow } from "./shared/SectionEyebrow"
import { RepeatConsistencyPanel } from "./RepeatConsistencyPanel"
import { hasComparableRepeatRuns } from "./repeatConsistencyModel"
import { CollapsibleSection } from "@/components/shared/CollapsibleSection"
import { RunIssueNoticeBanner } from "@/components/shared/RunIssueNoticeBanner"
import { buildRunIssueNotice } from "@/components/shared/runIssueNotice"
import { downloadCsv } from "@/components/shared/exportUtils"
import {
  ConfusionMatrix,
  CriterionComparisonPanel,
  FailureModesPanel,
  InterpretationPanel,
  KappaCard,
  MetricCard,
  ReviewerNotesPanel,
  ReviewerStrictnessPanel,
  SampleContextPanel,
  SourceConcernCard,
  StyleAgreementPanel,
} from "@/components/research/researchPanels"
import { tr } from "@/components/research/researchText"
import {
  buildResearchAgreementByStyle,
  buildResearchAgreementStats,
  buildResearchCaseExportRows,
  buildResearchConfusionMatrix,
  buildResearchCriterionRows,
  buildResearchFailureModes,
  buildResearchReviewerBreakdown,
  countFlaggedSourceConcerns,
  buildResearchReviewerNotes,
  buildResearchReviewExportRows,
  buildResearchRunSummary,
  buildResearchSampleContext,
  buildResearchSampleSummary,
} from "@/components/research/researchDashboardModel"
import {
  filterWorklistItems,
  type DeveloperActiveRun,
  type DeveloperWorklistItem,
} from "./developerLabModel"

export function AnalysisPanel({
  activeRun,
  batchHistory,
  items,
  language,
  loading,
  onOpenDisagreements,
  onSelectBatch,
  onSelectTrace,
  repeatConsistency,
  reviewerPlan,
  selectedBatchId,
}: {
  activeRun: DeveloperActiveRun
  batchHistory: NonNullable<DeveloperActiveRun>[]
  items: DeveloperWorklistItem[]
  language: Language
  loading: boolean
  onOpenDisagreements: () => void
  onSelectBatch: (batchId: string) => void
  onSelectTrace: (traceId: string) => void
  repeatConsistency: RepeatConsistencyResponse | null
  reviewerPlan: ReviewerPlan | null
  selectedBatchId: string
}) {
  const traces = useMemo(() => items.map((item) => item.trace), [items])
  const summary = useMemo(
    () => buildResearchRunSummary({ activeRun, reviewerPlan, traces }),
    [activeRun, reviewerPlan, traces],
  )
  const confusionMatrix = useMemo(() => buildResearchConfusionMatrix(traces), [traces])
  const criterionRows = useMemo(() => buildResearchCriterionRows(traces), [traces])
  const agreementStats = useMemo(() => buildResearchAgreementStats(traces), [traces])
  const reviewerBreakdown = useMemo(() => buildResearchReviewerBreakdown(traces), [traces])
  const styleAgreement = useMemo(() => buildResearchAgreementByStyle(traces), [traces])
  const flaggedSourceConcerns = useMemo(() => countFlaggedSourceConcerns(traces), [traces])
  const failureModes = useMemo(() => buildResearchFailureModes(traces), [traces])
  const reviewerNotes = useMemo(() => buildResearchReviewerNotes(traces), [traces])
  const sampleContext = useMemo(
    () => buildResearchSampleContext(buildResearchSampleSummary(traces)),
    [traces],
  )
  const caseExportRows = useMemo(
    () => buildResearchCaseExportRows(activeRun?.batch_id || "", traces),
    [activeRun?.batch_id, traces],
  )
  const reviewExportRows = useMemo(() => buildResearchReviewExportRows(traces), [traces])
  const resultDisagreementCount = useMemo(
    () => filterWorklistItems(items, "mismatch").length,
    [items],
  )
  const runIssueNotice = useMemo(() => buildRunIssueNotice(activeRun, language), [activeRun, language])

  const recommendation =
    confusionMatrix.comparableCases === 0
      ? "Collect human reviews to unlock agreement analysis."
      : confusionMatrix.falseAccepts > 0
        ? "Inspect AI-too-positive cases: the judge accepted answers humans did not."
        : confusionMatrix.humanDecisionDisagreements > 0
          ? "Adjudicate split human decisions before trusting the match rate."
          : "Agreement is stable. Export the tables for the research report."

  const batchSelector = (
    <RunSelectorBar
      batchHistory={batchHistory}
      disabled={loading}
      language={language}
      onSelectBatch={onSelectBatch}
      selectedBatchId={selectedBatchId}
    />
  )

  if (!traces.length) {
    return (
      <div className="mt-2 grid gap-4 px-1 pb-1">
        {batchSelector}
        {runIssueNotice ? (
          <RunIssueNoticeBanner
            notice={runIssueNotice}
            translate={(value) => tr(language, value)}
          />
        ) : null}
        <EmptyState className="px-4 py-6">
          {runIssueNotice
            ? tr(language, "No analysis tables can be built until the run creates evaluation cases.")
            : tr(
              language,
              "No saved evaluation runs yet. Create a test or demo run in Developer Lab first.",
            )}
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="mt-2 grid min-w-0 gap-4 px-1 pb-1">
      {batchSelector}
      {runIssueNotice ? (
        <RunIssueNoticeBanner
          notice={runIssueNotice}
          translate={(value) => tr(language, value)}
        />
      ) : null}
      {/* Layer 1: answer header */}
      <SectionEyebrow>
        {tr(language, "How well does the AI judge agree with humans?")}
      </SectionEyebrow>
      <InterpretationPanel interpretation={summary.interpretation} language={language} />
      <StatTileGrid>
        <MetricCard
          card={{
            detail: "AI accepts while humans reject or request edits",
            label: "AI too positive",
            tone: confusionMatrix.falseAccepts ? "danger" : "ready",
            value: String(confusionMatrix.falseAccepts),
          }}
          language={language}
        />
        <MetricCard
          card={{
            detail: `${confusionMatrix.matches}/${confusionMatrix.comparableCases} ${tr(language, "comparable cases")}`,
            label: "Final-decision match",
            tone: confusionMatrix.falseAccepts ? "warning" : "ready",
            value: `${confusionMatrix.matchRate}%`,
          }}
          language={language}
        />
        <MetricCard
          card={{
            detail: "Split human final decisions; excluded from majority matrix when tied",
            label: "Human-human disagreement",
            tone: confusionMatrix.humanDecisionDisagreements ? "warning" : "ready",
            value: String(confusionMatrix.humanDecisionDisagreements),
          }}
          language={language}
        />
        <MetricCard
          card={{
            detail: "Cases with interpretable human majority",
            label: "Comparable cases",
            tone: confusionMatrix.comparableCases ? "quiet" : "warning",
            value: String(confusionMatrix.comparableCases),
          }}
          language={language}
        />
      </StatTileGrid>

      {/* Layer 2: one visual — the confusion matrix is the core research
          artifact, surfaced right after the headline metrics. */}
      <ConfusionMatrix
        cells={confusionMatrix.cells}
        humanDecisionDisagreements={confusionMatrix.humanDecisionDisagreements}
        language={language}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <KappaCard language={language} stat={agreementStats.aiVsMajority} />
        <SourceConcernCard flaggedReviews={flaggedSourceConcerns} language={language} />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface-soft px-4 py-3 shadow-card">
        <div className="flex min-w-[16rem] flex-1 items-start gap-2.5">
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-body" />
          <div className="min-w-0">
            <SectionEyebrow>{tr(language, "Recommended next step")}</SectionEyebrow>
            <div className="mt-1 text-sm font-medium text-body">
              {tr(language, recommendation)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={!caseExportRows.length}
            size="sm"
            variant="outline"
            onClick={() => downloadCsv("research_case_export.csv", caseExportRows)}
          >
            <Download className="size-4" />
            {tr(language, "Download case export CSV")}
          </Button>
          <Button
            disabled={!reviewExportRows.length}
            size="sm"
            variant="outline"
            onClick={() => downloadCsv("research_review_export.csv", reviewExportRows)}
          >
            <Download className="size-4" />
            {tr(language, "Download review export CSV")}
          </Button>
        </div>
      </div>

      {/* Layer 3: details on demand */}
      <SectionEyebrow className="mt-1">
        {tr(language, "More detail — click a row to expand")}
      </SectionEyebrow>
      {hasComparableRepeatRuns(repeatConsistency) ? (
        <RepeatConsistencyPanel data={repeatConsistency} language={language} />
      ) : null}
      <CollapsibleSection icon={<ListChecks className="size-4" />} title={tr(language, "Criterion-level comparison")}>
        <CriterionComparisonPanel language={language} rows={criterionRows} showHeader={false} />
      </CollapsibleSection>
      <CollapsibleSection icon={<Gauge className="size-4" />} title={tr(language, "Reviewer strictness")}>
        <ReviewerStrictnessPanel language={language} rows={reviewerBreakdown} showHeader={false} />
      </CollapsibleSection>
      <CollapsibleSection icon={<ListChecks className="size-4" />} title={tr(language, "Agreement by question style")}>
        <StyleAgreementPanel language={language} rows={styleAgreement} showHeader={false} />
      </CollapsibleSection>
      <CollapsibleSection icon={<ClipboardList className="size-4" />} title={tr(language, "Sample composition")}>
        <SampleContextPanel items={sampleContext} language={language} showHeader={false} />
      </CollapsibleSection>
      <CollapsibleSection icon={<ShieldAlert className="size-4" />} title={tr(language, "Failure mode distribution")}>
        <FailureModesPanel language={language} modes={failureModes} showHeader={false} />
      </CollapsibleSection>
      <CollapsibleSection icon={<MessageSquareText className="size-4" />} title={tr(language, "Qualitative reviewer notes")}>
        <ReviewerNotesPanel
          language={language}
          notes={reviewerNotes}
          onSelectTrace={onSelectTrace}
          showHeader={false}
        />
      </CollapsibleSection>
      <CollapsibleSection icon={<Table2 className="size-4" />} title={tr(language, "Disagreement cases")}>
        <SectionCard>
          <p className="text-sm leading-6 text-muted-foreground">
            {tr(
              language,
              "This compares final decisions and criterion scores where human review data exists.",
            )}
          </p>
          {resultDisagreementCount ? (
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={onOpenDisagreements}
            >
              {tr(language, "View disagreement cases in the Results table")}
              <ArrowRight className="ml-1 size-4" />
            </Button>
          ) : (
            <EmptyState className="mt-3">
              {tr(
                language,
                "No disagreement cases are available in Results for this run yet.",
              )}
            </EmptyState>
          )}
        </SectionCard>
      </CollapsibleSection>
    </div>
  )
}
