from __future__ import annotations

try:
    from prototype.api_common import *
    from prototype.api_generation import *
except ModuleNotFoundError:
    from api_common import *
    from api_generation import *

def clamp_score(value: object, default: int = 3) -> int:
    try:
        score = int(value)
    except (TypeError, ValueError):
        return default
    return max(1, min(5, score))


def parse_json_object(text: str) -> dict:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            raise ValueError("OpenAI judge did not return a JSON object.")
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise ValueError("OpenAI judge did not return a valid JSON object.") from exc
    if not isinstance(parsed, dict):
        raise ValueError("OpenAI judge did not return a JSON object.")
    return parsed


def openai_reasoning_effort_for_model(model_name: str) -> str | None:
    normalized = model_name.lower().strip()
    if normalized.startswith("gpt-5") or normalized.startswith(("o1", "o3", "o4")):
        return "low"
    return None


def criterion_lookup_keys(key: str) -> tuple[str, ...]:
    return CRITERION_ALIASES.get(key, (key,))


def criterion_score_label(score: int) -> str:
    if score >= 4:
        return "positive"
    if score <= 2:
        return "problem"
    return "borderline"


def criterion_value(criteria: dict, key: str) -> object:
    for lookup_key in criterion_lookup_keys(key):
        if lookup_key in criteria:
            return criteria[lookup_key]
    return None


def validate_openai_judge_schema(parsed: dict) -> dict:
    scores = parsed.get("scores")
    if not isinstance(scores, dict):
        raise ValueError("OpenAI judge JSON must include a scores object.")

    missing_scores = [key for key in CANONICAL_EVALUATION_CRITERIA if key not in scores]
    if missing_scores:
        raise ValueError(f"OpenAI judge JSON is missing scores: {', '.join(missing_scores)}")

    unknown_scores = sorted(set(scores) - set(CANONICAL_EVALUATION_CRITERIA))
    if unknown_scores:
        raise ValueError(f"OpenAI judge JSON has unknown scores: {', '.join(unknown_scores)}")

    for key in CANONICAL_EVALUATION_CRITERIA:
        score = scores[key]
        if isinstance(score, bool) or not isinstance(score, int) or not 1 <= score <= 5:
            raise ValueError(f"OpenAI judge score for {key} must be an integer from 1 to 5.")

    answerability = parsed.get("answerability")
    if answerability not in ANSWERABILITY_VALUES:
        raise ValueError("OpenAI judge JSON has invalid answerability.")

    final_decision = parsed.get("final_decision")
    if final_decision not in JUDGE_FINAL_DECISIONS:
        raise ValueError("OpenAI judge JSON has invalid final_decision.")

    for field_name in (
        "contradicted_claims",
        "unsupported_claims",
        "missing_or_incomplete_points",
        "clarity_or_tone_problems",
        "context_limitations",
    ):
        if not isinstance(parsed.get(field_name), list):
            raise ValueError(f"OpenAI judge JSON field {field_name} must be a list.")

    if not isinstance(parsed.get("short_explanation"), str) or not parsed["short_explanation"].strip():
        raise ValueError("OpenAI judge JSON must include a non-empty short_explanation.")

    return scores


def validate_improvement_suggestions_schema(parsed: dict) -> list[dict]:
    """Validate + normalize the LLM improvement-suggestions JSON contract.

    Mirrors ``validate_openai_judge_schema``'s style (raise ``ValueError`` with
    a clear message on any contract violation) so callers can surface a single
    clear error instead of a stack trace.
    """
    suggestions = parsed.get("suggestions")
    if not isinstance(suggestions, list) or not suggestions:
        raise ValueError("Improvement suggestions JSON must include a non-empty suggestions list.")

    normalized: list[dict] = []
    for index, item in enumerate(suggestions):
        if not isinstance(item, dict):
            raise ValueError(f"Improvement suggestion at index {index} must be an object.")
        title = item.get("title")
        suggestion = item.get("suggestion")
        evidence_case_ids = item.get("evidence_case_ids")
        evidence_quotes = item.get("evidence_quotes")
        if not isinstance(title, str) or not title.strip():
            raise ValueError(f"Improvement suggestion at index {index} must include a non-empty title.")
        if not isinstance(suggestion, str) or not suggestion.strip():
            raise ValueError(f"Improvement suggestion at index {index} must include a non-empty suggestion.")
        if not isinstance(evidence_case_ids, list):
            raise ValueError(f"Improvement suggestion at index {index} field evidence_case_ids must be a list.")
        if not isinstance(evidence_quotes, list):
            raise ValueError(f"Improvement suggestion at index {index} field evidence_quotes must be a list.")
        normalized.append(
            {
                "title": title.strip(),
                "suggestion": suggestion.strip(),
                "evidence_case_ids": [str(case_id).strip() for case_id in evidence_case_ids if str(case_id).strip()],
                "evidence_quotes": [str(quote).strip() for quote in evidence_quotes if str(quote).strip()],
            }
        )
    return normalized


