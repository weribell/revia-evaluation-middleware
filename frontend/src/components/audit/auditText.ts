import type { DeveloperRun, Language } from "@/types"
import { runOptionLabel } from "@/components/shared/runOptionLabel"
import { decisionLabel, normalizeDecision } from "@/lib/decisionDisplay"
import type { AuditFilter } from "./auditDashboardModel"

const text: Record<string, string> = {
  "excluded": "ausgeschlossen",
  "Automated judge decision and explanation": "Automatisierte Judge-Entscheidung und Erklärung",
  "Automated result": "Automatisiertes Ergebnis",
  "Complete automated judge decision": "Vollständige automatisierte Judge-Entscheidung",
  "AI-human mismatch": "KI-Mensch-Abweichung",
  "All": "Alle",
  "Answer and judge versions known": "Antwort- und Judge-Versionen bekannt",
  "Answer model": "Antwortmodell",
  "Answer prompt": "Antwort-Prompt",
  "Answer prompt version": "Antwort-Prompt-Version",
  "Answer text is available": "Antworttext ist verfügbar",
  "Audit identifiers": "Audit-Kennungen",
  "At least one reviewer decision": "Mindestens eine Prüferentscheidung",
  "Audit triage table": "Audit-Triage-Tabelle",
  "Audit status": "Audit-Status",
  "Final decision and supporting evidence recorded":
    "Endentscheidung und begründende Evidenz erfasst",
  "Batch ID": "Batch-ID",
  "Batch failed": "Batch fehlgeschlagen",
  "Can every decision be reconstructed?": "Kann jede Entscheidung rekonstruiert werden?",
  "Calibration context": "Kalibrierungskontext",
  "Cases requiring adjudication": "Fälle mit Klärungsbedarf",
  "Cases waiting for human review": "Fälle warten auf Human Review",
  "Citizen question": "Bürgerfrage",
  "Claims": "Aussagen",
  "Complete": "Vollständig",
  "Completed": "Abgeschlossen",
  "Created": "Erstellt",
  "Could not load audit dashboard": "Audit-Dashboard konnte nicht geladen werden",
  "Decision changed": "Entscheidung geändert",
  "Automated evaluation trace complete - human review pending":
    "Automatisierte Bewertung vollständig dokumentiert - Human Review offen",
  "The automated evaluation trace is complete; full decision evidence still needs human review.":
    "Die automatisierte Bewertung ist vollständig dokumentiert; für die vollständige Entscheidungs-Evidenz fehlt noch das Human Review.",
  "Automated evaluation trace completeness": "Vollständigkeit der automatisierten Bewertung",
  "Decisions": "Entscheidungen",
  "decisions can be fully reconstructed": "Entscheidungen sind vollständig rekonstruierbar",
  "full decisions have complete audit evidence": "Entscheidungen haben vollständige Audit-Evidenz",
  "Download filtered CSV": "Gefilterte CSV herunterladen",
  "Download full JSON": "Vollständiges JSON herunterladen",
  "Download run CSV": "Run-CSV herunterladen",
  "Evidence completeness checklist": "Checkliste zur Evidenz-Vollständigkeit",
  "Evidence gaps": "Evidenzlücken",
  "Evidence gaps & export": "Evidenzlücken & Export",
  "Every decision has complete evidence for reconstruction.":
    "Jede Entscheidung hat vollständige Evidenz zur Rekonstruktion.",
  "Full decision evidence": "Vollständige Entscheidungs-Evidenz",
  "Export this case (CSV)": "Diesen Fall exportieren (CSV)",
  "Export this case (JSON)": "Diesen Fall exportieren (JSON)",
  "Initial AI judge": "Erster KI-Judge",
  "Initial judge": "Erster Judge",
  "Latest AI judge": "Letzter KI-Judge",
  "Latest human review": "Letzter Human Review",
  "Latest judge": "Letzter Judge",
  "Latest rerun ID": "Letzte Rerun-ID",
  "Generated answer": "Generierte Antwort",
  "Human decision": "Menschliche Entscheidung",
  "Human review": "Human Review",
  "Human reviewer decisions": "Entscheidungen der Reviewer:innen",
  "Human-human mismatch": "Mensch-Mensch-Abweichung",
  "Human-human mismatch: reviewer decisions or source-support checks disagree.":
    "Mensch-Mensch-Abweichung: Reviewer-Entscheidungen oder Quellenprüfungen widersprechen sich.",
  "Identifiers & versions": "Kennungen & Versionen",
  "Judge model": "Judge-Modell",
  "Judge history": "Judge-Historie",
  "Judge history & calibration": "Judge-Historie & Kalibrierung",
  "Judge prompt": "Judge-Prompt",
  "Judge prompt version": "Judge-Prompt-Version",
  "Judge schema": "Judge-Schema",
  "Judge schema version": "Judge-Schema-Version",
  "Model": "Modell",
  "Missing prompt/model metadata": "Fehlende Prompt-/Modell-Metadaten",
  "Missing source URL": "Fehlende Quellen-URL",
  "Missing source reference": "Fehlender Quellennachweis",
  "Document": "Dokument",
  "Missing evidence": "Fehlende Evidenz",
  "No cases match this audit filter.": "Keine Fälle passen zu diesem Audit-Filter.",
  "No entries recorded.": "Keine Einträge erfasst.",
  "missing": "fehlt",
  "No human review": "Keine Human Review",
  "No human review recorded.": "Kein Human Review erfasst.",
  "No saved evaluation runs yet. Create a test or demo run in Developer Lab first.":
    "Noch keine gespeicherten Evaluationsläufe. Erstellen Sie zuerst einen Test- oder Demo-Lauf im Developer Lab.",
  "No evaluation cases were created.": "Es wurden keine Evaluationsfälle erzeugt.",
  "No source check": "Keine Quellenprüfung",
  "Number of cases": "Anzahl der Fälle",
  "Official source can be opened": "Offizielle Quelle kann geöffnet werden",
  "Official source URL": "Offizielle Quellen-URL",
  "Open": "Öffnen",
  "ok": "ok",
  "Pending human review": "Offene Human Reviews",
  "present": "vorhanden",
  "Prompt/model metadata": "Prompt-/Modell-Metadaten",
  "Prompt/model versions": "Prompt-/Modell-Versionen",
  "Reviewer plan status": "Status des Reviewer-Plans",
  "Refresh": "Aktualisieren",
  "Retrieved excerpt": "Gefundener Quellenauszug",
  "Retrieved evidence excerpt exists": "Gefundener Quellenauszug vorhanden",
  "Reviewer conflict resolution": "Konfliktauflösung der Reviews",
  "Run metadata": "Run-Metadaten",
  "Run metadata & full completeness": "Run-Metadaten & vollständige Abdeckung",
  "Run completed with errors": "Lauf mit Fehlern abgeschlossen",
  "Run type": "Run-Typ",
  "Select a trace to reconstruct the source, generated answer, automated judgment, human oversight, versions, and evidence gaps.":
    "Wählen Sie einen Trace aus, um Quelle, generierte Antwort, automatisiertes Urteil, Human Oversight, Versionen und Evidenzlücken zu rekonstruieren.",
  "Selected run": "Ausgewählter Run",
  "Service": "Service",
  "Source & answer": "Quelle & Antwort",
  "Source check": "Quellenprüfung",
  "Source ok?": "Quelle ok?",
  "Source document": "Quelldokument",
  "Source reference": "Quellennachweis",
  "Source support": "Quellenbezug",
  "Source URL": "Quellen-URL",
  "URL": "URL",
  "URL or identified document": "URL oder eindeutig benanntes Dokument",
  "Status": "Status",
  "still missing evidence for full reconstruction":
    "ohne vollständige Evidenz zur Rekonstruktion",
  "Technical trace evidence is missing.": "Technische Trace-Evidenz fehlt.",
  "Timestamps": "Zeitstempel",
  "Trace ID": "Trace-ID",
  "Trace created": "Trace erstellt",
  "Question ID": "Frage-ID",
  "Service ID": "Service-ID",
  "Unsupported/contradicted claims": "Unbelegte/widersprochene Aussagen",
  "Unsupported claims": "Unbelegte Aussagen",
  "available": "verfügbar",
  "case": "Fall",
  "cases": "Fälle",
  "complete": "vollständig",
  "complete evidence": "Vollständige Evidenz",
  "configured": "konfiguriert",
  "decision changed": "Entscheidung geändert",
  "evaluation": "Evaluation",
  "evaluations": "Evaluationen",
  "Evaluated": "Ausgewertet",
  "missing evidence": "Fehlende Evidenz",
  "no": "Nein",
  "no rerun": "Kein Rerun",
  "not configured": "nicht konfiguriert",
  "not performed": "nicht durchgeführt",
  "partly_supported": "teilweise belegt",
  "pending": "offen",
  "pending review": "Review offen",
  "recorded": "erfasst",
  "rerun": "Rerun",
  "review conflict": "Review-Konflikt",
  "risk flagged": "Risiko markiert",
  "source check not performed": "Quellenprüfung nicht durchgeführt",
  "supported": "belegt",
  "unsupported": "nicht belegt",
  "yes": "Ja",
}

