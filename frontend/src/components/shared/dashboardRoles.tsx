import type { ReactNode } from "react"
import {
  ClipboardCheck,
  Code2,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react"

import {
  dashboardRolePurposeStatements,
  visibleDashboardRoleValues,
  type DashboardRole,
} from "./dashboardRoleModel"

export type { DashboardRole } from "./dashboardRoleModel"

export type DashboardRoleConfig = {
  value: DashboardRole
  label: string
  title: string
  description: string
  purposeStatement: string
  icon: ReactNode
}

export const dashboardRoles: DashboardRoleConfig[] = [
  {
    value: "review_explorer",
    label: "Review Explorer",
    title: "Human review",
    description:
      "Manually inspect individual citizen questions, generate answers, and review selected cases.",
    purposeStatement:
      "This workspace is for collecting structured human judgments without technical overload.",
    icon: <UserCheck className="size-4" />,
  },
  {
    value: "review_batch",
    label: "Review Batch",
    title: "Human review",
    description:
      "Review an assigned sequence of cases for structured human evaluation data collection.",
    purposeStatement:
      "This workspace is for collecting structured human judgments without technical overload.",
    icon: <ClipboardCheck className="size-4" />,
  },
  {
    value: "developer",
    label: "Developer Lab",
    title: "Developer / Evaluation Lab",
    description:
      "Prepare frozen study runs, reviewer batches, prompt experiments, and case-level debugging.",
    purposeStatement: dashboardRolePurposeStatements.developer,
    icon: <Code2 className="size-4" />,
  },
  {
    value: "management",
    label: "Management",
    title: "Management / service owner view",
    description:
      "Approval status, decision blockers, review progress, and the next responsible team for the selected run.",
    purposeStatement: dashboardRolePurposeStatements.management,
    icon: <Users className="size-4" />,
  },
  {
    value: "audit",
    label: "Audit",
    title: "Compliance / audit view",
    description:
      "Source URLs, source support, prompt and model versions, reviewer decisions, and unsupported-claim checks.",
    purposeStatement: dashboardRolePurposeStatements.audit,
    icon: <ShieldCheck className="size-4" />,
  },
]

export const visibleDashboardRoles = dashboardRoles.filter((role) =>
  visibleDashboardRoleValues.includes(role.value),
)

export function isDashboardRole(value: string | null): value is DashboardRole {
  return dashboardRoles.some((role) => role.value === value)
}
