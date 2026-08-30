import type { ReviewDecision } from "@/types"
import { decisionTone } from "@/lib/decisionDisplay"

import type { ManagementDashboardModel } from "./managementDashboardModel"
import { formatCurrency, formatHours } from "./managementFormatters.ts"

export type CockpitTone = "danger" | "ready" | "quiet" | "warning" | "conflict"

/**
 * Decision segments read their label from the central decisionLabel() utility
 * at render time; this only needs to translate the shared DashboardTone value
 * (accept/needs_edit/reject) into this screen's own CockpitTone vocabulary.
 */
function cockpitToneForDecision(decision: ReviewDecision): CockpitTone {
  const tone = decisionTone(decision)
  if (tone === "risk") return "danger"
  if (tone === "warning") return "warning"
  if (tone === "ready") return "ready"
  return "quiet"
}

export type CockpitKpi = {
  detail: string
  id: "accepted_after_review" | "oversight_effort" | "review_progress" | "risk_signals"
  label: string
  tone: CockpitTone
  value: string
}

export type CockpitSegment = {
  count: number
  /** Set for the three canonical review decisions so the renderer can use decisionLabel(); omitted for non-decision segments like "Needs adjudication" or "Not reviewed". */
  decision?: ReviewDecision
  label: string
  tone: CockpitTone
}

export type CockpitRiskBar = {
  count: number
  label: string
  tone: CockpitTone
}

export type CockpitActionItem = {
  count: number
  label: string
  tone: CockpitTone
}

export type ManagementCockpitModel = {
  actionQueue: CockpitActionItem[]
  decisionSegments: CockpitSegment[]
  headline: string
  headlineDetail: string
  kpis: CockpitKpi[]
  nextActionDetail: string
  nextActionLabel: string
  phaseLabel: string
  readinessDetail: string
  readinessLabel: string
  readinessPercent: number
  readinessTone: CockpitTone
  reviewCoverageSegments: CockpitSegment[]
  riskBars: CockpitRiskBar[]
}

function plural(value: number, singular: string, pluralValue = `${singular}s`) {
  return value === 1 ? singular : pluralValue
}

function needsVerb(value: number) {
  return value === 1 ? "needs" : "need"
}

function beVerb(value: number) {
  return value === 1 ? "is" : "are"
}

function caseUnit(value: number) {
  return plural(value, "case")
}

function readinessTone(status: string, hasHumanReview: boolean): CockpitTone {
  if (!hasHumanReview) return "warning"
  if (status === "Ready to continue with oversight") return "ready"
  return "warning"
}

function readinessPercent(model: ManagementDashboardModel) {
  return model.after.hasHumanReview && model.after.readinessStatus === "Ready for monitored pilot" ? 100 : 0
}

function nextActionDetail(model: ManagementDashboardModel) {
  if (model.after.hasHumanReview) {
    if (model.after.readinessStatus === "Ready for monitored pilot") {
      return "Approve the next controlled step with human oversight and monitoring."
    }
    if (model.after.pendingCases > 0) {
      const conflicts = model.after.humanDisagreementCases
      const conflictDetail =
        conflicts > 0
          ? ` Also resolve ${conflicts} review ${plural(conflicts, "conflict")} before service-owner approval.`
          : ""
      return `Continue human review for ${model.after.pendingCases} unreviewed ${plural(model.after.pendingCases, "case")}.${conflictDetail}`
    }
    if (model.after.readinessStatus === "Needs adjudication") {
      return "The service owner should not approve continuation until the review conflict has a final team decision."
    }
    if (model.after.readinessStatus === "Needs follow-up") {
      const answerCorrections = backlogCount(model, "fix_needs_edit_answers")
      const sourceConcerns = backlogCount(model, "check_source_concerns")
      const aiApprovedIssues = backlogCount(model, "inspect_ai_false_accepts")
      if (answerCorrections > 0) {
        if (model.after.resolvedAdjudicationCases > 0) {
          return `The reviewer conflict has a final team decision. This batch should not be approved as clean; ${answerCorrections} needs-edit ${caseUnit(answerCorrections)} can be documented for correction or excluded from a monitored pilot.`
        }
        return `${answerCorrections} ${caseUnit(answerCorrections)} ${beVerb(answerCorrections)} marked needs edit or rejected. Document them as follow-up evidence, then correct, rerun, or exclude them before service owner approval.`
      }
      if (sourceConcerns > 0) {
        return `${sourceConcerns} ${caseUnit(sourceConcerns)} ${needsVerb(sourceConcerns)} source concerns. The evaluation team should clear them before service owner approval.`
      }
      if (aiApprovedIssues > 0) {
        return `${aiApprovedIssues} AI-approved ${caseUnit(aiApprovedIssues)} ${needsVerb(aiApprovedIssues)} human follow-up before service owner approval.`
      }
      return "The service owner should wait until review conflicts, answer corrections, and source concerns are resolved."
    }
    if (model.after.readinessStatus === "Insufficient evidence" && model.after.casesNeedingSecondReview > 0) {
      const reviews = model.after.missingReviewAssignments
      return `Add ${reviews} missing second ${plural(reviews, "review")} before the service owner makes an approval decision.`
    }
    if (model.after.readinessStatus === "Insufficient evidence") {
      return `Review at least ${model.after.minimumReviewedCases} cases before the service owner makes an approval decision.`
    }
    return "The evaluation team should add review evidence before the service owner makes a decision."
  }

  const flagged = model.before.aiFlaggedRiskCases
  const reviews = model.before.customEstimate.assignments
  if (flagged > 0) {
    return `Collect ${reviews} human ${plural(reviews, "review")} before a management decision.`
  }
  return `Collect ${reviews} human ${plural(reviews, "review")} before a management decision.`
}

