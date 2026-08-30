import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFileSync } from "node:fs"
import test from "node:test"

import { productBrand, buildDashboardBrandContext } from "../src/branding.ts"

test("defines the REVIA product brand for dashboard headers", () => {
  assert.equal(productBrand.name, "REVIA")
  assert.equal(productBrand.expansion, "Review and Evaluation Infrastructure for AI Answers")
  assert.deepEqual(productBrand.expansionLines, ["Review and Evaluation", "Infrastructure for AI Answers"])
  assert.match(productBrand.description, /middleware/i)
  assert.equal(productBrand.logoPath, "/revia-wordmark.png")
  assert.equal(existsSync("frontend/public/revia-wordmark.png"), true)
  assert.equal("workspaceLabel" in productBrand, false)
})

test("keeps the active dashboard title separate from the product wordmark", () => {
  const context = buildDashboardBrandContext({
    title: "Developer / Evaluation Lab",
    description: "Prepare frozen study runs.",
  })

  assert.equal(context.productName, "REVIA")
  assert.equal(context.productSubtitle, "Review and Evaluation Infrastructure for AI Answers")
  assert.deepEqual(context.productSubtitleLines, ["Review and Evaluation", "Infrastructure for AI Answers"])
  assert.equal(context.workspaceTitle, "Developer / Evaluation Lab")
  assert.equal("workspaceTitleLines" in context, false)
  assert.equal("workspaceDescription" in context, false)
  assert.equal("workspaceLabel" in context, false)
})

test("uses a fixed compact wordmark width in the dashboard header", () => {
  const source = readFileSync("frontend/src/components/shared/ReviaBrand.tsx", "utf8")

  assert.match(source, /compact \? "w-\[140px\]"/)
})

test("centers the brand header as a whole instead of offsetting only the logo", () => {
  const appSource = readFileSync("frontend/src/App.tsx", "utf8")
  const brandSource = readFileSync("frontend/src/components/shared/ReviaBrand.tsx", "utf8")

  assert.match(appSource, /lg:items-center/)
  assert.doesNotMatch(brandSource, /translate-y-1/)
})
