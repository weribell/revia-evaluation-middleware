import { useState } from "react"
import type { ReactNode } from "react"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  ExternalLink,
  ShieldCheck,
} from "lucide-react"

import {
  canSaveReviewDraft,
  buildReviewSourceGroups,
  decisions,
  negativeReviewChecklist,
  reviewRequiresProblemSignal,
  type ReviewChecklistItem,
} from "./reviewModel"
import { QuestionOriginBadges } from "./QuestionOriginBadges"
import type { CitizenQuestion, EvaluationTrace, Language } from "../../types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SourceExcerptText } from "@/components/shared/SourceExcerptText"
import { LinkedText } from "@/components/shared/LinkedText"
import { dashboardToneClass } from "@/lib/dashboardTones"
import { cn } from "@/lib/utils"

type Translate = (language: Language, text: string) => string
type SectionLabel = (language: Language, sectionName: string) => string

export function ReviewWorkspace({
  backLabel = "Back to questions",
  badgeText = "Review generated answer",
  showQuestionMetadata = true,
  showBack = true,
  busy,
  checkedReviewItems,
  comment,
  correction,
  decision,
  selectedQuestion,
  sourceSupport,
  trace,
  language,
  sectionLabel,
  t,
  onBack,
  onChecklistChange,
  onCommentChange,
  onCorrectionChange,
  onDecisionChange,
  onSave,
  onSourceSupportChange,
}: {
  backLabel?: string
  badgeText?: string
  showQuestionMetadata?: boolean
  showBack?: boolean
  busy: boolean
  checkedReviewItems: string[]
  comment: string
  correction: string
  decision: string
  selectedQuestion: CitizenQuestion | undefined
  sourceSupport: string
  trace: EvaluationTrace
  language: Language
  sectionLabel: SectionLabel
  t: Translate
  onBack: () => void
  onChecklistChange: (items: string[]) => void
  onCommentChange: (value: string) => void
  onCorrectionChange: (value: string) => void
  onDecisionChange: (value: string) => void
  onSave: () => void
  onSourceSupportChange: (value: string) => void
}) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showBack ? (
          <Button variant="outline" className="rounded-2xl" onClick={onBack}>
            <ArrowLeft />
            {t(language, backLabel)}
          </Button>
        ) : (
          <div />
        )}
        {badgeText ? (
          <Badge variant="secondary" className="border-ring bg-surface-soft text-primary">
            {t(language, badgeText)}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <ReviewMaterialPanel
          language={language}
          question={selectedQuestion}
          sectionLabel={sectionLabel}
          showQuestionMetadata={showQuestionMetadata}
          t={t}
          trace={trace}
        />
        <ReviewForm
          busy={busy}
          checkedReviewItems={checkedReviewItems}
          comment={comment}
          correction={correction}
          decision={decision}
          saved={Boolean(trace.mock_human_review)}
          sourceSupport={sourceSupport}
          language={language}
          t={t}
          onChecklistChange={onChecklistChange}
          onCommentChange={onCommentChange}
          onCorrectionChange={onCorrectionChange}
          onDecisionChange={onDecisionChange}
          onSave={onSave}
          onSourceSupportChange={onSourceSupportChange}
        />
      </div>
    </section>
  )
}

