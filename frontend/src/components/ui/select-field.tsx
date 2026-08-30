import type { ReactNode } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type SelectFieldOption = {
  label: string
  value: string
}

/**
 * A labelled dropdown built on the project's Select.
 *
 * This exists because the interface had two parallel dropdown implementations:
 * a raw `<select>`, whose menu is drawn by the operating system and therefore
 * looks different on macOS and Windows, and the styled `ui/select`. Wrapping
 * the latter keeps the call sites as short as the raw element was, so there is
 * no reason left to reach for `<select>`.
 *
 * The trigger renders the resolved option label itself: `SelectValue` shows the
 * stored value, which for ids ("batch_5d73…") is not what the user should read.
 */
export function SelectField({
  ariaLabel,
  className,
  disabled = false,
  label,
  options,
  placeholder,
  triggerClassName,
  value,
  onChange,
}: {
  /**
   * Accessible name for a dropdown with no visible `label`. Required whenever
   * `label` is omitted: the trigger shows the selected option, which names the
   * current value but not what the control does.
   */
  ariaLabel?: string
  className?: string
  disabled?: boolean
  /** Omit for a bare dropdown with no label above it. */
  label?: ReactNode
  options: SelectFieldOption[]
  /** Shown when `value` matches no option. */
  placeholder?: string
  triggerClassName?: string
  value: string
  onChange: (value: string) => void
}) {
  const selectedLabel =
    options.find((option) => option.value === value)?.label || placeholder || value

  const trigger = (
    <Select
      disabled={disabled || !options.length}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next)
      }}
    >
      {/* `w-full` beats the trigger's own `w-fit` base class. */}
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          "h-9 w-full min-w-0 rounded-lg border-border bg-card px-2.5 text-sm font-semibold text-foreground shadow-control",
          triggerClassName,
        )}
      >
        <span className="min-w-0 truncate text-left">{selectedLabel}</span>
      </SelectTrigger>
      <SelectContent align="start" className="min-w-[--anchor-width]">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (!label) return <div className={cn("min-w-0", className)}>{trigger}</div>

  return (
    <label className={cn("grid min-w-0 gap-1 text-xs font-medium text-muted-foreground", className)}>
      {label}
      {trigger}
    </label>
  )
}
