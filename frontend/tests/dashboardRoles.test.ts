import assert from "node:assert/strict"
import test from "node:test"

import {
  dashboardRolePurposeStatements,
  dashboardRoleValues,
  shouldShowDeveloperLabReturn,
  shouldShowDashboardRoleSelect,
  usesCompactDashboardHeader,
  visibleDashboardRoleValues,
} from "../src/components/shared/dashboardRoleModel.ts"

test("keeps participant review flow routable but out of primary dashboard navigation", () => {
  assert.ok(dashboardRoleValues.includes("review_batch"))
  assert.ok(dashboardRoleValues.includes("review_explorer"))
  assert.deepEqual(visibleDashboardRoleValues, ["developer", "management", "audit"])
})

test("does not present review batch preview as a switchable dashboard view", () => {
  assert.equal(shouldShowDashboardRoleSelect("review_batch"), false)
  assert.equal(shouldShowDashboardRoleSelect("developer"), true)
})

test("shows a developer lab return action only for reviewer preview mode", () => {
  assert.equal(shouldShowDeveloperLabReturn("review_batch", false), true)
  assert.equal(shouldShowDeveloperLabReturn("review_batch", true), false)
  assert.equal(shouldShowDeveloperLabReturn("developer", false), false)
})

test("uses compact page header for dashboard workspaces", () => {
  assert.equal(usesCompactDashboardHeader("developer"), true)
  assert.equal(usesCompactDashboardHeader("management"), true)
  assert.equal(usesCompactDashboardHeader("audit"), true)
  assert.equal(usesCompactDashboardHeader("review_batch"), false)
})

test("defines role-specific purpose statements for visible dashboards", () => {
  assert.deepEqual(Object.keys(dashboardRolePurposeStatements), visibleDashboardRoleValues)
  assert.match(dashboardRolePurposeStatements.management, /^This dashboard helps a service owner decide/)
  assert.match(dashboardRolePurposeStatements.management, /next controlled step/)
  assert.match(dashboardRolePurposeStatements.management, /which team should act next/)
  assert.match(dashboardRolePurposeStatements.audit, /^This dashboard is for reconstructing/)
  assert.match(dashboardRolePurposeStatements.developer, /^This dashboard is for preparing/)
})