def list_field(payload: dict, field_name: str) -> list:
    value = payload.get(field_name)
    return value if isinstance(value, list) else []


def openai_criterion_result(criteria: dict, scores: dict, key: str, default_label: str) -> dict:
    value = criterion_value(criteria, key)
    if not isinstance(value, dict):
        value = {}
    score = clamp_score(value.get("score", criterion_value(scores, key)))
    label = str(value.get("label") or default_label)
    if label == default_label and scores:
        label = criterion_score_label(score)
    explanation = str(value.get("explanation") or "OpenAI judge evaluation.")
    return build_criterion_result(score, label, explanation)


def looks_like_retrieval_dump_answer(answer_text: str) -> bool:
    """Detect source-grounded but internal-looking answer formatting."""
    normalized = normalize_space(answer_text).lower()
    if not normalized:
        return False
    if "die frage enthält mehrere teile" in normalized and "laut der offiziellen quelle" in normalized:
        return True
    if "prüfen sie die jeweils verlinkte offizielle quellenseite" in normalized:
        return True
    return bool(re.search(r"\s-\s(?:forms|fees|required documents|processing time|online processing|requirements):", normalized))


def has_grounded_insufficient_context_gap(
    parsed: dict,
    scores: dict[str, int],
    missing_points: list,
    context_limitations: list,
) -> bool:
    answerability = parsed.get("answerability")
    return (
        answerability in {"partly_answerable", "not_answerable"}
        and scores["factual_correctness"] >= 4
        and scores["source_support"] >= 4
        and bool(missing_points)
        and bool(context_limitations)
    )


