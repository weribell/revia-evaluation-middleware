import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
} from "lucide-react"

import {
  buildReviewDraftFromHumanReview,
  buildCriteriaFromChecklist,
  buildReviewBatchStorageKey,
  buildSavedReviewComment,
  canSaveReviewDraft,
  createEmptyReviewDraft,
  type ReviewDraft,
} from "./components/review/reviewModel"
import {
  batchSize,
  batchStorageKey,
  buildBatchQuestionIds,
  createEmptyReviewerProfile,
  participantProfileStorageKey,
  restoreBatchQuestionIds,
  saveBatchProgress,
  type ReviewerProfile,
} from "./components/review/reviewBatchStorage"
import {
  generateAnswer,
  getReviewerAssignment,
  getOverview,
  getQuestions,
  saveHumanReview,
} from "./api"
import type { CitizenQuestion, DashboardOverview, EvaluationTrace, HumanReview, Language } from "./types"
import { DeveloperDashboard } from "./components/developer/DeveloperDashboard"
import { DashboardPlaceholder } from "./components/shared/DashboardPlaceholder"
import {
  dashboardRoles,
  type DashboardRole,
} from "./components/shared/dashboardRoles"
import {
  shouldShowDashboardRoleSelect,
  shouldShowDeveloperLabReturn,
  usesCompactDashboardHeader,
} from "./components/shared/dashboardRoleModel"
import { allHumanReviews } from "./components/shared/evaluationTraceModel"
import { RoleSelector } from "./components/shared/RoleSelector"
import { QuestionPicker } from "./components/review/QuestionPicker"
import { ReviewBatchWorkspace } from "./components/review/ReviewBatchWorkspace"
import { ReviewWorkspace } from "./components/review/ReviewWorkspace"
import { ManagementDashboard } from "./components/management/ManagementDashboard"
import { AuditDashboard } from "./components/audit/AuditDashboard"
import { ReviaBrandHeader } from "./components/shared/ReviaBrand"
import {
  dashboardRoleStorageKey,
  getBatchIdFromUrl,
  getInitialDashboardRole,
  getParticipantFromUrl,
  getReviewerTokenFromUrl,
  isParticipantReviewLink,
  isReviewerPath,
  replaceDashboardRoleUrl,
  shouldLoadInitialDashboardData,
  shouldRefreshAfterBatchReviewSave,
} from "./appMode"
import {
  matchesQuestionType,
  questionTypeFilterLabel,
  questionTypeFilters,
  questionWorkTags,
  type QuestionTypeFilter,
  type SourceFilter,
} from "./components/review/questionFilters"
import { cn } from "@/lib/utils"
import { getInitialLanguage, languageStorageKey, sectionLabel, tr } from "./appText"

function questionCode(question: CitizenQuestion, language: Language) {
  if (question.generation_method) return tr(language, "AI")
  return language === "de" ? "KT" : "CT"
}

function humanReviewForReviewer(trace: EvaluationTrace, participantId: string): HumanReview | null {
  const reviews = allHumanReviews(trace)

  if (!reviews.length) return null
  if (!participantId) return trace.mock_human_review || reviews[0] || null
  return reviews.find((review) => review.reviewer_id === participantId) || null
}

