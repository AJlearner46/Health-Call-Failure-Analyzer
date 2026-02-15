import * as z from "zod";
import { StateGraph, StateSchema, START, END, MemorySaver } from "@langchain/langgraph";

import { classifyPurpose, analyzeFailureReason, generateActionPlan } from "./nodes.js";

const CallAnalysisState = new StateSchema({
  conversation_text: z.string(),
  call_id: z.string().nullable().optional(),
  purpose_result: z.record(z.any()).optional(),
  purpose_summary: z.string().optional(),
  purpose_label: z.string().optional(),
  model_used: z.string().optional(),
  failure_reason_result: z.record(z.any()).optional(),
  action_plan_result: z.record(z.any()).optional(),
});

export function getAnalysisGraph(apiKey, modelCandidates, timeoutSeconds, maxRetries) {
  const graphBuilder = new StateGraph(CallAnalysisState)
    .addNode("classify_purpose", (state) =>
      classifyPurpose(state, apiKey, modelCandidates, timeoutSeconds, maxRetries),
    )
    .addNode("analyze_failure_reason", (state) =>
      analyzeFailureReason(state, apiKey, modelCandidates, timeoutSeconds, maxRetries),
    )
    .addNode("generate_action_plan", (state) =>
      generateActionPlan(state, apiKey, modelCandidates, timeoutSeconds, maxRetries),
    )
    .addEdge(START, "classify_purpose")
    .addEdge("classify_purpose", "analyze_failure_reason")
    .addEdge("analyze_failure_reason", "generate_action_plan")
    .addEdge("generate_action_plan", END);

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
    failure_reason: finalState.failure_reason_result,
    action_plan: finalState.action_plan_result,
  };
}

