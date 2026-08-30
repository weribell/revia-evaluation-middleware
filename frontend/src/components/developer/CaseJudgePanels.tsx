import { useEffect, useMemo, useState } from "react"
import {
  FileText,
  GitCompareArrows,
  Loader2,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

import type {
  DeveloperPromptsResponse,
  DeveloperRunSettings,
  EvaluationTrace,
  Language,
  RetrievalResult,
} from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SelectField } from "@/components/ui/select-field"
import { DEFAULT_JUDGE_MODEL_NAME } from "./developerPromptOptions"
import { SourceExcerptText } from "@/components/shared/SourceExcerptText"
import { dashboardToneClass } from "@/lib/dashboardTones"
import {
  DetailSection,
  DeveloperPanel,
  InfoBlock,
  RetrievalChunk,
} from "./CaseDeveloperDetails"
import {
  buildDiagnosticCriteriaRows,
  buildJudgeExplanationItems,
  buildPromptVersionOptions,
  buildRequiredComparisonMatrixRows,
  type DiagnosticCriteriaStatus,
  type RequiredComparisonStatus,
} from "./developerLabModel"
import {
  developerSectionLabel as sectionLabel,
  developerTr as tr,
  reviewDecisionLabel,
} from "./developerTraceModel"

function serviceTitle(trace: EvaluationTrace) {
  const title = trace.citizen_question.service_title || trace.service_entry?.title || ""
  return title === "-" ? "" : title
}

export function CaseMaterialPanel({
  language,
  retrievals,
  source,
  trace,
}: {
  language: Language
  retrievals: RetrievalResult[]
  source: RetrievalResult
  trace: EvaluationTrace
}) {
  return (
    <DeveloperPanel icon={<FileText className="size-4" />} title={tr(language, "Question and answer")}>
      <div className="grid min-w-0 gap-4">
        {/* The service title moved here when the worklist dropped its Service
            column, where it was truncated past readability. It follows the same
            "Section · specifier" idiom as the source-excerpt block below. */}
        <InfoBlock
          icon={<MessageSquareText className="size-4" />}
          title={[tr(language, "Question"), serviceTitle(trace)].filter(Boolean).join(" · ")}
          value={trace.citizen_question.question_text}
        />
        <InfoBlock
          icon={<FileText className="size-4" />}
          title={tr(language, "Generated or provided answer")}
          value={trace.generated_answer.answer_text}
        />
        <InfoBlock
          icon={<ShieldCheck className="size-4" />}
          title={`${tr(language, "Source excerpt")} · ${sectionLabel(language, source.section_name)}`}
        >
          <SourceExcerptText text={source.chunk_text} />
        </InfoBlock>
        <DetailSection title={tr(language, "All retrieved sources")}>
          <div className="grid gap-3">
            {retrievals.map((retrieval, index) => (
              <RetrievalChunk
                key={`${retrieval.source_ref}-${retrieval.section_name}-${index}`}
                language={language}
                retrieval={retrieval}
              />
            ))}
          </div>
        </DetailSection>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-section-title text-foreground">
            <FileText className="size-4" />
            {tr(language, "Official source")}
          </div>
          <a
            className="break-all text-sm font-medium text-[color:var(--dashboard-source-foreground)] underline-offset-4 hover:underline"
            href={source.source_ref}
            target="_blank"
            rel="noreferrer"
          >
            {source.source_ref}
          </a>
        </div>
      </div>
    </DeveloperPanel>
  )
}

export function JudgeExplanationPanel({ language, trace }: { language: Language; trace: EvaluationTrace }) {
  const explanations = buildJudgeExplanationItems(trace)

  if (!explanations.length) return null

  return (
    <DeveloperPanel
      icon={<ShieldCheck className="size-4" />}
      title={tr(language, "AI judge explanation")}
    >
      <div className="grid gap-3">
        {explanations.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="rounded-xl border border-border bg-surface-soft p-4"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant={index === 0 ? "secondary" : "outline"}>{item.label}</Badge>
              <Badge variant="outline">
                {tr(language, "Judge decision")}: {reviewDecisionLabel(language, item.decision)}
              </Badge>
              {item.modelName !== "-" ? <Badge variant="secondary">{item.modelName}</Badge> : null}
            </div>
            <div className="text-sm leading-6 text-body">{item.explanation}</div>
          </div>
        ))}
      </div>
    </DeveloperPanel>
  )
}

