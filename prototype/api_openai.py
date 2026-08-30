from __future__ import annotations

try:
    from prototype.api_common import *
    from prototype.api_generation import *
    from prototype.api_evaluation import *
except ModuleNotFoundError:
    from api_common import *
    from api_generation import *
    from api_evaluation import *

def is_openai_model(model_name: str) -> bool:
    return bool(model_name and model_name != "no_llm_baseline")


def response_text_from_openai_payload(payload: dict) -> str:
    output_text = payload.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    parts: list[str] = []
    for item in payload.get("output", []):
        if not isinstance(item, dict):
            continue
        for content in item.get("content", []):
            if not isinstance(content, dict):
                continue
            text = content.get("text")
            if isinstance(text, str) and text.strip():
                parts.append(text.strip())
    return "\n\n".join(parts).strip()


def _safe_int(value: object) -> int:
    try:
        number = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0
    return max(0, number)


def normalize_openai_usage(usage: dict | None) -> dict:
    if not isinstance(usage, dict):
        usage = {}
    input_details = usage.get("input_tokens_details")
    if not isinstance(input_details, dict):
        input_details = {}
    output_details = usage.get("output_tokens_details")
    if not isinstance(output_details, dict):
        output_details = {}

    input_tokens = _safe_int(usage.get("input_tokens", usage.get("prompt_tokens")))
    output_tokens = _safe_int(usage.get("output_tokens", usage.get("completion_tokens")))
    total_tokens = _safe_int(usage.get("total_tokens")) or input_tokens + output_tokens
    cached_tokens = min(input_tokens, _safe_int(input_details.get("cached_tokens")))
    reasoning_tokens = _safe_int(output_details.get("reasoning_tokens"))

    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "input_tokens_details": {
            "cached_tokens": cached_tokens,
        },
        "output_tokens_details": {
            "reasoning_tokens": reasoning_tokens,
        },
    }


def pricing_snapshot_for_model(model_name: str) -> dict | None:
    normalized_model = str(model_name or "").strip()
    if not normalized_model:
        return None
    for known_model, pricing in sorted(
        OPENAI_PRICING_USD_PER_1M_TOKENS.items(),
        key=lambda item: len(item[0]),
        reverse=True,
    ):
        if normalized_model == known_model or normalized_model.startswith(f"{known_model}-"):
            return {"model": known_model, **pricing}
    return None


def estimate_openai_response_cost(model_name: str, usage: dict | None) -> dict:
    normalized_usage = normalize_openai_usage(usage)
    pricing = pricing_snapshot_for_model(model_name)
    cached_input_tokens = normalized_usage["input_tokens_details"]["cached_tokens"]
    billable_input_tokens = max(0, normalized_usage["input_tokens"] - cached_input_tokens)
    output_tokens = normalized_usage["output_tokens"]
    base = {
        "currency": "USD",
        "model": str(model_name or ""),
        "pricing_checked_at": OPENAI_PRICING_CHECKED_AT,
        "pricing_source": OPENAI_PRICING_SOURCE_URL,
        "input_tokens": normalized_usage["input_tokens"],
        "cached_input_tokens": cached_input_tokens,
        "output_tokens": output_tokens,
        "reasoning_tokens": normalized_usage["output_tokens_details"]["reasoning_tokens"],
        "total_tokens": normalized_usage["total_tokens"],
    }
    if not pricing:
        return {
            **base,
            "status": "pricing_unconfigured",
            "estimated_cost_usd": None,
        }

    input_price = float(pricing["input"])
    cached_input_price = pricing.get("cached_input")
    cached_input_price = input_price if cached_input_price is None else float(cached_input_price)
    output_price = float(pricing["output"])
    estimated_cost = (
        (billable_input_tokens / 1_000_000) * input_price
        + (cached_input_tokens / 1_000_000) * cached_input_price
        + (output_tokens / 1_000_000) * output_price
    )
    return {
        **base,
        "status": "estimated",
        "pricing_model": pricing["model"],
        "input_price_per_1m_usd": input_price,
        "cached_input_price_per_1m_usd": cached_input_price,
        "output_price_per_1m_usd": output_price,
        "estimated_cost_usd": round(estimated_cost, 8),
    }


