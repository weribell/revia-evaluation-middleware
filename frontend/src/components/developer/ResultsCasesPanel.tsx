import { ArrowRight, Download, RefreshCw } from "lucide-react"
import { useMemo } from "react"

import { DeveloperRunSelect } from "./DeveloperRunSelect"
import { buildTraceStabilityMap } from "./repeatConsistencyModel"
import {
  buildResultsBatchDetailRows,
  buildResultsEmptyState,
  filterWorklistItems,
  firstWorklistTraceId,
  type DeveloperActiveRun,
  type DeveloperWorklistItem,
  type RunCaseRow,
  type WorklistFilter,
  type WorklistSort,
} from "./developerLabModel"
import { developerTr as tr } from "./developerTraceModel"
import { humanReviews } from "@/components/shared/evaluationTraceModel"
import { AttentionBadge } from "./shared/AttentionBadge"
import { DecisionPill } from "./shared/DecisionPill"
import { FilterButton } from "./shared/FilterButton"
import { formatRunDetailValue } from "./shared/developerFormatters"
import { statusTone } from "./shared/developerToneClasses"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { SelectField } from "@/components/ui/select-field"
import { decisionLabel } from "@/lib/decisionDisplay"
import { dashboardToneClass } from "@/lib/dashboardTones"
import { cn } from "@/lib/utils"
import type { Language, RepeatConsistencyResponse, ReviewDecision } from "@/types"

function HumanReviewCell({ decisions, language }: { decisions: ReviewDecision[]; language: Language }) {
  if (!decisions.length) {
    return (
      <div className="min-w-0 pr-4">
        <DecisionPill language={language} tone="neutral" value="Human pending" />
      </div>
    )
  }
  return (
    <div className="flex min-w-0 flex-wrap gap-1 pr-4">
      {decisions.map((decision, index) => (
        <DecisionPill
          key={`${decision}-${index}`}
          language={language}
          tone={statusTone(decision)}
          value={decision}
        />
      ))}
    </div>
  )
}

