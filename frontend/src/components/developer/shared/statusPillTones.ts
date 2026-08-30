import { Circle, CircleAlert, CircleCheck, CircleX, type LucideIcon } from "lucide-react"

/**
 * The icon and hue for each status tone, kept in its own module so `StatusPill`
 * exports nothing but a component (Fast Refresh only tracks files that do).
 *
 * Hue lives here rather than on the pill's surface because every status on the
 * case screen used to tint its whole chip, each family from a different palette
 * — judge and human decisions from `semanticToneClasses`, the attention column
 * from `dashboardToneClass`, the filter chips from `filterToneClasses`. Three
 * tinted vocabularies on one screen meant colour carried no consistent meaning.
 * An icon is small enough that several on a row stay quiet, and it makes the
 * state redundant with the label rather than dependent on hue alone.
 */
export const statusPillIcon = {
  danger: { Icon: CircleX, className: "text-[color:var(--dashboard-error-rail)]" },
  neutral: { Icon: Circle, className: "text-[color:var(--signal-grey)]" },
  notice: { Icon: CircleAlert, className: "text-[color:var(--dashboard-notice-foreground)]" },
  ready: { Icon: CircleCheck, className: "text-[color:var(--signal-green)]" },
  warning: { Icon: CircleAlert, className: "text-[color:var(--signal-amber)]" },
} as const satisfies Record<string, { Icon: LucideIcon; className: string }>

export type StatusPillTone = keyof typeof statusPillIcon
