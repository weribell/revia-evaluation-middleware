import { type ReactNode } from "react"
import { ClipboardCheck } from "lucide-react"

import type { EvaluationTrace, Language, RetrievalResult } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { LinkedText } from "@/components/shared/LinkedText"
import { SourceExcerptText } from "@/components/shared/SourceExcerptText"
import { CompactRunInfoPanel } from "./DeveloperCaseWorkspace"
import {
  developerSectionLabel as sectionLabel,
  developerTr as tr,
  formatNumber,
} from "./developerTraceModel"

export function DeveloperDetails({
  language,
  trace,
}: {
  language: Language
  trace: EvaluationTrace
}) {
  return (
    <DeveloperPanel icon={<ClipboardCheck className="size-4" />} title={tr(language, "Developer details")}>
      <div className="grid gap-2">
        <DetailSection title={tr(language, "Run information")}>
          <CompactRunInfoPanel language={language} trace={trace} />
        </DetailSection>
        <DetailSection title={tr(language, "Raw trace")}>
          <RawTracePanel trace={trace} />
        </DetailSection>
      </div>
    </DeveloperPanel>
  )
}

export function DetailSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="cursor-pointer px-4 py-3 text-section-title text-foreground">
        {title}
      </summary>
      <div className="border-t border-border p-4">{children}</div>
    </details>
  )
}

function RawTracePanel({ trace }: { trace: EvaluationTrace }) {
  return (
    <pre className="max-h-[34rem] overflow-auto rounded-xl border border-border bg-code-surface p-4 text-xs leading-5 text-code-foreground">
      {JSON.stringify(trace, null, 2)}
    </pre>
  )
}

export function RetrievalChunk({
  language,
  retrieval,
}: {
  language: Language
  retrieval: RetrievalResult
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-soft p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">#{retrieval.rank}</Badge>
        <Badge variant="outline">{sectionLabel(language, retrieval.section_name)}</Badge>
        {typeof retrieval.retrieval_score === "number" ? (
          <Badge variant="outline">score {formatNumber(retrieval.retrieval_score)}</Badge>
        ) : null}
        {retrieval.intent_role ? <Badge variant="outline">{retrieval.intent_role}</Badge> : null}
      </div>
      <SourceExcerptText text={retrieval.chunk_text} />
      <Separator className="my-3" />
      <div className="break-all text-xs text-muted-foreground">{retrieval.source_ref}</div>
    </div>
  )
}

export function DeveloperPanel({
  children,
  compact = false,
  description,
  icon,
  title,
}: {
  children: ReactNode
  compact?: boolean
  description?: string
  icon: ReactNode
  title: string
}) {
  return (
    <Card
      className={`min-w-0 overflow-hidden rounded-2xl border-border bg-card shadow-card ${
        compact ? "gap-2 py-3" : ""
      }`}
    >
      <CardHeader className={compact ? "pb-0" : "pb-3"}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <CardTitle className="flex min-w-0 items-center gap-2 text-lg">
            {icon}
            <span className="min-w-0 break-words">{title}</span>
          </CardTitle>
          {description ? (
            <div className="max-w-[44rem] text-left text-sm font-medium leading-5 text-muted-foreground sm:text-right">
              {description}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function InfoBlock({
  children,
  icon,
  title,
  value,
}: {
  children?: ReactNode
  icon: ReactNode
  title: string
  value?: string
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex min-w-0 items-center gap-2 text-section-title text-foreground">
        {icon}
        <span className="min-w-0 break-words">{title}</span>
      </div>
      {children || (
        <div className="min-w-0 whitespace-pre-wrap break-words text-sm leading-6 text-body">
          <LinkedText text={value || "-"} />
        </div>
      )}
    </div>
  )
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-soft px-3 py-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold leading-5 text-foreground">
        {value || "-"}
      </div>
    </div>
  )
}
