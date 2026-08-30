from __future__ import annotations

try:
    from prototype.api_common import *
    from prototype.api_generation import *
    from prototype.api_evaluation import *
    from prototype.api_openai import *
except ModuleNotFoundError:
    from api_common import *
    from api_generation import *
    from api_evaluation import *
    from api_openai import *

def external_retrievals_from_payload(payload: dict) -> list[dict]:
    raw_retrievals = payload.get("retrieval_results")
    if isinstance(raw_retrievals, list) and raw_retrievals:
        retrievals: list[dict] = []
        for rank, item in enumerate(raw_retrievals, start=1):
            if not isinstance(item, dict):
                continue
            chunk_text = str(item.get("chunk_text") or item.get("source_context") or "").strip()
            if not chunk_text:
                continue
            retrievals.append(
                {
                    "retrieval_id": "",
                    "trace_id": "",
                    "service_id": str(item.get("service_id") or payload.get("service_id") or "external_service"),
                    "service_title": str(
                        item.get("service_title")
                        or payload.get("service_title")
                        or "External source"
                    ),
                    "section_name": str(
                        item.get("section_name")
                        or payload.get("target_section")
                        or "external_context"
                    ),
                    "chunk_text": chunk_text,
                    "rank": int(item.get("rank") or rank),
                    "retrieval_score": float(item.get("retrieval_score") or 1.0),
                    "source_ref": str(
                        item.get("source_ref")
                        or item.get("source_url")
                        or payload.get("source_url")
                        or ""
                    ),
                    "intent_role": str(item.get("intent_role") or f"intent_{rank}"),
                    "online_urls": cleaned_online_urls(item.get("online_urls") or payload.get("online_urls")),
                    "online_available": bool(item.get("online_available") or payload.get("online_available")),
                    "online_labels": [
                        str(label).strip()
                        for label in (item.get("online_labels") or payload.get("online_labels") or [])
                        if str(label).strip()
                    ],
                }
            )
        return retrievals

    source_context = str(payload.get("source_context") or "").strip()
    if not source_context:
        return []
    return [
        {
            "retrieval_id": "",
            "trace_id": "",
            "service_id": str(payload.get("service_id") or "external_service"),
            "service_title": str(payload.get("service_title") or "External source"),
            "section_name": str(payload.get("target_section") or "external_context"),
            "chunk_text": source_context,
            "rank": 1,
            "retrieval_score": 1.0,
            "source_ref": str(payload.get("source_url") or ""),
            "intent_role": "primary",
            "online_urls": cleaned_online_urls(payload.get("online_urls")),
            "online_available": bool(payload.get("online_available")),
            "online_labels": [
                str(label).strip()
                for label in (payload.get("online_labels") or [])
                if str(label).strip()
            ],
        }
    ]


