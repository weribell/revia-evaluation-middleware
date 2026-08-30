import type { DeveloperRun, Language } from "@/types"
import { runOptionLabel } from "@/components/shared/runOptionLabel"

const text: Record<string, string> = {
  "Accepted after review": "Nach Review akzeptiert",
  "accepted by human majority": "von menschlicher Mehrheit akzeptiert",
  "Action backlog": "Offene Maßnahmen",
  "Add review coverage or second reviews before making a pilot decision.":
    "Review-Abdeckung oder Zweitreviews ergänzen, bevor eine Pilotentscheidung getroffen wird.",
  "Actionable cases and source concerns need resolution before pilot.":
    "Handlungsrelevante Fälle und Quellenbedenken müssen vor dem Pilotbetrieb geklärt werden.",
  "Actionable cases need resolution before pilot.":
    "Handlungsrelevante Fälle müssen vor dem Pilotbetrieb geklärt werden.",
  "Assign adjudication": "Adjudikation zuweisen",
  "Audit evidence": "Audit-Evidenz",
  "Audit evidence available": "Audit-Evidenz verfügbar",
  "Audit evidence incomplete": "Audit-Evidenz unvollständig",
  "Audit evidence unavailable": "Audit-Evidenz nicht verfügbar",
  "AI triage is a planning signal, not readiness evidence.":
    "KI-Triage ist ein Planungssignal, kein Nachweis der Einsatzreife.",
  "AI triage only — no approval decision until human review exists":
    "Nur KI-Triage — keine Freigabeentscheidung ohne Human Review",
  "Automated signals can help plan review order, but they do not approve this batch.":
    "Automatisierte Signale können die Review-Reihenfolge planen helfen, geben diesen Batch aber nicht frei.",
  "AI judge oversight budget": "KI-Judge-Budget für Aufsicht",
  "AI judge tokens": "KI-Judge-Token",
  "AI-flagged cases for review planning": "KI-markierte Fälle für die Review-Planung",
  "AI triage found cases that should be reviewed early. These signals are planning cues, not evidence of operational readiness; human review is still required.":
    "Die KI-Triage hat Fälle gefunden, die früh geprüft werden sollten. Diese Signale sind Planungshinweise, kein Nachweis operativer Bereitschaft; menschliche Prüfung bleibt erforderlich.",
  "AI triage only": "Nur KI-Triage",
  "AI vs human final decision": "KI vs. menschliche Endentscheidung",
  "AI false accepts": "Falsche KI-Akzeptanzen",
  "AI accepted, but reviewers did not.": "Von der KI akzeptiert, aber von Reviewer:innen nicht.",
  "AI judge reliability": "Zuverlässigkeit des KI-Judge",
  "Agreement rate": "Übereinstimmungsrate",
  "Agreement with the AI judge appears once human reviews exist.":
    "Die Übereinstimmung mit dem KI-Judge erscheint, sobald Human Reviews vorliegen.",
  "Do AI judge decisions match the human majority?":
    "Stimmen die Entscheidungen des KI-Judge mit der menschlichen Mehrheit überein?",
  "AI-approved issues": "Von KI akzeptierte Probleme",
  "AI-approved problem cases": "Von KI akzeptierte Problemfälle",
  "AI-flagged cases": "KI-markierte Fälle",
  "AI-flagged": "KI-markiert",
  "AI-flagged risk": "Von KI markiertes Risiko",
  "AI-human mismatch": "KI-Mensch-Abweichung",
  "AI-prioritized review": "KI-priorisierte Prüfung",
  "All selected cases with 2 reviewers; source concerns must be flagged when found.":
    "Alle ausgewählten Fälle mit 2 Reviewer:innen; Quellenbedenken müssen markiert werden, wenn sie gefunden werden.",
  "Answers need correction": "Antworten brauchen Korrektur",
  "Answers to correct": "Antworten zur Korrektur",
  "Ask evaluation team for more review evidence":
    "Evaluationsteam um weitere Review-Evidenz bitten",
  "Ask evaluation team to collect reviews": "Evaluationsteam um Reviews bitten",
  "Ask evaluation team to clear source concerns":
    "Evaluationsteam um Klärung der Quellenbedenken bitten",
  "Ask evaluation team to complete answer corrections":
    "Evaluationsteam um Antwortkorrekturen bitten",
  "Ask evaluation team to inspect AI-approved issues":
    "Evaluationsteam um Prüfung KI-akzeptierter Probleme bitten",
  "Batch failed": "Batch fehlgeschlagen",
  "Run completed with errors": "Lauf mit Fehlern abgeschlossen",
  "No evaluation cases were created.": "Es wurden keine Evaluationsfälle erzeugt.",
  "Document answer follow-up evidence": "Antwort-Follow-up als Evidenz dokumentieren",
  "Ask evaluation team to resolve open issues":
    "Evaluationsteam um Klärung offener Punkte bitten",
  "Ask evaluation team to resolve review conflict":
    "Evaluationsteam um Klärung des Review-Konflikts bitten",
  "Approve next controlled step": "Nächsten kontrollierten Schritt freigeben",
  "Assignments": "Zuweisungen",
  "At current capacity": "Bei aktueller Kapazität",
  "Available reviewers": "Verfügbare Reviewer:innen",
  "Balanced review": "Ausgewogene Prüfung",
  "Batch problems": "Probleme in diesem Batch",
  "Before approval": "Vor der Freigabe",
  "Blockers": "Blocker",
  "Calendar days": "Kalendertage",
  "case": "Fall",
  "cases": "Fälle",
  "cases with token usage": "Fälle mit Tokenverbrauch",
  "cases reviewed": "Fälle geprüft",
  "Capacity": "Kapazität",
  "Cases": "Fälle",
  "Cases to review first": "Zuerst zu prüfende Fälle",
  "Cases needing second review": "Fälle mit Bedarf an zweitem Review",
  "Check source concerns": "Quellenbedenken prüfen",
  "Complete missing reviews": "Fehlende Reviews abschließen",
  "Collect first human reviews": "Erste Human Reviews sammeln",
  "Collect first human reviews before using decision mix or batch-problem charts.":
    "Sammeln Sie zuerst Human Reviews, bevor Entscheidungsverteilung oder Batch-Problem-Charts genutzt werden.",
  "Collect missing reviews": "Fehlende Reviews sammeln",
  "Collect more first reviews": "Weitere erste Reviews sammeln",
  "Collect remaining reviews": "Verbleibende Reviews sammeln",
  "Collect second reviews": "Zweite Reviews sammeln",
  "Budget": "Budget",
  "Could not load management dashboard": "Management-Dashboard konnte nicht geladen werden",
  "Content team corrects answers": "Content-Team korrigiert Antworten",
  "Current decision": "Aktuelle Entscheidung",
  "Create a saved evaluation run before planning review effort.":
    "Erstellen Sie einen gespeicherten Evaluationslauf, bevor Review-Aufwand geplant wird.",
  "Create an evaluation run before planning human review.":
    "Erstellen Sie zuerst einen Evaluationslauf, bevor Sie die menschliche Prüfung planen.",
  "Create evaluation run": "Evaluationslauf erstellen",
  "Days with current team": "Tage mit aktuellem Team",
  "Counts by issue type": "Zählung nach Problemtyp",
  "Decision outcomes": "Entscheidungsausgänge",
  "Decision mix": "Entscheidungsverteilung",
  "Decision not ready": "Entscheidung noch nicht bereit",
  "Decision and problem charts are hidden until human review evidence exists.":
    "Entscheidungs- und Problemcharts bleiben verborgen, bis Human-Review-Evidenz vorliegt.",
  "Share of answers reviewers would approve without edits.":
    "Wie viele Antworten die Prüfer:innen ohne Änderungen freigeben würden.",
  "Estimated review budget": "Geschätztes Review-Budget",
  "Estimated days": "Geschätzte Tage",
  "Estimated oversight effort": "Geschätzter Aufsichtsaufwand",
  "Evidence": "Evidenz",
  "Fix needs-edit/rejected answers": "Zu überarbeitende/abgelehnte Antworten korrigieren",
  "Evaluation team checks AI-approved problem cases":
    "Evaluationsteam prüft von KI akzeptierte Problemfälle",
  "Evaluation team collects human reviews": "Evaluationsteam sammelt Human Reviews",
  "Evaluation team resolves review conflict": "Evaluationsteam klärt Review-Konflikt",
  "Follow-up queue item": "Eintrag in der Follow-up-Liste",
  "Follow-up queue": "Follow-up-Liste",
  "Fallback planning assumption": "Fallback-Planungsannahme",
  "Human disagreement needs a final adjudication decision before readiness can be assessed.":
    "Menschliche Uneinigkeit braucht eine finale Adjudikationsentscheidung, bevor Readiness bewertet werden kann.",
  "Human review collected": "Menschliche Prüfung gesammelt",
  "Human review budget": "Human-Review-Budget",
  "Human review hours": "Human-Review-Stunden",
  "Human review evidence": "Human-Review-Evidenz",
  "Human review missing": "Menschliche Prüfung fehlt",
  "human review missing": "Human Review fehlt",
  "Human review records are available.": "Menschliche Review-Datensätze sind verfügbar.",
  "High-assurance review": "Prüfung mit hoher Absicherung",
  "Human reviewers disagree": "Menschliche Reviewer:innen widersprechen sich",
  "Human disagreement": "Menschliche Uneinigkeit",
  "Human reviewers disagree on at least one case and need an adjudication decision.":
    "Menschliche Reviewer:innen widersprechen sich in mindestens einem Fall; es braucht eine Adjudikationsentscheidung.",
  "Human review found actionable human review issues that still need follow-up.":
    "Die menschliche Prüfung hat handlungsrelevante Probleme gefunden, die noch Follow-up brauchen.",
  "Human review has not been collected yet": "Menschliche Prüfung wurde noch nicht gesammelt",
  "Human review has not started yet.": "Die menschliche Prüfung hat noch nicht begonnen.",
  "Human review not started": "Human Review noch nicht gestartet",
  "Human reviews needed": "Human Reviews nötig",
  "Include a spot-check of AI-accepted cases.": "Stichprobe KI-akzeptierter Fälle einbeziehen.",
  "Human source concern": "Menschliches Quellenbedenken",
  "Human-human disagreement": "Mensch-Mensch-Abweichung",
  "Hours": "Stunden",
  "Hourly rate EUR": "Stundensatz EUR",
  "How long one working day of review covers, and what the AI judge adds.":
    "Wie viel ein Arbeitstag Review abdeckt und was der KI-Judge zusätzlich kostet.",
  "Inspect AI false accepts": "Falsche KI-Akzeptanzen prüfen",
  "Insufficient evidence": "Unzureichende Evidenz",
  "Judge price per 1k tokens EUR": "Judge-Preis pro 1k Token EUR",
  "Key management signals": "Wichtige Management-Signale",
  "Management decision summary": "Management-Entscheidungsübersicht",
  "Minimum pilot review": "Minimale Pilotprüfung",
  "Minimum reviewed cases": "Mindestens geprüfte Fälle",
  "Minimum review coverage": "Minimale Review-Abdeckung",
  "Monitoring after pilot": "Monitoring nach Pilotstart",
  "Monitoring not ready yet": "Monitoring noch nicht bereit",
  "Monitoring required after launch": "Monitoring nach Start erforderlich",
  "Monitoring should start after review evidence and follow-up work are complete.":
    "Monitoring sollte starten, nachdem Review-Evidenz und Follow-up-Arbeit abgeschlossen sind.",
  "Monitor readiness after human feedback is collected.":
    "Einsatzreife überwachen, nachdem menschliches Feedback gesammelt wurde.",
  "Monitor readiness, unresolved cases, and oversight evidence after review.":
    "Einsatzreife, offene Fälle und Aufsichtsevidenz nach dem Review überwachen.",
  "Minutes per review": "Minuten pro Review",
  "Minutes per reviewer/day": "Minuten pro Reviewer:in/Tag",
  "Missing": "Fehlend",
  "Missing review assignments": "Fehlende Review-Zuweisungen",
  "Needs adjudication": "Adjudikation nötig",
  "Needs edit / rejected": "Überarbeitung nötig / abgelehnt",
  "Needs edit, reject, mismatch, or source concern":
    "Überarbeitung, Ablehnung, Abweichung oder Quellenbedenken",
  "Needs follow-up": "Follow-up nötig",
  "Needs targeted review": "Gezielte Prüfung nötig",
  "Next action": "Nächste Maßnahme",
  "Next step: plan human review": "Nächster Schritt: Human Review planen",
  "Next step: review oversight evidence": "Nächster Schritt: Aufsichtsevidenz prüfen",
  "No cases now": "Aktuell keine Fälle",
  "No team action needed": "Keine Team-Maßnahme nötig",
  "No evaluation run selected": "Kein Evaluationslauf ausgewählt",
  "No adjudication open": "Keine offene Adjudikation",
  "No adjudication needed": "Keine Adjudikation nötig",
  "No follow-up open": "Kein offenes Follow-up",
  "No human review has been collected for this run yet.":
    "Für diesen Lauf wurde noch keine menschliche Prüfung gesammelt.",
  "No human review yet": "Noch keine menschliche Prüfung",
  "No readiness decision yet": "Noch keine Readiness-Entscheidung",
  "Not ready yet": "Noch nicht bereit",
  "Not reviewed": "Noch nicht geprüft",
  "No major AI triage signals, but human review is still required for trust assessment.":
    "Keine größeren KI-Triage-Signale, aber menschliche Prüfung bleibt für die Vertrauensbewertung erforderlich.",
  "No reviewed service-risk concentration is visible yet.":
    "Noch keine geprüfte Risiko-Konzentration nach Service sichtbar.",
  "No saved run evidence is available yet.": "Noch keine gespeicherte Lauf-Evidenz verfügbar.",
  "No source concerns": "Keine Quellenbedenken",
  "not recorded yet": "noch nicht erfasst",
  "of": "von",
  "No unresolved follow-up": "Kein offenes Follow-up",
  "No saved evaluation runs yet. Create a test or demo run in Developer Lab first.":
    "Noch keine gespeicherten Evaluationsläufe. Erstellen Sie zuerst einen Test- oder Demo-Lauf im Developer Lab.",
  "Open now: oversight effort, approval budget, and reviewer assumptions.":
    "Jetzt offen: Aufsichtsaufwand, Freigabebudget und Reviewer-Annahmen.",
  "OpenAI pricing snapshot": "OpenAI-Preisstand",
  "Open batch issues": "Offene Batch-Probleme",
  "Open risk signals": "Offene Risikosignale",
  "Oversight status": "Aufsichtsstatus",
  "Oversight after review": "Aufsicht nach Review",
  "Oversight effort and budget": "Aufsichtsaufwand und Budget",
  "Oversight budget": "Aufsichtsbudget",
  "Oversight evidence details": "Details zur Aufsichtsevidenz",
  "Oversight effort": "Aufsichtsaufwand",
  "Pending": "Ausstehend",
  "Person hours": "Personenstunden",
  "Pilot decision": "Pilotentscheidung",
  "Pilot blocked by disagreement": "Pilot durch Reviewer-Uneinigkeit blockiert",
  "Pilot blocked by follow-up": "Pilot durch Follow-up blockiert",
  "Pilot readiness": "Pilot-Readiness",
  "Pilot readiness checklist": "Pilot-Readiness-Checkliste",
  "Plan oversight staffing and approval budget before sending reviewer links.":
    "Aufsichtspersonal und Freigabebudget planen, bevor Reviewer-Links verschickt werden.",
  "Plan human review from AI triage, approval budget, and capacity.":
    "Human Review anhand von KI-Triage, Freigabebudget und Kapazität planen.",
  "Estimate oversight effort and approval budget before sending reviewer links.":
    "Aufsichtsaufwand und Freigabebudget schätzen, bevor Reviewer-Links verschickt werden.",
  "Plan minimum human review": "Minimale menschliche Prüfung planen",
  "Plan review staffing, timing, and budget before collecting evidence.":
    "Review-Personal, Zeit und Budget planen, bevor Evidenz gesammelt wird.",
  "Planning details": "Planungsdetails",
  "Planning assumptions": "Planungsannahmen",
  "Planning estimate": "Planungsschätzung",
  "Review workload, capacity, and budget assumptions kept for the cost model.":
    "Review-Aufwand, Kapazität und Budgetannahmen für das Kostenmodell.",
  "Estimate the review work needed before reviewer links are sent.":
    "Schätzt den Review-Aufwand, bevor Reviewer-Links verschickt werden.",
  "Adjust the simple assumptions behind staffing and budget estimates.":
    "Passt die einfachen Annahmen hinter Personal- und Budgetschätzung an.",
  "Compare review strategies for the cost model.":
    "Vergleicht Review-Strategien für das Kostenmodell.",
  "Budget estimate for human review and automated judging.":
    "Budgetschätzung für Human Review und automatisierte Bewertung.",
  "Approval planning estimate, not accounting data.":
    "Planungsschätzung für die Freigabe, keine Buchhaltungsdaten.",
  "planned review work": "geplanter Review-Aufwand",
  "Planned assignments": "Geplante Zuweisungen",
  "Pre-review planning": "Planung vor Human Review",
  "Ready for monitored pilot": "Bereit für überwachten Pilotbetrieb",
  "Ready to continue with oversight": "Bereit für Fortsetzung mit Aufsicht",
  "readiness": "Bereitschaft",
  "ready": "bereit",
  "Prepare AI-prioritized review": "KI-priorisierte Prüfung vorbereiten",
  "Prepare monitored pilot": "Überwachten Pilotbetrieb vorbereiten",
  "Recommended next action": "Empfohlene nächste Maßnahme",
  "Research details": "Forschungsdetails",
  "Readiness after review": "Bereitschaft nach Review",
  "Remaining review effort": "Verbleibender Review-Aufwand",
  "remaining review work": "verbleibender Review-Aufwand",
  "Refresh": "Aktualisieren",
  "Resolve human disagreement": "Menschliche Uneinigkeit klären",
  "Resolve follow-up queue": "Follow-up-Liste bearbeiten",
  "Review AI-flagged cases first, but include a small spot-check sample of AI-accepted cases.":
    "Zuerst KI-markierte Fälle prüfen, aber eine kleine Stichprobe KI-akzeptierter Fälle einbeziehen.",
  "Review evidence is sufficient for a cautious pilot with continued monitoring.":
    "Die Review-Evidenz reicht für einen vorsichtigen Pilotbetrieb mit weiterem Monitoring.",
  "Review not started": "Review noch nicht gestartet",
  "Review AI-flagged cases early.": "KI-markierte Fälle früh prüfen.",
  "Review AI-flagged cases early and include a spot-check sample of AI-accepted cases.":
    "KI-markierte Fälle früh prüfen und eine Stichprobe KI-akzeptierter Fälle einbeziehen.",
  "Review assignments are still missing for this run.":
    "Für diesen Lauf fehlen noch Review-Zuweisungen.",
  "Review AI-flagged cases first": "KI-markierte Fälle zuerst prüfen",
  "Review coverage": "Review-Abdeckung",
  "Review coverage still too low": "Review-Abdeckung noch zu niedrig",
  "Review conflict needs resolution": "Review-Konflikt muss geklärt werden",
  "Review conflicts": "Review-Konflikte",
  "Review still in progress": "Review läuft noch",
  "Review effort": "Review-Aufwand",
  "Review evidence": "Review-Evidenz",
  "Review incomplete": "Review unvollständig",
  "Review assumptions": "Review-Annahmen",
  "Review planning": "Review-Planung",
  "Review plan": "Review-Plan",
  "Review protocol": "Review-Protokoll",
  "Review progress": "Review-Fortschritt",
  "From reviewer assignment plan": "Aus dem Reviewer-Zuweisungsplan",
  "Review these early": "Diese Fälle früh prüfen",
  "Review workload": "Review-Aufwand",
  "Reviewed": "Geprüft",
  "Review coverage is sufficient for a cautious pilot and no severe unresolved cases remain.":
    "Die Review-Abdeckung reicht für einen vorsichtigen Pilotbetrieb aus und es bleiben keine schweren ungelösten Fälle.",
  "Review readiness, follow-up queue, and audit evidence.":
    "Readiness, Follow-up-Liste und Audit-Evidenz prüfen.",
  "Review human feedback, risk, and audit evidence.":
    "Menschliches Feedback, Risiko und Audit-Evidenz prüfen.",
  "Reviews per case": "Reviews pro Fall",
  "review per case": "Review pro Fall",
  "reviews planned": "Reviews geplant",
  "reviews per case": "Reviews pro Fall",
  "Reviewers needed for 1 day": "Reviewer:innen für 1 Tag nötig",
  "Reviewer conflict needs resolution": "Reviewer-Konflikt muss geklärt werden",
  "Risk by service": "Risiko nach Service",
  "Risk signals": "Risikosignale",
  "Run size": "Laufgröße",
  "Oversight effort and budget scenarios": "Szenarien für Aufsichtsaufwand und Budget",
  "Scenario": "Szenario",
  "Selected run": "Ausgewählter Lauf",
  "Second-review coverage": "Zweitreview-Abdeckung",
  "Second review still missing": "Zweitreview fehlt noch",
  "Second reviews needed": "Zweitreviews nötig",
  "Some reviews exist, but review coverage or second-review evidence is still too thin.":
    "Es gibt einzelne Reviews, aber Review-Abdeckung oder Zweitreview-Evidenz ist noch zu dünn.",
  "Start the pilot with a review checkpoint and escalation path for serious issues.":
    "Pilotbetrieb mit Review-Checkpoint und Eskalationspfad für schwere Probleme starten.",
  "Strengthen review evidence": "Review-Evidenz stärken",
  "Source concerns": "Quellenbedenken",
  "Source checks": "Quellenprüfung",
  "More review evidence needed": "Mehr Review-Evidenz nötig",
  "Service owner waits for evidence": "Service Owner wartet auf Evidenz",
  "Source owner checks source concerns": "Source Owner prüft Quellenbedenken",
  "Start with these three signals: evidence, blockers, and oversight budget.":
    "Mit diesen drei Signalen beginnen: Evidenz, Blocker und Aufsichtsbudget.",
  "Supporting evidence": "Unterstützende Evidenz",
  "Show planning scenarios": "Planungsszenarien anzeigen",
  "Evaluation traces exist, but no human review records are available yet.":
    "Evaluations-Traces sind vorhanden, aber noch keine menschlichen Review-Datensätze.",
  "Still missing human review": "Menschliche Prüfung fehlt noch",
  "submitted reviews": "eingereichte Reviews",
  "Token usage not recorded yet": "Tokenverbrauch noch nicht erfasst",
  "Team follow-up needed": "Team-Follow-up nötig",
  "Throughput and judge cost": "Durchsatz und Judge-Kosten",
  "Total cases in selected run": "Alle Fälle im ausgewählten Lauf",
  "Total human effort": "Gesamter menschlicher Aufwand",
  "Use AI triage to plan human review. No readiness decision is possible until human review evidence exists.":
    "KI-Triage zur Planung menschlicher Prüfung nutzen. Eine Readiness-Entscheidung ist erst mit Human-Review-Evidenz möglich.",
  "Use after human review evidence has been collected.":
    "Nutzen, nachdem Human-Review-Evidenz gesammelt wurde.",
  "Open for approval budget, readiness checks, and audit evidence.":
    "Öffnen für Freigabebudget, Readiness-Checks und Audit-Evidenz.",
  "Only the evidence needed for the current management decision.":
    "Nur die Evidenz, die für die aktuelle Management-Entscheidung nötig ist.",
  "Most frequent problem types in reviewed answers.":
    "Die häufigsten Problemarten in den geprüften Antworten.",
  "Why this decision?": "Warum diese Entscheidung?",
  "What needs attention": "Was Aufmerksamkeit braucht",
  "What must be cleared": "Was geklärt werden muss",
  "These cases need a decision before the service can go live.":
    "Diese Fälle brauchen eine Entscheidung, bevor der Dienst live gehen kann.",
  "Problem concentration by service area.":
    "Wo sich geprüfte Probleme nach Service bündeln.",
  "Requirements for an approval decision.":
    "Voraussetzungen für eine Freigabe-Entscheidung.",
  "Unsupported claims": "Nicht gestützte Aussagen",
  "Unresolved action cases": "Offene Maßnahmenfälle",
  "Unresolved cases after review": "Offene Fälle nach Review",
  "Unresolved cases": "Offene Fälle",
  "unresolved after review": "offen nach Review",
  "View": "Ansicht",
  "Waiting for evidence": "Warten auf Evidenz",
  "with follow-up signals": "mit Follow-up-Signalen",
  "20-40 cases with 2 reviewers per case for broader reliability evidence.":
    "20-40 Fälle mit 2 Reviewer:innen pro Fall für breitere Reliability-Evidenz.",
  "10-20 cases with 1 reviewer to estimate review burden before scaling.":
    "10-20 Fälle mit 1 Reviewer:in, um den Review-Aufwand vor der Skalierung zu schätzen.",
}

