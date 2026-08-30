import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  addReviewerParticipant,
  closeReviewerPlan,
  createImportedAnswerDataset,
  createReviewerPlan,
  deleteImportedAnswerDataset,
  getDeveloperJudgeCalibration,
  getDeveloperPrompts,
  getDeveloperRepeatConsistency,
  getDeveloperWorklist,
  getImportedAnswerDatasets,
  getQuestions,
  getIntegrationStatus,
  getStudyPackage,
  createStudyRun,
  rerunDeveloperJudge,
  runDeveloperDemoRun,
  runDeveloperImportedDatasetRun,
  runDeveloperJudgeCalibration,
  saveDeveloperPrompt,
  saveHumanReview,
  setReviewerExclusion,
} from "@/api"
import type {
  DashboardOverview,
  CitizenQuestion,
  DeveloperCalibrationHistoryItem,
  DeveloperPromptsResponse,
  DeveloperRun,
  DeveloperRunSettings,
  EvaluationTrace,
  ImportedDataset,
  IntegrationStatus,
  Language,
  PromptType,
  RepeatConsistencyResponse,
  ReviewerPlan,
} from "@/types"
import { downloadFile } from "@/components/shared/exportUtils"
import {
  getInitialDeveloperBatchId,
  getInitialDeveloperTraceId,
  getInitialWorklistFilter,
  replaceDeveloperUrlState,
} from "@/appMode"
import { TraceList } from "./TraceList"
import type { ImportedAnswerRecord } from "./importedAnswerImport"
import {
  buildWorklistItemWithTarget,
  filterWorklistItems,
  hydrateRunSettingsFromPromptVersions,
  resolveWorklistFilterForBatchSelection,
  type AdjudicationReviewPayload,
  type DeveloperLabTabId,
  type StudyRunSize,
  type WorklistFilter,
} from "./developerLabModel"
import {
  repeatConsistencyRequestForRun,
  type RepeatConsistencyRequest,
} from "./repeatConsistencyModel"

const defaultRunSettings: DeveloperRunSettings = {
  answer_prompt_text: "",
  answer_prompt_version: "",
  judge_mode: "",
  judge_model_name: "",
  judge_prompt_text: "",
  judge_prompt_version: "",
  model_name: "",
}

const CALIBRATION_POLL_ATTEMPTS = 60
const CALIBRATION_POLL_INTERVAL_MS = 3_000

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function isRunStillProcessing(run: DeveloperRun | null | undefined) {
  return run?.status === "running" || run?.status === "pending"
}

function runSettingsFromActiveRun(activeRun: DeveloperRun | null): Partial<DeveloperRunSettings> {
  const metadata = activeRun?.metadata || {}
  const settings: Partial<DeveloperRunSettings> = {}
  if (typeof metadata.answer_prompt_version === "string") {
    settings.answer_prompt_version = metadata.answer_prompt_version
  }
  if (typeof metadata.judge_mode === "string") {
    settings.judge_mode = metadata.judge_mode
  }
  if (typeof metadata.judge_model_name === "string") {
    settings.judge_model_name = metadata.judge_model_name
  }
  if (typeof metadata.judge_prompt_version === "string") {
    settings.judge_prompt_version = metadata.judge_prompt_version
  }
  if (typeof metadata.model_name === "string") {
    settings.model_name = metadata.model_name
  }
  return settings
}