export function JudgeRerunPanel({
  developerPrompts,
  language,
  rerunning,
  runSettings,
  trace,
  onJudgeRerun,
}: {
  developerPrompts: DeveloperPromptsResponse | null
  language: Language
  rerunning: boolean
  runSettings: DeveloperRunSettings
  trace: EvaluationTrace
  onJudgeRerun: (traceId: string, settings: DeveloperRunSettings) => void
}) {
  const defaultPromptVersion =
    runSettings.judge_prompt_version ||
    trace.automated_evaluation.judge_prompt_version ||
    developerPrompts?.defaults.judge_prompt_version ||
    "rule_judge_v0"
  const defaultPromptText =
    runSettings.judge_prompt_text ||
    trace.automated_evaluation.judge_prompt_text ||
    developerPrompts?.defaults.judge_prompt_text ||
    ""
  const promptOptions = useMemo(
    () =>
      buildPromptVersionOptions(developerPrompts?.items || [], "judge", {
        promptText: defaultPromptText,
        promptVersion: defaultPromptVersion,
      }),
    [defaultPromptText, defaultPromptVersion, developerPrompts?.items],
  )
  const [selectedVersion, setSelectedVersion] = useState(defaultPromptVersion)

  useEffect(() => {
    setSelectedVersion(defaultPromptVersion)
  }, [defaultPromptVersion, trace.trace_id])

  const selectedPrompt = promptOptions.find((item) => item.value === selectedVersion) || promptOptions[0]
  const selectedLooksRuleBased = selectedVersion.startsWith("rule_judge")
  const selectedModelName =
    selectedPrompt?.modelName ||
    (selectedLooksRuleBased ? "rule_based_baseline" : "") ||
    runSettings.judge_model_name ||
    trace.automated_evaluation.judge_model_name ||
    developerPrompts?.defaults.judge_model_name ||
    DEFAULT_JUDGE_MODEL_NAME
  const selectedJudgeMode =
    selectedModelName === "rule_based_baseline" || selectedLooksRuleBased
      ? "rule_based_baseline"
      : "openai_judge_v1"

  function rerunJudge() {
    onJudgeRerun(trace.trace_id, {
      ...runSettings,
      judge_mode: selectedJudgeMode,
      judge_model_name: selectedModelName,
      judge_prompt_text: selectedPrompt?.promptText || defaultPromptText,
      judge_prompt_version: selectedVersion,
    })
  }

  return (
    <DeveloperPanel
      description={tr(
        language,
        "This adds a new judge evaluation to the case history without changing human reviews.",
      )}
      icon={<RefreshCw className="size-4" />}
      title={tr(language, "Rerun with judge prompt")}
    >
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <SelectField
          className="text-sm font-semibold text-foreground"
          label={tr(language, "Judge prompt")}
          options={promptOptions.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
          triggerClassName="h-10 font-medium"
          value={selectedVersion}
          onChange={setSelectedVersion}
        />
        <Button
          size="sm"
          className="h-10 rounded-xl px-3 shadow-primary"
          disabled={rerunning || !selectedPrompt}
          onClick={rerunJudge}
        >
          {rerunning ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {rerunning ? tr(language, "Running judge") : tr(language, "Run judge again")}
        </Button>
      </div>
    </DeveloperPanel>
  )
}

export function RequiredComparisonPanel({ language, trace }: { language: Language; trace: EvaluationTrace }) {
  const rows = buildRequiredComparisonMatrixRows(trace)

  return (
    <DeveloperPanel
      compact
      description={tr(language, "Compares final decisions and source concerns; detailed scores stay below.")}
      icon={<GitCompareArrows className="size-4" />}
      title={tr(language, "Required comparison")}
    >
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div className="min-w-[38rem]">
          <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-surface-head-border bg-surface-head px-3 py-2 text-caps uppercase text-label">
            <div>{tr(language, "Reviewer")}</div>
            <div>{tr(language, "Can it be used?")}</div>
            <div>{tr(language, "Source concern")}</div>
          </div>
          {rows.map((row) => (
            <div
              key={row.reviewerKey}
              className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-border px-3 py-3 last:border-b-0"
            >
              <div className="min-w-0 text-sm font-semibold text-foreground">
                <span>{tr(language, row.reviewerLabel)}</span>
                {row.reviewerBadge ? (
                  <Badge
                    variant="outline"
                    className="ml-2 max-w-full break-words border-ring bg-surface-soft align-middle text-xs text-muted-foreground"
                  >
                    {row.reviewerBadge}
                  </Badge>
                ) : null}
              </div>
              <RequiredComparisonCell
                isJudge={row.reviewerType === "ai"}
                language={language}
                status={row.canUse.status}
                value={row.canUse.value}
              />
              <RequiredComparisonCell
                isJudge={row.reviewerType === "ai"}
                language={language}
                status={row.canVerify.status}
                value={row.canVerify.value}
              />
            </div>
          ))}
        </div>
      </div>
    </DeveloperPanel>
  )
}

function RequiredComparisonCell({
  isJudge,
  language,
  status,
  value,
}: {
  isJudge: boolean
  language: Language
  status: RequiredComparisonStatus
  value: string
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="min-w-0 break-words text-sm text-body">{tr(language, value)}</span>
      {isJudge ? null : <RequiredComparisonBadge language={language} status={status} />}
    </div>
  )
}

export function DiagnosticCriteriaPanel({ language, trace }: { language: Language; trace: EvaluationTrace }) {
  const rows = buildDiagnosticCriteriaRows(trace)

  return (
    <DeveloperPanel
      icon={<ShieldCheck className="size-4" />}
      title={tr(language, "Diagnostic criteria evidence")}
    >
      <div className="mb-3 rounded-xl border border-border bg-surface-soft px-3 py-2 text-sm leading-6 text-body">
        {tr(
          language,
          "Human checklist signals are optional diagnostic evidence, not full 1-5 human scores for every criterion.",
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div className="min-w-[48rem]">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,1.1fr)_minmax(8rem,0.9fr)] gap-3 border-b border-surface-head-border bg-surface-head px-3 py-2 text-caps uppercase text-label">
            <div>{tr(language, "Criterion")}</div>
            <div>{tr(language, "AI judge result")}</div>
            <div>{tr(language, "Human evidence collected")}</div>
            <div>{tr(language, "Interpretation")}</div>
          </div>
          {rows.map((row) => (
            <div
              key={row.criterionKey}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,1.1fr)_minmax(8rem,0.9fr)] gap-3 border-b border-border px-3 py-3 last:border-b-0"
            >
              <div className="min-w-0 text-sm font-semibold text-foreground">
                {tr(language, row.criterionLabel)}
              </div>
              <div className="min-w-0 text-sm text-body">
                <AiCriterionResultList
                  fallbackValue={row.aiResult}
                  items={row.aiResultItems}
                />
              </div>
              <HumanEvidenceList evidence={row.humanEvidenceItems} language={language} />
              <div className="min-w-0">
                <DiagnosticCriteriaBadge language={language} status={row.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </DeveloperPanel>
  )
}

function AiCriterionResultList({
  fallbackValue,
  items,
}: {
  fallbackValue: string
  items: { label: string; value: string }[]
}) {
  if (!items.length) {
    return <div>{fallbackValue}</div>
  }

  return (
    <div className="grid min-w-0 gap-2">
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="min-w-0 rounded-lg border border-border bg-surface-soft px-3 py-2"
        >
          <div className="mb-1 text-caps uppercase text-label break-words">
            {item.label}
          </div>
          <div className="break-words leading-5">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function HumanEvidenceList({
  evidence,
  language,
}: {
  evidence: { reviewerLabel: string; value: string }[]
  language: Language
}) {
  return (
    <div className="grid min-w-0 gap-1.5 text-sm text-body">
      {evidence.map((item, index) => (
        <div
          key={`${item.reviewerLabel || "human"}-${index}`}
          className="min-w-0 rounded-lg border border-border bg-surface-soft px-3 py-2"
        >
          {item.reviewerLabel ? (
            <div className="mb-1 text-caps uppercase text-label">
              {item.reviewerLabel}
            </div>
          ) : null}
          <div className="break-words leading-5">{tr(language, item.value)}</div>
        </div>
      ))}
    </div>
  )
}

function RequiredComparisonBadge({
  language,
  status,
}: {
  language: Language
  status: RequiredComparisonStatus
}) {
  const className =
    status === "match"
      ? dashboardToneClass.ready
      : status === "mismatch"
        ? dashboardToneClass.risk
        : status === "human_disagreement"
          ? dashboardToneClass.human
          : "border-ring bg-surface-soft text-muted-foreground"

  return (
    <Badge variant="outline" className={className}>
      {tr(language, status)}
    </Badge>
  )
}

function DiagnosticCriteriaBadge({
  language,
  status,
}: {
  language: Language
  status: DiagnosticCriteriaStatus
}) {
  const className =
    status === "shared_concern" || status === "human_concern_ai_missed"
      ? dashboardToneClass.risk
      : status === "ai_concern_not_confirmed" || status === "ai_concern_no_human_signal"
        ? dashboardToneClass.judge
        : status === "aligned_positive"
          ? dashboardToneClass.ready
          : status === "human_disagreement"
            ? dashboardToneClass.human
            : "border-ring bg-surface-soft text-muted-foreground"

  return (
    <Badge variant="outline" className={className}>
      {tr(language, diagnosticStatusLabel(status))}
    </Badge>
  )
}

function diagnosticStatusLabel(status: DiagnosticCriteriaStatus) {
  const labels: Record<DiagnosticCriteriaStatus, string> = {
    aligned_positive: "Aligned positive",
    ai_concern_no_human_signal: "AI concern; no human signal",
    ai_concern_not_confirmed: "AI concern not confirmed",
    ai_not_available: "AI evidence missing",
    human_concern_ai_missed: "Human concern AI missed",
    human_disagreement: "Human-human disagreement",
    mixed_or_partial: "Mixed or partial",
    no_human_signal: "No human signal",
    shared_concern: "Shared concern",
  }
  return labels[status]
}
