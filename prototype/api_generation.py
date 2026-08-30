from __future__ import annotations

try:
    from prototype.api_common import *
except ModuleNotFoundError:
    from api_common import *

def retrieve_context(service: dict, target_section: str | None) -> tuple[str, str]:
    sections = service.get("sections", {})
    if target_section and sections.get(target_section):
        return target_section, sections[target_section]

    for section_name in (
        "required_documents",
        "fees",
        "requirements",
        "processing_time",
        "responsibility_notes",
        "forms",
        "online_abwicklung",
    ):
        if sections.get(section_name):
            return section_name, sections[section_name]
    return "full_text", service.get("full_text", "")


def generate_answer(section_name: str, context: str) -> str:
    intro = ANSWER_INTROS.get(section_name, "In der bereitgestellten offiziellen Quelle steht dazu:")
    return f"{intro} {answer_excerpt(context)}"


def answer_online_link_lines(retrievals: list[dict]) -> list[str]:
    seen: set[str] = set()
    lines: list[str] = []
    for retrieval in retrievals:
        for item in cleaned_online_urls(retrieval.get("online_urls")):
            if item["url"] in seen:
                continue
            seen.add(item["url"])
            lines.append(f"Online-Antrag: {item['label']} - {item['url']}")
    return lines


def generate_single_intent_answer(question: dict, retrievals: list[dict]) -> str:
    first = retrievals[0]
    lines = [generate_answer(first["section_name"], first["chunk_text"])]
    if question_mentions_online(question, first["section_name"]):
        lines.extend(answer_online_link_lines(retrievals))

    for retrieval in retrievals[1:5]:
        max_chars = 520 if (
            first["section_name"] == "responsibility_notes"
            and retrieval["section_name"] == "required_documents"
        ) else 260
        snippet = answer_excerpt(retrieval["chunk_text"], max_chars=max_chars)
        section_label = SECTION_LABELS.get(retrieval["section_name"], retrieval["section_name"])
        if snippet:
            lines.append(f"{section_label.capitalize()}: {snippet}")

    return "\n".join(lines)


def generate_answer_from_retrievals(question: dict, retrievals: list[dict]) -> str:
    if not retrievals:
        return (
            "Dazu liegen in den ausgewählten offiziellen Quellen nicht genug Informationen vor. "
            "Bitte prüfen Sie die offizielle Quelle oder konkretisieren Sie die Frage."
        )
    if question.get("intent_type", "single_intent") == "single_intent":
        return generate_single_intent_answer(question, retrievals)

    lines: list[str] = []
    if question.get("requires_clarification"):
        lines.append(
            "Die Frage enthält mehrere oder noch nicht eindeutig getrennte Anliegen. "
            "Ich kann deshalb keine endgültige Einzelfall-Antwort geben, ohne den konkreten Vorgang zu klären."
        )
    else:
        lines.append(
            "Die Frage enthält mehrere Teile. In der bereitgestellten offiziellen Quelle "
            "lassen sie sich so trennen:"
        )

    seen_online_answer_urls: set[str] = set()
    for retrieval in retrievals:
        section_label = SECTION_LABELS.get(retrieval["section_name"], retrieval["section_name"])
        snippet = answer_excerpt(retrieval["chunk_text"], max_chars=320)
        lines.append(
            f"- {retrieval['service_title']} - {section_label}: {snippet}"
        )
        if question_mentions_online(question, retrieval["section_name"]):
            for item in cleaned_online_urls(retrieval.get("online_urls")):
                if item["url"] in seen_online_answer_urls:
                    continue
                seen_online_answer_urls.add(item["url"])
                lines.append(f"  Online-Antrag: {item['label']} - {item['url']}")

    if question.get("requires_clarification"):
        lines.append(
            "Nächster Schritt: Bitte klären, welcher konkrete Antrag oder welche konkrete Lebenslage gemeint ist."
        )
    else:
        lines.append("Nächster Schritt: Prüfen Sie die jeweils verlinkte offizielle Quellenseite.")
    return "\n".join(lines)

def format_retrieved_context(retrievals: list[dict]) -> str:
    seen_online_urls: set[str] = set()
    blocks: list[str] = []
    for index, retrieval in enumerate(retrievals, start=1):
        online_urls = [
            item
            for item in cleaned_online_urls(retrieval.get("online_urls"))
            if item["url"] not in seen_online_urls
        ]
        seen_online_urls.update(item["url"] for item in online_urls)
        blocks.append(
            "\n".join(
                [
                    f"Source {index}:",
                    f"Service: {retrieval.get('service_title', '')}",
                    f"Section: {retrieval.get('section_name', '')}",
                    f"Source URL: {retrieval.get('source_ref', '')}",
                    (
                        "Official online links:\n"
                        f"{format_online_links(online_urls)}"
                        if online_urls
                        else ""
                    ),
                    f"Text:\n{retrieval.get('chunk_text', '')}",
                ]
            ).strip()
        )
    return "\n\n".join(blocks)


def format_retrieved_context_for_answer(retrievals: list[dict]) -> str:
    return format_retrieved_context(retrievals)


def format_retrieved_context_for_judge(retrievals: list[dict]) -> str:
    return format_retrieved_context(retrievals)
