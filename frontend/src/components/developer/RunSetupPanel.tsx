import { ClipboardCheck, FlaskConical, ListFilter, Loader2, Snowflake } from "lucide-react"
import { useState } from "react"

import {
  buildRunInputSourceSummary,
  buildRunSetupOverview,
  type DeveloperActiveRun,
  type DeveloperWorklistItem,
  type RunInputSource,
  type StudyRunSize,
  type StudyRunSummary,
} from "./developerLabModel"
import { developerTr as tr } from "./developerTraceModel"
import type { ImportedAnswerRecord } from "./importedAnswerImport"
import { ImportedAnswerDialog, ImportedAnswersSetupPanel } from "./ImportedAnswersSetup"
import { PromptJudgeLabPanel } from "./PromptSetupPanels"
import { QuestionBankPanel } from "./QuestionBankPanel"
import { RunDetailPill } from "./shared/RunDetailPill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SelectField } from "@/components/ui/select-field"
import type {
  CitizenQuestion,
  DeveloperPromptsResponse,
  DeveloperRunSettings,
  ImportedDataset,
  Language,
  PromptType,
} from "@/types"

export function RunSetupPanel({
  activeRun,
  developerPrompts,
  importedDatasets,
  items,
  language,
  loading,
  onDeleteImportedDataset,
  onRunDemo,
  onRunStudyRun,
  onRunImportedDataset,
  onRunSelectedQuestions,
  onRunSettingsChange,
  onSelectedQuestionIdsChange,
  onSavePrompt,
  onSaveImportedAnswers,
  questions,
  questionBankCount,
  runningRunType,
  runSettings,
  savingPromptType,
  selectedQuestionIds,
  studyRunSize,
  summary,
  onStudyRunSizeChange,
}: {
  activeRun: DeveloperActiveRun
  developerPrompts: DeveloperPromptsResponse | null
  importedDatasets: ImportedDataset[]
  items: DeveloperWorklistItem[]
  language: Language
  loading: boolean
  onDeleteImportedDataset: (importId: string) => Promise<void>
  onRunDemo: () => void
  onRunStudyRun: () => void
  onRunImportedDataset: (importId: string) => Promise<void>
  onRunSelectedQuestions: () => void
  onRunSettingsChange: (settings: Partial<DeveloperRunSettings>) => void
  onSelectedQuestionIdsChange: (questionIds: string[]) => void
  onSavePrompt: (prompt: { promptText: string; promptType: PromptType; promptVersion: string }) => void
  onSaveImportedAnswers: (filename: string, records: ImportedAnswerRecord[]) => Promise<void>
  questions: CitizenQuestion[]
  questionBankCount: number
  runningRunType: "calibration" | "demo" | "imported" | "selected" | "study" | ""
  runSettings: DeveloperRunSettings
  savingPromptType: PromptType | ""
  selectedQuestionIds: string[]
  studyRunSize: StudyRunSize
  summary: StudyRunSummary
  onStudyRunSizeChange: (size: StudyRunSize) => void
}) {
  const [questionBankOpen, setQuestionBankOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [runInputSource, setRunInputSource] = useState<RunInputSource>("internal_demo")
  const reviewed = items.filter((item) => item.humanReviewCount > 0).length
  const overview = buildRunSetupOverview({
    activeRun,
    answerCount: summary.answerCount,
    answerPromptVersion: runSettings.answer_prompt_version,
    humanReviewCount: reviewed,
    judgeCount: summary.judgeCount,
    judgePromptVersion: runSettings.judge_prompt_version,
    modelName: runSettings.model_name,
    questionCount: summary.questionCount,
    language,
  })

  return (
    <div className="grid gap-2 pr-1">
      <RunOverviewPanel
        language={language}
        loading={loading}
        onRunDemo={onRunDemo}
        onRunStudyRun={onRunStudyRun}
        onOpenQuestionBank={() => setQuestionBankOpen(true)}
        onRunInputSourceChange={setRunInputSource}
        onStudyRunSizeChange={onStudyRunSizeChange}
        overview={overview}
        runInputSource={runInputSource}
        runningRunType={runningRunType}
        selectedQuestionCount={selectedQuestionIds.length}
        studyRunSize={studyRunSize}
        totalQuestionCount={questionBankCount}
      />
      {runInputSource === "imported_answers" ? (
        <section className="grid min-h-0 items-stretch gap-2 pb-1 xl:grid-cols-2">
          <ImportedAnswersSetupPanel
            datasets={importedDatasets}
            language={language}
            loading={loading}
            running={runningRunType === "imported"}
            onDeleteDataset={onDeleteImportedDataset}
            onOpenImportDialog={() => setImportDialogOpen(true)}
            onRunDataset={onRunImportedDataset}
          />
          <PromptJudgeLabPanel
            activeRun={activeRun}
            developerPrompts={developerPrompts}
            language={language}
            runInputSource={runInputSource}
            runSettings={runSettings}
            savingPromptType={savingPromptType}
            onRunSettingsChange={onRunSettingsChange}
            onSavePrompt={onSavePrompt}
          />
        </section>
      ) : (
        <PromptJudgeLabPanel
          activeRun={activeRun}
          developerPrompts={developerPrompts}
          language={language}
          runInputSource={runInputSource}
          runSettings={runSettings}
          savingPromptType={savingPromptType}
          onRunSettingsChange={onRunSettingsChange}
          onSavePrompt={onSavePrompt}
        />
      )}
      {questionBankOpen ? (
        <QuestionBankPanel
          language={language}
          loading={loading}
          questions={questions}
          running={runningRunType === "selected"}
          selectedQuestionIds={selectedQuestionIds}
          onClose={() => setQuestionBankOpen(false)}
          onRunSelectedQuestions={onRunSelectedQuestions}
          onSelectedQuestionIdsChange={onSelectedQuestionIdsChange}
        />
      ) : null}
      {importDialogOpen ? (
        <ImportedAnswerDialog
          language={language}
          running={runningRunType === "imported"}
          onClose={() => setImportDialogOpen(false)}
          onImport={async (filename, records) => {
            await onSaveImportedAnswers(filename, records)
            setImportDialogOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function RunOverviewPanel({
  language,
  loading,
  onRunDemo,
  onRunStudyRun,
  onOpenQuestionBank,
  onRunInputSourceChange,
  onStudyRunSizeChange,
  overview,
  runInputSource,
  runningRunType,
  selectedQuestionCount,
  studyRunSize,
  totalQuestionCount,
}: {
  language: Language
  loading: boolean
  onRunDemo: () => void
  onRunStudyRun: () => void
  onOpenQuestionBank: () => void
  onRunInputSourceChange: (source: RunInputSource) => void
  onStudyRunSizeChange: (size: StudyRunSize) => void
  overview: ReturnType<typeof buildRunSetupOverview>
  runInputSource: RunInputSource
  runningRunType: "calibration" | "demo" | "imported" | "selected" | "study" | ""
  selectedQuestionCount: number
  studyRunSize: StudyRunSize
  totalQuestionCount: number
}) {
  return (
    <section className="rounded-xl border border-border bg-surface-soft p-4">
      <div className="grid gap-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-caps uppercase text-label">
              <ClipboardCheck className="size-4" />
              {tr(language, "Current run")}
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                {tr(language, overview.status)}
              </Badge>
            </div>
            <div className="mt-1 break-words text-base font-semibold tracking-tight text-foreground">
              {tr(language, overview.title)}
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-5 xl:justify-end">
            {overview.technicalDetails.map(([label, value]) => (
              <RunDetailPill
                key={label}
                label={label}
                language={language}
                value={value}
              />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <RunInputSourceSelect
            language={language}
            loading={loading}
            runInputSource={runInputSource}
            onRunInputSourceChange={onRunInputSourceChange}
          />
          <div className="ml-auto flex flex-wrap justify-end gap-1.5">
            {runInputSource === "internal_demo" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 max-w-full rounded-xl border-border bg-card px-2.5 text-xs text-foreground shadow-sm hover:bg-surface-soft"
                  onClick={onOpenQuestionBank}
                  disabled={loading}
                >
                  <ListFilter />
                  {tr(language, "Choose questions from Question Bank")}
                  {selectedQuestionCount ? (
                    <Badge variant="secondary" className="ml-1 rounded-full px-1.5 py-0 text-xs">
                      {selectedQuestionCount}
                    </Badge>
                  ) : null}
                </Button>
                <Button
                  size="sm"
                  className="h-8 max-w-full rounded-xl px-2.5 text-xs shadow-primary"
                  onClick={onRunDemo}
                  disabled={loading}
                >
                  {runningRunType === "demo" ? <Loader2 className="animate-spin" /> : <FlaskConical />}
                  {tr(language, "Create random demo run")}
                </Button>
                <StudyRunSizeSelect
                  language={language}
                  loading={loading}
                  studyRunSize={studyRunSize}
                  totalQuestionCount={totalQuestionCount}
                  onStudyRunSizeChange={onStudyRunSizeChange}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 max-w-full rounded-xl border-border bg-surface-soft px-2.5 text-xs"
                  onClick={onRunStudyRun}
                  disabled={loading}
                >
                  {runningRunType === "study" ? <Loader2 className="animate-spin" /> : <Snowflake />}
                  {tr(language, "Generate frozen study run")}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function RunInputSourceSelect({
  language,
  loading,
  runInputSource,
  onRunInputSourceChange,
}: {
  language: Language
  loading: boolean
  runInputSource: RunInputSource
  onRunInputSourceChange: (source: RunInputSource) => void
}) {
  const options: RunInputSource[] = ["internal_demo", "imported_answers"]

  return (
    <label className="flex min-w-0 shrink-0 items-center gap-2 text-xs font-semibold text-muted-foreground">
      <span className="shrink-0">{tr(language, "Run input source")}</span>
      <SelectField
        disabled={loading}
        options={options.map((source) => ({
          label: tr(language, buildRunInputSourceSummary(source).title),
          value: source,
        }))}
        triggerClassName="w-[13.5rem]"
        value={runInputSource}
        onChange={(value) => onRunInputSourceChange(value as RunInputSource)}
      />
    </label>
  )
}

function StudyRunSizeSelect({
  language,
  loading,
  studyRunSize,
  totalQuestionCount,
  onStudyRunSizeChange,
}: {
  language: Language
  loading: boolean
  studyRunSize: StudyRunSize
  totalQuestionCount: number
  onStudyRunSizeChange: (size: StudyRunSize) => void
}) {
  const fullCount = totalQuestionCount || 50

  return (
    <label className="flex min-w-0 shrink-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <span className="sr-only">{tr(language, "Study run size")}</span>
      <SelectField
        disabled={loading}
        options={[
          { label: tr(language, "Test (5)"), value: "test" },
          {
            label: tr(language, "All {count}").replace("{count}", String(fullCount)),
            value: "all",
          },
        ]}
        triggerClassName="w-[8.5rem]"
        value={studyRunSize}
        onChange={(value) => onStudyRunSizeChange(value as StudyRunSize)}
      />
    </label>
  )
}
