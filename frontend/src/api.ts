import type {
  CitizenQuestion,
  DashboardOverview,
  DeveloperPromptsResponse,
  DeveloperCalibrationResponse,
  DeveloperRunSettings,
  DeveloperWorklistResponse,
  EvaluationTrace,
  ImportedDataset,
  ImportedDatasetsResponse,
  ImprovementSuggestionsResponse,
  IntegrationStatus,
  LlmImprovementSuggestions,
  PromptType,
  RepeatConsistencyResponse,
  ReviewerAssignmentResponse,
  ReviewerPlan,
  TraceListResponse,
} from "./types"
import type { ImportedAnswerRecord } from "./components/developer/importedAnswerImport"

const API_BASE = import.meta.env.VITE_API_BASE ?? ""

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers =
    options.body === undefined
      ? options.headers
      : { "Content-Type": "application/json", ...(options.headers || {}) }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })
  const responseText = await response.text()
  let data: unknown = {}
  if (responseText.trim()) {
    try {
      data = JSON.parse(responseText)
    } catch {
      const detail = responseText.trim().slice(0, 500)
      const message = detail || response.statusText || "Empty response"
      if (!response.ok) {
        throw new Error(`API returned a non-JSON error response (${response.status}): ${message}`)
      }
      throw new Error(`API returned a non-JSON response (${response.status}): ${message}`)
    }
  }
  if (!response.ok) {
    const errorMessage =
      typeof data === "object" && data && "error" in data
        ? String((data as { error?: unknown }).error || response.statusText)
        : response.statusText
    throw new Error(errorMessage)
  }
  return data as T
}

export async function getOverview() {
  return request<DashboardOverview>("/dashboard/overview")
}

export async function getIntegrationStatus() {
  return request<IntegrationStatus>("/api/v1/integration/status")
}

export async function getQuestions() {
  const data = await request<{ items: CitizenQuestion[] }>("/questions?limit=100")
  return data.items
}

export async function getTraces(options: { disagreementsOnly?: boolean; limit?: number } = {}) {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 50),
  })
  if (options.disagreementsOnly) {
    params.set("disagreements", "true")
  }
  return request<TraceListResponse>(`/traces?${params.toString()}`)
}

export async function getDeveloperWorklist(batchId?: string) {
  const params = new URLSearchParams()
  if (batchId) {
    params.set("batch_id", batchId)
  }
  const suffix = params.toString() ? `?${params.toString()}` : ""
  return request<DeveloperWorklistResponse>(`/developer/worklist${suffix}`)
}

export async function getDeveloperPrompts() {
  return request<DeveloperPromptsResponse>("/developer/prompts")
}

export async function getDeveloperRepeatConsistency(options: {
  importId?: string
  batchIds?: string[]
  judgePromptVersion?: string
  judgeModelName?: string
  judgeContextLabel?: string
}) {
  const params = new URLSearchParams()
  if (options.importId) {
    params.set("import_id", options.importId)
  }
  if (options.batchIds?.length) {
    params.set("batch_ids", options.batchIds.join(","))
  }
  if (options.judgePromptVersion) {
    params.set("judge_prompt_version", options.judgePromptVersion)
  }
  if (options.judgeModelName) {
    params.set("judge_model_name", options.judgeModelName)
  }
  if (options.judgeContextLabel) {
    params.set("judge_context_label", options.judgeContextLabel)
  }
  return request<RepeatConsistencyResponse>(`/developer/repeat-consistency?${params.toString()}`)
}

export async function getDeveloperImprovementSuggestions(batchId?: string) {
  const params = new URLSearchParams()
  if (batchId) {
    params.set("batch_id", batchId)
  }
  const suffix = params.toString() ? `?${params.toString()}` : ""
  return request<ImprovementSuggestionsResponse>(`/developer/improvement-suggestions${suffix}`)
}

export async function generateDeveloperImprovementSuggestions(batchId?: string) {
  return request<LlmImprovementSuggestions>("/developer/improvement-suggestions/generate", {
    method: "POST",
    body: JSON.stringify({ batch_id: batchId }),
  })
}

