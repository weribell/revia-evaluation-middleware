import assert from "node:assert/strict"
import test from "node:test"

import {
  formatCurrency,
  formatHours,
  formatMoney,
} from "../src/components/management/managementFormatters.ts"

test("formats compact Euro amounts for management summaries", () => {
  assert.equal(formatCurrency(1280), "€1,280")
  assert.equal(formatCurrency(0.75), "€0.75")
})

test("formats management money values by currency", () => {
  assert.equal(formatMoney(8.5, "EUR"), "€9")
  assert.equal(formatMoney(0.000875, "USD"), "$0.000875")
  assert.equal(formatMoney(12.5, "USD"), "$12.50")
})

test("formats review effort hours with one decimal place", () => {
  assert.equal(formatHours(3), "3 h")
  assert.equal(formatHours(3.25), "3.3 h")
})
