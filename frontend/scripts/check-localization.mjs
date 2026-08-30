import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const appSource = readFileSync(join(scriptDir, "../src/App.tsx"), "utf8")
const appTextSource = readFileSync(join(scriptDir, "../src/appText.ts"), "utf8")
const questionFilterSource = readFileSync(
  join(scriptDir, "../src/components/review/questionFilters.ts"),
  "utf8",
)
const questionPickerSource = readFileSync(
  join(scriptDir, "../src/components/review/QuestionPicker.tsx"),
  "utf8",
)
const reviewWorkspaceSource = readFileSync(
  join(scriptDir, "../src/components/review/ReviewWorkspace.tsx"),
  "utf8",
)
const reviewBatchWorkspaceSource = readFileSync(
  join(scriptDir, "../src/components/review/ReviewBatchWorkspace.tsx"),
  "utf8",
)
const roleSelectorSource = readFileSync(
  join(scriptDir, "../src/components/shared/RoleSelector.tsx"),
  "utf8",
)
const dashboardRolesSource = readFileSync(
  join(scriptDir, "../src/components/shared/dashboardRoles.tsx"),
  "utf8",
)
const developerSourceFiles = [
  "../src/components/developer/developerTraceModel.ts",
  "../src/components/developer/TraceList.tsx",
  "../src/components/developer/RunSetupPanel.tsx",
  "../src/components/developer/PromptSetupPanels.tsx",
  "../src/components/developer/ImportedAnswersSetup.tsx",
  "../src/components/developer/QuestionBankPanel.tsx",
  "../src/components/developer/ResultsCasesPanel.tsx",
  "../src/components/developer/JudgeCalibrationPanel.tsx",
  "../src/components/developer/HumanEvaluationSetupPanel.tsx",
  "../src/components/developer/IntegrationSetupPanel.tsx",
]
const developerSources = developerSourceFiles.map((file) => readFileSync(join(scriptDir, file), "utf8"))
const source = [
  appSource,
  appTextSource,
  questionFilterSource,
  questionPickerSource,
  reviewWorkspaceSource,
  reviewBatchWorkspaceSource,
  roleSelectorSource,
  dashboardRolesSource,
  ...developerSources,
].join("\n")

const requiredSnippets = [
  "const languageStorageKey",
  "useState<Language>(() => getInitialLanguage())",
  "Sprache",
  "Dashboard-Ansicht",
  "Bewertung speichern",
  "Bürgerfrage",
  "Vorgeschlagene Antwort generieren",
  "function questionWorkTags",
  "function questionWorkTagLabel",
  "Clarification needed",
  "Rückfrage nötig",
  "Direkt / unhöflich",
  "Mehrteilig",
  "Zeitdruck",
]

const missing = requiredSnippets.filter((snippet) => !source.includes(snippet))

if (missing.length) {
  console.error(`Missing localization snippets: ${missing.join(", ")}`)
  process.exit(1)
}

const removedBatchSummarySnippets = [
  "questions in this batch",
  "guided review flow",
  "position in this browser",
]

const stillPresent = removedBatchSummarySnippets.filter((snippet) => appSource.includes(snippet))

if (stillPresent.length) {
  console.error(`Batch intro still contains removed summary snippets: ${stillPresent.join(", ")}`)
  process.exit(1)
}

if (appSource.includes("{shortLabel(question.style_label)}")) {
  console.error("Question style tags still use untranslated shortLabel output.")
  process.exit(1)
}

if (appSource.includes("function questionTagLabel")) {
  console.error("Raw metadata tag labels should not be rendered as reviewer-facing tags.")
  process.exit(1)
}