def _parse_retry_after_seconds(value: object) -> float | None:
    try:
        seconds = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    return seconds if seconds >= 0 else None


def _openai_retry_delay_seconds(attempt: int, retry_after: float | None) -> float:
    backoff = min(
        OPENAI_RETRY_MAX_DELAY_SECONDS,
        OPENAI_RETRY_BASE_DELAY_SECONDS * (2 ** (attempt - 1)),
    )
    if retry_after is not None:
        backoff = min(OPENAI_RETRY_MAX_DELAY_SECONDS, max(backoff, retry_after))
    # Jitter avoids a thundering herd when the 3 background workers retry together.
    return backoff + random.uniform(0, OPENAI_RETRY_BASE_DELAY_SECONDS)


def call_openai_response(
    *,
    api_key: str,
    input_text: str,
    model_name: str,
    prompt_text: str,
    max_output_tokens: int = 1200,
    text_format: dict | None = None,
    text_verbosity: str | None = None,
    reasoning_effort: str | None = None,
) -> dict:
    payload: dict[str, object] = {
        "input": input_text,
        "instructions": prompt_text,
        "max_output_tokens": max_output_tokens,
        "model": model_name,
    }
    text_options: dict[str, object] = {}
    if text_format is not None:
        text_options["format"] = text_format
    if text_verbosity:
        text_options["verbosity"] = text_verbosity
    if text_options:
        payload["text"] = text_options
    if reasoning_effort:
        payload["reasoning"] = {"effort": reasoning_effort}
    body = json.dumps(payload).encode("utf-8")
    request = urllib_request.Request(
        OPENAI_RESPONSES_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    response_payload = None
    for attempt in range(1, OPENAI_MAX_ATTEMPTS + 1):
        try:
            with urllib_request.urlopen(request, timeout=60) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
            break
        except HTTPError as exc:
            if exc.code not in OPENAI_RETRYABLE_STATUS_CODES or attempt >= OPENAI_MAX_ATTEMPTS:
                detail = exc.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"OpenAI API request failed with HTTP {exc.code}: {detail}") from exc
            retry_after = _parse_retry_after_seconds(exc.headers.get("Retry-After")) if exc.headers else None
            delay = _openai_retry_delay_seconds(attempt, retry_after)
            print(
                f"OpenAI API HTTP {exc.code}; retry {attempt}/{OPENAI_MAX_ATTEMPTS - 1} in {delay:.1f}s",
                file=sys.stderr,
            )
            time.sleep(delay)
        except (URLError, TimeoutError) as exc:
            if attempt >= OPENAI_MAX_ATTEMPTS:
                reason = getattr(exc, "reason", exc)
                raise RuntimeError(f"OpenAI API request failed: {reason}") from exc
            delay = _openai_retry_delay_seconds(attempt, None)
            print(
                f"OpenAI API network error ({exc}); retry {attempt}/{OPENAI_MAX_ATTEMPTS - 1} in {delay:.1f}s",
                file=sys.stderr,
            )
            time.sleep(delay)

    if response_payload.get("status") == "incomplete":
        details = response_payload.get("incomplete_details")
        reason = details.get("reason") if isinstance(details, dict) else "unknown"
        raise RuntimeError(f"OpenAI API returned an incomplete response: {reason}.")

    answer = response_text_from_openai_payload(response_payload)
    if not answer:
        raise RuntimeError("OpenAI API returned no text output.")
    usage = normalize_openai_usage(response_payload.get("usage"))
    response_model = str(response_payload.get("model") or model_name)
    return {
        "text": answer,
        "response_id": response_payload.get("id"),
        "model": response_model,
        "usage": usage,
        "cost_estimate": estimate_openai_response_cost(response_model, usage),
    }


def openai_response_text(result: dict | str) -> str:
    if isinstance(result, str):
        return result
    return str(result.get("text") or "")


