import { Router } from "express";

import { getSettings } from "../config.js";
import { runAnalysis } from "../agents/graph.js";
import { validateConversationInput } from "../schemas/models.js";

function conversationToText(messages) {
  return messages
    .map((message) => `${message.role || "unknown"}: ${message.content || ""}`)
    .join("\n");
}

function shortErrorMessage(error) {
  const text = String(error?.message || error || "").replace(/\n/g, " ").trim();
  if (text.includes("RESOURCE_EXHAUSTED") || text.includes("429")) {
    return "Gemini quota/rate limit exceeded. Retry later or use another API key/project.";
  }
  if (text.length > 320) {
    return `${text.slice(0, 320)}...`;
  }
  return text;
}

export const router = Router();

router.post("/analyze", async (req, res) => {
  const settings = getSettings();
  if (!settings.isConfigured) {
    return res.status(503).json({ detail: "GOOGLE_API_KEY not set. Add it to .env or environment." });
  }

  const validation = validateConversationInput(req.body);
  if (!validation.ok) {
    return res.status(400).json({ detail: validation.error });
  }

  const conversationText = conversationToText(req.body.conversation);
  try {
    const result = await runAnalysis({
      conversationText,
      apiKey: settings.googleApiKey,
      modelCandidates: settings.geminiModels,
      timeoutSeconds: settings.geminiTimeoutSeconds,
      maxRetries: settings.geminiMaxRetries,
      callId: null,
    });

    return res.json({
      purpose: result.purpose,
      failure_analysis: result.failure_analysis,
      has_agentic_issues: result.has_agentic_issues,
      improvement_actions: result.improvement_actions,
      decision: result.decision,
      call_id: result.call_id ?? null,
    });
  } catch (error) {
    return res.status(502).json({ detail: `Analysis failed. ${shortErrorMessage(error)}` });
  }
});

router.post("/analyze-call", async (req, res) => {
  const settings = getSettings();
  if (!settings.isConfigured) {
    return res.status(503).json({ detail: "GOOGLE_API_KEY not set. Add it to .env or environment." });
  }

  const validation = validateConversationInput(req.body);
  if (!validation.ok) {
    return res.status(400).json({ detail: validation.error });
  }

  const conversationText = conversationToText(req.body.conversation);
  try {
    const result = await runAnalysis({
      conversationText,
      apiKey: settings.googleApiKey,
      modelCandidates: settings.geminiModels,
      timeoutSeconds: settings.geminiTimeoutSeconds,
      maxRetries: settings.geminiMaxRetries,
      callId: req.body.call_id || null,
    });

    return res.json({
      purpose: result.purpose,
      failure_analysis: result.failure_analysis,
      has_agentic_issues: result.has_agentic_issues,
      improvement_actions: result.improvement_actions,
      decision: result.decision,
      call_id: result.call_id ?? req.body.call_id ?? null,
    });
  } catch (error) {
    return res.status(502).json({ detail: `Analysis failed. ${shortErrorMessage(error)}` });
  }
});

router.get("/health", (_req, res) => {
  const settings = getSettings();
  return res.json({
    status: "ok",
    gemini_configured: settings.isConfigured,
    gemini_model: settings.geminiModel,
    gemini_models: settings.geminiModels,
    gemini_timeout_seconds: settings.geminiTimeoutSeconds,
    gemini_max_retries: settings.geminiMaxRetries,
  });
});
