import type { Language } from "@/types"
import type { DashboardTone } from "@/lib/dashboardTones"
import type { ResearchMetricCard } from "./researchDashboardModel"

const text: Record<string, string> = {
  "How well does the AI judge agree with humans?":
    "Wie gut stimmt der KI-Judge mit den Menschen überein?",
  "Recommended next step": "Empfohlener nächster Schritt",
  "Collect human reviews to unlock agreement analysis.":
    "Sammeln Sie menschliche Bewertungen, um die Übereinstimmungsanalyse zu ermöglichen.",
  "Inspect AI-too-positive cases: the judge accepted answers humans did not.":
    "Prüfen Sie die Fälle, in denen die KI zu positiv war: Der Judge akzeptierte Antworten, die Menschen ablehnten.",
  "Adjudicate split human decisions before trusting the match rate.":
    "Klären Sie geteilte menschliche Entscheidungen, bevor Sie der Übereinstimmungsrate vertrauen.",
  "Agreement is stable. Export the tables for the research report.":
    "Die Übereinstimmung ist stabil. Exportieren Sie die Tabellen für den Forschungsbericht.",
  "Details on demand": "Details bei Bedarf",
  "More detail — click a row to expand": "Mehr Details — zum Aufklappen anklicken",
  "Evaluation run": "Auswertungslauf",
  "View disagreement cases in the Results table":
    "Abweichungsfälle in der Ergebnistabelle ansehen",
  "comparable cases": "vergleichbare Fälle",
  "0 reviews": "0 Reviews",
  "1 review": "1 Review",
  "2+ reviews": "2+ Reviews",
  "all decisions": "Alle Entscheidungen",
  "all sections": "Alle Bereiche",
  "all severity": "Alle Schweregrade",
  "all source signals": "Alle Quellensignale",
  "all styles": "Alle Stile",
  "all types": "Alle Typen",
  "AI decision": "AI-Entscheidung",
  "AI accepts while humans reject or request edits":
    "AI akzeptiert, obwohl Menschen ablehnen oder Änderungen verlangen",
  "AI too positive": "AI zu positiv",
  "AI too strict": "AI zu streng",
  "AI-human agreement": "KI-Mensch-Übereinstimmung",
  "AI-human decision mismatch": "AI-Human-Entscheidungsabweichung",
  "Human-human disagreement": "Human-Human-Abweichung",
  "Source mismatch": "Quellenabweichung",
  "Review attention": "Prüfhinweis",
  "Clarification handling": "Klärungsbedarf",
  "AI avg": "AI Ø",
  "AI judge averages are compared with collected human criterion ratings on the six canonical dimensions.":
    "AI-Durchschnitte werden mit Human-Bewertungen auf den sechs Kriterien verglichen.",
  "Answerability": "Beantwortbarkeit",
  "AI": "AI",
  "No saved runs yet": "Noch keine gespeicherten Läufe",
  "Highlighted cells are false accepts: the AI judge accepted answers that humans would revise or reject.":
    "Hervorgehobene Zellen sind falsche Akzeptanzen: Der AI-Judge akzeptiert Antworten, die Menschen überarbeiten oder ablehnen würden.",
  "Completed": "Abgeschlossen",
  "Created": "Erstellt",
  "Comparable cases": "Vergleichbare Fälle",
  "Cases with interpretable human majority": "Fälle mit interpretierbarer Human-Mehrheit",
  "Criterion": "Kriterium",
  "Criterion-level comparison": "Kriterienvergleich",
  "Decision distribution": "Entscheidungsverteilung",
  "Disagreement cases": "Konfliktfälle",
  "Download case export CSV": "Case-Export-CSV herunterladen",
  "Download review export CSV": "Review-Export-CSV herunterladen",
  "Failure mode distribution": "Fehlermuster-Verteilung",
  "Qualitative reviewer notes": "Qualitative Reviewer-Notizen",
  "Free-text reviewer comments and corrections that can support the discussion chapter.":
    "Freitext-Kommentare und Korrekturen der Reviewer, die das Discussion-Kapitel unterstützen können.",
  "No reviewer notes collected for this run yet.":
    "Für diesen Lauf wurden noch keine Reviewer-Notizen erfasst.",
  "Reviewer comment": "Reviewer-Kommentar",
  "Suggested correction": "Korrekturvorschlag",
  "showing": "angezeigt",
  "Distribution of recurring answer, retrieval, and judge-process risks visible in this run.":
    "Wiederkehrende Antwort-, Retrieval- und Judge-Risiken in diesem Lauf.",
  "Failure mode signals can overlap across the same case.":
    "Fehlersignale können sich pro Fall überschneiden.",
  "Final decision table": "Endentscheidungstabelle",
  "Final-decision match": "Endentscheidungsabgleich",
  "Human avg": "Human Ø",
  "Human decision": "Human-Entscheidung",
  "Issue": "Signal",
  "Mismatch": "Abweichung",
  "No failure modes recorded for this run.": "Keine Fehlermuster in diesem Lauf erfasst.",
  "No disagreement cases are available in Results for this run yet.":
    "Für diesen Lauf sind noch keine Konfliktfälle in den Ergebnissen verfügbar.",
  "No saved evaluation runs yet. Create a test or demo run in Developer Lab first.":
    "Noch keine gespeicherten Evaluationsläufe. Erstellen Sie zuerst einen Test- oder Demo-Lauf im Developer Lab.",
  "No score data": "Keine Score-Daten",
  "Question source": "Fragequelle",
  "Question style": "Fragestil",
  "Recorded failure signals": "Erfasste Fehlersignale",
  "Research interpretation summary": "Forschungsinterpretation",
  "This run is not strong enough for conclusions yet.":
    "Dieser Lauf ist noch nicht stark genug für belastbare Schlussfolgerungen.",
  "In this run, the AI judge mostly aligned with human reviewers.":
    "In diesem Lauf stimmt der AI-Judge überwiegend mit den menschlichen Reviews überein.",
  "In this run, the AI judge partly aligned with human reviewers.":
    "In diesem Lauf stimmt der AI-Judge teilweise mit den menschlichen Reviews überein.",
  "In this run, the AI judge poorly aligned with human reviewers.":
    "In diesem Lauf stimmt der AI-Judge nur schwach mit den menschlichen Reviews überein.",
  "Rows show the AI judge decision. Columns show the human reviewer majority decision.":
    "Zeilen zeigen die AI-Judge-Entscheidung, Spalten die Human-Mehrheit.",
  "Split human decisions without a majority are counted above and excluded here.":
    "Geteilte Human-Entscheidungen ohne Mehrheit werden oben gezählt und hier ausgeschlossen.",
  "Split cases stay separate instead of being counted as fractional votes.":
    "Split-Fälle bleiben separat und werden nicht als Bruchteile gezählt.",
  "Split human final decisions; excluded from majority matrix when tied":
    "Geteilte Human-Entscheidungen; bei Gleichstand aus der Matrix ausgeschlossen",
  "Sample composition": "Sample-Zusammensetzung",
  "Breakdown by Question source, Answerability, Question style, Target section, and Intent type.":
    "Verteilung nach Fragequelle, Beantwortbarkeit, Fragestil, Zielabschnitt und Intent-Typ.",
  "sample size": "Stichprobe",
  "reviewed cases": "geprüfte Fälle",
  "source checked": "Quellen geprüft",
  "source concerns": "Quellenprobleme",
  "source checks missing": "Quellenchecks fehlen",
  "Score evidence": "Score-Evidenz",
  "Search question, service, trace...": "Frage, Service oder Trace suchen...",
  "Target section": "Zielabschnitt",
  "Intent type": "Intent-Typ",
  "View": "Ansicht",
  "controlled": "kontrolliert",
  "llm_authored": "LLM-generiert",
  "mixed": "gemischt",
  "requires clarification": "Klärung nötig",
  "no clarification needed": "keine Klärung nötig",
  "single_intent": "ein Intent",
  "multi_intent": "mehrere Intents",
  "ambiguous_multi_intent": "mehrdeutig / mehrere Intents",
  "factual correctness": "faktische Korrektheit",
  "source support": "Quellenbezug",
  "completeness": "Vollständigkeit",
  "clarity/actionability": "Klarheit/Handlungsfähigkeit",
  "public-service tone": "Verwaltungston",
  "uncertainty handling": "Umgang mit Unsicherheit",
  "supported": "belegt",
  "partly supported": "teilweise belegt",
  "partly_supported": "teilweise belegt",
  "unsupported": "nicht belegt",
  "not_checked": "nicht geprüft",
  "thin data": "dünne Datenlage",
  "missing reviews": "fehlende Reviews",
  "few 2+ reviews": "wenige Doppelreviews",
  "pending": "offen",
  "match": "Übereinstimmung",
  "mismatch": "Abweichung",
  "human disagreement": "Human-Human-Abweichung",
  "human_disagreement": "Human-Human-Abweichung",
  "high": "hoch",
  "medium": "mittel",
  "low": "niedrig",
  "Batch failed": "Batch fehlgeschlagen",
  "Run completed with errors": "Lauf mit Fehlern abgeschlossen",
  "No evaluation cases were created.": "Es wurden keine Evaluationsfälle erzeugt.",
  "No analysis tables can be built until the run creates evaluation cases.":
    "Analysetabellen können erst erstellt werden, wenn der Lauf Evaluationsfälle erzeugt.",
  "split human decision": "geteilte Human-Entscheidung",
  "split human decisions": "geteilte Human-Entscheidungen",
  "excluded from this majority table.": "aus dieser Mehrheitstabelle ausgeschlossen.",
  "Human problem signals": "Human-Problemsignale",
  "problem reported": "gemeldetes Problem",
  "problems reported": "gemeldete Probleme",
  across: "in",
  reviews: "Reviews",
  "Reviewers can flag optional problems; an unselected item means only that no problem was reported, not that the criterion was approved.":
    "Reviewer können optionale Probleme markieren; eine nicht ausgewählte Option bedeutet nur, dass kein Problem gemeldet wurde, nicht dass das Kriterium bestätigt wurde.",
  "Show all": "Alle anzeigen",
  "Show fewer": "Weniger anzeigen",
  "Show more": "Mehr anzeigen",
  "Show less": "Weniger anzeigen",
  "Open case": "Fall öffnen",
  "Cohen's kappa (final decision)": "Cohens Kappa (Endentscheidung)",
  agreement: "Übereinstimmung",
  "Low kappa reflects class imbalance (most cases accepted), not poor agreement.":
    "Niedriges Kappa spiegelt die Klassen-Schieflage wider (die meisten Fälle akzeptiert), nicht schlechte Übereinstimmung.",
  "Source concerns flagged": "Gemeldete Quellenprobleme",
  "Reviewers flag a source problem only when they see one, so 0 is the expected default, not a skipped check.":
    "Reviewer melden ein Quellenproblem nur, wenn sie eines sehen — 0 ist also der erwartete Normalfall, keine ausgelassene Prüfung.",
  "Reviews where a reviewer could not confirm the answer from the shown source.":
    "Reviews, in denen ein Reviewer die Antwort nicht aus der gezeigten Quelle bestätigen konnte.",
  "Reviewer strictness": "Strenge der Reviewer",
  "Share of accept vs needs-edit / reject decisions per reviewer.":
    "Anteil von akzeptiert vs. ändern / ablehnen pro Reviewer.",
  "No reviewer decisions recorded for this run yet.":
    "Für diesen Lauf wurden noch keine Reviewer-Entscheidungen erfasst.",
  "Agreement by question style": "Übereinstimmung nach Fragestil",
  "AI-human final-decision match rate grouped by question style.":
    "KI-Mensch-Abgleichsrate der Endentscheidung nach Fragestil.",
  "no comparable cases": "keine vergleichbaren Fälle",
  "No question-style groups available for this run yet.":
    "Für diesen Lauf sind noch keine Fragestil-Gruppen verfügbar.",
  "Repeat-run judge consistency": "Judge-Konsistenz über Wiederholungsläufe",
  "When the same dataset is judged several times, cases where the AI judge disagrees with itself across repeat runs are a disagreement signal — like an AI-human mismatch — and are routed to human review.":
    "Wenn derselbe Datensatz mehrfach bewertet wird, sind Fälle, in denen der KI-Judge sich über Wiederholungsläufe hinweg selbst widerspricht, ein Konfliktsignal — wie eine KI-Mensch-Abweichung — und werden an das Human Review weitergeleitet.",
  "Repeat runs": "Wiederholungsläufe",
  "Stable across all runs": "Stabil über alle Läufe",
  "Ties": "Unentschieden",
  "Majority vs human agreement": "Mehrheit vs. Mensch Übereinstimmung",
  "case(s) routed to human review because the judge was not stable.":
    "Fall/Fälle an das Human Review weitergeleitet, weil der Judge nicht stabil war.",
  "Case": "Fall",
  "Majority": "Mehrheit",
  "Human": "Mensch",
  "Stability": "Stabilität",
  "tie": "unentschieden",
  "stable": "stabil",
  "unstable": "instabil",
  "→ human review": "→ Human Review",
  "Why runs disagree": "Warum die Läufe abweichen",
  "Completeness": "Vollständigkeit",
  "Factual correctness": "Sachliche Richtigkeit",
  "Source support": "Quellenbelege",
  "Clarity and actionability": "Klarheit und Umsetzbarkeit",
  "Public-service tone": "Behördlicher Ton",
  "Uncertainty handling": "Umgang mit Unsicherheit",
  "Improvement Ideas": "Verbesserungsideen",
  "Rule-based suggestions derived from judge results and human reviews of this run — evidence, not automation.":
    "Regelbasierte Vorschläge aus den Judge-Ergebnissen und menschlichen Reviews dieses Laufs — Evidenz, keine Automatik.",
  "Fix factual correctness": "Sachliche Richtigkeit korrigieren",
  "Tighten source support": "Quellenbelege stärken",
  "Close completeness gaps": "Vollständigkeitslücken schließen",
  "Improve clarity and actionability": "Klarheit und Umsetzbarkeit verbessern",
  "Adjust tone": "Ton und Stil anpassen",
  "Handle uncertainty more explicitly": "Unsicherheit expliziter behandeln",
  "Original reviewer comments": "Originalkommentare der Reviewer",
  "Correct factual claims that contradict the source; prefer 'not stated in the document' over guessing.":
    "Sachliche Aussagen korrigieren, die der Quelle widersprechen; lieber 'im Dokument nicht angegeben' als raten.",
  "Only make claims that appear in the source document and cite where they come from.":
    "Nur Aussagen machen, die im Quelldokument stehen, und angeben, woher sie stammen.",
  "Add the required steps, documents, costs, or deadlines the reviewers found missing.":
    "Fehlende Schritte, Unterlagen, Kosten oder Fristen ergänzen, die den Reviewern gefehlt haben.",
  "Shorten answers and state the concrete next step first; long correct answers still fail reviewers.":
    "Antworten kürzen und den konkreten nächsten Schritt zuerst nennen; auch korrekte Antworten fallen durch, wenn sie zu lang sind.",
  "Adjust tone and style conventions (greetings, emojis, promotional endings) to the audience's expectations.":
    "Ton- und Stilkonventionen (Begrüßungen, Emojis, werbliche Schlusszeilen) an die Erwartungen des Publikums anpassen.",
  "State uncertainty explicitly instead of inventing precise numbers or deadlines.":
    "Unsicherheit ausdrücklich benennen, statt präzise Zahlen oder Fristen zu erfinden.",
  "Verbatim comments from needs-edit and reject reviews; they may point to issues the scored criteria do not capture.":
    "Wörtliche Kommentare aus Needs-edit- und Reject-Reviews; sie können auf Probleme hinweisen, die die bewerteten Kriterien nicht erfassen.",
  "high priority": "hohe Priorität",
  "medium priority": "mittlere Priorität",
  watch: "beobachten",
  "cases problematic": "Fällen problematisch",
  borderline: "grenzwertig",
  "AI judge": "KI-Judge",
  "Human review": "Menschliches Review",
  "AI judge + human review": "KI-Judge + menschliches Review",
  cases: "Fälle",
  "human review signals": "menschliche Review-Signale",
  Run: "Lauf",
  "Loading suggestions…": "Vorschläge werden geladen…",
  "Could not load improvement suggestions.": "Verbesserungsvorschläge konnten nicht geladen werden.",
  "No improvement signals yet — run the judge or collect reviews first.":
    "Noch keine Verbesserungssignale — zuerst den Judge laufen lassen oder Reviews sammeln.",
  "AI-generated improvement suggestions": "KI-generierte Verbesserungsvorschläge",
  "Generate suggestions": "Vorschläge generieren",
  Regenerate: "Neu generieren",
  "Generating…": "Wird generiert…",
  generated: "generiert",
  "Rule-based signals": "Regelbasierte Signale",
  "One LLM call summarizes this run's reviewer comments and judge findings into suggestions with case evidence.":
    "Ein LLM-Aufruf fasst Reviewer-Kommentare und Judge-Befunde dieses Laufs zu Vorschlägen mit Fall-Belegen zusammen.",
}

export function tr(language: Language, value: string) {
  return language === "de" ? text[value] || value : value
}

export function displayValue(language: Language, value: string) {
  const normalized = value.replaceAll("_", " ")
  return tr(language, value) === value ? normalized : tr(language, value)
}

export function compactWarningLabel(warning: string) {
  if (warning.includes("too thin")) return "thin data"
  if (warning.includes("no human review")) return "missing reviews"
  if (warning.includes("2+ human reviews")) return "few 2+ reviews"
  if (warning.includes("Source support")) return "source checks missing"
  return warning
}

export function dashboardTone(tone: ResearchMetricCard["tone"]): DashboardTone {
  if (tone === "danger") return "risk"
  if (tone === "warning") return "judge"
  if (tone === "ready") return "ready"
  return "neutral"
}

export function criterionLabel(value: string) {
  if (value === "factual_correctness") return "factual correctness"
  if (value === "source_support") return "source support"
  if (value === "completeness") return "completeness"
  if (value === "clarity_actionability") return "clarity/actionability"
  if (value === "public_service_tone") return "public-service tone"
  if (value === "uncertainty_handling") return "uncertainty handling"
  return value
}

export function formatAverage(value: number | null) {
  return value === null ? "-" : value.toFixed(1)
}
