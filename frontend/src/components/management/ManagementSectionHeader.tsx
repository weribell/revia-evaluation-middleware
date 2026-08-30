import { type ReactNode } from "react"

import type { Language } from "@/types"
import { PanelHeader } from "@/components/ui/panel-header"

import { tr } from "./managementText"

/** Thin translation wrapper over the shared PanelHeader. */
export function ManagementSectionHeader({
  action,
  detail,
  icon,
  language,
  title,
}: {
  action?: ReactNode
  detail?: string
  icon: ReactNode
  language: Language
  title: string
}) {
  return (
    <PanelHeader
      action={action}
      description={detail ? tr(language, detail) : undefined}
      icon={icon}
      title={tr(language, title)}
    />
  )
}
