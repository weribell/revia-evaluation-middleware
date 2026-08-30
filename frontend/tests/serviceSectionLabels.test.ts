import assert from "node:assert/strict"
import test from "node:test"

import {
  serviceSectionLabel,
  serviceSectionLabels,
} from "../src/components/shared/serviceSectionLabels.ts"

test("returns canonical English service section labels", () => {
  assert.equal(serviceSectionLabels.required_documents, "Required documents")
  assert.equal(serviceSectionLabel("en", "responsibility_notes"), "Responsible authority")
})

test("returns compact German service section labels for developer surfaces", () => {
  assert.equal(serviceSectionLabel("de", "required_documents"), "Unterlagen")
  assert.equal(serviceSectionLabel("de", "full_text"), "Offizieller Servicetext")
})

test("falls back to readable unknown section names", () => {
  assert.equal(serviceSectionLabel("en", "custom_section"), "custom section")
})
