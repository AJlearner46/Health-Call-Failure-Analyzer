import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

import {
  PURPOSE_CLASSIFY_SYSTEM,
  PURPOSE_CLASSIFY_USER,
  FAILURE_ANALYSIS_SYSTEM,
  FAILURE_ANALYSIS_USER,
  IMPROVEMENT_ACTIONS_SYSTEM,
  IMPROVEMENT_ACTIONS_USER,
} from "./prompts.js";
import {
  normalizePurposeResult,
  normalizeFailureAnalysisResult,
  normalizeImprovementActionsResult,
} from "../schemas/models.js";

function getLlm(apiKey, modelName, timeoutSeconds, maxRetries) {
  return new ChatGoogleGenerativeAI({
    apiKey,
    model: modelName,
    modelName,
    temperature: 0.2,
    maxRetries,
    timeout: timeoutSeconds * 1000,
  });
}

function shouldTryFallback(errorText) {
  const text = String(errorText || "");
  return [
    "429",
    "RESOURCE_EXHAUSTED",
    "404",
    "NOT_FOUND",
    "400",
    "INVALID_ARGUMENT",
    "Developer instruction is not",
  ].some((code) => text.includes(code));
}

function normalizeResponseText(response) {
  const content = response && Object.prototype.hasOwnProperty.call(response, "content")
    ? response.content
    : String(response || "");

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  return String(content || "");
}

function parseJsonFromResponse(text) {
  let candidate = String(text || "").trim();

  if (candidate.startsWith("```")) {
    candidate = candidate
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("Model response was not valid JSON.");
  }
}

function fillTemplate(template, values) {
  return template.replace(/\{([a-z_]+)\}/gi, (_, key) => {
    const value = values[key];
    if (Array.isArray(value)) {
      return value.join("; ");
    }
    return value == null ? "" : String(value);
  });
}

async function invokeWithModelFallback(messages, apiKey, modelCandidates, timeoutSeconds, maxRetries) {
  if (!Array.isArray(modelCandidates) || modelCandidates.length === 0) {
    throw new Error("No Gemini models configured.");
  }

  let lastError = null;
  for (const modelName of modelCandidates) {
    try {
      const llm = getLlm(apiKey, modelName, timeoutSeconds, maxRetries);
      const response = await llm.invoke(messages);
      return { response, usedModel: modelName };
    } catch (error) {
      lastError = error;
      const errorText = String(error?.message || error);
      if (shouldTryFallback(errorText)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`All Gemini model candidates failed: ${String(lastError?.message || lastError)}`);
}

export async function classifyPurpose(state, apiKey, modelCandidates, timeoutSeconds, maxRetries) {
  const conversationText = state.conversation_text;
  const messages = [
    new SystemMessage(PURPOSE_CLASSIFY_SYSTEM),
    new HumanMessage(fillTemplate(PURPOSE_CLASSIFY_USER, { conversation_text: conversationText })),
  ];

  const { response, usedModel } = await invokeWithModelFallback(
    messages,
    apiKey,
    modelCandidates,
    timeoutSeconds,
    maxRetries,
  );

  const data = parseJsonFromResponse(normalizeResponseText(response));
  const purposeResult = normalizePurposeResult(data);

  return {
    purpose_result: purposeResult,
    purpose_summary: purposeResult.summary,
    purpose_label: purposeResult.purpose,
    model_used: usedModel,
  };
}

export async function analyzeFailure(state, apiKey, modelCandidates, timeoutSeconds, maxRetries) {
  const conversationText = state.conversation_text;
  const purposeLabel = state.purpose_label || "other";
  const purposeSummary = state.purpose_summary || "";

  const preferredModel = state.model_used;
  const deduped = [];
  for (const name of [preferredModel, ...modelCandidates]) {
    if (name && !deduped.includes(name)) {
      deduped.push(name);
    }
  }

  const messages = [
    new SystemMessage(FAILURE_ANALYSIS_SYSTEM),
    new HumanMessage(
      fillTemplate(FAILURE_ANALYSIS_USER, {
        purpose: purposeLabel,
        summary: purposeSummary,
        conversation_text: conversationText,
      }),
    ),
  ];

  const { response, usedModel } = await invokeWithModelFallback(
    messages,
    apiKey,
    deduped,
    timeoutSeconds,
    maxRetries,
  );

  const data = parseJsonFromResponse(normalizeResponseText(response));
  const failureResult = normalizeFailureAnalysisResult(data);
  const hasAgenticIssues = Boolean(failureResult.agentic_workflow?.has_agentic_issues);

  return {
    failure_analysis_result: failureResult,
    has_agentic_issues: hasAgenticIssues,
    decision_path: hasAgenticIssues ? "agent3_required" : "frontend_only",
    model_used: usedModel,
  };
}

export async function suggestWorkflowImprovements(state, apiKey, modelCandidates, timeoutSeconds, maxRetries) {
  const purposeLabel = state.purpose_label || "other";
  const purposeSummary = state.purpose_summary || "";
  const failure = state.failure_analysis_result || {};
  const business = failure.business_operational || {};
  const agentic = failure.agentic_workflow || {};

  const preferredModel = state.model_used;
  const deduped = [];
  for (const name of [preferredModel, ...modelCandidates]) {
    if (name && !deduped.includes(name)) {
      deduped.push(name);
    }
  }

  const messages = [
    new SystemMessage(IMPROVEMENT_ACTIONS_SYSTEM),
    new HumanMessage(
      fillTemplate(IMPROVEMENT_ACTIONS_USER, {
        purpose: purposeLabel,
        purpose_summary: purposeSummary,
        business_reason_category: business.reason_category || "other",
        business_explanation: business.explanation || "",
        has_agentic_issues: Boolean(agentic.has_agentic_issues),
        agentic_issue_types: Array.isArray(agentic.issue_types) ? agentic.issue_types : [],
        agentic_explanation: agentic.explanation || "",
        agentic_evidence: Array.isArray(agentic.evidence) ? agentic.evidence : [],
      }),
    ),
  ];

  const { response, usedModel } = await invokeWithModelFallback(
    messages,
    apiKey,
    deduped,
    timeoutSeconds,
    maxRetries,
  );

  const data = parseJsonFromResponse(normalizeResponseText(response));
  const improvementActions = normalizeImprovementActionsResult(data);

  return {
    improvement_actions_result: improvementActions,
    decision_path: "agent3_executed",
    model_used: usedModel,
  };
}
