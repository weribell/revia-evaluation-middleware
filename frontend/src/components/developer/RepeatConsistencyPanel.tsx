import { useState } from "react"
import { ChevronDown, ChevronUp, Repeat } from "lucide-react"

import type {
  Language,
  RepeatConsistencyResponse,
  RepeatConsistencyRun,
  RepeatJudgeStability,
} from "@/types"
import { CollapsibleSection } from "@/components/shared/CollapsibleSection"
import { tr } from "@/components/research/researchText"
import { StatTile, StatTileGrid } from "@/components/ui/stat-tile"
import { flippedCriteriaBadges } from "./repeatConsistencyModel"
import { semanticToneClasses, statusTone } from "./shared/developerToneClasses"
import { cn } from "@/lib/utils"

type RunExplanations = NonNullable<RepeatConsistencyResponse["cases"][number]["run_explanations"]>

function RunExplanationPreview({
  explanations,
  language,
}: {
  explanations: RunExplanations
  language: Language
}) {
  const [expanded, setExpanded] = useState(false)
  const canExpand =
    explanations.length > 1 || explanations.some((item) => item.note.length > 150)

  return (
    <div className="mt-0.5 max-w-[16rem] rounded-md border border-border bg-surface-soft px-2 py-1 text-xs leading-4 text-muted-foreground">
      <div className="font-semibold text-body">{tr(language, "Why runs disagree")}</div>
      <div className={cn(!expanded && canExpand && "line-clamp-4")}>
        {explanations.map((item) => (
          <div key={item.decision} className="mt-0.5 break-words [overflow-wrap:anywhere]">
            <span className="font-semibold">{tr(language, item.decision)}:</span>{" "}
            {item.note}
          </div>
        ))}
      </div>
      {canExpand ? (
        <button
          aria-expanded={expanded}
          className="mt-1 inline-flex items-center gap-1 font-semibold text-foreground underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
          onClick={() => setExpanded((value) => !value)}
        >
          {tr(language, expanded ? "Show less" : "Show more")}
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      ) : null}
    </div>
  )
}

function formatRatio(value: number | null | undefined): string {
  if (typeof value !== "number") return "–"
  return `${Math.round(value * 100)}%`
}

function runShortLabel(run: RepeatConsistencyRun, index: number): string {
  const batchId = run.batch_id || ""
  const suffix = batchId.length > 6 ? batchId.slice(-6) : batchId
  return suffix ? `R${index + 1} · ${suffix}` : `R${index + 1}`
}

function DecisionPill({ decision, language }: { decision: string | null; language: Language }) {
  if (!decision) {
    return <span className="text-xs text-muted-foreground">–</span>
  }
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-none",
        semanticToneClasses(statusTone(decision)),
      )}
    >
      {tr(language, decision)}
    </span>
  )
}

const stabilityTone: Record<RepeatJudgeStability, Parameters<typeof semanticToneClasses>[0]> = {
  stable: "ready",
  tie: "judge",
  unstable: "risk",
}

const stabilityLabel: Record<RepeatJudgeStability, string> = {
  stable: "stable",
  tie: "tie",
  unstable: "unstable",
}

function StabilityBadge({
  language,
  stability,
}: {
  language: Language
  stability: RepeatJudgeStability
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-none",
        semanticToneClasses(stabilityTone[stability]),
      )}
    >
      {tr(language, stabilityLabel[stability])}
    </span>
  )
}