export async function saveDeveloperPrompt({
  modelName,
  notes,
  promptText,
  promptType,
  promptVersion,
}: {
  modelName: string
  notes: string
  promptText: string
  promptType: PromptType
  promptVersion: string
}) {
  return request<DeveloperPromptsResponse>("/developer/prompts", {
    method: "POST",
    body: JSON.stringify({
      model_name: modelName,
      notes,
      prompt_text: promptText,
      prompt_type: promptType,
      prompt_version: promptVersion,
    }),
  })
}

export async function runDeveloperTestRun(limit = 5, settings?: DeveloperRunSettings) {
  return request<DeveloperWorklistResponse>("/developer/test-run", {
    method: "POST",
    body: JSON.stringify({ limit, settings }),
  })
}

export async function runDeveloperDemoRun(settings?: DeveloperRunSettings, questionIds: string[] = []) {
  return request<DeveloperWorklistResponse>("/developer/demo-run", {
    method: "POST",
    body: JSON.stringify({ settings, question_ids: questionIds }),
  })
}

export async function createStudyRun(settings?: DeveloperRunSettings, questionIds: string[] = [], limit?: number) {
  return request<DeveloperWorklistResponse>("/developer/study-run", {
    method: "POST",
    body: JSON.stringify({ settings, question_ids: questionIds, limit }),
  })
}

export async function runDeveloperImportedAnswerRun(
  records: ImportedAnswerRecord[],
  settings?: DeveloperRunSettings,
) {
  return request<DeveloperWorklistResponse>("/developer/imported-answer-run", {
    method: "POST",
    body: JSON.stringify({
      settings,
      records: records.map(importedAnswerRecordPayload),
    }),
  })
}

function importedAnswerRecordPayload(record: ImportedAnswerRecord) {
  return {
    answer: record.answer,
    case_id: record.caseId,
    external_system: record.externalSystem,
    human_review: record.humanReview
      ? {
          comment: record.humanReview.comment,
          decision: record.humanReview.decision,
          label: record.humanReview.label,
          reviewer_id: record.humanReview.reviewerId,
          score: record.humanReview.score,
        }
      : undefined,
    question: record.question,
    service_id: record.serviceId,
    service_title: record.serviceTitle,
    source_context: record.sourceContext,
    source_url: record.sourceUrl,
    target_section: record.targetSection,
  }
}

export async function getImportedAnswerDatasets(options: { includeArchived?: boolean } = {}) {
  const params = new URLSearchParams()
  if (options.includeArchived) {
    params.set("include_archived", "true")
  }
  const suffix = params.toString() ? `?${params.toString()}` : ""
  return request<ImportedDatasetsResponse>(`/developer/imported-datasets${suffix}`)
}

export async function getImportedAnswerDataset(importId: string) {
  return request<ImportedDataset>(`/developer/imported-datasets/${encodeURIComponent(importId)}`)
}

export async function createImportedAnswerDataset(filename: string, records: ImportedAnswerRecord[]) {
  return request<ImportedDataset>("/developer/imported-datasets", {
    method: "POST",
    body: JSON.stringify({
      filename,
      records: records.map(importedAnswerRecordPayload),
    }),
  })
}

export async function deleteImportedAnswerDataset(importId: string) {
  return request<{ deleted: boolean; import_id?: string; dataset?: ImportedDataset }>(
    `/developer/imported-datasets/${encodeURIComponent(importId)}`,
    { method: "DELETE" },
  )
}

export async function runDeveloperImportedDatasetRun(importId: string, settings?: DeveloperRunSettings) {
  return request<DeveloperWorklistResponse>(
    `/developer/imported-datasets/${encodeURIComponent(importId)}/run`,
    {
      method: "POST",
      body: JSON.stringify({ settings }),
    },
  )
}

export async function runDeveloperJudgeCalibration(settings?: DeveloperRunSettings) {
  return request<DeveloperCalibrationResponse>("/developer/judge-calibration", {
    method: "POST",
    body: JSON.stringify({ settings }),
  })
}