export function tr(language: Language, value: string) {
  return language === "de" ? text[value] || value : value
}

export function formatCount(language: Language, value: number, singular: string, plural = `${singular}s`) {
  const unit = value === 1 ? singular : plural
  return `${value} ${tr(language, unit)}`
}

export function batchOptionLabel(batch: DeveloperRun, language: Language) {
  return runOptionLabel(batch, language, tr)
}

export function formatTokens(value: number) {
  return value.toLocaleString("en-US")
}

export function localizedNextActionDetail(language: Language, value: string) {
  if (language !== "de") return value

  const collectMatch = value.match(/^Collect (\d+) human reviews? before a management decision\.$/)
  if (collectMatch) {
    const reviews = Number(collectMatch[1])
    const reviewUnit = reviews === 1 ? "Review" : "Reviews"
    return `${reviews} Human ${reviewUnit} sammeln, bevor eine Management-Entscheidung möglich ist.`
  }

  const secondReviewMatch = value.match(
    /^Add (\d+) missing second reviews? before the service owner makes an approval decision\.$/,
  )
  if (secondReviewMatch) {
    const reviews = Number(secondReviewMatch[1])
    const reviewUnit = reviews === 1 ? "Zweitreview" : "Zweitreviews"
    return `${reviews} fehlende ${reviewUnit} ergänzen, bevor der Service Owner freigeben kann.`
  }

  const remainingReviewMatch = value.match(
    /^Continue human review for (\d+) unreviewed cases?\.?(?: Also resolve (\d+) review conflicts? before service-owner approval\.)?$/,
  )
  if (remainingReviewMatch) {
    const pending = Number(remainingReviewMatch[1])
    const pendingUnit = pending === 1 ? "ungeprüften Fall" : "ungeprüfte Fälle"
    const conflictCount = remainingReviewMatch[2] ? Number(remainingReviewMatch[2]) : 0
    const conflictDetail = conflictCount
      ? ` Außerdem ${conflictCount} Review-${conflictCount === 1 ? "Konflikt" : "Konflikte"} vor der Freigabe klären.`
      : ""
    return `Human Review für ${pending} ${pendingUnit} fortsetzen.${conflictDetail}`
  }

  const coverageMatch = value.match(
    /^Review at least (\d+) cases before the service owner makes an approval decision\.$/,
  )
  if (coverageMatch) {
    return `Mindestens ${coverageMatch[1]} Fälle prüfen, bevor der Service Owner freigeben kann.`
  }

  if (value === "Approve the next controlled step with human oversight and monitoring.") {
    return "Den nächsten kontrollierten Schritt mit menschlicher Aufsicht und Monitoring freigeben."
  }
  if (value === "The service owner should not approve continuation until the review conflict has a final team decision.") {
    return "Der Service Owner sollte die Fortsetzung erst freigeben, wenn der Review-Konflikt eine finale Teamentscheidung hat."
  }
  const adjudicatedCorrectionMatch = value.match(
    /^The reviewer conflict has a final team decision\. This batch should not be approved as clean; (\d+) needs-edit cases? can be documented for correction or excluded from a monitored pilot\.$/,
  )
  if (adjudicatedCorrectionMatch) {
    const cases = Number(adjudicatedCorrectionMatch[1])
    const caseUnit = cases === 1 ? "Fall" : "Fälle"
    const verb = cases === 1 ? "kann" : "können"
    return `Der Review-Konflikt hat eine finale Teamentscheidung. Dieser Batch sollte nicht als clean freigegeben werden; ${cases} needs-edit ${caseUnit} ${verb} für Korrektur dokumentiert oder aus einem überwachten Pilot ausgeschlossen werden.`
  }
  const answerCorrectionMatch = value.match(
    /^(\d+) cases? (?:is|are) marked needs edit or rejected\. Document them as follow-up evidence, then correct, rerun, or exclude them before service owner approval\.$/,
  )
  if (answerCorrectionMatch) {
    const cases = Number(answerCorrectionMatch[1])
    const caseUnit = cases === 1 ? "Fall" : "Fälle"
    return `${cases} ${caseUnit} sind als needs edit oder rejected markiert. Als Follow-up-Evidenz dokumentieren, dann vor der Freigabe korrigieren, erneut prüfen oder ausschließen.`
  }
  const sourceConcernMatch = value.match(
    /^(\d+) cases? needs? source concerns\. The evaluation team should clear them before service owner approval\.$/,
  )
  if (sourceConcernMatch) {
    const cases = Number(sourceConcernMatch[1])
    const caseUnit = cases === 1 ? "Fall" : "Fälle"
    const verb = cases === 1 ? "hat" : "haben"
    return `${cases} ${caseUnit} ${verb} Quellenbedenken. Das Evaluationsteam sollte sie vor der Freigabe durch den Service Owner klären.`
  }
  const aiApprovedMatch = value.match(
    /^(\d+) AI-approved cases? needs? human follow-up before service owner approval\.$/,
  )
  if (aiApprovedMatch) {
    const cases = Number(aiApprovedMatch[1])
    const caseUnit = cases === 1 ? "Fall" : "Fälle"
    const verb = cases === 1 ? "braucht" : "brauchen"
    return `${cases} KI-akzeptierte ${caseUnit} ${verb} Human-Follow-up vor der Freigabe durch den Service Owner.`
  }
  if (value === "The service owner should wait until review conflicts, answer corrections, and source concerns are resolved.") {
    return "Der Service Owner sollte warten, bis Review-Konflikte, Antwortkorrekturen und Quellenbedenken geklärt sind."
  }
  if (value === "The evaluation team should add review evidence before the service owner makes a decision.") {
    return "Das Evaluationsteam sollte weitere Review-Evidenz ergänzen, bevor der Service Owner entscheidet."
  }

  return tr(language, value)
}

