#!/usr/bin/env python3
"""Shared inter-rater agreement metrics for the Revia research workflow.

This module is the server-side source of truth for agreement statistics used
by the ``research_summary`` export (``prototype/api_store.py``) and the
Developer / Evaluation Lab Analysis workflow.

Stdlib only - no third-party dependencies, matching the backend package.
"""

from __future__ import annotations

from collections import Counter

# Below this many comparable pairs, a kappa value is considered too unstable
# to report (percentage agreement is still shown). This threshold is an
# assumption for a small pilot study and should be revisited once real study
# data with a larger sample arrives.
MIN_N_FOR_KAPPA = 5

# When one decision category dominates the comparison, chance agreement is
# already high and Cohen's kappa becomes unstable / pessimistic even when
# percentage agreement looks strong. Above this share of the pooled
# observations, callers should warn the reader that a low kappa is an artefact
# of the skew, not of poor agreement.
DOMINANT_SHARE_WARN_THRESHOLD = 0.75


def percent_agreement(pairs: list[tuple[str, str]]) -> float | None:
    if not pairs:
        return None
    matches = sum(1 for a, b in pairs if a == b)
    return matches / len(pairs)


def dominant_share(pairs: list[tuple[str, str]]) -> float | None:
    """Share of the most common category across all pooled observations.

    Both members of every pair are pooled, so a value close to 1.0 means one
    decision category dominates the comparison. This is the signal used to
    warn that a low kappa is driven by class imbalance rather than by genuine
    disagreement.
    """
    if not pairs:
        return None
    observations: Counter = Counter()
    for a, b in pairs:
        observations[a] += 1
        observations[b] += 1
    total = sum(observations.values())
    if not total:
        return None
    return max(observations.values()) / total


def cohens_kappa(pairs: list[tuple[str, str]]) -> tuple[float | None, str | None]:
    """Unweighted nominal Cohen's kappa for a list of (rater_a, rater_b) pairs.

    Returns (kappa, reason). ``reason`` is None on success, otherwise a short
    human-readable explanation of why kappa could not be computed. Never
    raises - callers get a null value with an explanation instead of a crash.
    """
    n = len(pairs)
    if n == 0:
        return None, "no comparable pairs (n=0)"
    a_counts = Counter(a for a, _ in pairs)
    b_counts = Counter(b for _, b in pairs)
    categories = set(a_counts) | set(b_counts)
    po = sum(1 for a, b in pairs if a == b) / n
    pe = sum((a_counts.get(c, 0) / n) * (b_counts.get(c, 0) / n) for c in categories)
    if pe >= 1.0:
        return None, "pe=1 (degenerate distribution; chance agreement already total)"
    return (po - pe) / (1 - pe), None


def _score_band(score: int | None) -> str | None:
    """Coarse score band matching the frontend's ``scoreBand`` helper.

    Kept local (no ``api_common`` import) so this module stays a pure,
    dependency-free stats layer; callers hand in already-normalized
    ``{criterion_key: score}`` dicts.
    """
    if not isinstance(score, int):
        return None
    if score <= 2:
        return "problem"
    if score == 3:
        return "borderline"
    return "positive"


def _flipped_criteria_for_case(
    case_id: str, per_run_criteria: list[dict[str, dict]]
) -> list[dict]:
    """Criteria whose score band differs across repeat runs for one case.

    Widest score spread first, capped so the case row stays scannable.
    """
    keys: list[str] = []
    seen_keys: set[str] = set()
    for criteria_map in per_run_criteria:
        criteria = criteria_map.get(case_id)
        if not isinstance(criteria, dict):
            continue
        for key in criteria:
            if key not in seen_keys:
                seen_keys.add(key)
                keys.append(key)

    flipped: list[dict] = []
    for key in keys:
        scores: list[int | None] = []
        for criteria_map in per_run_criteria:
            criteria = criteria_map.get(case_id)
            score = criteria.get(key) if isinstance(criteria, dict) else None
            scores.append(score if isinstance(score, int) else None)
        bands = {_score_band(score) for score in scores if score is not None}
        if len(bands) <= 1:
            continue
        present = [score for score in scores if isinstance(score, int)]
        spread = (max(present) - min(present)) if present else 0
        flipped.append({"key": key, "scores": scores, "_spread": spread})

    flipped.sort(key=lambda item: item["_spread"], reverse=True)
    for item in flipped:
        item.pop("_spread")
    return flipped[:4]