export async function rerunDeveloperJudge(traceId: string, settings: DeveloperRunSettings) {
  return request<EvaluationTrace>("/developer/judge-rerun", {
    method: "POST",
    body: JSON.stringify({ trace_id: traceId, settings }),
  })
}

export async function getDeveloperJudgeCalibration(batchId?: string) {
  const params = new URLSearchParams({ limit: "20" })
  if (batchId) {
    params.set("batch_id", batchId)
  }
  return request<DeveloperCalibrationResponse>(`/developer/judge-calibration?${params.toString()}`)
}

export async function createReviewerPlan({
  baseUrl,
  batchId,
  reviewerCount,
  reviewsPerQuestion,
}: {
  baseUrl: string
  batchId?: string
  reviewerCount: number
  reviewsPerQuestion: number
}) {
  return request<ReviewerPlan>("/developer/reviewer-plan", {
    method: "POST",
    body: JSON.stringify({
      base_url: baseUrl,
      batch_id: batchId || "",
      reviewer_count: reviewerCount,
      reviews_per_question: reviewsPerQuestion,
    }),
  })
}

export async function closeReviewerPlan(batchId = "") {
  return request<ReviewerPlan>("/developer/reviewer-plan/close", {
    method: "POST",
    body: JSON.stringify({ batch_id: batchId }),
  })
}

export async function addReviewerParticipant(sourceParticipant: string, batchId?: string) {
  return request<ReviewerPlan>("/developer/reviewer-plan/participants", {
    method: "POST",
    body: JSON.stringify({
      source_participant: sourceParticipant,
      batch_id: batchId || "",
    }),
  })
}

export async function setReviewerExclusion(
  participant: string,
  excluded: boolean,
  reason?: string,
  replacedBy?: string,
  batchId?: string,
) {
  return request<ReviewerPlan>("/developer/reviewer-plan/participants/exclude", {
    method: "POST",
    body: JSON.stringify({
      participant,
      excluded,
      reason: reason || "",
      replaced_by: replacedBy || "",
      batch_id: batchId || "",
    }),
  })
}

export async function getStudyPackage(batchId: string) {
  return request<unknown>(
    `/api/v1/runs/${encodeURIComponent(batchId)}/exports/study-package.json`,
  )
}

export async function getReviewerAssignment(participant: string, batchId = "", token = "") {
  const params = new URLSearchParams({ participant })
  if (batchId.trim()) {
    params.set("batch_id", batchId.trim())
  }
  if (token.trim()) {
    params.set("token", token.trim())
  }
  return request<ReviewerAssignmentResponse>(`/reviewer/assignment?${params.toString()}`)
}

export async function getTrace(traceId: string) {
  return request<EvaluationTrace>(`/traces/${encodeURIComponent(traceId)}`)
}

export async function generateAnswer(questionId: string) {
  return request<EvaluationTrace>("/answers/generate", {
    method: "POST",
    body: JSON.stringify({ question_id: questionId }),
  })
}

export async function evaluateCustomAnswer(questionId: string, answerText: string) {
  return request<EvaluationTrace>("/evaluations", {
    method: "POST",
    body: JSON.stringify({ question_id: questionId, answer_text: answerText }),
  })
}

export async function saveHumanReview(
  traceId: string,
  payload: {
    final_decision: string
    label: string
    reviewer_confidence?: string
    reviewer_id?: string
    participant_id?: string
    token?: string
    batch_id?: string
    is_adjudication?: boolean
    adjudication?: boolean
    adjudication_status?: string
    reviewer_profile?: Record<string, string>
    criteria: Record<string, number>
    comment_text: string
    suggested_correction: string
    human_score: number
    duration_seconds?: number
  },
) {
  const endpoint = payload.participant_id ? "/reviewer/reviews/human" : "/reviews/human"
  return request<EvaluationTrace>(endpoint, {
    method: "POST",
    body: JSON.stringify({ trace_id: traceId, ...payload }),
  })
}
