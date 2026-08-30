import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Loader2,
  Sparkles,
} from "lucide-react"

import { ReviewWorkspace } from "./ReviewWorkspace"
import { buildReviewBatchSteps, reviewBatchInstructions } from "./reviewModel"
import type { CitizenQuestion, EvaluationTrace, Language } from "../../types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SelectField } from "@/components/ui/select-field"
import { dashboardToneClass } from "@/lib/dashboardTones"

type Translate = (language: Language, text: string) => string
type SectionLabel = (language: Language, sectionName: string) => string

export function ReviewBatchWorkspace({
  batchCompleted,
  batchCompletedCount,
  batchIndex,
  batchIntroVisible,
  batchQuestionIds,
  batchReachableCount,
  batchStarted,
  busy,
  checkedReviewItems,
  comment,
  correction,
  decision,
  plannedBatchSize,
  participantId,
  reviewerProfile,
  selectedQuestion,
  sourceSupport,
  trace,
  language,
  sectionLabel,
  t,
  onChecklistChange,
  onCommentChange,
  onCorrectionChange,
  onDecisionChange,
  onResetBatch,
  onResumeBatch,
  onReviewerProfileChange,
  onSave,
  onSelectQuestionIndex,
  onShowIntro,
  onSourceSupportChange,
  onStartBatch,
}: {
  batchCompleted: boolean
  batchCompletedCount: number
  batchIndex: number
  batchIntroVisible: boolean
  batchQuestionIds: string[]
  batchReachableCount: number
  batchStarted: boolean
  busy: boolean
  checkedReviewItems: string[]
  comment: string
  correction: string
  decision: string
  plannedBatchSize: number
  participantId: string
  reviewerProfile: Record<string, string>
  selectedQuestion: CitizenQuestion | undefined
  sourceSupport: string
  trace: EvaluationTrace | null
  language: Language
  sectionLabel: SectionLabel
  t: Translate
  onChecklistChange: (items: string[]) => void
  onCommentChange: (value: string) => void
  onCorrectionChange: (value: string) => void
  onDecisionChange: (value: string) => void
  onResetBatch: () => void
  onResumeBatch: () => void
  onReviewerProfileChange: (field: string, value: string) => void
  onSave: () => void
  onSelectQuestionIndex: (index: number) => void
  onShowIntro: () => void
  onSourceSupportChange: (value: string) => void
  onStartBatch: () => void
}) {
  const total = batchQuestionIds.length || plannedBatchSize
  const completedCount = Math.min(batchCompletedCount, total)
  const progress = Math.round((completedCount / total) * 100)
  const reviewerLabel = participantId || t(language, "Preview mode")
  const profileComplete = Boolean(
    reviewerProfile.reviewer_background &&
      reviewerProfile.public_service_familiarity &&
      reviewerProfile.llm_familiarity &&
      reviewerProfile.language_confidence_de,
  )

  if (!batchStarted || batchIntroVisible) {
    return (
      <Card className="mx-auto w-full max-w-4xl rounded-3xl border-border bg-card shadow-panel">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge className="w-fit bg-[var(--dashboard-active)] text-[var(--dashboard-active-foreground)]">
              {t(language, "Structured evaluation session")}
            </Badge>
            {!participantId ? <Badge variant="outline">{t(language, "Preview mode")}</Badge> : null}
          </div>
          <CardTitle className="text-3xl text-foreground">
            {total} {t(language, "generated answers to review")}
          </CardTitle>
          <CardDescription className="max-w-2xl text-base leading-7">
            {t(language, "You will review one case at a time. Your progress is saved.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ReviewerInstructionCard language={language} t={t} />
          <ReviewerProfileIntake
            language={language}
            participantId={reviewerLabel}
            profile={reviewerProfile}
            t={t}
            onChange={onReviewerProfileChange}
          />
          <div className="flex justify-end">
            <Button
              size="lg"
              className="rounded-2xl"
              onClick={batchStarted ? onResumeBatch : onStartBatch}
              disabled={busy || !profileComplete}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {batchStarted
                ? language === "de"
                  ? `Mit Frage ${batchIndex + 1} von ${total} fortfahren`
                  : `Continue question ${batchIndex + 1} of ${total}`
                : t(language, "Start review batch")}
              <ArrowRight />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (batchCompleted) {
    return (
      <Card className="mx-auto w-full max-w-3xl rounded-3xl border-border bg-card text-center shadow-panel">
        <CardHeader>
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--dashboard-active)] text-[var(--dashboard-active-foreground)]">
            <CheckCircle2 className="size-7" />
          </div>
          <CardTitle>
            {language === "de" ? "Vielen Dank für Ihre Teilnahme" : "Thank you for participating"}
          </CardTitle>
          <CardDescription className="text-base leading-7">
            {language === "de"
              ? `Alle ${total} Bewertungen wurden gespeichert. Sie können die gespeicherten Antworten noch einmal prüfen.`
              : `All ${total} reviews have been saved. You can still review your saved answers.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => onSelectQuestionIndex(0)}
          >
            {language === "de" ? "Gespeicherte Antworten prüfen" : "Review saved answers"}
          </Button>
          {!participantId ? (
            <Button variant="ghost" className="rounded-2xl" onClick={onResetBatch}>
              {t(language, "Start a new batch")}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  if (!trace) {
    return (
      <Card className="rounded-3xl border-border bg-card shadow-panel">
        <CardContent className="flex items-center justify-center gap-3 p-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          {t(language, "Loading the next question...")}
        </CardContent>
      </Card>
    )
  }

  return (
    <section className="grid gap-3">
      <BatchProgressHeader
        completedCount={completedCount}
        currentIndex={batchIndex}
        language={language}
        onShowIntro={onShowIntro}
        onSelectQuestionIndex={onSelectQuestionIndex}
        progress={progress}
        reachableCount={batchReachableCount}
        t={t}
        total={total}
      />
      <ReviewWorkspace
        badgeText=""
        showQuestionMetadata={false}
        showBack={false}
        busy={busy}
        checkedReviewItems={checkedReviewItems}
        comment={comment}
        correction={correction}
        decision={decision}
        selectedQuestion={selectedQuestion}
        sourceSupport={sourceSupport}
        trace={trace}
        language={language}
        sectionLabel={sectionLabel}
        t={t}
        onBack={onResetBatch}
        onChecklistChange={onChecklistChange}
        onCommentChange={onCommentChange}
        onCorrectionChange={onCorrectionChange}
        onDecisionChange={onDecisionChange}
        onSave={onSave}
        onSourceSupportChange={onSourceSupportChange}
      />
    </section>
  )
}

function ReviewerInstructionCard({
  language,
  t,
}: {
  language: Language
  t: Translate
}) {
  return (
    <section className="grid gap-3 border-l-2 border-[color:var(--dashboard-active)] py-1 pl-4 text-left">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--dashboard-human)] text-[color:var(--dashboard-active)]">
          <AlertCircle className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-6 text-foreground">
            {t(language, "Before you start")}
          </h2>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
            {t(language, "Please read these short instructions before starting the review.")}
          </p>
        </div>
      </div>

      <ol className="grid gap-3">
        {reviewBatchInstructions.map((item, index) => (
          <li
            key={item.title}
            className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3"
          >
            <span className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-[var(--dashboard-active)] text-xs font-semibold text-[var(--dashboard-active-foreground)]">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-5 text-foreground">
                {t(language, item.title)}
              </span>
              <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                {t(language, item.description)}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <p className="text-xs leading-5 text-muted-foreground">
        {t(language, "The time you spend on each case is recorded for study purposes.")}
      </p>
    </section>
  )
}

function ReviewerProfileIntake({
  language,
  participantId,
  profile,
  t,
  onChange,
}: {
  language: Language
  participantId: string
  profile: Record<string, string>
  t: Translate
  onChange: (field: string, value: string) => void
}) {
  return (
    <section className="grid gap-3 rounded-2xl border border-border bg-surface-soft p-4 text-left">
      <div>
        <div className="text-sm font-semibold text-foreground">
          {t(language, "Reviewer profile")} · {participantId}
        </div>
        <div className="mt-1 text-sm leading-6 text-muted-foreground">
          {t(language, "Please select the options below to start the review.")}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ProfileSelect
          label={t(language, "Reviewer background")}
          placeholder={t(language, "Please choose")}
          value={profile.reviewer_background || ""}
          onChange={(value) => onChange("reviewer_background", value)}
          options={[
            ["student", t(language, "Student")],
            ["public_administration", t(language, "Public administration")],
            ["technical", t(language, "Technical background")],
            ["other", t(language, "Other")],
          ]}
        />
        <ProfileSelect
          label={t(language, "Public-service familiarity")}
          placeholder={t(language, "Please choose")}
          value={profile.public_service_familiarity || ""}
          onChange={(value) => onChange("public_service_familiarity", value)}
          options={familiarityOptions(language, t)}
        />
        <ProfileSelect
          label={t(language, "LLM familiarity")}
          placeholder={t(language, "Please choose")}
          value={profile.llm_familiarity || ""}
          onChange={(value) => onChange("llm_familiarity", value)}
          options={familiarityOptions(language, t)}
        />
        <ProfileSelect
          label={t(language, "German-language confidence")}
          placeholder={t(language, "Please choose")}
          value={profile.language_confidence_de || ""}
          onChange={(value) => onChange("language_confidence_de", value)}
          options={familiarityOptions(language, t)}
        />
      </div>
    </section>
  )
}

function familiarityOptions(language: Language, t: Translate): [string, string][] {
  return [
    ["low", t(language, "Low")],
    ["medium", t(language, "Medium")],
    ["high", t(language, "High")],
  ]
}

function ProfileSelect({
  label,
  options,
  placeholder,
  value,
  onChange,
}: {
  label: string
  options: [string, string][]
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <SelectField
      className="text-sm font-medium text-body"
      label={label}
      options={options.map(([optionValue, optionLabel]) => ({
        label: optionLabel,
        value: optionValue,
      }))}
      placeholder={placeholder}
      triggerClassName="font-normal"
      value={value}
      onChange={onChange}
    />
  )
}

function BatchProgressHeader({
  completedCount,
  currentIndex,
  language,
  onShowIntro,
  onSelectQuestionIndex,
  progress,
  reachableCount,
  t,
  total,
}: {
  completedCount: number
  currentIndex: number
  language: Language
  onShowIntro: () => void
  onSelectQuestionIndex: (index: number) => void
  progress: number
  reachableCount: number
  t: Translate
  total: number
}) {
  const steps = buildReviewBatchSteps({ completedCount, currentIndex, reachableCount, total })

  return (
    <Card className="rounded-2xl border-border bg-card py-0 shadow-card">
      <CardContent className="grid gap-1.5 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm leading-tight">
          <div className="font-medium text-foreground">
            {language === "de" ? `Frage ${currentIndex + 1} von ${total}` : `Question ${currentIndex + 1} of ${total}`}
            <span className="ml-2 text-muted-foreground">
              {progress}% {t(language, "achieved")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-label">
              {completedCount} {t(language, "saved")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 rounded-lg px-1.5 text-xs text-label"
              onClick={onShowIntro}
            >
              <CircleHelp className="size-3.5" />
              {t(language, "Instructions")}
            </Button>
          </div>
        </div>
        <div
          className="grid w-full gap-0.5"
          style={{ gridTemplateColumns: `repeat(${Math.max(total, 1)}, minmax(0, 1fr))` }}
        >
          {steps.map((step) => (
            <button
              key={step.number}
              type="button"
              disabled={step.disabled}
              aria-current={step.status === "current" ? "step" : undefined}
              className={[
                "mx-auto flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-xs font-semibold transition",
                step.status === "current"
                  ? "border-primary bg-accent text-primary ring-2 ring-ring/40"
                  : "",
                step.status === "saved"
                  ? `${dashboardToneClass.ready} hover:brightness-95`
                  : "",
                step.status === "available"
                  ? "border-ring bg-card text-muted-foreground hover:bg-surface-soft"
                  : "",
                step.status === "locked"
                  ? "cursor-not-allowed border-border bg-surface-soft text-label"
                  : "",
              ].join(" ")}
              onClick={() => onSelectQuestionIndex(step.index)}
            >
              {step.number}
            </button>
          ))}
        </div>
        <div className="h-px overflow-hidden rounded-full bg-chart-track">
          <div
            className="h-full rounded-full bg-[var(--dashboard-active)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
