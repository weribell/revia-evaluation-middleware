import { type ReactNode } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileJson,
} from "lucide-react"

import type { Language } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { CollapsibleSection } from "@/components/shared/CollapsibleSection"
import {
  dashboardBannerClass,
  dashboardBannerTextClass,
  dashboardToneClass,
} from "@/lib/dashboardTones"
import { cn } from "@/lib/utils"
import {
  auditEvidenceFields,
  type AuditCaseDetail,
  type AuditTraceabilityRow,
} from "./auditDashboardModel"
import { decisionDisplayValue, displayValue, tr } from "./auditText"
import { JudgeHistoryBadge, StatusBadge } from "./AuditBadges"

export function JudgeHistoryPanel({ detail, language }: { detail: AuditCaseDetail; language: Language }) {
  const initial = detail.judgeHistory[0]
  const latest = detail.judgeHistory.at(-1)
  const evaluationLabel =
    detail.judgeHistory.length === 1 ? tr(language, "evaluation") : tr(language, "evaluations")
  return (
    <section className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-section-title text-body">
          {tr(language, "Judge history & calibration")}
        </h4>
        <div className="flex flex-wrap gap-2">
          <JudgeHistoryBadge language={language} status={detail.judgeHistoryStatus} />
          <Badge variant="outline">
            {detail.judgeHistory.length} {evaluationLabel}
          </Badge>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-soft px-3 py-2 text-sm">
          <div className="text-caps uppercase text-label">
            {tr(language, "Initial judge")}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant="outline">{decisionDisplayValue(language, initial?.decision || "-")}</Badge>
            <Badge variant="outline" className="font-mono">{initial?.promptVersion || "-"}</Badge>
          </div>
          <dl className="mt-2 grid gap-1">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{tr(language, "Model")}</dt>
              <dd className="text-right font-medium font-mono">{initial?.modelName || "-"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{tr(language, "Evaluated")}</dt>
              <dd className="text-right font-medium">{initial?.evaluatedAt || "-"}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg border border-border bg-surface-soft px-3 py-2 text-sm">
          <div className="text-caps uppercase text-label">
            {tr(language, "Latest judge")}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant="outline">{decisionDisplayValue(language, latest?.decision || "-")}</Badge>
            <Badge variant="outline" className="font-mono">{latest?.promptVersion || "-"}</Badge>
          </div>
          <dl className="mt-2 grid gap-1">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{tr(language, "Model")}</dt>
              <dd className="text-right font-medium font-mono">{latest?.modelName || "-"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{tr(language, "Evaluated")}</dt>
              <dd className="text-right font-medium">{latest?.evaluatedAt || "-"}</dd>
            </div>
          </dl>
        </div>
      </div>
      <dl className="grid gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm">
        <div className="grid gap-1 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <dt className="text-muted-foreground">{tr(language, "Decision changed")}</dt>
          <dd className="font-medium text-body sm:text-right">
            {detail.judgeDecisionChanged ? tr(language, "yes") : tr(language, "no")}
          </dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <dt className="text-muted-foreground">{tr(language, "Latest rerun ID")}</dt>
          <dd className="break-words font-medium font-mono text-body [overflow-wrap:anywhere] sm:text-right">
            {latest?.rerunId || "-"}
          </dd>
        </div>
        <div className="grid gap-1 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <dt className="text-muted-foreground">{tr(language, "Calibration context")}</dt>
          <dd className="break-words font-medium text-body [overflow-wrap:anywhere] sm:text-right">
            {detail.calibrationContext}
          </dd>
        </div>
      </dl>
      {detail.judgeHistory.length > 1 ? (
        <div className="grid gap-2">
          {detail.judgeHistory.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-surface-soft px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2 font-semibold text-body">
                <Badge variant="secondary">{item.role}</Badge>
                <Badge variant="outline">{decisionDisplayValue(language, item.decision)}</Badge>
                <Badge variant="outline">{displayValue(language, item.sourceSupport)}</Badge>
                <Badge variant="outline" className="font-mono">{item.schemaVersion}</Badge>
              </div>
              <div className="mt-2 grid gap-1 sm:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">Prompt </span>
                  <span className="font-medium font-mono">{item.promptVersion}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{tr(language, "Model")} </span>
                  <span className="font-medium font-mono">{item.modelName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{tr(language, "Evaluated")} </span>
                  <span className="font-medium">{item.evaluatedAt}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function AuditSignalTile({
  label,
  tone = "quiet",
  value,
}: {
  label: string
  tone?: "danger" | "quiet" | "ready" | "warning"
  value: string
}) {
  // Word values ("not performed", "available") must not take the metric size —
  // only bare counts read as numbers.
  const isNumeric = /^\d+(\/\d+)?$/.test(value)

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border px-[18px] py-4 shadow-card",
        tone === "danger" && "border-tile-negative-border bg-tile-negative",
        tone === "warning" && "border-[color:var(--chip-warn-border)] bg-[var(--chip-warn)]",
        tone === "ready" && "border-tile-positive-border bg-tile-positive",
        tone === "quiet" && "border-border bg-card",
      )}
    >
      <div
        className={cn(
          "break-words text-caps-sm uppercase [overflow-wrap:anywhere]",
          tone === "danger" && "text-tile-negative-label",
          tone === "ready" && "text-tile-positive-label",
          tone === "warning" && "text-[color:var(--chip-warn-foreground)]",
          tone === "quiet" && "text-label",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-1 break-words font-extrabold [overflow-wrap:anywhere]",
          isNumeric ? "text-metric" : "text-[17px] leading-[1.15]",
          tone === "danger" && "text-value-negative",
          tone === "ready" && "text-value-positive",
          (tone === "warning" || tone === "quiet") && "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  )
}

export function EvidenceList({ items, language }: { items: string[]; language: Language }) {
  if (!items.length) {
    return <div className="text-sm text-muted-foreground">{tr(language, "No entries recorded.")}</div>
  }
  return (
    <ul className="grid gap-2 text-sm leading-5 text-body">
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className="min-w-0 break-words rounded-lg border border-border bg-surface-soft px-3 py-2 [overflow-wrap:anywhere]"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

export function DossierSection({
  children,
  defaultOpen = false,
  title,
}: {
  children: ReactNode
  defaultOpen?: boolean
  title: string
}) {
  return (
    <CollapsibleSection defaultOpen={defaultOpen} title={title} variant="compact">
      {children}
    </CollapsibleSection>
  )
}

export function KeyValueGrid({ entries, language }: { entries: [string, string][]; language: Language }) {
  return (
    <dl className="grid gap-2 text-sm [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
      {entries.map(([label, value]) => (
        <div key={label} className="min-w-0 rounded-lg border border-border bg-surface-soft px-3 py-2">
          <dt className="break-words text-caps uppercase text-label [overflow-wrap:anywhere]">
            {tr(language, label)}
          </dt>
          <dd className="mt-1 break-words font-medium font-mono text-body [overflow-wrap:anywhere]">
            {displayValue(language, value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function EvidenceChecklist({
  language,
  missingKeys,
}: {
  language: Language
  missingKeys: string[]
}) {
  return (
    <ul className="grid gap-1.5 text-sm">
      {auditEvidenceFields.map((field) => {
        const present = !missingKeys.includes(field.key)
        return (
          <li
            key={field.key}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
              present ? dashboardToneClass.ready : dashboardToneClass.risk,
            )}
          >
            <span className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">
              {field.label}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-caps uppercase">
              {present ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
              {present ? tr(language, "present") : tr(language, "missing")}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function DetailPanel({
  detail,
  language,
  onExportCaseCsv,
  onExportCaseJson,
  row,
}: {
  detail: AuditCaseDetail | null
  language: Language
  onExportCaseCsv: (detail: AuditCaseDetail) => void
  onExportCaseJson: (detail: AuditCaseDetail) => void
  row: AuditTraceabilityRow | null
}) {
  if (!detail) {
    return (
      <EmptyState className="rounded-3xl p-4 leading-5">
        {tr(
          language,
          "Select a trace to reconstruct the source, generated answer, automated judgment, human oversight, versions, and evidence gaps.",
        )}
      </EmptyState>
    )
  }

  const aiHumanMismatch =
    row?.humanDecision !== "pending" &&
    row?.aiDecision !== "pending" &&
    !row?.humanDecision.split("; ").includes(row.aiDecision)
  const statusTone =
    detail.finalAuditStatus === "complete_evidence"
      ? "ready"
      : detail.finalAuditStatus === "missing_evidence" || detail.hasHumanHumanMismatch
        ? "danger"
        : "warning"
  const evidenceGapTone =
    detail.evidenceGapLabels.length === 0
      ? "ready"
      : detail.finalAuditStatus === "pending_review"
        ? "warning"
        : "danger"
  const claimCount = detail.unsupportedClaims.length + detail.contradictedClaims.length

  return (
    <aside className="grid max-h-[44rem] min-w-0 gap-3 overflow-y-auto overflow-x-hidden rounded-3xl border border-border bg-card p-3 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-panel-title text-foreground">{detail.serviceTitle}</h3>
        <StatusBadge language={language} status={detail.finalAuditStatus} />
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
        <AuditSignalTile
          label={tr(language, "Status")}
          tone={statusTone}
          value={displayValue(language, detail.finalAuditStatus)}
        />
        <AuditSignalTile
          label={tr(language, "Evidence gaps")}
          tone={evidenceGapTone}
          value={
            detail.evidenceGapLabels.length
              ? detail.evidenceGapLabels.map((label) => tr(language, label)).join(", ")
              : tr(language, "Complete")
          }
        />
        <AuditSignalTile
          label={tr(language, "Claims")}
          tone={claimCount ? "warning" : "ready"}
          value={String(claimCount)}
        />
        <AuditSignalTile
          label={tr(language, "AI-human mismatch")}
          tone={aiHumanMismatch ? "warning" : "ready"}
          value={aiHumanMismatch ? tr(language, "yes") : tr(language, "no")}
        />
        <AuditSignalTile
          label={tr(language, "Human-human mismatch")}
          tone={detail.hasHumanHumanMismatch ? "danger" : "ready"}
          value={detail.hasHumanHumanMismatch ? tr(language, "yes") : tr(language, "no")}
        />
        <AuditSignalTile
          label={tr(language, "Source check")}
          tone={row?.missingEvidenceStatus === "source check not performed" ? "warning" : "ready"}
          value={
            row?.missingEvidenceStatus === "source check not performed"
              ? tr(language, "not performed")
              : tr(language, "available")
          }
        />
      </div>

      <DossierSection defaultOpen title={tr(language, "Identifiers & versions")}>
        <section className="grid gap-2">
          <h4 className="text-section-title text-body">{tr(language, "Audit identifiers")}</h4>
          <KeyValueGrid entries={detail.auditIdentifiers} language={language} />
        </section>
        <section className="grid gap-2">
          <h4 className="text-section-title text-body">{tr(language, "Prompt/model versions")}</h4>
          <KeyValueGrid entries={detail.promptModelVersions} language={language} />
        </section>
        <JudgeHistoryPanel detail={detail} language={language} />
        <section className="grid gap-2">
          <h4 className="text-section-title text-body">{tr(language, "Timestamps")}</h4>
          <dl className="grid gap-1 text-sm">
            {detail.timestamps.map(([label, value]) => (
              <div key={label} className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <dt className="text-muted-foreground">{tr(language, label)}</dt>
                <dd className="break-words font-medium text-body [overflow-wrap:anywhere] sm:text-right">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </DossierSection>

      <DossierSection title={tr(language, "Source & answer")}>
        <section className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-section-title text-body">
              {detail.sourceKind === "document"
                ? tr(language, "Source document")
                : tr(language, "Official source URL")}
            </h4>
            {detail.sourceKind === "url" ? (
              <a
                className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--dashboard-source-foreground)] underline-offset-4 hover:underline"
                href={detail.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                {tr(language, "Open")} <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
          <div className="min-w-0 break-all rounded-lg border border-border bg-surface-soft px-3 py-2 font-mono text-sm leading-5 [overflow-wrap:anywhere]">
            {detail.sourceReference}
          </div>
        </section>
        <section className="grid gap-2">
          <h4 className="text-section-title text-body">{tr(language, "Retrieved excerpt")}</h4>
          <p className="min-w-0 break-words rounded-lg border border-border bg-surface-soft px-3 py-2 text-sm leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]">
            {detail.retrievedExcerpt}
          </p>
        </section>
        <section className="grid gap-2">
          <h4 className="text-section-title text-body">{tr(language, "Citizen question")}</h4>
          <p className="min-w-0 break-words rounded-lg border border-border bg-surface-soft px-3 py-2 text-sm leading-5 [overflow-wrap:anywhere]">
            {detail.question}
          </p>
        </section>
        <section className="grid gap-2">
          <h4 className="text-section-title text-body">{tr(language, "Generated answer")}</h4>
          <p className="min-w-0 break-words rounded-lg border border-border bg-surface-soft px-3 py-2 text-sm leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]">
            {detail.answer}
          </p>
        </section>
      </DossierSection>

      <DossierSection title={tr(language, "Decisions")}>
        <section className="grid gap-2">
          <h4 className="text-section-title text-body">
            {tr(language, "Automated judge decision and explanation")}
          </h4>
          <div className="min-w-0 rounded-lg border border-border bg-surface-soft px-3 py-2 text-sm leading-5">
            <Badge variant="outline" className="mb-2">
              {decisionDisplayValue(language, detail.judgeDecision)}
            </Badge>
            <p className="break-words [overflow-wrap:anywhere]">{detail.aiExplanation}</p>
          </div>
        </section>
        <section className="grid gap-2">
          <h4 className="text-section-title text-body">{tr(language, "Human reviewer decisions")}</h4>
          {detail.hasHumanHumanMismatch ? (
            <div
              className={cn(
                "rounded-2xl border px-3 py-2.5 text-[14.5px] font-semibold leading-[1.55]",
                dashboardBannerClass.human,
                dashboardBannerTextClass.human,
              )}
            >
              {tr(language, "Human-human mismatch: reviewer decisions or source-support checks disagree.")}
            </div>
          ) : null}
          {detail.humanReviews.length ? (
            <div className="grid gap-2">
              {detail.humanReviews.map((review) => (
                <div
                  key={`${review.reviewerId}-${review.submittedAt}`}
                  className="rounded-lg border border-border bg-surface-soft px-3 py-2 text-sm leading-5"
                >
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-body">
                    <span>{review.reviewerId}</span>
                    {review.excluded ? (
                      <Badge variant="outline" className="border-border bg-surface-soft text-muted-foreground">
                        {tr(language, "excluded")}
                      </Badge>
                    ) : null}
                    <Badge variant="outline">{decisionDisplayValue(language, review.decision)}</Badge>
                    <Badge variant="outline">{displayValue(language, review.sourceSupport)}</Badge>
                  </div>
                  {review.comment ? <p className="mt-2">{review.comment}</p> : null}
                  {review.suggestedCorrection ? (
                    <p className="mt-2 text-muted-foreground">{review.suggestedCorrection}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{tr(language, "No human review recorded.")}</div>
          )}
        </section>
        {detail.adjudicationReview ? (
          <section className="grid gap-2">
            <h4 className="text-section-title text-body">
              {tr(language, "Reviewer conflict resolution")}
            </h4>
            <div className="rounded-lg border border-border bg-surface-soft px-3 py-2 text-sm leading-5">
              <div className="flex flex-wrap items-center gap-2 font-semibold text-body">
                <span>{detail.adjudicationReview.reviewerId}</span>
                <Badge variant="outline">{displayValue(language, detail.adjudicationReview.status)}</Badge>
                <Badge variant="outline">{decisionDisplayValue(language, detail.adjudicationReview.decision)}</Badge>
                <Badge variant="outline">
                  {displayValue(language, detail.adjudicationReview.sourceSupport)}
                </Badge>
              </div>
              {detail.adjudicationReview.comment ? (
                <p className="mt-2">{detail.adjudicationReview.comment}</p>
              ) : null}
              {detail.adjudicationReview.suggestedCorrection ? (
                <p className="mt-2 text-muted-foreground">
                  {detail.adjudicationReview.suggestedCorrection}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
        <section className="grid gap-2">
          <h4 className="text-section-title text-body">
            {tr(language, "Unsupported/contradicted claims")}
          </h4>
          <EvidenceList
            items={[...detail.unsupportedClaims, ...detail.contradictedClaims]}
            language={language}
          />
        </section>
      </DossierSection>

      <DossierSection title={tr(language, "Evidence gaps & export")}>
        <section className="grid gap-2">
          <h4 className="text-section-title text-body">
            {tr(language, "Evidence completeness checklist")}
          </h4>
          <EvidenceChecklist language={language} missingKeys={detail.missingEvidenceKeys} />
        </section>
        <section className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onExportCaseCsv(detail)}>
            <Download className="size-3.5" />
            {tr(language, "Export this case (CSV)")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onExportCaseJson(detail)}>
            <FileJson className="size-3.5" />
            {tr(language, "Export this case (JSON)")}
          </Button>
        </section>
      </DossierSection>
    </aside>
  )
}
