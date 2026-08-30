import { type DashboardTone } from "@/lib/dashboardTones"
import { type CockpitTone } from "./managementCockpitModel"

export function cockpitColor(tone: CockpitTone) {
  if (tone === "danger") return "var(--chart-3)"
  if (tone === "ready") return "var(--chart-1)"
  if (tone === "warning") return "var(--chart-2)"
  if (tone === "conflict") return "var(--chart-4)"
  return "var(--chart-5)"
}

/** Cockpit tones are this screen's vocabulary; banners speak the shared dashboard tones. */
export function cockpitBannerTone(tone: CockpitTone): DashboardTone {
  if (tone === "danger") return "error"
  if (tone === "ready") return "ready"
  if (tone === "warning") return "judge"
  if (tone === "conflict") return "human"
  return "neutral"
}