export function localizedAiJudgeReliabilityDetail(language: Language, value: string) {
  if (language !== "de") return value

  if (value === "Agreement cannot be assessed yet — no human reviews.") {
    return "Übereinstimmung kann noch nicht bewertet werden — keine Human Reviews."
  }

  if (
    value ===
    "Agreement cannot be computed yet — reviewer decisions are split and await adjudication."
  ) {
    return "Übereinstimmung kann noch nicht berechnet werden — Prüfentscheidungen sind uneinig und warten auf Schlichtung."
  }

  const falseAcceptMatch = value.match(
    /^AI-prioritized review is not yet safe: (\d+) cases? approved by the AI judge but rejected or flagged by reviewers\.$/,
  )
  if (falseAcceptMatch) {
    const cases = Number(falseAcceptMatch[1])
    const caseUnit = cases === 1 ? "Fall" : "Fälle"
    const verb = cases === 1 ? "wurde" : "wurden"
    return `KI-priorisierte Prüfung ist noch nicht sicher: ${cases} ${caseUnit} ${verb} vom KI-Judge akzeptiert, aber von Reviewer:innen abgelehnt oder markiert.`
  }

  const matchedMatch = value.match(
    /^AI judge matched the human majority in (\d+) of (\d+) cases; (AI-prioritized review looks safe so far|review more cases before relying on AI-prioritized triage)\.$/,
  )
  if (matchedMatch) {
    const matches = matchedMatch[1]
    const comparable = matchedMatch[2]
    const tail =
      matchedMatch[3] === "AI-prioritized review looks safe so far"
        ? "KI-priorisierte Prüfung wirkt bisher sicher"
        : "mehr Fälle prüfen, bevor auf KI-priorisierte Triage vertraut wird"
    return `KI-Judge stimmte in ${matches} von ${comparable} Fällen mit der menschlichen Mehrheit überein; ${tail}.`
  }

  return tr(language, value)
}

