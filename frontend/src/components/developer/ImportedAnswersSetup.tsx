import { AlertCircle, FlaskConical, ListFilter, Loader2, X } from "lucide-react"
import type { ChangeEvent, DragEvent } from "react"
import { useEffect, useMemo, useState } from "react"

import { developerTr as tr } from "./developerTraceModel"
import {
  parseImportedAnswerCsv,
  validateImportedAnswerRows,
  type ImportedAnswerRecord,
  type ImportedAnswerValidationResult,
} from "./importedAnswerImport"
import { formatBatchDate } from "./shared/developerFormatters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ImportedDataset, Language } from "@/types"

export function ImportedAnswersSetupPanel({
  datasets,
  language,
  loading,
  running,
  onDeleteDataset,
  onOpenImportDialog,
  onRunDataset,
}: {
  datasets: ImportedDataset[]
  language: Language
  loading: boolean
  running: boolean
  onDeleteDataset: (importId: string) => Promise<void>
  onOpenImportDialog: () => void
  onRunDataset: (importId: string) => Promise<void>
}) {
  const [selectedImportId, setSelectedImportId] = useState(datasets[0]?.import_id || "")
  const [viewDataset, setViewDataset] = useState<ImportedDataset | null>(null)
  const [deletingImportId, setDeletingImportId] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const activeDatasets = useMemo(
    () => datasets.filter((dataset) => dataset.status !== "archived"),
    [datasets],
  )
  const archivedCount = datasets.length - activeDatasets.length
  const visibleDatasets = useMemo(
    () => (showArchived ? datasets : activeDatasets),
    [activeDatasets, datasets, showArchived],
  )
  const selectedDataset = visibleDatasets.find((dataset) => dataset.import_id === selectedImportId) || visibleDatasets[0] || null

  useEffect(() => {
    if (!visibleDatasets.length) {
      setSelectedImportId("")
      return
    }
    if (!selectedImportId || !visibleDatasets.some((dataset) => dataset.import_id === selectedImportId)) {
      setSelectedImportId(visibleDatasets[0].import_id)
    }
  }, [selectedImportId, visibleDatasets])

  async function deleteDataset(importId: string) {
    setDeletingImportId(importId)
    try {
      await onDeleteDataset(importId)
    } finally {
      setDeletingImportId("")
    }
  }

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(16rem,1fr)] gap-3 rounded-xl border border-border bg-surface-soft p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-section-title text-foreground">
            {tr(language, "Imported data")}
          </div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            {selectedDataset
              ? tr(language, "Choose a saved dataset, adjust judge settings, then create a new evaluation run.")
              : tr(language, "Import external question-answer data once, then reuse it for multiple judge runs.")}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 rounded-xl border-border bg-card px-2.5 text-xs shadow-sm"
          onClick={onOpenImportDialog}
          disabled={loading}
        >
          <ListFilter />
          {tr(language, "Import CSV")}
        </Button>
      </div>

      {visibleDatasets.length ? (
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-1.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="text-caps uppercase text-label">
              {tr(language, "Existing imported data")}
            </div>
            {archivedCount ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 rounded-lg px-2 text-xs text-muted-foreground"
                onClick={() => setShowArchived((current) => !current)}
              >
                {showArchived ? tr(language, "Hide archived") : `${tr(language, "Show archived")} (${archivedCount})`}
              </Button>
            ) : null}
          </div>
          <div className="min-h-0 overflow-auto rounded-xl border border-border bg-card">
            {visibleDatasets.map((dataset) => {
              const selected = selectedDataset?.import_id === dataset.import_id
              const deleting = deletingImportId === dataset.import_id
              const archived = dataset.status === "archived"

              return (
                <div
                  key={dataset.import_id}
                  className={cn(
                    "grid gap-2 border-t border-border px-3 py-2 first:border-t-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center",
                    selected && "bg-surface-soft",
                  )}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedImportId(dataset.import_id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      setSelectedImportId(dataset.import_id)
                    }
                  }}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {dataset.filename}
                      </div>
                      <Badge variant={selected ? "default" : "secondary"} className="rounded-full px-2 py-0.5 text-xs">
                        {tr(language, dataset.status)}
                      </Badge>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {formatBatchDate(dataset.created_at, language)} · {dataset.row_count} {tr(language, "cases")} · {dataset.source_context_count} {tr(language, "sources")} · {dataset.human_label_count} {tr(language, "human labels")}
                      {dataset.used_batch_id ? ` · ${tr(language, "used")}` : ""}
                    </div>
                  </div>
                  {selected ? (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg border-border bg-card px-2 text-xs shadow-sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          setViewDataset(dataset)
                        }}
                      >
                        {tr(language, "Preview")}
                      </Button>
                      {!archived ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-lg border-border bg-card px-2 text-xs shadow-sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            deleteDataset(dataset.import_id)
                          }}
                          disabled={loading || deleting}
                        >
                          {deleting ? <Loader2 className="animate-spin" /> : <X />}
                          {tr(language, dataset.used_batch_id ? "Archive" : "Delete")}
                        </Button>
                      ) : null}
                      {!archived ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 rounded-lg px-2 text-xs shadow-primary"
                          onClick={(event) => {
                            event.stopPropagation()
                            onRunDataset(dataset.import_id)
                          }}
                          disabled={loading || running}
                        >
                          {running ? <Loader2 className="animate-spin" /> : <FlaskConical />}
                          {tr(language, "Create run")}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card px-3 py-6 text-center">
          <div className="text-sm font-semibold text-foreground">
            {showArchived ? tr(language, "No archived imported data") : tr(language, "No imported data yet")}
          </div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            {showArchived
              ? tr(language, "Archived imports are kept for traceability when they exist.")
              : tr(language, "Use Import CSV once. Saved data will appear here and can be reused for new runs.")}
          </div>
          {!showArchived && archivedCount ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-2 h-7 rounded-lg px-2 text-xs text-muted-foreground"
              onClick={() => setShowArchived(true)}
            >
              {tr(language, "Show archived")} ({archivedCount})
            </Button>
          ) : null}
        </div>
      )}

      {viewDataset ? (
        <ImportedDatasetRecordsDialog
          dataset={viewDataset}
          language={language}
          onClose={() => setViewDataset(null)}
        />
      ) : null}
    </section>
  )
}

