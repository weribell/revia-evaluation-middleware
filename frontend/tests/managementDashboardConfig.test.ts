import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const managementDashboardSource = readFileSync(
  new URL("../src/components/management/ManagementDashboard.tsx", import.meta.url),
  "utf8",
)
const managementChartsSource = readFileSync(
  "frontend/src/components/management/ManagementCharts.tsx",
  "utf8",
)
const appTextSource = readFileSync(new URL("../src/appText.ts", import.meta.url), "utf8")

test("frames management as a service-owner approval dashboard", () => {
  assert.match(
    appTextSource,
    /This dashboard helps a service owner decide whether the selected run can be approved for the next controlled step/,
    "Management purpose statement should describe service-owner approval, not pilot launch",
  )
  assert.match(
    managementDashboardSource,
    /buildManagementCockpitModel/,
    "Management dashboard should use the compact cockpit read model",
  )
  assert.match(
    managementDashboardSource,
    /<ManagementConclusionCard/,
    "Management dashboard should foreground a plain-language management conclusion",
  )
  assert.match(
    managementDashboardSource,
    /cockpit\.nextActionLabel/,
    "Management dashboard should foreground one next action (merged into the conclusion card)",
  )
  assert.doesNotMatch(
    managementDashboardSource,
    /<PilotReadinessCard/,
    "Management dashboard should not use a readiness-percentage gauge",
  )
  assert.doesNotMatch(
    managementDashboardSource.slice(
      managementDashboardSource.indexOf('<section className="grid gap-3">'),
      managementDashboardSource.indexOf('title="Research details"'),
    ),
    /Pilot blocked|Needs adjudication|Resolve follow-up queue/,
    "First screen should not expose technical pilot/adjudication/follow-up wording",
  )
  assert.doesNotMatch(
    managementDashboardSource,
    /title="Why this decision\?"/,
    "Management dashboard should no longer use the old decision-flow section",
  )
})

