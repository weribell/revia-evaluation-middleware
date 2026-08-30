import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const analysisPanelSource = readFileSync(
  new URL("../src/components/developer/AnalysisPanel.tsx", import.meta.url),
  "utf8",
)

const researchPanelsSource = readFileSync(
  new URL("../src/components/research/researchPanels.tsx", import.meta.url),
  "utf8",
)

const researchTextSource = readFileSync(
  new URL("../src/components/research/researchText.ts", import.meta.url),
  "utf8",
)

const exportUtilsSource = readFileSync(
  new URL("../src/components/shared/exportUtils.ts", import.meta.url),
  "utf8",
)

test("Analysis panel imports shared research panels instead of the removed research page", () => {
  assert.match(
    analysisPanelSource,
    /from "@\/components\/research\/researchPanels"/,
    "AnalysisPanel should import reusable research UI from researchPanels",
  )
  assert.doesNotMatch(
    analysisPanelSource,
    new RegExp(`from "@/components/research/${"ResearchDashboard"}"`),
    "AnalysisPanel should not depend on the removed ResearchDashboard page",
  )
})

test("shared research panels expose the UI and CSV helpers used by AnalysisPanel", () => {
  for (const exportName of [
    "ConfusionMatrix",
    "CriterionComparisonPanel",
    "FailureModesPanel",
    "InterpretationPanel",
    "MetricCard",
    "ReviewerNotesPanel",
    "SampleContextPanel",
  ]) {
    assert.match(
      researchPanelsSource,
      new RegExp(`export function ${exportName}\\b`),
      `researchPanels should export ${exportName}`,
    )
  }
  assert.match(
    researchTextSource,
    /export function tr\b/,
    "researchText should export tr",
  )
  assert.match(
    exportUtilsSource,
    /export function downloadCsv\b/,
    "shared exportUtils should export downloadCsv",
  )
})

test("shared research panels keep compact analysis labels and bounded charts", () => {
  assert.match(
    researchTextSource,
    /"Search question, service, trace\.\.\.": "Frage, Service oder Trace suchen\.\.\."/,
    "Research translations used by analysis exports and filters should stay available",
  )
  assert.match(
    researchPanelsSource,
    /Breakdown by Question source, Answerability, Question style, Target section, and Intent type/,
    "Sample composition should keep research-oriented metadata labels",
  )
  assert.match(
    researchPanelsSource,
    /maxFailureModeCount/,
    "Failure mode bars should be normalized against the largest failure mode",
  )
  assert.match(
    researchPanelsSource,
    /Split cases stay separate instead of being counted as fractional votes/,
    "Final decision table should explain why split human decisions are excluded",
  )
  assert.match(
    researchPanelsSource,
    /Qualitative reviewer notes/,
    "Analysis should expose reviewer comments as qualitative evidence",
  )
  assert.match(
    researchPanelsSource,
    /min-w-0 overflow-hidden/,
    "Sample composition cards should constrain long labels and bars",
  )
})

test("Analysis accordion sections suppress duplicate inner panel headers", () => {
  for (const panelName of [
    "CriterionComparisonPanel",
    "SampleContextPanel",
    "FailureModesPanel",
    "ReviewerNotesPanel",
  ]) {
    assert.match(
      analysisPanelSource,
      new RegExp(`<${panelName}[^>]*showHeader=\\{false\\}`),
      `${panelName} should hide its own title when rendered inside an Analysis accordion section`,
    )
  }
})

test("Analysis links to Results disagreements only when the target worklist is non-empty", () => {
  assert.match(
    analysisPanelSource,
    /filterWorklistItems\(items, "mismatch"\)\.length/,
    "AnalysisPanel should use the same mismatch worklist count as the Results tab",
  )
  assert.match(
    analysisPanelSource,
    /resultDisagreementCount \? \(/,
    "The Results link should be conditional on available disagreement rows",
  )
  assert.match(
    analysisPanelSource,
    /No disagreement cases are available in Results for this run yet/,
    "AnalysisPanel should show an empty state instead of linking to an empty Results table",
  )
})

test("Analysis shows failed run notices before empty or aggregate analysis states", () => {
  assert.match(
    analysisPanelSource,
    /RunIssueNoticeBanner/,
    "Analysis should surface failed or partially failed selected runs",
  )
  assert.match(
    analysisPanelSource,
    /No analysis tables can be built until the run creates evaluation cases/,
    "Failed runs with no traces should not look like a generic empty analysis state",
  )
})
