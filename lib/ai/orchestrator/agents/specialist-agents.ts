/**
 * Specialist agents for the Studio multi-agent pipeline.
 *
 * All six specialists follow the same shape: they consume the planner's
 * blueprint plus a per-agent dispatch brief and emit a typed JSON envelope.
 * The Architect-as-integrator merges these envelopes into the final design.
 *
 * Each agent is a thin BaseAgent wrapper around `runText` with a dedicated
 * system prompt. Output normalization is defensive — invalid JSON throws,
 * missing arrays default to empty.
 */

import type { LanguageModel } from "ai";
import { BaseAgent } from "../agent-base";
import type {
  AdapterSpecialistOutput,
  AgentName,
  DecompositionSpecialistOutput,
  ErrorHandlerSpecialistOutput,
  ExternalizationSpecialistOutput,
  IntegrationBlueprint,
  MappingSpecialistOutput,
  PipelineContext,
  RequirementsBrief,
  ScriptSpecialistOutput,
  SpecialistDispatch,
} from "../pipeline-state";
import { runText } from "@/lib/ai/runtime/text";
import { parseAIJson } from "../utils/json-cleaner";

/**
 * Wraps `runText` with retry-on-transient-error.
 *
 * The upstream LLM proxy (LiteLLM/OpenAI) occasionally returns transient
 * failures during parallel specialist dispatch:
 *   - "401 Authentication Error, All connection attempts failed" (proxy
 *     mislabels connection-level failures as auth errors)
 *   - 429 rate limits during burst dispatch
 *   - 5xx upstream blips
 *   - low-level fetch errors (ECONNRESET, ETIMEDOUT)
 *
 * We retry up to 3x with exponential backoff (1s, 2s, 4s) + jitter so 6
 * concurrent specialist calls don't all back off in lockstep.
 */
async function runTextWithRetry(
  args: Parameters<typeof runText>[0],
): ReturnType<typeof runText> {
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await runText(args);
    } catch (err) {
      lastErr = err;
      if (!isTransientLLMError(err) || attempt === MAX_ATTEMPTS) throw err;
      const base = 1000 * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 500);
      await new Promise((r) => setTimeout(r, base + jitter));
    }
  }
  throw lastErr;
}

function isTransientLLMError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /\b(401|408|409|425|429|500|502|503|504)\b/.test(msg) ||
    /All connection attempts failed/i.test(msg) ||
    /ECONN(RESET|REFUSED|ABORTED)|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(msg) ||
    /fetch failed/i.test(msg) ||
    /socket hang up/i.test(msg)
  );
}
import {
  ADAPTER_SYSTEM_PROMPT,
  DECOMPOSITION_SYSTEM_PROMPT,
  ERROR_HANDLER_SYSTEM_PROMPT,
  EXTERNALIZATION_SYSTEM_PROMPT,
  MAPPING_SYSTEM_PROMPT,
  SCRIPT_SYSTEM_PROMPT,
  buildAdapterPrompt,
  buildDecompositionPrompt,
  buildErrorHandlerPrompt,
  buildExternalizationPrompt,
  buildMappingPrompt,
  buildScriptPrompt,
  type SpecialistPromptInputs,
} from "../prompts/specialist-prompts";

export interface SpecialistInput {
  requirementsBrief: RequirementsBrief;
  blueprint: IntegrationBlueprint;
  dispatch: SpecialistDispatch;
  tenantCapabilitiesSummary?: string;
}

abstract class SpecialistAgent<TOutput> extends BaseAgent<SpecialistInput, TOutput> {
  readonly model: LanguageModel | null = null;
  protected abstract readonly systemPrompt: string;
  protected abstract buildPrompt(inputs: SpecialistPromptInputs): string;
  protected abstract normalize(parsed: unknown): TOutput;

