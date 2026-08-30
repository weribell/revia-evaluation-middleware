import { Code2, FlaskConical } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  buildNextPromptVersion,
  buildPromptJudgeSettings,
  buildPromptVersionOptions,
  shouldShowAnswerPromptSettings,
  shouldShowJudgePromptSettings,
  type DeveloperActiveRun,
  type RunInputSource,
} from "./developerLabModel"
import { developerTr as tr } from "./developerTraceModel"
import {
  ANSWER_MODEL_OPTIONS,
  DEFAULT_JUDGE_MODEL_NAME,
  JUDGE_MODEL_OPTIONS,
  savedModelIfAvailable,
} from "./developerPromptOptions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SectionCard } from "@/components/ui/section-card"
import { SelectField } from "@/components/ui/select-field"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type {
  DeveloperPromptsResponse,
  DeveloperRunSettings,
  Language,
  PromptType,
} from "@/types"

export function PromptJudgeLabPanel({
  activeRun,
  developerPrompts,
  language,
  runInputSource,
  runSettings,
  savingPromptType,
  onRunSettingsChange,
  onSavePrompt,
}: {
  activeRun: DeveloperActiveRun
  developerPrompts: DeveloperPromptsResponse | null
  language: Language
  runInputSource: RunInputSource
  runSettings: DeveloperRunSettings
  savingPromptType: PromptType | ""
  onRunSettingsChange: (settings: Partial<DeveloperRunSettings>) => void
  onSavePrompt: (prompt: { promptText: string; promptType: PromptType; promptVersion: string }) => void
}) {
  const settings = buildPromptJudgeSettings(activeRun)
  const defaults = developerPrompts?.defaults
  const promptItems = useMemo(() => developerPrompts?.items || [], [developerPrompts?.items])
  const answerOptions = buildPromptVersionOptions(promptItems, "answer", {
    promptText: defaults?.answer_prompt_text || settings.answerPrompt.description,
    promptVersion: defaults?.answer_prompt_version || settings.answerPrompt.version,
  })
  const judgeOptions = buildPromptVersionOptions(promptItems, "judge", {
    promptText: defaults?.judge_prompt_text || settings.judgePrompt.description,
    promptVersion: defaults?.judge_prompt_version || settings.judgePrompt.version,
  })
  const judgeModelName = runSettings.judge_model_name || defaults?.judge_model_name || DEFAULT_JUDGE_MODEL_NAME
  const [answerDraft, setAnswerDraft] = useState({
    saveVersion: buildNextPromptVersion(promptItems, "answer", runSettings.model_name),
    selectedVersion: runSettings.answer_prompt_version,
    text: runSettings.answer_prompt_text,
  })
  const [judgeDraft, setJudgeDraft] = useState({
    saveVersion: buildNextPromptVersion(promptItems, "judge", "openai_judge_v1"),
    selectedVersion: runSettings.judge_prompt_version,
    text: runSettings.judge_prompt_text,
  })

  useEffect(() => {
    const settingsPatch: Partial<DeveloperRunSettings> = {}
    if (!runSettings.judge_model_name) {
      settingsPatch.judge_model_name = judgeModelName
    }
    if (Object.keys(settingsPatch).length) {
      onRunSettingsChange(settingsPatch)
    }
    setAnswerDraft((current) => ({
      saveVersion:
        current.selectedVersion !== runSettings.answer_prompt_version || current.saveVersion === current.selectedVersion
          ? buildNextPromptVersion(promptItems, "answer", runSettings.model_name)
          : current.saveVersion,
      selectedVersion: runSettings.answer_prompt_version,
      text: runSettings.answer_prompt_text,
    }))
    setJudgeDraft((current) => ({
      saveVersion:
        current.selectedVersion !== runSettings.judge_prompt_version || current.saveVersion === current.selectedVersion
          ? buildNextPromptVersion(promptItems, "judge", "openai_judge_v1")
          : current.saveVersion,
      selectedVersion: runSettings.judge_prompt_version,
      text: runSettings.judge_prompt_text,
    }))
  }, [
    promptItems,
    runSettings.answer_prompt_text,
    runSettings.answer_prompt_version,
    runSettings.judge_mode,
    runSettings.judge_prompt_text,
    runSettings.judge_prompt_version,
    runSettings.model_name,
    runSettings.judge_model_name,
    judgeModelName,
    onRunSettingsChange,
  ])

  function selectAnswerPrompt(version: string) {
    const option = answerOptions.find((item) => item.value === version)
    const savedModelName = savedModelIfAvailable(option?.modelName, ANSWER_MODEL_OPTIONS)
    const nextSettings = {
      answer_prompt_text: option?.promptText || runSettings.answer_prompt_text,
      answer_prompt_version: version,
      model_name: savedModelName || runSettings.model_name,
    }
    setAnswerDraft({
      saveVersion: buildNextPromptVersion(promptItems, "answer", runSettings.model_name),
      selectedVersion: nextSettings.answer_prompt_version,
      text: nextSettings.answer_prompt_text,
    })
    onRunSettingsChange(nextSettings)
  }

  function selectJudgePrompt(version: string) {
    const option = judgeOptions.find((item) => item.value === version)
    const savedJudgeModelName = savedModelIfAvailable(option?.modelName, JUDGE_MODEL_OPTIONS)
    const nextSettings = {
      judge_model_name: savedJudgeModelName || judgeModelName,
      judge_prompt_text: option?.promptText || runSettings.judge_prompt_text,
      judge_prompt_version: version,
    }
    setJudgeDraft({
      saveVersion: buildNextPromptVersion(promptItems, "judge", "openai_judge_v1"),
      selectedVersion: nextSettings.judge_prompt_version,
      text: nextSettings.judge_prompt_text,
    })
    onRunSettingsChange(nextSettings)
  }

  function saveAnswerPrompt() {
    onSavePrompt({
      promptText: answerDraft.text,
      promptType: "answer",
      promptVersion: answerDraft.saveVersion,
    })
  }

  function saveJudgePrompt() {
    onSavePrompt({
      promptText: judgeDraft.text,
      promptType: "judge",
      promptVersion: judgeDraft.saveVersion,
    })
  }

  return (
    <section
      className={cn(
        "grid min-h-0 gap-2 pb-1",
        shouldShowAnswerPromptSettings(runInputSource) ? "xl:grid-cols-2" : "xl:grid-cols-1",
      )}
    >
      <div className="rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm leading-6 text-muted-foreground xl:col-span-2">
        {tr(
          language,
          "Local OpenAI setup: add OPENAI_API_KEY to the repository-root .env file and restart the backend. Never put the key in frontend/.env or commit it to Git.",
        )}
      </div>
      {shouldShowAnswerPromptSettings(runInputSource) ? (
        <PromptBaselinePanel
          actionLabel="Save answer version"
          currentText={answerDraft.text}
          language={language}
          modelName={runSettings.model_name}
          onModelNameChange={(modelName) => {
            setAnswerDraft((current) => ({
              ...current,
              saveVersion: buildNextPromptVersion(promptItems, "answer", modelName),
            }))
            onRunSettingsChange({ model_name: modelName })
          }}
          onSelectVersion={selectAnswerPrompt}
          onTextChange={(text) => {
            setAnswerDraft((current) => ({ ...current, text }))
            onRunSettingsChange({ answer_prompt_text: text })
          }}
          onVersionChange={(version) => setAnswerDraft((current) => ({ ...current, saveVersion: version }))}
          options={answerOptions}
          saveVersion={answerDraft.saveVersion}
          selectedVersion={answerDraft.selectedVersion}
          saving={savingPromptType === "answer"}
          title={runSettings.model_name === "no_llm_baseline" ? "Answer prompt baseline" : "OpenAI answer prompt"}
          onSavePrompt={saveAnswerPrompt}
        />
      ) : null}
      {shouldShowJudgePromptSettings(runInputSource) ? (
        <PromptBaselinePanel
          actionLabel="Save judge version"
          currentText={judgeDraft.text}
          judgeModelName={judgeModelName}
          language={language}
          onJudgeModelNameChange={(judgeModelName) =>
            onRunSettingsChange({ judge_model_name: judgeModelName, judge_mode: "openai_judge_v1" })
          }
          onSelectVersion={selectJudgePrompt}
          onTextChange={(text) => {
            setJudgeDraft((current) => ({ ...current, text }))
            onRunSettingsChange({ judge_prompt_text: text })
          }}
          onVersionChange={(version) => setJudgeDraft((current) => ({ ...current, saveVersion: version }))}
          options={judgeOptions}
          saveVersion={judgeDraft.saveVersion}
          selectedVersion={judgeDraft.selectedVersion}
          saving={savingPromptType === "judge"}
          title={runSettings.judge_mode === "rule_based_baseline" ? "Rule-based judge baseline" : "OpenAI judge prompt"}
          onSavePrompt={saveJudgePrompt}
        />
      ) : null}
    </section>
  )
}

