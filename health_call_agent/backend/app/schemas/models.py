"""Pydantic models for request/response and agent state."""

from typing import Optional
from pydantic import BaseModel, Field


class Message(BaseModel):
    """Single message in a conversation."""

    role: str = Field(..., description="agent, vendor, customer, or user")
    content: str = Field(..., description="Message text")


class ConversationInput(BaseModel):
    """Input: conversation only (list of messages)."""

    conversation: list[Message] = Field(..., description="Call conversation")


class CallLogInput(BaseModel):
    """Input: full call log with metadata."""

    call_id: Optional[str] = None
    date: Optional[str] = None
    duration_seconds: Optional[int] = None
    participants: Optional[list[str]] = None
    conversation: list[Message] = Field(..., description="Call conversation")


class PurposeResult(BaseModel):
    """Detected purpose of the call."""

    purpose: str = Field(
        ...,
        description="One of: booking, sell, consultant, support, complaint, other",
    )
    confidence: str = Field(..., description="high, medium, or low")
    summary: str = Field(..., description="Brief summary of what the call was about")


class FailureReasonResult(BaseModel):
    """Why the call purpose was not achieved."""

    reason_category: str = Field(
        ...,
        description="E.g. system_failure, process_limitation, wait_time, miscommunication, incomplete_info, other",
    )
    explanation: str = Field(..., description="Clear explanation of why purpose was not solved")
    evidence: list[str] = Field(
        default_factory=list,
        description="Quotes or moments from conversation that support this",
    )
    recommendation: str = Field(
        ...,
        description="What could have been done to resolve the purpose",
    )


class ActionPlanResult(BaseModel):
    """Actionable end-to-end plan to resolve the failed call outcome."""

    goal: str = Field(..., description="One-line goal to resolve the call outcome")
    steps: list[str] = Field(
        default_factory=list,
        description="Ordered, actionable steps to resolve the issue from start to finish",
    )
    owner: str = Field(
        ...,
        description="Primary owner/team responsible for executing the plan",
    )
    success_criteria: str = Field(
        ...,
        description="How to confirm the issue is resolved successfully",
    )


class AnalysisResult(BaseModel):
    """Full analysis output for one call."""

    purpose: PurposeResult
    failure_reason: FailureReasonResult
    action_plan: ActionPlanResult
    call_id: Optional[str] = None
