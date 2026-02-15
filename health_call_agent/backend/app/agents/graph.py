"""LangGraph definition: purpose -> failure reason -> action plan."""

from typing import Any, TypedDict

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from app.agents.nodes import classify_purpose, analyze_failure_reason, generate_action_plan


class CallAnalysisState(TypedDict, total=False):
    """State passed between nodes."""

    conversation_text: str
    call_id: str | None
    purpose_result: dict[str, Any]
    purpose_summary: str
    purpose_label: str
    model_used: str
    failure_reason_result: dict[str, Any]
    action_plan_result: dict[str, Any]


def get_analysis_graph(
    api_key: str,
    model_candidates: list[str],
    timeout_seconds: int,
    max_retries: int,
):
    """Build the analysis graph with three nodes."""

    def classify_node(state: CallAnalysisState) -> dict[str, Any]:
        return classify_purpose(state, api_key, model_candidates, timeout_seconds, max_retries)

    def failure_node(state: CallAnalysisState) -> dict[str, Any]:
        return analyze_failure_reason(state, api_key, model_candidates, timeout_seconds, max_retries)

    def action_plan_node(state: CallAnalysisState) -> dict[str, Any]:
        return generate_action_plan(state, api_key, model_candidates, timeout_seconds, max_retries)

    graph_builder = StateGraph(CallAnalysisState)
    graph_builder.add_node("classify_purpose", classify_node)
    graph_builder.add_node("analyze_failure_reason", failure_node)
    graph_builder.add_node("generate_action_plan", action_plan_node)

    graph_builder.set_entry_point("classify_purpose")
    graph_builder.add_edge("classify_purpose", "analyze_failure_reason")
    graph_builder.add_edge("analyze_failure_reason", "generate_action_plan")
    graph_builder.add_edge("generate_action_plan", END)

    memory = MemorySaver()
    return graph_builder.compile(checkpointer=memory)


def run_analysis(
    conversation_text: str,
    api_key: str,
    model_candidates: list[str],
    timeout_seconds: int,
    max_retries: int,
    call_id: str | None = None,
) -> dict[str, Any]:
    """Run the full analysis pipeline and return combined result."""
    graph = get_analysis_graph(api_key, model_candidates, timeout_seconds, max_retries)
    initial: CallAnalysisState = {
        "conversation_text": conversation_text,
        "call_id": call_id,
    }
    config = {"configurable": {"thread_id": "default"}}
    final_state = graph.invoke(initial, config)

    return {
        "call_id": final_state.get("call_id"),
        "purpose": final_state.get("purpose_result"),
        "failure_reason": final_state.get("failure_reason_result"),
        "action_plan": final_state.get("action_plan_result"),
    }