function PromptBaselinePanel({
  actionLabel,
  currentText,
  judgeModelName,
  language,
  modelName,
  onJudgeModelNameChange,
  onModelNameChange,
  onSelectVersion,
  onSavePrompt,
  onTextChange,
  onVersionChange,
  options,
  saveVersion,
  selectedVersion,
  saving,
  title,
}: {
  actionLabel: string
  currentText: string
  judgeModelName?: string
  language: Language
  modelName?: string
  onJudgeModelNameChange?: (judgeModelName: string) => void
  onModelNameChange?: (modelName: string) => void
  onSelectVersion: (version: string) => void
  onSavePrompt: () => void
  onTextChange: (text: string) => void
  onVersionChange: (version: string) => void
  options: { label: string; promptText: string; value: string }[]
  saveVersion: string
  selectedVersion: string
  saving: boolean
  title: string
}) {
  const [isPromptOpen, setIsPromptOpen] = useState(true)

  return (
    <SectionCard className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 items-center gap-2 text-section-title text-foreground">
          <Code2 className="size-4 shrink-0" />
          <span className="truncate">{tr(language, title)}</span>
        </div>
      </div>
      {typeof modelName === "string" && onModelNameChange ? (
        <SelectField
          label={tr(language, "Answer model")}
          options={ANSWER_MODEL_OPTIONS.map((option) => ({
            label:
              option.value === "no_llm_baseline" ? tr(language, option.label) : option.label,
            value: option.value,
          }))}
          value={modelName}
          onChange={onModelNameChange}
        />
      ) : null}
      {typeof judgeModelName === "string" && onJudgeModelNameChange ? (
        <SelectField
          label={tr(language, "Judge model")}
          options={JUDGE_MODEL_OPTIONS.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
          value={judgeModelName}
          onChange={onJudgeModelNameChange}
        />
      ) : null}
      <SelectField
        label={tr(language, "Selected version")}
        options={options.map((option) => ({ label: option.label, value: option.value }))}
        value={selectedVersion}
        onChange={onSelectVersion}
      />
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        {tr(language, "New version name")}
        <Input value={saveVersion} onChange={(event) => onVersionChange(event.currentTarget.value)} />
      </label>
      <div className="grid gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 max-w-fit rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-surface-soft hover:text-foreground"
          onClick={() => setIsPromptOpen((current) => !current)}
        >
          {tr(language, "Prompt text")}
          <span className="text-muted-foreground">{isPromptOpen ? "-" : "+"}</span>
        </Button>
        {isPromptOpen ? (
          <Textarea
            className="h-48 min-h-48 max-h-48 resize-none overflow-y-auto field-sizing-fixed bg-card text-sm font-medium leading-6 text-foreground placeholder:text-muted-foreground"
            value={currentText}
            onChange={(event) => onTextChange(event.currentTarget.value)}
          />
        ) : null}
      </div>
      <Button
        size="sm"
        className="h-9 max-w-fit rounded-xl px-4 shadow-primary"
        onClick={onSavePrompt}
        disabled={saving}
      >
        <FlaskConical />
        {saving ? tr(language, "Saving") : tr(language, actionLabel)}
      </Button>
    </SectionCard>
  )
}
