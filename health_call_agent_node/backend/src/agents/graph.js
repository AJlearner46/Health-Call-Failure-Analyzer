import * as z from "zod";
import { StateGraph, StateSchema, START, END, MemorySaver } from "@langchain/langgraph";

import { classifyPurpose, analyzeFailure, suggestWorkflowImprovements } from "./nodes.js";

const CallAnalysisState = new StateSchema({
  conversation_text: z.string(),
  call_id: z.string().nullable().optional(),
  purpose_result: z.record(z.any()).optional(),
  purpose_summary: z.string().optional(),
  purpose_label: z.string().optional(),
  model_used: z.string().optional(),
  failure_analysis_result: z.record(z.any()).optional(),
  has_agentic_issues: z.boolean().optional(),
  decision_path: z.string().optional(),
  improvement_actions_result: z.record(z.any()).nullable().optional(),
});

export function getAnalysisGraph(apiKey, modelCandidates, timeoutSeconds, maxRetries) {
  const routeAfterFailure = (state) => (state.has_agentic_issues ? "run_agent3" : "end");

  const graphBuilder = new StateGraph(CallAnalysisState)
    .addNode("classify_purpose", (state) =>
      classifyPurpose(state, apiKey, modelCandidates, timeoutSeconds, maxRetries),
    )
    .addNode("analyze_failure", (state) =>
      analyzeFailure(state, apiKey, modelCandidates, timeoutSeconds, maxRetries),
    )
    .addNode("suggest_workflow_improvements", (state) =>
      suggestWorkflowImprovements(state, apiKey, modelCandidates, timeoutSeconds, maxRetries),
    )
    .addEdge(START, "classify_purpose")
    .addEdge("classify_purpose", "analyze_failure")
    .addConditionalEdges("analyze_failure", routeAfterFailure, {
      run_agent3: "suggest_workflow_improvements",
      end: END,
    })
    .addEdge("suggest_workflow_improvements", END);

  const memory = new MemorySaver();
  return graphBuilder.compile({ checkpointer: memory });
}

export async function runAnalysis({
  conversationText,
  apiKey,
  modelCandidates,
  timeoutSeconds,
  maxRetries,
  callId = null,
}) {
  const graph = getAnalysisGraph(apiKey, modelCandidates, timeoutSeconds, maxRetries);

  const initialState = {
    conversation_text: conversationText,
    call_id: callId,
  };

  const config = { configurable: { thread_id: "default" } };
  const finalState = await graph.invoke(initialState, config);

  return {
    call_id: finalState.call_id,
    purpose: finalState.purpose_result,
    failure_analysis: finalState.failure_analysis_result,
    has_agentic_issues: Boolean(finalState.has_agentic_issues),
    improvement_actions: finalState.improvement_actions_result || null,
    decision: finalState.decision_path || "frontend_only",
  };
}

