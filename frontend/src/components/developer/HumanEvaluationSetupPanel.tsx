import { ClipboardCheck, Loader2, RotateCcw, UserCheck, UserMinus, UserPlus, Users, X } from "lucide-react"
import { useState } from "react"

import { DeveloperRunSelect } from "./DeveloperRunSelect"
import {
  buildReviewerParticipantLinkState,
  buildReviewerPlanCreateState,
  buildReviewerPlanStatus,
  buildReviewerRunSummary,
  type DeveloperActiveRun,
} from "./developerLabModel"
import { developerTr as tr } from "./developerTraceModel"
import { RunIssueNoticeBanner } from "@/components/shared/RunIssueNoticeBanner"
import { buildRunIssueNotice } from "@/components/shared/runIssueNotice"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SelectField } from "@/components/ui/select-field"
import { cn } from "@/lib/utils"
import type { Language, ReviewerPlan, ReviewerPlanParticipant } from "@/types"

/**
 * "No replacement" needs a sentinel: the dropdown cannot hold an item whose
 * value is the empty string, but the stored replacement really is empty.
 */
const noReplacementValue = "__none__"

export function HumanEvaluationSetupPanel({
  activeRun,
  batchHistory,
  closing,
  creating,
  adding,
  excludingParticipant,
  hasImportedHumanLabels,
  language,
  loading,
  reviewerCount,
  reviewerPlan,
  reviewsPerQuestion,
  selectedBatchId,
  onCloseReviewerPlan,
  onCreateReviewerPlan,
  onAddReviewerParticipant,
  onSetReviewerExclusion,
  onReviewerCountChange,
  onReviewsPerQuestionChange,
  onSelectBatch,
}: {
  activeRun: DeveloperActiveRun
  batchHistory: NonNullable<DeveloperActiveRun>[]
  closing: boolean
  creating: boolean
  adding: boolean
  excludingParticipant: string
  hasImportedHumanLabels: boolean
  language: Language
  loading: boolean
  reviewerCount: number
  reviewerPlan: ReviewerPlan | null
  reviewsPerQuestion: number
  selectedBatchId: string
  onCloseReviewerPlan: () => void
  onCreateReviewerPlan: () => void
  onAddReviewerParticipant: (sourceParticipant: string) => void
  onSetReviewerExclusion: (
    participant: string,
    excluded: boolean,
    reason?: string,
    replacedBy?: string,
  ) => void
  onReviewerCountChange: (value: number) => void
  onReviewsPerQuestionChange: (value: number) => void
  onSelectBatch: (batchId: string) => void
}) {
  const createState = buildReviewerPlanCreateState(activeRun, reviewerPlan, hasImportedHumanLabels)
  const planStatus = buildReviewerPlanStatus(reviewerPlan)
  const runSummary = buildReviewerRunSummary(activeRun, language)
  const runIssueNotice = buildRunIssueNotice(activeRun, language)

  return (
    <section className="mt-2 grid gap-4 rounded-xl border border-border bg-card px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-section-title text-foreground">
          <Users className="size-4" />
          {tr(language, "Human evaluation setup")}
        </div>
        <Badge variant={reviewerPlan && !planStatus.isClosed ? "secondary" : "outline"}>
          {tr(language, planStatus.badgeLabel)}
        </Badge>
      </div>
      <div className="rounded-xl border border-border bg-surface-soft px-3 py-2">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(32rem,42rem)] xl:items-start">
          <div className="min-w-0">
            <div className="text-caps uppercase text-label">
              {tr(language, "Reviewer links for")}
            </div>
            <div className="mt-1 text-section-title text-foreground">
              {tr(language, runSummary.title)}
            </div>
            {runSummary.summary ? (
              <div className="mt-1 max-w-[60rem] text-xs font-medium leading-5 text-muted-foreground">
                {runSummary.summary}
              </div>
            ) : null}
          </div>
          <div className="min-w-0 xl:justify-self-end">
            <DeveloperRunSelect
              batchHistory={batchHistory}
              className="w-full xl:min-w-[32rem]"
              disabled={loading || creating || closing}
              emptyLabel={tr(language, "No saved runs yet")}
              label={tr(language, "Run")}
              language={language}
              onSelectBatch={onSelectBatch}
              selectedBatchId={selectedBatchId}
            />
          </div>
        </div>
        {runIssueNotice ? (
          <RunIssueNoticeBanner
            className="mt-3"
            notice={runIssueNotice}
            translate={(value) => tr(language, value)}
          />
        ) : null}
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(11rem,0.8fr)_minmax(11rem,0.8fr)_auto_auto_auto] xl:items-end">
        <NumberSelectField
          label={tr(language, "Reviewers")}
          options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
          value={reviewerCount}
          onChange={onReviewerCountChange}
        />
        <NumberSelectField
          label={tr(language, "Reviews per case")}
          options={[1, 2, 3]}
          value={reviewsPerQuestion}
          onChange={onReviewsPerQuestionChange}
        />
        <Button
          size="lg"
          className="h-10 rounded-xl px-4 shadow-primary"
          disabled={!createState.canCreate || creating || closing}
          onClick={onCreateReviewerPlan}
        >
          {creating ? <Loader2 className="animate-spin" /> : <UserCheck />}
          {tr(language, "Create reviewer links")}
        </Button>
        <Button
          size="lg"
          className="h-10 rounded-xl px-4 shadow-control"
          disabled={!activeRun || !planStatus.canClose || closing || creating}
          variant="outline"
          onClick={onCloseReviewerPlan}
        >
          {closing ? <Loader2 className="animate-spin" /> : <X />}
          {tr(language, "Close reviewer links")}
        </Button>
        <a
          className={cn(
            "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground shadow-control transition hover:bg-surface-soft",
            planStatus.isClosed && "pointer-events-none opacity-50",
          )}
          href="?role=review_batch"
        >
          <ClipboardCheck className="size-4" />
          {tr(language, "Preview reviewer experience")}
        </a>
      </div>
      <div className="text-xs leading-5 text-muted-foreground">
        {tr(language, "Participant profile only asks for background and familiarity signals; age and gender are not collected.")}
      </div>
      {!createState.canCreate && createState.reason ? (
        <div className="rounded-xl border border-border bg-surface-soft px-3 py-2 text-xs leading-5 text-muted-foreground">
          {tr(language, createState.reason)}
        </div>
      ) : null}
      {reviewerPlan ? (
        <div className="grid gap-2">
          <div className="text-xs font-medium text-muted-foreground">
            {reviewerPlan.summary}
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {reviewerPlan.participants.map((participant) => {
              const linkState = buildReviewerParticipantLinkState(
                participant.review_url,
                reviewerPlan.batch_id || activeRun?.batch_id || "",
                reviewerPlan,
              )

              return (
                <ReviewerParticipantRow
                  key={participant.participant_id}
                  disabled={loading || creating || closing}
                  displayUrl={linkState.displayUrl}
                  canOpenLink={linkState.canOpen}
                  isClosed={planStatus.isClosed}
                  language={language}
                  otherParticipants={reviewerPlan.participants
                    .map((other) => other.participant_id)
                    .filter((id) => id !== participant.participant_id)}
                  participant={participant}
                  saving={excludingParticipant === participant.participant_id}
                  onSetReviewerExclusion={onSetReviewerExclusion}
                />
              )
            })}
          </div>
          {!planStatus.isClosed ? (
            <AddReplacementReviewerForm
              adding={adding}
              disabled={loading || creating || closing}
              language={language}
              participants={reviewerPlan.participants.map((participant) => participant.participant_id)}
              onAddReviewerParticipant={onAddReviewerParticipant}
            />
          ) : null}
        </div>
      ) : activeRun ? (
        <div className="rounded-xl border border-dashed border-ring bg-surface-soft p-4 text-sm leading-6 text-muted-foreground">
          {tr(language, "Create reviewer links when the active run is ready for human evaluation.")}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-ring bg-surface-soft p-4 text-sm leading-6 text-muted-foreground">
          {tr(language, "Create an evaluation run before generating reviewer links.")}
        </div>
      )}
    </section>
  )
}

