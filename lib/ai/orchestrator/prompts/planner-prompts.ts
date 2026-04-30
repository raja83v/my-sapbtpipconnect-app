/**
 * Planner Agent prompts.
 *
 * The Planner consumes a `RequirementsBrief` plus tenant capabilities and any
 * neighbour iFlows from the catalog and produces an `IntegrationBlueprint`
 * describing the high-level architecture and which specialist agents to
 * dispatch in parallel.
 */

export const PLANNER_SYSTEM_PROMPT = `You are a senior SAP CPI integration architect. Given a structured RequirementsBrief and tenant capabilities, you produce an IntegrationBlueprint that drives a multi-agent build.

Choose the simplest pattern that satisfies the requirements. Prefer a Pipeline pattern unless splitting/aggregating/branching is actually needed.

Respond with a single JSON object — no prose, no markdown fences:
{
  "pattern": "PointToPoint" | "PublishSubscribe" | "ContentBasedRouter" | "Splitter" | "Aggregator" | "ScatterGather" | "Pipeline" | "RecipientList",
  "specialists": [
    { "name": "ADAPTER_SPECIALIST" | "MAPPING_SPECIALIST" | "SCRIPT_SPECIALIST" | "EXTERNALIZATION_SPECIALIST" | "ERROR_HANDLER_SPECIALIST" | "DECOMPOSITION_SPECIALIST",
      "brief": string,                   // short instruction for the specialist
      "priority": number                 // 1 (highest) .. 5
    }
  ],
  "localProcesses": [
    { "id": string, "name": string, "responsibility": string }
  ],
  "exceptionStrategy": "NONE" | "BASIC" | "RETRY_DLC" | "RETRY_DLC_ALERT",
  "externalizationTargets": string[],   // labels of values to externalize
  "rationale": string                    // 2-3 sentences why this pattern
}

Rules:
- ADAPTER_SPECIALIST is mandatory for any flow with a sender and at least one receiver.
- Include MAPPING_SPECIALIST iff payload format differs between sender and receiver, or the user asked for transformation.
- Include SCRIPT_SPECIALIST for custom Groovy/JS logic, header construction, or audit logging.
- Include EXTERNALIZATION_SPECIALIST whenever externalizationTargets is non-empty.
- Include ERROR_HANDLER_SPECIALIST whenever exceptionStrategy != "NONE".
- Include DECOMPOSITION_SPECIALIST when the flow has 8+ steps OR multiple distinct concerns.
- Local processes should be independently testable units (e.g. "Build IDoc Headers", "Validate Payload").
- Never invent partner IDs or URLs — refer to externalization placeholders.
- Keep each specialist "brief" under 600 characters. Be terse and bulletable; do NOT enumerate every endpoint, credential, or field name. The specialists will receive the full RequirementsBrief separately and can fill in details.
- Keep "rationale" under 400 characters.`;

export interface PlannerPromptInputs {
  requirementsBriefJson: string;
  tenantCapabilitiesSummary?: string;
  /** Up to 3 neighbour iFlow summaries from the catalog. */
  neighborIFlows?: { name: string; summary: string; componentTypes?: string[] }[];
}

export function buildPlannerPrompt(inputs: PlannerPromptInputs): string {
  const lines: string[] = [];
  lines.push('## Requirements Brief');
  lines.push('```json');
  lines.push(inputs.requirementsBriefJson);
  lines.push('```');
  if (inputs.tenantCapabilitiesSummary) {
    lines.push('');
    lines.push('## Tenant capabilities');
    lines.push(inputs.tenantCapabilitiesSummary);
  }
  if (inputs.neighborIFlows && inputs.neighborIFlows.length > 0) {
    lines.push('');
    lines.push('## Similar deployed iFlows in this tenant');
    for (const n of inputs.neighborIFlows) {
      lines.push(`- **${n.name}**: ${n.summary}` +
        (n.componentTypes && n.componentTypes.length > 0
          ? ` _(uses ${n.componentTypes.join(', ')})_`
          : ''));
    }
  }
  lines.push('');
  lines.push('Produce the IntegrationBlueprint JSON now.');
  return lines.join('\n');
}