export default function App() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [questions, setQuestions] = useState<CitizenQuestion[]>([])
  const [selectedQuestionId, setSelectedQuestionId] = useState("")
  const [explorerTrace, setExplorerTrace] = useState<EvaluationTrace | null>(null)
  const [batchTrace, setBatchTrace] = useState<EvaluationTrace | null>(null)
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [questionTypeFilter, setQuestionTypeFilter] = useState<QuestionTypeFilter>("all")
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage())
  const [activeRole, setActiveRole] = useState<DashboardRole>(() => getInitialDashboardRole())
  const [batchStarted, setBatchStarted] = useState(false)
  const [batchIntroVisible, setBatchIntroVisible] = useState(false)
  const [batchQuestionIds, setBatchQuestionIds] = useState<string[]>([])
  const [assignedBatchTraces, setAssignedBatchTraces] = useState<EvaluationTrace[]>([])
  const [participantId] = useState(() => getParticipantFromUrl())
  const [reviewBatchId] = useState(() => getBatchIdFromUrl())
  const [reviewerToken] = useState(() => getReviewerTokenFromUrl())
  const [reviewerProfile, setReviewerProfile] = useState<ReviewerProfile>(() => createEmptyReviewerProfile())
  const [batchIndex, setBatchIndex] = useState(0)
  // Tracks when the currently shown batch case became visible, so we can report how
  // long the reviewer spent on it (study telemetry, no visible reviewer timer).
  const caseShownAtRef = useRef<number>(0)
  const [batchCompletedCount, setBatchCompletedCount] = useState(0)
  const [batchReachableCount, setBatchReachableCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [explorerDraft, setExplorerDraft] = useState<ReviewDraft>(() => createEmptyReviewDraft())
  const [batchDraft, setBatchDraft] = useState<ReviewDraft>(() => createEmptyReviewDraft())

  const selectedQuestion = questions.find((question) => question.question_id === selectedQuestionId)
  const batchStorageKeyForParticipant = buildReviewBatchStorageKey(
    batchStorageKey,
    participantId,
    reviewBatchId,
  )
  const participantProfileStorageKeyForBatch = buildReviewBatchStorageKey(
    participantProfileStorageKey,
    participantId,
    reviewBatchId,
  )
  const batchCurrentTrace = assignedBatchTraces[batchIndex]
  const batchCurrentQuestionId = batchCurrentTrace?.citizen_question.question_id || batchQuestionIds[batchIndex]
  const batchSelectedQuestion =
    batchCurrentTrace?.citizen_question ||
    questions.find((question) => question.question_id === batchCurrentQuestionId)
  const batchCompleted =
    batchStarted &&
    batchQuestionIds.length > 0 &&
    batchCompletedCount >= batchQuestionIds.length &&
    batchIndex >= batchQuestionIds.length

  const filteredQuestions = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return questions.filter((question) => {
      const matchesSource =
        sourceFilter === "all" ||
        (sourceFilter === "ai" ? Boolean(question.generation_method) : !question.generation_method)
      const matchesType = matchesQuestionType(question, questionTypeFilter)
      const matchesSearch =
        !needle ||
        [
          question.question_text,
          question.service_title,
          ...questionWorkTags(question),
          ...questionWorkTags(question).map((tag) => tr(language, questionTypeFilterLabel(tag))),
          question.generation_method,
          sectionLabel(language, question.target_section),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle)

      return matchesSource && matchesType && matchesSearch
    })
  }, [language, questionTypeFilter, questions, search, sourceFilter])

  const questionTypeFilterCounts = useMemo(() => {
    return Object.fromEntries(
      questionTypeFilters.map(([value]) => [
        value,
        questions.filter((question) => matchesQuestionType(question, value)).length,
      ]),
    ) as Record<QuestionTypeFilter, number>
  }, [questions])

  const sourceFilterCounts = useMemo(() => {
    return {
      all: questions.length,
      controlled: questions.filter((question) => !question.generation_method).length,
      ai: questions.filter((question) => question.generation_method).length,
    }
  }, [questions])

  const activeRoleConfig =
    dashboardRoles.find((role) => role.value === activeRole) || dashboardRoles[0]
  const publicReviewerRoute = isReviewerPath(window.location.pathname)
  const participantReviewLink = isParticipantReviewLink(
    window.location.search,
    window.location.pathname,
  )
  const showReviewerBatchLanguageSetup =
    (participantReviewLink || publicReviewerRoute) && (!batchStarted || batchIntroVisible)
  const compactHeader =
    participantReviewLink ||
    publicReviewerRoute ||
    usesCompactDashboardHeader(activeRole) ||
    (activeRole === "review_explorer" && Boolean(explorerTrace)) ||
    (activeRole === "review_batch" && batchStarted && !batchIntroVisible && !batchCompleted)

  async function refresh() {
    setError("")
    const [nextOverview, nextQuestions] = await Promise.all([getOverview(), getQuestions()])
    setOverview(nextOverview)
    setQuestions(nextQuestions)
    setSelectedQuestionId((oldValue) => oldValue || nextQuestions[0]?.question_id || "")
  }

  function changeDashboardRole(role: DashboardRole) {
    setActiveRole(role)
    window.localStorage.setItem(dashboardRoleStorageKey, role)
    replaceDashboardRoleUrl(role)
  }

  function returnToDeveloperLab() {
    const url = new URL(window.location.href)
    if (isReviewerPath(url.pathname)) {
      url.pathname = "/"
    }
    url.searchParams.delete("role")
    url.searchParams.delete("participant")
    url.searchParams.delete("batch_id")
    url.searchParams.delete("token")
    url.searchParams.set("developer_tab", "human_study_setup")
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`)
    changeDashboardRole("developer")
  }

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage)
    window.localStorage.setItem(languageStorageKey, nextLanguage)
  }

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true)
      setError("")
      try {
        await action()
      } catch (err) {
        setError(err instanceof Error ? err.message : tr(language, "Something went wrong"))
      } finally {
        setBusy(false)
      }
    },
    [language],
  )

  const resetBatchReviewState = useCallback(() => {
    setBatchTrace(null)
    setBatchDraft(createEmptyReviewDraft())
    caseShownAtRef.current = Date.now()
  }, [])

  const loadBatchTraceIntoForm = useCallback((trace: EvaluationTrace) => {
    setBatchTrace(trace)
    setBatchDraft(buildReviewDraftFromHumanReview(humanReviewForReviewer(trace, participantId)))
  }, [participantId])

  useEffect(() => {
    if (!shouldLoadInitialDashboardData(window.location.pathname)) return
    refresh().catch((err: Error) => setError(err.message))
  }, [])

  useEffect(() => {
    if (participantId || !questions.length || batchQuestionIds.length) return
    const stored = window.localStorage.getItem(batchStorageKeyForParticipant)
    if (!stored) return

    try {
      const parsed = JSON.parse(stored) as {
        completedCount?: number
        index?: number
        questionIds?: unknown
        reachableCount?: number
        started?: boolean
      }
      const restoredIds = restoreBatchQuestionIds(parsed.questionIds, questions)

      if (!parsed.started || !restoredIds.length) return

      const storedIndex = typeof parsed.index === "number" ? parsed.index : 0
      const nextIndex = Math.min(Math.max(storedIndex, 0), restoredIds.length)
      const restoredCompletedCount =
        typeof parsed.completedCount === "number" ? parsed.completedCount : nextIndex
      const nextCompletedCount = Math.min(Math.max(restoredCompletedCount, 0), restoredIds.length)
      const restoredReachableCount =
        typeof parsed.reachableCount === "number"
          ? parsed.reachableCount
          : Math.max(nextCompletedCount, nextIndex + 1)
      const nextReachableCount = Math.min(Math.max(restoredReachableCount, 0), restoredIds.length)
      setBatchQuestionIds(restoredIds)
      setBatchIndex(nextIndex)
      setBatchCompletedCount(nextCompletedCount)
      setBatchReachableCount(nextReachableCount)
      setBatchStarted(true)
      saveBatchProgress(
        batchStorageKeyForParticipant,
        restoredIds,
        nextIndex,
        true,
        nextCompletedCount,
        nextReachableCount,
      )
    } catch {
      window.localStorage.removeItem(batchStorageKeyForParticipant)
    }
  }, [batchQuestionIds.length, batchStorageKeyForParticipant, participantId, questions])

  useEffect(() => {
    if (!participantId) return
    const stored = window.localStorage.getItem(participantProfileStorageKeyForBatch)
    if (!stored) return
    try {
      setReviewerProfile({ ...createEmptyReviewerProfile(), ...JSON.parse(stored) })
    } catch {
      window.localStorage.removeItem(participantProfileStorageKeyForBatch)
    }
  }, [participantId, participantProfileStorageKeyForBatch])

  useEffect(() => {
    if (activeRole !== "review_batch" || !participantId || assignedBatchTraces.length) return

    run(async () => {
      const assignment = await getReviewerAssignment(participantId, reviewBatchId, reviewerToken)
      const traceIds = assignment.traces.map((trace) => trace.trace_id)
      const questionIds = assignment.traces.map((trace) => trace.citizen_question.question_id)

      // Server-side truth: reviews are submitted strictly in order, so the cases this
      // participant already reviewed form a contiguous prefix of the assigned traces.
      const total = assignment.traces.length
      let serverCompletedCount = 0
      while (
        serverCompletedCount < total &&
        humanReviewForReviewer(assignment.traces[serverCompletedCount], participantId)
      ) {
        serverCompletedCount += 1
      }

      const stored = window.localStorage.getItem(batchStorageKeyForParticipant)
      let nextIndex = 0
      let nextCompletedCount = 0
      let nextReachableCount = 0
      let started = false

      if (stored) {
        try {
          const parsed = JSON.parse(stored) as {
            completedCount?: number
            index?: number
            reachableCount?: number
            started?: boolean
          }
          nextIndex = Math.min(Math.max(typeof parsed.index === "number" ? parsed.index : 0, 0), traceIds.length)
          nextCompletedCount = Math.min(
            Math.max(
              typeof parsed.completedCount === "number" ? parsed.completedCount : nextIndex,
              0,
            ),
            traceIds.length,
          )
          const restoredReachableCount =
            typeof parsed.reachableCount === "number"
              ? parsed.reachableCount
              : Math.max(nextCompletedCount, nextIndex + 1)
          nextReachableCount = Math.min(Math.max(restoredReachableCount, 0), traceIds.length)
          started = Boolean(parsed.started)
        } catch {
          window.localStorage.removeItem(batchStorageKeyForParticipant)
        }
      }

      // If the server knows about more completed reviews than local storage (e.g. the
      // reviewer returned on another device/day, or storage was cleared), resume from the
      // first unanswered case instead of restarting. When local storage is ahead (same
      // browser, same session), it wins and behavior is unchanged.
      if (serverCompletedCount > nextCompletedCount) {
        nextCompletedCount = serverCompletedCount
        nextIndex = serverCompletedCount
        nextReachableCount = Math.max(nextReachableCount, Math.min(serverCompletedCount + 1, total))
      }
      started = started || serverCompletedCount > 0

      // Rebuild the reviewer profile from the server if local storage lost it, so the
      // intake screen does not block a returning reviewer. The profile is always complete
      // on the server (it is required to start and is sent with every submission).
      const storedProfile = window.localStorage.getItem(participantProfileStorageKeyForBatch)
      if (!storedProfile && serverCompletedCount > 0) {
        for (let index = serverCompletedCount - 1; index >= 0; index -= 1) {
          const profile = humanReviewForReviewer(assignment.traces[index], participantId)?.reviewer_profile
          if (profile && Object.values(profile).some((value) => value)) {
            const restoredProfile = { ...createEmptyReviewerProfile(), ...profile }
            setReviewerProfile(restoredProfile)
            window.localStorage.setItem(
              participantProfileStorageKeyForBatch,
              JSON.stringify(restoredProfile),
            )
            break
          }
        }
      }

      setAssignedBatchTraces(assignment.traces)
      setBatchQuestionIds(questionIds)
      setBatchIndex(nextIndex)
      setBatchCompletedCount(nextCompletedCount)
      setBatchReachableCount(nextReachableCount)
      setBatchStarted(started)

      // Persist the reconciled progress so later reloads behave consistently. Fresh
      // participants (no server reviews) write nothing, matching the previous behavior.
      if (serverCompletedCount > 0) {
        saveBatchProgress(
          batchStorageKeyForParticipant,
          questionIds,
          nextIndex,
          started,
          nextCompletedCount,
          nextReachableCount,
        )
      }
    })
  }, [
    activeRole,
    assignedBatchTraces.length,
    batchStorageKeyForParticipant,
    participantProfileStorageKeyForBatch,
    participantId,
    reviewBatchId,
    reviewerToken,
    run,
  ])

  useEffect(() => {
    if (activeRole !== "review_batch") return
    if (!batchStarted || batchCompleted || !batchCurrentQuestionId) return
    if (batchCurrentTrace) {
      if (batchTrace?.trace_id === batchCurrentTrace.trace_id) return
      loadBatchTraceIntoForm(batchCurrentTrace)
      return
    }
    if (batchTrace?.citizen_question.question_id === batchCurrentQuestionId) return

    resetBatchReviewState()
    run(async () => {
      loadBatchTraceIntoForm(await generateAnswer(batchCurrentQuestionId))
    })
  }, [
    activeRole,
    batchCompleted,
    batchCurrentQuestionId,
    batchCurrentTrace,
    batchStarted,
    batchTrace?.trace_id,
    batchTrace?.citizen_question.question_id,
    loadBatchTraceIntoForm,
    resetBatchReviewState,
    run,
  ])

  // Reset the per-case timer whenever the active batch case changes (moving to the next
  // case, or a different trace being loaded for the current index).
  useEffect(() => {
    caseShownAtRef.current = Date.now()
  }, [batchIndex, batchCurrentTrace?.trace_id])

  function resetExplorerReviewState() {
    setExplorerTrace(null)
    setExplorerDraft(createEmptyReviewDraft())
  }

  function selectQuestion(questionId: string) {
    setSelectedQuestionId(questionId)
    resetExplorerReviewState()
  }

  async function handleGenerate() {
    if (!selectedQuestion) return
    await run(async () => {
      setExplorerTrace(await generateAnswer(selectedQuestion.question_id))
    })
  }

  function buildHumanReviewPayload(draft: ReviewDraft) {
    const saveState = canSaveReviewDraft(draft)
    if (!saveState.canSave) {
      setError(tr(language, saveState.reason))
      return null
    }
    const answeredCriteria = buildCriteriaFromChecklist(draft.checkedReviewItems)
    const scores = Object.values(answeredCriteria)
    const humanScore = scores.length
      ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
      : { accept: 5, needs_edit: 3, reject: 1 }[
          draft.decision as "accept" | "needs_edit" | "reject"
        ]

    return {
      final_decision: draft.decision,
      label: draft.sourceSupport || "not_checked",
      reviewer_confidence: draft.confidence,
      criteria: answeredCriteria,
      comment_text: buildSavedReviewComment(draft.comment, draft.checkedReviewItems),
      suggested_correction: draft.correction,
      human_score: humanScore,
    }
  }

  async function handleSaveReview() {
    if (!explorerTrace) return
    const payload = buildHumanReviewPayload(explorerDraft)
    if (!payload) return

    await run(async () => {
      setExplorerTrace(await saveHumanReview(explorerTrace.trace_id, payload))
      await refresh()
    })
  }

  async function startReviewBatch() {
    const nextQuestionIds = assignedBatchTraces.length
      ? assignedBatchTraces.map((trace) => trace.citizen_question.question_id)
      : buildBatchQuestionIds(questions)
    if (!nextQuestionIds.length) return

    if (participantId) {
      window.localStorage.setItem(
        participantProfileStorageKeyForBatch,
        JSON.stringify(reviewerProfile),
      )
    }
    setBatchQuestionIds(nextQuestionIds)
    setBatchIndex(0)
    setBatchCompletedCount(0)
    setBatchReachableCount(1)
    setBatchStarted(true)
    setBatchIntroVisible(false)
    resetBatchReviewState()
    saveBatchProgress(batchStorageKeyForParticipant, nextQuestionIds, 0, true, 0, 1)
  }

  async function resetReviewBatch() {
    window.localStorage.removeItem(batchStorageKeyForParticipant)
    setBatchQuestionIds([])
    setBatchIndex(0)
    setBatchCompletedCount(0)
    setBatchReachableCount(0)
    setBatchStarted(false)
    setBatchIntroVisible(false)
    resetBatchReviewState()
  }

  function selectBatchQuestionIndex(index: number) {
    if (index < 0 || index >= batchQuestionIds.length) return
    const currentReachableCount = Math.max(batchReachableCount, batchCompletedCount, batchIndex + 1)
    if (index >= currentReachableCount) return
    const nextReachableCount = Math.max(currentReachableCount, index + 1)
    setBatchIndex(index)
    setBatchReachableCount(nextReachableCount)
    saveBatchProgress(
      batchStorageKeyForParticipant,
      batchQuestionIds,
      index,
      true,
      batchCompletedCount,
      nextReachableCount,
    )
    resetBatchReviewState()
  }

  async function handleSaveBatchReview() {
    if (!batchTrace || !batchCurrentQuestionId) return
    const payload = buildHumanReviewPayload(batchDraft)
    if (!payload) return

    const durationSeconds = Math.round((Date.now() - caseShownAtRef.current) / 100) / 10
    const validDuration = Number.isFinite(durationSeconds) && durationSeconds >= 0

    await run(async () => {
      const savedTrace = await saveHumanReview(batchTrace.trace_id, {
        ...payload,
        reviewer_id: participantId || undefined,
        participant_id: participantId || undefined,
        token: participantId ? reviewerToken : undefined,
        batch_id: participantId ? reviewBatchId || undefined : undefined,
        reviewer_profile: participantId ? reviewerProfile : undefined,
        duration_seconds: validDuration ? durationSeconds : undefined,
      })
      setAssignedBatchTraces((traces) =>
        traces.map((trace) => (trace.trace_id === savedTrace.trace_id ? savedTrace : trace)),
      )
      const nextCompletedCount = Math.max(batchCompletedCount, batchIndex + 1)
      const nextIndex = Math.min(batchIndex + 1, batchQuestionIds.length)
      const nextReachableCount =
        nextIndex >= batchQuestionIds.length
          ? batchQuestionIds.length
          : Math.max(batchReachableCount, nextCompletedCount, nextIndex + 1)
      setBatchCompletedCount(nextCompletedCount)
      setBatchIndex(nextIndex)
      setBatchReachableCount(nextReachableCount)
      saveBatchProgress(
        batchStorageKeyForParticipant,
        batchQuestionIds,
        nextIndex,
        true,
        nextCompletedCount,
        nextReachableCount,
      )
      resetBatchReviewState()
      if (shouldRefreshAfterBatchReviewSave(participantId)) {
        await refresh()
      }
    })
  }

  return (
    // overflow-x-clip, not -hidden: `hidden` would make <main> a scroll container
    // and break `position: sticky` inside it.
    <main className="min-h-screen overflow-x-clip bg-[image:var(--page-gradient)]">
      <div
        className={cn(
          "mx-auto flex w-full max-w-[92rem] flex-col px-4 sm:px-6 lg:px-12",
          compactHeader ? "gap-4 py-4" : "gap-6 py-6",
        )}
      >
        {showReviewerBatchLanguageSetup ? (
          <div className="flex justify-end">
            <RoleSelector
              activeRole={activeRole}
              language={language}
              showRoleSelect={false}
              t={tr}
              onLanguageChange={changeLanguage}
              onRoleChange={changeDashboardRole}
            />
          </div>
        ) : null}

        {!participantReviewLink ? (
          <header
            className={cn(
              "flex flex-col border-b lg:flex-row lg:items-center lg:justify-between",
              compactHeader ? "gap-3 pb-3" : "gap-5 pb-5",
            )}
          >
            <ReviaBrandHeader
              compact={compactHeader}
              description={activeRoleConfig.purposeStatement}
              language={language}
              t={tr}
              title={activeRoleConfig.title}
            />
            <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-end lg:justify-end">
              {shouldShowDeveloperLabReturn(activeRole, participantReviewLink || publicReviewerRoute) ? (
                <button
                  type="button"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3.5 text-sm font-semibold text-foreground shadow-control transition hover:bg-surface-soft"
                  onClick={returnToDeveloperLab}
                >
                  <ArrowLeft className="size-4" />
                  <span className="hidden sm:inline">{tr(language, "Back to Developer Lab")}</span>
                  <span className="sm:hidden">{tr(language, "Developer Lab")}</span>
                </button>
              ) : null}
              <RoleSelector
                activeRole={activeRole}
                language={language}
                showRoleSelect={shouldShowDashboardRoleSelect(activeRole)}
                t={tr}
                onLanguageChange={changeLanguage}
                onRoleChange={changeDashboardRole}
              />
            </div>
          </header>
        ) : null}

        {error ? (
          <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--dashboard-error-border)] bg-[var(--dashboard-error)] px-4 py-3 text-sm text-[color:var(--dashboard-error-foreground)] shadow-sm">
            <AlertCircle className="size-4" />
            {error}
          </div>
        ) : null}

        {activeRole === "review_explorer" ? (
          explorerTrace ? (
            <ReviewWorkspace
              busy={busy}
              checkedReviewItems={explorerDraft.checkedReviewItems}
              comment={explorerDraft.comment}
              correction={explorerDraft.correction}
              decision={explorerDraft.decision}
              selectedQuestion={selectedQuestion}
              sourceSupport={explorerDraft.sourceSupport}
              trace={explorerTrace}
              language={language}
              sectionLabel={sectionLabel}
              t={tr}
              onBack={resetExplorerReviewState}
              onChecklistChange={(checkedReviewItems) =>
                setExplorerDraft((draft) => ({ ...draft, checkedReviewItems }))
              }
              onCommentChange={(comment) => setExplorerDraft((draft) => ({ ...draft, comment }))}
              onCorrectionChange={(correction) =>
                setExplorerDraft((draft) => ({ ...draft, correction }))
              }
              onDecisionChange={(decision) =>
                setExplorerDraft((draft) => ({ ...draft, decision }))
              }
              onSave={handleSaveReview}
              onSourceSupportChange={(sourceSupport) =>
                setExplorerDraft((draft) => ({ ...draft, sourceSupport }))
              }
            />
          ) : (
            <section className="w-full">
              <QuestionPicker
                busy={busy}
                language={language}
                questions={filteredQuestions}
                questionCode={questionCode}
                selectedQuestionId={selectedQuestionId}
                questionTypeFilter={questionTypeFilter}
                questionTypeFilterCounts={questionTypeFilterCounts}
                search={search}
                sectionLabel={sectionLabel}
                sourceFilter={sourceFilter}
                sourceFilterCounts={sourceFilterCounts}
                t={tr}
                onGenerate={handleGenerate}
                onQuestionTypeFilterChange={setQuestionTypeFilter}
                onSearchChange={setSearch}
                onSelectQuestion={selectQuestion}
                onSourceFilterChange={setSourceFilter}
              />
            </section>
          )
        ) : activeRole === "review_batch" ? (
          <ReviewBatchWorkspace
            batchCompleted={batchCompleted}
            batchCompletedCount={batchCompletedCount}
            batchIndex={batchIndex}
            batchIntroVisible={batchIntroVisible}
            batchQuestionIds={batchQuestionIds}
            batchReachableCount={batchReachableCount}
            batchStarted={batchStarted}
            busy={busy}
            checkedReviewItems={batchDraft.checkedReviewItems}
            comment={batchDraft.comment}
            correction={batchDraft.correction}
            decision={batchDraft.decision}
            plannedBatchSize={
              assignedBatchTraces.length || Math.min(batchSize, questions.length) || batchSize
            }
            participantId={participantId}
            reviewerProfile={reviewerProfile}
            selectedQuestion={batchSelectedQuestion}
            sourceSupport={batchDraft.sourceSupport}
            trace={batchTrace}
            language={language}
            sectionLabel={sectionLabel}
            t={tr}
            onChecklistChange={(checkedReviewItems) =>
              setBatchDraft((draft) => ({ ...draft, checkedReviewItems }))
            }
            onCommentChange={(comment) => setBatchDraft((draft) => ({ ...draft, comment }))}
            onCorrectionChange={(correction) =>
              setBatchDraft((draft) => ({ ...draft, correction }))
            }
            onDecisionChange={(decision) => setBatchDraft((draft) => ({ ...draft, decision }))}
            onResetBatch={resetReviewBatch}
            onResumeBatch={() => setBatchIntroVisible(false)}
            onSave={handleSaveBatchReview}
            onSelectQuestionIndex={selectBatchQuestionIndex}
            onShowIntro={() => setBatchIntroVisible(true)}
            onReviewerProfileChange={(field, value) =>
              setReviewerProfile((profile) => ({ ...profile, [field]: value }))
            }
            onSourceSupportChange={(sourceSupport) =>
              setBatchDraft((draft) => ({ ...draft, sourceSupport }))
            }
            onStartBatch={startReviewBatch}
          />
        ) : activeRole === "developer" ? (
          <DeveloperDashboard language={language} overview={overview} />
        ) : activeRole === "management" ? (
          <ManagementDashboard language={language} />
        ) : activeRole === "audit" ? (
          <AuditDashboard language={language} />
        ) : (
          <DashboardPlaceholder
            language={language}
            role={activeRoleConfig}
            overview={overview}
            t={tr}
          />
        )}
      </div>
    </main>
  )
}
