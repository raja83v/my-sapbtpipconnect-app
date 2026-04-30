/**
 * Patch Agent
 *
 * Applies a free-form user "modify request" to the current IFlowDesign while
 * the pipeline is in AWAITING_APPROVAL / DRAFTED / COMPLETED. Emits a typed
 * `DesignPatch` (id, instruction, structured diffs, rationale, timestamp)
 * plus the updated design.
 *
 * Constraints enforced via the system prompt:
 *   - Touch the *minimum* surface area required to satisfy the instruction.
 *   - Reuse existing adapter/script/mapping ids; do not rename them.
 *   - Never change `integrationPattern` unless the user explicitly asks.
 *   - Stay within the tenant's available adapters list.
 *
 * Model: orchestrator (low temperature, JSON-only output).
 */

import type { LanguageModel } from "ai";
import { BaseAgent } from "../agent-base";
import type {
  AgentName,
  DesignDiff,
  DesignPatch,
  PipelineContext,
  TenantCapabilities,
} from "../pipeline-state";
import type { IFlowDesign } from "@/components/ai/v2/specialized/iflow-creator/types";
import { runText } from "@/lib/ai/runtime/text";
import { parseAIJson } from "../utils/json-cleaner";

// ============================================================================
// Input / Output Types
// ============================================================================

export interface PatchAgentInput {
  /** Current authoritative design (post-reviewer / post-fix). */
  design: IFlowDesign;
  /** Free-form user instruction (the MODIFY_REQUEST chat message body). */
  instruction: string;
  /** Tenant capability constraints. */
  tenantCapabilities: TenantCapabilities;
  /** Optional short transcript of the recent design conversation, oldest first. */
  recentChat?: { role: "user" | "assistant"; content: string }[];
}

export interface PatchAgentOutput {
  patch: DesignPatch;
  updatedDesign: IFlowDesign;
}

// ============================================================================
// Prompts
// ============================================================================

const SYSTEM_PROMPT = `You are the SAP CPI iFlow Patch Agent.

Your job is to apply a single user modification to an existing IFlowDesign JSON
with the minimum changes required. You output ONLY a JSON object — no prose,
no markdown fences.

Rules:
1. Make the SMALLEST set of changes that satisfies the instruction.
2. Preserve every id, name, and reference that is unrelated to the change.
3. Never change \`integrationPattern\` unless the user explicitly requests a
   different pattern.
4. Only use adapters from the tenant's available adapters list.
5. Keep \`{{paramName}}\` placeholders intact.
6. If the instruction is ambiguous or unsafe, return an empty diff list and
   explain in \`rationale\`.

Output schema (strict):
{
  "diffs": [
    {
      "path": "string — dot/bracket path, e.g. \\"adapters[0].config.connectionTimeout\\"",
      "before": <any — value before>,
      "after": <any — value after>,
      "reason": "string — short why"
    }
  ],
  "rationale": "string — 1-3 sentences summarizing what you changed and why",
  "updatedDesign": { /* the full IFlowDesign with diffs applied */ }
}`;

function buildUserPrompt(input: PatchAgentInput): string {
  const lines: string[] = [];
  lines.push("## USER MODIFY REQUEST");
  lines.push(input.instruction.trim());

  if (input.recentChat && input.recentChat.length > 0) {
    lines.push("");
    lines.push("## RECENT CONVERSATION (for context)");
    for (const msg of input.recentChat.slice(-6)) {
      lines.push(`- ${msg.role}: ${msg.content.slice(0, 400)}`);
    }
  }

  lines.push("");
  lines.push("## TENANT CONSTRAINTS");
  lines.push(
    `Available adapters: ${input.tenantCapabilities.availableAdapters.join(", ")}`,
  );
  lines.push(`Runtime: ${input.tenantCapabilities.runtimeVersion}`);
  if (input.tenantCapabilities.securityMaterials.length > 0) {
    lines.push(
      `Security materials: ${input.tenantCapabilities.securityMaterials.join(", ")}`,
    );
  }

  lines.push("");
  lines.push("## CURRENT DESIGN (authoritative)");
  lines.push("```json");
  lines.push(JSON.stringify(input.design, null, 2));
  lines.push("```");

  lines.push("");
  lines.push("Return ONLY the JSON object described in the system prompt.");
  return lines.join("\n");
}

// ============================================================================
// Agent
// ============================================================================

export class PatchAgent extends BaseAgent<PatchAgentInput, PatchAgentOutput> {
  readonly name: AgentName = "PATCH";
  readonly model: LanguageModel | null = null;
  readonly description =
    "Applies a single user modify request to the current IFlowDesign as a minimal patch.";

  protected async run(
    input: PatchAgentInput,
    _context: PipelineContext,
  ): Promise<{ output: PatchAgentOutput; tokensUsed: number }> {
    const response = await runText({
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(input),
      modelKind: "orchestrator",
      temperature: 0.1,
      maxTokens: 4000,
      jsonMode: true,
    });

    let parsed: unknown;
    try {
      parsed = parseAIJson(response.text);
    } catch (err) {
      throw new Error(
        `PatchAgent returned invalid JSON: ${(err as Error).message}\n---\n${response.text.slice(0, 600)}`,
      );
    }

    const obj = (parsed ?? {}) as {
      diffs?: unknown;
      rationale?: unknown;
      updatedDesign?: unknown;
    };

    const diffs: DesignDiff[] = Array.isArray(obj.diffs)
      ? (obj.diffs as DesignDiff[]).filter(
          (d) => d && typeof d === "object" && typeof d.path === "string",
        )
      : [];
    const rationale = typeof obj.rationale === "string" ? obj.rationale : "";
    const updatedDesign =
      obj.updatedDesign && typeof obj.updatedDesign === "object"
        ? (obj.updatedDesign as IFlowDesign)
        : input.design;

    const patch: DesignPatch = {
      id: `patch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      instruction: input.instruction,
      diffs,
      rationale,
      appliedAt: Date.now(),
    };

    return {
      output: { patch, updatedDesign },
      tokensUsed: response.usage.totalTokens,
    };
  }
}
