export type DashboardTone =
  | "clear"
  | "error"
  | "human"
  | "judge"
  | "neutral"
  | "notice"
  | "ready"
  | "risk"
  | "source"
  | "warning"

export const dashboardToneClass: Record<DashboardTone, string> = {
  clear:
    "border-[color:var(--dashboard-clear-border)] bg-[var(--dashboard-clear)] text-[color:var(--dashboard-clear-foreground)]",
  error:
    "border-[color:var(--dashboard-error-border)] bg-[var(--dashboard-error)] text-[color:var(--dashboard-error-foreground)]",
  human:
    "border-[color:var(--dashboard-human-border)] bg-[var(--dashboard-human)] text-[color:var(--dashboard-human-foreground)]",
  judge:
    "border-[color:var(--dashboard-judge-border)] bg-[var(--dashboard-judge)] text-[color:var(--dashboard-judge-foreground)]",
  neutral:
    "border-[color:var(--dashboard-neutral-border)] bg-[var(--dashboard-neutral)] text-[color:var(--dashboard-neutral-foreground)]",
  notice:
    "border-[color:var(--dashboard-notice-border)] bg-[var(--dashboard-notice)] text-[color:var(--dashboard-notice-foreground)]",
  ready:
    "border-[color:var(--dashboard-ready-border)] bg-[var(--dashboard-ready)] text-[color:var(--dashboard-ready-foreground)]",
  risk:
    "border-[color:var(--dashboard-risk-border)] bg-[var(--dashboard-risk)] text-[color:var(--dashboard-risk-foreground)]",
  source:
    "border-[color:var(--dashboard-source-border)] bg-[var(--dashboard-source)] text-[color:var(--dashboard-source-foreground)]",
  warning:
    "border-[color:var(--dashboard-judge-border)] bg-[var(--dashboard-judge)] text-[color:var(--dashboard-judge-foreground)]",
}

export const dashboardToneHoverClass: Record<DashboardTone, string> = {
  clear: "hover:text-[color:var(--dashboard-clear-foreground)]",
  error: "hover:text-[color:var(--dashboard-error-foreground)]",
  human: "hover:text-[color:var(--dashboard-human-foreground)]",
  judge: "hover:text-[color:var(--dashboard-judge-foreground)]",
  neutral: "",
  notice: "hover:text-[color:var(--dashboard-notice-foreground)]",
  ready: "hover:text-[color:var(--dashboard-ready-foreground)]",
  risk: "hover:text-[color:var(--dashboard-risk-foreground)]",
  source: "hover:text-[color:var(--dashboard-source-foreground)]",
  warning: "hover:text-[color:var(--dashboard-judge-foreground)]",
}

/**
 * Full-width decision/info banners: a tone-tinted wash plus the tone border.
 * Text and any icon badge inside are coloured with dashboardBannerTextClass /
 * dashboardBannerBadgeClass so a banner reads as one tone.
 */
export const dashboardBannerClass: Record<DashboardTone, string> = {
  clear: "border-[color:var(--dashboard-clear-border)] bg-[image:var(--banner-ready)]",
  error: "border-[color:var(--dashboard-error-border)] bg-[image:var(--banner-error)]",
  human: "border-[color:var(--dashboard-human-border)] bg-[image:var(--banner-human)]",
  judge: "border-[color:var(--dashboard-judge-border)] bg-[image:var(--banner-warn)]",
  neutral: "border-[color:var(--dashboard-neutral-border)] bg-[image:var(--banner-neutral)]",
  notice: "border-[color:var(--dashboard-notice-border)] bg-[image:var(--banner-neutral)]",
  ready: "border-[color:var(--dashboard-ready-border)] bg-[image:var(--banner-ready)]",
  risk: "border-[color:var(--dashboard-risk-border)] bg-[image:var(--banner-error)]",
  source: "border-[color:var(--dashboard-source-border)] bg-[image:var(--banner-info)]",
  warning: "border-[color:var(--dashboard-judge-border)] bg-[image:var(--banner-warn)]",
}

/**
 * The shade ramp inside a banner: a muted eyebrow, a dark title, mid body copy,
 * a saturated accent for the headline figure, and a chip for the status badge.
 * Without this a banner reads as a wall of one colour.
 */
type BannerShade = {
  accent: string
  body: string
  chip: string
  dot: string
  eyebrow: string
  title: string
}

// Written out literally, not composed from a template string: Tailwind only
// generates arbitrary utilities it can find as complete literals in the source.
const judgeShade: BannerShade = {
  accent: "text-[color:var(--banner-judge-accent)]",
  body: "text-[color:var(--banner-judge-body)]",
  chip: "border-[color:var(--banner-judge-chip-border)] bg-[var(--banner-judge-chip)] text-[color:var(--banner-judge-title)]",
  dot: "bg-[var(--banner-judge-accent)]",
  eyebrow: "text-[color:var(--banner-judge-eyebrow)]",
  title: "text-[color:var(--banner-judge-title)]",
}

