import { decisionLabel, normalizeDecision } from "@/lib/decisionDisplay"
import type { Language } from "@/types"
import { developerTr as tr } from "../developerTraceModel"
import { StatusPill } from "./StatusPill"
import type { StatusPillTone } from "./statusPillTones"
import type { DashboardSemanticTone } from "./developerToneClasses"

/**
 * A judge or human decision, drawn as the screen's shared `StatusPill`.
 *
 * `statusTone` classifies free text into the six semantic tones the dashboards
 * use; this narrows those to the pill's five, which is where the meaning is:
 * `evidence` and `human` both describe *which* actor a status belongs to rather
 * than whether anything is wrong, so on a decision they carry no signal and
 * resolve to the neutral icon.
 */
const decisionPillTone: Record<DashboardSemanticTone, StatusPillTone> = {
  evidence: "neutral",
  human: "neutral",
  judge: "warning",
  neutral: "neutral",
  ready: "ready",
  risk: "danger",
}

export function DecisionPill({
  className,
  language,
  tone,
  value,
}: {
  className?: string
  language: Language
  tone: DashboardSemanticTone
  value: string
}) {
  const displayValue = normalizeDecision(value)
    ? decisionLabel(language, value)
    : tr(language, value)

  return (
    <StatusPill className={className} tone={decisionPillTone[tone]}>
      {displayValue}
    </StatusPill>
  )
}
