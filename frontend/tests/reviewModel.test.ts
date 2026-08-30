import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCriteriaFromChecklist,
  buildReviewSourceGroups,
  buildReviewBatchSteps,
  buildReviewBatchStorageKey,
  buildReviewDraftFromHumanReview,
  buildSavedReviewComment,
  reviewBatchInstructions,
  canAdvanceReviewStep,
  canSaveReviewDraft,
  createEmptyReviewDraft,
  negativeReviewChecklist,
  positiveReviewChecklist,
  reviewRequiresProblemSignal,
} from "../src/components/review/reviewModel.ts"

test("starts new reviews with source audit unchecked", () => {
  assert.equal(createEmptyReviewDraft().sourceSupport, "not_checked")
})

test("keeps saved review comments limited to manually written notes", () => {
  assert.equal(buildSavedReviewComment("", ["should_ask_clarification"]), "")
  assert.equal(
    buildSavedReviewComment("  Please ask a clarifying question.  ", ["should_ask_clarification"]),
    "Please ask a clarifying question.",
  )
})

test("allows accepted human reviews without optional checklist signals", () => {
  const draft = {
    ...createEmptyReviewDraft(),
    decision: "accept",
  }

  assert.equal(reviewRequiresProblemSignal(draft), false)
  assert.equal(canSaveReviewDraft(draft).canSave, true)
})

test("allows a source concern without a separate problem signal", () => {
  const draft = {
    ...createEmptyReviewDraft(),
    decision: "accept",
    sourceSupport: "partly_supported",
  }

  assert.equal(reviewRequiresProblemSignal(draft), false)
  assert.equal(canSaveReviewDraft(draft).canSave, true)
})

test("requires at least one problem signal when human reviewer rejects an answer", () => {
  const draft = {
    ...createEmptyReviewDraft(),
    decision: "reject",
    sourceSupport: "unsupported",
  }

  assert.equal(reviewRequiresProblemSignal(draft), true)
  assert.deepEqual(canSaveReviewDraft(draft), {
    canSave: false,
    reason: "Choose at least one problem signal before saving this review.",
  })

  assert.equal(
    canSaveReviewDraft({
      ...draft,
      checkedReviewItems: ["missing_important_part"],
    }).canSave,
    true,
  )
})

test("requires at least one problem signal when human reviewer marks an answer as needing edits", () => {
  const draft = {
    ...createEmptyReviewDraft(),
    decision: "needs_edit",
    sourceSupport: "partly_supported",
  }

  assert.equal(reviewRequiresProblemSignal(draft), true)
  assert.equal(canSaveReviewDraft(draft).canSave, false)
})

test("blocks the checklist step until a problem signal is selected for negative decisions", () => {
  const draft = {
    ...createEmptyReviewDraft(),
    decision: "needs_edit",
    sourceSupport: "partly_supported",
  }

  assert.equal(canAdvanceReviewStep(2, draft), false)
  assert.equal(
    canAdvanceReviewStep(2, {
      ...draft,
      checkedReviewItems: ["too_hard_to_understand"],
    }),
    true,
  )
})

test("does not average mixed positive and problem checklist signals into a positive score", () => {
  const criteria = buildCriteriaFromChecklist(["simple_language", "too_hard_to_understand"])

  assert.equal(criteria.clarity_actionability, 3)
})

test("keeps an explicit problem signal for unsupported links or extra information", () => {
  const unsupportedExtraInformation = negativeReviewChecklist.find(
    (item) => item.id === "unverified_claims",
  )

  assert.equal(unsupportedExtraInformation?.criterion, "source_support")
  assert.match(unsupportedExtraInformation?.title || "", /links|details/i)
  assert.match(unsupportedExtraInformation?.description || "", /URL|not clear from the official source/i)
})

test("collects positive factual correctness evidence", () => {
  const factualSignal = positiveReviewChecklist.find((item) => item.id === "facts_look_correct")

  assert.equal(factualSignal?.criterion, "factual_correctness")
  assert.equal(buildCriteriaFromChecklist(["facts_look_correct"]).factual_correctness, 5)
  assert.equal(
    buildCriteriaFromChecklist(["facts_look_correct", "fact_problem"]).factual_correctness,
    3,
  )
})

