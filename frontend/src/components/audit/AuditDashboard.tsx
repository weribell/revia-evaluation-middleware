import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Download,
  FileJson,
  Filter,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"

import { getDeveloperWorklist } from "@/api"
import type { DeveloperRun, Language } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTableHeader } from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { SelectField } from "@/components/ui/select-field"
import { StatTile, StatTileGrid } from "@/components/ui/stat-tile"
import { Toolbar } from "@/components/ui/toolbar"
import { DashboardBanner } from "@/components/shared/DashboardBanner"
import { downloadFile, toCsv } from "@/components/shared/exportUtils"
import { RunIssueNoticeBanner } from "@/components/shared/RunIssueNoticeBanner"
import { buildRunIssueNotice } from "@/components/shared/runIssueNotice"
import {
  dashboardBannerShade,
  dashboardToneClass,
  type DashboardTone,
} from "@/lib/dashboardTones"
import { cn } from "@/lib/utils"
import {
  auditFilters,
  buildAuditDashboardModel,
  buildAuditExportRows,
  filterAuditRows,
  type AuditCaseDetail,
  type AuditFilter,
} from "./auditDashboardModel"
import {
  batchOptionLabel,
  decisionDisplayValue,
  decisionListDisplayValue,
  filterOptionLabel,
  tr,
} from "./auditText"
import { EvidenceGapBadges, JudgeHistoryBadge, StatusBadge } from "./AuditBadges"
import { DetailPanel, DossierSection } from "./AuditCaseDossier"

// Declared once and handed both to DataTable (header) and to the clickable
// rows below, so a column width fix cannot land on only one of the two.
const auditTriageColumns = "1.45fr 0.55fr 0.65fr 0.8fr 0.85fr 1.05fr 0.85fr"

function ReconstructabilityHeader({
  completeness,
  language,
}: {
  completeness: ReturnType<typeof buildAuditDashboardModel>["completeness"]
  language: Language
}) {
  const total = completeness.totalTraces
  const fullDecisionEvidence = completeness.withCompleteDecisionEvidence
  const allComplete = fullDecisionEvidence === total && total > 0
  const hasTechnicalGaps = completeness.withTechnicalMissingEvidence > 0
  const humanReviewPending =
    !hasTechnicalGaps &&
    completeness.withPendingHumanReview > 0 &&
    completeness.withCompleteAutomatedTrace === total
  const Icon = allComplete || humanReviewPending ? CheckCircle2 : ShieldAlert
  const tone: DashboardTone = allComplete ? "ready" : humanReviewPending ? "judge" : "risk"
  const shade = dashboardBannerShade[tone]
  return (
    <DashboardBanner
      ariaLabel="Reconstructability summary"
      body={
        <>
          {fullDecisionEvidence}/{total} {tr(language, "full decisions have complete audit evidence")}
        </>
      }
      eyebrow={
        humanReviewPending
          ? tr(language, "Automated evaluation trace complete - human review pending")
          : tr(language, "Can every decision be reconstructed?")
      }
      icon={Icon}
      pill={
        allComplete
          ? tr(language, "Every decision has complete evidence for reconstruction.")
          : humanReviewPending
            ? tr(
                language,
                "The automated evaluation trace is complete; full decision evidence still needs human review.",
              )
            : `${completeness.withTechnicalMissingEvidence || completeness.withMissingEvidence} ${tr(
                language,
                hasTechnicalGaps
                  ? "Technical trace evidence is missing."
                  : "still missing evidence for full reconstruction",
              )}`
      }
      title={
        <>
          <span className={shade.accent}>
            {completeness.withCompleteAutomatedTrace}/{total}
          </span>{" "}
          {tr(language, "Automated evaluation trace completeness")}
        </>
      }
      tone={tone}
    />
  )
}

