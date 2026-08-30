import { useEffect, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"

import type {
  ImprovementSuggestionSeverity,
  ImprovementSuggestionSource,
  ImprovementSuggestionsResponse,
  Language,
} from "@/types"
import { generateDeveloperImprovementSuggestions, getDeveloperImprovementSuggestions } from "@/api"
import { tr } from "@/components/research/researchText"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PanelHeader } from "@/components/ui/panel-header"
import { SectionCard } from "@/components/ui/section-card"
import { dashboardToneClass } from "@/lib/dashboardTones"
import { cn } from "@/lib/utils"
import type { DeveloperActiveRun } from "./developerLabModel"
import { formatShortMonthDateTime } from "./shared/developerFormatters"
import { RunSelectorBar } from "./shared/RunSelectorBar"
import { SectionEyebrow } from "./shared/SectionEyebrow"
import { semanticToneClasses, type DashboardSemanticTone } from "./shared/developerToneClasses"

function formatGeneratedAt(language: Language, iso: string) {
  return formatShortMonthDateTime(iso, language) || iso
}

function severityTone(severity: ImprovementSuggestionSeverity): DashboardSemanticTone {
  if (severity === "high") return "risk"
  if (severity === "watch") return "neutral"
  return "judge"
}

function severityLabel(severity: ImprovementSuggestionSeverity) {
  if (severity === "high") return "high priority"
  if (severity === "watch") return "watch"
  return "medium priority"
}

function sourceLabel(source: ImprovementSuggestionSource) {
  if (source === "ai_judge") return "AI judge"
  if (source === "human_review") return "Human review"
  return "AI judge + human review"
}

