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

export const FAILURE_ANALYSIS_SYSTEM = `You are an expert at diagnosing failed customer service workflows.
Given call purpose and full conversation, identify WHY the purpose was not achieved across TWO dimensions:

1) BUSINESS / OPERATIONAL failure:
- system_failure: technical/system down, tool unavailable
- process_limitation: policy, workflow, or process blocked resolution
- wait_time: long hold, callback delay, consultant unavailable
- other: other clear reason

2) AGENTIC WORKFLOW failure:
- misinterpretation: agent misunderstood user intent/context
- logic_error: wrong reasoning path or bad decision sequence
- missing_probe: agent did not ask needed follow-up questions
- handoff_error: poor escalation/handoff workflow
- prompt_gap: response quality impacted by prompt/workflow design
- none: no clear agentic issue

Respond with valid JSON only using keys:
- business_operational: { reason_category, explanation, evidence }
- agentic_workflow: { has_agentic_issues, issue_types, explanation, evidence }
- combined_summary
- immediate_actions (list of quick actions)
Do not output markdown.`;

export const FAILURE_ANALYSIS_USER = `Call purpose: {purpose}
Summary: {summary}

Full conversation:
{conversation_text}

Analyze both failure dimensions and return JSON:
{
  "business_operational": {
    "reason_category": "...",
    "explanation": "...",
    "evidence": ["quote1", "quote2"]
  },
  "agentic_workflow": {
    "has_agentic_issues": true,
    "issue_types": ["misinterpretation", "logic_error"],
    "explanation": "...",
    "evidence": ["quoteA", "quoteB"]
  },
  "combined_summary": "...",
  "immediate_actions": ["...", "..."]
}`;

export const IMPROVEMENT_ACTIONS_SYSTEM = `You are an expert in AI workflow optimization.
You are given purpose and failure analysis with agentic workflow issues.
Create concrete improvements to fix agent design and execution quality.

Return valid JSON only with keys:
- summary
- improved_prompts (list)
- new_workflow_steps (list)
- process_redesign (list)
- alternative_approaches (list)
- priority_actions (list, most important first)`;

export const IMPROVEMENT_ACTIONS_USER = `Call purpose: {purpose}
Purpose summary: {purpose_summary}
Business/Operational reason: {business_reason_category}
Business explanation: {business_explanation}
Agentic issues present: {has_agentic_issues}
Agentic issue types: {agentic_issue_types}
Agentic explanation: {agentic_explanation}
Agentic evidence: {agentic_evidence}

Generate workflow improvement actions in JSON:
{
  "summary": "...",
  "improved_prompts": ["..."],
  "new_workflow_steps": ["..."],
  "process_redesign": ["..."],
  "alternative_approaches": ["..."],
  "priority_actions": ["..."]
}`;
