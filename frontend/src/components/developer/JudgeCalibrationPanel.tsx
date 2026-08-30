import { ArrowLeft, Beaker, Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"

import {
  buildCalibrationCaseRows,
  buildCalibrationPromptDiagnosis,
  buildCalibrationSummary,
  buildPromptVersionOptions,
} from "./developerLabModel"
import { buildDeveloperSourceExcerptLabel, developerTr as tr } from "./developerTraceModel"
import {
  DEFAULT_JUDGE_MODEL_NAME,
  JUDGE_MODEL_OPTIONS,
  savedModelIfAvailable,
} from "./developerPromptOptions"
import { AttentionBadge } from "./shared/AttentionBadge"
import { formatShortMonthDateTime } from "./shared/developerFormatters"
import { RunProgressCard } from "./shared/RunProgressCard"
import { StatusText } from "./shared/StatusText"
import { LinkedText } from "@/components/shared/LinkedText"
import { SourceExcerptText } from "@/components/shared/SourceExcerptText"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SectionCard } from "@/components/ui/section-card"
import { SelectField } from "@/components/ui/select-field"
import { decisionLabel } from "@/lib/decisionDisplay"
import { cn } from "@/lib/utils"
import type {
  DeveloperPromptsResponse,
  DeveloperCalibrationHistoryItem,
  DeveloperRunSettings,
  EvaluationTrace,
  Language,
} from "@/types"

function calibrationRunPassRate(item: DeveloperCalibrationHistoryItem) {
  return item.summary.cards.find((card) => card.label === "Calibration pass rate")?.value || "0/0"
}

function calibrationHistoryLabel(item: DeveloperCalibrationHistoryItem, language: Language) {
  const date = formatShortMonthDateTime(item.created_at, language) || item.batch_id
  const prompt = String(item.metadata?.judge_prompt_version || "-")
  const model = String(item.metadata?.judge_model_name || item.metadata?.model_name || "-")
  return `${date} · ${prompt} · ${model} · ${calibrationRunPassRate(item)}`
}