export function AuditDashboard({ language }: { language: Language }) {
  const [activeFilter, setActiveFilter] = useState<AuditFilter>("all")
  const [batchHistory, setBatchHistory] = useState<DeveloperRun[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState("")
  const [selectedTraceId, setSelectedTraceId] = useState("")
  const [worklist, setWorklist] = useState<Awaited<ReturnType<typeof getDeveloperWorklist>> | null>(null)

  const loadAuditRun = useCallback(async (batchId?: string) => {
    setLoading(true)
    setError("")
    try {
      const response = await getDeveloperWorklist(batchId)
      setWorklist(response)
      setBatchHistory(response.batch_history || [])
      setSelectedBatchId(response.active_run?.batch_id || "")
      setSelectedTraceId((current) => current || response.items[0]?.trace_id || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : tr(language, "Could not load audit dashboard"))
    } finally {
      setLoading(false)
    }
  }, [language])

  useEffect(() => {
    loadAuditRun().catch(() => undefined)
  }, [loadAuditRun])

  const model = useMemo(
    () =>
      buildAuditDashboardModel({
        activeRun: worklist?.active_run || null,
        traces: worklist?.items || [],
      }),
    [worklist],
  )
  const filteredRows = useMemo(
    () => filterAuditRows(model.rows, activeFilter),
    [activeFilter, model.rows],
  )
  const selectedDetail =
    model.caseDetails.find((detail) => detail.traceId === selectedTraceId) || model.caseDetails[0] || null
  const selectedRow =
    model.rows.find((row) => row.traceId === selectedDetail?.traceId) || model.rows[0] || null
  const filteredDetails = model.caseDetails.filter((detail) =>
    filteredRows.some((row) => row.traceId === detail.traceId),
  )
  const total = model.completeness.totalTraces
  const runIssueNotice = useMemo(
    () => buildRunIssueNotice(worklist?.active_run || null, language),
    [worklist?.active_run, language],
  )

  function jsonEnvelope(cases: AuditCaseDetail[]) {
    return JSON.stringify(
      {
        evidence_package_metadata: {
          active_filter: activeFilter,
          evidence_schema_version: "audit-evidence-v2",
          exported_at: new Date().toISOString(),
          selected_batch_id: selectedBatchId || "-",
        },
        run_metadata: model.runMetadata,
        cases,
      },
      null,
      2,
    )
  }

  function exportRunCsv() {
    downloadFile(
      `${selectedBatchId || "audit-run"}-audit-evidence.csv`,
      "text/csv;charset=utf-8",
      toCsv(buildAuditExportRows(model.caseDetails)),
    )
  }

  function exportFilteredCsv() {
    downloadFile(
      `${selectedBatchId || "audit-run"}-${activeFilter}.csv`,
      "text/csv;charset=utf-8",
      toCsv(buildAuditExportRows(filteredDetails)),
    )
  }

  function exportFullJson() {
    downloadFile(
      `${selectedBatchId || "audit-run"}-full-evidence.json`,
      "application/json;charset=utf-8",
      jsonEnvelope(model.caseDetails),
    )
  }

  function exportCaseCsv(detail: AuditCaseDetail) {
    downloadFile(
      `${selectedBatchId || "audit-run"}-${detail.traceId}.csv`,
      "text/csv;charset=utf-8",
      toCsv(buildAuditExportRows([detail])),
    )
  }

  function exportCaseJson(detail: AuditCaseDetail) {
    downloadFile(
      `${selectedBatchId || "audit-run"}-${detail.traceId}.json`,
      "application/json;charset=utf-8",
      jsonEnvelope([detail]),
    )
  }

  return (
    <section className="grid min-h-[38rem] gap-3">
      <Toolbar>
        <div className="flex items-center gap-2 text-section-title text-foreground">
          <ShieldCheck className="size-4 text-body" />
          {tr(language, "Selected run")}
        </div>
        <div className="flex min-w-[18rem] max-w-full flex-wrap items-center justify-end gap-2">
          <SelectField
            disabled={loading || !batchHistory.length}
            options={batchHistory.map((batch) => ({
              label: batchOptionLabel(batch, language),
              value: batch.batch_id,
            }))}
            placeholder={tr(language, "No saved runs yet")}
            triggerClassName="min-w-[16rem]"
            value={selectedBatchId}
            onChange={loadAuditRun}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadAuditRun(selectedBatchId)}
            disabled={loading}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            {tr(language, "Refresh")}
          </Button>
        </div>
      </Toolbar>

      {error ? <RunIssueNoticeBanner notice={error} /> : null}

      {runIssueNotice ? (
        <RunIssueNoticeBanner
          notice={runIssueNotice}
          translate={(value) => tr(language, value)}
        />
      ) : null}

      {!loading && !worklist?.active_run ? (
        <EmptyState className="rounded-2xl bg-card px-4 py-6">
          {tr(
            language,
            "No saved evaluation runs yet. Create a test or demo run in Developer Lab first.",
          )}
        </EmptyState>
      ) : null}

      <ReconstructabilityHeader completeness={model.completeness} language={language} />

      <StatTileGrid>
        <StatTile
          detail={`${tr(language, "URL or identified document")} · ${
            model.completeness.withSourceUrl
          } URL · ${model.completeness.withSourceDocument} ${tr(language, "Document")}`}
          label={tr(language, "Source reference")}
          tone={model.completeness.withSourceReference === total ? "positive" : "negative"}
          value={`${model.completeness.withSourceReference}/${total}`}
        />
        <StatTile
          detail={tr(language, "Final decision and supporting evidence recorded")}
          label={tr(language, "Complete automated judge decision")}
          tone={model.completeness.withAiJudgeResult === total ? "positive" : "negative"}
          value={`${model.completeness.withAiJudgeResult}/${total}`}
        />
        <StatTile
          detail={tr(language, "At least one reviewer decision")}
          label={tr(language, "Full decision evidence")}
          tone={model.completeness.withCompleteDecisionEvidence === total ? "positive" : "negative"}
          value={`${model.completeness.withCompleteDecisionEvidence}/${total}`}
        />
        <StatTile
          detail={tr(language, "Answer and judge versions known")}
          label={tr(language, "Prompt/model metadata")}
          tone={model.completeness.withModelPromptMetadata === total ? "positive" : "negative"}
          value={`${model.completeness.withModelPromptMetadata}/${total}`}
        />
      </StatTileGrid>

      <DossierSection title={tr(language, "Run metadata & full completeness")}>
        <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="grid gap-2 rounded-lg border border-border bg-surface-soft p-3">
            <div className="text-section-title text-foreground">{tr(language, "Run metadata")}</div>
            <dl className="grid gap-1 text-sm">
              {model.runMetadata.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-border py-1 last:border-0">
                  <dt className="text-muted-foreground">{tr(language, label)}</dt>
                  <dd className="max-w-[14rem] truncate text-right font-medium text-body" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <StatTileGrid columns={2}>
            <StatTile
              detail={tr(language, "Retrieved evidence excerpt exists")}
              label={tr(language, "Retrieved excerpt")}
              tone={model.completeness.withRetrievedExcerpt === total ? "positive" : "negative"}
              value={`${model.completeness.withRetrievedExcerpt}/${total}`}
            />
            <StatTile
              detail={tr(language, "Answer text is available")}
              label={tr(language, "Generated answer")}
              tone={model.completeness.withGeneratedAnswer === total ? "positive" : "negative"}
              value={`${model.completeness.withGeneratedAnswer}/${total}`}
            />
            <StatTile
              detail={tr(language, "Cases requiring adjudication")}
              label={tr(language, "Human-human mismatch")}
              tone={model.completeness.withHumanHumanMismatch === total ? "positive" : "negative"}
              value={`${model.completeness.withHumanHumanMismatch}/${total}`}
            />
            <StatTile
              detail={tr(language, "Cases waiting for human review")}
              label={tr(language, "Pending human review")}
              tone={model.completeness.withPendingHumanReview === total ? "positive" : "negative"}
              value={`${model.completeness.withPendingHumanReview}/${total}`}
            />
          </StatTileGrid>
        </div>
      </DossierSection>

      <Toolbar>
        <div className="flex items-center gap-2 text-section-title text-foreground">
          <Filter className="size-4 text-body" />
          {tr(language, "Audit triage table")}
          <Badge variant="outline">{filteredRows.length}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectField
            options={auditFilters.map((filter) => ({
              label: filterOptionLabel(language, filter),
              value: filter,
            }))}
            triggerClassName="w-auto min-w-[11rem]"
            value={activeFilter}
            onChange={(value) => setActiveFilter(value as AuditFilter)}
          />
          <Button size="sm" variant="outline" onClick={exportRunCsv} disabled={!model.caseDetails.length}>
            <Download className="size-3.5" />
            {tr(language, "Download run CSV")}
          </Button>
          <Button size="sm" variant="outline" onClick={exportFilteredCsv} disabled={!filteredDetails.length}>
            <Download className="size-3.5" />
            {tr(language, "Download filtered CSV")}
          </Button>
          <Button size="sm" variant="outline" onClick={exportFullJson} disabled={!model.caseDetails.length}>
            <FileJson className="size-3.5" />
            {tr(language, "Download full JSON")}
          </Button>
        </div>
      </Toolbar>

      <div className="grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1.35fr)_minmax(24rem,0.8fr)]">
        <DataTable className="overflow-hidden" columns={auditTriageColumns}>
          <DataTableHeader className="gap-0 px-3 py-2">
            <div>{tr(language, "Service")}</div>
            <div>{tr(language, "Source ok?")}</div>
            <div>{tr(language, "Automated result")}</div>
            <div>{tr(language, "Human decision")}</div>
            <div>{tr(language, "Judge history")}</div>
            <div>{tr(language, "Evidence gaps")}</div>
            <div>{tr(language, "Audit status")}</div>
          </DataTableHeader>
          {filteredRows.map((row) => (
            // A clickable row cannot go through DataTableRow, which takes no
            // interaction props, so the row markup stays here and reads the
            // column template from the same constant DataTable is given.
            <div
              key={row.traceId}
              role="button"
              tabIndex={0}
              className={cn(
                "grid w-full cursor-pointer items-center border-b border-row-border bg-card px-3 py-3 text-left text-sm hover:bg-surface-soft",
                row.traceId === selectedDetail?.traceId && "bg-surface-soft",
              )}
              style={{ gridTemplateColumns: auditTriageColumns }}
              onClick={() => setSelectedTraceId(row.traceId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  setSelectedTraceId(row.traceId)
                }
              }}
            >
              <div className="truncate pr-2 text-body">{row.serviceTitle}</div>
              <div className="pr-2">
                <Badge
                  variant="outline"
                  className={cn(
                    row.sourceKind === "url"
                      ? dashboardToneClass.ready
                      : row.sourceKind === "document"
                        ? dashboardToneClass.source
                        : dashboardToneClass.risk,
                  )}
                >
                  {row.sourceKind === "url"
                    ? tr(language, "URL")
                    : row.sourceKind === "document"
                      ? tr(language, "Document")
                      : tr(language, "missing")}
                </Badge>
              </div>
              <div className="truncate pr-2">{decisionDisplayValue(language, row.aiDecision)}</div>
              <div className="truncate pr-2">{decisionListDisplayValue(language, row.humanDecision)}</div>
              <div className="pr-2">
                <JudgeHistoryBadge language={language} status={row.judgeHistoryStatus} />
              </div>
              <div className="pr-2">
                <EvidenceGapBadges language={language} row={row} />
              </div>
              <div>
                <StatusBadge language={language} status={row.finalAuditStatus} />
              </div>
            </div>
          ))}
          {!filteredRows.length ? (
            <EmptyState className="m-4 text-center">
              {tr(language, "No cases match this audit filter.")}
            </EmptyState>
          ) : null}
        </DataTable>

        <DetailPanel
          detail={selectedDetail}
          language={language}
          onExportCaseCsv={exportCaseCsv}
          onExportCaseJson={exportCaseJson}
          row={selectedRow}
        />
      </div>
    </section>
  )
}
