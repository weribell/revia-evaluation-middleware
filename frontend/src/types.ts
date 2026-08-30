export type ReviewDecision = "accept" | "needs_edit" | "reject"
export type SourceSupport = "not_checked" | "supported" | "partly_supported" | "unsupported"
export type Language = "de" | "en"

export interface JudgeCriterionResult {
  score: number
  label: string
  explanation: string
}

export type EvaluationCriterionKey =
  | "factual_correctness"
  | "source_support"
  | "completeness"
  | "clarity_actionability"
  | "public_service_tone"
  | "uncertainty_handling"

export interface CitizenQuestion {
  question_id: string
  service_id: string
  service_title: string
  source_url: string
  source_excerpt?: string
  sample_label?: string
  question_text: string
  target_section: string
  style_label: string
  style_description: string
  edge_case_label: string
  generation_method?: string
  intent_type: string
  intent_count: number
  requires_clarification: boolean
  expected_answer_behavior: string
  difficulty_label: string
}

export interface RetrievalResult {
  service_title: string
  section_name: string
  chunk_text: string
  source_ref: string
  rank: number
  intent_role?: string
  retrieval_score?: number
}

export interface HumanReview {
  review_id?: string
  trace_id?: string
  reviewer_id?: string
  reviewer_role?: string
  // Read-time annotation set by the API when the review's reviewer is excluded
  // from the plan. Never persisted; excluded reviews are hidden from aggregates
  // but shown (with a badge) in audit/case-detail display contexts.
  excluded?: boolean
  is_adjudication?: boolean
  adjudication_status?: string
  final_decision: ReviewDecision
  label: SourceSupport
  human_score: number
  criteria: Record<string, number>
  comment_text: string
  suggested_correction: string
  reviewer_confidence?: string
  reviewer_profile?: Record<string, string>
  submitted_at: string
}

export interface EvaluationTrace {
  trace_id: string
  created_at?: string
  variant?: string
  calibration?: {
    calibration_id: string
    expected_final_decision: ReviewDecision
    expected_criteria_max?: Partial<Record<EvaluationCriterionKey, number>>
    expected_low_criteria: EvaluationCriterionKey[]
    fault_type: string
    note?: string
    status?: string
    actual_final_decision?: ReviewDecision
    failure_reasons?: string[]
    missed_criteria?: EvaluationCriterionKey[]
  }
  citizen_question: CitizenQuestion
  service_entry?: {
    service_id: string
    title: string
    source_url: string
    // Imported/synthetic services are built server-side with a plain `url`
    // field (see prototype/api_trace.py); the audit source resolver reads it.
    url?: string
  }
  generated_answer: {
    answer_text: string
    generation_mode: string
    model_name: string
    prompt_version: string
    answer_prompt_version?: string
    answer_prompt_text?: string
  }
  automated_evaluation: JudgeEvaluation
  judge_evaluations?: JudgeEvaluation[]
  retrieval_result: RetrievalResult
  retrieval_results?: RetrievalResult[]
  human_reviews?: HumanReview[]
  mock_human_review?: HumanReview | null
  disagreement_case?: {
    flag_reason: string
    severity: string
    disagreement_type?: string
    created_at?: string
  } | null
}

export interface TokenUsage {
    completion_tokens?: number
    output_tokens?: number
    prompt_tokens?: number
    input_tokens?: number
    total_tokens?: number
    input_tokens_details?: {
      cached_tokens?: number
    }
    output_tokens_details?: {
      reasoning_tokens?: number
    }
}

export interface OpenAICostEstimate {
    currency?: string
    estimated_cost_usd?: number | null
    pricing_checked_at?: string
    pricing_source?: string
    status?: string
}

export interface JudgeEvaluation {
    auto_eval_id?: string
    trace_id?: string
    label: string
    faithfulness_score: number
    relevance_score: number
    judge_score: number
    evaluation_mode: string
    explanation: string
    final_decision?: ReviewDecision
    raw_final_decision?: string
    post_processing_reasons?: string[]
    contradicted_claims?: string[]
    unsupported_claims?: string[]
    missing_or_incomplete_points?: string[]
    clarity_or_tone_problems?: string[]
    context_limitations?: string[]
    criteria?: Partial<Record<EvaluationCriterionKey, JudgeCriterionResult>> &
      Record<string, JudgeCriterionResult | undefined>
    created_at?: string
    evaluation_role?: "baseline" | "rerun" | string
    judge_rerun_id?: string
    judge_model_name?: string
    judge_prompt_version?: string
    judge_prompt_text?: string
    judge_schema_version?: string
    rerun_of_auto_eval_id?: string
    evaluated_at?: string
    token_usage?: TokenUsage
    usage?: TokenUsage
    usage_metadata?: TokenUsage
    cost_estimate?: OpenAICostEstimate
}