const readyShade: BannerShade = {
  accent: "text-[color:var(--banner-ready-accent)]",
  body: "text-[color:var(--banner-ready-body)]",
  chip: "border-[color:var(--banner-ready-chip-border)] bg-[var(--banner-ready-chip)] text-[color:var(--banner-ready-title)]",
  dot: "bg-[var(--banner-ready-accent)]",
  eyebrow: "text-[color:var(--banner-ready-eyebrow)]",
  title: "text-[color:var(--banner-ready-title)]",
}

const riskShade: BannerShade = {
  accent: "text-[color:var(--banner-risk-accent)]",
  body: "text-[color:var(--banner-risk-body)]",
  chip: "border-[color:var(--banner-risk-chip-border)] bg-[var(--banner-risk-chip)] text-[color:var(--banner-risk-title)]",
  dot: "bg-[var(--banner-risk-accent)]",
  eyebrow: "text-[color:var(--banner-risk-eyebrow)]",
  title: "text-[color:var(--banner-risk-title)]",
}

const humanShade: BannerShade = {
  accent: "text-[color:var(--banner-human-accent)]",
  body: "text-[color:var(--banner-human-body)]",
  chip: "border-[color:var(--banner-human-chip-border)] bg-[var(--banner-human-chip)] text-[color:var(--banner-human-title)]",
  dot: "bg-[var(--banner-human-accent)]",
  eyebrow: "text-[color:var(--banner-human-eyebrow)]",
  title: "text-[color:var(--banner-human-title)]",
}

const sourceShade: BannerShade = {
  accent: "text-[color:var(--banner-source-accent)]",
  body: "text-[color:var(--banner-source-body)]",
  chip: "border-[color:var(--banner-source-chip-border)] bg-[var(--banner-source-chip)] text-[color:var(--banner-source-title)]",
  dot: "bg-[var(--banner-source-accent)]",
  eyebrow: "text-[color:var(--banner-source-eyebrow)]",
  title: "text-[color:var(--banner-source-title)]",
}

const neutralShade: BannerShade = {
  accent: "text-[color:var(--banner-neutral-accent)]",
  body: "text-[color:var(--banner-neutral-body)]",
  chip: "border-[color:var(--banner-neutral-chip-border)] bg-[var(--banner-neutral-chip)] text-[color:var(--banner-neutral-title)]",
  dot: "bg-[var(--banner-neutral-accent)]",
  eyebrow: "text-[color:var(--banner-neutral-eyebrow)]",
  title: "text-[color:var(--banner-neutral-title)]",
}

export const dashboardBannerShade: Record<DashboardTone, BannerShade> = {
  clear: readyShade,
  error: riskShade,
  human: humanShade,
  judge: judgeShade,
  neutral: neutralShade,
  notice: neutralShade,
  ready: readyShade,
  risk: riskShade,
  source: sourceShade,
  warning: judgeShade,
}

export const dashboardBannerTextClass: Record<DashboardTone, string> = {
  clear: "text-[color:var(--dashboard-clear-foreground)]",
  error: "text-[color:var(--dashboard-error-foreground)]",
  human: "text-[color:var(--dashboard-human-foreground)]",
  judge: "text-[color:var(--dashboard-judge-foreground)]",
  neutral: "text-[color:var(--dashboard-neutral-foreground)]",
  notice: "text-[color:var(--dashboard-notice-foreground)]",
  ready: "text-[color:var(--dashboard-ready-foreground)]",
  risk: "text-[color:var(--dashboard-risk-foreground)]",
  source: "text-[color:var(--dashboard-source-foreground)]",
  warning: "text-[color:var(--dashboard-judge-foreground)]",
}

export const dashboardBannerBadgeClass: Record<DashboardTone, string> = {
  clear: "border-[color:var(--dashboard-clear-border)] bg-card",
  error: "border-[color:var(--dashboard-error-border)] bg-card",
  human: "border-[color:var(--dashboard-human-border)] bg-card",
  judge: "border-[color:var(--dashboard-judge-border)] bg-card",
  neutral: "border-[color:var(--dashboard-neutral-border)] bg-card",
  notice: "border-[color:var(--dashboard-notice-border)] bg-card",
  ready: "border-[color:var(--dashboard-ready-border)] bg-card",
  risk: "border-[color:var(--dashboard-risk-border)] bg-card",
  source: "border-[color:var(--dashboard-source-border)] bg-card",
  warning: "border-[color:var(--dashboard-judge-border)] bg-card",
}

export const dashboardDotClass: Record<Exclude<DashboardTone, "neutral">, string> = {
  clear: "bg-[var(--dashboard-clear-foreground)]",
  error: "bg-[var(--dashboard-error-foreground)]",
  human: "bg-[var(--dashboard-human-foreground)]",
  judge: "bg-[var(--dashboard-judge-foreground)]",
  notice: "bg-[var(--dashboard-notice-foreground)]",
  ready: "bg-[var(--dashboard-ready-foreground)]",
  risk: "bg-[var(--dashboard-risk-foreground)]",
  source: "bg-[var(--dashboard-source-foreground)]",
  warning: "bg-[var(--dashboard-judge-foreground)]",
}
