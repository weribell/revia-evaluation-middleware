import type { CitizenQuestion } from "@/types"

export const sourceFilters = [
  ["all", "All"],
  ["controlled", "Controlled"],
  ["ai", "AI"],
] as const

export type SourceFilter = (typeof sourceFilters)[number][0]

export const questionTypeFilters = [
  ["all", "All types"],
  ["short", "Short / SMS"],
  ["long", "Long / story"],
  ["polite", "Polite"],
  ["direct", "Direct / rude"],
  ["language", "Bad German"],
  ["multi", "Multi-part"],
  ["uncertain", "Uncertain"],
  ["clarification_needed", "Clarification needed"],
  ["time_pressure", "Time pressure"],
] as const

export type QuestionTypeFilter = (typeof questionTypeFilters)[number][0]
export type QuestionWorkTag = Exclude<QuestionTypeFilter, "all">

function questionMetadataText(question: CitizenQuestion) {
  return [
    question.style_label,
    question.edge_case_label,
    question.difficulty_label,
    question.intent_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

export function questionWorkTags(question: CitizenQuestion): QuestionWorkTag[] {
  const text = questionMetadataText(question)
  const style = question.style_label.toLowerCase()
  const questionLength = question.question_text.length
  const intentCount = question.intent_count || 1
  const tags = new Set<QuestionWorkTag>()

  if (questionLength < 150 || /short|sms|mobile|direct_clean/.test(style)) {
    tags.add("short")
  }
  if (questionLength > 260 || /long|forum|confused|overwhelmed|story|messy/.test(text)) {
    tags.add("long")
  }
  if (/polite|formal|proxy|parent/.test(style)) {
    tags.add("polite")
  }
  if (/rude|impatient|annoyed|direct/.test(style)) {
    tags.add("direct")
  }
  if (/bad_german|no_punctuation/.test(style)) {
    tags.add("language")
  }
  if (intentCount > 1 || /multi|mixed_sections|related_practical|triage/.test(text)) {
    tags.add("multi")
  }
  if (/uncertain|unsure|ambiguous|rumour|eligibility|confused/.test(text)) {
    tags.add("uncertain")
  }
  if (question.requires_clarification) {
    tags.add("clarification_needed")
  }
  if (/time_pressure|appointment|work_schedule|emergency|travel_pressure/.test(text)) {
    tags.add("time_pressure")
  }

  return [...tags]
}

export function questionTypeFilterLabel(value: QuestionTypeFilter) {
  return questionTypeFilters.find(([optionValue]) => optionValue === value)?.[1] || value
}

export function questionSampleLabel(question: CitizenQuestion) {
  if (question.sample_label) return question.sample_label
  return question.generation_method ? "LLM-generated question set" : "Controlled question set"
}

export function matchesQuestionType(question: CitizenQuestion, filter: QuestionTypeFilter) {
  if (filter === "all") return true
  return questionWorkTags(question).includes(filter)
}
