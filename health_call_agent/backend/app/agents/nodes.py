"""LangGraph nodes: classify purpose and analyze failure reason."""

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.agents.prompts import (
    PURPOSE_CLASSIFY_SYSTEM,
    PURPOSE_CLASSIFY_USER,
    FAILURE_REASON_SYSTEM,
    FAILURE_REASON_USER,
    ACTION_PLAN_SYSTEM,
    ACTION_PLAN_USER,
)
from app.schemas import PurposeResult, FailureReasonResult, ActionPlanResult


def _get_llm(
    api_key: str,
    model_name: str,
    timeout_seconds: int,
    max_retries: int,
) -> ChatGoogleGenerativeAI:
    """Create Gemini LLM instance."""
    return ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=api_key,
        temperature=0.2,
        timeout=timeout_seconds,
        max_retries=max_retries,
    )


def _invoke_with_model_fallback(
    messages: list,
    api_key: str,
    model_candidates: list[str],
    timeout_seconds: int,
    max_retries: int,
) -> tuple[Any, str]:
    """Try model candidates in order and return (response, used_model)."""
    if not model_candidates:
        raise ValueError("No Gemini models configured.")

    last_error: Exception | None = None
    for model_name in model_candidates:
        try:
            llm = _get_llm(api_key, model_name, timeout_seconds, max_retries)
            return llm.invoke(messages), model_name
        except Exception as e:
            last_error = e
            error_text = str(e)
            # Try next model for common provider-side issues.
            if any(
                code in error_text
                for code in (
                    "429",
                    "RESOURCE_EXHAUSTED",
                    "404",
                    "NOT_FOUND",
                    "400",
                    "INVALID_ARGUMENT",
                    "Developer instruction is not",
                )
            ):
                continue
            raise

    raise RuntimeError(f"All Gemini model candidates failed: {last_error}")


def _parse_json_from_response(text: str) -> dict[str, Any]:
    """Extract JSON from LLM response (may be wrapped in markdown)."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        start = 1 if lines[0].startswith("```json") else 0
        end = next((i for i, L in enumerate(lines) if L.strip() == "```"), len(lines))
        text = "\n".join(lines[start:end])
    return json.loads(text)


def classify_purpose(
    state: dict[str, Any],
    api_key: str,
    model_candidates: list[str],
    timeout_seconds: int,
    max_retries: int,
) -> dict[str, Any]:
    """Node: classify the primary purpose of the call."""
    conversation_text = state["conversation_text"]
    messages = [
        SystemMessage(content=PURPOSE_CLASSIFY_SYSTEM),
        HumanMessage(content=PURPOSE_CLASSIFY_USER.format(conversation_text=conversation_text)),
    ]
    response, used_model = _invoke_with_model_fallback(
        messages,
        api_key,
        model_candidates,
        timeout_seconds,
        max_retries,
    )
    raw = response.content if hasattr(response, "content") else str(response)
    data = _parse_json_from_response(raw)
    purpose_result = PurposeResult(
        purpose=data.get("purpose", "other"),
        confidence=data.get("confidence", "medium"),
        summary=data.get("summary", ""),
    )
    return {
        "purpose_result": purpose_result.model_dump(),
        "purpose_summary": purpose_result.summary,
        "purpose_label": purpose_result.purpose,
        "model_used": used_model,
    }


def analyze_failure_reason(
    state: dict[str, Any],
    api_key: str,
    model_candidates: list[str],
    timeout_seconds: int,
    max_retries: int,
) -> dict[str, Any]:
    """Node: analyze why the call purpose was not achieved."""
    conversation_text = state["conversation_text"]
    purpose_label = state.get("purpose_label", "other")
    purpose_summary = state.get("purpose_summary", "")
    preferred_model = state.get("model_used")
    candidates = [preferred_model] + model_candidates if preferred_model else model_candidates
    deduped_candidates = []
    for name in candidates:
        if name and name not in deduped_candidates:
            deduped_candidates.append(name)
    messages = [
        SystemMessage(content=FAILURE_REASON_SYSTEM),
        HumanMessage(
            content=FAILURE_REASON_USER.format(
                purpose=purpose_label,
                summary=purpose_summary,
                conversation_text=conversation_text,
            )
        ),
    ]
    response, used_model = _invoke_with_model_fallback(
        messages,
        api_key,
        deduped_candidates,
        timeout_seconds,
        max_retries,
    )
    raw = response.content if hasattr(response, "content") else str(response)
    data = _parse_json_from_response(raw)
    failure_result = FailureReasonResult(
        reason_category=data.get("reason_category", "other"),
        explanation=data.get("explanation", ""),
        evidence=data.get("evidence", []),
        recommendation=data.get("recommendation", ""),
    )
    return {
        "failure_reason_result": failure_result.model_dump(),
        "model_used": used_model,
    }


def generate_action_plan(
    state: dict[str, Any],
    api_key: str,
    model_candidates: list[str],
    timeout_seconds: int,
    max_retries: int,
) -> dict[str, Any]:
    """Node: generate end-to-end actionable plan as a separate output."""
    purpose_label = state.get("purpose_label", "other")
    purpose_summary = state.get("purpose_summary", "")
    failure_reason = state.get("failure_reason_result", {}) or {}
    preferred_model = state.get("model_used")
    candidates = [preferred_model] + model_candidates if preferred_model else model_candidates
    deduped_candidates = []
    for name in candidates:
        if name and name not in deduped_candidates:
            deduped_candidates.append(name)

    messages = [
        SystemMessage(content=ACTION_PLAN_SYSTEM),
        HumanMessage(
            content=ACTION_PLAN_USER.format(
                purpose=purpose_label,
                purpose_summary=purpose_summary,
                reason_category=failure_reason.get("reason_category", "other"),
                explanation=failure_reason.get("explanation", ""),
                recommendation=failure_reason.get("recommendation", ""),
                evidence=failure_reason.get("evidence", []),
            )
        ),
    ]
    response, used_model = _invoke_with_model_fallback(
        messages,
        api_key,
        deduped_candidates,
        timeout_seconds,
        max_retries,
    )
    raw = response.content if hasattr(response, "content") else str(response)
    data = _parse_json_from_response(raw)
    action_plan_result = ActionPlanResult(
        goal=data.get("goal", ""),
        steps=data.get("steps", []),
        owner=data.get("owner", ""),
        success_criteria=data.get("success_criteria", ""),
    )
    return {
        "action_plan_result": action_plan_result.model_dump(),
        "model_used": used_model,
    }
