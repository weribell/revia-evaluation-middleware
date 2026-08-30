import assert from "node:assert/strict"
import test from "node:test"

import { splitTextIntoLinkParts } from "../src/components/shared/linkifyText.ts"

test("splits generated answer text into plain text and clickable URL parts", () => {
  const parts = splitTextIntoLinkParts(
    "Online: https://forms.example.invalid/index?request=sample\nPortal: https://services.example.invalid/sample/",
  )

  assert.deepEqual(parts, [
    { kind: "text", text: "Online: " },
    { kind: "link", text: "https://forms.example.invalid/index?request=sample" },
    { kind: "text", text: "\nPortal: " },
    { kind: "link", text: "https://services.example.invalid/sample/" },
  ])
})

test("keeps trailing punctuation outside clickable URL parts", () => {
  const parts = splitTextIntoLinkParts("Weitere Informationen: https://services.example.invalid/foo/.")

  assert.deepEqual(parts, [
    { kind: "text", text: "Weitere Informationen: " },
    { kind: "link", text: "https://services.example.invalid/foo/" },
    { kind: "text", text: "." },
  ])
})