test("uses phase-based management sections instead of mixing planning and decision work", () => {
  const dashboardSource = managementDashboardSource.slice(
    managementDashboardSource.indexOf("export function ManagementDashboard"),
  )
  const cockpitIndex = dashboardSource.indexOf("<ManagementConclusionCard")
  const planningIndex = dashboardSource.indexOf("<PlanningSections")
  const decisionIndex = dashboardSource.indexOf("<DecisionSections")
  const collapsedPlanningIndex = dashboardSource.indexOf("<CollapsedPlanningAssumptions")

  assert.ok(cockpitIndex >= 0, "Cockpit should render before phase sections")
  assert.ok(planningIndex > cockpitIndex, "Planning phase should render after the cockpit")
  assert.ok(decisionIndex > cockpitIndex, "Decision phase should render after the cockpit")
  assert.ok(
    collapsedPlanningIndex > decisionIndex,
    "Decision phase should keep planning assumptions collapsed at the bottom",
  )
  assert.match(
    managementDashboardSource,
    /<CompactKpiGrid/,
    "Both phases should keep compact KPI cards near the top",
  )
  assert.match(
    managementDashboardSource,
    /<svg[\s\S]*role="img"/,
    "Decision phase should use dependency-free SVG charts",
  )
  assert.match(
    dashboardSource,
    /model\.after\.hasHumanReview \? \(\s*<>\s*<DecisionSections/,
    "Human review evidence should switch the screen into the decision phase",
  )
  assert.match(
    dashboardSource,
    /: \(\s*<PlanningSections/,
    "Runs without human review should switch the screen into the planning phase",
  )
  assert.doesNotMatch(
    managementDashboardSource,
    /<AiTriageOnlyPlaceholder/,
    "Planning phase should not show a separate AI-triage placeholder",
  )
  assert.doesNotMatch(
    managementDashboardSource,
    /from "recharts"/,
    "Management dashboard should avoid Recharts because it breaks the local Vite dev server",
  )
})

test("removes the standalone review protocol banner and keeps reviewer-plan context in planning", () => {
  const dashboardSource = managementDashboardSource.slice(
    managementDashboardSource.indexOf("export function ManagementDashboard"),
  )
  const conclusionIndex = dashboardSource.indexOf("<ManagementConclusionCard")
  const kpiIndex = dashboardSource.indexOf("<CompactKpiGrid")

  assert.ok(kpiIndex > conclusionIndex, "KPI interpretation should appear after the conclusion")
  assert.match(
    managementDashboardSource,
    /deriveManagementAssumptionsForRun\(current, response\.active_run\)/,
    "Management assumptions should be hydrated from the selected run reviewer assignment plan",
  )
  assert.doesNotMatch(
    managementDashboardSource,
    /ReviewProtocolBanner/,
    "The standalone review protocol banner should be removed",
  )
  assert.match(
    managementDashboardSource,
    /From reviewer assignment plan/,
    "Planning assumptions should explain when values come from reviewer assignments",
  )
  assert.match(
    managementDashboardSource,
    /function ReviewAssumptionsPanel[\s\S]*From reviewer assignment plan/,
    "Reviewer-plan context should stay with planning assumptions",
  )
})

test("places the management conclusion and next action in one wide row", () => {
  const cardStart = managementDashboardSource.indexOf("function ManagementConclusionCard")
  const cardEnd = managementDashboardSource.indexOf("function CompactKpiGrid")
  const cardSource = managementDashboardSource.slice(cardStart, cardEnd)

  assert.match(
    cardSource,
    /md:grid-cols-\[minmax\(0,0\.92fr\)_minmax\(24rem,0\.56fr\)\]/,
    "Conclusion card should use a wide two-column layout for summary and next action",
  )
  assert.match(
    cardSource,
    /md:items-start/,
    "Conclusion and next action should align at the top in one row on wide screens",
  )
  assert.doesNotMatch(
    cardSource,
    /mt-3 flex items-start gap-3 rounded-lg/,
    "Next action should no longer be a full-width second row inside the conclusion card",
  )
})

test("surfaces failed selected runs before management conclusions", () => {
  const selectorIndex = managementDashboardSource.indexOf("Selected run")
  const noticeIndex = managementDashboardSource.indexOf("<RunIssueNoticeBanner")
  const conclusionIndex = managementDashboardSource.indexOf("<ManagementConclusionCard")

  assert.ok(noticeIndex > selectorIndex, "Run issue notice should appear after the selected-run control")
  assert.ok(noticeIndex < conclusionIndex, "Run issue notice should appear before management conclusions")
  assert.match(
    managementDashboardSource,
    /buildRunIssueNotice\(activeRun,\s*language\)/,
    "Management should derive failed-run notices from active run metadata",
  )
})

test("adds plain-language helper lines to decision sections", () => {
  const decisionSectionSource = managementDashboardSource.slice(
    managementDashboardSource.indexOf("function DecisionSections"),
    managementDashboardSource.indexOf("export function ManagementDashboard"),
  )
  assert.match(
    managementDashboardSource,
    /Share of answers reviewers would approve without edits\./,
    "Decision chart should explain why a service owner should look at it",
  )
  assert.match(
    managementChartsSource,
    /Most frequent problem types in reviewed answers\./,
    "Risk chart should explain the problem summary",
  )
  assert.match(
    managementChartsSource,
    /These cases need a decision before the service can go live\./,
    "Attention list should use non-technical service-owner wording",
  )
  assert.match(
    managementDashboardSource,
    /Requirements for an approval decision\./,
    "Pilot checklist should explain its approval purpose",
  )
  assert.doesNotMatch(
    decisionSectionSource,
    /title="[^"]*(?:trace|mismatch rate|false accept)[^"]*"|label=\{tr\(language, "[^"]*(?:trace|mismatch rate|false accept)[^"]*"\)\}/i,
    "Management section headings should avoid technical evaluation jargon",
  )
})

test("keeps planning assumptions collapsed below the decision phase", () => {
  const detailSource = managementDashboardSource.slice(
    managementDashboardSource.indexOf("function CollapsedPlanningAssumptions"),
    managementDashboardSource.indexOf("function DecisionSections"),
  )

  assert.match(
    detailSource,
    /<details/,
    "Planning assumptions should live in a disclosure section after review evidence exists",
  )
  assert.match(
    detailSource,
    /title="Planning assumptions"/,
    "Collapsed section should use the localized planning title",
  )
  assert.doesNotMatch(
    detailSource,
    /Planungsannahmen \/ Planning assumptions/,
    "Collapsed section should not mix German and English in one title",
  )
  assert.match(
    detailSource,
    /showHeader=\{false\}/,
    "Collapsed section should not repeat the inner pre-review planning header",
  )
  assert.match(
    detailSource,
    /<PlanningSections/,
    "Collapsed assumptions should reuse the planning sections",
  )
  assert.match(
    managementDashboardSource,
    /<ScenarioTable/,
    "Scenario table can remain available as supporting planning detail",
  )
  assert.match(
    managementDashboardSource,
    /<CostComparisonPanel/,
    "Cost comparison should remain available for the cost model",
  )
})