export function RepeatConsistencyPanel({
  data,
  language,
}: {
  data: RepeatConsistencyResponse
  language: Language
}) {
  const { aggregates, cases, runs } = data
  const majority = aggregates.majority_vs_human

  return (
    <CollapsibleSection
      contentClassName="grid gap-3"
      icon={<Repeat className="size-4" />}
      title={tr(language, "Repeat-run judge consistency")}
    >
      <p className="rounded-lg border border-border bg-surface-soft px-3 py-2.5 text-sm leading-6 text-muted-foreground">
        {tr(
          language,
          "When the same dataset is judged several times, cases where the AI judge disagrees with itself across repeat runs are a disagreement signal — like an AI-human mismatch — and are routed to human review.",
        )}
      </p>

      <StatTileGrid>
        <StatTile label={tr(language, "Repeat runs")} value={aggregates.run_count} />
        <StatTile
          label={tr(language, "Stable across all runs")}
          value={`${aggregates.cases_stable_across_all_runs}/${aggregates.case_count}`}
        />
        <StatTile label={tr(language, "Ties")} value={aggregates.tie_count} />
        <StatTile
          detail={`${majority.matches}/${majority.comparable_cases} ${tr(language, "comparable cases")}`}
          label={tr(language, "Majority vs human agreement")}
          value={formatRatio(majority.match_rate)}
        />
      </StatTileGrid>

      {aggregates.route_to_human_count > 0 ? (
        <div className="rounded-lg border border-[color:var(--dashboard-judge-border)] bg-[var(--dashboard-judge)] px-3 py-2.5 text-sm font-medium text-[color:var(--dashboard-judge-foreground)]">
          {aggregates.route_to_human_count} {tr(language, "case(s) routed to human review because the judge was not stable.")}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-surface-head-border bg-surface-head text-caps uppercase text-label">
              <th className="px-3 py-2 font-semibold">{tr(language, "Case")}</th>
              {runs.map((run, index) => (
                <th key={run.batch_id || index} className="px-2 py-2 font-semibold">
                  {runShortLabel(run, index)}
                </th>
              ))}
              <th className="px-2 py-2 font-semibold">{tr(language, "Majority")}</th>
              <th className="px-2 py-2 font-semibold">{tr(language, "Human")}</th>
              <th className="px-2 py-2 font-semibold">{tr(language, "Stability")}</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((entry) => (
              <tr
                key={entry.case_id}
                className={cn(
                  "border-b border-border align-top last:border-b-0",
                  entry.route_to_human && "bg-[var(--dashboard-judge)]",
                )}
              >
                <td className="px-3 py-2">
                  <div className="line-clamp-2 max-w-[16rem] text-sm font-medium leading-5 text-foreground">
                    {entry.question || entry.case_id}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {entry.case_id}
                  </div>
                </td>
                {entry.decisions.map((decision, index) => (
                  <td key={index} className="px-2 py-2">
                    <DecisionPill decision={decision} language={language} />
                  </td>
                ))}
                <td className="px-2 py-2">
                  {entry.tie ? (
                    <span className="inline-flex items-center rounded-full border border-[color:var(--dashboard-judge-border)] bg-[var(--dashboard-judge)] px-2 py-0.5 text-xs font-semibold leading-none text-[color:var(--dashboard-judge-foreground)]">
                      {tr(language, "tie")}
                    </span>
                  ) : (
                    <DecisionPill decision={entry.majority_decision} language={language} />
                  )}
                </td>
                <td className="px-2 py-2">
                  <DecisionPill decision={entry.human_decision} language={language} />
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-col items-start gap-1">
                    <StabilityBadge language={language} stability={entry.judge_stability} />
                    {entry.route_to_human ? (
                      <span className="inline-flex items-center rounded-full border border-[color:var(--dashboard-judge-border)] bg-[var(--dashboard-judge)] px-2 py-0.5 text-xs font-semibold leading-none text-[color:var(--dashboard-judge-foreground)]">
                        {tr(language, "→ human review")}
                      </span>
                    ) : null}
                    {flippedCriteriaBadges(entry).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {flippedCriteriaBadges(entry).map((badge) => (
                          <span
                            key={badge.key}
                            className="inline-flex items-center rounded-full border border-border bg-surface-soft px-2 py-0.5 text-xs font-medium leading-none text-muted-foreground"
                          >
                            {tr(language, badge.label)} {badge.minScore}→{badge.maxScore}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {(entry.run_explanations ?? []).length > 0 ? (
                      <RunExplanationPreview
                        explanations={entry.run_explanations ?? []}
                        language={language}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  )
}