function buildKpis(model: ManagementDashboardModel): CockpitKpi[] {
  const hasHumanReview = model.after.hasHumanReview
  const estimate = hasHumanReview ? model.after.remainingEstimate : model.before.customEstimate
  const riskSignals = hasHumanReview ? model.after.unresolvedActionCases : model.before.aiFlaggedRiskCases

  return [
    {
      detail: "cases reviewed",
      id: "review_progress",
      label: "Review progress",
      tone: model.after.reviewCoveragePercent === 100 ? "ready" : "warning",
      value: `${model.after.reviewedCases}/${model.after.totalCases}`,
    },
    {
      detail: hasHumanReview ? "unresolved after review" : "AI triage only",
      id: "risk_signals",
      label: "Open risk signals",
      tone: riskSignals ? "warning" : "ready",
      value: String(riskSignals),
    },
    {
      detail: hasHumanReview ? "remaining review work" : "planned review work",
      id: "oversight_effort",
      label: "Oversight effort",
      tone: "quiet",
      value: `${formatHours(estimate.personHours)} / ${formatCurrency(estimate.cost)}`,
    },
    {
      detail: hasHumanReview ? "accepted by human majority" : "human review missing",
      id: "accepted_after_review",
      label: "Accepted after review",
      tone: hasHumanReview ? "ready" : "quiet",
      value: hasHumanReview ? String(model.after.acceptedCases) : "Not reviewed",
    },
  ]
}

function buildActionQueue(model: ManagementDashboardModel): CockpitActionItem[] {
  if (!model.after.hasHumanReview) {
    return [
      {
        count: model.before.customEstimate.assignments,
        label: "Human reviews needed",
        tone: "warning",
      },
      {
        count: model.before.aiFlaggedRiskCases,
        label: "AI-flagged cases",
        tone: model.before.aiFlaggedRiskCases ? "warning" : "ready",
      },
      {
        count: 0,
        label: "Waiting for evidence",
        tone: "quiet",
      },
    ]
  }

  if (model.after.readinessStatus === "Ready for monitored pilot") {
    return [
      {
        count: 0,
        label: "No team action needed",
        tone: "ready",
      },
      {
        count: 0,
        label: "Approve next controlled step",
        tone: "ready",
      },
    ]
  }

  if (model.after.readinessStatus === "Needs adjudication") {
    return [
      {
        count: model.after.humanDisagreementCases,
        label: "Review conflicts",
        tone: "conflict",
      },
    ]
  }

  if (model.after.readinessStatus === "Insufficient evidence" && model.after.casesNeedingSecondReview > 0) {
    return [
      {
        count: model.after.casesNeedingSecondReview,
        label: "Second reviews needed",
        tone: "warning",
      },
    ]
  }

  const followUpItems = model.after.actionBacklog.filter(
    (item) =>
      item.count > 0 &&
      (item.id !== "complete_missing_reviews" || model.after.pendingCases > 0),
  )

  return followUpItems
    .slice(0, 4)
    .map((item) => ({
      count: item.id === "complete_missing_reviews" ? model.after.pendingCases : item.count,
      label:
        item.id === "inspect_ai_false_accepts"
          ? "AI-approved issues"
          : item.id === "fix_needs_edit_answers"
            ? "Answers to correct"
            : item.id === "check_source_concerns"
              ? "Source checks"
              : item.id === "resolve_human_disagreement"
                ? "Review conflicts"
                : "Human reviews needed",
      tone: item.id === "inspect_ai_false_accepts" ? "danger" : "warning",
    }))
}

