import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function readRootToken(name: string) {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  const rootBlock = css.match(/:root\s*\{(?<body>[\s\S]*?)\n\}/)?.groups?.body || ""
  const match = rootBlock.match(new RegExp(`--${name}:\\s*([^;]+);`))
  return match?.[1]?.trim() || ""
}

test("uses the evidence dossier lavender for primary buttons and dashboard accents", () => {
  assert.equal(readRootToken("primary"), "#574f8e")
  assert.equal(readRootToken("primary-foreground"), "#ffffff")
  assert.equal(readRootToken("foreground"), "#221d38")
  assert.equal(readRootToken("dashboard-active"), "#574f8e")
  assert.equal(readRootToken("dashboard-active-foreground"), "#ffffff")
  assert.equal(readRootToken("ring"), "#b8aed8")
  assert.equal(readRootToken("dashboard-source"), "#eef4ff")
  assert.equal(readRootToken("dashboard-source-border"), "#cfdcf5")
  assert.equal(readRootToken("dashboard-source-foreground"), "#3a5f9c")
  assert.equal(readRootToken("dashboard-judge"), "#fef6e6")
  assert.equal(readRootToken("dashboard-judge-border"), "#f2ddab")
  assert.equal(readRootToken("dashboard-judge-foreground"), "#9a6b00")
  assert.equal(readRootToken("dashboard-human"), "#f2edfb")
  assert.equal(readRootToken("dashboard-human-border"), "#ddd2f0")
  assert.equal(readRootToken("dashboard-human-foreground"), "#5b4f96")
  assert.equal(readRootToken("dashboard-risk"), "#fbeef1")
  assert.equal(readRootToken("dashboard-risk-border"), "#f0ccd5")
  assert.equal(readRootToken("dashboard-risk-foreground"), "#b9425a")
  assert.equal(readRootToken("dashboard-ready"), "#e7f6ee")
  assert.equal(readRootToken("dashboard-ready-border"), "#bfe6d1")
  assert.equal(readRootToken("dashboard-ready-foreground"), "#16855c")
})