export function ImprovementPanel({
  activeRun,
  batchHistory,
  language,
  loading,
  onSelectBatch,
  selectedBatchId,
}: {
  activeRun: DeveloperActiveRun
  batchHistory: NonNullable<DeveloperActiveRun>[]
  language: Language
  loading: boolean
  onSelectBatch: (batchId: string) => void
  selectedBatchId: string
}) {
  const [data, setData] = useState<ImprovementSuggestionsResponse | null>(null)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState("")
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState("")

  useEffect(() => {
    let cancelled = false
    setFetching(true)
    setFetchError("")
    getDeveloperImprovementSuggestions(selectedBatchId || undefined)
      .then((response) => {
        if (!cancelled) setData(response)
      })
      .catch((error) => {
        if (!cancelled) {
          setData(null)
          setFetchError(error instanceof Error ? error.message : String(error))
        }
      })
      .finally(() => {
        if (!cancelled) setFetching(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedBatchId])

  function handleGenerate() {
    setGenerating(true)
    setGenerateError("")
    generateDeveloperImprovementSuggestions(selectedBatchId || undefined)
      .then((llm) => {
        setData((previous) => (previous ? { ...previous, llm } : previous))
      })
      .catch((error) => {
        setGenerateError(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        setGenerating(false)
      })
  }

  const batchSelector = (
    <RunSelectorBar
      batchHistory={batchHistory}
      disabled={loading || fetching}
      language={language}
      onSelectBatch={onSelectBatch}
      selectedBatchId={selectedBatchId}
    />
  )

  const introLine = (
    <p className="rounded-lg border border-border bg-surface-soft px-3 py-2.5 text-sm leading-5 text-muted-foreground">
      {tr(
        language,
        "Rule-based suggestions derived from judge results and human reviews of this run — evidence, not automation.",
      )}
    </p>
  )

  if (!activeRun && !batchHistory.length) {
    return (
      <div className="mt-2 grid gap-4 px-1 pb-1">
        {batchSelector}
        {introLine}
        <EmptyState className="px-4 py-6">
          {tr(
            language,
            "No saved evaluation runs yet. Create a test or demo run in Developer Lab first.",
          )}
        </EmptyState>
      </div>
    )
  }

  const hasRun = Boolean(data?.batch_id)

  return (
    <div className="mt-2 grid min-w-0 gap-4 px-1 pb-1">
      {batchSelector}
      {introLine}
      {fetchError ? (
        <div className={cn("rounded-xl border px-4 py-3 text-sm", dashboardToneClass.error)}>
          {tr(language, "Could not load improvement suggestions.")} ({fetchError})
        </div>
      ) : null}
      {fetching && !data ? (
        <EmptyState className="flex items-center gap-2 px-4 py-6">
          <Loader2 className="size-4 animate-spin" />
          {tr(language, "Loading suggestions…")}
        </EmptyState>
      ) : null}
      {data && !hasRun ? (
        <EmptyState className="px-4 py-6">
          {tr(
            language,
            "No saved evaluation runs yet. Create a test or demo run in Developer Lab first.",
          )}
        </EmptyState>
      ) : null}
      {data && hasRun ? (
        <SectionEyebrow>
          {data.batch_id ? `${tr(language, "Run")} ${data.batch_id.slice(-8)}` : ""}
          {" · "}
          {data.case_count} {tr(language, "cases")}
        </SectionEyebrow>
      ) : null}
      {data && hasRun ? (
        <SectionCard>
          <PanelHeader
            action={
              <Button
                disabled={generating}
                size="lg"
                className="shadow-primary"
                onClick={handleGenerate}
              >
                {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {generating
                  ? tr(language, "Generating…")
                  : data.llm
                    ? tr(language, "Regenerate")
                    : tr(language, "Generate suggestions")}
              </Button>
            }
            description={tr(
              language,
              "One LLM call summarizes this run's reviewer comments and judge findings into suggestions with case evidence.",
            )}
            title={tr(language, "AI-generated improvement suggestions")}
          />
          {data.llm ? (
            <div className="mt-2 text-sm text-muted-foreground">
              {tr(language, "generated")} {formatGeneratedAt(language, data.llm.generated_at)} · {data.llm.model_name}
            </div>
          ) : null}
          {generateError ? (
            <div className={cn("mt-3 rounded-xl border px-4 py-3 text-sm", dashboardToneClass.error)}>
              {generateError}
            </div>
          ) : null}
          {data.llm?.suggestions.length ? (
            <div className="mt-4 grid gap-2">
              {data.llm.suggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion.title}-${index}`}
                  className="rounded-lg border border-border bg-surface-soft p-3"
                >
                  <div className="text-section-title text-foreground">{suggestion.title}</div>
                  <p className="mt-1.5 text-sm leading-6 text-body">{suggestion.suggestion}</p>
                  {suggestion.evidence_case_ids.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {suggestion.evidence_case_ids.map((caseId) => (
                        <span
                          key={caseId}
                          className="inline-flex items-center rounded-full border border-border bg-card px-2 py-1 text-xs font-medium leading-none text-body"
                        >
                          {caseId}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {suggestion.evidence_quotes.length ? (
                    <ul className="mt-2 grid gap-1">
                      {suggestion.evidence_quotes.map((quote, quoteIndex) => (
                        <li
                          key={quoteIndex}
                          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm leading-5 text-body"
                        >
                          "{quote}"
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </SectionCard>
      ) : null}
      {data && hasRun ? (
        <SectionEyebrow className="mt-1">{tr(language, "Rule-based signals")}</SectionEyebrow>
      ) : null}
      {data && hasRun && !data.cards.length ? (
        <EmptyState className="px-4 py-6">
          {tr(
            language,
            "No improvement signals yet — run the judge or collect reviews first.",
          )}
        </EmptyState>
      ) : null}
      {data?.cards.map((card) => (
        <SectionCard key={card.id}>
          <PanelHeader
            action={
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
                    semanticToneClasses(severityTone(card.severity)),
                  )}
                >
                  {tr(language, severityLabel(card.severity))}
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-surface-soft px-2.5 py-1 text-xs font-medium leading-none text-body">
                  {tr(language, sourceLabel(card.source))}
                </span>
              </div>
            }
            title={tr(language, card.title)}
          />
          <p className="mt-3 text-sm leading-6 text-body">{tr(language, card.suggestion)}</p>
          <div className="mt-2 text-sm text-muted-foreground">
            {card.evidence.affected_cases} {tr(language, "of")} {card.evidence.total_cases}{" "}
            {tr(language, "cases problematic")}
            {card.evidence.borderline_cases ? (
              <>
                {" · "}
                {card.evidence.borderline_cases} {tr(language, "borderline")}
              </>
            ) : null}
            {" · "}
            {card.evidence.human_review_signals} {tr(language, "human review signals")}
          </div>
          {card.evidence.example_cases.length ? (
            <ul className="mt-2 grid gap-1">
              {card.evidence.example_cases.map((example) => (
                <li
                  key={example.case_id}
                  className="rounded-md border border-border bg-surface-soft px-2.5 py-1.5 text-sm leading-5 text-body"
                >
                  <span className="font-semibold text-foreground">{example.case_id}</span>
                  {example.note ? <span> — {example.note}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </SectionCard>
      ))}
    </div>
  )
}
