import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { AnalysisPanel } from "./AnalysisPanel"
import { DeveloperCaseWorkspace } from "./DeveloperCaseWorkspace"
import { HumanEvaluationSetupPanel } from "./HumanEvaluationSetupPanel"
import { ImprovementPanel } from "./ImprovementPanel"
import { IntegrationSetupPanel } from "./IntegrationSetupPanel"
import { JudgeCalibrationPanel } from "./JudgeCalibrationPanel"
import { ResultsCasesPanel } from "./ResultsCasesPanel"
import { RunSetupPanel } from "./RunSetupPanel"
import {
  buildDefaultDeveloperLabTab,
  buildRunCaseRows,
  buildStudyRunSummary,
  developerLabCaseDetailTab,
  developerLabTabs,
  isDeveloperLabTabId,
  sortWorklistItems,
  traceHasImportedHumanLabel,
  type DeveloperActiveRun,
  type DeveloperLabTabId,
  type DeveloperWorklistItem,
  type AdjudicationReviewPayload,
  type StudyRunSize,
  type WorklistFilter,
  type WorklistSort,
} from "./developerLabModel"
import { developerTr as tr } from "./developerTraceModel"
import type { ImportedAnswerRecord } from "./importedAnswerImport"
import type {
  CitizenQuestion,
  DashboardOverview,
  DeveloperCalibrationHistoryItem,
  DeveloperPromptsResponse,
  DeveloperRunSettings,
  EvaluationTrace,
  ImportedDataset,
  IntegrationStatus,
  Language,
  PromptType,
  RepeatConsistencyResponse,
} from "@/types"
import type { ReviewerPlan } from "@/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { replaceDeveloperUrlState } from "@/appMode"
import { dashboardToneClass } from "@/lib/dashboardTones"
import { cn } from "@/lib/utils"