def trace_from_payload(store: PrototypeStore, payload: dict, mode: str) -> dict:
    # Regenerating an answer (or re-evaluating) an existing frozen study-run case
    # is rejected so its locked answer/judge result stay reproducible.
    existing_trace_id = str(payload.get("trace_id") or "")
    if existing_trace_id:
        existing_trace = store.evaluation_store.get_trace(existing_trace_id)
        if existing_trace is not None:
            store._assert_trace_mutable(existing_trace)

    question = None
    if payload.get("question_id"):
        question = store.questions_by_id.get(str(payload["question_id"]))
        if not question and not payload.get("external_question_id"):
            raise KeyError(f"Unknown question_id: {payload['question_id']}")

    external_retrievals = external_retrievals_from_payload(payload)
    service_id = str(payload.get("service_id") or (question or {}).get("service_id") or "")
    service = store.services_by_id.get(service_id)
    if not service and external_retrievals:
        service = {
            "service_id": service_id or external_retrievals[0]["service_id"],
            "title": payload.get("service_title") or external_retrievals[0]["service_title"],
            "url": payload.get("source_url") or external_retrievals[0]["source_ref"],
            "description": "",
            "full_text": "\n\n".join(retrieval["chunk_text"] for retrieval in external_retrievals),
            "sections": {
                retrieval["section_name"]: retrieval["chunk_text"]
                for retrieval in external_retrievals
            },
        }
    if not service and (payload.get("question_text") or payload.get("answer_text")):
        service = {
            "service_id": service_id or "external_service",
            "title": payload.get("service_title") or "External chatbot",
            "url": payload.get("source_url") or "",
            "description": "",
            "full_text": str(payload.get("source_context") or ""),
            "sections": {
                str(payload.get("target_section") or "external_context"): str(payload.get("source_context") or "")
            },
        }
    if not service:
        raise KeyError("A known service_id or question_id is required.")

    target_section = payload.get("target_section") or (question or {}).get("target_section")
    question_text = payload.get("question_text") or (question or {}).get("question_text")
    section_name = str(target_section or "external_context")
    if not question_text:
        section_name, _ = retrieve_context(service, target_section)
        question_text = f"Question about {SECTION_LABELS.get(section_name, section_name)} for {service['title']}"

    if question is None:
        question = {
            "question_id": str(payload.get("external_question_id") or f"runtime_question_{uuid.uuid4().hex[:10]}"),
            "service_id": service["service_id"],
            "service_title": service["title"],
            "source_url": service["url"],
            "question_text": question_text,
            "target_section": section_name,
            "requires_clarification": bool(payload.get("requires_clarification")),
            "language": payload.get("language", "de"),
            "style_label": payload.get("style_label", "runtime_user_input"),
            "edge_case_label": payload.get("edge_case_label", "runtime"),
            "created_at": now_iso(),
        }

    retrievals = external_retrievals or retrievals_for_question(store, service, question, target_section)
    if not retrievals:
        section_name, context = retrieve_context(service, target_section)
        retrievals = [
            {
                "retrieval_id": "",
                "trace_id": "",
                "service_id": service["service_id"],
                "service_title": service["title"],
                "section_name": section_name,
                "chunk_text": context,
                "rank": 1,
                "retrieval_score": 1.0,
                "source_ref": service["url"],
                "intent_role": "primary",
            }
        ]
    section_name = retrievals[0]["section_name"]
    context = "\n\n".join(retrieval["chunk_text"] for retrieval in retrievals)
    judge_context = format_retrieved_context_for_judge(retrievals)

    if mode == "generate":
        model_name = str(payload.get("model_name") or "no_llm_baseline")
        if is_openai_model(model_name):
            answer_text = generate_openai_answer(
                question,
                retrievals,
                model_name=model_name,
                prompt_text=str(payload.get("answer_prompt_text") or ""),
            )
            generation_mode = "openai_answer_v1"
        else:
            answer_text = generate_answer_from_retrievals(question, retrievals)
            generation_mode = (
                "deterministic_source_excerpt"
                if question.get("intent_type", "single_intent") == "single_intent"
                else "deterministic_multi_context_summary"
            )
    else:
        answer_kind = str(payload.get("answer_kind") or "")
        if isinstance(payload.get("calibration"), dict) and answer_kind:
            answer_text = calibration_answer_text(
                answer_kind=answer_kind,
                question=question,
                retrievals=retrievals,
            )
        else:
            answer_text = payload.get("answer_text") or generate_answer_from_retrievals(question, retrievals)
        generation_mode = payload.get("generation_mode", "provided_answer_or_baseline")

    answer_prompt_version = payload.get("answer_prompt_version") or payload.get("prompt_version") or "api_baseline_v0"
    judge_prompt_version = payload.get("judge_prompt_version") or "rule_judge_v0"
    judge_mode = str(payload.get("judge_mode") or "rule_based_baseline")
    trace_id = f"runtime_{uuid.uuid4().hex[:12]}"
    for rank, retrieval in enumerate(retrievals, start=1):
        retrieval["trace_id"] = trace_id
        retrieval["retrieval_id"] = f"ret_{trace_id}_{rank}"
    judge_model_name = ""
    if judge_mode == "openai_judge_v1":
        judge_model_name = str(payload.get("judge_model_name") or payload.get("model_name") or default_openai_model())
        if not is_openai_model(judge_model_name):
            judge_model_name = default_openai_model()
        automated = generate_openai_judge(
            question=question,
            answer_text=answer_text,
            context=judge_context,
            model_name=judge_model_name,
            prompt_text=str(payload.get("judge_prompt_text") or ""),
            requires_clarification=bool(question.get("requires_clarification")),
            question_label=payload.get("judge_question_label") or None,
            context_label=payload.get("judge_context_label") or None,
            is_external_answer=(generation_mode == "imported_chatbot_answer"),
        )
    else:
        automated = evaluate_answer(
            question_text,
            answer_text,
            context,
            requires_clarification=bool(question.get("requires_clarification")),
        )
    automated["auto_eval_id"] = f"auto_{trace_id}"
    automated["trace_id"] = trace_id
    automated["judge_prompt_version"] = judge_prompt_version
    automated["judge_prompt_text"] = payload.get("judge_prompt_text", "")
    automated["judge_model_name"] = judge_model_name
    automated["judge_schema_version"] = str(
        payload.get("judge_schema_version")
        or automated.get("judge_schema_version")
        or JUDGE_SCHEMA_VERSION
    )

    trace = {
        "trace_id": trace_id,
        "created_at": now_iso(),
        "variant": payload.get("variant") or "runtime_" + mode,
        "service_entry": {
            "service_id": service["service_id"],
            "title": service["title"],
            "source_url": service["url"],
        },
        "citizen_question": question,
        "retrieval_result": {
            "retrieval_id": f"ret_{trace_id}_1",
            "trace_id": trace_id,
            "service_id": retrievals[0]["service_id"],
            "service_title": retrievals[0]["service_title"],
            "section_name": section_name,
            "chunk_text": retrievals[0]["chunk_text"],
            "rank": 1,
            "retrieval_score": 1.0,
            "source_ref": retrievals[0]["source_ref"],
            "intent_role": retrievals[0]["intent_role"],
        },
        "retrieval_results": retrievals,
        "generated_answer": {
            "answer_id": f"ans_{trace_id}",
            "trace_id": trace_id,
            "answer_text": answer_text,
            "generation_mode": generation_mode,
            "model_name": payload.get("model_name", "no_llm_baseline"),
            "prompt_version": answer_prompt_version,
            "answer_prompt_version": answer_prompt_version,
            "answer_prompt_text": payload.get("answer_prompt_text", ""),
        },
        "automated_evaluation": automated,
        "mock_human_review": None,
        "disagreement_case": None,
    }
    if isinstance(payload.get("calibration"), dict):
        trace["calibration"] = calibration_result(trace, payload["calibration"])
    store.save_runtime_trace(
        trace,
        run_type=payload.get("run_type"),
        batch_id=payload.get("batch_id"),
    )
    return trace
