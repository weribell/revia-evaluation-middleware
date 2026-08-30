#!/usr/bin/env python3
"""Rule-based improvement suggestions derived from judge and human review data.

Stdlib only, pure function over already-loaded trace dicts - no LLM calls and
no dependency on ``api_store``/``api_common`` so this stays testable in
isolation, matching the style of ``prototype/agreement_metrics.py``. The
store (``prototype/api_store.py``) resolves the active batch, loads its
traces, and calls ``build_improvement_suggestions``; this module only turns
already-collected AI-judge criterion scores and human review signals into
concrete, evidence-backed suggestions for whoever owns the evaluated chatbot.

The criterion constants and case-id derivation intentionally mirror
``CANONICAL_EVALUATION_CRITERIA`` / ``CRITERION_ALIASES`` / the
``trace_external_case_id`` helper in ``prototype/api_common.py`` rather than
importing them, so this module has no cross-file dependency.
"""

from __future__ import annotations

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

CRITERION_TITLES = {
    "factual_correctness": "Fix factual correctness",
    "source_support": "Tighten source support",
    "completeness": "Close completeness gaps",
    "clarity_actionability": "Improve clarity and actionability",
    "public_service_tone": "Adjust tone",
    "uncertainty_handling": "Handle uncertainty more explicitly",
}

CRITERION_EVIDENCE_FIELDS = {
    "factual_correctness": ("contradicted_claims", "unsupported_claims"),
    "source_support": ("unsupported_claims", "contradicted_claims"),
    "completeness": ("missing_or_incomplete_points",),
    "clarity_actionability": ("clarity_or_tone_problems",),
    "public_service_tone": ("clarity_or_tone_problems",),
    "uncertainty_handling": ("context_limitations",),
}

NON_ACTIONABLE_NOTE_PREFIXES = ("OpenAI judge evaluation", "Offline baseline", "Rule-based baseline")

CRITERION_SUGGESTIONS = {
    "factual_correctness": (
        "Correct factual claims that contradict the source; prefer 'not stated in "
        "the document' over guessing."
    ),
    "source_support": (
        "Only make claims that appear in the source document and cite where they "
        "come from."
    ),
    "completeness": (
        "Add the required steps, documents, costs, or deadlines the reviewers found "
        "missing."
    ),
    "clarity_actionability": (
        "Shorten answers and state the concrete next step first; long correct "
        "answers still fail reviewers."
    ),
    "public_service_tone": (
        "Adjust tone and style conventions (greetings, emojis, promotional endings) "
        "to the audience's expectations."
    ),
    "uncertainty_handling": (
        "State uncertainty explicitly instead of inventing precise numbers or "
        "deadlines."
    ),
}

ADJUDICATION_REVIEWER_ID = "ADJ01"
JUDGE_FINAL_DECISIONS = {"accept", "needs_edit", "reject"}
MAX_EXAMPLE_CASES = 3
MAX_COMMENT_EXAMPLES = 3
EXPLANATION_SNIPPET_MAX_CHARS = 160
COMMENT_SNIPPET_MAX_CHARS = 200
MIN_HIGH_SEVERITY_CASES = 2
HIGH_SEVERITY_SHARE = 0.3
MIN_HIGH_SEVERITY_TOTAL_CASES = 8
MIN_COMMENTS_FOR_FEEDBACK_CARD = 2


def _snippet(text: object, max_chars: int) -> str:
    normalized = " ".join(str(text or "").split())
    if len(normalized) <= max_chars:
        return normalized
    return normalized[:max_chars].rsplit(" ", 1)[0] + "..."


def _is_non_actionable_note(text: str) -> bool:
    return text.startswith(NON_ACTIONABLE_NOTE_PREFIXES)


def _example_note(evaluation: dict, criterion: dict | None, key: str) -> str:
    for field in CRITERION_EVIDENCE_FIELDS.get(key, ()):
        values = evaluation.get(field)
        if isinstance(values, list):
            for value in values:
                text = str(value or "").strip()
                if text:
                    return text
    if isinstance(criterion, dict):
        text = str(criterion.get("explanation") or criterion.get("short_explanation") or "").strip()
        if text and not _is_non_actionable_note(text):
            return text
    text = str(evaluation.get("short_explanation") or evaluation.get("explanation") or "").strip()
    if text and not _is_non_actionable_note(text):
        return text
    return ""


def _criterion_lookup_keys(key: str) -> tuple[str, ...]:
    return CRITERION_ALIASES.get(key, (key,))


def _criterion_entry(criteria: object, key: str) -> dict | None:
    if not isinstance(criteria, dict):
        return None
    for lookup_key in _criterion_lookup_keys(key):
        value = criteria.get(lookup_key)
        if isinstance(value, dict):
            return value
    return None


def _latest_evaluation(trace: dict) -> dict:
    history = trace.get("judge_evaluations")
    if isinstance(history, list):
        for item in reversed(history):
            if isinstance(item, dict):
                return item
    automated = trace.get("automated_evaluation")
    return automated if isinstance(automated, dict) else {}


def _case_id(trace: dict) -> str:
    question = trace.get("citizen_question")
    question = question if isinstance(question, dict) else {}
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


def _is_adjudication_review(review: dict) -> bool:
    return bool(review.get("is_adjudication")) or str(review.get("reviewer_id") or "") == ADJUDICATION_REVIEWER_ID


def _non_adjudication_reviews(trace: dict) -> list[dict]:
    reviews = trace.get("human_reviews")
    if not isinstance(reviews, list) or not reviews:
        legacy = trace.get("mock_human_review")
        reviews = [legacy] if isinstance(legacy, dict) else []
    return [
        review
        for review in reviews
        if isinstance(review, dict) and not _is_adjudication_review(review)
    ]