export interface TraceListResponse {
  count: number
  limit: number
  offset: number
  items: EvaluationTrace[]
}

export interface DeveloperRun {
  batch_id: string
  batch_type: string
  status: string
  question_count: number
  created_at: string
  completed_at?: string | null
  metadata?: Record<string, unknown>
}

export type PromptType = "answer" | "judge"

export interface PromptVersion {
  created_at: string
  model_name: string
  notes: string
  prompt_text: string
  prompt_type: PromptType
  prompt_version: string
}

export interface DeveloperPromptDefaults {
  answer_prompt_text: string
  answer_prompt_version: string
  judge_mode: string
  judge_model_name: string
  judge_prompt_text: string
  judge_prompt_version: string
  model_name: string
}

export interface DeveloperPromptsResponse {
  defaults: DeveloperPromptDefaults
  items: PromptVersion[]
}

export interface DeveloperRunSettings {
  answer_prompt_text: string
  answer_prompt_version: string
  judge_mode: string
  judge_model_name: string
  judge_prompt_text: string
  judge_prompt_version: string
  model_name: string
}

export interface ImportedDatasetRecord {
  answer?: string
  answer_text?: string
  case_id?: string
  external_system?: string
  human_review?: Partial<HumanReview> & {
    comment?: string
    decision?: ReviewDecision
    label?: SourceSupport
    reviewer_id?: string
    score?: number
  }
  question?: string
  question_text?: string
  service_id?: string
  service_title?: string
  source_context?: string
  source_url?: string
  target_section?: string
}

export interface ImportedDataset {
  import_id: string
  filename: string
  status: "draft" | "used" | "archived" | string
  row_count: number
  human_label_count: number
  source_context_count: number
  created_at: string
  updated_at: string
  used_batch_id?: string | null
  metadata?: Record<string, unknown>
  records?: ImportedDatasetRecord[]
}

export interface ImportedDatasetsResponse {
  items: ImportedDataset[]
}

export interface ReviewerPlanParticipant {
  assigned_trace_ids: string[]
  completed_reviews: number
  participant_id: string
  review_url: string
  // Per-participant capability token embedded in review_url. Present in the
  // developer-facing plan; stripped from the reviewer assignment response.
  token?: string
  // Transparent exclusion of a reviewer from the primary analysis. The review
  // data itself is never deleted; the participant row stays visible with a badge.
  excluded?: boolean
  excluded_reason?: string
  replaced_by?: string
}

export interface ReviewerPlan {
  batch_id?: string
  case_review_targets: Record<string, number>
  closed_at?: string
  created_at?: string
  // Convenience list of excluded participant ids, kept in sync with the
  // per-participant `excluded` flags by the backend.
  excluded_reviewers?: string[]
  participants: ReviewerPlanParticipant[]
  profile_fields: string[]
  reviewer_count: number
  reviews_per_question: number
  status?: "active" | "closed" | string
  summary: string
  total_assignments: number
}

export interface DeveloperWorklistResponse {
  active_run: DeveloperRun | null
  batch_history: DeveloperRun[]
  count: number
  items: EvaluationTrace[]
  reviewer_plan?: ReviewerPlan | null
  legacy: {
    legacy_jsonl_runtime_trace_count: number
    sample_trace_count: number
  }
  question_count: number
}

export interface DeveloperCalibrationSummary {
  cards: { label: string; value: string }[]
  failed_count: number
  false_accept_count: number
  false_reject_count: number
  passed_count: number
  total_count: number
}

export interface DeveloperCalibrationHistoryItem extends DeveloperRun {
  summary: DeveloperCalibrationSummary
}

export interface DeveloperCalibrationResponse {
  calibration_run: DeveloperRun | null
  count: number
  history: DeveloperCalibrationHistoryItem[]
  items: EvaluationTrace[]
  summary: DeveloperCalibrationSummary
}

