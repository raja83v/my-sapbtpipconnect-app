/**
 * Planner Agent
 *
 * Reads a RequirementsBrief plus tenant capabilities and produces an
 * IntegrationBlueprint that drives parallel specialist dispatch.
 */

import type { LanguageModel } from 'ai';
import { BaseAgent } from '../agent-base';
import type {
  AgentName,
  IntegrationBlueprint,
  PipelineContext,
  RequirementsBrief,
} from '../pipeline-state';
import { runText } from '@/lib/ai/runtime/text';
import { parseAIJson } from '../utils/json-cleaner';
import {
  PLANNER_SYSTEM_PROMPT,
  buildPlannerPrompt,
} from '../prompts/planner-prompts';

export interface PlannerInput {
  requirementsBrief: RequirementsBrief;
  tenantCapabilitiesSummary?: string;
  neighborIFlows?: { name: string; summary: string; componentTypes?: string[] }[];
}

export type PlannerOutput = IntegrationBlueprint;

export class PlannerAgent extends BaseAgent<PlannerInput, PlannerOutput> {
  readonly name: AgentName = 'PLANNER';
  readonly model: LanguageModel | null = null;
  readonly description =
    'Produces a high-level integration blueprint and decides which specialists to dispatch in parallel.';

  protected async run(
    input: PlannerInput,
    _context: PipelineContext,
  ): Promise<{ output: PlannerOutput; tokensUsed: number }> {
    const prompt = buildPlannerPrompt({
      requirementsBriefJson: JSON.stringify(input.requirementsBrief, null, 2),
      tenantCapabilitiesSummary: input.tenantCapabilitiesSummary,
      neighborIFlows: input.neighborIFlows,
    });

    const response = await runText({
      system: PLANNER_SYSTEM_PROMPT,
      prompt,
      modelKind: 'orchestrator',
      temperature: 0.2,
      // The blueprint can run long when the brief enumerates adapters,
      // mappings, scripts and externalization targets in a single string.
      // 2500 was hitting truncation mid-string at ~9KB; 6000 leaves
      // comfortable headroom while still bounding cost.
      maxTokens: 6000,
      jsonMode: true,
    });

    let parsed: IntegrationBlueprint;
    try {
      parsed = parseAIJson<IntegrationBlueprint>(response.text);
    } catch (err) {
      throw new Error(
        `Planner returned invalid JSON: ${(err as Error).message}\n---\n${response.text.slice(0, 600)}`,
      );
    }

    parsed.specialists = Array.isArray(parsed.specialists) ? parsed.specialists : [];
    parsed.localProcesses = Array.isArray(parsed.localProcesses) ? parsed.localProcesses : [];
    parsed.externalizationTargets = Array.isArray(parsed.externalizationTargets)
      ? parsed.externalizationTargets
      : [];
    if (!parsed.exceptionStrategy) parsed.exceptionStrategy = 'NONE';

    return { output: parsed, tokensUsed: response.usage.totalTokens };
  }
}