function backlogCount(model: ManagementDashboardModel, id: ManagementDashboardModel["after"]["actionBacklog"][number]["id"]) {
  return model.after.actionBacklog.find((item) => item.id === id)?.count || 0
}

function buildHeadline(model: ManagementDashboardModel) {
  if (model.after.totalCases === 0) return "No evaluation run selected"
  if (!model.after.hasHumanReview) return "Human review not started"
  if (model.after.readinessStatus === "Ready for monitored pilot") return "Ready to continue with oversight"
  if (model.after.pendingCases > 0) return "Review still in progress"
  if (model.after.readinessStatus === "Needs adjudication") return "Reviewer conflict needs resolution"
  if (model.after.readinessStatus === "Needs follow-up") return "Open batch issues"
  if (model.after.readinessStatus === "Insufficient evidence" && model.after.casesNeedingSecondReview > 0) {
    return "Second review still missing"
  }
  if (model.after.readinessStatus === "Insufficient evidence") return "Review coverage still too low"
  return "More review evidence needed"
}

function buildHeadlineDetail(model: ManagementDashboardModel) {
  const reviewed = `${model.after.reviewedCases}/${model.after.totalCases}`
  if (model.after.totalCases === 0) {
    return "Create a saved evaluation run before planning review effort."
  }
  if (!model.after.hasHumanReview) {
    return `${model.after.totalCases} ${plural(model.after.totalCases, "case")} need a first human review before service-owner approval.`
  }
  if (model.after.readinessStatus === "Ready for monitored pilot") {
    return `${reviewed} cases reviewed; the service owner can approve the next controlled step.`
  }
  if (model.after.pendingCases > 0) {
    const conflicts = model.after.humanDisagreementCases
    const conflictDetail =
      conflicts > 0
        ? ` Reviewers already disagreed on ${conflicts} reviewed ${plural(
            conflicts,
            "case",
          )}, so ${plural(conflicts, "that conflict", "those conflicts")} also ${needsVerb(
            conflicts,
          )} adjudication before service-owner approval.`
        : ""
    return `${reviewed} cases reviewed so far; ${model.after.pendingCases} ${plural(
      model.after.pendingCases,
      "case",
    )} still need human review.${conflictDetail}`
  }
  if (model.after.readinessStatus === "Needs adjudication") {
    return `All cases were reviewed, but reviewers disagreed on ${model.after.humanDisagreementCases} ${plural(
      model.after.humanDisagreementCases,
      "case",
    )}. The service owner should wait for the evaluation team to resolve it.`
  }
  if (model.after.readinessStatus === "Needs follow-up") {
    return `${reviewed} cases reviewed, but ${model.after.unresolvedActionCases} ${plural(
      model.after.unresolvedActionCases,
      "case",
    )} need team follow-up before service owner approval.`
  }
  if (model.after.readinessStatus === "Insufficient evidence" && model.after.casesNeedingSecondReview > 0) {
    const secondReviewCases = model.after.casesNeedingSecondReview
    return `${reviewed} cases have a first review, but ${secondReviewCases} ${plural(
      secondReviewCases,
      "case",
    )} still ${needsVerb(secondReviewCases)} a second independent review before service-owner approval.`
  }
  if (model.after.readinessStatus === "Insufficient evidence") {
    return `${reviewed} cases reviewed. At least ${model.after.minimumReviewedCases} reviewed cases are needed before service-owner approval.`
  }
  return `${reviewed} cases reviewed; the evaluation team should add review evidence before service owner approval.`
}