export function DeveloperDashboard({
  language,
  overview,
}: {
  language: Language
  overview: DashboardOverview | null
}) {
  const [traces, setTraces] = useState<EvaluationTrace[]>([])
  const [batchHistory, setBatchHistory] = useState<DeveloperRun[]>([])
  const [calibrationTraces, setCalibrationTraces] = useState<EvaluationTrace[]>([])
  const [calibrationHistory, setCalibrationHistory] = useState<DeveloperCalibrationHistoryItem[]>([])
  const [selectedCalibrationBatchId, setSelectedCalibrationBatchId] = useState("")
  const [activeRun, setActiveRun] = useState<DeveloperRun | null>(null)
  const [developerPrompts, setDeveloperPrompts] = useState<DeveloperPromptsResponse | null>(null)
  const [importedDatasets, setImportedDatasets] = useState<ImportedDataset[]>([])
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null)
  const [runSettings, setRunSettings] = useState<DeveloperRunSettings>(defaultRunSettings)
  const [reviewerPlan, setReviewerPlan] = useState<ReviewerPlan | null>(null)
  const [repeatConsistency, setRepeatConsistency] = useState<RepeatConsistencyResponse | null>(null)
  const [questionCount, setQuestionCount] = useState(overview?.question_count ?? 0)
  const [questions, setQuestions] = useState<CitizenQuestion[]>([])
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
  const [studyRunSize, setStudyRunSize] = useState<StudyRunSize>("all")
  const [reviewerCount, setReviewerCount] = useState(2)
  const [reviewsPerQuestion, setReviewsPerQuestion] = useState(2)
  const [selectedTraceId, setSelectedTraceId] = useState(() => getInitialDeveloperTraceId())
  const [selectedBatchId, setSelectedBatchId] = useState("")
  const [worklistFilter, setWorklistFilter] = useState<WorklistFilter>(() => getInitialWorklistFilter())
  const [worklistReady, setWorklistReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [runningRunType, setRunningRunType] = useState<"calibration" | "demo" | "imported" | "selected" | "study" | "">("")
  const [rerunningJudgeTraceId, setRerunningJudgeTraceId] = useState("")
  const [savingAdjudicationTraceId, setSavingAdjudicationTraceId] = useState("")
  const [closingReviewerPlan, setClosingReviewerPlan] = useState(false)
  const [creatingReviewerPlan, setCreatingReviewerPlan] = useState(false)
  const [addingReviewerParticipant, setAddingReviewerParticipant] = useState(false)
  const [settingReviewerExclusion, setSettingReviewerExclusion] = useState("")
  const [exportingStudyPackage, setExportingStudyPackage] = useState(false)
  const [savingPromptType, setSavingPromptType] = useState<PromptType | "">("")
  const [error, setError] = useState("")
  const developerPromptsRef = useRef<DeveloperPromptsResponse | null>(null)
  const preparedDeveloperTabsRef = useRef<Set<DeveloperLabTabId>>(new Set())

  const loadWorklist = useCallback(
    async (
      batchId?: string,
      options: { keepSelectedTrace?: boolean; silent?: boolean } = {},
    ) => {
      if (!options.silent) {
        setLoading(true)
        setError("")
      }
      try {
        const response = await getDeveloperWorklist(batchId)
        setTraces(response.items)
        setActiveRun(response.active_run)
        setBatchHistory(response.batch_history || [])
        setSelectedBatchId(response.active_run?.batch_id || "")
        setRunSettings((current) => {
          const activeRunSettings = runSettingsFromActiveRun(response.active_run)
          const nextSettings = {
            ...current,
            answer_prompt_version: current.answer_prompt_version || activeRunSettings.answer_prompt_version || "",
            judge_model_name: current.judge_model_name || activeRunSettings.judge_model_name || "",
            judge_mode: current.judge_mode || activeRunSettings.judge_mode || "",
            judge_prompt_version: current.judge_prompt_version || activeRunSettings.judge_prompt_version || "",
            model_name: current.model_name || activeRunSettings.model_name || "",
          }
          return developerPromptsRef.current
            ? hydrateRunSettingsFromPromptVersions(nextSettings, developerPromptsRef.current)
            : nextSettings
        })
        setReviewerPlan(response.reviewer_plan || null)
        setQuestionCount(response.question_count)
        setWorklistReady(true)
        if (!options.keepSelectedTrace) {
          setSelectedTraceId("")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load traces")
      } finally {
        if (!options.silent) {
          setLoading(false)
        }
      }
    },
    [],
  )

  const loadPrompts = useCallback(async () => {
    try {
      const response = await getDeveloperPrompts()
      developerPromptsRef.current = response
      setDeveloperPrompts(response)
      setRunSettings((current) =>
        hydrateRunSettingsFromPromptVersions(
          {
            ...current,
            answer_prompt_version: response.defaults.answer_prompt_version,
            judge_model_name: response.defaults.judge_model_name,
            judge_mode: response.defaults.judge_mode,
            judge_prompt_version: response.defaults.judge_prompt_version,
            model_name: response.defaults.model_name,
          },
          response,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load prompt versions")
    }
  }, [])

  const loadCalibrationRun = useCallback(async (batchId?: string) => {
    setError("")
    try {
      const response = await getDeveloperJudgeCalibration(batchId)
      setCalibrationHistory(response.history || [])
      setCalibrationTraces(response.items)
      setSelectedCalibrationBatchId(response.calibration_run?.batch_id || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load judge calibration history")
    }
  }, [])

  const loadIntegrationStatus = useCallback(async () => {
    try {
      const response = await getIntegrationStatus()
      setIntegrationStatus(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load integration status")
    }
  }, [])

  const loadQuestions = useCallback(async () => {
    try {
      const response = await getQuestions()
      setQuestions(response)
      setQuestionCount((current) => current || response.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load question bank")
    }
  }, [])

  const loadImportedDatasets = useCallback(async () => {
    try {
      const response = await getImportedAnswerDatasets({ includeArchived: true })
      setImportedDatasets(response.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load imported datasets")
    }
  }, [])

  useEffect(() => {
    loadWorklist(getInitialDeveloperBatchId(), {
      keepSelectedTrace: Boolean(getInitialDeveloperTraceId()),
    }).catch(() => undefined)
  }, [loadWorklist])

  const prepareDeveloperTab = useCallback((tabId: DeveloperLabTabId) => {
    if (preparedDeveloperTabsRef.current.has(tabId)) return
    preparedDeveloperTabsRef.current.add(tabId)

    if (tabId === "run_console") {
      loadPrompts().catch(() => undefined)
      loadQuestions().catch(() => undefined)
      loadImportedDatasets().catch(() => undefined)
    }

    if (tabId === "judge_calibration") {
      loadPrompts().catch(() => undefined)
      loadCalibrationRun().catch(() => undefined)
    }

    if (tabId === "integrations") {
      loadIntegrationStatus().catch(() => undefined)
    }
  }, [loadCalibrationRun, loadImportedDatasets, loadIntegrationStatus, loadPrompts, loadQuestions])

  useEffect(() => {
    if (!selectedTraceId || !traces.length) return
    if (traces.some((trace) => trace.trace_id === selectedTraceId)) return
    setSelectedTraceId("")
    replaceDeveloperUrlState({ traceId: "" })
  }, [selectedTraceId, traces])

  useEffect(() => {
    if (activeRun?.status !== "running" || !activeRun.batch_id) return undefined
    const intervalId = window.setInterval(() => {
      loadWorklist(activeRun.batch_id, { keepSelectedTrace: true, silent: true }).catch(() => undefined)
    }, 1500)
    return () => window.clearInterval(intervalId)
  }, [activeRun?.batch_id, activeRun?.status, loadWorklist])

  // Repeat-run judge consistency only applies to imported datasets (they carry
  // metadata.import_id and can be re-judged as repeat runs). We pass the active
  // run's own judge settings as filters so only comparable runs are pooled. A
  // stable JSON key keeps this to one fetch per import-id/filter change; silent
  // polling of a running batch does not retrigger it. Errors/non-imported runs
  // clear the data so the new UI simply does not render.
  const repeatRequest = repeatConsistencyRequestForRun(activeRun)
  const repeatRequestKey = repeatRequest ? JSON.stringify(repeatRequest) : ""
  useEffect(() => {
    if (!repeatRequestKey) {
      setRepeatConsistency(null)
      return undefined
    }
    const request = JSON.parse(repeatRequestKey) as RepeatConsistencyRequest
    let cancelled = false
    getDeveloperRepeatConsistency(request)
      .then((data) => {
        if (!cancelled) setRepeatConsistency(data)
      })
      .catch(() => {
        if (!cancelled) setRepeatConsistency(null)
      })
    return () => {
      cancelled = true
    }
  }, [repeatRequestKey])

  const runDemo = useCallback(async () => {
    setRunningRunType("demo")
    setError("")
    try {
      const response = await runDeveloperDemoRun(runSettings)
      setTraces(response.items)
      setActiveRun(response.active_run)
      setBatchHistory(response.batch_history || [])
      setSelectedBatchId(response.active_run?.batch_id || "")
      setReviewerPlan(response.reviewer_plan || null)
      setQuestionCount(response.question_count)
      setSelectedTraceId("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run demo batch")
    } finally {
      setRunningRunType("")
    }
  }, [runSettings])

  const runStudy = useCallback(async () => {
    const fullQuestionCount = questions.length || questionCount || overview?.question_count || 0
    const limit = studyRunSize === "test" ? 5 : undefined
    if (studyRunSize === "all") {
      const confirmed = window.confirm(
        `Create the full frozen study run with all ${fullQuestionCount || "available"} questions? This may trigger about 100 OpenAI calls when OpenAI answer generation and judging are enabled.`,
      )
      if (!confirmed) return
    }
    setRunningRunType("study")
    setError("")
    try {
      const response = await createStudyRun(runSettings, [], limit)
      setTraces(response.items)
      setActiveRun(response.active_run)
      setBatchHistory(response.batch_history || [])
      setSelectedBatchId(response.active_run?.batch_id || "")
      setReviewerPlan(response.reviewer_plan || null)
      setQuestionCount(response.question_count)
      setSelectedTraceId("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create frozen study run")
    } finally {
      setRunningRunType("")
    }
  }, [overview?.question_count, questionCount, questions.length, runSettings, studyRunSize])

  const runSelectedQuestions = useCallback(async () => {
    if (!selectedQuestionIds.length) return
    setRunningRunType("selected")
    setError("")
    try {
      const response = await runDeveloperDemoRun(runSettings, selectedQuestionIds)
      setTraces(response.items)
      setActiveRun(response.active_run)
      setBatchHistory(response.batch_history || [])
      setSelectedBatchId(response.active_run?.batch_id || "")
      setReviewerPlan(response.reviewer_plan || null)
      setQuestionCount(response.question_count)
      setSelectedTraceId("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run selected question batch")
    } finally {
      setRunningRunType("")
    }
  }, [runSettings, selectedQuestionIds])

  const saveImportedAnswers = useCallback(async (filename: string, records: ImportedAnswerRecord[]) => {
    setError("")
    try {
      const dataset = await createImportedAnswerDataset(filename, records)
      setImportedDatasets((current) => [dataset, ...current.filter((item) => item.import_id !== dataset.import_id)])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save imported dataset")
      throw err
    }
  }, [])

  const deleteImportedAnswers = useCallback(async (importId: string) => {
    setError("")
    try {
      const result = await deleteImportedAnswerDataset(importId)
      if (result.deleted) {
        setImportedDatasets((current) => current.filter((item) => item.import_id !== importId))
      } else if (result.dataset) {
        setImportedDatasets((current) =>
          current.map((item) => (item.import_id === importId ? result.dataset as ImportedDataset : item)),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete imported dataset")
      throw err
    }
  }, [])

  const runImportedDataset = useCallback(async (importId: string) => {
    setRunningRunType("imported")
    setError("")
    try {
      const response = await runDeveloperImportedDatasetRun(importId, runSettings)
      setTraces(response.items)
      setActiveRun(response.active_run)
      setBatchHistory(response.batch_history || [])
      setSelectedBatchId(response.active_run?.batch_id || "")
      setReviewerPlan(response.reviewer_plan || null)
      setQuestionCount(response.question_count)
      setSelectedTraceId("")
      await loadImportedDatasets()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create imported evaluation run")
      throw err
    } finally {
      setRunningRunType("")
    }
  }, [loadImportedDatasets, runSettings])

  const runCalibration = useCallback(async () => {
    setRunningRunType("calibration")
    setError("")
    try {
      let response = await runDeveloperJudgeCalibration(runSettings)
      setCalibrationTraces(response.items)
      setCalibrationHistory(response.history || [])
      const batchId = response.calibration_run?.batch_id || ""
      setSelectedCalibrationBatchId(batchId)
      for (let attempt = 0; batchId && isRunStillProcessing(response.calibration_run) && attempt < CALIBRATION_POLL_ATTEMPTS; attempt += 1) {
        await wait(CALIBRATION_POLL_INTERVAL_MS)
        response = await getDeveloperJudgeCalibration(batchId)
        setCalibrationTraces(response.items)
        setCalibrationHistory(response.history || [])
      }
      await loadWorklist()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run judge calibration")
    } finally {
      setRunningRunType("")
    }
  }, [loadWorklist, runSettings])

  const selectCalibrationRun = useCallback(async (batchId: string) => {
    setSelectedCalibrationBatchId(batchId)
    await loadCalibrationRun(batchId)
  }, [loadCalibrationRun])

  const selectResultsBatch = useCallback(async (batchId: string) => {
    const nextFilter = resolveWorklistFilterForBatchSelection(worklistFilter, selectedBatchId, batchId)
    setWorklistFilter(nextFilter)
    replaceDeveloperUrlState({ batchId, filter: nextFilter, traceId: "" })
    await loadWorklist(batchId)
  }, [loadWorklist, selectedBatchId, worklistFilter])

  const updateWorklistFilter = useCallback((filter: WorklistFilter) => {
    setWorklistFilter(filter)
    replaceDeveloperUrlState({ filter })
  }, [])

  const selectTrace = useCallback((traceId: string) => {
    setSelectedTraceId(traceId)
    replaceDeveloperUrlState({ tab: "results_cases", traceId })
  }, [])

  const backToCases = useCallback(() => {
    setSelectedTraceId("")
    replaceDeveloperUrlState({ traceId: "" })
  }, [])

  const updateRunSettings = useCallback((nextSettings: Partial<DeveloperRunSettings>) => {
    setRunSettings((current) => ({ ...current, ...nextSettings }))
  }, [])

  const savePrompt = useCallback(
    async ({
      promptText,
      promptType,
      promptVersion,
    }: {
      promptText: string
      promptType: PromptType
      promptVersion: string
    }) => {
      setSavingPromptType(promptType)
      setError("")
      try {
        const response = await saveDeveloperPrompt({
          modelName: promptType === "answer" ? runSettings.model_name : runSettings.judge_model_name,
          notes: "Saved from Setup & Run.",
          promptText,
          promptType,
          promptVersion,
        })
        developerPromptsRef.current = response
        setDeveloperPrompts(response)
        setRunSettings((current) =>
          promptType === "answer"
            ? {
                ...current,
                answer_prompt_text: promptText,
                answer_prompt_version: promptVersion,
              }
            : {
                ...current,
                judge_prompt_text: promptText,
                judge_prompt_version: promptVersion,
              },
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save prompt version")
      } finally {
        setSavingPromptType("")
      }
    },
    [runSettings],
  )

  const createPlan = useCallback(async () => {
    const batchId = activeRun?.batch_id || selectedBatchId
    setCreatingReviewerPlan(true)
    setError("")
    try {
      const nextPlan = await createReviewerPlan({
        baseUrl: `${window.location.origin}/`,
        batchId,
        reviewerCount,
        reviewsPerQuestion,
      })
      setReviewerPlan(nextPlan)
      await loadWorklist(batchId || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create reviewer links")
    } finally {
      setCreatingReviewerPlan(false)
    }
  }, [activeRun?.batch_id, loadWorklist, reviewerCount, reviewsPerQuestion, selectedBatchId])

  const closePlan = useCallback(async () => {
    const batchId = activeRun?.batch_id || selectedBatchId
    setClosingReviewerPlan(true)
    setError("")
    try {
      const nextPlan = await closeReviewerPlan(batchId)
      setReviewerPlan(nextPlan)
      await loadWorklist(batchId || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close reviewer links")
    } finally {
      setClosingReviewerPlan(false)
    }
  }, [activeRun?.batch_id, loadWorklist, selectedBatchId])

  const addParticipant = useCallback(
    async (sourceParticipant: string) => {
      const batchId = activeRun?.batch_id || selectedBatchId
      setAddingReviewerParticipant(true)
      setError("")
      try {
        const nextPlan = await addReviewerParticipant(sourceParticipant, batchId || undefined)
        setReviewerPlan(nextPlan)
        await loadWorklist(batchId || undefined)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add replacement reviewer")
      } finally {
        setAddingReviewerParticipant(false)
      }
    },
    [activeRun?.batch_id, loadWorklist, selectedBatchId],
  )

  const changeReviewerExclusion = useCallback(
    async (participant: string, excluded: boolean, reason?: string, replacedBy?: string) => {
      const batchId = activeRun?.batch_id || selectedBatchId
      setSettingReviewerExclusion(participant)
      setError("")
      try {
        const nextPlan = await setReviewerExclusion(
          participant,
          excluded,
          reason,
          replacedBy,
          batchId || undefined,
        )
        setReviewerPlan(nextPlan)
        await loadWorklist(batchId || undefined)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update reviewer exclusion")
      } finally {
        setSettingReviewerExclusion("")
      }
    },
    [activeRun?.batch_id, loadWorklist, selectedBatchId],
  )

  const exportStudyPackage = useCallback(async () => {
    const batchId = activeRun?.batch_id || selectedBatchId
    if (!batchId) {
      setError("Select a saved run before exporting the study package")
      return
    }
    setExportingStudyPackage(true)
    setError("")
    try {
      const studyPackage = await getStudyPackage(batchId)
      downloadFile(
        `revia_study_package_${batchId}.json`,
        "application/json;charset=utf-8",
        JSON.stringify(studyPackage, null, 2),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export study package")
    } finally {
      setExportingStudyPackage(false)
    }
  }, [activeRun?.batch_id, selectedBatchId])

  const rerunJudge = useCallback(
    async (traceId: string, settings: DeveloperRunSettings) => {
      setRerunningJudgeTraceId(traceId)
      setError("")
      try {
        const updatedTrace = await rerunDeveloperJudge(traceId, settings)
        setTraces((current) =>
          current.map((trace) => (trace.trace_id === updatedTrace.trace_id ? updatedTrace : trace)),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not rerun judge")
      } finally {
        setRerunningJudgeTraceId("")
      }
    },
    [],
  )

  const saveAdjudication = useCallback(
    async (traceId: string, payload: AdjudicationReviewPayload) => {
      setSavingAdjudicationTraceId(traceId)
      setError("")
      try {
        const updatedTrace = await saveHumanReview(traceId, payload)
        setTraces((current) =>
          current.map((trace) => (trace.trace_id === updatedTrace.trace_id ? updatedTrace : trace)),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save adjudication decision")
      } finally {
        setSavingAdjudicationTraceId("")
      }
    },
    [],
  )

  const reviewTargets = useMemo(() => reviewerPlan?.case_review_targets || {}, [reviewerPlan])
  const worklistItems = useMemo(
    () => traces.map((trace) => buildWorklistItemWithTarget(trace, reviewTargets[trace.trace_id])),
    [reviewTargets, traces],
  )
  const filteredItems = useMemo(
    () => filterWorklistItems(worklistItems, worklistFilter),
    [worklistFilter, worklistItems],
  )
  const selectedTrace = useMemo(
    () => worklistItems.find((item) => item.trace.trace_id === selectedTraceId)?.trace,
    [selectedTraceId, worklistItems],
  )
  const activeRunRunning = activeRun?.status === "running"

  return (
    <section className="w-full">
      <TraceList
        activeFilter={worklistFilter}
        activeRun={activeRun}
        batchHistory={batchHistory}
        error={error}
        overview={overview}
        questions={questions}
        questionCount={questionCount}
        allItems={worklistItems}
        calibrationHistory={calibrationHistory}
        calibrationItems={calibrationTraces}
        selectedCalibrationBatchId={selectedCalibrationBatchId}
        selectedBatchId={selectedBatchId}
        items={filteredItems}
        integrationStatus={integrationStatus}
        importedDatasets={importedDatasets}
        language={language}
        loading={loading || runningRunType !== "" || activeRunRunning}
        closingReviewerPlan={closingReviewerPlan}
        creatingReviewerPlan={creatingReviewerPlan}
        addingReviewerParticipant={addingReviewerParticipant}
        settingReviewerExclusion={settingReviewerExclusion}
        canPrepareSecondaryTabs={worklistReady}
        developerPrompts={developerPrompts}
        exportingStudyPackage={exportingStudyPackage}
        reviewerCount={reviewerCount}
        reviewerPlan={reviewerPlan}
        reviewsPerQuestion={reviewsPerQuestion}
        runningRunType={runningRunType}
        runSettings={runSettings}
        studyRunSize={studyRunSize}
        rerunningJudgeTraceId={rerunningJudgeTraceId}
        repeatConsistency={repeatConsistency}
        savingAdjudicationTraceId={savingAdjudicationTraceId}
        savingPromptType={savingPromptType}
        selectedTrace={selectedTrace || null}
        onCloseReviewerPlan={closePlan}
        onCreateReviewerPlan={createPlan}
        onAddReviewerParticipant={addParticipant}
        onSetReviewerExclusion={changeReviewerExclusion}
        onExportStudyPackage={exportStudyPackage}
        onFilterChange={updateWorklistFilter}
        onPrepareTab={prepareDeveloperTab}
        onRefresh={() => loadWorklist(selectedBatchId || undefined)}
        onRunDemo={runDemo}
        onRunStudyRun={runStudy}
        onRunCalibration={runCalibration}
        onDeleteImportedDataset={deleteImportedAnswers}
        onRunImportedDataset={runImportedDataset}
        onSaveImportedAnswers={saveImportedAnswers}
        onRerunJudge={rerunJudge}
        onSaveAdjudication={saveAdjudication}
        onRunSelectedQuestions={runSelectedQuestions}
        onRunSettingsChange={updateRunSettings}
        onStudyRunSizeChange={setStudyRunSize}
        onSavePrompt={savePrompt}
        onSelectCalibrationRun={selectCalibrationRun}
        onSelectResultsBatch={selectResultsBatch}
        onReviewerCountChange={setReviewerCount}
        onReviewsPerQuestionChange={setReviewsPerQuestion}
        onBackToCases={backToCases}
        onSelectTrace={selectTrace}
        onSelectedQuestionIdsChange={setSelectedQuestionIds}
        selectedQuestionIds={selectedQuestionIds}
      />
    </section>
  )
}