def generate_openai_answer(
    question: dict,
    retrievals: list[dict],
    *,
    model_name: str,
    prompt_text: str,
) -> str:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured. Add it to .env and restart the backend.")
    source_context = format_retrieved_context_for_answer(retrievals)
    input_text = (
        f"Citizen question:\n{question.get('question_text', '')}\n\n"
        f"Retrieved official-source context:\n{source_context}"
    )
    return openai_response_text(call_openai_response(
        api_key=api_key,
        input_text=input_text,
        model_name=model_name,
        prompt_text=prompt_text,
        max_output_tokens=OPENAI_ANSWER_MAX_OUTPUT_TOKENS,
        # Reasoning models (gpt-5*, o*) otherwise default to "medium" reasoning, whose
        # tokens count against max_output_tokens and starve the visible answer on long
        # multi-intent questions. Keep it low, matching the judge call.
        reasoning_effort=openai_reasoning_effort_for_model(model_name),
    ))

# Default judge input framing labels. Kept as constants so the exact strings are
# defined once and every run that does not override them stays byte-identical.
# A run from another domain can override these labels through its settings.
DEFAULT_JUDGE_QUESTION_LABEL = "Citizen question"
DEFAULT_JUDGE_CONTEXT_LABEL = "Retrieved official-source context"


def build_judge_input_text(
    *,
    question: dict,
    answer_text: str,
    context: str,
    requires_clarification: bool,
    question_label: str | None = None,
    context_label: str | None = None,
) -> str:
    """Assemble the judge input text with configurable domain framing labels.

    Extracted so the framing can be verified without an OpenAI API key. The
    question-design annotation is deliberately not serialized: the Judge must
    infer answerability from the question and context. The argument remains part
    of the call contract because the annotation is still stored on the trace for
    post-evaluation analysis.
    """
    _ = requires_clarification
    question_label = question_label or DEFAULT_JUDGE_QUESTION_LABEL
    context_label = context_label or DEFAULT_JUDGE_CONTEXT_LABEL
    return (
        f"{question_label}:\n{question.get('question_text', '')}\n\n"
        f"Generated answer:\n{answer_text}\n\n"
        f"{context_label}:\n{context}"
    )