function ImportedDatasetRecordsDialog({
  dataset,
  language,
  onClose,
}: {
  dataset: ImportedDataset
  language: Language
  onClose: () => void
}) {
  const records = dataset.records || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 px-4 py-6">
      <section className="grid max-h-[86vh] w-full max-w-5xl gap-3 overflow-auto rounded-3xl border border-border bg-card p-4 shadow-panel">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-foreground">{dataset.filename}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {dataset.row_count} {tr(language, "cases")} · {dataset.human_label_count} {tr(language, "human labels")}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-full p-0"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(9rem,0.6fr)] bg-surface-head px-3 py-2 text-caps uppercase text-label">
            <div>{tr(language, "Question")}</div>
            <div>{tr(language, "Answer")}</div>
            <div>{tr(language, "Metadata")}</div>
          </div>
          <div className="max-h-[50vh] overflow-auto">
            {records.map((record, index) => (
              <div
                key={`${record.case_id || "record"}-${index}`}
                className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(9rem,0.6fr)] gap-3 border-t border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">
                    {record.question || record.question_text || "-"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {record.case_id || `row_${index + 1}`}
                  </div>
                </div>
                <div className="min-w-0 text-body">
                  <div className="line-clamp-3">{record.answer || record.answer_text || "-"}</div>
                  {record.source_context ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {tr(language, "Source context included")}
                    </div>
                  ) : null}
                </div>
                <div className="grid content-start gap-1 text-xs">
                  <Badge variant="outline" className="w-fit rounded-full bg-card">
                    {record.external_system || "imported_chatbot"}
                  </Badge>
                  {record.human_review ? (
                    <Badge variant="secondary" className="w-fit rounded-full">
                      {tr(language, "Human label")}
                    </Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export function ImportedAnswerDialog({
  language,
  running,
  onClose,
  onImport,
}: {
  language: Language
  running: boolean
  onClose: () => void
  onImport: (filename: string, records: ImportedAnswerRecord[]) => Promise<void>
}) {
  const [fileName, setFileName] = useState("")
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [validation, setValidation] = useState<ImportedAnswerValidationResult>({
    errors: [],
    validRows: [],
    warnings: [],
  })
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [localError, setLocalError] = useState("")

  async function processImportedFile(file: File | undefined) {
    setLocalError("")
    setFileName(file?.name || "")
    if (!file) {
      setParseErrors([])
      setValidation({ errors: [], validRows: [], warnings: [] })
      return
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseErrors([tr(language, "Please upload a CSV file.")])
      setValidation({ errors: [], validRows: [], warnings: [] })
      return
    }
    const text = await file.text()
    const parsed = parseImportedAnswerCsv(text)
    setParseErrors(parsed.errors)
    setValidation(validateImportedAnswerRows(parsed.rows))
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    await processImportedFile(event.currentTarget.files?.[0])
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    if (!running) {
      setIsDraggingFile(true)
    }
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDraggingFile(false)
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDraggingFile(false)
    if (running) return
    await processImportedFile(event.dataTransfer.files?.[0])
  }

  const combinedErrors = [...parseErrors, ...validation.errors]
  const canImport = validation.validRows.length > 0 && combinedErrors.length === 0 && !running
  const previewRows = validation.validRows.slice(0, 5)

  async function submitImport() {
    if (!canImport) return
    setLocalError("")
    try {
      await onImport(fileName || "imported_answers.csv", validation.validRows)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : tr(language, "Could not import chatbot answers"))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 px-4 py-6">
      <section className="grid max-h-[88vh] w-full max-w-4xl gap-3 overflow-auto rounded-3xl border border-border bg-card p-4 shadow-panel">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-foreground">
              {tr(language, "Import chatbot answers")}
            </div>
            <div className="mt-1 text-sm leading-5 text-muted-foreground">
              {tr(language, "Upload a CSV with one question-answer pair per row. The dataset is saved first; create the evaluation run after checking the data and judge settings.")}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-full p-0"
            onClick={onClose}
            disabled={running}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="grid gap-2 rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm">
          <div className="font-semibold text-foreground">{tr(language, "Expected CSV format")}</div>
          <div className="text-muted-foreground">
            {tr(language, "Required columns: question and answer, or aliases question_text and answer_text. Recommended: case_id, source_context, source_url, external_system. Optional human labels: human_label, human_score, human_comment, human_decision, reviewer_id.")}
          </div>
          <code className="rounded-lg bg-card px-2 py-1 text-xs text-body">
            case_id,question,answer,source_context,source_url,external_system,human_label,human_score,human_comment
          </code>
        </div>

        <label
          className={cn(
            "grid cursor-pointer gap-2 rounded-2xl border border-dashed border-border bg-surface-soft px-4 py-4 text-sm font-semibold text-foreground transition",
            isDraggingFile && "border-primary bg-surface-soft shadow-control",
            running && "cursor-not-allowed opacity-60",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span>{tr(language, "Drop CSV file here")}</span>
          <span className="text-xs font-medium text-muted-foreground">
            {tr(language, "Drag and drop a CSV file here, or use Browse.")}
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="max-w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium"
            onChange={handleFileChange}
            disabled={running}
          />
        </label>

        {fileName ? (
          <div className="text-sm text-muted-foreground">
            {tr(language, "Selected file")}: <span className="font-semibold text-foreground">{fileName}</span>
          </div>
        ) : null}

        {combinedErrors.length ? (
          <div className="grid gap-1 rounded-xl border border-[color:var(--dashboard-error-border)] bg-[var(--dashboard-error)] px-3 py-2 text-sm text-[color:var(--dashboard-error-foreground)]">
            {combinedErrors.map((error) => (
              <div key={error} className="flex gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{tr(language, error)}</span>
              </div>
            ))}
          </div>
        ) : null}

        {validation.warnings.length ? (
          <div className="grid gap-1 rounded-xl border border-[color:var(--dashboard-judge-border)] bg-[var(--dashboard-judge)] px-3 py-2 text-sm text-[color:var(--dashboard-judge-foreground)]">
            {validation.warnings.slice(0, 3).map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
            {validation.warnings.length > 3 ? (
              <div>{tr(language, "Additional rows have the same warning.")}</div>
            ) : null}
          </div>
        ) : null}

        {previewRows.length ? (
          <div className="grid gap-2">
            <div className="text-sm font-semibold text-foreground">
              {tr(language, "Preview")} · {validation.validRows.length} {tr(language, "valid rows")}
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              {previewRows.map((record) => (
                <div key={record.caseId} className="grid gap-1 border-b border-border px-3 py-2 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    <span>{record.caseId}</span>
                    <Badge variant="secondary" className="rounded-full">
                      {record.externalSystem}
                    </Badge>
                    {record.humanReview ? (
                      <Badge variant="outline" className="rounded-full bg-card">
                        {tr(language, "human label included")}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="line-clamp-1 text-sm text-body">{record.question}</div>
                  <div className="line-clamp-1 text-xs text-muted-foreground">{record.answer}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {localError ? (
          <div className="rounded-xl border border-[color:var(--dashboard-error-border)] bg-[var(--dashboard-error)] px-3 py-2 text-sm text-[color:var(--dashboard-error-foreground)]">
            {localError}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={running}>
            {tr(language, "Cancel")}
          </Button>
          <Button type="button" className="rounded-xl" onClick={submitImport} disabled={!canImport}>
              {running ? <Loader2 className="animate-spin" /> : <FlaskConical />}
              {tr(language, "Save imported dataset")}
            </Button>
        </div>
      </section>
    </div>
  )
}
