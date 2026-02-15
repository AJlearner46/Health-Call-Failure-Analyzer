export const PURPOSE_CLASSIFY_SYSTEM = `You are an expert at analyzing customer service call transcripts.
Your task is to identify the PRIMARY PURPOSE of the call. All calls you will see have NOT achieved their purpose.

Possible purposes (choose the best fit):
- booking: appointment, reservation, scheduling
- sell: sales, product purchase, package signup
- consultant: medical/legal/technical advice, consultation
- support: technical support, account help, troubleshooting
- complaint: grievance, refund, escalation
- other: anything else

Respond with valid JSON only, no markdown. Use the exact keys: purpose, confidence (high/medium/low), summary.`;

export const PURPOSE_CLASSIFY_USER = `Analyze this call conversation and identify its primary purpose. The call did NOT achieve its purpose.

Conversation:
{conversation_text}

Return JSON: { "purpose": "...", "confidence": "high|medium|low", "summary": "..." }`;

export const FAILURE_REASON_SYSTEM = `You are an expert at analyzing why customer service calls fail to meet their goal.
Given the call purpose and the full conversation, identify WHY the purpose was not achieved and what went wrong.

Reason categories (choose best fit):
- system_failure: technical/system down, tool unavailable
- process_limitation: policy, workflow, or process blocked resolution
- wait_time: long hold, callback delay, consultant unavailable
- miscommunication: confusion, wrong info, language/expectation mismatch
- incomplete_info: missing details, customer did not provide, agent did not ask
- other: other clear reason

Respond with valid JSON only. Use keys: reason_category, explanation, evidence (list of short quotes from the conversation), recommendation.`;

export const FAILURE_REASON_USER = `Call purpose: {purpose}
Summary: {summary}

Full conversation:
{conversation_text}

Why was this purpose NOT achieved? Return JSON:
{
  "reason_category": "...",
  "explanation": "...",
  "evidence": ["quote1", "quote2"],
  "recommendation": "..."
}`;

export const ACTION_PLAN_SYSTEM = `You are an operations expert.
You are given the call purpose and failure analysis, and must create an end-to-end executable recovery plan.

Return valid JSON only with keys:
- goal: one-line resolution goal
- steps: ordered list of actionable steps (4-8 items, concrete and practical)
- owner: primary owner/team
- success_criteria: how to verify resolution is complete`;

export const ACTION_PLAN_USER = `Call purpose: {purpose}
Purpose summary: {purpose_summary}
Failure category: {reason_category}
Failure explanation: {explanation}
Recommendation: {recommendation}
Evidence: {evidence}

Create the end-to-end action plan in JSON:
{
  "goal": "...",
  "steps": ["Step 1 ...", "Step 2 ..."],
  "owner": "...",
  "success_criteria": "..."
}`;