test("maps direct-answer checklist signals to completeness evidence", () => {
  const problemSignal = negativeReviewChecklist.find((item) => item.id === "not_direct_answer")

  assert.equal(problemSignal?.criterion, "completeness")
  assert.match(problemSignal?.title || "", /concrete question/i)
  assert.equal(buildCriteriaFromChecklist(["covers_main_question"]).completeness, 5)
  assert.equal(buildCriteriaFromChecklist(["not_direct_answer"]).completeness, 2)
  assert.equal(
    buildCriteriaFromChecklist(["covers_main_question", "not_direct_answer"]).completeness,
    3,
  )
})

test("builds review batch navigation with current, saved, and locked questions", () => {
  const steps = buildReviewBatchSteps({
    completedCount: 3,
    currentIndex: 1,
    reachableCount: 4,
    total: 5,
  })

  assert.deepEqual(
    steps.map((step) => [step.number, step.status, step.disabled]),
    [
      [1, "saved", false],
      [2, "current", false],
      [3, "saved", false],
      [4, "available", false],
      [5, "locked", true],
    ],
  )
})

test("keeps reviewer batch instructions as short required-read steps", () => {
  assert.deepEqual(
    reviewBatchInstructions.map((item) => item.title),
    [
      "Read the resident question",
      "Check the proposed answer",
      "Use the source when needed",
    ],
  )
  assert.ok(reviewBatchInstructions.every((item) => item.description.length <= 95))
})

test("keeps a reached but unsaved question clickable after returning to a saved question", () => {
  const steps = buildReviewBatchSteps({
    completedCount: 13,
    currentIndex: 12,
    reachableCount: 14,
    total: 20,
  })

  assert.equal(steps[12].status, "current")
  assert.equal(steps[13].status, "available")
  assert.equal(steps[13].disabled, false)
  assert.equal(steps[14].status, "locked")
})

test("scopes participant review progress to the selected evaluation batch", () => {
  assert.equal(
    buildReviewBatchStorageKey("revia_review_batch_v1", "P01", "batch_2026_06_02"),
    "revia_review_batch_v1_batch_2026_06_02_P01",
  )
  assert.notEqual(
    buildReviewBatchStorageKey("revia_review_batch_v1", "P01", "batch_old"),
    buildReviewBatchStorageKey("revia_review_batch_v1", "P01", "batch_new"),
  )
})

test("groups source evidence chunks by official source URL", () => {
  const groups = buildReviewSourceGroups([
    {
      service_title: "Orthoptist recognition",
      section_name: "fees",
      chunk_text: "164,00 Euro",
      source_ref: "https://services.example.invalid/one/",
      rank: 1,
    },
    {
      service_title: "Orthoptist recognition",
      section_name: "description",
      chunk_text: "Recognition depends on substantial differences.",
      source_ref: "https://services.example.invalid/one/",
      rank: 2,
    },
    {
      service_title: "Residence permit",
      section_name: "required_documents",
      chunk_text: "Passport",
      source_ref: "https://services.example.invalid/two/",
      rank: 3,
    },
  ])

  assert.equal(groups.length, 2)
  assert.deepEqual(
    groups.map((group) => [group.sourceRef, group.serviceTitle, group.sources.length]),
    [
      ["https://services.example.invalid/one/", "Orthoptist recognition", 2],
      ["https://services.example.invalid/two/", "Residence permit", 1],
    ],
  )
})

test("reconstructs a review draft from a saved human review", () => {
  const draft = buildReviewDraftFromHumanReview({
    final_decision: "needs_edit",
    label: "partly_supported",
    human_score: 2,
    criteria: {
      completeness: 2,
      clarity_actionability: 5,
      source_support: 2,
    },
    comment_text: "Please make the missing documents clearer.",
    suggested_correction: "Add the documents.",
    reviewer_confidence: "high",
    submitted_at: "2026-06-02T00:00:00Z",
  })

  assert.equal(draft.decision, "needs_edit")
  assert.equal(draft.sourceSupport, "partly_supported")
  assert.equal(draft.comment, "Please make the missing documents clearer.")
  assert.equal(draft.correction, "Add the documents.")
  assert.equal(draft.confidence, "high")
  assert.deepEqual(draft.checkedReviewItems.sort(), [
    "clear_next_steps",
    "missing_important_part",
    "unverified_claims",
  ])
})