function ReviewMaterialPanel({
  language,
  question,
  sectionLabel,
  showQuestionMetadata = true,
  t,
  trace,
}: {
  language: Language
  question: CitizenQuestion | undefined
  sectionLabel: SectionLabel
  showQuestionMetadata?: boolean
  t: Translate
  trace: EvaluationTrace
}) {
  const sources = trace.retrieval_results?.length ? trace.retrieval_results : [trace.retrieval_result]
  const sourceGroups = buildReviewSourceGroups(sources)

  return (
    <Card
      size="sm"
      className="rounded-2xl border-border bg-card shadow-card"
    >
      <CardHeader className="gap-0.5">
        <CardTitle className="text-panel-title text-foreground">
          {t(language, "Question and answer")}
        </CardTitle>
        <CardDescription className="text-sm leading-5">
          {t(language, "Read the question and the proposed answer.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {question ? (
          <section className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <ActiveBadge>{t(language, "Resident question")}</ActiveBadge>
              {showQuestionMetadata ? (
                <QuestionOriginBadges
                  language={language}
                  question={question}
                  sectionLabel={sectionLabel}
                  t={t}
                />
              ) : null}
            </div>
            <div className="whitespace-pre-wrap rounded-lg border border-border bg-surface-soft p-4 text-base leading-7 text-body">
              {question.question_text}
            </div>
          </section>
        ) : null}

        <section className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <ActiveBadge>{t(language, "Answer to review")}</ActiveBadge>
          </div>
          <div className="whitespace-pre-wrap rounded-lg border border-[color:var(--dashboard-judge-border)] bg-[image:var(--banner-warn)] p-4 text-base leading-7 text-body">
            <LinkedText text={trace.generated_answer.answer_text} />
          </div>
        </section>

        <details className="group rounded-2xl border border-border bg-card shadow-inner">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-semibold text-body">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4" />
              {t(language, "Source for checking")}
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">
              {t(language, "Open")}
            </span>
            <span className="hidden text-xs text-muted-foreground group-open:inline">
              {t(language, "Close")}
            </span>
          </summary>
          <div className="grid gap-3 border-t border-border p-4">
            {sourceGroups.map((sourceGroup, groupIndex) => (
              <section
                key={`${sourceGroup.sourceRef}-${sourceGroup.serviceTitle}-${groupIndex}`}
                className="grid gap-3 rounded-2xl border border-border bg-surface-soft p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-base font-semibold leading-6 text-body sm:text-lg">
                      {sourceGroups.length > 1 ? `${groupIndex + 1}. ` : ""}
                      {sourceGroup.serviceTitle}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {sourceGroup.sources.length === 1
                        ? sectionLabel(language, sourceGroup.sources[0].section_name)
                        : language === "de"
                          ? `${sourceGroup.sources.length} Quellenauszüge`
                          : `${sourceGroup.sources.length} source excerpts`}
                    </div>
                  </div>
                  {sourceGroup.sourceRef ? (
                    <a
                      className="inline-flex h-8 max-w-full items-center gap-1 rounded-lg border border-ring bg-card px-2.5 text-xs font-semibold text-primary hover:bg-surface-soft"
                      href={sourceGroup.sourceRef}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="size-3.5" />
                      {t(language, "Open official source")}
                    </a>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  {sourceGroup.sources.map((source, sourceIndex) => (
                    <div
                      key={`${source.section_name}-${source.rank}-${sourceIndex}`}
                      className="grid gap-2 rounded-xl border border-border bg-card p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-body">
                        <Badge variant="outline" className={dashboardToneClass.judge}>
                          {sectionLabel(language, source.section_name)}
                        </Badge>
                        {source.intent_role ? (
                          <span className="text-xs font-medium text-muted-foreground">
                            {source.intent_role.replaceAll("_", " ")}
                          </span>
                        ) : null}
                      </div>
                      <SourceExcerptText
                        className="text-base leading-7 text-body"
                        emptyLabel={t(language, "No source excerpt available.")}
                        text={source.chunk_text}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}

function ReviewForm({
  busy,
  checkedReviewItems,
  comment,
  correction,
  decision,
  saved,
  sourceSupport,
  language,
  t,
  onChecklistChange,
  onCommentChange,
  onCorrectionChange,
  onDecisionChange,
  onSave,
  onSourceSupportChange,
}: {
  busy: boolean
  checkedReviewItems: string[]
  comment: string
  correction: string
  decision: string
  saved: boolean
  sourceSupport: string
  language: Language
  t: Translate
  onChecklistChange: (items: string[]) => void
  onCommentChange: (value: string) => void
  onCorrectionChange: (value: string) => void
  onDecisionChange: (value: string) => void
  onSave: () => void
  onSourceSupportChange: (value: string) => void
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const saveState = canSaveReviewDraft({
    decision,
    sourceSupport,
    confidence: "",
    comment,
    correction,
    checkedReviewItems,
  })
  const needsProblemSignal = reviewRequiresProblemSignal({
    decision,
    sourceSupport,
    confidence: "",
    comment,
    correction,
    checkedReviewItems,
  })
  const showProblemDetails = detailsOpen || needsProblemSignal || checkedReviewItems.length > 0
  const requiresNote = checkedReviewItems.includes("other_problem")
  const showNotes = notesOpen || requiresNote || Boolean(comment || correction)

  function toggleChecklistItem(itemId: string) {
    onChecklistChange(
      checkedReviewItems.includes(itemId)
        ? checkedReviewItems.filter((id) => id !== itemId)
        : [...checkedReviewItems, itemId],
    )
  }

  return (
    <Card className="rounded-2xl border-border bg-card shadow-card">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-panel-title text-foreground">
              {t(language, "Your review")}
            </CardTitle>
            <CardDescription className="text-sm leading-5">
              {t(language, "Choose the usability decision. Add problem details only when something needs attention.")}
            </CardDescription>
          </div>
          {saved ? (
            <Badge className="gap-1.5">
              <CheckCircle2 className="size-3.5" />
              {t(language, "Saved locally")}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ReviewSection className="bg-surface-soft">
          <ReviewFieldTitle language={language} title="Can this answer be used?" t={t} required />
          <div className="grid gap-2">
            {decisions.map((item) => (
              <ChoiceCard
                key={item.value}
                compact
                active={decision === item.value}
                title={t(language, item.title)}
                description={t(language, item.description)}
                icon={
                  item.value === "accept" ? (
                    <CheckCircle2 />
                  ) : item.value === "needs_edit" ? (
                    <AlertCircle />
                  ) : (
                    <AlertCircle />
                  )
                }
                tone={
                  item.value === "accept"
                    ? "positive"
                    : item.value === "needs_edit"
                      ? "warning"
                      : "negative"
                }
                onClick={() => onDecisionChange(item.value)}
              />
            ))}
          </div>
        </ReviewSection>

        <ReviewSection>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ReviewFieldTitle
              language={language}
              title="Source check"
              t={t}
              optional
            />
          </div>
          <ChoiceCard
            compact
            active={sourceSupport === "partly_supported"}
            title={t(language, "Source support problem")}
            description={t(language, "I cannot confirm part or all of the answer from the shown source.")}
            icon={<AlertCircle />}
            tone="warning"
            onClick={() =>
              onSourceSupportChange(
                sourceSupport === "partly_supported" ? "not_checked" : "partly_supported",
              )
            }
          />
        </ReviewSection>

        <ReviewSection className="gap-0 p-0">
          <CollapsibleReviewSectionHeader
            language={language}
            title="Problem details"
            t={t}
            optional={!needsProblemSignal}
            required={needsProblemSignal}
            description={
              needsProblemSignal
                ? "Please mark at least one problem signal before saving."
                : "Open this if you want to add a concern."
            }
            open={showProblemDetails}
            openLabel="Add problem"
            closeLabel="Hide problems"
            onToggle={() => setDetailsOpen((open) => !open)}
            disabled={needsProblemSignal}
          />
          {showProblemDetails ? (
            <div className="px-3 pb-3">
              <ChecklistColumn
                checkedReviewItems={checkedReviewItems}
                items={negativeReviewChecklist}
                language={language}
                tone="negative"
                t={t}
                onToggle={toggleChecklistItem}
              />
            </div>
          ) : null}
        </ReviewSection>

        <ReviewSection className="gap-0 p-0">
          <CollapsibleReviewSectionHeader
            language={language}
            title="Notes"
            t={t}
            optional={!requiresNote}
            required={requiresNote}
            description={
              requiresNote
                ? "Please describe the other problem before saving."
                : undefined
            }
            open={showNotes}
            openLabel="Add note"
            closeLabel="Hide notes"
            onToggle={() => setNotesOpen((open) => !open)}
            disabled={requiresNote}
          />
          {showNotes ? (
            <div className="grid gap-4 px-3 pb-3 lg:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="comment" className="text-sm font-semibold text-foreground">
                  {t(language, "Note for the team")}
                </Label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(event) => onCommentChange(event.target.value)}
                  placeholder={t(language, "Short reason or anything the team should know.")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="correction" className="text-sm font-semibold text-foreground">
                  {t(language, "Suggested correction")}
                </Label>
                <Textarea
                  id="correction"
                  value={correction}
                  onChange={(event) => onCorrectionChange(event.target.value)}
                  placeholder={t(language, "Write a corrected answer or a concrete edit suggestion.")}
                />
              </div>
            </div>
          ) : null}
        </ReviewSection>

        <div className="sticky bottom-0 z-10 -mx-2 bg-card/95 px-2 pt-1 pb-0 backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm leading-5 text-muted-foreground">
              {!saveState.canSave
                ? t(language, saveState.reason)
                : t(language, "Ready to save this review.")}
            </div>
            <Button size="lg" onClick={onSave} disabled={busy || !saveState.canSave}>
              <ClipboardCheck />
              {t(language, "Save & next")}
              <ArrowRight />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CollapsibleReviewSectionHeader({
  closeLabel,
  description,
  disabled,
  language,
  onToggle,
  open,
  openLabel,
  optional,
  required,
  t,
  title,
}: {
  closeLabel: string
  description?: string
  disabled?: boolean
  language: Language
  onToggle: () => void
  open: boolean
  openLabel: string
  optional?: boolean
  required?: boolean
  t: Translate
  title: string
}) {
  const actionLabel = open ? closeLabel : openLabel

  return (
    <button
      type="button"
      className={cn(
        "flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl p-3 text-left transition hover:bg-card/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default disabled:hover:bg-transparent",
      )}
      aria-expanded={open}
      disabled={disabled}
      onClick={onToggle}
    >
      <ReviewFieldTitle
        language={language}
        title={title}
        t={t}
        optional={optional}
        required={required}
        description={description}
      />
      {!disabled ? (
        <span className="inline-flex h-10 items-center rounded-2xl border border-input bg-background px-4 text-sm font-semibold text-foreground shadow-xs">
          {t(language, actionLabel)}
        </span>
      ) : null}
    </button>
  )
}

function ReviewSection({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "grid gap-3 rounded-2xl border border-border bg-surface-soft p-3",
        className,
      )}
    >
      {children}
    </section>
  )
}

// The pill used for the reviewer's own labels: the active fill by default, its quiet
// outline twin for optional markers. Both class strings stay written out in full because
// Tailwind v4 only sees arbitrary utilities that appear as complete literals in the source.
function ActiveBadge({
  children,
  variant = "solid",
}: {
  children: ReactNode
  variant?: "solid" | "outline"
}) {
  if (variant === "outline") {
    return (
      <Badge
        variant="outline"
        className="h-6 rounded-full border-ring bg-surface-soft px-3 text-xs font-semibold text-body"
      >
        {children}
      </Badge>
    )
  }

  return (
    <Badge className="h-6 rounded-full bg-[var(--dashboard-active)] px-3 text-xs font-semibold text-[var(--dashboard-active-foreground)]">
      {children}
    </Badge>
  )
}

function ReviewFieldTitle({
  description,
  language,
  optional,
  required,
  t,
  title,
}: {
  description?: string
  language: Language
  optional?: boolean
  required?: boolean
  t: Translate
  title: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-base font-semibold leading-6 text-foreground">
          {t(language, title)}
        </Label>
        {required ? <ActiveBadge>{t(language, "Required")}</ActiveBadge> : null}
        {optional ? (
          <ActiveBadge variant="outline">{t(language, "Optional")}</ActiveBadge>
        ) : null}
      </div>
      {description ? (
        <p className="text-sm leading-5 text-muted-foreground">{t(language, description)}</p>
      ) : null}
    </div>
  )
}

function ChecklistColumn({
  checkedReviewItems,
  items,
  language,
  onToggle,
  t,
  tone,
}: {
  checkedReviewItems: string[]
  items: readonly ReviewChecklistItem[]
  language: Language
  onToggle: (itemId: string) => void
  t: Translate
  tone: "positive" | "negative"
}) {
  return (
    <div className="grid content-start gap-1">
      {items.map((item) => (
        <ChecklistItem
          key={item.id}
          checked={checkedReviewItems.includes(item.id)}
          description={t(language, item.description)}
          language={language}
          tone={tone}
          title={t(language, item.title)}
          t={t}
          onClick={() => onToggle(item.id)}
        />
      ))}
    </div>
  )
}

function ChecklistItem({
  checked,
  description,
  language,
  onClick,
  t,
  tone,
  title,
}: {
  checked: boolean
  description: string
  language: Language
  onClick: () => void
  t: Translate
  tone: "positive" | "negative"
  title: string
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_1.75rem] items-start gap-2 rounded-xl px-2 py-1.5 transition",
        checked && tone === "positive" && "bg-surface-soft",
        checked && tone === "negative" && "bg-[var(--dashboard-risk)]",
        !checked && "hover:bg-muted/40",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onClick}
        className="flex min-w-0 items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border",
            checked && "border-[color:var(--dashboard-active)] bg-[var(--dashboard-active)] text-[var(--dashboard-active-foreground)]",
            !checked && "border-border bg-card",
          )}
        >
          {checked ? <Check className="size-3.5" /> : null}
        </span>
        <span className="min-w-0 text-sm font-semibold leading-5 text-foreground">{title}</span>
      </button>
      <HoverCard>
        <HoverCardTrigger
          // base-ui renders the trigger as a bare <a>, which is not keyboard focusable.
          render={<button type="button" />}
          aria-label={`${t(language, "Explanation")}: ${title}`}
          className="flex size-5 items-center justify-center justify-self-end rounded-full text-label outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <CircleHelp className="size-4" />
        </HoverCardTrigger>
        <HoverCardContent
          align="end"
          className="w-64 border border-border p-3 text-left text-xs leading-5 text-body"
        >
          {description}
        </HoverCardContent>
      </HoverCard>
    </div>
  )
}

function ChoiceCard({
  active,
  compact = false,
  description,
  flat = false,
  icon,
  onClick,
  title,
  tone = "neutral",
}: {
  active: boolean
  compact?: boolean
  description: string
  flat?: boolean
  icon?: ReactNode
  onClick: () => void
  title: string
  tone?: "positive" | "warning" | "negative" | "neutral"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid gap-3 rounded-2xl border text-left transition hover:shadow-sm",
        flat ? "grid-cols-[2rem_minmax(0,1fr)] items-center" : "grid-cols-[2.75rem_minmax(0,1fr)]",
        compact ? "p-3" : "p-4",
        active && "shadow-[0_10px_24px_rgba(95,90,139,0.14)] ring-1 ring-[color:var(--dashboard-active)]/20",
        !active && "border-border bg-card hover:bg-muted/40",
        active && tone === "positive" && "border-[color:var(--dashboard-ready-border)] bg-[var(--dashboard-ready)]",
        active && tone === "warning" && "border-[color:var(--dashboard-judge-border)] bg-[var(--dashboard-judge)]",
        active && tone === "negative" && "border-[color:var(--dashboard-risk-border)] bg-[var(--dashboard-risk)]",
        active && tone === "neutral" && "border-[color:var(--dashboard-active)] bg-[var(--dashboard-human)]",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-2xl border",
          flat ? "size-8 rounded-xl" : compact ? "size-9" : "size-10",
          active && tone === "positive" && dashboardToneClass.ready,
          active && tone === "warning" && dashboardToneClass.judge,
          active && tone === "negative" && dashboardToneClass.risk,
          active && tone === "neutral" && dashboardToneClass.human,
          !active && tone === "positive" && dashboardToneClass.ready,
          !active && tone === "warning" && dashboardToneClass.judge,
          !active && tone === "negative" && dashboardToneClass.risk,
          !active && tone === "neutral" && dashboardToneClass.neutral,
          "[&_svg]:size-5",
        )}
      >
        {icon || <CheckCircle2 />}
      </span>
      <span className={cn("min-w-0", flat && "text-sm")}>
        <span className={cn("font-medium", !flat && "block")}>{title}</span>
        <span
          className={cn(
            "text-sm leading-5 text-muted-foreground",
            flat ? "ml-2" : "mt-1 block",
          )}
        >
          {description}
        </span>
      </span>
    </button>
  )
}