function ReviewerParticipantRow({
  canOpenLink,
  disabled,
  displayUrl,
  isClosed,
  language,
  otherParticipants,
  participant,
  saving,
  onSetReviewerExclusion,
}: {
  canOpenLink: boolean
  disabled: boolean
  displayUrl: string
  isClosed: boolean
  language: Language
  otherParticipants: string[]
  participant: ReviewerPlanParticipant
  saving: boolean
  onSetReviewerExclusion: (
    participant: string,
    excluded: boolean,
    reason?: string,
    replacedBy?: string,
  ) => void
}) {
  const [flowOpen, setFlowOpen] = useState(false)
  const [reason, setReason] = useState(participant.excluded_reason || "")
  const [replacedBy, setReplacedBy] = useState(participant.replaced_by || "")
  const excluded = Boolean(participant.excluded)

  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border px-3 py-2",
        excluded ? "border-border bg-surface-soft" : "border-border bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{participant.participant_id}</span>
          {excluded ? (
            <Badge variant="outline" className="border-border bg-card text-muted-foreground">
              {tr(language, "excluded")}
            </Badge>
          ) : null}
        </div>
        <Badge variant="outline">
          {participant.completed_reviews}/{participant.assigned_trace_ids.length}
        </Badge>
      </div>
      {excluded && participant.replaced_by ? (
        <div className="mt-1 text-xs font-medium text-muted-foreground">
          {tr(language, "replaced by")} {participant.replaced_by}
        </div>
      ) : null}
      {excluded && participant.excluded_reason ? (
        <div className="mt-1 truncate text-xs text-muted-foreground" title={participant.excluded_reason}>
          {participant.excluded_reason}
        </div>
      ) : null}
      {canOpenLink ? (
        <a
          className="mt-1 block truncate text-xs font-medium text-[color:var(--dashboard-source-foreground)] underline-offset-2 hover:underline"
          href={displayUrl}
        >
          {displayUrl}
        </a>
      ) : (
        <div className="mt-1 truncate text-xs font-medium text-muted-foreground">{displayUrl}</div>
      )}
      {!isClosed ? (
        <div className="mt-2">
          {excluded ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg px-3 text-xs"
              disabled={disabled || saving}
              onClick={() => onSetReviewerExclusion(participant.participant_id, false)}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
              {tr(language, "Undo exclusion")}
            </Button>
          ) : flowOpen ? (
            <div className="grid gap-2 rounded-lg border border-border bg-surface-soft p-2">
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                {tr(language, "Exclusion reason (optional)")}
                <input
                  className="h-9 w-full rounded-lg border border-border bg-card px-2 text-sm text-foreground shadow-control"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <SelectField
                className="font-semibold"
                label={tr(language, "Replaced by (optional)")}
                options={[
                  { label: tr(language, "None"), value: noReplacementValue },
                  ...otherParticipants.map((id) => ({ label: id, value: id })),
                ]}
                triggerClassName="px-2"
                value={replacedBy || noReplacementValue}
                onChange={(value) => setReplacedBy(value === noReplacementValue ? "" : value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="h-8 rounded-lg px-3 text-xs"
                  disabled={disabled || saving}
                  onClick={() =>
                    onSetReviewerExclusion(
                      participant.participant_id,
                      true,
                      reason.trim(),
                      replacedBy || undefined,
                    )
                  }
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <UserMinus className="size-3.5" />}
                  {tr(language, "Confirm exclusion")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg px-3 text-xs"
                  disabled={saving}
                  onClick={() => setFlowOpen(false)}
                >
                  {tr(language, "Cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg px-3 text-xs"
              disabled={disabled || saving}
              onClick={() => setFlowOpen(true)}
            >
              <UserMinus className="size-3.5" />
              {tr(language, "Exclude reviewer")}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}

function AddReplacementReviewerForm({
  adding,
  disabled,
  language,
  participants,
  onAddReviewerParticipant,
}: {
  adding: boolean
  disabled: boolean
  language: Language
  participants: string[]
  onAddReviewerParticipant: (sourceParticipant: string) => void
}) {
  const [sourceParticipant, setSourceParticipant] = useState("")
  const effectiveSource =
    sourceParticipant && participants.includes(sourceParticipant)
      ? sourceParticipant
      : participants[0] || ""

  if (!participants.length) return null

  return (
    <div className="mt-1 grid gap-2 rounded-xl border border-border bg-surface-soft px-3 py-3 sm:grid-cols-[minmax(11rem,0.8fr)_auto] sm:items-end">
      <SelectField
        className="font-semibold"
        label={tr(language, "Copy cases from")}
        options={participants.map((participant) => ({ label: participant, value: participant }))}
        triggerClassName="h-10 rounded-xl px-3 text-base"
        value={effectiveSource}
        onChange={setSourceParticipant}
      />
      <Button
        size="lg"
        className="h-10 rounded-xl px-4 shadow-control"
        disabled={disabled || adding || !effectiveSource}
        variant="outline"
        onClick={() => onAddReviewerParticipant(effectiveSource)}
      >
        {adding ? <Loader2 className="animate-spin" /> : <UserPlus />}
        {tr(language, "Add replacement reviewer")}
      </Button>
    </div>
  )
}

function NumberSelectField({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: number[]
  value: number
  onChange: (value: number) => void
}) {
  const stringValue = options.includes(value) ? String(value) : String(options[0])

  // The dropdown speaks strings; this wrapper is the only place that converts.
  return (
    <SelectField
      className="font-semibold"
      label={label}
      options={options.map((option) => ({ label: String(option), value: String(option) }))}
      triggerClassName="h-10 rounded-xl px-3 text-base"
      value={stringValue}
      onChange={(nextValue) => onChange(Number(nextValue))}
    />
  )
}
