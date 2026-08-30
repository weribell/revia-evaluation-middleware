import type { ReviewDecision, SourceSupport } from "@/types"

export type ImportedAnswerHumanReview = {
  comment: string
  decision: ReviewDecision
  label: SourceSupport
  reviewerId: string
  score: number
}

export type ImportedAnswerRecord = {
  answer: string
  caseId: string
  externalSystem: string
  question: string
  questionId: string
  requiresClarification: boolean
  serviceId: string
  serviceTitle: string
  sourceContext: string
  sourceUrl: string
  targetSection: string
  humanReview?: ImportedAnswerHumanReview
}

export type ImportedAnswerCsvRow = {
  lineNumber: number
  values: Record<string, string>
}

export type ImportedAnswerParseResult = {
  errors: string[]
  headers: string[]
  rows: ImportedAnswerCsvRow[]
}

export type ImportedAnswerValidationResult = {
  errors: string[]
  validRows: ImportedAnswerRecord[]
  warnings: string[]
}

const REQUIRED_COLUMN_ALIASES = {
  answer: ["answer", "answer_text"],
  question: ["question", "question_text"],
}
const SOURCE_LABELS = new Set<SourceSupport>(["not_checked", "supported", "partly_supported", "unsupported"])
const FINAL_DECISIONS = new Set<ReviewDecision>(["accept", "needs_edit", "reject"])

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_")
}

function normalizeCell(value: string | undefined) {
  return String(value || "").trim()
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let currentCell = ""
  let currentRow: string[] = []
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const nextCharacter = text[index + 1]

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentCell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentCell)
      currentCell = ""
      continue
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1
      }
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ""
      continue
    }

    currentCell += character
  }

  currentRow.push(currentCell)
  rows.push(currentRow)

  return rows.filter((row) => row.some((cell) => cell.trim()))
}

export function parseImportedAnswerCsv(text: string): ImportedAnswerParseResult {
  const rows = splitCsvRows(text.replace(/^\uFEFF/, ""))
  if (!rows.length) {
    return { errors: ["CSV file is empty."], headers: [], rows: [] }
  }

  const headers = rows[0].map(normalizeHeader)
  const duplicateHeaders = headers.filter((header, index) => header && headers.indexOf(header) !== index)
  const errors = duplicateHeaders.length
    ? [`Duplicate column header: ${duplicateHeaders[0]}`]
    : []

  return {
    errors,
    headers,
    rows: rows.slice(1).map((row, rowIndex) => {
      const values: Record<string, string> = {}
      headers.forEach((header, columnIndex) => {
        if (header) {
          values[header] = normalizeCell(row[columnIndex])
        }
      })
      return {
        lineNumber: rowIndex + 2,
        values,
      }
    }),
  }
}

function validScore(value: string) {
  if (!value) return undefined
  const score = Number(value)
  if (!Number.isInteger(score) || score < 1 || score > 5) return undefined
  return score
}

function booleanValue(value: string) {
  return new Set(["1", "true", "yes", "ja"]).has(normalizeCell(value).toLowerCase())
}

function humanDecisionFromScore(score: number): ReviewDecision {
  if (score >= 4) return "accept"
  if (score <= 2) return "reject"
  return "needs_edit"
}

function humanReviewFromValues(values: Record<string, string>): ImportedAnswerHumanReview | undefined {
  const label = normalizeCell(values.human_label || values.source_label) as SourceSupport
  const score = validScore(normalizeCell(values.human_score || values.score))
  const decision = normalizeCell(values.human_decision || values.final_decision) as ReviewDecision
  const comment = normalizeCell(values.human_comment || values.comment)
  const hasReviewSignal = Boolean(label || score || decision || comment)
  if (!hasReviewSignal) return undefined

  return {
    comment,
    decision: FINAL_DECISIONS.has(decision) ? decision : humanDecisionFromScore(score || 3),
    label: SOURCE_LABELS.has(label) ? label : "not_checked",
    reviewerId: normalizeCell(values.reviewer_id) || "imported_human_label",
    score: score || (decision === "accept" ? 5 : decision === "reject" ? 1 : 3),
  }
}

export function validateImportedAnswerRows(rows: ImportedAnswerCsvRow[]): ImportedAnswerValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const validRows: ImportedAnswerRecord[] = []
  const firstRow = rows[0]?.values || {}

  Object.entries(REQUIRED_COLUMN_ALIASES).forEach(([column, aliases]) => {
    if (!aliases.some((alias) => alias in firstRow)) {
      errors.push(`Missing required column: ${column}`)
    }
  })

  if (errors.length) {
    return { errors, validRows, warnings }
  }

  rows.forEach((row, index) => {
    const question = normalizeCell(row.values.question || row.values.question_text)
    const answer = normalizeCell(row.values.answer || row.values.answer_text)
    if (!question || !answer) {
      errors.push(`Line ${row.lineNumber}: question and answer are required.`)
      return
    }

    const sourceContext = normalizeCell(row.values.source_context || row.values.context)
    if (!sourceContext) {
      warnings.push(`Line ${row.lineNumber}: source_context is empty; source-support evaluation will be limited.`)
    }

    validRows.push({
      answer,
      caseId: normalizeCell(row.values.case_id) || `imported_${String(index + 1).padStart(3, "0")}`,
      externalSystem: normalizeCell(row.values.external_system) || "imported_chatbot",
      humanReview: humanReviewFromValues(row.values),
      question,
      questionId: normalizeCell(row.values.question_id),
      requiresClarification: booleanValue(row.values.requires_clarification),
      serviceId: normalizeCell(row.values.service_id),
      serviceTitle: normalizeCell(row.values.service_title),
      sourceContext,
      sourceUrl: normalizeCell(row.values.source_url),
      targetSection: normalizeCell(row.values.target_section) || "external_context",
    })
  })

  return { errors, validRows, warnings }
}
