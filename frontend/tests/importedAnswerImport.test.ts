import assert from "node:assert/strict"
import test from "node:test"

import {
  parseImportedAnswerCsv,
  validateImportedAnswerRows,
} from "../src/components/developer/importedAnswerImport.ts"

test("parses quoted imported answer CSV with optional source and human review columns", () => {
  const csv = [
    "case_id,question,answer,source_context,source_url,external_system,human_label,human_score,human_comment",
    'external_001,"Was kostet der Antrag?","Die Gebühr beträgt 10,00 Euro.","Gebühr: 10,00 Euro.","https://example.gov/fees","example_chatbot","supported","4","Correct, but wording is short."',
  ].join("\n")

  const parsed = parseImportedAnswerCsv(csv)
  const validation = validateImportedAnswerRows(parsed.rows)

  assert.deepEqual(parsed.errors, [])
  assert.equal(validation.validRows.length, 1)
  assert.equal(validation.validRows[0].caseId, "external_001")
  assert.equal(validation.validRows[0].answer, "Die Gebühr beträgt 10,00 Euro.")
  assert.equal(validation.validRows[0].humanReview?.label, "supported")
  assert.equal(validation.validRows[0].humanReview?.score, 4)
  assert.equal(validation.validRows[0].humanReview?.comment, "Correct, but wording is short.")
})

test("reports missing required question and answer columns", () => {
  const parsed = parseImportedAnswerCsv("case_id,question\nrow_1,Was kostet das?")
  const validation = validateImportedAnswerRows(parsed.rows)

  assert.equal(validation.validRows.length, 0)
  assert.ok(validation.errors.some((error) => error.includes("Missing required column: answer")))
})

test("accepts question_text and answer_text as required column aliases", () => {
  const parsed = parseImportedAnswerCsv("case_id,question_text,answer_text\nrow_1,Was kostet das?,Das kostet 10 Euro.")
  const validation = validateImportedAnswerRows(parsed.rows)

  assert.equal(validation.errors.length, 0)
  assert.equal(validation.validRows.length, 1)
  assert.equal(validation.validRows[0].question, "Was kostet das?")
  assert.equal(validation.validRows[0].answer, "Das kostet 10 Euro.")
})

test("warns when imported rows have no source context", () => {
  const parsed = parseImportedAnswerCsv("case_id,question,answer\nrow_1,Was kostet das?,Das kostet 10 Euro.")
  const validation = validateImportedAnswerRows(parsed.rows)

  assert.equal(validation.validRows.length, 1)
  assert.ok(validation.warnings.some((warning) => warning.includes("source_context")))
})

test("preserves frozen question identity and clarification requirements", () => {
  const parsed = parseImportedAnswerCsv([
    "case_id,question_id,requires_clarification,question,answer,source_context",
    "CASE05,q_0011_fictional_community_garden_multi_intent_unrelated_services,true,Welcher Vorgang?,Bitte präzisieren.,Amtliche Referenz",
  ].join("\n"))
  const validation = validateImportedAnswerRows(parsed.rows)

  assert.equal(validation.errors.length, 0)
  assert.equal(
    validation.validRows[0].questionId,
    "q_0011_fictional_community_garden_multi_intent_unrelated_services",
  )
  assert.equal(validation.validRows[0].requiresClarification, true)
})
