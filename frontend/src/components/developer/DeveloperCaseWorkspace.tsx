import { useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  FileText,
  MessageSquareText,
  RefreshCw,
} from "lucide-react"

import type {
  DeveloperPromptsResponse,
  DeveloperRunSettings,
  EvaluationTrace,
  HumanReview,
  Language,
} from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SelectField } from "@/components/ui/select-field"
import { StatTileGrid } from "@/components/ui/stat-tile"
import {
  DetailSection,
  DeveloperDetails,
  DeveloperPanel,
  Field,
  InfoBlock,
} from "./CaseDeveloperDetails"
import {
  CaseMaterialPanel,
  DiagnosticCriteriaPanel,
  JudgeExplanationPanel,
  JudgeRerunPanel,
  RequiredComparisonPanel,
} from "./CaseJudgePanels"
import {
  buildCompactRunInfo,
  buildAdjudicationReviewPayload,
  buildAdjudicationState,
  buildJudgeEvaluationHistory,
  type AdjudicationReviewPayload,
} from "./developerLabModel"
import { developerTr as tr, reviewDecisionLabel } from "./developerTraceModel"
import {
  adjudicationReviewerId,
  allHumanReviews,
  reviewIdentity,
} from "@/components/shared/evaluationTraceModel"

export function DeveloperCaseWorkspace({
  backLabel,
  developerPrompts = null,
  language,
  nextDisabled = false,
  previousDisabled = false,
  rerunningJudge = false,
  runSettings,
  savingAdjudication = false,
  showDiagnosticCriteria = true,
  showJudgeRerun = true,
  trace,
  onBack,
  onJudgeRerun,
  onNext,
  onPrevious,
  onSaveAdjudication,
}: {
  backLabel?: string
  developerPrompts?: DeveloperPromptsResponse | null
  language: Language
  nextDisabled?: boolean
  previousDisabled?: boolean
  rerunningJudge?: boolean
  runSettings?: DeveloperRunSettings
  savingAdjudication?: boolean
  showDiagnosticCriteria?: boolean
  showJudgeRerun?: boolean
  trace: EvaluationTrace
  onBack: () => void
  onJudgeRerun?: (traceId: string, settings: DeveloperRunSettings) => void
  onNext?: () => void
  onPrevious?: () => void
  onSaveAdjudication?: (traceId: string, payload: AdjudicationReviewPayload) => void
}) {
  const retrievals = trace.retrieval_results?.length ? trace.retrieval_results : [trace.retrieval_result]
  const primarySource = retrievals[0]

  return (
    <section className="grid w-full min-w-0 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-9 rounded-xl border-border bg-card px-3 text-foreground shadow-sm hover:bg-surface-soft"
          onClick={onBack}
        >
          <ArrowLeft />
          {backLabel || tr(language, "Back to worklist")}
        </Button>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-xl border-border bg-card px-3 text-foreground shadow-sm hover:bg-surface-soft"
            disabled={previousDisabled || !onPrevious}
            onClick={onPrevious}
          >
            <ArrowLeft />
            {tr(language, "Previous")}
          </Button>
          <Button
            size="sm"
            className="h-9 rounded-xl px-3 shadow-primary"
            disabled={nextDisabled || !onNext}
            onClick={onNext}
          >
            {tr(language, "Next")}
            <ArrowRight />
          </Button>
        </div>
      </div>

      <RequiredComparisonPanel language={language} trace={trace} />

      <div className="grid w-full min-w-0 gap-3 xl:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.4fr)] xl:items-start">
        <CaseMaterialPanel
          language={language}
          retrievals={retrievals}
          source={primarySource}
          trace={trace}
        />
        <div className="grid min-w-0 gap-4">
          <JudgeExplanationPanel language={language} trace={trace} />
          <HumanReviewResultPanel
            language={language}
            savingAdjudication={savingAdjudication}
            trace={trace}
            onSaveAdjudication={onSaveAdjudication}
          />
          {showDiagnosticCriteria ? (
            <DiagnosticCriteriaPanel language={language} trace={trace} />
          ) : null}
          {showJudgeRerun && runSettings && onJudgeRerun ? (
            <JudgeRerunPanel
              developerPrompts={developerPrompts}
              language={language}
              rerunning={rerunningJudge}
              runSettings={runSettings}
              trace={trace}
              onJudgeRerun={onJudgeRerun}
            />
          ) : null}
          <DeveloperDetails language={language} trace={trace} />
        </div>
      </div>
    </section>
  )
}