def generate_openai_judge(
    *,
    question: dict,
    answer_text: str,
    context: str,
    model_name: str,
    prompt_text: str,
    requires_clarification: bool = False,
    question_label: str | None = None,
    context_label: str | None = None,
    is_external_answer: bool = False,
) -> dict:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured. Add it to .env and restart the backend.")

    schema_instruction = (
        "\n\nReturn only the structured JSON object required by the API schema. "
        "Keep every list item short and concrete. Keep short_explanation under 350 characters. "
        "Scores are integers from 1 to 5.\n"
        "Put claims that directly contradict the retrieved context in contradicted_claims.\n"
        "Put invented or unverifiable action-critical claims in unsupported_claims.\n"
        "If the retrieved context is insufficient for an explicit requested fee, deadline, "
        "document, eligibility, legal, office, application-channel, online-processing, or "
        "payment detail, put the missing detail in missing_or_incomplete_points and the "
        "retrieval limitation in context_limitations.\n"
        "Leave contradicted_claims and unsupported_claims empty for tone-only, clarity-only, "
        "or incompleteness-only problems."
    )
    input_text = build_judge_input_text(
        question=question,
        answer_text=answer_text,
        context=context,
        requires_clarification=requires_clarification,
        question_label=question_label,
        context_label=context_label,
    )
    openai_result = call_openai_response(
        api_key=api_key,
        input_text=input_text,
        model_name=model_name,
        prompt_text=(prompt_text or DEFAULT_JUDGE_PROMPT) + schema_instruction,
        max_output_tokens=OPENAI_JUDGE_MAX_OUTPUT_TOKENS,
        text_format=OPENAI_JUDGE_TEXT_FORMAT,
        text_verbosity="low",
        reasoning_effort=openai_reasoning_effort_for_model(model_name),
    )
    raw = openai_response_text(openai_result)
    parsed = parse_json_object(raw)
    scores = validate_openai_judge_schema(parsed)
    criteria = parsed.get("criteria") if isinstance(parsed.get("criteria"), dict) else {}
    normalized_criteria = {
        key: openai_criterion_result(criteria, scores, key, "evaluated")
        for key in CANONICAL_EVALUATION_CRITERIA
    }
    normalized_final_decision, post_processing_reasons = normalize_openai_judge_decision(
        parsed,
        normalized_criteria,
        answer_text=answer_text,
        is_external_answer=is_external_answer,
    )
    score_values = [item["score"] for item in normalized_criteria.values()]
    judge_score = clamp_score(parsed.get("judge_score", round(sum(score_values) / len(score_values))))
    label = str(parsed.get("label") or "")
    if label not in {"supported", "partly_supported", "unsupported"}:
        source_support_score = normalized_criteria["source_support"]["score"]
        label = (
            "supported"
            if source_support_score >= 4
            else "partly_supported"
            if source_support_score == 3
            else "unsupported"
        )
    faithfulness = parsed.get("faithfulness_score")
    relevance = parsed.get("relevance_score")
    try:
        faithfulness_score = max(0.0, min(1.0, float(faithfulness)))
    except (TypeError, ValueError):
        faithfulness_score = normalized_criteria["source_support"]["score"] / 5
    try:
        relevance_score = max(0.0, min(1.0, float(relevance)))
    except (TypeError, ValueError):
        relevance_score = normalized_criteria["completeness"]["score"] / 5
    return {
        "faithfulness_score": round(faithfulness_score, 3),
        "relevance_score": round(relevance_score, 3),
        "judge_score": judge_score,
        "label": label,
        "criteria": normalized_criteria,
        "evaluation_mode": "openai_judge_v1",
        "judge_schema_version": JUDGE_SCHEMA_VERSION,
        "explanation": str(parsed.get("short_explanation") or parsed.get("explanation") or "OpenAI judge evaluation."),
        "answerability": str(parsed.get("answerability") or ""),
        "final_decision": normalized_final_decision,
        "raw_final_decision": str(parsed.get("final_decision") or ""),
        "post_processing_reasons": post_processing_reasons,
        "contradicted_claims": list_field(parsed, "contradicted_claims"),
        "unsupported_claims": list_field(parsed, "unsupported_claims"),
        "missing_or_incomplete_points": list_field(parsed, "missing_or_incomplete_points"),
        "clarity_or_tone_problems": list_field(parsed, "clarity_or_tone_problems"),
        "context_limitations": list_field(parsed, "context_limitations"),
        "raw_judge_output": raw,
        "openai_response_id": openai_result.get("response_id") if isinstance(openai_result, dict) else "",
        "judge_model_name": openai_result.get("model", model_name) if isinstance(openai_result, dict) else model_name,
        "usage": openai_result.get("usage", {}) if isinstance(openai_result, dict) else {},
        "cost_estimate": openai_result.get("cost_estimate", {}) if isinstance(openai_result, dict) else {},
        "evaluated_at": now_iso(),
    }


def generate_improvement_suggestions(
    *,
    evidence_text: str,
    model_name: str,
) -> dict:
    """Summarize a batch's compiled human-review + judge evidence into suggestions.

    One OpenAI call, strict JSON schema (``OPENAI_IMPROVEMENT_SUGGESTIONS_TEXT_FORMAT``),
    following the same shape as ``generate_openai_judge``: check the API key,
    call the Responses API, parse and validate the JSON contract, and return a
    plain dict the caller persists into batch metadata.
    """
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured. Add it to .env and restart the backend.")

    openai_result = call_openai_response(
        api_key=api_key,
        input_text=evidence_text,
        model_name=model_name,
        prompt_text=IMPROVEMENT_SUGGESTIONS_INSTRUCTIONS,
        max_output_tokens=OPENAI_IMPROVEMENT_SUGGESTIONS_MAX_OUTPUT_TOKENS,
        text_format=OPENAI_IMPROVEMENT_SUGGESTIONS_TEXT_FORMAT,
        text_verbosity="low",
        reasoning_effort=openai_reasoning_effort_for_model(model_name),
    )
    raw = openai_response_text(openai_result)
    parsed = parse_json_object(raw)
    suggestions = validate_improvement_suggestions_schema(parsed)
    return {
        "suggestions": suggestions,
        "model_name": openai_result.get("model", model_name) if isinstance(openai_result, dict) else model_name,
        "openai_response_id": openai_result.get("response_id") if isinstance(openai_result, dict) else "",
        "usage": openai_result.get("usage", {}) if isinstance(openai_result, dict) else {},
        "cost_estimate": openai_result.get("cost_estimate", {}) if isinstance(openai_result, dict) else {},
        "raw_output": raw,
    }
