import assert from "node:assert/strict"
import test from "node:test"

import { buildRunIssueNotice } from "../src/components/shared/runIssueNotice.ts"

test("builds a prominent notice for a failed run with the stored backend error", () => {
  const notice = buildRunIssueNotice({
    batch_id: "batch_failed",
    batch_type: "demo_run",
    created_at: "2026-06-20T17:59:43+00:00",
    metadata: {
      case_errors: [
        {
          error: "OpenAI API request failed with HTTP 500: server_error",
          question_id: "q_0001",
        },
      ],
      failed_cases: 1,
    },
    question_count: 1,
    status: "failed",
  })

  assert.equal(notice?.title, "Batch failed")
  assert.equal(notice?.tone, "danger")
  assert.match(notice?.description || "", /No evaluation cases were created/)
  assert.match(notice?.detail || "", /OpenAI API request failed with HTTP 500/)
  assert.match(notice?.detail || "", /q_0001/)
})

test("builds a neutral notice for a partially completed run", () => {
  const notice = buildRunIssueNotice({
    batch_id: "batch_partial",
    batch_type: "demo_run",
    created_at: "2026-06-20T18:01:43+00:00",
    metadata: {
      case_errors: [{ error: "OpenAI API timeout", question_id: "q_timeout" }],
      completed_cases: 5,
      failed_cases: 1,
    },
    question_count: 6,
    status: "completed_with_errors",
  })

  assert.equal(notice?.title, "Run completed with errors")
  assert.equal(notice?.tone, "notice")
  assert.match(notice?.description || "", /5 of 6 cases were created/)
  assert.match(notice?.detail || "", /OpenAI API timeout/)
})

test("returns no notice for a completed run", () => {
  assert.equal(
    buildRunIssueNotice({
      batch_id: "batch_ok",
      batch_type: "demo_run",
      created_at: "2026-06-20T18:01:43+00:00",
      metadata: { completed_cases: 1 },
      question_count: 1,
      status: "completed",
    }),
    null,
  )
})