export interface ReviewerAssignmentResponse {
  active_run: DeveloperRun
  participant: ReviewerPlanParticipant
  profile_fields: string[]
  traces: EvaluationTrace[]
}

export interface DashboardOverview {
  service_count: number
  question_count: number
  controlled_question_count?: number
  llm_question_count?: number
  trace_count: number
  sample_trace_count?: number
  runtime_trace_count?: number
  disagreement_count: number
}

export interface IntegrationStatus {
  api_version: string
  authentication: {
    api_key_required: boolean
    header_name: string
    mode: string
    note: string
  }
  capabilities: Record<string, boolean>
  counts: {
    questions: number
    runtime_traces: number
    services: number
    traces: number
  }
  dashboard_internal_endpoints: string[]
  integration_endpoints: string[]
  public_base_path: string
  status: string
  updated_at: string
}

export type RepeatJudgeStability = "stable" | "unstable" | "tie"

export interface RepeatConsistencyRun {
  batch_id: string
  created_at: string | null
  judge_prompt_version: string | null
  judge_model_name: string | null
  judge_context_label: string | null
}

export interface RepeatConsistencyFlippedCriterion {
  key: string
  scores: (number | null)[]
}

export interface RepeatConsistencyRunExplanation {
  decision: string
  note: string
}

export interface RepeatConsistencyCase {
  case_id: string
  question: string
  decisions: (string | null)[]
  majority_decision: string | null
  tie: boolean
  judge_stability: RepeatJudgeStability
  stable_across_all_runs: boolean
  human_decision: string | null
  majority_vs_human_match: boolean | null
  route_to_human: boolean
  flipped_criteria?: RepeatConsistencyFlippedCriterion[]
  run_explanations?: RepeatConsistencyRunExplanation[]
}

export interface RepeatPerRunHumanAgreement {
  batch_id: string
  comparable_cases: number
  matches: number
  percent_agreement: number | null
  kappa: number | null
}

export interface RepeatMajorityVsHuman {
  comparable_cases: number
  matches: number
  match_rate: number | null
  percent_agreement: number | null
  kappa: number | null
  ties_excluded: number
}

export interface RepeatDecisionDistribution {
  batch_id: string
  distribution: Record<string, number>
}

export interface RepeatConsistencyAggregates {
  run_count: number
  case_count: number
  cases_stable_across_all_runs: number
  tie_count: number
  route_to_human_count: number
  per_run_human_agreement: RepeatPerRunHumanAgreement[]
  majority_vs_human: RepeatMajorityVsHuman
  decision_distribution_per_run: RepeatDecisionDistribution[]
}

export interface RepeatConsistencyResponse {
  schema_version: string
  import_id: string | null
  filters: {
    judge_prompt_version: string | null
    judge_model_name: string | null
    judge_context_label: string | null
  }
  runs: RepeatConsistencyRun[]
  cases: RepeatConsistencyCase[]
  route_to_human: string[]
  aggregates: RepeatConsistencyAggregates
}

export type ImprovementSuggestionSeverity = "high" | "medium" | "watch"
export type ImprovementSuggestionSource = "ai_judge" | "human_review" | "both"

export interface ImprovementExampleCase {
  case_id: string
  note: string
}

export interface ImprovementSuggestionEvidence {
  affected_cases: number
  borderline_cases?: number
  total_cases: number
  human_review_signals: number
  example_cases: ImprovementExampleCase[]
}

export interface ImprovementSuggestionCard {
  id: string
  title: string
  suggestion: string
  severity: ImprovementSuggestionSeverity
  source: ImprovementSuggestionSource
  evidence: ImprovementSuggestionEvidence
}

export interface LlmImprovementSuggestion {
  title: string
  suggestion: string
  evidence_case_ids: string[]
  evidence_quotes: string[]
}

export interface LlmImprovementSuggestions {
  generated_at: string
  model_name: string
  prompt_version: string
  suggestions: LlmImprovementSuggestion[]
}

export interface ImprovementSuggestionsResponse {
  schema_version: string
  batch_id: string | null
  case_count: number
  decision_distribution: Record<string, number>
  cards: ImprovementSuggestionCard[]
  judge_model_name?: string
  judge_prompt_version?: string
  llm?: LlmImprovementSuggestions | null
}