def _run_explanations_for_case(
    decisions: list[str | None], per_run_explanation: list[dict[str, str]], case_id: str
) -> list[dict]:
    """One note per distinct decision side, for non-unanimous cases only.

    Picks the first run on each side that carries a non-empty explanation
    snippet; a side with no explanation anywhere is left out rather than
    shown with an empty note.
    """
    entries: list[dict] = []
    seen_decisions: set[str] = set()
    for decision in decisions:
        if not decision or decision in seen_decisions:
            continue
        seen_decisions.add(decision)
        note = ""
        for index, run_decision in enumerate(decisions):
            if run_decision != decision:
                continue
            candidate = per_run_explanation[index].get(case_id, "")
            if candidate:
                note = candidate
                break
        if note:
            entries.append({"decision": decision, "note": note})
    return entries


def _majority_decision(decisions: list[str]) -> tuple[str | None, bool]:
    """Majority vote over a list of decisions, ignoring missing (falsy) entries.

    Returns ``(majority, tie)``. ``majority`` is ``None`` when there is a tie
    for the most common decision (or no decisions at all); ``tie`` is ``True``
    only for a genuine tie between two or more decisions (e.g. a 2-2 split).
    """
    present = [decision for decision in decisions if decision]
    if not present:
        return None, False
    counts = Counter(present).most_common()
    top = counts[0][1]
    winners = [decision for decision, count in counts if count == top]
    if len(winners) > 1:
        return None, True
    return counts[0][0], False


