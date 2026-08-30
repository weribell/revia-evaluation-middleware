import type { ReviewDecision } from "../types"
import type { DashboardTone } from "./dashboardTones"

/**
 * Central decision vocabulary: every component that shows accept / needs_edit /
 * reject should read its label and colour from here instead of hard-coding its
 * own German strings and tones. Keeps `needs_edit` (a human decision) visually
 * distinct from system warnings, which use the "notice" tone instead of "warning".
 */

const DECISION_ALIASES: Record<string, ReviewDecision> = {
  accept: "accept",
  accepted: "accept",
  akzeptiert: "accept",
  akzeptieren: "accept",
  needs_edit: "needs_edit",
  "needs edit": "needs_edit",
  "needs-edit": "needs_edit",
  überarbeiten: "needs_edit",
  "überarbeitung nötig": "needs_edit",
  ändern: "needs_edit",
  reject: "reject",
  rejected: "reject",
  ablehnen: "reject",
  abgelehnt: "reject",
}

export function normalizeDecision(value: string | null | undefined): ReviewDecision | null {
  if (!value) return null
  const key = value.trim().toLowerCase()
  return DECISION_ALIASES[key] ?? null
}

const DECISION_LABELS_DE: Record<ReviewDecision, string> = {
  accept: "Akzeptiert",
  needs_edit: "Überarbeitung nötig",
  reject: "Abgelehnt",
}

const DECISION_LABELS_EN: Record<ReviewDecision, string> = {
  accept: "Accepted",
  needs_edit: "Needs revision",
  reject: "Rejected",
}

export function decisionLabel(language: string, value: string | null | undefined): string {
  const normalized = normalizeDecision(value)
  if (!normalized) return value ?? ""
  const labels = language === "de" ? DECISION_LABELS_DE : DECISION_LABELS_EN
  return labels[normalized]
}

const DECISION_TONES: Record<ReviewDecision, DashboardTone> = {
  accept: "ready",
  needs_edit: "warning",
  reject: "risk",
}

export function decisionTone(value: string | null | undefined): DashboardTone {
  const normalized = normalizeDecision(value)
  return normalized ? DECISION_TONES[normalized] : "neutral"
}
