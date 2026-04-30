/**
 * Clarifier Agent
 *
 * Conversational requirements gatherer. Takes the original description plus any
 * follow-up answers from the user and emits a structured `RequirementsBrief`.
 * When information is missing, it returns `openQuestions[]` instead of guessing.
 *
 * The orchestrator drives the loop: while `openQuestions.length > 0`, it
 * surfaces them in chat, waits for answers, and re-runs the agent until the
 * brief reports `confidence >= 0.8` (or the user explicitly asks to proceed).
 */

import type { LanguageModel } from 'ai';
import { BaseAgent } from '../agent-base';
import type {
  AgentName,
  ChatMessageMetadata,
  PipelineContext,
  RequirementsBrief,
} from '../pipeline-state';
import { runText } from '@/lib/ai/runtime/text';
import { parseAIJson } from '../utils/json-cleaner';
import {
  CLARIFIER_SYSTEM_PROMPT,
  buildClarifierPrompt,
} from '../prompts/clarifier-prompts';

export interface ClarifierInput {
  description: string;
  tenantCapabilitiesSummary?: string;
  chatHistory?: { role: 'user' | 'assistant'; content: string; metadata?: ChatMessageMetadata }[];
  previousBrief?: RequirementsBrief;
}

export type ClarifierOutput = RequirementsBrief;

export class ClarifierAgent extends BaseAgent<ClarifierInput, ClarifierOutput> {
  readonly name: AgentName = 'CLARIFIER';
  readonly model: LanguageModel | null = null;
  readonly description =
    'Interviews the user to produce a complete RequirementsBrief; emits follow-up questions when info is missing.';

  protected async run(
    input: ClarifierInput,
    _context: PipelineContext,
  ): Promise<{ output: ClarifierOutput; tokensUsed: number }> {
    const prompt = buildClarifierPrompt(input);
    const response = await runText({
      system: CLARIFIER_SYSTEM_PROMPT,
      prompt,
      modelKind: 'orchestrator',
      temperature: 0.2,
      maxTokens: 2000,
      jsonMode: true,
    });

    let parsed: RequirementsBrief;
    try {
      parsed = parseAIJson<RequirementsBrief>(response.text);
    } catch (err) {
      throw new Error(
        `Clarifier returned invalid JSON: ${(err as Error).message}\n---\n${response.text.slice(0, 600)}`,
      );
    }

    // Light defensive normalization
    parsed.openQuestions = Array.isArray(parsed.openQuestions)
      ? parsed.openQuestions
      : [];
    parsed.externalizationHints = Array.isArray(parsed.externalizationHints)
      ? parsed.externalizationHints
      : [];
    parsed.partnerIds = Array.isArray(parsed.partnerIds) ? parsed.partnerIds : [];
    parsed.additionalRequirements = Array.isArray(parsed.additionalRequirements)
      ? parsed.additionalRequirements
      : [];
    if (typeof parsed.confidence !== 'number') {
      parsed.confidence = parsed.openQuestions.length === 0 ? 0.85 : 0.5;
    }

    return { output: parsed, tokensUsed: response.usage.totalTokens };
  }
}