def _decision_distribution(traces: list[dict]) -> dict[str, int]:
    counts = {decision: 0 for decision in JUDGE_FINAL_DECISIONS}
    for trace in traces:
        for review in _non_adjudication_reviews(trace):
            decision = review.get("final_decision")
            if decision in counts:
                counts[decision] += 1
    return counts


def _criterion_signals(traces: list[dict], key: str) -> dict:
    affected_cases = 0
    borderline_cases = 0
    human_review_signals = 0
    example_cases: list[dict] = []
    seen_case_ids: set[str] = set()

    for trace in traces:
        evaluation = _latest_evaluation(trace)
        criterion = _criterion_entry(evaluation.get("criteria"), key)
        score = criterion.get("score") if isinstance(criterion, dict) else None
        is_problem = isinstance(score, int) and score <= 2
        is_borderline = isinstance(score, int) and score == 3
        if is_problem:
            affected_cases += 1
        elif is_borderline:
            borderline_cases += 1

        case_flagged_by_human = False
        for review in _non_adjudication_reviews(trace):
            review_criteria = review.get("criteria")
            review_score = None
            if isinstance(review_criteria, dict):
                for lookup_key in _criterion_lookup_keys(key):
                    if isinstance(review_criteria.get(lookup_key), int):
                        review_score = review_criteria[lookup_key]
                        break
            if isinstance(review_score, int) and review_score <= 2:
                human_review_signals += 1
                case_flagged_by_human = True

        if (is_problem or is_borderline or case_flagged_by_human) and len(example_cases) < MAX_EXAMPLE_CASES:
            case_id = _case_id(trace)
            if case_id not in seen_case_ids:
                seen_case_ids.add(case_id)
                note = _example_note(evaluation, criterion, key)
                example_cases.append({"case_id": case_id, "note": _snippet(note, EXPLANATION_SNIPPET_MAX_CHARS)})

    return {
        "affected_cases": affected_cases,
        "borderline_cases": borderline_cases,
        "human_review_signals": human_review_signals,
        "example_cases": example_cases,
    }


def _criterion_card(key: str, signals: dict, total_cases: int) -> dict | None:
    if not (signals["affected_cases"] or signals["borderline_cases"] or signals["human_review_signals"]):
        return None

    borderline_only = not signals["affected_cases"] and not signals["human_review_signals"]
    if borderline_only:
        borderline_relevance_threshold = max(2, (total_cases + 1) // 2)
        if signals["borderline_cases"] < borderline_relevance_threshold:
            return None

    threshold = max(MIN_HIGH_SEVERITY_CASES, HIGH_SEVERITY_SHARE * total_cases)
    if borderline_only:
        severity = "watch"
    elif total_cases >= MIN_HIGH_SEVERITY_TOTAL_CASES and signals["affected_cases"] >= threshold:
        severity = "high"
    else:
        severity = "medium"

    judge_flagged = bool(signals["affected_cases"] or signals["borderline_cases"])
    human_flagged = bool(signals["human_review_signals"])
    if judge_flagged and human_flagged:
        source = "both"
    elif human_flagged:
        source = "human_review"
    else:
        source = "ai_judge"

    return {
        "id": f"criterion_{key}",
        "title": CRITERION_TITLES[key],
        "suggestion": CRITERION_SUGGESTIONS[key],
        "severity": severity,
        "source": source,
        "evidence": {
            "affected_cases": signals["affected_cases"],
            "borderline_cases": signals["borderline_cases"],
            "total_cases": total_cases,
            "human_review_signals": signals["human_review_signals"],
            "example_cases": signals["example_cases"],
        },
    }


def _reviewer_feedback_card(traces: list[dict], total_cases: int) -> dict | None:
    comments: list[dict] = []
    for trace in traces:
        case_id = _case_id(trace)
        for review in _non_adjudication_reviews(trace):
            decision = review.get("final_decision")
            comment_text = str(review.get("comment_text") or "").strip()
            if decision in {"needs_edit", "reject"} and comment_text:
                comments.append({"case_id": case_id, "note": _snippet(comment_text, COMMENT_SNIPPET_MAX_CHARS)})

    if len(comments) < MIN_COMMENTS_FOR_FEEDBACK_CARD:
        return None

    return {
        "id": "reviewer_feedback",
        "title": "Original reviewer comments",
        "suggestion": (
            "Verbatim comments from needs-edit and reject reviews; they may point to "
            "issues the scored criteria do not capture."
        ),
        "severity": "medium",
        "source": "human_review",
        "evidence": {
            "affected_cases": len({comment["case_id"] for comment in comments}),
            "borderline_cases": 0,
            "total_cases": total_cases,
            "human_review_signals": len(comments),
            "example_cases": comments[:MAX_COMMENT_EXAMPLES],
        },
    }


def build_improvement_suggestions(traces: list[dict]) -> dict:
    """Turn a batch's collected judge + human review data into suggestion cards.

    Pure aggregation, no LLM calls: works for any batch of traces, not a
    specific study. Returns ``case_count``, the human decision distribution,
    and a list of evidence-backed ``cards`` (skipping criteria with no
    problem/borderline/human signal at all).
    """
    total_cases = len(traces)
    cards: list[dict] = []

    for key in CANONICAL_EVALUATION_CRITERIA:
        signals = _criterion_signals(traces, key)
        card = _criterion_card(key, signals, total_cases)
        if card:
            cards.append(card)

    feedback_card = _reviewer_feedback_card(traces, total_cases)
    if feedback_card:
        cards.append(feedback_card)

    return {
        "case_count": total_cases,
        "decision_distribution": _decision_distribution(traces),
        "cards": cards,
    }
