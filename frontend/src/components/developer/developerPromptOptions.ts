export const ANSWER_MODEL_OPTIONS = [
  { label: "No LLM baseline", value: "no_llm_baseline" },
  { label: "GPT-5 mini", value: "gpt-5-mini" },
  { label: "GPT-5", value: "gpt-5" },
  { label: "GPT-5.4 mini", value: "gpt-5.4-mini" },
  { label: "GPT-5.4", value: "gpt-5.4" },
]

// gpt-4.1 models are intentionally not offered for the judge: they reject the
// judge's text.verbosity/reasoning settings and every case fails with HTTP 400.
export const JUDGE_MODEL_OPTIONS = [
  { label: "GPT-5 mini", value: "gpt-5-mini" },
  { label: "GPT-5", value: "gpt-5" },
  { label: "GPT-5.4 mini", value: "gpt-5.4-mini" },
  { label: "GPT-5.4", value: "gpt-5.4" },
]

export const DEFAULT_JUDGE_MODEL_NAME = "gpt-5-mini"

export function savedModelIfAvailable(modelName: string | undefined, options: { value: string }[]) {
  return options.some((option) => option.value === modelName) ? modelName : ""
}
