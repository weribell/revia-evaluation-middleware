import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const auditDashboardSource = readFileSync(
  new URL("../src/components/audit/AuditDashboard.tsx", import.meta.url),
  "utf8",
)
const auditBadgesSource = readFileSync(
  new URL("../src/components/audit/AuditBadges.tsx", import.meta.url),
  "utf8",
)
const auditTextSource = readFileSync(
  new URL("../src/components/audit/auditText.ts", import.meta.url),
  "utf8",
)

test("uses audit-role labels for automated trace completeness and triage", () => {
  assert.match(
    auditDashboardSource,
    /Reconstructability summary/,
    "Audit dashboard should frame completeness as reconstructability",
  )
  assert.match(
    auditDashboardSource,
    /Audit triage table/,
    "Audit dashboard should frame the table as an audit triage surface",
  )
  assert.doesNotMatch(
    auditDashboardSource,
    /"Traceability table"/,
    "Audit dashboard should not keep the vague Traceability table label",
  )
})

test("surfaces selected-run failures before audit completeness metrics", () => {
  const noticeIndex = auditDashboardSource.indexOf("<RunIssueNoticeBanner")
  const completenessIndex = auditDashboardSource.indexOf("<ReconstructabilityHeader")

  assert.ok(noticeIndex >= 0, "Audit dashboard should show failed-run notices")
  assert.ok(noticeIndex < completenessIndex, "Run issue notice should appear before completeness metrics")
  assert.match(
    auditDashboardSource,
    /buildRunIssueNotice\(worklist\?\.active_run \|\| null,\s*language\)/,
    "Audit dashboard should derive failed-run notices from active run metadata",
  )
})

test("uses warning tone for pending human review states", () => {
  assert.match(
    auditBadgesSource,
    /status === "pending_review"\s*\?\s*dashboardToneClass\.warning/,
    "Pending review badges should use the system warning tone",
  )
  assert.match(
    auditDashboardSource,
    /humanReviewPending\s*\?\s*"judge"/,
    "Automated-trace-complete-but-review-pending header should use the warning-equivalent judge tone",
  )
})

test("localizes audit triage filters in German", () => {
  assert.match(
    auditTextSource,
    /tr\(language,\s*filterLabels\[filter\]\)/,
    "Audit filter option labels should pass through the German translation map",
  )

  for (const label of [
    "All",
    "Missing source reference",
    "Missing prompt/model metadata",
    "AI-human mismatch",
    "Human-human mismatch",
    "No human review",
    "No source check",
    "Unsupported claims",
  ]) {
    assert.match(
      auditTextSource,
      new RegExp(`"${label.replaceAll("/", "\\/")}":`),
      `Audit translation map should include "${label}"`,
    )
  }

  assert.match(
    auditTextSource,
    /filter === "needs_edit"\) return decisionLabel\(language, "needs_edit"\)/,
    "Needs-edit should use the shared canonical decision translation",
  )
  assert.match(
    auditTextSource,
    /filter === "rejected"\) return decisionLabel\(language, "reject"\)/,
    "Rejected should use the shared canonical decision translation",
  )
})
