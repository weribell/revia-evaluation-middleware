import { developerTr as tr } from "../developerTraceModel"
import { StatusPill } from "./StatusPill"
import type { StatusPillTone } from "./statusPillTones"
import type { Language } from "@/types"
import type { RunCaseAttentionTone } from "../developerLabModel"

/**
 * The attention column and the calibration verdict, drawn as the screen's
 * shared `StatusPill`.
 *
 * This used to be the one fully tinted badge left on the case table, kept loud
 * on the argument that colour should be spent where it is scarce. What made it
 * redundant is that a flagged row already carries a red rail down its left
 * edge: the row is found by the rail, and the badge's job is to *name* the
 * signal once you are looking at it. Two loud marks for one fact is one too
 * many.
 */
const attentionPillTone: Record<RunCaseAttentionTone, StatusPillTone> = {
  danger: "danger",
  notice: "notice",
  quiet: "neutral",
  ready: "ready",
  warning: "warning",
}

export function AttentionBadge({
  language,
  tone,
  value,
}: {
  language: Language
  tone: RunCaseAttentionTone
  value: string
}) {
  return <StatusPill tone={attentionPillTone[tone]}>{tr(language, value)}</StatusPill>
}
