import { FlaskConical, ListFilter, Loader2, Search, X } from "lucide-react"
import { useMemo, useState } from "react"

import { developerSectionLabel, developerTr as tr } from "./developerTraceModel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectField } from "@/components/ui/select-field"
import {
  matchesQuestionType,
  questionSampleLabel,
  questionTypeFilterLabel,
  questionTypeFilters,
  questionWorkTags,
  sourceFilters,
  type QuestionTypeFilter,
  type SourceFilter,
} from "@/components/review/questionFilters"
import { cn } from "@/lib/utils"
import type { CitizenQuestion, Language } from "@/types"

function questionFilterLabelWithCount<T extends string>(
  options: readonly (readonly [T, string])[],
  value: T,
  counts: Record<T, number>,
  language: Language,
) {
  const label = options.find(([optionValue]) => optionValue === value)?.[1] || value
  return `${tr(language, label)} ${counts[value]}`
}

export function QuestionBankPanel({
  language,
  loading,
  questions,
  running,
  selectedQuestionIds,
  onClose,
  onRunSelectedQuestions,
  onSelectedQuestionIdsChange,
}: {
  language: Language
  loading: boolean
  questions: CitizenQuestion[]
  running: boolean
  selectedQuestionIds: string[]
  onClose: () => void
  onRunSelectedQuestions: () => void
  onSelectedQuestionIdsChange: (questionIds: string[]) => void
}) {
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [questionTypeFilter, setQuestionTypeFilter] = useState<QuestionTypeFilter>("all")
  const selectedSet = useMemo(() => new Set(selectedQuestionIds), [selectedQuestionIds])
  const filteredQuestions = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return questions.filter((question) => {
      const matchesSource =
        sourceFilter === "all" ||
        (sourceFilter === "controlled" && !question.generation_method) ||
        (sourceFilter === "ai" && Boolean(question.generation_method))
      const matchesType = matchesQuestionType(question, questionTypeFilter)
      const matchesSearch =
        !needle ||
        [
          question.service_title,
          question.question_text,
          question.question_id,
          question.style_label,
          question.edge_case_label,
          question.target_section,
        ].some((value) => String(value || "").toLowerCase().includes(needle))

      return matchesSource && matchesType && matchesSearch
    })
  }, [questionTypeFilter, questions, search, sourceFilter])
  const sourceFilterCounts = useMemo(() => ({
    all: questions.length,
    controlled: questions.filter((question) => !question.generation_method).length,
    ai: questions.filter((question) => question.generation_method).length,
  }), [questions])
  const questionTypeFilterCounts = useMemo(() => Object.fromEntries(
    questionTypeFilters.map(([value]) => [
      value,
      questions.filter((question) => matchesQuestionType(question, value)).length,
    ]),
  ) as Record<QuestionTypeFilter, number>, [questions])

  function toggleQuestion(questionId: string) {
    const next = selectedSet.has(questionId)
      ? selectedQuestionIds.filter((selectedId) => selectedId !== questionId)
      : [...selectedQuestionIds, questionId]
    onSelectedQuestionIdsChange(next)
  }

  function clearSelection() {
    onSelectedQuestionIdsChange([])
  }

  function selectVisible() {
    const next = [...selectedQuestionIds]
    const seen = new Set(next)
    for (const question of filteredQuestions) {
      if (seen.has(question.question_id)) continue
      seen.add(question.question_id)
      next.push(question.question_id)
    }
    onSelectedQuestionIdsChange(next)
  }

  function runSelectedQuestions() {
    onRunSelectedQuestions()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-foreground/35 px-4 py-6 backdrop-blur-sm">
      <section className="flex max-h-[calc(100vh-3rem)] w-full max-w-[76rem] flex-col rounded-3xl border border-ring bg-card p-4 shadow-panel">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-section-title text-foreground">
            <ListFilter className="size-4" />
            {tr(language, "Question Bank")}
          </div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            {tr(language, "Inspect citizen questions and choose cases for the next evaluation run.")}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 w-full rounded-xl pl-9 pr-9 text-sm sm:w-[16rem]"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder={tr(language, "Search questions")}
            />
            {search ? (
              <Button
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg"
                size="icon-sm"
                variant="ghost"
                aria-label={tr(language, "Clear search")}
                onClick={() => setSearch("")}
              >
                <X />
              </Button>
            ) : null}
          </div>
          <SelectField
            className="shrink-0"
            options={sourceFilters.map(([value]) => ({
              label: questionFilterLabelWithCount(
                sourceFilters,
                value,
                sourceFilterCounts,
                language,
              ),
              value,
            }))}
            triggerClassName="rounded-xl"
            value={sourceFilter}
            onChange={(value) => setSourceFilter(value as SourceFilter)}
          />
          <SelectField
            className="shrink-0"
            options={questionTypeFilters.map(([value]) => ({
              label: questionFilterLabelWithCount(
                questionTypeFilters,
                value,
                questionTypeFilterCounts,
                language,
              ),
              value,
            }))}
            triggerClassName="rounded-xl"
            value={questionTypeFilter}
            onChange={(value) => setQuestionTypeFilter(value as QuestionTypeFilter)}
          />
          <Button
            size="icon-lg"
            variant="ghost"
            className="rounded-xl"
            aria-label={tr(language, "Close")}
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="text-xs font-medium text-muted-foreground">
          {filteredQuestions.length} {tr(language, "shown")} · {selectedQuestionIds.length} {tr(language, "selected")}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={selectVisible} disabled={!filteredQuestions.length}>
            {tr(language, "Select visible")}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={clearSelection} disabled={!selectedQuestionIds.length}>
            {tr(language, "Clear selection")}
          </Button>
          <Button
            size="sm"
            className="h-8 rounded-lg px-3 shadow-primary"
            disabled={loading || running || !selectedQuestionIds.length}
            onClick={runSelectedQuestions}
          >
            {running ? <Loader2 className="animate-spin" /> : <FlaskConical />}
            {tr(language, "Create run from selected questions")}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-surface-soft shadow-inner">
        {!questions.length ? (
          <div className="m-2 rounded-xl border border-dashed border-ring p-4 text-sm text-muted-foreground">
            {tr(language, "Loading question bank")}
          </div>
        ) : null}
        {questions.length && !filteredQuestions.length ? (
          <div className="m-2 rounded-xl border border-dashed border-ring p-4 text-sm text-muted-foreground">
            {tr(language, "No questions match this search and filter combination.")}
          </div>
        ) : null}
        {filteredQuestions.map((question) => {
          const selected = selectedSet.has(question.question_id)

          return (
            <div key={question.question_id} className="border-b border-border last:border-b-0">
              <div className={cn(
                "grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-3 px-3 py-2.5",
                selected && "bg-surface-soft",
              )}>
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[color:var(--foreground)]"
                  checked={selected}
                  aria-label={tr(language, "Select question")}
                  onChange={() => toggleQuestion(question.question_id)}
                />
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => toggleQuestion(question.question_id)}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {question.service_title}
                    </span>
                    <Badge variant="secondary" className="bg-[var(--dashboard-source)] text-[color:var(--dashboard-source-foreground)]">
                      {tr(language, questionSampleLabel(question))}
                    </Badge>
                    {questionWorkTags(question).slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="border-border bg-card">
                        {tr(language, questionTypeFilterLabel(tag))}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="border-[color:var(--dashboard-judge-border)] bg-[var(--dashboard-judge)] text-[color:var(--dashboard-judge-foreground)]">
                      {developerSectionLabel(language, question.target_section)}
                    </Badge>
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm leading-5 text-body">
                    {question.question_text}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {tr(language, "Question ID")}: {question.question_id} · {tr(language, "Service ID")}: {question.service_id}
                  </div>
                </button>
                <a
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-[color:var(--dashboard-source-foreground)] underline-offset-2 hover:bg-surface-soft hover:underline"
                  href={question.source_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {tr(language, "Official source")}
                </a>
              </div>
            </div>
          )
        })}
      </div>
      </section>
    </div>
  )
}
