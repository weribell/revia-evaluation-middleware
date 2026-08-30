import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const analysisPanelSource = readFileSync(
  "frontend/src/components/developer/AnalysisPanel.tsx",
  "utf8",
)
const traceListSource = readFileSync("frontend/src/components/developer/TraceList.tsx", "utf8")
const resultsCasesSource = readFileSync(
  "frontend/src/components/developer/ResultsCasesPanel.tsx",
  "utf8",
)
const humanEvaluationSetupSource = readFileSync(
  "frontend/src/components/developer/HumanEvaluationSetupPanel.tsx",
  "utf8",
)
const runSelectSource = readFileSync(
  "frontend/src/components/developer/DeveloperRunSelect.tsx",
  "utf8",
)
const runSelectorBarSource = readFileSync(
  "frontend/src/components/developer/shared/RunSelectorBar.tsx",
  "utf8",
)
const developerDashboardSource = readFileSync(
  "frontend/src/components/developer/DeveloperDashboard.tsx",
  "utf8",
)

test("keeps developer run selector markup in one shared component", () => {
  const developerPanelSource = [traceListSource, resultsCasesSource, humanEvaluationSetupSource].join("\n")

  assert.match(runSelectSource, /export function DeveloperRunSelect/)
  assert.match(runSelectorBarSource, /<DeveloperRunSelect/)
  assert.match(analysisPanelSource, /<RunSelectorBar/)
  assert.match(developerPanelSource, /<DeveloperRunSelect/)
  assert.equal(analysisPanelSource.includes("<select"), false)
  assert.equal(developerPanelSource.includes("runSelect.options.map"), false)
})

test("keeps the human evaluation run selector in a stable wide header column", () => {
  assert.match(
    humanEvaluationSetupSource,
    /xl:grid-cols-\[minmax\(0,1fr\)_minmax\(32rem,42rem\)\]/,
    "Human evaluation setup should reserve a stable right column for long run labels",
  )
  assert.match(
    humanEvaluationSetupSource,
    /xl:min-w-\[32rem\]/,
    "The run selector should have enough width to avoid jumping between rows",
  )
})

test("keeps developer navigation state in the URL for reload-safe dashboards", () => {
  assert.match(
    traceListSource,
    /replaceDeveloperUrlState\(\{[\s\S]*tab: tabId/,
    "TraceList should persist the active developer tab in the URL",
  )
  assert.match(
    traceListSource,
    /replaceDeveloperUrlState\(\{[\s\S]*traceId/,
    "TraceList should persist selected case traces in the URL",
  )
  assert.match(
    developerDashboardSource,
    /getInitialDeveloperTraceId/,
    "DeveloperDashboard should initialize selectedTraceId from the URL",
  )
  assert.match(
    developerDashboardSource,
    /replaceDeveloperUrlState\(\{[\s\S]*batchId/,
    "DeveloperDashboard should persist selected batches in the URL",
  )
  assert.match(
    developerDashboardSource,
    /replaceDeveloperUrlState\(\{[\s\S]*filter/,
    "DeveloperDashboard should persist results filters in the URL",
  )
})

test("loads secondary developer data only when the matching tab is prepared", () => {
  const initialLoadEffect = developerDashboardSource.match(
    /useEffect\(\(\) => \{[\s\S]*?loadWorklist[\s\S]*?\n\s+\}, \[loadWorklist\]\)/,
  )?.[0] || ""

  assert.match(
    initialLoadEffect,
    /loadWorklist/,
    "DeveloperDashboard should keep a focused initial worklist load",
  )
  assert.doesNotMatch(
    initialLoadEffect,
    /loadPrompts|loadCalibrationRun|loadIntegrationStatus|loadQuestions|loadImportedDatasets/,
    "DeveloperDashboard should not eagerly load all secondary tab data on initial mount",
  )
  assert.match(
    developerDashboardSource,
    /prepareDeveloperTab/,
    "DeveloperDashboard should expose a tab preparation callback",
  )
  assert.match(
    traceListSource,
    /onPrepareTab\(activeTab\)/,
    "TraceList should ask the parent to prepare only the active tab",
  )
})
