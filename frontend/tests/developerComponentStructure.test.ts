import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const developerComponentFiles = [
  "frontend/src/components/developer/RunSetupPanel.tsx",
  "frontend/src/components/developer/ResultsCasesPanel.tsx",
  "frontend/src/components/developer/JudgeCalibrationPanel.tsx",
  "frontend/src/components/developer/HumanEvaluationSetupPanel.tsx",
  "frontend/src/components/developer/IntegrationSetupPanel.tsx",
  "frontend/src/components/developer/shared/AttentionBadge.tsx",
  "frontend/src/components/developer/shared/FilterButton.tsx",
  "frontend/src/components/developer/shared/RunDetailPill.tsx",
  "frontend/src/components/developer/shared/RunProgressCard.tsx",
  "frontend/src/components/developer/shared/StatusText.tsx",
  "frontend/src/components/developer/shared/developerToneClasses.ts",
]

test("keeps the developer lab split into focused panel and shared UI files", () => {
  for (const file of developerComponentFiles) {
    assert.equal(existsSync(file), true, `${file} should exist`)
  }
})

test("keeps developer localization checks pointed at split component files", () => {
  const localizationScript = readFileSync("frontend/scripts/check-localization.mjs", "utf8")

  for (const file of developerComponentFiles.slice(0, 5)) {
    assert.match(localizationScript, new RegExp(file.replace("frontend/", "../")))
  }
})

test("keeps run setup free of the selected-question composition block", () => {
  const runSetupSource = readFileSync("frontend/src/components/developer/RunSetupPanel.tsx", "utf8")

  assert.equal(runSetupSource.includes("RunCompositionPanel"), false)
  assert.equal(runSetupSource.includes("Run composition"), false)
  assert.equal(runSetupSource.includes("Frozen study composition"), false)
})

test("keeps the offline judge default instead of silently enabling OpenAI", () => {
  const promptSetupSource = readFileSync(
    "frontend/src/components/developer/PromptSetupPanels.tsx",
    "utf8",
  )
  const calibrationSource = readFileSync(
    "frontend/src/components/developer/JudgeCalibrationPanel.tsx",
    "utf8",
  )

  assert.equal(promptSetupSource.includes('settingsPatch.judge_mode = "openai_judge_v1"'), false)
  assert.equal(calibrationSource.includes('settingsPatch.judge_mode = "openai_judge_v1"'), false)
  assert.match(promptSetupSource, /runSettings\.judge_mode === "rule_based_baseline"/)
  assert.match(promptSetupSource, /repository-root \.env file/)
  assert.match(promptSetupSource, /Never put the key in frontend\/\.env/)
})

test("shows resolved adjudication as an explicit state instead of another resolve action", () => {
  const caseWorkspaceSource = readFileSync(
    "frontend/src/components/developer/DeveloperCaseWorkspace.tsx",
    "utf8",
  )

  assert.match(caseWorkspaceSource, /Final adjudication recorded/)
  assert.match(caseWorkspaceSource, /Change decision/)
  assert.match(caseWorkspaceSource, /Reopen conflict/)
})

test("keeps reviewer comments visible in the results case detail", () => {
  const caseWorkspaceSource = readFileSync(
    "frontend/src/components/developer/DeveloperCaseWorkspace.tsx",
    "utf8",
  )
  const detailsMatcher = caseWorkspaceSource.match(
    /function hasHumanReviewDetails\(review: HumanReview\) \{(?<body>[\s\S]*?)\n\}/,
  )

  assert.ok(detailsMatcher?.groups?.body, "hasHumanReviewDetails should exist")
  assert.match(detailsMatcher.groups.body, /reviewChecklistEntries\(review\)/)
  assert.match(detailsMatcher.groups.body, /reviewerCommentForDisplay\(review\.comment_text/)
  assert.match(detailsMatcher.groups.body, /review\.suggested_correction/)
})

test("keeps the results run toolbar responsive without overlapping controls", () => {
  const resultsSource = readFileSync(
    "frontend/src/components/developer/ResultsCasesPanel.tsx",
    "utf8",
  )

  assert.match(resultsSource, /data-testid="results-run-toolbar"/)
  assert.match(resultsSource, /flex-col[^"\n]*2xl:flex-row/)
  assert.match(resultsSource, /data-testid="results-run-actions"/)
  assert.match(resultsSource, /grid-cols-1[^"\n]*sm:grid-cols-2[^"\n]*xl:grid-cols-4/)
  assert.match(resultsSource, /w-full rounded-lg[^"\n]*2xl:w-auto/)
})