const filterLabels: Record<AuditFilter, string> = {
  ai_human_mismatch: "AI-human mismatch",
  all: "All",
  human_human_mismatch: "Human-human mismatch",
  missing_metadata: "Missing prompt/model metadata",
  missing_source_reference: "Missing source reference",
  needs_edit: "Needs edit",
  no_human_review: "No human review",
  no_source_check: "No source check",
  rejected: "Rejected",
  unsupported_claims: "Unsupported claims",
}

export function tr(language: Language, value: string) {
  return language === "de" ? text[value] || value : value
}

// "needs_edit"/"rejected" filters mirror the two canonical review decisions,
// so their button/option text comes from decisionLabel() too.
export function filterOptionLabel(language: Language, filter: AuditFilter) {
  if (filter === "needs_edit") return decisionLabel(language, "needs_edit")
  if (filter === "rejected") return decisionLabel(language, "reject")
  return tr(language, filterLabels[filter])
}

export function displayValue(language: Language, value: string) {
  if (!value || value === "-") return value || "-"
  const normalized = value.replaceAll("_", " ")
  return language === "de" ? text[value] || text[normalized] || normalized : normalized
}

// Routes accept/needs_edit/reject through the shared decisionLabel() vocabulary
// so the audit trail always shows the same canonical words as every other
// dashboard; anything else (pending, source-support labels, ...) still goes
// through the local `text` dict via displayValue().
export function decisionDisplayValue(language: Language, value: string) {
  return normalizeDecision(value) ? decisionLabel(language, value) : displayValue(language, value)
}

// humanDecision can hold multiple "; "-joined decisions when reviewers disagree.
export function decisionListDisplayValue(language: Language, value: string) {
  if (!value) return displayValue(language, value)
  return value.split("; ").map((part) => decisionDisplayValue(language, part)).join("; ")
}

export function batchOptionLabel(batch: DeveloperRun, language: Language) {
  return runOptionLabel(batch, language, tr)
}