export function localizedAiJudgeExcludedDetail(language: Language, value: string) {
  if (language !== "de") return value

  const match = value.match(
    /^(\d+) reviewed cases? excluded — reviewers split, awaiting adjudication\.$/,
  )
  if (match) {
    const cases = Number(match[1])
    return cases === 1
      ? "1 geprüfter Fall ausgeschlossen — Prüfende uneinig, Schlichtung ausstehend."
      : `${cases} geprüfte Fälle ausgeschlossen — Prüfende uneinig, Schlichtung ausstehend.`
  }

  return tr(language, value)
}

export function localizedHeadlineDetail(language: Language, value: string) {
  if (language !== "de") return value

  const noReviewMatch = value.match(/^(\d+) cases? need a first human review before service-owner approval\.$/)
  if (noReviewMatch) {
    return `${noReviewMatch[1]} Fälle brauchen ein erstes Human Review, bevor der Service Owner freigeben kann.`
  }

  const readyMatch = value.match(/^(\d+)\/(\d+) cases reviewed; the service owner can approve the next controlled step\.$/)
  if (readyMatch) {
    return `${readyMatch[1]}/${readyMatch[2]} Fälle geprüft; der Service Owner kann den nächsten kontrollierten Schritt freigeben.`
  }

  const disagreementMatch = value.match(
    /^All cases were reviewed, but reviewers disagreed on (\d+) cases?\. The service owner should wait for the evaluation team to resolve it\.$/,
  )
  if (disagreementMatch) {
    return `Alle Fälle wurden geprüft, aber Reviewer:innen widersprechen sich in ${disagreementMatch[1]} Fall/Fällen. Der Service Owner sollte warten, bis das Evaluationsteam dies geklärt hat.`
  }

  const followUpMatch = value.match(
    /^(\d+)\/(\d+) cases reviewed, but (\d+) cases? need team follow-up before service owner approval\.$/,
  )
  if (followUpMatch) {
    return `${followUpMatch[1]}/${followUpMatch[2]} Fälle geprüft, aber ${followUpMatch[3]} Fälle brauchen Team-Follow-up vor der Freigabe durch den Service Owner.`
  }

  const partialReviewMatch = value.match(
    /^(\d+)\/(\d+) cases reviewed so far; (\d+) cases? still need human review\.(?: Reviewers already disagreed on (\d+) reviewed cases?, so (?:that conflict|those conflicts) also needs? adjudication before service-owner approval\.)?$/,
  )
  if (partialReviewMatch) {
    const reviewedCases = partialReviewMatch[1]
    const totalCases = partialReviewMatch[2]
    const pendingCases = partialReviewMatch[3]
    const conflictCount = partialReviewMatch[4] ? Number(partialReviewMatch[4]) : 0
    const conflictDetail = conflictCount
      ? ` Reviewer:innen widersprechen sich bereits in ${conflictCount} geprüften ${conflictCount === 1 ? "Fall" : "Fällen"}; ${conflictCount === 1 ? "dieser Konflikt muss" : "diese Konflikte müssen"} ebenfalls vor der Freigabe adjudiziert werden.`
      : ""
    return `${reviewedCases}/${totalCases} Fälle bisher geprüft; ${pendingCases} Fälle brauchen noch Human Review.${conflictDetail}`
  }

  const secondReviewMatch = value.match(
    /^(\d+)\/(\d+) cases have a first review, but (\d+) cases? still needs? a second independent review before service-owner approval\.$/,
  )
  if (secondReviewMatch) {
    return `${secondReviewMatch[1]}/${secondReviewMatch[2]} Fälle haben ein erstes Review, aber ${secondReviewMatch[3]} Fälle brauchen noch ein zweites unabhängiges Review vor der Freigabe.`
  }

  const coverageMatch = value.match(
    /^(\d+)\/(\d+) cases reviewed\. At least (\d+) reviewed cases are needed before service-owner approval\.$/,
  )
  if (coverageMatch) {
    return `${coverageMatch[1]}/${coverageMatch[2]} Fälle geprüft. Mindestens ${coverageMatch[3]} geprüfte Fälle sind vor der Freigabe nötig.`
  }

  const evidenceMatch = value.match(
    /^(\d+)\/(\d+) cases reviewed; the evaluation team should add review evidence before service owner approval\.$/,
  )
  if (evidenceMatch) {
    return `${evidenceMatch[1]}/${evidenceMatch[2]} Fälle geprüft; das Evaluationsteam sollte weitere Review-Evidenz vor der Service-Owner-Freigabe ergänzen.`
  }

  return tr(language, value)
}
