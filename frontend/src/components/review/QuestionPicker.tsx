import { useState } from "react"
import type { KeyboardEvent } from "react"
import { ArrowRight, ListFilter, Loader2, MessageSquareText, Search, Sparkles, X } from "lucide-react"

import type { CitizenQuestion, Language } from "@/types"
import {
  questionTypeFilterLabel,
  questionTypeFilters,
  questionWorkTags,
  sourceFilters,
  type QuestionTypeFilter,
  type SourceFilter,
} from "@/components/review/questionFilters"
import { QuestionOriginBadges } from "@/components/review/QuestionOriginBadges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { cn } from "@/lib/utils"

function labelWithCount<T extends string>(
  options: readonly (readonly [T, string])[],
  value: T,
  counts: Record<T, number>,
  language: Language,
  t: (language: Language, text: string) => string,
) {
  const label = options.find(([optionValue]) => optionValue === value)?.[1] || value
  return `${t(language, label)} ${counts[value]}`
}

function questionWorkTagLabel(
  language: Language,
  tag: Exclude<QuestionTypeFilter, "all">,
  t: (language: Language, text: string) => string,
) {
  return t(language, questionTypeFilterLabel(tag))
}

export function QuestionPicker({
  busy,
  language,
  questions,
  questionCode,
  questionTypeFilter,
  questionTypeFilterCounts,
  search,
  sectionLabel,
  selectedQuestionId,
  sourceFilter,
  sourceFilterCounts,
  t,
  onGenerate,
  onQuestionTypeFilterChange,
  onSearchChange,
  onSelectQuestion,
  onSourceFilterChange,
}: {
  busy: boolean
  language: Language
  questions: CitizenQuestion[]
  questionCode: (question: CitizenQuestion, language: Language) => string
  questionTypeFilter: QuestionTypeFilter
  questionTypeFilterCounts: Record<QuestionTypeFilter, number>
  search: string
  sectionLabel: (language: Language, sectionName: string) => string
  selectedQuestionId: string
  sourceFilter: SourceFilter
  sourceFilterCounts: Record<SourceFilter, number>
  t: (language: Language, text: string) => string
  onGenerate: () => void
  onQuestionTypeFilterChange: (value: QuestionTypeFilter) => void
  onSearchChange: (value: string) => void
  onSelectQuestion: (questionId: string) => void
  onSourceFilterChange: (value: SourceFilter) => void
}) {
  const hasSelectedQuestion = Boolean(selectedQuestionId)
  const [searchOpen, setSearchOpen] = useState(Boolean(search))
  const showSearch = searchOpen || Boolean(search)

  return (
    <Card className="flex h-[clamp(32rem,calc(100vh-12rem),66rem)] min-h-0 flex-col rounded-3xl border-border bg-card p-2 shadow-panel">
      <CardHeader className="shrink-0 gap-3 px-3 pt-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-foreground">
              {t(language, "Choose a citizen question to test")}
            </CardTitle>
            <CardDescription>
              {t(language, "Select one resident question, then generate an answer for review.")}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              type="button"
              variant={showSearch ? "secondary" : "outline"}
              size="icon-lg"
              className={cn(
                "rounded-2xl",
                showSearch &&
                  "bg-[var(--dashboard-active)] text-[var(--dashboard-active-foreground)] hover:bg-[var(--dashboard-active)] hover:text-[var(--dashboard-active-foreground)]",
              )}
              aria-label={t(language, "Search questions")}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <Search />
            </Button>

            <Select
              value={sourceFilter}
              onValueChange={(value) => {
                if (value) onSourceFilterChange(value as SourceFilter)
              }}
            >
              <SelectTrigger
                aria-label={t(language, "Question set")}
                className="h-9 min-w-[10rem] rounded-2xl border-border bg-card px-3 text-sm shadow-control hover:bg-surface-soft"
              >
                <span className="truncate">
                  {labelWithCount(sourceFilters, sourceFilter, sourceFilterCounts, language, t)}
                </span>
              </SelectTrigger>
              <SelectContent
                align="end"
                className="min-w-[12rem] rounded-2xl border-border bg-card p-1 shadow-panel"
              >
                {sourceFilters.map(([value, label]) => (
                  <SelectItem key={value} value={value} label={t(language, label)} className="rounded-xl">
                    <span className="font-medium">{t(language, label)}</span>
                    <span className="text-xs text-muted-foreground">
                      {sourceFilterCounts[value]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={questionTypeFilter}
              onValueChange={(value) => {
                if (value) onQuestionTypeFilterChange(value as QuestionTypeFilter)
              }}
            >
              <SelectTrigger
                aria-label={t(language, "Question type")}
                className="h-9 min-w-[13rem] rounded-2xl border-border bg-card px-3 text-sm shadow-control hover:bg-surface-soft"
              >
                <ListFilter className="size-4 text-muted-foreground" />
                <span className="truncate">
                  {labelWithCount(
                    questionTypeFilters,
                    questionTypeFilter,
                    questionTypeFilterCounts,
                    language,
                    t,
                  )}
                </span>
              </SelectTrigger>
              <SelectContent
                align="end"
                className="min-w-[14rem] rounded-2xl border-border bg-card p-1 shadow-panel"
              >
                {questionTypeFilters.map(([value, label]) => (
                  <SelectItem key={value} value={value} label={t(language, label)} className="rounded-xl">
                    <span className="font-medium">{t(language, label)}</span>
                    <span className="text-xs text-muted-foreground">
                      {questionTypeFilterCounts[value]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {showSearch ? (
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="h-10 rounded-2xl pr-12 pl-12 text-base md:text-sm"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t(language, "Search questions...")}
            />
            <Button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl"
              size="icon-sm"
              variant="ghost"
              aria-label={t(language, "Close search")}
              onClick={() => {
                onSearchChange("")
                setSearchOpen(false)
              }}
            >
              <X />
            </Button>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col px-3 pb-3">
        <div className="mb-2 flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground sm:text-sm">
          <span>
            {questions.length} {t(language, "matching questions")}
          </span>
          <span className="hidden sm:inline">
            {t(language, "Scroll the list and choose one case")}
          </span>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-border bg-surface-soft px-1 py-1 shadow-inner">
          {questions.length ? (
            questions.map((question) => (
              <QuestionRow
                key={question.question_id}
                language={language}
                question={question}
                questionCode={questionCode}
                sectionLabel={sectionLabel}
                selected={selectedQuestionId === question.question_id}
                t={t}
                onSelect={() => onSelectQuestion(question.question_id)}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed bg-muted/30 p-8 text-center text-muted-foreground">
              {t(language, "No questions match this search and filter combination.")}
            </div>
          )}
        </div>
        <div className="mt-3 flex shrink-0 flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquareText className="size-4" />
            {hasSelectedQuestion
              ? t(language, "One question selected")
              : t(language, "Select a question first")}
          </div>
          <Button
            size="lg"
            className="self-end rounded-2xl"
            onClick={onGenerate}
            disabled={busy || !hasSelectedQuestion}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {t(language, "Generate proposed answer")}
            <ArrowRight />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function QuestionRow({
  language,
  question,
  questionCode,
  sectionLabel,
  selected,
  t,
  onSelect,
}: {
  language: Language
  question: CitizenQuestion
  questionCode: (question: CitizenQuestion, language: Language) => string
  sectionLabel: (language: Language, sectionName: string) => string
  selected: boolean
  t: (language: Language, text: string) => string
  onSelect: () => void
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    onSelect()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        "grid w-full min-w-0 cursor-pointer grid-cols-[3.5rem_minmax(0,1fr)] gap-3 rounded-2xl border p-3 text-left transition hover:bg-muted/70",
        selected
          ? "border-[color:var(--dashboard-active)] bg-[var(--dashboard-human)] shadow-[0_12px_28px_rgba(95,90,139,0.14)] ring-1 ring-[color:var(--dashboard-human-border)]"
          : "border-transparent bg-surface-soft",
      )}
    >
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-xl border text-sm font-semibold",
          selected
            ? "border-[color:var(--dashboard-active)] bg-[var(--dashboard-active)] text-[var(--dashboard-active-foreground)]"
            : "bg-background",
        )}
      >
        {questionCode(question, language)}
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="min-w-0 max-w-full break-words text-sm font-semibold leading-snug md:text-base">
            {question.service_title}
          </h3>
          <QuestionOriginBadges
            language={language}
            question={question}
            sectionLabel={sectionLabel}
            t={t}
          >
            {questionWorkTags(question).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-border bg-card"
              >
                {questionWorkTagLabel(language, tag, t)}
              </Badge>
            ))}
          </QuestionOriginBadges>
        </div>
        <p className="break-words text-sm leading-6 text-foreground/90">{question.question_text}</p>
        {selected ? (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <MessageSquareText className="size-3" />
              {t(language, "Selected")}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