export function TraceList({
  activeFilter,
  activeRun,
  allItems,
  batchHistory,
  calibrationHistory,
  calibrationItems,
  canPrepareSecondaryTabs,
  closingReviewerPlan,
  creatingReviewerPlan,
  addingReviewerParticipant,
  settingReviewerExclusion,
  developerPrompts,
  error,
  exportingStudyPackage,
  items,
  integrationStatus,
  importedDatasets,
  language,
  loading,
  overview,
  questions,
  questionCount,
  reviewerCount,
  reviewerPlan,
  reviewsPerQuestion,
  rerunningJudgeTraceId,
  repeatConsistency,
  savingAdjudicationTraceId,
  runningRunType,
  runSettings,
  savingPromptType,
  selectedCalibrationBatchId,
  selectedBatchId,
  selectedTrace,
  selectedQuestionIds,
  studyRunSize,
  onBackToCases,
  onCloseReviewerPlan,
  onCreateReviewerPlan,
  onAddReviewerParticipant,
  onSetReviewerExclusion,
  onExportStudyPackage,
  onFilterChange,
  onPrepareTab,
  onRefresh,
  onReviewerCountChange,
  onReviewsPerQuestionChange,
  onRunDemo,
  onRunStudyRun,
  onDeleteImportedDataset,
  onRunImportedDataset,
  onSaveImportedAnswers,
  onRunCalibration,
  onRerunJudge,
  onSaveAdjudication,
  onRunSelectedQuestions,
  onRunSettingsChange,
  onSavePrompt,
  onSelectCalibrationRun,
  onSelectResultsBatch,
  onSelectTrace,
  onSelectedQuestionIdsChange,
  onStudyRunSizeChange,
}: {
  activeFilter: WorklistFilter
  activeRun: DeveloperActiveRun
  allItems: DeveloperWorklistItem[]
  batchHistory: NonNullable<DeveloperActiveRun>[]
  calibrationHistory: DeveloperCalibrationHistoryItem[]
  calibrationItems: EvaluationTrace[]
  canPrepareSecondaryTabs: boolean
  closingReviewerPlan: boolean
  creatingReviewerPlan: boolean
  addingReviewerParticipant: boolean
  settingReviewerExclusion: string
  developerPrompts: DeveloperPromptsResponse | null
  error: string
  exportingStudyPackage: boolean
  items: DeveloperWorklistItem[]
  integrationStatus: IntegrationStatus | null
  importedDatasets: ImportedDataset[]
  language: Language
  loading: boolean
  overview: DashboardOverview | null
  questions: CitizenQuestion[]
  questionCount: number
  reviewerCount: number
  reviewerPlan: ReviewerPlan | null
  reviewsPerQuestion: number
  rerunningJudgeTraceId: string
  repeatConsistency: RepeatConsistencyResponse | null
  savingAdjudicationTraceId: string
  runningRunType: "calibration" | "demo" | "imported" | "selected" | "study" | ""
  runSettings: DeveloperRunSettings
  savingPromptType: PromptType | ""
  selectedCalibrationBatchId: string
  selectedBatchId: string
  selectedTrace: EvaluationTrace | null
  selectedQuestionIds: string[]
  studyRunSize: StudyRunSize
  onBackToCases: () => void
  onCloseReviewerPlan: () => void
  onCreateReviewerPlan: () => void
  onAddReviewerParticipant: (sourceParticipant: string) => void
  onSetReviewerExclusion: (
    participant: string,
    excluded: boolean,
    reason?: string,
    replacedBy?: string,
  ) => void
  onExportStudyPackage: () => void
  onFilterChange: (filter: WorklistFilter) => void
  onPrepareTab: (tabId: DeveloperLabTabId) => void
  onRefresh: () => void
  onReviewerCountChange: (value: number) => void
  onReviewsPerQuestionChange: (value: number) => void
  onRunDemo: () => void
  onRunStudyRun: () => void
  onDeleteImportedDataset: (importId: string) => Promise<void>
  onRunImportedDataset: (importId: string) => Promise<void>
  onSaveImportedAnswers: (filename: string, records: ImportedAnswerRecord[]) => Promise<void>
  onRunCalibration: () => void
  onRerunJudge: (traceId: string, settings: DeveloperRunSettings) => void
  onSaveAdjudication: (traceId: string, payload: AdjudicationReviewPayload) => void
  onRunSelectedQuestions: () => void
  onRunSettingsChange: (settings: Partial<DeveloperRunSettings>) => void
  onSavePrompt: (prompt: { promptText: string; promptType: PromptType; promptVersion: string }) => void
  onSelectCalibrationRun: (batchId: string) => void
  onSelectResultsBatch: (batchId: string) => void
  onSelectTrace: (traceId: string) => void
  onSelectedQuestionIdsChange: (questionIds: string[]) => void
  onStudyRunSizeChange: (size: StudyRunSize) => void
}) {
  const totalQuestionCount = activeRun?.question_count || questionCount || overview?.question_count || allItems.length
  const studySummary = buildStudyRunSummary(allItems, totalQuestionCount)
  const reviewTargets = useMemo(() => reviewerPlan?.case_review_targets || {}, [reviewerPlan])
  const [worklistSort, setWorklistSort] = useState<WorklistSort>("run_order")
  const sortedItems = useMemo(() => sortWorklistItems(items, worklistSort), [items, worklistSort])
  const caseRows = useMemo(() => buildRunCaseRows(sortedItems, reviewTargets), [sortedItems, reviewTargets])
  const selectedIndex = selectedTrace
    ? sortedItems.findIndex((item) => item.trace.trace_id === selectedTrace.trace_id)
    : -1
  const previousTraceId = selectedIndex > 0 ? sortedItems[selectedIndex - 1]?.trace.trace_id : ""
  const nextTraceId = selectedIndex >= 0 ? sortedItems[selectedIndex + 1]?.trace.trace_id || "" : ""
  const requestedTab = new URLSearchParams(window.location.search).get("developer_tab")
  const [activeTab, setActiveTab] = useState<DeveloperLabTabId>(() =>
    buildDefaultDeveloperLabTab(activeRun, requestedTab),
  )
  const [userSelectedTab, setUserSelectedTab] = useState(isDeveloperLabTabId(requestedTab))

  useEffect(() => {
    if (!userSelectedTab) {
      setActiveTab(buildDefaultDeveloperLabTab(activeRun, requestedTab))
    }
  }, [activeRun, requestedTab, userSelectedTab])

  useEffect(() => {
    if (!canPrepareSecondaryTabs) return
    onPrepareTab(activeTab)
  }, [activeTab, canPrepareSecondaryTabs, onPrepareTab])

  // `position: sticky` gives no styling hook for "currently stuck", so a 1px
  // sentinel sits directly above the strip: once it has scrolled out of view,
  // the strip is pinned. Cheaper and steadier than a scroll listener, which
  // would run on every frame to compute the same boolean.
  const stickySentinelRef = useRef<HTMLDivElement>(null)
  const [tabStripStuck, setTabStripStuck] = useState(false)

  useEffect(() => {
    const sentinel = stickySentinelRef.current
    if (!sentinel) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      setTabStripStuck(!entry.isIntersecting)
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  function changeTab(tabId: DeveloperLabTabId) {
    setUserSelectedTab(true)
    setActiveTab(tabId)
    replaceDeveloperUrlState({
      tab: tabId,
      traceId: tabId === developerLabCaseDetailTab && selectedTrace ? selectedTrace.trace_id : "",
    })
    if (tabId !== developerLabCaseDetailTab && selectedTrace) {
      onBackToCases()
    }
  }

  function selectTrace(traceId: string) {
    setUserSelectedTab(true)
    setActiveTab(developerLabCaseDetailTab)
    replaceDeveloperUrlState({ tab: developerLabCaseDetailTab, traceId })
    onSelectTrace(traceId)
  }

  return (
    // No card around the lab. It wrapped the tab strip and every panel in a
    // surface whose only job was to be a surface, so the Results tab nested
    // three rounded borders (this card, the table's wrapper, the table) and the
    // case detail put cards inside a card. Panels that are genuinely card-like
    // still carry their own; the lab itself sits on the page, the way the
    // shadcn dashboard block does.
    //
    // This also retires a trap: the card needed `overflow-visible` to override
    // shadcn's base `overflow-hidden`, because a scroll container between a
    // sticky element and the viewport silently disables `sticky`. With no card
    // there is no ancestor to fight.
    <Tabs
      className="flex w-full min-w-0 max-w-full flex-col gap-0"
      value={activeTab}
      onValueChange={(value) => changeTab(value as DeveloperLabTabId)}
    >
      <div ref={stickySentinelRef} aria-hidden className="h-px w-full" />
      {/* Sticky, so the tabs stay reachable on the long panels. The fill stays
          in both states — it is what separates the strip from the page — but
          its shape follows the state: a rounded, fully bordered surface while
          the strip sits in the flow, squared off with only a bottom rule once
          it is pinned. Rounded corners say "this is an object on the page";
          a flush edge says "this is the top of the window", and each is true in
          exactly one of the two states.
          The border is declared on all four sides in both states and only its
          colour changes, so the box never resizes and pinning cannot shift the
          content below it.
          The fill cannot be a fixed colour matched to the page, because
          `--page-gradient` shifts with scroll position, so it is translucent
          with a backdrop blur: that reads correctly over whatever passes
          beneath it, in either theme. */}
      <div
        className={cn(
          "sticky top-0 z-20 mb-4 flex min-w-0 flex-wrap items-center gap-2 border border-transparent bg-background/80 px-2 pb-2 pt-2 backdrop-blur-sm transition-[border-radius,border-color]",
          tabStripStuck ? "rounded-none border-b-border" : "rounded-2xl border-border",
        )}
      >
        {/* No fill of its own. The strip above already carries one — it has to,
            being sticky — and a tinted container inside a tinted strip is two
            backgrounds stacked to say one thing. The active tab's pill is what
            marks the selection; the container was only ever framing it. */}
        <TabsList className="w-full flex-wrap gap-0.5 rounded-xl bg-transparent p-0.5 group-data-horizontal/tabs:h-auto">
          {developerLabTabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "h-8 flex-auto whitespace-nowrap rounded-lg px-2.5 text-sm font-semibold leading-none text-muted-foreground dark:text-muted-foreground",
                // A fill means "this tab is selected", and nothing else. Hover
                // used to paint an inactive tab with `bg-card/75` — a pale
                // version of the same shape the active tab wears, so pointing at
                // a tab produced something that looked like a weaker selection
                // and left two tabs looking chosen at once. Hover now changes
                // only the text colour, which is also what the primitive does.
                "hover:text-foreground dark:hover:text-foreground",
                "data-active:bg-[var(--dashboard-active)] data-active:text-[var(--dashboard-active-foreground)]",
                "dark:data-active:border-transparent dark:data-active:bg-[var(--dashboard-active)] dark:data-active:text-[var(--dashboard-active-foreground)]",
                // Hover is for tabs you could switch to, so it has to stop at
                // the one you are already on. Both the primitive's own
                // `hover:text-foreground` and the one above fire regardless of
                // state, which on the active tab replaced its light label with a
                // dark one on a saturated fill — the worst contrast on the strip
                // appearing exactly when the pointer is there. Re-assert the
                // active foreground for the hovered-and-active case; the
                // `data-active` variant carries the higher specificity, so it
                // wins over the bare `hover:`.
                "data-active:hover:text-[var(--dashboard-active-foreground)]",
                "dark:data-active:hover:text-[var(--dashboard-active-foreground)]",
              )}
            >
              {tr(language, tab.label)}
            </TabsTrigger>
          ))}
        </TabsList>
        {loading ? <Loader2 className="ml-auto size-5 animate-spin text-muted-foreground" /> : null}
      </div>

      <TabsContent value="run_console">
        <RunSetupPanel
          activeRun={activeRun}
          developerPrompts={developerPrompts}
          items={allItems}
          language={language}
          loading={loading}
          onRunDemo={onRunDemo}
          onRunStudyRun={onRunStudyRun}
          importedDatasets={importedDatasets}
          onDeleteImportedDataset={onDeleteImportedDataset}
          onRunImportedDataset={onRunImportedDataset}
          onSaveImportedAnswers={onSaveImportedAnswers}
          onRunSelectedQuestions={onRunSelectedQuestions}
          onRunSettingsChange={onRunSettingsChange}
          onSelectedQuestionIdsChange={onSelectedQuestionIdsChange}
          onSavePrompt={onSavePrompt}
          questions={questions}
          questionBankCount={questionCount || overview?.question_count || questions.length}
          runningRunType={runningRunType}
          runSettings={runSettings}
          savingPromptType={savingPromptType}
          selectedQuestionIds={selectedQuestionIds}
          studyRunSize={studyRunSize}
          summary={studySummary}
          onStudyRunSizeChange={onStudyRunSizeChange}
        />
      </TabsContent>

      <TabsContent value="human_study_setup">
        <div className="min-w-0 px-1 pb-1">
          <HumanEvaluationSetupPanel
            activeRun={activeRun}
            batchHistory={batchHistory}
            closing={closingReviewerPlan}
            creating={creatingReviewerPlan}
            adding={addingReviewerParticipant}
            excludingParticipant={settingReviewerExclusion}
            hasImportedHumanLabels={allItems.some((item) => traceHasImportedHumanLabel(item.trace))}
            language={language}
            loading={loading}
            reviewerCount={reviewerCount}
            reviewerPlan={reviewerPlan}
            reviewsPerQuestion={reviewsPerQuestion}
            selectedBatchId={selectedBatchId}
            onCloseReviewerPlan={onCloseReviewerPlan}
            onCreateReviewerPlan={onCreateReviewerPlan}
            onAddReviewerParticipant={onAddReviewerParticipant}
            onSetReviewerExclusion={onSetReviewerExclusion}
            onReviewerCountChange={onReviewerCountChange}
            onReviewsPerQuestionChange={onReviewsPerQuestionChange}
            onSelectBatch={onSelectResultsBatch}
          />
        </div>
      </TabsContent>

      <TabsContent value="integrations">
        <IntegrationSetupPanel
          integrationStatus={integrationStatus}
          language={language}
        />
      </TabsContent>

      <TabsContent value="judge_calibration">
        <JudgeCalibrationPanel
          calibrationItems={calibrationItems}
          calibrationHistory={calibrationHistory}
          developerPrompts={developerPrompts}
          language={language}
          loading={loading}
          running={runningRunType === "calibration"}
          runSettings={runSettings}
          selectedCalibrationBatchId={selectedCalibrationBatchId}
          onRunCalibration={onRunCalibration}
          onRunSettingsChange={onRunSettingsChange}
          onSelectCalibrationRun={onSelectCalibrationRun}
        />
      </TabsContent>

      <TabsContent value="analysis">
        <div className="min-w-0 px-1 pb-1">
          <AnalysisPanel
            activeRun={activeRun}
            batchHistory={batchHistory}
            items={allItems}
            language={language}
            loading={loading}
            repeatConsistency={repeatConsistency}
            reviewerPlan={reviewerPlan}
            selectedBatchId={selectedBatchId}
            onOpenDisagreements={() => {
              onFilterChange("mismatch")
              changeTab("results_cases")
            }}
            onSelectTrace={selectTrace}
            onSelectBatch={onSelectResultsBatch}
          />
        </div>
      </TabsContent>

      <TabsContent value="improvement">
        <div className="min-w-0 px-1 pb-1">
          <ImprovementPanel
            activeRun={activeRun}
            batchHistory={batchHistory}
            language={language}
            loading={loading}
            selectedBatchId={selectedBatchId}
            onSelectBatch={onSelectResultsBatch}
          />
        </div>
      </TabsContent>

      {error ? (
        <div className={cn("mt-2 rounded-xl border px-3 py-2 text-sm", dashboardToneClass.error)}>
          {error}
        </div>
      ) : null}

      <TabsContent value="results_cases">
        {selectedTrace ? (
          <div className="min-w-0 px-1 pb-1">
            <DeveloperCaseWorkspace
              developerPrompts={developerPrompts}
              language={language}
              nextDisabled={!nextTraceId}
              previousDisabled={!previousTraceId}
              rerunningJudge={rerunningJudgeTraceId === selectedTrace.trace_id}
              runSettings={runSettings}
              savingAdjudication={savingAdjudicationTraceId === selectedTrace.trace_id}
              trace={selectedTrace}
              onBack={onBackToCases}
              onJudgeRerun={onRerunJudge}
              onNext={nextTraceId ? () => selectTrace(nextTraceId) : undefined}
              onPrevious={previousTraceId ? () => selectTrace(previousTraceId) : undefined}
              onSaveAdjudication={onSaveAdjudication}
            />
          </div>
        ) : (
          <ResultsCasesPanel
            activeFilter={activeFilter}
            activeSort={worklistSort}
            activeRun={activeRun}
            allItems={allItems}
            batchHistory={batchHistory}
            caseRows={caseRows}
            items={sortedItems}
            language={language}
            loading={loading}
            repeatConsistency={repeatConsistency}
            selectedBatchId={selectedBatchId}
            exportingStudyPackage={exportingStudyPackage}
            onFilterChange={onFilterChange}
            onExportStudyPackage={onExportStudyPackage}
            onRefresh={onRefresh}
            onSelectBatch={onSelectResultsBatch}
            onSelectTrace={selectTrace}
            onSortChange={setWorklistSort}
          />
        )}
      </TabsContent>
    </Tabs>
  )
}
