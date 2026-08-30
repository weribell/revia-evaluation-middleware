export type DashboardRole =
  | "review_explorer"
  | "review_batch"
  | "developer"
  | "management"
  | "audit"

export const dashboardRoleValues: DashboardRole[] = [
  "review_explorer",
  "review_batch",
  "developer",
  "management",
  "audit",
]

export const visibleDashboardRoleValues: DashboardRole[] = [
  "developer",
  "management",
  "audit",
]

export const dashboardRolePurposeStatements: Record<
  Extract<DashboardRole, "developer" | "management" | "audit">,
  string
> = {
  developer:
    "This dashboard is for preparing study runs and debugging why individual cases behaved the way they did.",
  management:
    "This dashboard helps a service owner decide whether the selected run can be approved for the next controlled step, what blocks the decision, and which team should act next.",
  audit:
    "This dashboard is for reconstructing evaluated answers later: sources, decisions, versions, reviewer evidence, and evidence gaps.",
}

export function shouldShowDashboardRoleSelect(activeRole: DashboardRole) {
  return activeRole !== "review_batch"
}

export function shouldShowDeveloperLabReturn(
  activeRole: DashboardRole,
  participantReviewLink: boolean,
) {
  return activeRole === "review_batch" && !participantReviewLink
}

export function usesCompactDashboardHeader(activeRole: DashboardRole) {
  return visibleDashboardRoleValues.includes(activeRole)
}
