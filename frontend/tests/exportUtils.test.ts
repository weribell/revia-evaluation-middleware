import assert from "node:assert/strict"
import test from "node:test"

import { toCsv } from "../src/components/shared/exportUtils.ts"

test("serializes records as CSV with stable headers and escaped cells", () => {
  const csv = toCsv([
    { id: "a1", note: "plain", count: 2 },
    { id: "a2", note: 'line with "quote", comma', count: 3 },
  ])

  assert.equal(
    csv,
    'id,note,count\na1,plain,2\na2,"line with ""quote"", comma",3',
  )
})

test("returns empty CSV for empty exports", () => {
  assert.equal(toCsv([]), "")
})