def repeat_run_consistency(runs: list[dict]) -> dict:
    """Cross-run judge decision stability over a shared (imported) dataset.

    Pure function over plain dicts so it is unit-testable without SQLite. Each
    ``run`` dict describes one completed evaluation run and carries::

        {
            "batch_id": str,
            "created_at": str,
            "judge_prompt_version": str | None,
            "judge_model_name": str | None,
            "judge_context_label": str | None,
            "cases": [
                {
                    "case_id": str,
                    "question": str,            # snippet, optional
                    "final_decision": str | None,
                    "human_decision": str | None,  # imported reference label
                    "criteria": dict | None,    # {criterion_key: score}, optional
                    "explanation": str | None,  # short judge explanation, optional
                },
                ...
            ],
        }

    Runs are expected already ordered (e.g. by ``created_at``); the returned
    ``cases[*].decisions`` list is aligned positionally with ``runs``.

    The result surfaces, per case, whether the judge decided consistently
    across repeat runs (``judge_stability``) and whether the case should be
    routed to a human. Judge self-disagreement across repeat runs is treated
    as a disagreement signal on par with AI-human mismatch: unstable, tie, or
    majority-vs-human-mismatch cases are collected into ``route_to_human``.

    Each case also carries ``flipped_criteria`` (criteria whose score band
    disagreed across runs, widest spread first) and ``run_explanations`` (one
    judge explanation snippet per distinct decision side, only populated for
    non-unanimous cases), so a case row can answer *why* the runs disagree
    without opening the case.
    """
    run_count = len(runs)
    run_list = [
        {
            "batch_id": run.get("batch_id"),
            "created_at": run.get("created_at"),
            "judge_prompt_version": run.get("judge_prompt_version"),
            "judge_model_name": run.get("judge_model_name"),
            "judge_context_label": run.get("judge_context_label"),
        }
        for run in runs
    ]

    # First-seen order of case ids across all runs; per-run decision maps.
    case_order: list[str] = []
    seen: set[str] = set()
    questions: dict[str, str] = {}
    human_by_case: dict[str, str] = {}
    per_run_decision: list[dict[str, str | None]] = []
    per_run_criteria: list[dict[str, dict]] = []
    per_run_explanation: list[dict[str, str]] = []
    for run in runs:
        decision_map: dict[str, str | None] = {}
        criteria_map: dict[str, dict] = {}
        explanation_map: dict[str, str] = {}
        for case in run.get("cases", []):
            case_id = str(case.get("case_id"))
            decision_map[case_id] = case.get("final_decision") or None
            if case_id not in seen:
                seen.add(case_id)
                case_order.append(case_id)
            if case_id not in questions and case.get("question"):
                questions[case_id] = str(case.get("question"))
            if case_id not in human_by_case and case.get("human_decision"):
                human_by_case[case_id] = str(case.get("human_decision"))
            criteria = case.get("criteria")
            if isinstance(criteria, dict):
                criteria_map[case_id] = criteria
            explanation = case.get("explanation")
            if explanation:
                explanation_map[case_id] = str(explanation)
        per_run_decision.append(decision_map)
        per_run_criteria.append(criteria_map)
        per_run_explanation.append(explanation_map)

    case_rows: list[dict] = []
    route_to_human: list[str] = []
    cases_stable_across_all_runs = 0
    tie_count = 0
    majority_vs_human_pairs: list[tuple[str, str]] = []
    ties_excluded_with_human = 0

    for case_id in case_order:
        decisions = [decision_map.get(case_id) for decision_map in per_run_decision]
        present = [decision for decision in decisions if decision]
        distinct = set(present)
        majority, tie = _majority_decision(decisions)
        if tie:
            tie_count += 1
        stable_across_all_runs = len(distinct) == 1 and len(present) == run_count and run_count > 0
        if stable_across_all_runs:
            cases_stable_across_all_runs += 1
        if len(distinct) <= 1:
            judge_stability = "stable"
        elif tie:
            judge_stability = "tie"
        else:
            judge_stability = "unstable"

        human_decision = human_by_case.get(case_id)
        majority_vs_human_match: bool | None = None
        if human_decision:
            if majority is not None:
                majority_vs_human_match = majority == human_decision
                majority_vs_human_pairs.append((majority, human_decision))
            elif tie:
                ties_excluded_with_human += 1

        needs_human = (
            judge_stability in {"unstable", "tie"} or majority_vs_human_match is False
        )
        if needs_human:
            route_to_human.append(case_id)

        flipped_criteria = _flipped_criteria_for_case(case_id, per_run_criteria)
        run_explanations = (
            _run_explanations_for_case(decisions, per_run_explanation, case_id)
            if len(distinct) > 1
            else []
        )

        case_rows.append(
            {
                "case_id": case_id,
                "question": questions.get(case_id, ""),
                "decisions": decisions,
                "majority_decision": majority,
                "tie": tie,
                "judge_stability": judge_stability,
                "stable_across_all_runs": stable_across_all_runs,
                "human_decision": human_decision,
                "majority_vs_human_match": majority_vs_human_match,
                "route_to_human": needs_human,
                "flipped_criteria": flipped_criteria,
                "run_explanations": run_explanations,
            }
        )

    per_run_human_agreement = []
    decision_distribution_per_run = []
    for run, decision_map in zip(run_list, per_run_decision):
        pairs = [
            (decision_map[case_id], human_by_case[case_id])
            for case_id in case_order
            if human_by_case.get(case_id) and decision_map.get(case_id)
        ]
        stats = agreement_stats(pairs)
        matches = sum(1 for judge, human in pairs if judge == human)
        per_run_human_agreement.append(
            {
                "batch_id": run["batch_id"],
                "comparable_cases": len(pairs),
                "matches": matches,
                "percent_agreement": stats["percent_agreement"],
                "kappa": stats["kappa"],
            }
        )
        distribution = Counter(
            decision for decision in decision_map.values() if decision
        )
        decision_distribution_per_run.append(
            {"batch_id": run["batch_id"], "distribution": dict(distribution)}
        )

    majority_stats = agreement_stats(majority_vs_human_pairs)
    majority_matches = sum(1 for judge, human in majority_vs_human_pairs if judge == human)

    return {
        "runs": run_list,
        "cases": case_rows,
        "route_to_human": route_to_human,
        "aggregates": {
            "run_count": run_count,
            "case_count": len(case_order),
            "cases_stable_across_all_runs": cases_stable_across_all_runs,
            "tie_count": tie_count,
            "route_to_human_count": len(route_to_human),
            "per_run_human_agreement": per_run_human_agreement,
            "majority_vs_human": {
                "comparable_cases": len(majority_vs_human_pairs),
                "matches": majority_matches,
                "match_rate": (
                    round(majority_matches / len(majority_vs_human_pairs), 3)
                    if majority_vs_human_pairs
                    else None
                ),
                "percent_agreement": majority_stats["percent_agreement"],
                "kappa": majority_stats["kappa"],
                "ties_excluded": ties_excluded_with_human,
            },
            "decision_distribution_per_run": decision_distribution_per_run,
        },
    }


def agreement_stats(pairs: list[tuple[str, str]], *, min_n_for_kappa: int = 0) -> dict:
    """Percentage agreement + kappa for a list of paired categorical ratings.

    ``min_n_for_kappa`` lets callers require a minimum sample size before a
    kappa value is reported at all (used for the source-label and
    human-human comparisons, where the study package can easily be very
    small). AI-vs-human agreement has no such floor because every review is
    already a deliberate, individually meaningful comparison.

    The result always carries ``dominant_share`` so callers can flag a low
    kappa that is really an artefact of class imbalance.
    """
    n = len(pairs)
    result: dict = {
        "n": n,
        "percent_agreement": None,
        "kappa": None,
        "kappa_reason": None,
        "dominant_share": dominant_share(pairs),
    }
    if n == 0:
        result["kappa_reason"] = "no comparable pairs (n=0)"
        return result
    result["percent_agreement"] = percent_agreement(pairs)
    if n < min_n_for_kappa:
        result["kappa_reason"] = (
            f"insufficient overlap for a stable kappa (n={n} < {min_n_for_kappa}); "
            "reporting percentage agreement only"
        )
        return result
    kappa, reason = cohens_kappa(pairs)
    result["kappa"] = kappa
    result["kappa_reason"] = reason
    return result
