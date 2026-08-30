import assert from "node:assert/strict"
import test from "node:test"

import {
  buildDashboardRoleUrl,
  buildDeveloperResultsUrl,
  buildDeveloperStateUrl,
  isParticipantReviewLink,
  shouldRefreshAfterBatchReviewSave,
  shouldLoadInitialDashboardData,
} from "../src/appMode.ts"

test("treats only participant review-batch URLs as participant review links", () => {
  assert.equal(isParticipantReviewLink("?role=review_batch&participant=P01"), true)
  assert.equal(isParticipantReviewLink("?role=review_batch"), false)
  assert.equal(isParticipantReviewLink("?role=review_batch&participant="), false)
  assert.equal(isParticipantReviewLink("?role=review_explorer&participant=P01"), false)
  assert.equal(isParticipantReviewLink("?participant=P01"), false)
})

test("treats reviewer path URLs with participants as public reviewer links", () => {
  assert.equal(isParticipantReviewLink("?participant=P01", "/reviewer"), true)
  assert.equal(isParticipantReviewLink("?participant=P01&token=abc", "/reviewer/"), true)
  assert.equal(isParticipantReviewLink("?participant=", "/reviewer"), false)
  assert.equal(isParticipantReviewLink("?participant=P01", "/"), false)
})

test("skips protected dashboard bootstrap requests on the public reviewer path", () => {
  assert.equal(shouldLoadInitialDashboardData("/reviewer"), false)
  assert.equal(shouldLoadInitialDashboardData("/reviewer/"), false)
  assert.equal(shouldLoadInitialDashboardData("/"), true)
  assert.equal(shouldLoadInitialDashboardData("/developer"), true)
})

test("skips protected refresh after public participant review saves", () => {
  assert.equal(shouldRefreshAfterBatchReviewSave("P01"), false)
  assert.equal(shouldRefreshAfterBatchReviewSave("  P02  "), false)
  assert.equal(shouldRefreshAfterBatchReviewSave(""), true)
})

test("builds a developer results URL from an internal filter context", () => {
  const url = buildDeveloperResultsUrl(
    "http://localhost:5173/?role=management&participant=P01&batch_id=old#top",
    {
      batchId: "batch_demo",
      filter: "source_concern",
    },
  )

  assert.equal(
    url,
    "/?role=developer&developer_tab=results_cases&developer_filter=source_concern&developer_batch_id=batch_demo#top",
  )
})

test("builds a developer URL that preserves selected tab, batch, filter, and trace", () => {
  const url = buildDeveloperStateUrl(
    "http://localhost:5173/?role=management&participant=P01&batch_id=old&developer_filter=all#top",
    {
      batchId: "batch_demo",
      filter: "human_disagreement",
      tab: "results_cases",
      traceId: "trace_123",
    },
  )

  assert.equal(
    url,
    "/?role=developer&developer_filter=human_disagreement&developer_tab=results_cases&developer_batch_id=batch_demo&developer_trace_id=trace_123#top",
  )
})

test("builds a developer URL that can clear the selected trace without changing batch", () => {
  const url = buildDeveloperStateUrl(
    "http://localhost:5173/?role=developer&developer_tab=results_cases&developer_batch_id=batch_demo&developer_trace_id=trace_123",
    {
      tab: "analysis",
      traceId: "",
    },
  )

  assert.equal(url, "/?role=developer&developer_tab=analysis&developer_batch_id=batch_demo")
})

test("builds a dashboard role URL without losing developer context", () => {
  const url = buildDashboardRoleUrl(
    "http://localhost:5173/?role=developer&developer_tab=analysis&developer_batch_id=batch_demo&participant=P01&token=secret",
    "management",
  )

  assert.equal(url, "/?role=management&developer_tab=analysis&developer_batch_id=batch_demo")
})