function managementStatusLabel(model: ManagementDashboardModel) {
  if (!model.after.hasHumanReview) return "Human review not started"
  if (model.after.readinessStatus === "Ready for monitored pilot") return "Ready to continue with oversight"
  if (model.after.pendingCases > 0) return "Review still in progress"
  if (model.after.readinessStatus === "Needs adjudication") return "Review conflict needs resolution"
  if (model.after.readinessStatus === "Needs follow-up") return "Team follow-up needed"
  if (model.after.readinessStatus === "Insufficient evidence" && model.after.casesNeedingSecondReview > 0) {
    return "Second review still missing"
  }
  if (model.after.readinessStatus === "Insufficient evidence") return "Review coverage still too low"
  return "More review evidence needed"
}

function nextActionLabel(model: ManagementDashboardModel) {
  if (!model.after.hasHumanReview) return "Collect first human reviews"
  if (model.after.readinessStatus === "Ready for monitored pilot") return "Approve next controlled step"
  if (model.after.pendingCases > 0) return "Collect remaining reviews"
  if (model.after.readinessStatus === "Needs adjudication") return "Ask evaluation team to resolve review conflict"
  if (model.after.readinessStatus === "Needs follow-up") {
    if (backlogCount(model, "fix_needs_edit_answers") > 0) {
      return "Document answer follow-up evidence"
    }
    if (backlogCount(model, "check_source_concerns") > 0) {
      return "Ask evaluation team to clear source concerns"
    }
    if (backlogCount(model, "inspect_ai_false_accepts") > 0) {
      return "Ask evaluation team to inspect AI-approved issues"
    }
    return "Ask evaluation team to resolve open issues"
  }
  if (model.after.readinessStatus === "Insufficient evidence" && model.after.casesNeedingSecondReview > 0) {
    return "Collect second reviews"
  }
  if (model.after.readinessStatus === "Insufficient evidence") return "Collect more first reviews"
  return "Ask evaluation team for more review evidence"
}

export function buildManagementCockpitModel(
  model: ManagementDashboardModel,
): ManagementCockpitModel {
  const hasHumanReview = model.after.hasHumanReview
  const status = managementStatusLabel(model)
  const tone = readinessTone(status, hasHumanReview)

  return {
    actionQueue: buildActionQueue(model),
    decisionSegments: [
      {
        count: model.after.acceptedCases,
        decision: "accept",
        label: "Accepted",
        tone: cockpitToneForDecision("accept"),
      },
      {
        count: model.after.needsEditCases,
        decision: "needs_edit",
        label: "Needs edit",
        tone: cockpitToneForDecision("needs_edit"),
      },
      {
        count: model.after.rejectedCases,
        decision: "reject",
        label: "Rejected",
        tone: cockpitToneForDecision("reject"),
      },
      { count: model.after.unresolvedDecisionCases, label: "Needs adjudication", tone: "conflict" },
      { count: model.after.pendingCases, label: "Not reviewed", tone: "quiet" },
    ],
    headline: buildHeadline(model),
    headlineDetail: buildHeadlineDetail(model),
    kpis: buildKpis(model),
    nextActionDetail: nextActionDetail(model),
    nextActionLabel: nextActionLabel(model),
    phaseLabel: "Management decision",
    readinessDetail: hasHumanReview
      ? model.after.readinessReason
      : "Human review has not started yet.",
    readinessLabel: status,
    readinessPercent: readinessPercent(model),
    readinessTone: tone,
    reviewCoverageSegments: [
      { count: model.after.reviewedCases, label: "Reviewed", tone: "ready" },
      { count: model.after.pendingCases, label: "Missing", tone: "warning" },
    ],
    riskBars: [
      hasHumanReview
        ? {
            count: backlogCount(model, "inspect_ai_false_accepts"),
            label: "AI-approved issues",
            tone: "danger",
          }
        : {
            count: model.before.aiFlaggedRiskCases,
            label: "AI-flagged",
            tone: "warning",
          },
      {
        count: hasHumanReview
          ? model.after.needsEditCases + model.after.rejectedCases
          : model.before.unsupportedClaimsCases,
        label: hasHumanReview ? "Answers to correct" : "Unsupported claims",
        tone: hasHumanReview ? "warning" : "danger",
      },
      { count: hasHumanReview ? model.after.sourceConcernCases : model.before.thinSourceContextCases, label: "Source checks", tone: "warning" },
      {
        count: hasHumanReview ? model.after.humanDisagreementCases : 0,
        label: "Review conflicts",
        tone: "warning",
      },
    ],
  }
}