function HumanReviewResultPanel({
  language,
  savingAdjudication,
  trace,
  onSaveAdjudication,
}: {
  language: Language
  savingAdjudication: boolean
  trace: EvaluationTrace
  onSaveAdjudication?: (traceId: string, payload: AdjudicationReviewPayload) => void
}) {
  const reviews = humanReviewsForDisplay(trace).filter(hasHumanReviewDetails)
  const adjudicationState = buildAdjudicationState(trace)

  if (!reviews.length && !adjudicationState.primaryConflict && !adjudicationState.resolved) return null

  return (
    <DeveloperPanel
      icon={<MessageSquareText className="size-4" />}
      title={tr(language, "Human review result")}
    >
      <div className="grid gap-3">
        <AdjudicationActionPanel
          adjudicationState={adjudicationState}
          language={language}
          saving={savingAdjudication}
          trace={trace}
          onSaveAdjudication={onSaveAdjudication}
        />
        {reviews.map((item, index) => (
          <ReviewerResultCard
            key={item.review_id || `${reviewIdentity(item, index)}-${index}`}
            language={language}
            review={item}
            title={reviewIdentity(item, index)}
          />
        ))}
      </div>
    </DeveloperPanel>
  )
}

function AdjudicationActionPanel({
  adjudicationState,
  language,
  saving,
  trace,
  onSaveAdjudication,
}: {
  adjudicationState: ReturnType<typeof buildAdjudicationState>
  language: Language
  saving: boolean
  trace: EvaluationTrace
  onSaveAdjudication?: (traceId: string, payload: AdjudicationReviewPayload) => void
}) {
  const state = adjudicationState
  const [open, setOpen] = useState(false)
  const [decision, setDecision] = useState<AdjudicationReviewPayload["final_decision"]>("accept")
  const [comment, setComment] = useState("")

  if (!state.primaryConflict && !state.resolved) return null

  function saveResolution() {
    onSaveAdjudication?.(
      trace.trace_id,
      buildAdjudicationReviewPayload({
        comment: comment || "Final team decision recorded after reviewer disagreement.",
        decision,
        trace,
      }),
    )
    setOpen(false)
    setComment("")
  }

  function openResolutionForm() {
    setDecision(state.resolution?.final_decision || "accept")
    setComment(state.resolution?.comment_text || "")
    setOpen((current) => !current)
  }

  function reopenConflict() {
    const existingDecision = state.resolution?.final_decision || "accept"
    onSaveAdjudication?.(
      trace.trace_id,
      buildAdjudicationReviewPayload({
        adjudicationStatus: "reopened",
        comment: "Adjudication reopened; final team decision removed.",
        decision: existingDecision,
        trace,
      }),
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-section-title text-foreground">
            {tr(language, state.resolved ? "Adjudication resolved" : "Reviewer conflict")}
          </div>
          <div className="mt-0.5 text-xs leading-4 text-muted-foreground">
            {tr(
              language,
              state.resolved
                ? "Final team decision is recorded; reopen only if this was a mistake."
                : "Record a final human decision so Management can close this conflict.",
            )}
          </div>
          {state.resolved && state.resolution ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{tr(language, "Final adjudication recorded")}</Badge>
              <Badge variant="outline">
                {tr(language, "Final decision")}: {reviewDecisionLabel(language, state.resolution.final_decision)}
              </Badge>
              <Badge variant="outline">{state.resolution.reviewer_id || adjudicationReviewerId}</Badge>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {state.resolved ? (
            <>
              <Button
                size="sm"
                className="h-8 rounded-lg"
                disabled={saving || !onSaveAdjudication}
                onClick={openResolutionForm}
              >
                <ClipboardCheck />
                {tr(language, "Change decision")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg"
                disabled={saving || !onSaveAdjudication}
                onClick={reopenConflict}
              >
                <RefreshCw />
                {saving ? tr(language, "Saving") : tr(language, "Reopen conflict")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              className="h-8 rounded-lg"
              disabled={saving || !onSaveAdjudication}
              onClick={openResolutionForm}
            >
              <ClipboardCheck />
              {tr(language, "Resolve conflict")}
            </Button>
          )}
        </div>
      </div>
      {state.resolved && state.resolution?.comment_text ? (
        <div className="mt-3 rounded-lg border border-border bg-surface-soft px-3 py-2.5 text-sm leading-5 text-muted-foreground">
          {state.resolution.comment_text}
        </div>
      ) : null}
      {open ? (
        <div className="mt-3 grid gap-2 rounded-lg border border-border bg-surface-soft p-3">
          <SelectField
            className="text-xs font-semibold text-muted-foreground"
            label={tr(language, "Final decision")}
            options={[
              { label: tr(language, "Accept"), value: "accept" },
              { label: tr(language, "Needs edit"), value: "needs_edit" },
              { label: tr(language, "Reject"), value: "reject" },
            ]}
            value={decision}
            onChange={(value) =>
              setDecision(value as AdjudicationReviewPayload["final_decision"])
            }
          />
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            {tr(language, "Adjudication comment")}
            <textarea
              className="min-h-20 rounded-lg border border-border bg-card px-2 py-2 text-sm font-normal text-foreground"
              value={comment}
              onChange={(event) => setComment(event.currentTarget.value)}
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              {tr(language, "Cancel")}
            </Button>
            <Button
              size="sm"
              className="h-8 rounded-lg"
              disabled={saving || !onSaveAdjudication}
              onClick={saveResolution}
            >
              <ClipboardCheck />
              {saving
                ? tr(language, "Saving")
                : tr(language, state.resolved ? "Update final decision" : "Save final decision")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function hasHumanReviewDetails(review: HumanReview) {
  return (
    reviewChecklistEntries(review).length > 0 ||
    Boolean(reviewerCommentForDisplay(review.comment_text || "")) ||
    Boolean(review.suggested_correction?.trim())
  )
}

function humanReviewsForDisplay(trace: EvaluationTrace) {
  // Display context: keep excluded reviews visible (they render a muted badge)
  // so the audit trail is never hidden. Aggregates use the filtered accessor.
  return allHumanReviews(trace)
}

function ReviewerResultCard({
  language,
  review,
  title,
}: {
  language: Language
  review: HumanReview
  title: string
}) {
  const reviewerComment = reviewerCommentForDisplay(review.comment_text)

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-surface-soft p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{title}</Badge>
        {review.excluded ? (
          <Badge variant="outline" className="border-border bg-surface-soft text-muted-foreground">
            {tr(language, "excluded")}
          </Badge>
        ) : null}
        {review.submitted_at ? <Badge variant="outline">{review.submitted_at}</Badge> : null}
      </div>
      <ReviewChecklistSignals language={language} review={review} />
      {reviewerComment ? (
        <InfoBlock
          icon={<FileText className="size-4" />}
          title={tr(language, "Reviewer comment")}
          value={reviewerComment}
        />
      ) : null}
      {review.suggested_correction ? (
        <InfoBlock
          icon={<FileText className="size-4" />}
          title={tr(language, "Suggested correction")}
          value={review.suggested_correction}
        />
      ) : null}
    </div>
  )
}

function reviewerCommentForDisplay(comment: string) {
  const trimmed = comment.trim()
  const normalized = trimmed.toLowerCase()
  if (
    normalized.startsWith("review checklist:") ||
    normalized.startsWith("review-checkliste:") ||
    normalized.startsWith("review checkliste:")
  ) {
    return ""
  }
  return trimmed
}

function ReviewChecklistSignals({
  language,
  review,
}: {
  language: Language
  review: HumanReview
}) {
  const entries = reviewChecklistEntries(review)

  if (!entries.length) return null

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 text-caps uppercase text-label">
        {tr(language, "Review checklist")}
      </div>
      <div className="flex flex-wrap gap-2">
        {entries.map(([name, value]) => (
          <Badge key={name} variant="outline" className="border-ring bg-surface-soft text-muted-foreground">
            {tr(language, humanCriterionLabel(name))}: {String(value)}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function reviewChecklistEntries(review: HumanReview) {
  return Object.entries(review.criteria || {})
}

function humanCriterionLabel(name: string) {
  const labels: Record<string, string> = {
    clarity_actionability: "Clarity and actionability",
    completeness: "Completeness",
    factual_correctness: "Factual correctness",
    public_service_tone: "Public-service tone",
    source_support: "Source support",
    uncertainty_handling: "Uncertainty handling",
  }
  return labels[name] || name.replaceAll("_", " ")
}

export function CompactRunInfoPanel({ language, trace }: { language: Language; trace: EvaluationTrace }) {
  const rows = buildCompactRunInfo(trace)
  const judgeHistory = buildJudgeEvaluationHistory(trace)

  return (
    <div className="grid gap-3">
      <StatTileGrid>
        {rows.map(([label, value]) => (
          <Field key={label} label={tr(language, label)} value={value} />
        ))}
      </StatTileGrid>
      {judgeHistory.length > 1 ? (
        <div className="mt-3">
          <DetailSection title={tr(language, "Judge history")}>
            <div className="grid gap-3">
              {judgeHistory.map((item) => (
                <div key={item.id} className="rounded-xl border border-border bg-surface-soft p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.roleLabel}</Badge>
                    <Badge variant="outline">{item.promptVersion}</Badge>
                    <Badge variant="outline">{reviewDecisionLabel(language, item.decision)}</Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Field label={tr(language, "Model")} value={item.modelName} />
                    <Field label={tr(language, "Source support")} value={tr(language, item.sourceSupport)} />
                    <Field label={tr(language, "Evaluated")} value={item.evaluatedAt} />
                  </div>
                </div>
              ))}
            </div>
          </DetailSection>
        </div>
      ) : null}
    </div>
  )
}
