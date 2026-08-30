import type { Language } from "./types"
import { serviceSectionLabel } from "@/components/shared/serviceSectionLabels"

export const languageStorageKey = "revia_language_v1"

const germanText: Record<string, string> = {
  "Review and Evaluation Infrastructure for AI Answers":
    "Review- und Evaluationsinfrastruktur für KI-Antworten",
  "Dashboard view": "Dashboard-Ansicht",
  "Language": "Sprache",
  "Switch interface language": "Sprache der Oberfläche wechseln",
  "Something went wrong": "Etwas ist schiefgelaufen",
  "Choose whether this answer can be used.":
    "Bitte entscheiden, ob diese Antwort verwendet werden kann.",
  "Choose whether you can verify the answer in the official information.":
    "Bitte angeben, ob die Antwort in den offiziellen Informationen überprüfbar ist.",
  "Choose at least one problem signal before saving this review.":
    "Bitte markieren Sie mindestens ein Problemsignal, bevor Sie diese Bewertung speichern.",
  "Please describe the problem in the note.":
    "Bitte beschreiben Sie das Problem in der Notiz.",
  "Required documents": "Erforderliche Unterlagen",
  "Fees": "Gebühren",
  "Requirements": "Voraussetzungen",
  "Processing time": "Bearbeitungszeit",
  "Responsible authority": "Zuständige Stelle",
  "Forms": "Formulare",
  "Online processing": "Online-Abwicklung",
  "Additional information": "Weitere Informationen",
  "Official service text": "Offizieller Leistungstext",
  "Can be used": "Kann verwendet werden",
  "The answer is useful and can be shown as it is.":
    "Die Antwort ist hilfreich und kann so angezeigt werden.",
  "Needs edits": "Muss überarbeitet werden",
  "The answer is useful, but something should be changed.":
    "Die Antwort ist grundsätzlich hilfreich, sollte aber geändert werden.",
  "Do not use": "Nicht verwenden",
  "The answer is too unclear, incomplete, or unreliable.":
    "Die Antwort ist zu unklar, unvollständig oder nicht verlässlich.",
  "I can find the answer in the official information":
    "Ich finde die Antwort in den offiziellen Informationen",
  "The important statements are visible in the source text.":
    "Die wichtigen Aussagen sind im Quellentext sichtbar.",
  "I do not see factual mistakes": "Ich sehe keine sachlichen Fehler",
  "The answer does not seem to contradict the official information.":
    "Die Antwort scheint den offiziellen Informationen nicht zu widersprechen.",
  "It answers the concrete question directly and completely":
    "Sie beantwortet die konkrete Frage direkt und vollständig",
  "The central question is answered clearly, not only described in general terms.":
    "Die zentrale Frage wird klar beantwortet und nicht nur allgemein umschrieben.",
  "The next step is clear": "Der nächste Schritt ist klar",
  "The resident can understand what to do next.":
    "Die Bürgerin oder der Bürger kann verstehen, was als Nächstes zu tun ist.",
  "The wording is citizen-friendly enough to act on":
    "Die Formulierung ist bürgerfreundlich genug, um danach handeln zu können",
  "Formal public-administration wording is okay when needed, but the answer still makes the next step understandable.":
    "Formale Verwaltungssprache ist in Ordnung, wenn sie nötig ist, aber der nächste Schritt muss trotzdem verständlich bleiben.",
  "The tone is respectful and service-oriented":
    "Der Ton ist respektvoll und serviceorientiert",
  "It sounds suitable for a public-service answer.":
    "Die Antwort klingt passend für eine Auskunft der öffentlichen Verwaltung.",
  "The answer adds links or details I cannot verify":
    "Die Antwort ergänzt Links oder Details, die ich nicht überprüfen kann",
  "Use this for extra URLs, fees, deadlines, requirements, or instructions that are not clear from the official source.":
    "Nutzen Sie dies für zusätzliche URLs, Gebühren, Fristen, Voraussetzungen oder Anweisungen, die aus der offiziellen Quelle nicht klar werden.",
  "Something looks wrong": "Etwas wirkt falsch",
  "A fee, document, requirement, place, or time may be incorrect.":
    "Eine Gebühr, ein Dokument, eine Voraussetzung, ein Ort oder eine Zeitangabe könnte falsch sein.",
  "An important part is missing": "Ein wichtiger Teil fehlt",
  "The resident would still need to ask again about a missing detail.":
    "Die Bürgerin oder der Bürger müsste zu einem fehlenden Detail erneut nachfragen.",
  "The answer does not answer the concrete question directly enough":
    "Die Antwort beantwortet die konkrete Frage nicht direkt genug",
  "The answer contains relevant information, but the central question remains unclear or is only answered indirectly.":
    "Die Antwort enthält relevante Informationen, aber die zentrale Frage bleibt unklar oder wird nur indirekt beantwortet.",
  "The answer should ask for clarification": "Die Antwort sollte eine Rückfrage stellen",
  "The question or situation is too unclear for a definite answer.":
    "Die Frage oder Situation ist zu unklar für eine eindeutige Antwort.",
  "The answer is hard to use or act on": "Die Antwort ist schwer zu nutzen oder umzusetzen",
  "The wording may be too abstract, too long, or not concrete enough for a resident, even if some formal terms are necessary.":
    "Die Formulierung kann zu abstrakt, zu lang oder nicht konkret genug für eine Bürgerin oder einen Bürger sein, auch wenn manche formalen Begriffe nötig sind.",
  "The tone feels unfriendly or unsuitable": "Der Ton wirkt unfreundlich oder unpassend",
  "It may sound dismissive, robotic, or not helpful.":
    "Die Antwort könnte abweisend, technisch oder wenig hilfreich klingen.",
  "Something else is a problem": "Etwas anderes ist ein Problem",
  "The problem does not fit the options above. Please describe it in the note.":
    "Das Problem passt zu keiner der Optionen oben. Bitte beschreiben Sie es in der Notiz.",
  "Please describe the other problem before saving.":
    "Bitte beschreiben Sie das andere Problem, bevor Sie speichern.",
  "All": "Alle",
  "Controlled": "Kontrolliert",
  "AI": "KI",
  "All types": "Alle Typen",
  "Short / SMS": "Kurz / SMS",
  "Long / story": "Lang / Erzählung",
  "Polite": "Höflich",
  "Direct / rude": "Direkt / unhöflich",
  "Bad German": "Schlechtes Deutsch",
  "Multi-part": "Mehrteilig",
  "Uncertain": "Unsicher",
  "Clarification needed": "Rückfrage nötig",
  "Time pressure": "Zeitdruck",
  "Review Explorer": "Review Explorer",
  "Review Batch": "Review Batch",
  "Developer Lab": "Developer Lab",
  "Research": "Forschung",
  "Management": "Management",
  "Audit": "Audit",
  "Human review": "Menschliche Bewertung",
  "Manually inspect individual citizen questions, generate answers, and review selected cases.":
    "Einzelne Bürgerfragen prüfen, Antworten generieren und ausgewählte Fälle bewerten.",
  "Review an assigned sequence of cases for structured human evaluation data collection.":
    "Eine feste Sequenz von Fällen für die strukturierte Erhebung menschlicher Bewertungsdaten bearbeiten.",
  "Developer / Evaluation Lab": "Entwicklungs- und Evaluationslabor",
  "Prompt versions, model versions, retrieved chunks, generated answers, automatic judge output, and debugging traces.":
    "Prompt-Versionen, Modell-Versionen, gefundene Textstellen, generierte Antworten, automatische Bewertung und Debugging-Informationen.",
  "Prepare frozen study runs, reviewer batches, prompt experiments, and case-level debugging.":
    "Eingefrorene Studienläufe, Reviewer-Batches, Prompt-Experimente und Fall-Debugging vorbereiten.",
  "This dashboard is for preparing study runs and debugging why individual cases behaved the way they did.":
    "Dieses Dashboard dient dazu, Studienläufe vorzubereiten und zu debuggen, warum sich einzelne Fälle so verhalten haben.",
  "Research dashboard": "Forschungsdashboard",
  "Selected-run evidence for human review, AI judge decisions, and cases needing inspection.":
    "Evidenz zum ausgewählten Lauf: Human Review, AI-Judge-Entscheidungen und zu prüfende Fälle.",
  "This dashboard is for analyzing the frozen study run: AI-human agreement, disagreement cases, and recurring failure modes.":
    "Dieses Dashboard dient dazu, den eingefrorenen Studienlauf zu analysieren: KI-Mensch-Übereinstimmung, Konfliktfälle und wiederkehrende Fehlermuster.",
  "Management / service owner view": "Management- und Service-Owner-Ansicht",
  "High-level readiness, accepted vs needs-edit cases, review progress, and risk areas by service topic.":
    "Überblick über Einsatzreife, akzeptierte und zu überarbeitende Fälle, Review-Fortschritt und Risikobereiche nach Service-Thema.",
  "Approval status, decision blockers, review progress, and the next responsible team for the selected run.":
    "Management-Entscheidung, offene Blocker, Review-Fortschritt und menschlicher Aufsichtsaufwand für den ausgewählten Lauf.",
  "This dashboard helps a service owner decide whether the selected run can be approved for the next controlled step, what blocks the decision, and which team should act next.":
    "Dieses Dashboard hilft Service Ownern zu entscheiden, ob der ausgewählte Lauf für den nächsten kontrollierten Schritt freigegeben werden kann, was die Entscheidung blockiert und welches Team als Nächstes handeln sollte.",
  "Compliance / audit view": "Compliance- und Audit-Ansicht",
  "Source URLs, source support, prompt and model versions, reviewer decisions, and unsupported-claim checks.":
    "Quellen-URLs, Quellenbezug, Prompt- und Modellversionen, Review-Entscheidungen und Prüfungen auf unbelegte Aussagen.",
  "This dashboard is for reconstructing evaluated answers later: sources, decisions, versions, reviewer evidence, and evidence gaps.":
    "Dieses Dashboard dient dazu, bewertete Antworten später zu rekonstruieren: Quellen, Entscheidungen, Versionen, Review-Evidenz und Evidenzlücken.",
  "This workspace is for collecting structured human judgments without technical overload.":
    "Dieser Arbeitsbereich dient dazu, strukturierte menschliche Bewertungen ohne technische Überlastung zu erfassen.",
  "Structured evaluation session": "Strukturierte Bewertungssitzung",
  "generated answers to review": "generierte Antworten bewerten",
  "You will review one case at a time. Your progress is saved.":
    "Sie bewerten jeweils einen Fall. Ihr Fortschritt wird gespeichert.",
  "You will review one case at a time. For each case, read the resident question and the proposed answer, then answer the review steps on the right. Your progress is saved, so reloading the same link keeps the question order and current position.":
    "Sie bewerten jeweils einen Fall. Lesen Sie pro Fall die Bürgerfrage und die vorgeschlagene Antwort und beantworten Sie dann die Review-Schritte rechts. Ihr Fortschritt wird gespeichert, sodass beim Neuladen dieselbe Reihenfolge und Position erhalten bleiben.",
  "Before you start": "Bevor Sie beginnen",
  "Please read these short instructions before starting the review.":
    "Bitte lesen Sie diese kurzen Hinweise, bevor Sie mit der Bewertung beginnen.",
  "Read the resident question": "Lesen Sie die Bürgerfrage",
  "Focus on what the person is trying to find out.":
    "Achten Sie darauf, was die Person konkret wissen möchte.",
  "Check the proposed answer": "Prüfen Sie die vorgeschlagene Antwort",
  "Decide whether it would be usable for a real resident.":
    "Entscheiden Sie, ob sie für eine echte Bürgerin oder einen echten Bürger nutzbar wäre.",
  "Use the source when needed": "Nutzen Sie die Quelle bei Bedarf",
  "If something seems unsupported, mark the source concern.":
    "Wenn etwas nicht belegt wirkt, markieren Sie ein Quellenproblem.",
  "The time you spend on each case is recorded for study purposes.":
    "Die pro Fall benötigte Zeit wird zu Studienzwecken erfasst.",
  "Please choose": "Bitte wählen",
  "Reviewer profile": "Reviewer-Profil",
  "Preview mode": "Vorschau-Modus",
  "Please select the options below to start the review.":
    "Bitte wählen Sie unten die Optionen aus, um mit der Bewertung zu beginnen.",
  "Reviewer background": "Reviewer-Hintergrund",
  "Student": "Student/in",
  "Public administration": "Öffentliche Verwaltung",
  "Technical background": "Technischer Hintergrund",
  "Other": "Sonstiges",
  "Public-service familiarity": "Vertrautheit mit Verwaltungsleistungen",
  "LLM familiarity": "LLM-Vertrautheit",
  "German-language confidence": "Deutsch-Sicherheit",
  "Low": "Niedrig",
  "Medium": "Mittel",
  "High": "Hoch",
  "Start review batch": "Review-Batch starten",
  "Batch complete": "Batch abgeschlossen",
  "Start a new batch": "Neuen Batch starten",
  "Loading the next question...": "Nächste Frage wird geladen...",
  "achieved": "erreicht",
  "saved": "gespeichert",
  "Instructions": "Hinweise",
  "Back to questions": "Zurück zu den Fragen",
  "Review generated answer": "Generierte Antwort bewerten",
  "Question and answer": "Frage und Antwort",
  "Read the question and the proposed answer.":
    "Lesen Sie die Frage und die vorgeschlagene Antwort.",
  "Resident question": "Bürgerfrage",
  "Answer to review": "Zu bewertende Antwort",
  "Source for checking": "Quelle zur Prüfung",
  "Open official source": "Offizielle Quelle öffnen",
  "No source excerpt available.": "Kein Quellenauszug verfügbar.",
  "Open": "Öffnen",
  "Close": "Schließen",
  "Your review": "Ihre Bewertung",
  "Choose the usability decision. Add problem details only when something needs attention.":
    "Wählen Sie die Nutzbarkeitsentscheidung. Ergänzen Sie Problemdetails nur, wenn etwas Aufmerksamkeit braucht.",
  "Answer one review question at a time. Required steps are marked clearly.":
    "Beantworten Sie jeweils eine Review-Frage. Pflichtschritte sind klar markiert.",
  "Saved locally": "Lokal gespeichert",
  "Decision": "Entscheidung",
  "First decide whether the answer can be used.":
    "Entscheiden Sie zuerst, ob die Antwort verwendet werden kann.",
  "Source check": "Quellenprüfung",
  "Optional. Mark this only if part or all of the answer cannot be confirmed from the shown source.":
    "Optional. Markieren Sie dies nur, wenn ein Teil oder die ganze Antwort aus der angezeigten Quelle nicht bestätigt werden kann.",
  "Source support problem": "Quellenbeleg-Problem",
  "I cannot confirm part or all of the answer from the shown source.":
    "Ich kann einen Teil oder die ganze Antwort aus der angezeigten Quelle nicht bestätigen.",
  "Unsupported claim": "Unbelegte Aussage",
  "Something seems unsupported or unverifiable.":
    "Etwas wirkt unbelegt oder nicht überprüfbar.",
  "Then say whether the answer can be verified.":
    "Geben Sie danach an, ob die Antwort überprüfbar ist.",
  "What stands out": "Auffälligkeiten",
  "Optional quick signals for the team.": "Optionale kurze Signale für das Team.",
  "Notes": "Notizen",
  "Optional explanation before saving.": "Optionale Erläuterung vor dem Speichern.",
  "Can this answer be used?": "Kann diese Antwort verwendet werden?",
  "Can you verify it in the official information?":
    "Können Sie sie in den offiziellen Informationen überprüfen?",
  "Open the source on the left if you need to compare details.":
    "Öffnen Sie bei Bedarf links die Quelle, um Details zu vergleichen.",
  "Yes, I can verify it": "Ja, ich kann sie überprüfen",
  "The answer is visible in the source.": "Die Antwort ist in der Quelle sichtbar.",
  "Partly": "Teilweise",
  "Some parts are clear, but not everything.": "Einige Teile sind klar, aber nicht alles.",
  "No, I cannot verify it": "Nein, ich kann sie nicht überprüfen",
  "The answer adds unclear or unsupported information.":
    "Die Antwort ergänzt unklare oder unbelegte Informationen.",
  "Quick checklist": "Kurze Checkliste",
  "Problem details": "Problemdetails",
  "Please mark at least one problem signal before saving.":
    "Bitte markieren Sie mindestens ein Problemsignal, bevor Sie speichern.",
  "Open this if you want to add a concern.":
    "Öffnen Sie dies, wenn Sie einen Problemhinweis ergänzen möchten.",
  "Add problem": "Problem hinzufügen",
  "Hide problems": "Probleme ausblenden",
  "Tick anything that stands out. You can leave this empty.":
    "Markieren Sie alles, was auffällt. Sie können diesen Schritt leer lassen.",
  "Because this answer needs changes, please mark at least one problem signal.":
    "Da diese Antwort überarbeitet werden muss, markieren Sie bitte mindestens ein Problemsignal.",
  "Positive signals": "Positive Signale",
  "Problems to check": "Zu prüfende Probleme",
  "Note for the team": "Notiz für das Team",
  "Add note": "Notiz hinzufügen",
  "Hide notes": "Notizen ausblenden",
  "Short reason or anything the team should know.":
    "Kurze Begründung oder ein Hinweis für das Team.",
  "Suggested correction": "Korrekturvorschlag",
  "Write a corrected answer or a concrete edit suggestion.":
    "Schreiben Sie eine korrigierte Antwort oder einen konkreten Änderungsvorschlag.",
  "Required": "Pflichtfeld",
  "Optional": "Optional",
  "Back": "Zurück",
  "Save review": "Bewertung speichern",
  "Save & next": "Speichern und weiter",
  "Ready to save this review.": "Diese Bewertung kann gespeichert werden.",
  "Next": "Weiter",
  "Explanation": "Erklärung",
  "Review checklist": "Review-Checkliste",
  "Questions": "Fragen",
  "Traces": "Traces",
  "Disagreements": "Konflikte",
  "Services": "Services",
  "This role view remains visible so the stakeholder model is clear. Review Explorer and Review Batch are implemented first; this view can be filled next with the role-specific data shown above.":
    "Diese Rollenansicht bleibt sichtbar, damit das Stakeholder-Modell klar erkennbar ist. Review Explorer und Review Batch sind zuerst umgesetzt; diese Ansicht kann als Nächstes mit den oben gezeigten rollenspezifischen Daten gefüllt werden.",
  "Choose a citizen question to test": "Bürgerfrage zum Testen auswählen",
  "Select one resident question, then generate an answer for review.":
    "Wählen Sie eine Bürgerfrage aus und generieren Sie danach eine Antwort zur Bewertung.",
  "Search questions": "Fragen suchen",
  "Question set": "Fragenset",
  "Question type": "Fragetyp",
  "Search questions...": "Fragen suchen...",
  "Close search": "Suche schließen",
  "matching questions": "passende Fragen",
  "Scroll the list and choose one case": "Liste scrollen und einen Fall auswählen",
  "No questions match this search and filter combination.":
    "Keine Fragen passen zu dieser Suche und Filterkombination.",
  "One question selected": "Eine Frage ausgewählt",
  "Select a question first": "Zuerst eine Frage auswählen",
  "Generate proposed answer": "Vorgeschlagene Antwort generieren",
  "Selected": "Ausgewählt",
}

export function tr(language: Language, text: string) {
  return language === "de" ? germanText[text] || text : text
}

export function sectionLabel(language: Language, sectionName: string) {
  return tr(language, serviceSectionLabel("en", sectionName))
}

export function getInitialLanguage(): Language {
  const stored = window.localStorage.getItem(languageStorageKey)
  return stored === "en" || stored === "de" ? stored : "de"
}
