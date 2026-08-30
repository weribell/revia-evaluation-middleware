import type { Language } from "@/types"
import { Badge } from "@/components/ui/badge"
import { dashboardToneClass } from "@/lib/dashboardTones"
import { cn } from "@/lib/utils"
import type { AuditTraceabilityRow } from "./auditDashboardModel"
import { displayValue, tr } from "./auditText"

export function StatusBadge({
  language,
  status,
}: {
  language: Language
  status: AuditTraceabilityRow["finalAuditStatus"]
}) {
  const tone =
    status === "missing_evidence"
      ? dashboardToneClass.risk
      : status === "pending_review"
        ? dashboardToneClass.warning
      : status === "review_conflict"
        ? dashboardToneClass.human
      : status === "risk_flagged"
        ? dashboardToneClass.judge
        : dashboardToneClass.ready
  const label =
    status === "missing_evidence"
      ? "missing evidence"
      : status === "pending_review"
        ? "pending review"
      : status === "review_conflict"
        ? "review conflict"
      : status === "risk_flagged"
        ? "risk flagged"
        : "complete evidence"
  return (
    <Badge variant="outline" className={cn("border", tone)}>
      {displayValue(language, label)}
    </Badge>
  )
}

export function JudgeHistoryBadge({
  language,
  status,
}: {
  language: Language
  status: AuditTraceabilityRow["judgeHistoryStatus"]
}) {
  const tone =
    status === "decision changed"
      ? dashboardToneClass.judge
      : status === "rerun"
        ? dashboardToneClass.source
        : dashboardToneClass.neutral
  return (
    <Badge variant="outline" className={cn("border", tone)}>
      {displayValue(language, status)}
    </Badge>
  )
}

export function EvidenceGapBadges({
  language,
  row,
}: {
  language: Language
  row: Pick<AuditTraceabilityRow, "evidenceGapLabels" | "finalAuditStatus" | "missingEvidenceStatus">
}) {
  const labels = row.evidenceGapLabels.length
    ? row.evidenceGapLabels
    : row.missingEvidenceStatus === "source check not performed"
      ? ["No source check"]
      : ["Complete"]
  const complete = labels.length === 1 && labels[0] === "Complete"
  const tone = complete
    ? dashboardToneClass.ready
    : row.finalAuditStatus === "pending_review" || row.missingEvidenceStatus === "source check not performed"
      ? dashboardToneClass.warning
      : dashboardToneClass.risk
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((label) => (
        <Badge
          key={label}
          variant="outline"
          className={cn(
            "max-w-full border text-[0.7rem]",
            tone,
          )}
        >
          <span className="truncate">{tr(language, label)}</span>
        </Badge>
      ))}
    </div>
  )
}
