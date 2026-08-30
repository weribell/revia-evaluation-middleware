import type { Language } from "../../types"
import {
  dashboardRoles,
  visibleDashboardRoles,
  type DashboardRole,
} from "./dashboardRoles"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type Translate = (language: Language, text: string) => string

const languageLabels: Record<Language, string> = {
  de: "DE",
  en: "EN",
}

export function RoleSelector({
  activeRole,
  language,
  showRoleSelect = true,
  t,
  onLanguageChange,
  onRoleChange,
}: {
  activeRole: DashboardRole
  language: Language
  showRoleSelect?: boolean
  t: Translate
  onLanguageChange: (language: Language) => void
  onRoleChange: (role: DashboardRole) => void
}) {
  const activeRoleConfig =
    dashboardRoles.find((role) => role.value === activeRole) || dashboardRoles[0]

  return (
    <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-end">
      <div className="w-full lg:w-[8rem]">
        <Label className="mb-2 block text-xs font-medium text-label">
          {t(language, "Language")}
        </Label>
        <div
          className="grid h-14 grid-cols-2 rounded-2xl border border-border bg-card p-1 shadow-control"
          aria-label={t(language, "Switch interface language")}
        >
          {(["de", "en"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={cn(
                "rounded-xl text-sm font-semibold transition",
                language === option
                  ? "bg-[var(--dashboard-active)] text-[var(--dashboard-active-foreground)] shadow-sm"
                  : "text-label hover:bg-surface-soft",
              )}
              onClick={() => onLanguageChange(option)}
            >
              {languageLabels[option]}
            </button>
          ))}
        </div>
      </div>
      {showRoleSelect ? (
        <div className="w-full lg:w-[22rem]">
          <Label className="mb-2 block text-xs font-medium text-label">
            {t(language, "Dashboard view")}
          </Label>
          <Select
            value={activeRole}
            onValueChange={(value) => {
              if (value) onRoleChange(value as DashboardRole)
            }}
          >
            <SelectTrigger
              aria-label={t(language, "Dashboard view")}
              className="min-h-14 w-full rounded-2xl border-border bg-card px-3.5 py-2 text-base shadow-control hover:bg-surface-soft"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--dashboard-active)] text-[var(--dashboard-active-foreground)]">
                  {activeRoleConfig.icon}
                </span>
                <span className="truncate font-semibold text-foreground">
                  {t(language, activeRoleConfig.label)}
                </span>
              </span>
            </SelectTrigger>
            <SelectContent
              align="end"
              className="min-w-[22rem] rounded-2xl border-border bg-card p-1 shadow-panel"
            >
              {visibleDashboardRoles.map((role) => (
                <SelectItem
                  key={role.value}
                  value={role.value}
                  label={t(language, role.label)}
                  className="rounded-xl px-3 py-3 text-base data-selected:bg-[var(--dashboard-human)]"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-label">
                    {role.icon}
                  </span>
                  <span className="grid min-w-0">
                    <span className="truncate font-semibold">{t(language, role.label)}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t(language, role.title)}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  )
}