function BatchDetailsPopover({
  activeRun,
  language,
}: {
  activeRun: NonNullable<DeveloperActiveRun>
  language: Language
}) {
  const details = buildResultsBatchDetailRows(activeRun)

  return (
    <Popover>
      <PopoverTrigger
        aria-label={tr(language, "Batch details")}
        className="flex size-5 items-center justify-center rounded-full border border-ring bg-card text-xs font-bold leading-none text-body shadow-control outline-none transition hover:bg-surface-soft focus-visible:ring-3 focus-visible:ring-ring/60"
      >
        i
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 border border-border p-3 text-left">
        <PopoverTitle className="text-xs font-semibold text-foreground">
          {tr(language, "Batch details")}
        </PopoverTitle>
        <div className="grid gap-2">
          {details.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 text-xs leading-5">
              <span className="font-medium text-muted-foreground">{tr(language, label)}</span>
              <span className="min-w-0 break-words font-semibold text-foreground">
                {formatRunDetailValue(label, value, language)}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function latestHumanDecision(item: DeveloperWorklistItem): ReviewDecision | "" {
  return humanReviews(item.trace).at(-1)?.final_decision || ""
}

function buildResultsBatchStats(items: DeveloperWorklistItem[]) {
  const decisions: Record<ReviewDecision, number> = {
    accept: 0,
    needs_edit: 0,
    reject: 0,
  }
  const judgeDecisions: Record<ReviewDecision, number> = {
    accept: filterWorklistItems(items, "judge_accept").length,
    needs_edit: filterWorklistItems(items, "judge_needs_edit").length,
    reject: filterWorklistItems(items, "judge_reject").length,
  }

  for (const item of items) {
    const decision = latestHumanDecision(item)
    if (decision) decisions[decision] += 1
  }

  return {
    decisions,
    judgeDecisions,
    attention: items.filter((item) => item.primaryStatus === "Needs attention").length,
    aiFalseAccept: filterWorklistItems(items, "ai_false_accept").length,
    humanDisagreement: filterWorklistItems(items, "human_disagreement").length,
    humanMissing: items.filter((item) => item.humanReviewCount === 0).length,
    mismatch: items.filter((item) => item.disagreement).length,
    reviewed: items.filter((item) => item.humanReviewCount > 0).length,
    sourceConcern: filterWorklistItems(items, "source_concern").length,
    total: items.length,
  }
}

function resultsNoticeClasses(tone: "danger" | "notice" | "warning" | "quiet") {
  if (tone === "danger") {
    return "border-[color:var(--dashboard-error-border)] bg-[var(--dashboard-error)] text-[color:var(--dashboard-error-foreground)]"
  }
  if (tone === "warning") {
    return "border-[color:var(--dashboard-judge-border)] bg-[var(--dashboard-judge)] text-[color:var(--dashboard-judge-foreground)]"
  }
  if (tone === "notice") {
    return "border-[color:var(--dashboard-notice-border)] bg-[var(--dashboard-notice)] text-[color:var(--dashboard-notice-foreground)]"
  }
  return "border-ring bg-surface-soft text-muted-foreground"
}

export function ResultsCasesPanel({
  activeFilter,
  activeRun,
  activeSort,
  allItems,
  batchHistory,
  caseRows,
  items,
  language,
  loading,
  repeatConsistency,
  selectedBatchId,
  exportingStudyPackage,
  onFilterChange,
  onExportStudyPackage,
  onRefresh,
  onSelectBatch,
  onSelectTrace,
  onSortChange,
}: {
  activeFilter: WorklistFilter
  activeRun: DeveloperActiveRun
  activeSort: WorklistSort
  allItems: DeveloperWorklistItem[]
  batchHistory: NonNullable<DeveloperActiveRun>[]
  caseRows: RunCaseRow[]
  items: DeveloperWorklistItem[]
  language: Language
  loading: boolean
  repeatConsistency: RepeatConsistencyResponse | null
  selectedBatchId: string
  exportingStudyPackage: boolean
  onFilterChange: (filter: WorklistFilter) => void
  onExportStudyPackage: () => void
  onRefresh: () => void
  onSelectBatch: (batchId: string) => void
  onSelectTrace: (traceId: string) => void
  onSortChange: (sort: WorklistSort) => void
}) {
  const firstTraceId = firstWorklistTraceId(items)
  const traceStability = useMemo(
    () => buildTraceStabilityMap(items, repeatConsistency),
    [items, repeatConsistency],
  )
  const batchStats = buildResultsBatchStats(allItems)
  const resultsNotice = buildResultsEmptyState({
    activeRun,
    itemCount: allItems.length,
    loading,
  })

  return (
    // One surface around the whole worklist. Removing the lab's outer card left
    // the table as the only bordered thing on the screen, so it read as an
    // island with the run strip and the filter chips floating above it,
    // unattached. The fix is not to put the card back one level up — that was
    // what nested three borders — but to draw it around the working unit: these
    // controls operate on this table and nothing else, so they are one tool.
    // Internal rules separate the layers; there is no border inside a border.
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      {/* The run strip is a toolbar, not a panel. It used to be a tinted card
          whose first line was a static "Results batch" heading over a case
          count, above a second line holding the run selector. Both were
          redundant: the tab is already called Results, and the selector's own
          option label carries the run's identity *and* its case count
          ("10.07. · Imported run · 3 cases"). The count was also printed a
          second time verbatim as "N shown" beside the filters — same
          `items.length`, same screen. So the heading is gone and the selector
          is the strip: it names the run, and the details popover sits with it.
          On compact screens the run and actions occupy separate rows so fixed
          control widths can never overlap. */}
      <div
        className="flex flex-col gap-3 border-b border-border px-4 py-3 2xl:flex-row 2xl:items-center"
        data-testid="results-run-toolbar"
      >
        <div
          className="flex w-full min-w-0 items-center gap-2 2xl:flex-1"
          data-testid="results-run-selector-group"
        >
          <DeveloperRunSelect
            batchHistory={batchHistory}
            className="w-full 2xl:max-w-[28rem]"
            disabled={loading}
            emptyLabel={tr(language, "No saved runs yet")}
            label={tr(language, "Run")}
            language={language}
            onSelectBatch={onSelectBatch}
            selectedBatchId={selectedBatchId}
          />
          {activeRun ? (
            <div className="shrink-0">
              <BatchDetailsPopover activeRun={activeRun} language={language} />
            </div>
          ) : null}
        </div>
        <div
          className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:ml-auto 2xl:w-auto 2xl:auto-cols-max 2xl:grid-flow-col 2xl:grid-cols-none"
          data-testid="results-run-actions"
        >
          {/* No visible "Order" label: every option names itself ("Run order",
              "Attention first"), so the trigger already says what the control
              does. The label survives as the accessible name. */}
          <SelectField
            ariaLabel={tr(language, "Order")}
            options={[
              { label: tr(language, "Run order"), value: "run_order" },
              { label: tr(language, "Attention first"), value: "attention_first" },
              { label: tr(language, "Human missing first"), value: "human_missing_first" },
              { label: tr(language, "Reviewed first"), value: "reviewed_first" },
            ]}
            className="w-full 2xl:w-auto"
            triggerClassName="w-full min-w-0 2xl:w-auto 2xl:min-w-[11rem]"
            value={activeSort}
            onChange={(value) => onSortChange(value as WorklistSort)}
          />
          {/* Refresh belongs to the run, not to the filters it used to sit
              beside. Its one real job is pulling in human reviews submitted
              through reviewer links from other browser sessions: the 1.5s
              worklist poll only runs while the batch status is "running", and
              this button is disabled for exactly that period, so the two never
              overlap. */}
          <Button
            size="lg"
            variant="outline"
            className="w-full rounded-lg px-4 shadow-sm 2xl:w-auto"
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCw />
            {tr(language, "Refresh")}
          </Button>
          {/* `size="lg"` is h-9, which is the height both selects in this strip
              already hardcode. The buttons used to reach it through an `h-9`
              override on `size="sm"`. */}
          <Button
            size="lg"
            variant="outline"
            className="w-full rounded-lg px-4 shadow-sm 2xl:w-auto"
            disabled={!activeRun?.batch_id || loading || exportingStudyPackage}
            onClick={onExportStudyPackage}
          >
            <Download />
            {tr(language, exportingStudyPackage ? "Exporting" : "Export study package")}
          </Button>
          <Button
            size="lg"
            className="w-full rounded-lg px-4 shadow-primary 2xl:w-auto"
            disabled={!firstTraceId || loading}
            onClick={() => firstTraceId && onSelectTrace(firstTraceId)}
          >
            {tr(language, "Start reviewing")}
            <ArrowRight />
          </Button>
        </div>
      </div>

      {/* The chips filter the table directly below and are also its readout —
          the counts answer "does this run have a problem?" without a click. */}
      <div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border px-4 py-3">
          {/* "All" is the reset, not a signal, so it stands outside the groups. */}
          <FilterButton
            active={activeFilter === "all"}
            count={batchStats.total}
            disabled={loading}
            label={tr(language, "All")}
            onClick={() => onFilterChange("all")}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-1 text-caps uppercase text-label">
              {tr(language, "Signals")}
            </span>
            <FilterButton
              active={activeFilter === "human_missing"}
              count={batchStats.humanMissing}
              disabled={loading}
              label={tr(language, "Human missing")}
              tone="human"
              onClick={() => onFilterChange("human_missing")}
            />
            <FilterButton
              active={activeFilter === "mismatch"}
              alert={batchStats.mismatch > 0}
              count={batchStats.mismatch}
              disabled={loading}
              label={tr(language, "Mismatch")}
              tone="risk"
              onClick={() => onFilterChange("mismatch")}
            />
            <FilterButton
              active={activeFilter === "ai_false_accept"}
              alert={batchStats.aiFalseAccept > 0}
              count={batchStats.aiFalseAccept}
              disabled={loading}
              label={tr(language, "AI false accepts")}
              tone="risk"
              onClick={() => onFilterChange("ai_false_accept")}
            />
            <FilterButton
              active={activeFilter === "human_disagreement"}
              alert={batchStats.humanDisagreement > 0}
              count={batchStats.humanDisagreement}
              disabled={loading}
              label={tr(language, "Human disagreement")}
              tone="risk"
              onClick={() => onFilterChange("human_disagreement")}
            />
            <FilterButton
              active={activeFilter === "source_concern"}
              alert={batchStats.sourceConcern > 0}
              count={batchStats.sourceConcern}
              disabled={loading}
              label={tr(language, "Source concern")}
              tone="evidence"
              onClick={() => onFilterChange("source_concern")}
            />
            <FilterButton
              active={activeFilter === "needs_attention"}
              count={batchStats.attention}
              disabled={loading}
              label={tr(language, "Attention")}
              tone="judge"
              onClick={() => onFilterChange("needs_attention")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-1 text-caps uppercase text-label">
              {tr(language, "Human")}
            </span>
            <FilterButton
              active={activeFilter === "accept"}
              count={batchStats.decisions.accept}
              disabled={loading}
              label={tr(language, "Accept")}
              tone="ready"
              onClick={() => onFilterChange("accept")}
            />
            <FilterButton
              active={activeFilter === "needs_edit"}
              count={batchStats.decisions.needs_edit}
              disabled={loading}
              label={tr(language, "Needs edit")}
              tone="judge"
              onClick={() => onFilterChange("needs_edit")}
            />
            <FilterButton
              active={activeFilter === "reject"}
              count={batchStats.decisions.reject}
              disabled={loading}
              label={tr(language, "Reject")}
              tone="risk"
              onClick={() => onFilterChange("reject")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-1 text-caps uppercase text-label">
              {tr(language, "Judge")}
            </span>
            <FilterButton
              active={activeFilter === "judge_accept"}
              count={batchStats.judgeDecisions.accept}
              disabled={loading}
              label={tr(language, "Accept")}
              tone="ready"
              onClick={() => onFilterChange("judge_accept")}
            />
            <FilterButton
              active={activeFilter === "judge_needs_edit"}
              count={batchStats.judgeDecisions.needs_edit}
              disabled={loading}
              label={tr(language, "Needs edit")}
              tone="judge"
              onClick={() => onFilterChange("judge_needs_edit")}
            />
            <FilterButton
              active={activeFilter === "judge_reject"}
              count={batchStats.judgeDecisions.reject}
              disabled={loading}
              label={tr(language, "Reject")}
              tone="risk"
              onClick={() => onFilterChange("judge_reject")}
            />
          </div>
          <span className="ml-auto text-sm text-muted-foreground">
            {items.length} {tr(language, "shown")}
          </span>
        </div>

        {/* Just a scroll container. It used to be a bordered, tinted, inset
            surface holding a bordered table — two rounded rectangles a few
            pixels apart. The enclosing card is now the only border. */}
        <div className="overflow-x-auto">
          {loading && !items.length ? (
            <div className="m-4 rounded-xl border border-dashed border-ring p-4 text-sm text-muted-foreground">
              {tr(language, "Loading traces")}
            </div>
          ) : null}
          {resultsNotice ? (
            <div className={`m-4 rounded-xl border border-dashed p-4 text-sm ${resultsNoticeClasses(resultsNotice.tone)}`}>
              <div className="font-semibold">
                {tr(language, resultsNotice.title)}
              </div>
              <div className="mt-1">
                {tr(language, resultsNotice.description)}
              </div>
              {resultsNotice.detail ? (
                <div className="mt-2 break-words text-xs opacity-85">
                  {resultsNotice.detail}
                </div>
              ) : null}
            </div>
          ) : null}
          {/* Two columns were dropped. "Answer" had two possible values and
              printed "Answer generated" on every row of every completed run;
              the exception it existed for is now the first link in the
              attention chain. "Service" showed a document title truncated to
              "2_Ergebnisbericht_zum_New_Work-…" — not readable, and not a
              triage signal either: this table answers "which cases need
              attention", and the source document does not bear on that. It is
              now in the case detail, where it has room to be read.
              Four columns instead of six drop the minimum width from 56rem to
              40rem, so the table scrolls horizontally on far fewer screens. */}
          {caseRows.length ? (
            <div className="min-w-[40rem]">
              <div className="grid grid-cols-[2.4fr_0.9fr_0.9fr_1fr] border-b border-surface-head-border bg-surface-head px-4 py-2.5 text-caps uppercase text-label">
                <div>{tr(language, "Question")}</div>
                <div>{tr(language, "Latest judge")}</div>
                <div>{tr(language, "Human review")}</div>
                <div>{tr(language, "Attention")}</div>
              </div>
              {caseRows.map((row) => (
                <button
                  key={row.traceId}
                  type="button"
                  className={cn(
                    // Every row carries the 3px left border, transparent unless
                    // the row needs attention. Without it, only flagged rows
                    // would have it and their content would sit 3px right of
                    // everyone else's — invisible while a tinted background
                    // masked the shift, obvious once it was removed.
                    "grid w-full grid-cols-[2.4fr_0.9fr_0.9fr_1fr] items-center border-b border-l-[3px] border-row-border border-l-transparent bg-card px-4 py-3 text-left transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring last:border-b-0",
                    // The rail alone marks the row. It used to also carry a
                    // tinted background, which on a run with several flagged
                    // cases washed whole bands of the table in red and left the
                    // eye nowhere quiet to rest. The rail plus the attention
                    // badge in the last column are enough to find the row.
                    row.attentionTone === "danger" &&
                      "border-l-[color:var(--dashboard-error-rail)]",
                  )}
                  onClick={() => onSelectTrace(row.traceId)}
                >
                  <div className="min-w-0 pr-4">
                    <div className="line-clamp-2 text-section-title text-foreground">
                      {row.question}
                    </div>
                    <div className="mt-1 truncate font-mono text-xs text-label">
                      {row.traceId}
                    </div>
                    {traceStability.has(row.traceId) ? (
                      <Badge
                        variant="outline"
                        className={cn("mt-1 text-xs font-semibold", dashboardToneClass.notice)}
                        title={tr(
                          language,
                          "The AI judge decided this case differently across repeat runs; routed to human review.",
                        )}
                      >
                        {tr(language, "unstable judge")}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <DecisionPill
                      language={language}
                      tone={statusTone(row.judgeStatus)}
                      value={row.judgeStatus}
                    />
                    {row.judgeChangedFrom ? (
                      <Badge
                        variant="outline"
                        className="mt-1 max-w-full border-ring bg-surface-soft text-xs font-semibold text-muted-foreground"
                      >
                        {tr(language, "changed from")} {decisionLabel(language, row.judgeChangedFrom)}
                      </Badge>
                    ) : null}
                  </div>
                  <HumanReviewCell decisions={row.humanDecisions} language={language} />
                  {/* Only exceptions are drawn. The two "nothing is wrong"
                      outcomes — `ready` ("No attention signal") and `quiet`
                      ("Waiting for human review") — used to render a full badge
                      on every clean row, so every row carried a chip and the
                      eye could not find the rows that mattered. `quiet` was
                      also a restatement of the Human review column beside it,
                      which already reads "Human pending". Suppressed here
                      rather than inside AttentionBadge: Judge Calibration uses
                      the same component, and there `ready` means "calibration
                      passed", which is the result itself. */}
                  {row.attentionTone === "ready" || row.attentionTone === "quiet" ? (
                    <div />
                  ) : (
                    <AttentionBadge
                      language={language}
                      tone={row.attentionTone}
                      value={row.attention}
                    />
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
