function toStringOr(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function toStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toBooleanOr(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return fallback;
}

export function validateConversationInput(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }
  if (!Array.isArray(body.conversation) || body.conversation.length === 0) {
    return { ok: false, error: "Missing or invalid 'conversation' array." };
  }
  for (let i = 0; i < body.conversation.length; i += 1) {
    const msg = body.conversation[i];
    if (!msg || typeof msg !== "object") {
      return { ok: false, error: `Message ${i} must be an object.` };
    }
    if (typeof msg.role !== "string" || typeof msg.content !== "string") {
      return { ok: false, error: `Message ${i} must include string fields 'role' and 'content'.` };
    }
  }
  return { ok: true, error: "" };
}

export function normalizePurposeResult(data) {
  const obj = data && typeof data === "object" ? data : {};
  const confidence = toStringOr(obj.confidence, "medium").toLowerCase();
  return {
    purpose: toStringOr(obj.purpose, "other"),
    confidence: ["high", "medium", "low"].includes(confidence) ? confidence : "medium",
    summary: toStringOr(obj.summary),
  };
}

export function normalizeFailureAnalysisResult(data) {
  const obj = data && typeof data === "object" ? data : {};
  const business = obj.business_operational && typeof obj.business_operational === "object"
    ? obj.business_operational
    : {};
  const agentic = obj.agentic_workflow && typeof obj.agentic_workflow === "object"
    ? obj.agentic_workflow
    : {};

  return {
    business_operational: {
      reason_category: toStringOr(business.reason_category, "other"),
      explanation: toStringOr(business.explanation),
      evidence: toStringArray(business.evidence),
    },
    agentic_workflow: {
      has_agentic_issues: toBooleanOr(agentic.has_agentic_issues, false),
      issue_types: toStringArray(agentic.issue_types),
      explanation: toStringOr(agentic.explanation),
      evidence: toStringArray(agentic.evidence),
    },
    combined_summary: toStringOr(obj.combined_summary),
    immediate_actions: toStringArray(obj.immediate_actions),
  };
}

export function normalizeImprovementActionsResult(data) {
  const obj = data && typeof data === "object" ? data : {};
  return {
    summary: toStringOr(obj.summary),
    improved_prompts: toStringArray(obj.improved_prompts),
    new_workflow_steps: toStringArray(obj.new_workflow_steps),
    process_redesign: toStringArray(obj.process_redesign),
    alternative_approaches: toStringArray(obj.alternative_approaches),
    priority_actions: toStringArray(obj.priority_actions),
  };
}
