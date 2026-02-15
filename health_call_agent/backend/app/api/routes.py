"""FastAPI routes for call log analysis."""

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.schemas import (
    ConversationInput,
    CallLogInput,
    AnalysisResult,
    PurposeResult,
    FailureReasonResult,
    ActionPlanResult,
)
from app.agents import run_analysis


router = APIRouter(prefix="/api", tags=["analysis"])


def _conversation_to_text(messages: list) -> str:
    """Turn list of {role, content} into readable transcript."""
    lines = []
    for m in messages:
        if isinstance(m, dict):
            role = m.get("role", "unknown")
            content = m.get("content", "")
        else:
            role = getattr(m, "role", "unknown")
            content = getattr(m, "content", "")
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


def _short_error_message(e: Exception) -> str:
    text = str(e).replace("\n", " ").strip()
    if "RESOURCE_EXHAUSTED" in text or "429" in text:
        return "Gemini quota/rate limit exceeded. Retry later or use another API key/project."
    if len(text) > 320:
        return text[:320] + "..."
    return text


@router.post("/analyze", response_model=AnalysisResult)
def analyze_conversation(body: ConversationInput):
    """Analyze conversation and return purpose, failure reason, and action plan."""
    settings = get_settings()
    if not settings.is_configured:
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_API_KEY not set. Add it to .env or environment.",
        )
    conversation_text = _conversation_to_text(body.conversation)
    try:
        result = run_analysis(
            conversation_text=conversation_text,
            api_key=settings.google_api_key,
            model_candidates=settings.gemini_models,
            timeout_seconds=settings.gemini_timeout_seconds,
            max_retries=settings.gemini_max_retries,
            call_id=None,
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Analysis failed. {_short_error_message(e)}",
        ) from e
    return AnalysisResult(
        purpose=PurposeResult(**result["purpose"]),
        failure_reason=FailureReasonResult(**result["failure_reason"]),
        action_plan=ActionPlanResult(**result["action_plan"]),
        call_id=result.get("call_id"),
    )


@router.post("/analyze-call", response_model=AnalysisResult)
def analyze_call_log(body: CallLogInput):
    """Analyze full call log and return purpose, failure reason, and action plan."""
    settings = get_settings()
    if not settings.is_configured:
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_API_KEY not set. Add it to .env or environment.",
        )
    conversation_text = _conversation_to_text(body.conversation)
    try:
        result = run_analysis(
            conversation_text=conversation_text,
            api_key=settings.google_api_key,
            model_candidates=settings.gemini_models,
            timeout_seconds=settings.gemini_timeout_seconds,
            max_retries=settings.gemini_max_retries,
            call_id=body.call_id,
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Analysis failed. {_short_error_message(e)}",
        ) from e
    return AnalysisResult(
        purpose=PurposeResult(**result["purpose"]),
        failure_reason=FailureReasonResult(**result["failure_reason"]),
        action_plan=ActionPlanResult(**result["action_plan"]),
        call_id=result.get("call_id") or body.call_id,
    )


@router.get("/health")
def health():
    """Health check."""
    settings = get_settings()
    return {
        "status": "ok",
        "gemini_configured": settings.is_configured,
        "gemini_model": settings.gemini_model,
        "gemini_models": settings.gemini_models,
        "gemini_timeout_seconds": settings.gemini_timeout_seconds,
        "gemini_max_retries": settings.gemini_max_retries,
    }
