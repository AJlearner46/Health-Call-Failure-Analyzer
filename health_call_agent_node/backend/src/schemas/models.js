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

export function normalizeFailureReasonResult(data) {
  const obj = data && typeof data === "object" ? data : {};
  return {
    reason_category: toStringOr(obj.reason_category, "other"),
    explanation: toStringOr(obj.explanation),
    evidence: toStringArray(obj.evidence),
    recommendation: toStringOr(obj.recommendation),
  };
}

export function normalizeActionPlanResult(data) {
  const obj = data && typeof data === "object" ? data : {};
  return {
    goal: toStringOr(obj.goal),
    steps: toStringArray(obj.steps),
    owner: toStringOr(obj.owner),
    success_criteria: toStringOr(obj.success_criteria),
  };
}
