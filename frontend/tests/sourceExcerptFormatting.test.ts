import assert from "node:assert/strict"
import test from "node:test"

import { formatSourceExcerptBlocks } from "../src/components/shared/sourceExcerptFormatting.ts"

test("formats source excerpts into readable evidence blocks", () => {
  const blocks = formatSourceExcerptBlocks(`Deutsche Staatsangehoerigkeit
Persoenliche Vorsprache ist erforderlich.
- Personalausweis
Wohnsitz in Nordhafen
Sie wohnen in Nordhafen.`)

  assert.deepEqual(blocks, [
    { kind: "heading", text: "Deutsche Staatsangehoerigkeit" },
    { kind: "paragraph", text: "Persoenliche Vorsprache ist erforderlich." },
    { kind: "bullet", text: "Personalausweis" },
    { kind: "heading", text: "Wohnsitz in Nordhafen" },
    { kind: "paragraph", text: "Sie wohnen in Nordhafen." },
  ])
})

test("keeps empty source excerpts empty", () => {
  assert.deepEqual(formatSourceExcerptBlocks("  \n "), [])
})