def normalize_openai_judge_decision(
    parsed: dict,
    normalized_criteria: dict,
    *,
    answer_text: str = "",
    is_external_answer: bool = False,
) -> tuple[str, list[str]]:
    """Apply deterministic middleware gates after the LLM judge fills the form."""
    raw_decision = str(parsed.get("final_decision") or "")
    final_decision = raw_decision if raw_decision in JUDGE_FINAL_DECISIONS else "needs_edit"
    scores = {
        key: clamp_score(normalized_criteria.get(key, {}).get("score"))
        for key in CANONICAL_EVALUATION_CRITERIA
    }
    low_criteria = [key for key, score in scores.items() if score <= 2]
    contradicted_claims = list_field(parsed, "contradicted_claims")
    unsupported_claims = list_field(parsed, "unsupported_claims")
    missing_points = list_field(parsed, "missing_or_incomplete_points")
    context_limitations = list_field(parsed, "context_limitations")
    clarity_or_tone_problems = list_field(parsed, "clarity_or_tone_problems")
    reasons: list[str] = []

    if contradicted_claims:
        final_decision = "reject"
        reasons.append("Rejected because the judge reported contradicted claims.")
    elif unsupported_claims and scores["factual_correctness"] <= 2 and scores["source_support"] <= 2:
        final_decision = "reject"
        reasons.append("Rejected because unsupported claims also received low factual/source scores.")
    elif scores["factual_correctness"] <= 2 and scores["source_support"] <= 2:
        final_decision = "needs_edit"
        reasons.append(
            "Changed low factual/source scores to needs_edit because no action-critical "
            "contradicted or unsupported claims were reported."
        )
    elif len(low_criteria) >= 4:
        final_decision = "needs_edit"
        reasons.append(
            "Changed low aggregate scores to needs_edit because no action-critical "
            "contradicted or unsupported claims were reported."
        )
    elif final_decision == "accept" and has_grounded_insufficient_context_gap(
        parsed,
        scores,
        missing_points,
        context_limitations,
    ):
        final_decision = "needs_edit"
        reasons.append(
            "Flagged grounded insufficient context: the answer is source-supported but leaves "
            "an action-critical part of the question unanswered because the retrieved context is incomplete."
        )
    elif final_decision == "accept" and (
        scores["completeness"] <= 3
        or scores["uncertainty_handling"] <= 3
    ):
        final_decision = "needs_edit"
        reasons.append("Changed accept to needs_edit because completeness or uncertainty handling still needs work.")
    elif final_decision == "accept" and (
        scores["clarity_actionability"] <= 3
        or scores["public_service_tone"] <= 3
    ):
        final_decision = "needs_edit"
        reasons.append("Changed accept to needs_edit because clarity or tone needs work.")
    elif (
        final_decision == "accept"
        and not is_external_answer
        and looks_like_retrieval_dump_answer(answer_text)
    ):
        # This heuristic targets the middleware's deterministic answer format;
        # do not apply it to imported/external answers from other systems.
        final_decision = "needs_edit"
        reasons.append("Changed accept to needs_edit because the answer has retrieval-style internal formatting.")
    elif final_decision == "needs_edit" and all(
        scores[key] >= 4
        for key in (
            "factual_correctness",
            "source_support",
            "completeness",
            "clarity_actionability",
            "public_service_tone",
            "uncertainty_handling",
        )
    ) and not (contradicted_claims or unsupported_claims or missing_points or clarity_or_tone_problems):
        final_decision = "accept"
        reasons.append("Changed needs_edit to accept because all criteria are high and no concrete problems were reported.")
    elif final_decision == "reject" and scores["factual_correctness"] >= 4 and scores["source_support"] >= 4:
        final_decision = "needs_edit"
        reasons.append("Changed reject to needs_edit because there is no factual/source-support risk.")

    return final_decision, reasons

def retrievals_for_question(
    store: PrototypeStore,
    primary_service: dict,
    question: dict,
    target_section: str | None,
) -> list[dict]:
    intents = question.get("intents") or [
        {
            "service_id": primary_service["service_id"],
            "target_section": target_section,
            "intent_role": "primary",
        }
    ]
    retrievals: list[dict] = []
    next_rank = 1
    for intent in intents:
        service = store.services_by_id.get(str(intent.get("service_id"))) or primary_service
        section_name, context = retrieve_context(service, intent.get("target_section") or target_section)
        intent_role = str(intent.get("intent_role") or f"intent_{next_rank}")
        primary_retrieval = retrieval_with_service_metadata(
            {
                "retrieval_id": "",
                "trace_id": "",
                "service_id": service["service_id"],
                "service_title": service["title"],
                "section_name": section_name,
                "chunk_text": context,
                "rank": next_rank,
                "retrieval_score": 1.0,
                "source_ref": service["url"],
                "intent_role": intent_role,
            },
            service,
        )
        retrievals.append(primary_retrieval)
        next_rank += 1

        added_context_sections: set[str] = set()
        targeted_sections = TARGETED_CONTEXT_EXPANSION_SECTIONS.get(section_name, ())
        if targeted_sections:
            additional_retrievals = build_service_context_retrievals(
                service,
                primary_section=section_name,
                primary_intent_role=intent_role,
                start_rank=next_rank,
                section_names=targeted_sections,
            )
            retrievals.extend(additional_retrievals)
            added_context_sections.update(
                str(retrieval.get("section_name") or "") for retrieval in additional_retrievals
            )
            next_rank += len(additional_retrievals)

        if is_thin_context(context):
            additional_retrievals = build_service_context_retrievals(
                service,
                primary_section=section_name,
                primary_intent_role=intent_role,
                start_rank=next_rank,
                exclude_sections=added_context_sections,
            )
            retrievals.extend(additional_retrievals)
            next_rank += len(additional_retrievals)
    return retrievals


