import { dashboardToneClass, dashboardToneHoverClass } from "@/lib/dashboardTones"
import { cn } from "@/lib/utils"

export type DashboardSemanticTone = "evidence" | "human" | "judge" | "neutral" | "ready" | "risk"

export function semanticToneClasses(tone: DashboardSemanticTone, active = false) {
  if (tone === "evidence") {
    return cn(dashboardToneClass.source, !active && dashboardToneHoverClass.source)
  }
  if (tone === "human") {
    return cn(dashboardToneClass.human, !active && dashboardToneHoverClass.human)
  }
  if (tone === "judge") {
    return cn(dashboardToneClass.judge, !active && dashboardToneHoverClass.judge)
  }
  if (tone === "ready") {
    return cn(dashboardToneClass.ready, !active && dashboardToneHoverClass.ready)
  }
  if (tone === "risk") {
    return cn(dashboardToneClass.risk, !active && dashboardToneHoverClass.risk)
  }
  return active ? "" : ""
}

const CHIP_NEUTRAL =
  "border-[color:var(--chip-neutral-border)] bg-[var(--chip-neutral)] text-[color:var(--chip-neutral-foreground)] hover:text-[color:var(--chip-neutral-foreground)]"
const CHIP_WARN =
  "border-[color:var(--chip-warn-border)] bg-[var(--chip-warn)] text-[color:var(--chip-warn-foreground)] hover:text-[color:var(--chip-warn-foreground)]"
const CHIP_ERROR =
  "border-[color:var(--chip-error-border)] bg-[var(--chip-error)] text-[color:var(--chip-error-foreground)] hover:text-[color:var(--chip-error-foreground)]"

/**
 * Filter chips stay pale on purpose: only the active chip is saturated, so the
 * current selection stays readable against a bar of many chips.
 */
export function filterToneClasses(tone: DashboardSemanticTone, active = false) {
  if (active) return ""
  if (tone === "judge") return CHIP_WARN
  if (tone === "risk") return CHIP_ERROR
  return CHIP_NEUTRAL
}

export function statusTone(value: string): DashboardSemanticTone {
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_")
  if (normalized.includes("accept") || normalized.includes("ready")) return "ready"
  if (normalized.includes("reject") || normalized.includes("false") || normalized.includes("mismatch")) return "risk"
  if (normalized.includes("need") || normalized.includes("judge")) return "judge"
  if (normalized.includes("human") || normalized.includes("pending") || normalized.includes("review")) return "human"
  if (normalized.includes("answer") || normalized.includes("source")) return "evidence"
  return "neutral"
}
