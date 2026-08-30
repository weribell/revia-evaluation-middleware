import { Plug } from "lucide-react"
import { useMemo, useState } from "react"

import { buildIntegrationEndpointDocs } from "./developerLabModel"
import { developerTr as tr } from "./developerTraceModel"
import { Badge } from "@/components/ui/badge"
import { PanelHeader } from "@/components/ui/panel-header"
import { SectionCard } from "@/components/ui/section-card"
import { cn } from "@/lib/utils"
import type { IntegrationStatus, Language } from "@/types"

function authModeLabel(value: string | undefined) {
  if (value === "local") {
    return "Local research mode"
  }
  return value || "Local research mode"
}

export function IntegrationSetupPanel({
  integrationStatus,
  language,
}: {
  integrationStatus: IntegrationStatus | null
  language: Language
}) {
  const publicBaseUrl =
    typeof window === "undefined"
      ? "/api/v1"
      : `${window.location.origin}/api/v1`
  const endpoints = useMemo(() => buildIntegrationEndpointDocs(publicBaseUrl), [publicBaseUrl])
  const [selectedEndpointKey, setSelectedEndpointKey] = useState("POST /evaluations")
  const selectedEndpoint =
    endpoints.find((endpoint) => `${endpoint.method} ${endpoint.path}` === selectedEndpointKey) || endpoints[0]

  return (
    <section className="grid content-start gap-3 pr-1">
      <div className="rounded-xl border border-border bg-surface-soft p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-caps uppercase text-label">
              <Plug className="size-4" />
              {tr(language, "API setup")}
            </div>
            <div className="mt-1.5 text-panel-title text-foreground">
              {tr(language, "Endpoint reference for external QA backends and dashboard read models.")}
            </div>
            <div className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {tr(language, "Choose an endpoint to see the request and response example.")}
            </div>
          </div>
          <Badge variant={integrationStatus ? "secondary" : "outline"} className="rounded-full px-3 py-1">
            {integrationStatus ? tr(language, "API reachable") : tr(language, "API status loading")}
          </Badge>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <IntegrationInfoPill label={tr(language, "Public base URL")} value={publicBaseUrl} />
          <IntegrationInfoPill
            label={tr(language, "Auth mode")}
            value={tr(language, authModeLabel(integrationStatus?.authentication.mode))}
          />
          <IntegrationInfoPill label={tr(language, "Content type")} value="application/json" />
        </div>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <SectionCard>
          <PanelHeader title={tr(language, "Endpoints")} />
          <div className="mt-3 grid gap-1.5">
            {endpoints.map((endpoint) => {
              const key = `${endpoint.method} ${endpoint.path}`
              const isSelected = selectedEndpointKey === key

              return (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "grid gap-1 rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-ring bg-surface-soft"
                      : "border-border bg-card hover:bg-surface-soft",
                  )}
                  onClick={() => setSelectedEndpointKey(key)}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline" className="rounded-md font-mono text-[0.68rem]">
                      {endpoint.method}
                    </Badge>
                    <span className="truncate font-mono text-xs font-semibold text-body">
                      {endpoint.path}
                    </span>
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {tr(language, endpoint.title)}
                  </div>
                </button>
              )
            })}
          </div>
        </SectionCard>

        <SectionCard className="grid content-start gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-md font-mono">
                {selectedEndpoint.method}
              </Badge>
              <div className="min-w-0 truncate font-mono text-sm font-semibold text-foreground">
                {selectedEndpoint.path}
              </div>
            </div>
            <div className="mt-2 text-panel-title text-foreground">
              {tr(language, selectedEndpoint.title)}
            </div>
            <div className="mt-1 text-sm leading-6 text-muted-foreground">
              {tr(language, selectedEndpoint.description)}
            </div>
          </div>
          <CodeExample title={tr(language, "Request")} value={selectedEndpoint.requestExample} />
          <CodeExample title={tr(language, "Response")} value={selectedEndpoint.responseExample} />
          <div className="rounded-lg border border-border bg-surface-soft px-3 py-2.5 text-sm leading-5 text-muted-foreground">
            {integrationStatus?.authentication.note ||
              tr(language, "Local mode has no API access control yet. For a pilot deployment, protect this API with an API key or reverse proxy.")}
          </div>
        </SectionCard>
      </div>
    </section>
  )
}

function IntegrationInfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="min-w-0">
        <div className="text-caps-sm uppercase text-label">{label}</div>
        <div className="mt-0.5 truncate text-sm font-semibold text-foreground" title={value}>
          {value}
        </div>
      </div>
    </div>
  )
}

function CodeExample({ title, value }: { title: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <div className="text-caps uppercase text-label">{title}</div>
      <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-code-surface p-3 text-xs leading-5 text-code-foreground">
        <code>{value}</code>
      </pre>
    </div>
  )
}