def score_label(score: int, positive_label: str, medium_label: str, negative_label: str) -> str:
    if score >= 4:
        return positive_label
    if score == 3:
        return medium_label
    return negative_label


def build_criterion_result(score: int, label: str, explanation: str) -> dict:
    return {
        "score": score,
        "label": label,
        "explanation": explanation,
    }


def build_rule_based_criteria(
    *,
    answer_text: str,
    faithfulness: float,
    relevance: float,
    requires_clarification: bool,
) -> dict:
    source_score = 5 if faithfulness >= 0.75 else 3 if faithfulness >= 0.45 else 1
    relevance_score = 5 if relevance >= 0.8 else 3 if relevance >= 0.45 else 2
    answer_is_present = bool(answer_text.strip())
    asks_question = "?" in answer_text or "bitte prüfen" in answer_text.lower()
    clarification_score = 2 if requires_clarification and not asks_question else 5
    tone_score = 5 if answer_is_present else 1

    return {
        "factual_correctness": build_criterion_result(
            source_score,
            score_label(source_score, "likely_correct", "partly_checkable", "not_verifiable"),
            (
                "Offline baseline: factual correctness is approximated through lexical overlap "
                "with the retrieved official source; this is not independent fact verification."
            ),
        ),
        "source_support": build_criterion_result(
            source_score,
            score_label(source_score, "supported", "partly_supported", "unsupported"),
            (
                "Offline baseline: source support is estimated from lexical overlap "
                "between the answer and retrieved source excerpt."
            ),
        ),
        "completeness": build_criterion_result(
            relevance_score,
            score_label(relevance_score, "complete", "partly_complete", "incomplete"),
            (
                "Offline baseline: completeness is approximated from lexical overlap with "
                "the citizen question and retrieved context."
            ),
        ),
        "uncertainty_handling": build_criterion_result(
            clarification_score,
            score_label(
                clarification_score,
                "handles_uncertainty",
                "borderline",
                "overconfident_or_missing_clarification",
            ),
            (
                "Offline baseline: ambiguous or underspecified questions are expected "
                "to receive a clarification-aware answer."
            ),
        ),
        "clarity_actionability": build_criterion_result(
            relevance_score,
            score_label(relevance_score, "clear_actionable", "partly_clear", "unclear"),
            (
                "Offline baseline: clarity and actionability are approximated from "
                "question relevance and are not assessed linguistically."
            ),
        ),
        "public_service_tone": build_criterion_result(
            tone_score,
            score_label(tone_score, "appropriate", "borderline", "inappropriate"),
            (
                "Offline baseline: the deterministic evaluator does not "
                "perform nuanced tone assessment."
            ),
        ),
    }


def evaluate_answer(
    question_text: str,
    answer_text: str,
    context: str,
    *,
    requires_clarification: bool = False,
) -> dict:
    context_tokens = tokenize(context)
    answer_tokens = tokenize(answer_text)
    question_tokens = tokenize(question_text)

    if not context_tokens:
        faithfulness = 0.0
    else:
        faithfulness = len(context_tokens & answer_tokens) / max(len(answer_tokens), 1)
        faithfulness = max(0.0, min(1.0, faithfulness * 2.5))

    if not question_tokens:
        relevance = 0.7 if answer_tokens else 0.0
    else:
        relevance = len(question_tokens & (answer_tokens | context_tokens)) / len(question_tokens)
        relevance = max(0.0, min(1.0, relevance))

    label = "supported" if faithfulness >= 0.55 else "unsupported"
    deterministic_answer_prefixes = (
        "Laut der offiziellen Quelle",
        "In der bereitgestellten offiziellen Quelle",
    )
    if label == "supported" and answer_text.startswith(deterministic_answer_prefixes):
        relevance = max(relevance, 0.85)
    judge_score = 5 if label == "supported" and relevance >= 0.6 else 2

    return {
        "faithfulness_score": round(faithfulness, 3),
        "relevance_score": round(relevance, 3),
        "judge_score": judge_score,
        "label": label,
        "criteria": build_rule_based_criteria(
            answer_text=answer_text,
            faithfulness=faithfulness,
            relevance=relevance,
            requires_clarification=requires_clarification,
        ),
        "evaluation_mode": "rule_based_baseline",
        "judge_schema_version": JUDGE_SCHEMA_VERSION,
        "explanation": (
            "Deterministic offline baseline using lexical overlap with the retrieved source "
            "section. It is intended for local workflow demonstrations, not as a substitute "
            "for model-based or human evaluation."
        ),
        "evaluated_at": now_iso(),
    }


