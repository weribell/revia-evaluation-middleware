import { dashboardRoleValues, type DashboardRole } from "./components/shared/dashboardRoleModel"
import {
  isWorklistFilter,
  type DeveloperLabTabId,
  type WorklistFilter,
} from "./components/developer/developerLabModel"

export const dashboardRoleStorageKey = "revia_dashboard_role_v1"

// Deliberately checked against `dashboardRoleValues` rather than the `isDashboardRole`
// exported by `dashboardRoles.tsx`: that module carries JSX icons, and this one is
// imported directly by the plain-node test runner.
function isDashboardRole(value: string | null): value is DashboardRole {
  return dashboardRoleValues.includes(value as DashboardRole)
}

export function isReviewerPath(pathname = "") {
  return pathname.replace(/\/+$/, "") === "/reviewer"
}

export function isParticipantReviewLink(search: string, pathname = "") {
  const params = new URLSearchParams(search)
  const hasParticipant = Boolean(params.get("participant")?.trim())
  return hasParticipant && (params.get("role") === "review_batch" || isReviewerPath(pathname))
}

export function shouldLoadInitialDashboardData(pathname = "") {
  return !isReviewerPath(pathname)
}

export function shouldRefreshAfterBatchReviewSave(participantId = "") {
  return !participantId.trim()
}

export function getInitialDashboardRole(): DashboardRole {
  const roleFromUrl = new URLSearchParams(window.location.search).get("role")
  if (isReviewerPath(window.location.pathname)) return "review_batch"
  // Legacy: the Research role was folded into the Developer Lab "Analysis" tab.
  if (roleFromUrl === "research") {
    const url = new URL(window.location.href)
    url.searchParams.set("role", "developer")
    url.searchParams.set("developer_tab", "analysis")
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`)
    return "developer"
  }
  if (roleFromUrl === "review_batch") return "review_batch"
  if (isDashboardRole(roleFromUrl) && roleFromUrl !== "review_explorer") return roleFromUrl

  const stored = window.localStorage.getItem(dashboardRoleStorageKey)
  if (isDashboardRole(stored) && stored !== "review_explorer" && stored !== "review_batch") {
    return stored
  }
  return "developer"
}

export function getParticipantFromUrl() {
  return new URLSearchParams(window.location.search).get("participant") || ""
}

export function getBatchIdFromUrl() {
  return new URLSearchParams(window.location.search).get("batch_id") || ""
}

export function getReviewerTokenFromUrl() {
  return new URLSearchParams(window.location.search).get("token") || ""
}

export function getInitialWorklistFilter(): WorklistFilter {
  const requestedFilter = new URLSearchParams(window.location.search).get("developer_filter")
  return isWorklistFilter(requestedFilter) ? requestedFilter : "all"
}

export function getInitialDeveloperBatchId() {
  return new URLSearchParams(window.location.search).get("developer_batch_id") || undefined
}

export function getInitialDeveloperTraceId() {
  return new URLSearchParams(window.location.search).get("developer_trace_id") || ""
}

export function buildDeveloperResultsUrl(
  currentHref: string,
  {
    batchId,
    filter,
  }: {
    batchId?: string
    filter: WorklistFilter
  },
) {
  return buildDeveloperStateUrl(currentHref, {
    batchId,
    filter,
    tab: "results_cases",
  })
}

export function buildDashboardRoleUrl(currentHref: string, role: DashboardRole) {
  const url = new URL(currentHref)
  if (isReviewerPath(url.pathname)) {
    url.pathname = "/"
  }
  url.searchParams.delete("participant")
  url.searchParams.delete("batch_id")
  url.searchParams.delete("token")
  url.searchParams.set("role", role)
  return `${url.pathname}${url.search}${url.hash}`
}

export function replaceDashboardRoleUrl(role: DashboardRole) {
  const nextUrl = buildDashboardRoleUrl(window.location.href, role)
  window.history.replaceState({}, "", nextUrl)
}

export function buildDeveloperStateUrl(
  currentHref: string,
  {
    batchId,
    filter,
    tab,
    traceId,
  }: {
    batchId?: string
    filter?: WorklistFilter
    tab?: DeveloperLabTabId | ""
    traceId?: string
  },
) {
  const url = new URL(currentHref)
  if (isReviewerPath(url.pathname)) {
    url.pathname = "/"
  }
  url.searchParams.delete("participant")
  url.searchParams.delete("batch_id")
  url.searchParams.delete("token")
  url.searchParams.set("role", "developer")
  if (tab !== undefined) {
    if (tab) {
      url.searchParams.set("developer_tab", tab)
    } else {
      url.searchParams.delete("developer_tab")
    }
  }
  if (filter !== undefined) {
    url.searchParams.set("developer_filter", filter)
  }
  if (batchId !== undefined) {
    if (!batchId) {
      url.searchParams.delete("developer_batch_id")
    } else {
      url.searchParams.set("developer_batch_id", batchId)
    }
  }
  if (traceId !== undefined) {
    if (!traceId) {
      url.searchParams.delete("developer_trace_id")
    } else {
      url.searchParams.set("developer_trace_id", traceId)
    }
  }
  return `${url.pathname}${url.search}${url.hash}`
}

export function replaceDeveloperUrlState(state: Parameters<typeof buildDeveloperStateUrl>[1]) {
  const nextUrl = buildDeveloperStateUrl(window.location.href, state)
  window.history.replaceState({}, "", nextUrl)
}
