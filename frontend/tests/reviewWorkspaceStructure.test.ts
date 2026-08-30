import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const reviewWorkspaceSource = readFileSync(
  "frontend/src/components/review/ReviewWorkspace.tsx",
  "utf8",
)
const reviewBatchWorkspaceSource = readFileSync(
  "frontend/src/components/review/ReviewBatchWorkspace.tsx",
  "utf8",
)
const appTextSource = readFileSync("frontend/src/appText.ts", "utf8")
const appSource = readFileSync("frontend/src/App.tsx", "utf8")
const apiSource = readFileSync("frontend/src/api.ts", "utf8")

test("opens optional review sections from the whole section header", () => {
  assert.match(reviewWorkspaceSource, /function CollapsibleReviewSectionHeader/)
  assert.match(reviewWorkspaceSource, /className=\{cn\(\s*"flex w-full/)
  assert.match(
    reviewWorkspaceSource,
    /<CollapsibleReviewSectionHeader[\s\S]*title="Problem details"[\s\S]*onToggle=\{\(\) => setDetailsOpen/,
  )
  assert.match(
    reviewWorkspaceSource,
    /<CollapsibleReviewSectionHeader[\s\S]*title="Notes"[\s\S]*onToggle=\{\(\) => setNotesOpen/,
  )
})

test("uses green selected styling for the positive usability decision", () => {
  const positiveSelectedStyle = reviewWorkspaceSource.match(
    /active && tone === "positive" && "([^"]+)"/,
  )?.[1]

  assert.ok(positiveSelectedStyle, "positive selected ChoiceCard style should be explicit")
  assert.match(positiveSelectedStyle, /--dashboard-ready/)
  assert.doesNotMatch(positiveSelectedStyle, /--dashboard-judge|--dashboard-active/)
})

test("keeps reviewer profile intro focused on the requested profile fields", () => {
  assert.match(
    appTextSource,
    /"Please select the options below to start the review\."/,
    "Reviewer profile intro copy should stay short and neutral",
  )
  assert.match(
    reviewBatchWorkspaceSource,
    /Please select the options below to start the review\./,
    "Review batch screen should use the short neutral intro",
  )
  assert.doesNotMatch(appTextSource, /Age and gender are not collected/)
  assert.doesNotMatch(reviewBatchWorkspaceSource, /Age and gender are not collected/)
})

test("uses the available or assigned case count in reviewer preview", () => {
  assert.match(
    appSource,
    /assignedBatchTraces\.length \|\| Math\.min\(batchSize, questions\.length\) \|\| batchSize/,
  )
})

test("does not trigger CORS preflights for read-only API requests", () => {
  assert.match(apiSource, /options\.body === undefined/)
  assert.doesNotMatch(
    apiSource,
    /fetch\(`\$\{API_BASE\}\$\{path\}`, \{\s*headers: \{ "Content-Type": "application\/json"/,
  )
})