def retrievals_by_section(retrievals: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for retrieval in retrievals:
        grouped.setdefault(str(retrieval.get("section_name") or ""), []).append(retrieval)
    return grouped


def first_retrieval_for_section(retrievals: list[dict], section_name: str) -> dict | None:
    for retrieval in retrievals:
        if retrieval.get("section_name") == section_name:
            return retrieval
    return None


def source_lines(text: str, limit: int = 5) -> list[str]:
    lines: list[str] = []
    for raw_line in text.splitlines():
        line = normalize_space(raw_line)
        if line:
            lines.append(line)
        if len(lines) >= limit:
            break
    if lines:
        return lines
    fallback = answer_excerpt(text, max_chars=520)
    return [fallback] if fallback else []


def source_bullets(text: str, limit: int = 5) -> str:
    return "\n".join(f"- {line}" for line in source_lines(text, limit=limit))


def section_answer_block(retrieval: dict, *, limit: int = 4) -> str:
    section_name = str(retrieval.get("section_name") or "")
    section_label = GERMAN_SECTION_LABELS.get(section_name, SECTION_LABELS.get(section_name, section_name or "Quelle"))
    bullets = source_bullets(str(retrieval.get("chunk_text") or ""), limit=limit)
    return f"{section_label}:\n{bullets}".strip()


def first_service_title(retrievals: list[dict], question: dict) -> str:
    if retrievals:
        title = str(retrievals[0].get("service_title") or "").strip()
        if title:
            return title
    return str(question.get("service_title") or "diese Dienstleistung")


def calibration_answer_text(
    *,
    answer_kind: str,
    question: dict,
    retrievals: list[dict],
) -> str:
    grouped_retrievals = retrievals_by_section(retrievals)
    chunks_by_section = {
        section_name: "\n".join(str(retrieval.get("chunk_text") or "") for retrieval in section_retrievals)
        for section_name, section_retrievals in grouped_retrievals.items()
    }
    service_title = first_service_title(retrievals, question)
    if answer_kind == "good":
        first = retrievals[0] if retrievals else {}
        section_name = str(first.get("section_name") or "")
        if section_name == "fees":
            return (
                f"Laut der offiziellen Quelle kostet {service_title}:\n"
                f"{source_bullets(str(first.get('chunk_text') or ''), limit=4)}"
            )
        if section_name == "processing_time":
            return (
                f"Laut der offiziellen Quelle gilt für {service_title} folgende Bearbeitungszeit:\n"
                f"{source_bullets(str(first.get('chunk_text') or ''), limit=3)}"
            )
        return (
            f"Laut der offiziellen Quelle steht zu {service_title}:\n"
            f"{section_answer_block(first, limit=5)}"
        )
    if answer_kind == "good_multi_citizen":
        blocks = [section_answer_block(retrieval, limit=6) for retrieval in retrievals[:4]]
        return (
            f"Für {service_title} lassen sich die offiziellen Angaben so gliedern:\n\n"
            + "\n\n".join(block for block in blocks if block)
            + "\n\nBitte nutzen Sie für die Antragstellung die jeweils genannte offizielle Form bzw. den offiziellen Online-Dienst."
        ).strip()
    if answer_kind == "good_no_fee":
        fee_retrieval = first_retrieval_for_section(retrievals, "fees") or (retrievals[0] if retrievals else {})
        fee_text = normalize_space(str(fee_retrieval.get("chunk_text") or ""))
        if fee_text.lower() in {"keine", "keine angaben"}:
            return f"Laut der offiziellen Quelle fallen für {service_title} keine Gebühren an."
        return (
            f"Laut der offiziellen Quelle werden für {service_title} folgende Gebühren genannt:\n"
            f"{source_bullets(str(fee_retrieval.get('chunk_text') or ''), limit=4)}"
        )
    if answer_kind == "good_processing_time":
        processing_retrieval = first_retrieval_for_section(retrievals, "processing_time") or (retrievals[0] if retrievals else {})
        return (
            f"Laut der offiziellen Quelle gilt für {service_title} folgende Bearbeitungszeit:\n"
            f"{source_bullets(str(processing_retrieval.get('chunk_text') or ''), limit=3)}"
        )
    if answer_kind == "unsupported_fee":
        return (
            "Die Dienstleistung kostet in der Regel 35 Euro. "
            "Sie können die Gebühr direkt online bezahlen."
        )
    if answer_kind == "unsupported_eligibility":
        return (
            "Sie erfüllen die Voraussetzungen automatisch, wenn Sie den Antrag stellen. "
            "Eine weitere Prüfung ist laut der offiziellen Quelle nicht erforderlich."
        )
    if answer_kind == "invented_online_option":
        return (
            "Sie können die Tageszulassung online ohne BundID, ohne aktivierte eID und ohne Sicherheitscodes "
            "der Zulassungsbescheinigung Teil II beantragen."
        )
    if answer_kind == "wrong_responsible_office":
        return (
            "Zuständig ist jedes Bürgeramt. Sie können einfach zu einem Bürgeramt in Ihrer Nähe gehen."
        )
    if answer_kind == "incomplete_documents":
        return (
            "Sie brauchen dafür nur einen gültigen Personalausweis. "
            "Weitere Unterlagen sind normalerweise nicht nötig."
        )
    if answer_kind == "overconfident_processing_time":
        return (
            "Die Bearbeitung dauert garantiert zwei Werktage. "
            "Wenn Sie heute beantragen, ist der Vorgang spätestens übermorgen abgeschlossen."
        )
    if answer_kind == "bad_tone":
        return (
            "Das steht doch auf der Webseite. Lesen Sie die Formulare selbst und kommen Sie "
            "nicht ohne Vorbereitung zum Amt."
        )
    if answer_kind == "bureaucratic_answer":
        requirements = normalize_space(answer_excerpt(chunks_by_section.get("requirements", ""), max_chars=420))
        return (
            "Im Hinblick auf die verfahrensgegenständliche Angelegenheit ist seitens der "
            "antragstellenden Person zu konstatieren, dass die Erfüllung der einschlägigen "
            "Tatbestandsvoraussetzungen unter Beachtung der verwaltungsverfahrensrechtlichen "
            "Mitwirkungspflichten eigenverantwortlich und unter Würdigung sämtlicher im "
            "Sachzusammenhang benannter Gesichtspunkte sicherzustellen ist, wobei sich die "
            "diesbezüglich maßgeblichen Anforderungen aus den nachfolgend in nicht weiter "
            f"aufbereiteter Form wiedergegebenen Kontextangaben ergeben ({requirements}), deren "
            "abschließende Subsumtion und verfahrensmäßige Berücksichtigung der antragstellenden "
            "Person obliegt."
        )
    if answer_kind == "overconfident_ambiguous":
        return (
            "Ja, beides geht online. Sie können den Zuschuss beantragen und Ihr Fahrzeug anmelden, "
            "ohne dass weitere Voraussetzungen gelten."
        )
    if answer_kind == "raw_multi_retrieval":
        dump_lines = []
        for retrieval in retrievals[:4]:
            section_name = str(retrieval.get("section_name") or "")
            chunk = normalize_space(str(retrieval.get("chunk_text") or ""))[:280]
            dump_lines.append(
                f"[section={section_name} | rank={retrieval.get('rank')} | "
                f"score={retrieval.get('retrieval_score')} | service_id={retrieval.get('service_id')}] {chunk}"
            )
        return "RETRIEVAL_RESULTS:\n" + "\n".join(dump_lines)
    if answer_kind == "partial_documents_soft":
        documents = first_retrieval_for_section(retrievals, "required_documents") or (retrievals[0] if retrievals else {})
        return (
            f"Für {service_title} nennt die offizielle Quelle unter anderem:\n"
            f"{source_bullets(str(documents.get('chunk_text') or ''), limit=3)}\n\n"
            "Das sind wichtige Beispiele, aber die Antwort ist noch nicht vollständig genug für die ganze Unterlagenliste."
        )
    if answer_kind == "partial_multi_intent":
        first = retrievals[0] if retrievals else {}
        section_name = str(first.get("section_name") or "")
        section_label = GERMAN_SECTION_LABELS.get(section_name, SECTION_LABELS.get(section_name, section_name))
        return (
            f"Diese Antwort deckt bisher nur den Punkt {section_label} ab:\n"
            f"{source_bullets(str(first.get('chunk_text') or ''), limit=3)}\n\n"
            "Die ebenfalls gefragten Unterlagen und die Bearbeitungszeit fehlen in dieser Antwort noch."
        )
    return generate_answer_from_retrievals(question, retrievals)


# derived_judge_final_decision moved to api_common.py so that
# trace_ai_decision / trace_has_ai_human_mismatch resolve it in their
# defining module; it stays visible here via `from api_common import *`.


def judge_evaluation_history_with_rerun(trace: dict, rerun: dict) -> list[dict]:
    history = trace.get("judge_evaluations")
    if not isinstance(history, list) or not history:
        baseline = json.loads(json.dumps(trace.get("automated_evaluation", {}), ensure_ascii=False))
        baseline["evaluation_role"] = baseline.get("evaluation_role") or "baseline"
        history = [baseline] if baseline else []
    else:
        history = [
            item
            for item in history
            if isinstance(item, dict)
        ]

    return [
        *history,
        json.loads(json.dumps(rerun, ensure_ascii=False)),
    ]


def criterion_expectation_label(key: str, max_score: int) -> str:
    return f"{key} <= {max_score}"


def calibration_expected_criteria_max(calibration: dict) -> dict[str, int]:
    maxima: dict[str, int] = {}
    for item in calibration.get("expected_low_criteria", []):
        key = str(item)
        if key in CANONICAL_EVALUATION_CRITERIA:
            maxima[key] = 2
    explicit = calibration.get("expected_criteria_max")
    if isinstance(explicit, dict):
        for key, value in explicit.items():
            criterion_key = str(key)
            if criterion_key not in CANONICAL_EVALUATION_CRITERIA:
                continue
            try:
                max_score = int(value)
            except (TypeError, ValueError):
                continue
            maxima[criterion_key] = max(1, min(5, max_score))
    return maxima


def missed_calibration_criteria(automated: dict, expected_criteria_max: dict[str, int]) -> list[str]:
    criteria = automated.get("criteria")
    if not isinstance(criteria, dict):
        criteria = {}
    missed: list[str] = []
    for key, max_score in expected_criteria_max.items():
        criterion = None
        for lookup_key in criterion_lookup_keys(key):
            if lookup_key in criteria:
                criterion = criteria[lookup_key]
                break
        score = criterion.get("score") if isinstance(criterion, dict) else None
        if not isinstance(score, int) or score > max_score:
            missed.append(key)
    return missed


def calibration_result(trace: dict, calibration: dict) -> dict:
    automated = trace.get("automated_evaluation", {})
    expected_decision = calibration.get("expected_final_decision")
    expected_low_criteria = [
        str(item)
        for item in calibration.get("expected_low_criteria", [])
        if str(item) in CANONICAL_EVALUATION_CRITERIA
    ]
    expected_criteria_max = calibration_expected_criteria_max(calibration)
    actual_decision = derived_judge_final_decision(automated)
    missed = missed_calibration_criteria(automated, expected_criteria_max)
    failure_reasons: list[str] = []
    if actual_decision != expected_decision:
        failure_reasons.append(f"expected {expected_decision}, judge returned {actual_decision}")
    if missed:
        missed_labels = [
            criterion_expectation_label(key, expected_criteria_max[key])
            for key in missed
            if key in expected_criteria_max
        ]
        failure_reasons.append(f"did not meet expected criterion scores: {', '.join(missed_labels)}")
    passed = not failure_reasons
    return {
        **calibration,
        "actual_final_decision": actual_decision,
        "expected_criteria_max": expected_criteria_max,
        "expected_low_criteria": expected_low_criteria,
        "failure_reasons": failure_reasons,
        "missed_criteria": missed,
        "status": "passed" if passed else "failed",
    }


def build_calibration_summary(traces: list[dict]) -> dict:
    passed = [
        trace
        for trace in traces
        if trace.get("calibration", {}).get("status") == "passed"
    ]
    failed_count = len(traces) - len(passed)
    false_accept_count = 0
    false_reject_count = 0
    for trace in traces:
        calibration = trace.get("calibration", {})
        expected = calibration.get("expected_final_decision")
        actual = calibration.get("actual_final_decision")
        if expected != "accept" and actual == "accept":
            false_accept_count += 1
        if expected == "accept" and actual == "reject":
            false_reject_count += 1
    return {
        "cards": [
            {"label": "Seeded cases", "value": str(len(traces))},
            {"label": "Calibration pass rate", "value": f"{len(passed)}/{len(traces)}"},
            {"label": "Failed calibration cases", "value": str(failed_count)},
            {"label": "False accepts", "value": str(false_accept_count)},
            {"label": "False rejects", "value": str(false_reject_count)},
        ],
        "failed_count": failed_count,
        "false_accept_count": false_accept_count,
        "false_reject_count": false_reject_count,
        "passed_count": len(passed),
        "total_count": len(traces),
    }


def normalize_rating(value: object, field_name: str, default: int = 3) -> int:
    if value in (None, ""):
        return default
    rating = int(value)
    if rating < 1 or rating > 5:
        raise ValueError(f"{field_name} must be between 1 and 5")
    return rating


def normalize_optional_rating(value: object, field_name: str) -> int | None:
    if value in (None, ""):
        return None
    return normalize_rating(value, field_name)


def make_disagreement(trace_id: str, automated: dict, review: dict | None) -> dict | None:
    if not review:
        return None
    judge_decision = derived_judge_final_decision(automated)
    human_decision = review.get("final_decision")
    judge_label = automated.get("label")
    human_label = review.get("label")
    decision_mismatch = bool(human_decision and judge_decision != human_decision)
    source_mismatch = bool(
        human_label
        and human_label != "not_checked"
        and judge_label != human_label
    )
    if not decision_mismatch and not source_mismatch:
        return None

    if decision_mismatch and source_mismatch:
        disagreement_type = "automated_human_decision_and_source_mismatch"
        reason = "AI judge and human review differ on both usability decision and source-support check."
    elif decision_mismatch:
        disagreement_type = "automated_human_final_decision_mismatch"
        reason = "AI judge final decision differs from the mandatory human usability decision."
    else:
        disagreement_type = "automated_human_source_support_mismatch"
        reason = "AI judge source-support label differs from the human source concern."

    severe_decision_gap = {judge_decision, human_decision} == {"accept", "reject"}
    severity = "high" if severe_decision_gap or source_mismatch else "medium"
    if (
        automated.get("judge_score", 0) <= 2
        and review.get("human_score", 0) <= 2
        and not severe_decision_gap
    ):
        severity = "medium"
    return {
        "disagreement_id": f"dis_{trace_id}",
        "trace_id": trace_id,
        "disagreement_type": disagreement_type,
        "severity": severity,
        "flag_reason": reason,
        "created_at": now_iso(),
    }


def review_identity(review: dict) -> str:
    return str(
        review.get("reviewer_id")
        or review.get("reviewer_role")
        or review.get("review_id")
        or "reviewer"
    )


def apply_human_review_to_trace(trace: dict, review: dict) -> None:
    reviews = trace.get("human_reviews")
    if not isinstance(reviews, list):
        reviews = []
        existing_review = trace.get("mock_human_review")
        if isinstance(existing_review, dict):
            reviews.append(existing_review)

    next_identity = review_identity(review)
    for index, existing_review in enumerate(reviews):
        if review_identity(existing_review) == next_identity:
            reviews[index] = review
            break
    else:
        reviews.append(review)

    trace["human_reviews"] = reviews
    trace["mock_human_review"] = review

    automated = trace.get("automated_evaluation", {})
    trace["disagreement_case"] = next(
        (
            disagreement
            for disagreement in (
                make_disagreement(trace.get("trace_id", ""), automated, item)
                for item in reviews
            )
            if disagreement
        ),
        None,
    )
