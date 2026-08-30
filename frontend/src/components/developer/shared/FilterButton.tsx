import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { statusPillIcon, type StatusPillTone } from "./statusPillTones"
import type { DashboardSemanticTone } from "./developerToneClasses"

/**
 * A filter chip, drawn to match the status pills in the table it filters.
 *
 * Each chip used to be tinted by its own tone, so the row above the table was a
 * band of amber and red competing with the amber and red inside it — and the
 * counts, which are the reason the chips are always visible, had to be read
 * through that. The chips are now neutral like the pills, with the tone carried
 * by the icon, and a fill means only one thing: this filter is the active one.
 * That is the same rule the tab strip follows.
 */
const filterChipTone: Record<DashboardSemanticTone, StatusPillTone> = {
  evidence: "notice",
  human: "neutral",
  judge: "warning",
  neutral: "neutral",
  ready: "ready",
  risk: "danger",
}

export function FilterButton({
  active,
  alert = false,
  count,
  disabled,
  label,
  onClick,
  tone = "neutral",
}: {
  active: boolean
  /** The signal has cases in it, so its count is worth pulling forward. */
  alert?: boolean
  count?: number
  disabled: boolean
  label: string
  onClick: () => void
  tone?: DashboardSemanticTone
}) {
  const { Icon, className: iconClassName } = statusPillIcon[filterChipTone[tone]]

  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      className={cn(
        "gap-1.5 rounded-full font-semibold transition",
        active
          ? "font-bold shadow-primary"
          : "border-[color:var(--chip-neutral-border)] bg-[var(--chip-neutral)] text-[color:var(--chip-neutral-foreground)] hover:text-[color:var(--chip-neutral-foreground)]",
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {/* The active chip is a solid fill, so a tinted icon on it would be the
          one thing on the chip fighting its own background. It inherits. */}
      <Icon className={cn("size-3.5 shrink-0", !active && iconClassName)} aria-hidden />
      {label}
      {typeof count === "number" ? (
        <span
          className={cn(
            "ml-0.5 rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold leading-none",
            active && "bg-white/25 text-current",
            !active && "bg-transparent text-[color:var(--chip-neutral-count)]",
            !active && alert && "text-[color:var(--dashboard-error-foreground)]",
          )}
        >
          {count}
        </span>
      ) : null}
    </Button>
  )
}
