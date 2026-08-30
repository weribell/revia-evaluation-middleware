#!/usr/bin/env python3
"""Minimal REST API for the Revia evaluation middleware.

No external dependencies are required. The server reads local source and
question datasets and stores runtime evaluation runs in SQLite.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import random
import re
import secrets
import sys
import threading
import time
import uuid
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Iterable
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, unquote, urlparse, urlunparse

try:
    from prototype.api_time import now_iso
    from prototype.evaluation_store import SQLiteEvaluationStore
except ModuleNotFoundError:
    from api_time import now_iso
    from evaluation_store import SQLiteEvaluationStore


DEFAULT_DATA_DIR = Path("examples/synthetic-demo")
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
DEVELOPER_RUN_MAX_WORKERS = 3
# Output-token ceilings. They only cap length; cost is charged for tokens actually
# produced. Multi-intent answers cover several services/sections, so the answer
# ceiling must be generous enough to avoid truncated ("incomplete") responses.
OPENAI_ANSWER_MAX_OUTPUT_TOKENS = 2048
OPENAI_JUDGE_MAX_OUTPUT_TOKENS = 4000
OPENAI_MAX_ATTEMPTS = 3  # 1 initial attempt + 2 retries; worst case ~1s + 2s + jitter
OPENAI_RETRY_BASE_DELAY_SECONDS = 1.0
OPENAI_RETRY_MAX_DELAY_SECONDS = 10.0
OPENAI_RETRYABLE_STATUS_CODES = frozenset({408, 409, 425, 429, 500, 502, 503, 504})
# Default OpenAI model when OPENAI_MODEL is not configured. Must accept the
# judge's text.verbosity / reasoning settings (gpt-4.1-mini rejects them, which
# made judge runs fail silently on machines without OPENAI_MODEL in .env).
DEFAULT_OPENAI_MODEL = "gpt-5-mini"


def default_openai_model() -> str:
    return os.environ.get("OPENAI_MODEL", DEFAULT_OPENAI_MODEL)


OPENAI_PRICING_SOURCE_URL = "https://platform.openai.com/docs/pricing"
OPENAI_PRICING_CHECKED_AT = "2026-08-27"
OPENAI_PRICING_USD_PER_1M_TOKENS = {
    "gpt-5-mini": {"input": 0.25, "cached_input": 0.025, "output": 2.00},
    "gpt-5.5": {"input": 5.00, "cached_input": 0.50, "output": 30.00},
    "gpt-5.5-pro": {"input": 30.00, "cached_input": None, "output": 180.00},
    "gpt-5.4": {"input": 2.50, "cached_input": 0.25, "output": 15.00},
    "gpt-5.4-mini": {"input": 0.75, "cached_input": 0.075, "output": 4.50},
    "gpt-5.4-nano": {"input": 0.20, "cached_input": 0.02, "output": 1.25},
    "gpt-5.4-pro": {"input": 30.00, "cached_input": None, "output": 180.00},
}


class FrozenRunError(Exception):
    """Raised when a mutating operation targets a frozen study-run case."""
DEFAULT_ANSWER_PROMPT = (
    "Answer the citizen question using only the retrieved official-source "
    "context. Write a concise, polite German answer. If the context is missing "
    "information, say what is missing and point to the official source. If "
    "official online links are provided in the context and the citizen asks "
    "about online processing, include those links as the next step. Never "
    "invent URLs or application channels. "
    "Write the answer as natural, flowing prose. Do not add headings, labels, or "
    "meta-prefixes to the answer or any of its parts (for example do not begin "
    "with 'Kurz', 'Kurz und konkret', 'Kurzantwort', 'Kurz und bündig', or "
    "'Direkte Antwort'). For multi-part questions, separate the parts with short "
    "paragraphs or a simple list, but without such labels."
)
DEFAULT_JUDGE_PROMPT = (
    "You are an evaluation judge for a public-sector RAG system.\n\n"
    "Use only the citizen question, the retrieved official-source context, "
    "and the generated answer. Do not use outside knowledge.\n\n"
    "Evaluate the answer against the citizen's actual question, not against all "
    "possible information about the public service.\n\n"
    "First identify explicit requested parts of the citizen question. Then check "
    "whether the answer addresses each part, whether substantive claims are "
    "supported by the context, and whether any action-critical claim is wrong or "
    "invented.\n\n"
    "If the retrieved context does not contain information needed for an "
    "explicit action-critical part of the question, record that gap in "
    "context_limitations and the unanswered part in missing_or_incomplete_points. "
    "A cautious statement that the information is not available can be "
    "source-supported, but it is not automatically complete or acceptable.\n\n"
    "Action-critical facts include fees, deadlines, required documents, eligibility "
    "conditions, legal requirements, responsible offices, application channels, "
    "online-processing options, and payment options.\n\n"
    "Scoring:\n"
    "- factual_correctness: false or misleading statements compared with the context.\n"
    "- source_support: whether substantive claims are supported by the context.\n"
    "- completeness: whether all explicit requested parts are answered or marked as not available from context.\n"
    "- clarity_actionability: whether the answer is understandable, concise, and useful.\n"
    "- public_service_tone: whether the tone is polite, professional, and appropriate.\n"
    "- uncertainty_handling: whether missing, unclear, or insufficient context is handled honestly.\n\n"
    "Use 1 for clearly wrong or missing the main request, 2 for weak/substantially "
    "incomplete, 3 for borderline, 4 for good with minor issues, and 5 for very good.\n\n"
    "Final decision:\n"
    "- accept: factually correct, source-supported, complete enough, and usable.\n"
    "- needs_edit: mostly correct and source-grounded, but incomplete, unclear, poorly worded, or missing uncertainty handling.\n"
    "- reject: important wrong, contradicted, invented, misleading, unsafe, or main-question failure.\n\n"
    "Do not choose needs_edit merely because a wrong answer could be corrected. "
    "If the current answer contains an important wrong or invented action-critical claim, choose reject."
)
REVIEWER_PROFILE_FIELDS = [
    "reviewer_background",
    "public_service_familiarity",
    "llm_familiarity",
    "language_confidence_de",
]
CANONICAL_EVALUATION_CRITERIA = (
    "factual_correctness",
    "source_support",
    "completeness",
    "clarity_actionability",
    "public_service_tone",
    "uncertainty_handling",
)
CRITERION_ALIASES = {
    "public_service_tone": ("public_service_tone", "tone_public_service"),
    "uncertainty_handling": ("uncertainty_handling", "clarification_need"),
}
ANSWERABILITY_VALUES = {"answerable", "partly_answerable", "not_answerable", "needs_clarification"}
JUDGE_FINAL_DECISIONS = {"accept", "needs_edit", "reject"}
JUDGE_SCHEMA_VERSION = "judge-schema-v1"
OPENAI_JUDGE_TEXT_FORMAT = {
    "type": "json_schema",
    "name": "judge_evaluation",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "answerability",
            "scores",
            "final_decision",
            "contradicted_claims",
            "unsupported_claims",
            "missing_or_incomplete_points",
            "clarity_or_tone_problems",
            "context_limitations",
            "short_explanation",
        ],
        "properties": {
            "answerability": {
                "type": "string",
                "enum": ["answerable", "partly_answerable", "not_answerable", "needs_clarification"],
            },
            "scores": {
                "type": "object",
                "additionalProperties": False,
                "required": list(CANONICAL_EVALUATION_CRITERIA),
                "properties": {
                    key: {"type": "integer", "minimum": 1, "maximum": 5}
                    for key in CANONICAL_EVALUATION_CRITERIA
                },
            },
            "final_decision": {
                "type": "string",
                "enum": ["accept", "needs_edit", "reject"],
            },
            "contradicted_claims": {"type": "array", "items": {"type": "string"}},
            "unsupported_claims": {"type": "array", "items": {"type": "string"}},
            "missing_or_incomplete_points": {"type": "array", "items": {"type": "string"}},
            "clarity_or_tone_problems": {"type": "array", "items": {"type": "string"}},
            "context_limitations": {"type": "array", "items": {"type": "string"}},
            "short_explanation": {"type": "string"},
        },
    },
}
CALIBRATION_BATCH_TYPE = "judge_calibration"
HUMAN_REVIEW_BATCH_EXCLUSIONS = (CALIBRATION_BATCH_TYPE,)

# LLM-generated improvement suggestions: one OpenAI call per batch that reads
# the already-collected human review comments and judge explanations/evidence
# and proposes concrete, case-referenced fixes for the chatbot owner. This is
# the LLM primary tier; ``prototype/improvement_suggestions.py`` stays the
# deterministic rule-based fallback tier, mirroring the judge's LLM-primary /
# rule-based-fallback design.
IMPROVEMENT_SUGGESTIONS_PROMPT_VERSION = "improvement_suggestions_v1"
IMPROVEMENT_SUGGESTIONS_INSTRUCTIONS = (
    "Du analysierst Bewertungsdaten eines Verwaltungs-Chatbots für die "
    "Qualitätssicherung. Unten stehen pro Fall: Frage, Entscheidung und Kommentar "
    "der menschlichen Prüfer sowie Entscheidung, Begründung und Befunde des "
    "KI-Judges. Extrahiere 3 bis 7 konkrete, umsetzbare Verbesserungsvorschläge "
    "für die Betreiber des Chatbots. Regeln: Jeder Vorschlag stützt sich "
    "ausschließlich auf die vorliegenden Daten; nenne die belegenden Fall-IDs in "
    "evidence_case_ids und wörtliche Belegzitate (gekürzt) in evidence_quotes. "
    "Erfinde nichts. Wenn mehrere Fälle dasselbe Problem zeigen, fasse sie zu "
    "einem Vorschlag zusammen. Titel kurz und imperativisch (z.B. 'Antworten "
    "kürzen'). Schreibe auf Deutsch."
)
OPENAI_IMPROVEMENT_SUGGESTIONS_MAX_OUTPUT_TOKENS = 3000
# Evidence text cap for the single improvement-suggestions call. Keeps a large
# imported batch from blowing past the model's effective context/cost budget;
# ``_compile_improvement_evidence_text`` stops adding cases once this is hit.
IMPROVEMENT_EVIDENCE_MAX_CHARS = 30_000
OPENAI_IMPROVEMENT_SUGGESTIONS_TEXT_FORMAT = {
    "type": "json_schema",
    "name": "improvement_suggestions",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["suggestions"],
        "properties": {
            "suggestions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["title", "suggestion", "evidence_case_ids", "evidence_quotes"],
                    "properties": {
                        "title": {"type": "string"},
                        "suggestion": {"type": "string"},
                        "evidence_case_ids": {"type": "array", "items": {"type": "string"}},
                        "evidence_quotes": {"type": "array", "items": {"type": "string"}},
                    },
                },
            },
        },
    },
}

SECTION_LABELS = {
    "description": "service description",
    "required_documents": "required documents",
    "fees": "fees",
    "requirements": "requirements",
    "processing_time": "processing time",
    "responsibility_notes": "responsible authority",
    "forms": "forms",
    "online_abwicklung": "online processing",
    "responsible_locations": "responsible office",
    "additional_information": "additional information",
}

GERMAN_SECTION_LABELS = {
    "description": "Beschreibung",
    "required_documents": "Unterlagen",
    "fees": "Gebühren",
    "requirements": "Voraussetzungen",
    "processing_time": "Bearbeitungszeit",
    "responsibility_notes": "Zuständige Stelle",
    "forms": "Formulare",
    "online_abwicklung": "Online-Abwicklung",
    "responsible_locations": "Zuständige Stelle",
    "additional_information": "Weitere Informationen",
}

CONTEXT_EXPANSION_SECTIONS = (
    "description",
    "requirements",
    "processing_time",
    "required_documents",
    "forms",
    "online_abwicklung",
    "responsibility_notes",
    "responsible_locations",
)
TARGETED_CONTEXT_EXPANSION_SECTIONS = {
    "online_abwicklung": ("description", "requirements", "appointment"),
    "responsibility_notes": ("responsible_locations", "description", "required_documents"),
}
THIN_CONTEXT_MAX_CHARS = 80

ANSWER_INTROS = {
    "required_documents": "In der bereitgestellten offiziellen Quelle werden folgende Unterlagen genannt:",
    "fees": "In der bereitgestellten offiziellen Quelle werden folgende Gebühren genannt:",
    "requirements": "In der bereitgestellten offiziellen Quelle gelten folgende Voraussetzungen:",
    "processing_time": "In der bereitgestellten offiziellen Quelle wird folgende durchschnittliche Bearbeitungszeit genannt:",
    "responsibility_notes": "In der bereitgestellten offiziellen Quelle ist folgende Zuständigkeit angegeben:",
    "forms": "In der bereitgestellten offiziellen Quelle werden folgende Formulare genannt:",
    "online_abwicklung": "In der bereitgestellten offiziellen Quelle stehen folgende Hinweise zur Online-Abwicklung:",
    "responsible_locations": "In der bereitgestellten offiziellen Quelle ist folgende zuständige Stelle angegeben:",
    "additional_information": "In der bereitgestellten offiziellen Quelle stehen dazu folgende weitere Informationen:",
}

JUDGE_CALIBRATION_CASES = [
    {
        "calibration_id": "cal_good_001",
        "target_section": "fees",
        "fault_type": "known_good_answer",
        "expected_final_decision": "accept",
        "expected_low_criteria": [],
        "answer_kind": "good",
        "note": "Control case: a concise source-grounded fee answer should not be over-penalized.",
    },
    {
        "calibration_id": "cal_good_multi_001",
        "question_id": "q_0010_fictional_event_room_forms",
        "target_section": "forms",
        "fault_type": "known_good_multi_intent_answer",
        "expected_final_decision": "accept",
        "expected_low_criteria": [],
        "answer_kind": "good_multi_citizen",
        "note": "Control case: a citizen-facing multi-intent answer should be accepted when it covers all requested parts.",
    },
    {
        "calibration_id": "cal_good_no_fee_001",
        "question_id": "q_0002_fictional_library_card_fees",
        "target_section": "fees",
        "fault_type": "known_good_no_fee_answer",
        "expected_final_decision": "accept",
        "expected_low_criteria": [],
        "answer_kind": "good_no_fee",
        "note": "Control case: a concise answer that states no fee should be accepted.",
    },
    {
        "calibration_id": "cal_good_processing_001",
        "question_id": "q_0004_fictional_bicycle_box_processing_time",
        "target_section": "processing_time",
        "fault_type": "known_good_processing_time_answer",
        "expected_final_decision": "accept",
        "expected_low_criteria": [],
        "answer_kind": "good_processing_time",
        "note": "Control case: a source-grounded processing-time answer should be accepted.",
    },
    {
        "calibration_id": "cal_src_001",
        "target_section": "fees",
        "fault_type": "unsupported_claim",
        "expected_final_decision": "reject",
        "expected_low_criteria": ["source_support", "factual_correctness"],
        "answer_kind": "unsupported_fee",
        "note": "The answer invents a concrete fee that is not taken from the source.",
    },
    {
        "calibration_id": "cal_legal_001",
        "target_section": "requirements",
        "fault_type": "wrong_eligibility_claim",
        "expected_final_decision": "reject",
        "expected_low_criteria": ["source_support", "factual_correctness"],
        "answer_kind": "unsupported_eligibility",
        "note": "The answer invents an eligibility/legal claim that could mislead the citizen.",
    },
    {
        "calibration_id": "cal_online_001",
        "target_section": "requirements",
        "fault_type": "invented_online_option",
        "expected_final_decision": "reject",
        "expected_low_criteria": ["source_support", "factual_correctness"],
        "answer_kind": "invented_online_option",
        "note": "The answer invents an online application channel not supported by the retrieved section.",
    },
    {
        "calibration_id": "cal_office_001",
        "question_id": "q_0005_fictional_event_room_responsibility_notes",
        "target_section": "responsibility_notes",
        "fault_type": "wrong_responsible_office",
        "expected_final_decision": "reject",
        "expected_low_criteria": ["source_support", "factual_correctness"],
        "answer_kind": "wrong_responsible_office",
        "note": "The answer names a wrong responsible office, which is action-critical in public administration.",
    },
    {
        "calibration_id": "cal_complete_001",
        "target_section": "required_documents",
        "fault_type": "incomplete_answer",
        "expected_final_decision": "reject",
        "expected_low_criteria": ["completeness", "source_support", "factual_correctness"],
        "answer_kind": "incomplete_documents",
        "note": "The answer says only one document is needed and denies the source list, so it is action-critical misinformation.",
    },
    {
        "calibration_id": "cal_uncertainty_001",
        "target_section": "processing_time",
        "fault_type": "overconfident_answer",
        "expected_final_decision": "reject",
        "expected_low_criteria": ["uncertainty_handling", "source_support", "factual_correctness"],
        "answer_kind": "overconfident_processing_time",
        "note": "The answer gives a guaranteed processing time that contradicts the source, so it is action-critical misinformation.",
    },
    {
        "calibration_id": "cal_ambiguous_001",
        "question_id": "q_0003_fictional_market_stall_requirements",
        "target_section": "requirements",
        "fault_type": "overconfident_ambiguous_answer",
        "expected_final_decision": "reject",
        "expected_low_criteria": ["uncertainty_handling", "source_support"],
        "answer_kind": "overconfident_ambiguous",
        "note": "The answer gives confident action advice for an ambiguous or contradictory citizen situation.",
    },
    {
        "calibration_id": "cal_tone_001",
        "target_section": "forms",
        "fault_type": "bad_public_service_tone",
        "expected_final_decision": "needs_edit",
        "expected_low_criteria": ["public_service_tone", "clarity_actionability"],
        "answer_kind": "bad_tone",
        "note": "The answer may contain some relevant words but is unsuitable for public-service communication.",
    },
    {
        "calibration_id": "cal_bureaucratic_001",
        "target_section": "requirements",
        "fault_type": "bureaucratic_answer",
        "expected_final_decision": "needs_edit",
        "expected_low_criteria": [],
        "expected_criteria_max": {"clarity_actionability": 3},
        "answer_kind": "bureaucratic_answer",
        "note": "The answer is source-grounded but too bureaucratic and hard for a citizen to act on.",
    },
    {
        "calibration_id": "cal_raw_multi_001",
        "question_id": "q_0010_fictional_event_room_forms",
        "target_section": "forms",
        "fault_type": "retrieval_style_answer",
        "expected_final_decision": "needs_edit",
        "expected_low_criteria": [],
        "answer_kind": "raw_multi_retrieval",
        "note": "The answer is source-grounded but reads like internal retrieval output rather than citizen communication.",
    },
    {
        "calibration_id": "cal_partial_documents_soft_001",
        "question_id": "q_0001_fictional_community_garden_required_documents",
        "target_section": "required_documents",
        "fault_type": "soft_incomplete_documents",
        "expected_final_decision": "needs_edit",
        "expected_low_criteria": [],
        "expected_criteria_max": {"completeness": 3},
        "answer_kind": "partial_documents_soft",
        "note": "The answer mentions relevant documents but omits important parts of the source list.",
    },
    {
        "calibration_id": "cal_multi_001",
        "question_id": "q_0011_fictional_community_garden_multi_intent_unrelated_services",
        "target_section": "required_documents",
        "fault_type": "multi_intent_partial_answer",
        "expected_final_decision": "needs_edit",
        "expected_low_criteria": [],
        "expected_criteria_max": {"completeness": 3},
        "answer_kind": "partial_multi_intent",
        "prefer_multi_intent": True,
        "note": "The answer handles only one part of a multi-intent citizen question and should flag partial coverage or missing-context handling.",
    },
]

def load_local_env(path: Path = Path(".env")) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def append_jsonl(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def tokenize(text: str) -> set[str]:
    words = re.findall(r"[A-Za-zÄÖÜäöüß0-9]{4,}", text.lower())
    stop_words = {
        "diese",
        "dieser",
        "dienstleistung",
        "laut",
        "quelle",
        "offiziellen",
        "folgende",
        "werden",
        "wird",
        "kann",
        "nicht",
        "oder",
        "eine",
        "einen",
        "einer",
        "fuer",
        "für",
        "dass",
        "sind",
    }
    return {word for word in words if word not in stop_words}


def short_text(text: str, max_chars: int = 700) -> str:
    text = normalize_space(text)
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0] + " ..."


def answer_excerpt(text: str, max_chars: int = 950) -> str:
    """Create a bounded baseline answer without making it look cut off."""
    lines = [normalize_space(line) for line in text.splitlines() if normalize_space(line)]
    if not lines:
        lines = [normalize_space(text)]

    selected: list[str] = []
    current_length = 0
    for line in lines:
        next_length = current_length + len(line) + (1 if selected else 0)
        if selected and next_length > max_chars:
            break
        if len(line) > max_chars:
            sentence_match = re.match(r"^(.{120,}?[\.\!\?])\s", line)
            selected.append(sentence_match.group(1) if sentence_match else line[:max_chars].rsplit(" ", 1)[0])
            break
        selected.append(line)
        current_length = next_length

    answer = " ".join(selected).strip()
    if len(" ".join(lines)) > len(answer):
        answer = (
            f"{answer} Bitte prüfen Sie die vollständige Liste und mögliche Sonderfälle "
            "in der offiziellen Quelle."
        )
    return answer


def cleaned_online_urls(value: object) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    urls: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        label = str(item.get("label") or "Online-Antrag").strip() or "Online-Antrag"
        urls.append({"label": label, "url": url})
    return urls


def online_metadata_for_service(service: dict) -> dict:
    metadata = service.get("online_metadata")
    if not isinstance(metadata, dict):
        return {
            "online_available": False,
            "online_urls": [],
            "online_labels": [],
            "online_procedure_notes": "",
            "raw_excerpt": "",
        }
    return {
        "online_available": bool(metadata.get("online_available")),
        "online_urls": cleaned_online_urls(metadata.get("online_urls")),
        "online_labels": [
            str(label).strip()
            for label in metadata.get("online_labels", [])
            if str(label).strip()
        ]
        if isinstance(metadata.get("online_labels"), list)
        else [],
        "online_procedure_notes": str(metadata.get("online_procedure_notes") or "").strip(),
        "raw_excerpt": str(metadata.get("raw_excerpt") or "").strip(),
    }


def format_online_links(online_urls: list[dict[str, str]]) -> str:
    return "\n".join(f"- {item['label']}: {item['url']}" for item in online_urls)


def question_mentions_online(question: dict, section_name: str | None = None) -> bool:
    if section_name == "online_abwicklung" or question.get("target_section") == "online_abwicklung":
        return True
    text = str(question.get("question_text") or "").lower()
    return bool(re.search(r"\b(online|digital|internet|eid|bundid|elster)\b", text, flags=re.I))


def is_thin_context(text: str) -> bool:
    normalized = normalize_space(text)
    if len(normalized) <= THIN_CONTEXT_MAX_CHARS:
        return True
    return normalized.lower() in {"keine", "keine angaben", "keine weiteren informationen"}


def retrieval_with_service_metadata(retrieval: dict, service: dict) -> dict:
    metadata = online_metadata_for_service(service)
    return {
        **retrieval,
        "online_available": metadata["online_available"],
        "online_urls": metadata["online_urls"],
        "online_labels": metadata["online_labels"],
    }


def build_service_context_retrievals(
    service: dict,
    *,
    primary_section: str,
    primary_intent_role: str,
    start_rank: int,
    section_names: Iterable[str] | None = None,
    exclude_sections: set[str] | None = None,
) -> list[dict]:
    sections = service.get("sections", {})
    retrievals: list[dict] = []
    rank = start_rank
    excluded = {primary_section, *(exclude_sections or set())}
    for section_name in section_names or CONTEXT_EXPANSION_SECTIONS:
        if section_name in excluded:
            continue
        if section_name == "description":
            context = str(service.get("description") or "").strip()
        else:
            context = str(sections.get(section_name) or "").strip()
        if not context:
            continue
        retrievals.append(
            retrieval_with_service_metadata(
                {
                    "retrieval_id": "",
                    "trace_id": "",
                    "service_id": service["service_id"],
                    "service_title": service["title"],
                    "section_name": section_name,
                    "chunk_text": context,
                    "rank": rank,
                    "retrieval_score": 0.75,
                    "source_ref": service["url"],
                    "intent_role": f"{primary_intent_role}_context",
                },
                service,
            )
        )
        rank += 1
    return retrievals


def response_summary(service: dict) -> dict:
    sections = service.get("sections", {})
    return {
        "service_id": service.get("service_id"),
        "title": service.get("title"),
        "url": service.get("url"),
        "available_sections": sorted(sections.keys()),
        "description": short_text(service.get("description", ""), 220),
    }


def question_sample_label(question: dict) -> str:
    if question.get("sample_label"):
        return str(question["sample_label"])
    if question.get("generation_method"):
        return "LLM-generated question set"
    return "Controlled question set"


def question_with_source_preview(store: "PrototypeStore", question: dict) -> dict:
    service = store.services_by_id.get(str(question.get("service_id") or ""))
    sections = service.get("sections", {}) if service else {}
    target_section = str(question.get("target_section") or "")
    source_excerpt = ""
    if target_section == "description":
        source_excerpt = str((service or {}).get("description") or "")
    elif target_section:
        source_excerpt = str(sections.get(target_section) or "")
    if not source_excerpt and service:
        source_excerpt = str(service.get("description") or service.get("full_text") or "")

    return {
        **question,
        "sample_label": question_sample_label(question),
        "source_excerpt": short_text(source_excerpt, 900),
    }


def select_questions_for_developer_run(
    questions: list[dict],
    *,
    question_ids: list[str] | None = None,
    limit: int = 20,
    randomize: bool = False,
    random_seed: int | None = None,
) -> tuple[list[dict], dict]:
    if question_ids:
        questions_by_id = {str(question.get("question_id")): question for question in questions}
        selected: list[dict] = []
        seen_ids: set[str] = set()
        for question_id in question_ids:
            normalized_id = str(question_id).strip()
            if not normalized_id or normalized_id in seen_ids:
                continue
            question = questions_by_id.get(normalized_id)
            if not question:
                raise ValueError(f"Unknown question_id: {normalized_id}")
            selected.append(question)
            seen_ids.add(normalized_id)
        if not selected:
            raise ValueError("At least one question_id is required for a manual run.")
        return selected, {
            "sample_pool": "question_bank",
            "selected_question_ids": [str(question["question_id"]) for question in selected],
            "selection_method": "manual",
        }

    if randomize:
        pool = list(questions)
        rng = random.Random(random_seed)
        rng.shuffle(pool)
        selected = pool[:limit]
        return selected, {
            "sample_pool": "question_bank",
            "selected_question_ids": [str(question["question_id"]) for question in selected],
            "selection_limit": limit,
            "selection_method": "random",
        }

    selected = questions[:limit]
    return selected, {
        "sample_pool": "question_bank",
        "selected_question_ids": [str(question["question_id"]) for question in selected],
        "selection_limit": limit,
        "selection_method": "first_n",
    }


def selected_question_composition(questions: list[dict]) -> list[dict]:
    return [
        {
            "position": index,
            "question_id": str(question.get("question_id") or ""),
            "service_id": str(question.get("service_id") or ""),
            "service_title": str(question.get("service_title") or ""),
            "style_label": str(question.get("style_label") or ""),
            "target_section": str(question.get("target_section") or ""),
            "question_text": str(question.get("question_text") or ""),
        }
        for index, question in enumerate(questions, start=1)
    ]


def participant_id(index: int) -> str:
    return f"P{index + 1:02d}"


def reviewer_url(base_url: str, participant: str, batch_id: str = "", token: str = "") -> str:
    parsed = urlparse(base_url)
    query = parse_qs(parsed.query)
    query["role"] = ["review_batch"]
    query["participant"] = [participant]
    if batch_id:
        query["batch_id"] = [batch_id]
    if token:
        query["token"] = [token]
    return urlunparse(parsed._replace(path="/", query=urlencode(query, doseq=True)))


def reviewer_token_matches(expected: str, provided: str) -> bool:
    """Constant-time check of a reviewer token.

    Plans created before token protection have no stored token; those are
    treated as valid so existing local runs keep working.
    """
    expected = str(expected or "")
    provided = str(provided or "")
    if not expected:
        return True
    if not provided:
        return False
    return secrets.compare_digest(expected, provided)


def active_run_without_reviewer_tokens(active_run: dict) -> dict:
    """Return a copy of an active run with reviewer tokens removed.

    The reviewer assignment response must not leak other participants' tokens.
    """
    sanitized = json.loads(json.dumps(active_run, ensure_ascii=False))
    reviewer_plan = sanitized.get("metadata", {}).get("reviewer_plan")
    if isinstance(reviewer_plan, dict):
        for participant in reviewer_plan.get("participants", []):
            if isinstance(participant, dict):
                participant.pop("token", None)
                # review_url embeds the token, so it must not leak either.
                participant.pop("review_url", None)
    return sanitized


def build_reviewer_assignment_plan(
    *,
    traces: list[dict],
    reviewer_count: int,
    reviews_per_question: int,
    base_url: str,
    batch_id: str = "",
) -> dict:
    if reviewer_count < 1:
        raise ValueError("reviewer_count must be at least 1")
    if reviews_per_question < 1:
        raise ValueError("reviews_per_question must be at least 1")
    if reviewer_count < reviews_per_question:
        raise ValueError("reviewer_count must be greater than or equal to reviews_per_question")
    if not traces:
        raise ValueError("active run has no cases to assign")

    participants = []
    for index in range(reviewer_count):
        pid = participant_id(index)
        token = secrets.token_urlsafe(16)
        participants.append(
            {
                "participant_id": pid,
                "token": token,
                "assigned_trace_ids": [],
                "completed_reviews": 0,
                "review_url": reviewer_url(base_url, pid, batch_id, token),
            }
        )
    case_review_targets: dict[str, int] = {}
    assignment_index = 0
    for trace in traces:
        trace_id = trace["trace_id"]
        case_review_targets[trace_id] = reviews_per_question
        for _ in range(reviews_per_question):
            participants[assignment_index % len(participants)]["assigned_trace_ids"].append(
                trace_id,
            )
            assignment_index += 1

    assignments_per_reviewer = [
        len(participant["assigned_trace_ids"])
        for participant in participants
    ]
    min_assignments = min(assignments_per_reviewer)
    max_assignments = max(assignments_per_reviewer)
    total_assignments = len(traces) * reviews_per_question
    batch_size = (
        min_assignments
        if min_assignments == max_assignments
        else f"{min_assignments}-{max_assignments}"
    )
    return {
        "case_review_targets": case_review_targets,
        "batch_id": batch_id,
        "created_at": now_iso(),
        "participants": participants,
        "profile_fields": REVIEWER_PROFILE_FIELDS,
        "reviewer_count": reviewer_count,
        "reviews_per_question": reviews_per_question,
        "status": "active",
        "summary": f"{reviewer_count} reviewers · {total_assignments} assignments · {batch_size} cases each",
        "total_assignments": total_assignments,
    }


def trace_has_imported_human_label(trace: dict) -> bool:
    if trace.get("generated_answer", {}).get("generation_mode") != "imported_chatbot_answer":
        return False
    reviews = trace.get("human_reviews")
    if not isinstance(reviews, list):
        reviews = [trace.get("mock_human_review")] if trace.get("mock_human_review") else []
    return any(
        isinstance(review, dict)
        and (
            review.get("reviewer_role") == "imported_reference"
            or review.get("reviewer_id") == "imported_human_label"
        )
        for review in reviews
    )


def text_value(value: object) -> str:
    return value.strip() if isinstance(value, str) and value.strip() else ""


def excluded_reviewer_ids(reviewer_plan: object) -> set[str]:
    """Return the set of participant ids marked excluded in a reviewer plan.

    Reads both the convenience list ``reviewer_plan["excluded_reviewers"]`` and
    any per-participant ``excluded`` flag, so the two representations stay
    consistent even if one is written without the other.
    """
    excluded: set[str] = set()
    if not isinstance(reviewer_plan, dict):
        return excluded
    listed = reviewer_plan.get("excluded_reviewers")
    if isinstance(listed, list):
        for pid in listed:
            pid_str = str(pid).strip()
            if pid_str:
                excluded.add(pid_str)
    for participant in reviewer_plan.get("participants", []):
        if isinstance(participant, dict) and participant.get("excluded"):
            pid_str = str(participant.get("participant_id") or "").strip()
            if pid_str:
                excluded.add(pid_str)
    return excluded


def annotate_excluded_reviews(trace: dict, excluded: set[str]) -> dict:
    """Return a shallow copy of a trace whose human reviews carry an ``excluded`` flag.

    This is a read-time annotation applied at the API response boundary so the
    frontend can visually mark and filter excluded reviewers' reviews. It is
    never persisted (see ``_strip_review_annotations`` on the write path).
    """
    if not isinstance(trace, dict):
        return trace
    result = dict(trace)
    reviews = trace.get("human_reviews")
    if isinstance(reviews, list):
        result["human_reviews"] = [
            {**review, "excluded": str(review.get("reviewer_id") or "") in excluded}
            if isinstance(review, dict)
            else review
            for review in reviews
        ]
    mock = trace.get("mock_human_review")
    if isinstance(mock, dict):
        result["mock_human_review"] = {
            **mock,
            "excluded": str(mock.get("reviewer_id") or "") in excluded,
        }
    return result


def trace_human_reviews(trace: dict, excluded: set[str] | None = None) -> list[dict]:
    reviews = trace.get("human_reviews")
    if isinstance(reviews, list) and reviews:
        result = [review for review in reviews if isinstance(review, dict)]
    else:
        review = trace.get("mock_human_review")
        result = [review] if isinstance(review, dict) else []
    if excluded:
        result = [
            review
            for review in result
            if str(review.get("reviewer_id") or "") not in excluded
        ]
    return result


def trace_question(trace: dict) -> dict:
    question = trace.get("citizen_question")
    return question if isinstance(question, dict) else {}


def trace_automated(trace: dict) -> dict:
    automated = trace.get("automated_evaluation")
    return automated if isinstance(automated, dict) else {}


def trace_answer_text(trace: dict) -> str:
    generated = trace.get("generated_answer")
    if isinstance(generated, dict):
        return text_value(generated.get("answer_text"))
    return ""


def trace_retrieved_excerpt(trace: dict) -> str:
    retrievals = trace.get("retrieval_results")
    if isinstance(retrievals, list) and retrievals:
        chunks = [
            text_value(retrieval.get("chunk_text"))
            for retrieval in retrievals
            if isinstance(retrieval, dict)
        ]
        return "\n\n".join(chunk for chunk in chunks if chunk)
    retrieval = trace.get("retrieval_result")
    if isinstance(retrieval, dict):
        return text_value(retrieval.get("chunk_text"))
    return ""


WEB_URL_PATTERN = re.compile(r"^https?://", re.IGNORECASE)


def trace_source_url(trace: dict) -> str:
    """Return the openable web address of the source, or "" if there is none.

    Each candidate is validated individually: imported document cases put a
    plain file name into ``source_ref``, and a file name must never be handed
    to the dashboard as a link.
    """

    question = trace_question(trace)
    service = trace.get("service_entry") if isinstance(trace.get("service_entry"), dict) else {}
    retrieval = trace.get("retrieval_result") if isinstance(trace.get("retrieval_result"), dict) else {}
    candidates = [
        question.get("source_url"),
        service.get("source_url"),
        service.get("url"),
        retrieval.get("source_ref"),
    ]
    for candidate in candidates:
        value = text_value(candidate)
        if WEB_URL_PATTERN.match(value):
            return value
    return ""


def trace_source_reference(trace: dict) -> tuple[str, str]:
    """Return ``(kind, value)`` describing the audit evidence for the source.

    Audit evidence for the source can take two valid forms. Web-retrieved cases
    carry an official URL a reviewer can open. Cases imported as documents have
    no public URL by construction, but stay reconstructable when the document is
    identified by name AND its verbatim extracted text is stored in the trace.
    Both conditions are required: a file name without the retrieved text proves
    nothing. Anything else is a genuine evidence gap.

    Kept in sync with sourceReference() in
    frontend/src/components/audit/auditDashboardModel.ts.
    """

    url = trace_source_url(trace)
    if url:
        return "url", url
    document_name = trace_service_title(trace)
    if document_name and document_name != "-" and trace_retrieved_excerpt(trace):
        return "document", document_name
    return "none", ""


def trace_service_title(trace: dict) -> str:
    question = trace_question(trace)
    service = trace.get("service_entry") if isinstance(trace.get("service_entry"), dict) else {}
    retrieval = trace.get("retrieval_result") if isinstance(trace.get("retrieval_result"), dict) else {}
    return (
        text_value(question.get("service_title"))
        or text_value(service.get("title"))
        or text_value(retrieval.get("service_title"))
        or "-"
    )


def trace_service_id(trace: dict) -> str:
    question = trace_question(trace)
    service = trace.get("service_entry") if isinstance(trace.get("service_entry"), dict) else {}
    retrieval = trace.get("retrieval_result") if isinstance(trace.get("retrieval_result"), dict) else {}
    return (
        text_value(question.get("service_id"))
        or text_value(service.get("service_id"))
        or text_value(retrieval.get("service_id"))
        or "-"
    )


def trace_external_case_id(trace: dict) -> str:
    """Stable external case id for a trace, used to align repeat runs.

    Imported chatbot answers are keyed by the dataset's own case id, which is
    stored (with an ``imported_`` prefix) as the synthetic question id. Runs
    over the same imported dataset reuse the same case ids, so this is the join
    key for cross-run consistency. Falls back to the question id or trace id.
    """
    question = trace_question(trace)
    raw = str(
        trace.get("external_question_id")
        or question.get("question_id")
        or trace.get("trace_id")
        or ""
    )
    prefix = "imported_"
    if raw.startswith(prefix):
        raw = raw[len(prefix):]
    return raw


def trace_human_decisions(trace: dict, excluded: set[str] | None = None) -> list[str]:
    return [
        str(review.get("final_decision"))
        for review in trace_human_reviews(trace, excluded)
        if review.get("final_decision") in {"accept", "needs_edit", "reject"}
    ]


def trace_majority_human_decision(trace: dict, excluded: set[str] | None = None) -> str:
    decisions = trace_human_decisions(trace, excluded)
    if not decisions:
        return "pending"
    counts = Counter(decisions).most_common()
    # A tie means no settled human decision (mirrors the frontend's majorityValue).
    if len(counts) > 1 and counts[0][1] == counts[1][1]:
        return "pending"
    return counts[0][0]


def trace_has_human_disagreement(trace: dict, excluded: set[str] | None = None) -> bool:
    return len(set(trace_human_decisions(trace, excluded))) > 1


def derived_judge_final_decision(automated: dict) -> str:
    final_decision = automated.get("final_decision")
    if final_decision in JUDGE_FINAL_DECISIONS:
        return str(final_decision)
    if automated.get("label") == "unsupported":
        return "reject"
    if int(automated.get("judge_score") or 0) <= 2:
        return "reject"
    if automated.get("label") == "partly_supported":
        return "needs_edit"
    if int(automated.get("judge_score") or 0) == 3:
        return "needs_edit"
    return "accept"


def trace_ai_decision(trace: dict) -> str:
    return derived_judge_final_decision(trace_automated(trace))


def trace_has_ai_human_mismatch(trace: dict, excluded: set[str] | None = None) -> bool:
    human_decision = trace_majority_human_decision(trace, excluded)
    return human_decision != "pending" and human_decision != trace_ai_decision(trace)


def distribution_from_counter(counter: Counter) -> list[dict]:
    return [
        {"label": str(label), "count": count}
        for label, count in counter.most_common()
    ]


def criterion_score(evaluation: dict, key: str) -> int | None:
    criteria = evaluation.get("criteria")
    if not isinstance(criteria, dict):
        return None
    value = criteria.get(key)
    if isinstance(value, dict):
        score = value.get("score")
    else:
        score = value
    return int(score) if isinstance(score, int) else None


def average(values: list[int]) -> float | None:
    return round(sum(values) / len(values), 2) if values else None


def csv_text(rows: list[dict], fieldnames: list[str]) -> str:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return output.getvalue()