export function JudgeCalibrationPanel({
  calibrationHistory,
  calibrationItems,
  developerPrompts,
  language,
  loading,
  running,
  runSettings,
  selectedCalibrationBatchId,
  onRunCalibration,
  onRunSettingsChange,
  onSelectCalibrationRun,
}: {
  calibrationHistory: DeveloperCalibrationHistoryItem[]
  calibrationItems: EvaluationTrace[]
  developerPrompts: DeveloperPromptsResponse | null
  language: Language
  loading: boolean
  running: boolean
  runSettings: DeveloperRunSettings
  selectedCalibrationBatchId: string
  onRunCalibration: () => void
  onRunSettingsChange: (settings: Partial<DeveloperRunSettings>) => void
  onSelectCalibrationRun: (batchId: string) => void
}) {
  const defaults = developerPrompts?.defaults
  const promptItems = developerPrompts?.items || []
  const judgeOptions = buildPromptVersionOptions(promptItems, "judge", {
    promptText: defaults?.judge_prompt_text || runSettings.judge_prompt_text,
    promptVersion: defaults?.judge_prompt_version || runSettings.judge_prompt_version,
  })
  const judgeModelName = runSettings.judge_model_name || defaults?.judge_model_name || DEFAULT_JUDGE_MODEL_NAME
  const rows = useMemo(() => buildCalibrationCaseRows(calibrationItems), [calibrationItems])
  const summary = useMemo(() => buildCalibrationSummary(calibrationItems), [calibrationItems])
  const [selectedTraceId, setSelectedTraceId] = useState("")
  const selectedTrace = useMemo(
    () => calibrationItems.find((trace) => trace.trace_id === selectedTraceId) || null,
    [calibrationItems, selectedTraceId],
  )
  function selectJudgePrompt(version: string) {
    if (!version) return
    const option = judgeOptions.find((item) => item.value === version)
    const savedJudgeModelName = savedModelIfAvailable(option?.modelName, JUDGE_MODEL_OPTIONS)
    onRunSettingsChange({
      judge_model_name: savedJudgeModelName || judgeModelName,
      judge_prompt_text: option?.promptText || runSettings.judge_prompt_text,
      judge_prompt_version: version,
    })
  }

  function selectCalibrationHistory(batchId: string) {
    setSelectedTraceId("")
    if (batchId) {
      onSelectCalibrationRun(batchId)
    }
  }

  return (
    <section className="grid gap-2 pr-1">
      <div className="rounded-xl border border-border bg-surface-soft p-4">
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(32rem,0.56fr)] xl:items-start">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-caps uppercase text-label">
              <Beaker className="size-4" />
              {tr(language, "Judge calibration")}
            </div>
            <div className="mt-1 text-section-title text-foreground">
              {tr(language, "Test the current judge prompt on seeded known-answer cases.")}
            </div>
            <div className="mt-1 text-sm leading-5 text-muted-foreground">
              {tr(language, "Calibration cases are excluded from reviewer links and study metrics.")}
            </div>
          </div>
          <div className="flex items-center gap-2 justify-self-stretch rounded-lg border border-border bg-card/80 px-2.5 py-1">
            <div className="shrink-0 text-caps uppercase text-label">
              {tr(language, "Calibration history")}
            </div>
            <div className="min-w-0 flex-1">
              {calibrationHistory.length ? (
                <SelectField
                  ariaLabel={tr(language, "Calibration history")}
                  disabled={loading || running}
                  options={calibrationHistory.map((item) => ({
                    label: calibrationHistoryLabel(item, language),
                    value: item.batch_id,
                  }))}
                  placeholder={tr(language, "No saved calibration runs yet")}
                  value={selectedCalibrationBatchId}
                  onChange={selectCalibrationHistory}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-ring bg-surface-soft px-2.5 py-1.5 text-sm font-semibold text-muted-foreground">
                  {tr(language, "No saved calibration runs yet")}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-wrap items-end gap-1.5">
            {summary.cards.map((card) => (
              <RunProgressCard
                key={card.label}
                label={tr(language, card.label)}
                value={card.value}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-end justify-end gap-1.5">
            <SelectField
              className="w-56"
              label={tr(language, "Selected judge version")}
              options={judgeOptions.map((option) => ({
                label: option.label,
                value: option.value,
              }))}
              value={runSettings.judge_prompt_version}
              onChange={selectJudgePrompt}
            />
            <Button
              size="lg"
              className="shadow-primary"
              disabled={loading || running}
              onClick={onRunCalibration}
            >
              {running ? <Loader2 className="animate-spin" /> : <Beaker />}
              {tr(language, "Test judge calibration")}
            </Button>
          </div>
        </div>
      </div>
      {selectedTrace ? (
        <CalibrationCaseDetail
          language={language}
          trace={selectedTrace}
          onBack={() => setSelectedTraceId("")}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-soft shadow-inner">
          {!rows.length ? (
          <div className="m-2 rounded-xl border border-dashed border-ring p-4 text-sm leading-6 text-muted-foreground">
            {tr(language, "Run judge calibration to see whether the selected judge catches known answer failures.")}
          </div>
          ) : (
          <div className="min-w-[72rem]">
            <div className="grid grid-cols-[1.35fr_0.9fr_1.25fr_0.65fr_0.75fr_1.15fr] border-b border-surface-head-border bg-surface-head px-4 py-2.5 text-caps uppercase text-label">
              <div>{tr(language, "Question")}</div>
              <div>{tr(language, "Test case")}</div>
              <div>{tr(language, "Expected judge behavior")}</div>
              <div>{tr(language, "Judge")}</div>
              <div>{tr(language, "Status")}</div>
              <div>{tr(language, "Why failed")}</div>
            </div>
            {rows.map((row) => (
              <button
                key={row.traceId}
                type="button"
                aria-pressed={selectedTraceId === row.traceId}
                className={cn(
                  "grid w-full grid-cols-[1.35fr_0.9fr_1.25fr_0.65fr_0.75fr_1.15fr] items-center border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedTraceId === row.traceId && "bg-surface-soft",
                )}
                onClick={() => setSelectedTraceId((current) => (current === row.traceId ? "" : row.traceId))}
              >
                <div className="min-w-0 pr-4">
                  <div className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                    {row.question}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {row.service}
                  </div>
                </div>
                <StatusText language={language} truncate value={row.faultType} />
                <StatusText value={row.expectedSignal} />
                <StatusText language={language} value={row.actualDecision} />
                <AttentionBadge
                  language={language}
                  tone={row.status === "Calibration passed" ? "ready" : "danger"}
                  value={row.status}
                />
                <StatusText value={row.failureReason} />
              </button>
            ))}
          </div>
          )}
        </div>
      )}
    </section>
  )
}

function calibrationExpectationText(trace: EvaluationTrace, language: Language) {
  const calibration = trace.calibration
  if (!calibration) return `${tr(language, "Expected low criteria")}: -`
  const maxima = new Map<string, number>()
  for (const criterion of calibration.expected_low_criteria || []) {
    maxima.set(criterion, 2)
  }
  for (const [criterion, maxScore] of Object.entries(calibration.expected_criteria_max || {})) {
    if (typeof maxScore === "number") {
      maxima.set(criterion, maxScore)
    }
  }
  if (!maxima.size) return `${tr(language, "Expected low criteria")}: -`
  return `${tr(language, "Expected scores")}: ${Array.from(maxima.entries())
    .map(([criterion, maxScore]) => `${criterion} <= ${maxScore}`)
    .join(", ")}`
}

function CalibrationCaseDetail({
  language,
  onBack,
  trace,
}: {
  language: Language
  onBack: () => void
  trace: EvaluationTrace
}) {
  const calibration = trace.calibration
  const criteria = trace.automated_evaluation.criteria || {}
  const [row] = buildCalibrationCaseRows([trace])
  const diagnosis = buildCalibrationPromptDiagnosis(trace)
  const actualDecision = calibration?.actual_final_decision || trace.automated_evaluation.final_decision || "-"
  const calibrationStatus = row?.status || "Calibration failed"
  const sourceExcerptLabel = buildDeveloperSourceExcerptLabel(
    language,
    trace.retrieval_result.section_name,
  )

  return (
    <SectionCard className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-xl border-border bg-card px-3"
            onClick={onBack}
          >
            <ArrowLeft />
            {tr(language, "Back to calibration cases")}
          </Button>
          <div className="min-w-0">
            <div className="text-section-title text-foreground">
              {tr(language, "Calibration case details")}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {calibration?.calibration_id || trace.trace_id}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <AttentionBadge
            language={language}
            tone={calibrationStatus === "Calibration passed" ? "ready" : "danger"}
            value={calibrationStatus}
          />
          <Badge variant="outline">{tr(language, row?.faultType || calibration?.fault_type || "-")}</Badge>
          <Badge variant="outline">
            {tr(language, "Expected")}: {decisionLabel(language, calibration?.expected_final_decision) || "-"}
          </Badge>
          <Badge variant="outline">
            {tr(language, "Judge")}: {decisionLabel(language, actualDecision)}
          </Badge>
        </div>
      </div>
      <CalibrationExpectationPanel
        expectation={calibrationExpectationText(trace, language)}
        failureReason={row?.failureReason && row.failureReason !== "-" ? row.failureReason : ""}
        language={language}
        note={calibration?.note || ""}
      />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="grid content-start gap-3">
          <InfoColumn label={tr(language, "Question")} value={trace.citizen_question.question_text} density="compact" />
          <InfoColumn
            label={tr(language, "Seeded answer")}
            value={trace.generated_answer.answer_text}
          />
          <InfoColumn label={sourceExcerptLabel}>
            <SourceExcerptText text={trace.retrieval_result.chunk_text} />
          </InfoColumn>
        </div>
        <div className="grid content-start gap-3">
          <JudgeResultPanel
            actualDecision={actualDecision}
            criteria={criteria}
            explanation={trace.automated_evaluation.explanation}
            language={language}
          />
          <PromptSuggestionPanel diagnosis={diagnosis} language={language} />
        </div>
      </div>
    </SectionCard>
  )
}

function CalibrationExpectationPanel({
  expectation,
  failureReason,
  language,
  note,
}: {
  expectation: string
  failureReason: string
  language: Language
  note: string
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-ring bg-surface-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-caps uppercase text-label">
          {tr(language, "Calibration expectation")}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <div className="text-sm leading-6 text-body">{note || "-"}</div>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm leading-6 text-body">
          <div>{expectation}</div>
          {failureReason ? (
            <div className="mt-1 font-semibold text-[color:var(--dashboard-risk-foreground)]">
              {tr(language, "Why failed")}: {failureReason}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function PromptSuggestionPanel({
  diagnosis,
  language,
}: {
  diagnosis: ReturnType<typeof buildCalibrationPromptDiagnosis>
  language: Language
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-surface-soft p-4">
      <div className="text-caps uppercase text-label">
        {tr(language, "Prompt suggestion")}
      </div>
      <div className="grid gap-2">
        <DiagnosisItem label={tr(language, "What happened")} value={diagnosis.whatHappened} />
        <DiagnosisItem label={tr(language, "Prompt area to edit")} value={diagnosis.promptArea} />
        <DiagnosisItem label={tr(language, "Suggested prompt change")} value={diagnosis.nextPromptChange} />
      </div>
    </div>
  )
}

function JudgeResultPanel({
  actualDecision,
  criteria,
  explanation,
  language,
}: {
  actualDecision: string
  criteria: EvaluationTrace["automated_evaluation"]["criteria"]
  explanation: string
  language: Language
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-surface-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-caps uppercase text-label">
          {tr(language, "Judge result")}
        </div>
        <div className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground">
          {tr(language, "Final decision")}: {decisionLabel(language, actualDecision)}
        </div>
      </div>
      <div className="text-sm leading-5 text-muted-foreground">
        {tr(language, "Judge uses six 1-5 criterion scores plus one final decision.")}
      </div>
      <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm leading-6 text-body">
        {explanation || "-"}
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {Object.entries(criteria || {}).map(([key, value]) => (
          <div key={key} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
            <div className="min-w-0 truncate text-sm font-semibold text-foreground">{key}</div>
            <div className="shrink-0 rounded-full bg-surface-soft px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {value?.score ?? "-"} / 5
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DiagnosisItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-caps uppercase text-label">{label}</div>
      <div className="mt-1 text-sm leading-6 text-body">{value || "-"}</div>
    </div>
  )
}

function InfoColumn({
  children,
  density = "normal",
  label,
  value,
}: {
  children?: ReactNode
  density?: "compact" | "normal"
  label: string
  value?: string
}) {
  return (
    <div className={cn(
      "grid content-start gap-1 rounded-lg border border-border bg-surface-soft px-3",
      density === "compact" ? "py-2" : "py-3",
    )}>
      <div className="text-caps uppercase text-label">{label}</div>
      {children || (
        <div className="whitespace-pre-wrap text-sm leading-6 text-body">
          <LinkedText text={value || "-"} />
        </div>
      )}
    </div>
  )
}