  protected async run(
    input: SpecialistInput,
    _context: PipelineContext,
  ): Promise<{ output: TOutput; tokensUsed: number }> {
    const prompt = this.buildPrompt({
      requirementsBrief: input.requirementsBrief,
      blueprint: input.blueprint,
      dispatch: input.dispatch,
      tenantCapabilitiesSummary: input.tenantCapabilitiesSummary,
    });
    const response = await runTextWithRetry({
      system: this.systemPrompt,
      prompt,
      modelKind: "orchestrator",
      temperature: 0.2,
      maxTokens: 12000,
      jsonMode: true,
    });
    let parsed: unknown;
    let lastError: Error | null = null;
    try {
      parsed = parseAIJson(response.text);
    } catch (err) {
      lastError = err as Error;
      // Recovery: ask the model to repair the JSON without changing semantics.
      try {
        const repair = await runTextWithRetry({
          system:
            "You repair invalid JSON. Return ONLY the corrected JSON object, no prose, no markdown fences. Preserve all keys, values, and structure exactly. Properly escape any unescaped double quotes inside string values (e.g. inline XML/Groovy/XSL).",
          prompt: `The following response should be a single JSON object but failed to parse with: ${lastError.message}\n\nRaw response:\n${response.text}`,
          modelKind: "orchestrator",
          temperature: 0,
          maxTokens: 12000,
          jsonMode: true,
        });
        parsed = parseAIJson(repair.text);
      } catch (err2) {
        throw new Error(
          `${this.name} returned invalid JSON: ${lastError.message}\n---\n${response.text.slice(0, 600)}\n---\nRepair attempt failed: ${(err2 as Error).message}`,
        );
      }
    }
    return { output: this.normalize(parsed), tokensUsed: response.usage.totalTokens };
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// ---------------------------------------------------------------------------
// AdapterSpecialistAgent
// ---------------------------------------------------------------------------

export class AdapterSpecialistAgent extends SpecialistAgent<AdapterSpecialistOutput> {
  readonly name: AgentName = "ADAPTER_SPECIALIST";
  readonly description = "Selects sender/receiver adapters and their externalized config.";
  protected readonly systemPrompt = ADAPTER_SYSTEM_PROMPT;
  protected buildPrompt = buildAdapterPrompt;
  protected normalize(parsed: unknown): AdapterSpecialistOutput {
    const obj = (parsed ?? {}) as Partial<AdapterSpecialistOutput>;
    return { adapters: asArray(obj.adapters) };
  }
}

// ---------------------------------------------------------------------------
// MappingSpecialistAgent
// ---------------------------------------------------------------------------

export class MappingSpecialistAgent extends SpecialistAgent<MappingSpecialistOutput> {
  readonly name: AgentName = "MAPPING_SPECIALIST";
  readonly description = "Generates message-mapping artifacts and refs.";
  protected readonly systemPrompt = MAPPING_SYSTEM_PROMPT;
  protected buildPrompt = buildMappingPrompt;
  protected normalize(parsed: unknown): MappingSpecialistOutput {
    const obj = (parsed ?? {}) as Partial<MappingSpecialistOutput>;
    return {
      files: asArray<{ path: string; content: string }>(obj.files),
      mappings: asArray(obj.mappings),
    };
  }
}

// ---------------------------------------------------------------------------
// ScriptSpecialistAgent
// ---------------------------------------------------------------------------

export class ScriptSpecialistAgent extends SpecialistAgent<ScriptSpecialistOutput> {
  readonly name: AgentName = "SCRIPT_SPECIALIST";
  readonly description = "Generates Groovy/JavaScript script artifacts and refs.";
  protected readonly systemPrompt = SCRIPT_SYSTEM_PROMPT;
  protected buildPrompt = buildScriptPrompt;
  protected normalize(parsed: unknown): ScriptSpecialistOutput {
    const obj = (parsed ?? {}) as Partial<ScriptSpecialistOutput>;
    return {
      files: asArray<{ path: string; content: string }>(obj.files),
      scripts: asArray(obj.scripts),
    };
  }
}

// ---------------------------------------------------------------------------
// ExternalizationSpecialistAgent
// ---------------------------------------------------------------------------

export class ExternalizationSpecialistAgent extends SpecialistAgent<ExternalizationSpecialistOutput> {
  readonly name: AgentName = "EXTERNALIZATION_SPECIALIST";
  readonly description = "Identifies values to externalize and produces parameters.prop + patches.";
  protected readonly systemPrompt = EXTERNALIZATION_SYSTEM_PROMPT;
  protected buildPrompt = buildExternalizationPrompt;
  protected normalize(parsed: unknown): ExternalizationSpecialistOutput {
    const obj = (parsed ?? {}) as Partial<ExternalizationSpecialistOutput>;
    return {
      parametersFile: typeof obj.parametersFile === "string" ? obj.parametersFile : "",
      parameters: asArray(obj.parameters),
      patches: asArray(obj.patches),
    };
  }
}

// ---------------------------------------------------------------------------
// ErrorHandlerSpecialistAgent
// ---------------------------------------------------------------------------

export class ErrorHandlerSpecialistAgent extends SpecialistAgent<ErrorHandlerSpecialistOutput> {
  readonly name: AgentName = "ERROR_HANDLER_SPECIALIST";
  readonly description = "Designs exception subprocesses and retry/DLC strategy.";
  protected readonly systemPrompt = ERROR_HANDLER_SYSTEM_PROMPT;
  protected buildPrompt = buildErrorHandlerPrompt;
  protected normalize(parsed: unknown): ErrorHandlerSpecialistOutput {
    const obj = (parsed ?? {}) as Partial<ErrorHandlerSpecialistOutput>;
    const allowed = new Set(["NONE", "BASIC", "RETRY_DLC", "RETRY_DLC_ALERT"]);
    const strategy = (allowed.has(String(obj.strategy)) ? obj.strategy : "NONE") as
      ErrorHandlerSpecialistOutput["strategy"];
    return {
      exceptionSubprocesses: asArray(obj.exceptionSubprocesses),
      strategy,
    };
  }
}

// ---------------------------------------------------------------------------
// DecompositionSpecialistAgent
// ---------------------------------------------------------------------------

export class DecompositionSpecialistAgent extends SpecialistAgent<DecompositionSpecialistOutput> {
  readonly name: AgentName = "DECOMPOSITION_SPECIALIST";
  readonly description = "Decomposes the flow into local integration processes and call activities.";
  protected readonly systemPrompt = DECOMPOSITION_SYSTEM_PROMPT;
  protected buildPrompt = buildDecompositionPrompt;
  protected normalize(parsed: unknown): DecompositionSpecialistOutput {
    const obj = (parsed ?? {}) as Partial<DecompositionSpecialistOutput>;
    return {
      localProcesses: asArray(obj.localProcesses),
      callActivities: asArray(obj.callActivities),
    };
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const SPECIALIST_AGENT_REGISTRY = {
  ADAPTER_SPECIALIST: AdapterSpecialistAgent,
  MAPPING_SPECIALIST: MappingSpecialistAgent,
  SCRIPT_SPECIALIST: ScriptSpecialistAgent,
  EXTERNALIZATION_SPECIALIST: ExternalizationSpecialistAgent,
  ERROR_HANDLER_SPECIALIST: ErrorHandlerSpecialistAgent,
  DECOMPOSITION_SPECIALIST: DecompositionSpecialistAgent,
} as const;

export type SpecialistAgentName = keyof typeof SPECIALIST_AGENT_REGISTRY;
