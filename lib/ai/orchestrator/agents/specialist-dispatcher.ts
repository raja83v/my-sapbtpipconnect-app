/**
 * Parallel specialist dispatcher.
 *
 * Runs the planner-selected specialists concurrently with a per-agent timeout
 * (default 60s) and returns a `SpecialistResultEnvelope` for each — successful
 * payloads, failed errors, or a timeout marker. Partial success is the norm:
 * the architect-as-integrator decides how to merge what came back.
 *
 * Each specialist is logged through the orchestrator's `runAgent` so the
 * Studio activity ribbon and audit trail capture timings + token usage.
 */

import type { PipelineOrchestrator } from "../pipeline-orchestrator";
import type {
  AgentName,
  IntegrationBlueprint,
  PipelineContext,
  RequirementsBrief,
  SpecialistDispatch,
  SpecialistResultEnvelope,
} from "../pipeline-state";
import {
  AdapterSpecialistAgent,
  DecompositionSpecialistAgent,
  ErrorHandlerSpecialistAgent,
  ExternalizationSpecialistAgent,
  MappingSpecialistAgent,
  ScriptSpecialistAgent,
  type SpecialistInput,
} from "./specialist-agents";

const DEFAULT_TIMEOUT_MS = 240_000;

type AnyEnvelope = SpecialistResultEnvelope<unknown>;

function makeAgent(name: SpecialistDispatch["name"]) {
  switch (name) {
    case "ADAPTER_SPECIALIST":
      return new AdapterSpecialistAgent();
    case "MAPPING_SPECIALIST":
      return new MappingSpecialistAgent();
    case "SCRIPT_SPECIALIST":
      return new ScriptSpecialistAgent();
    case "EXTERNALIZATION_SPECIALIST":
      return new ExternalizationSpecialistAgent();
    case "ERROR_HANDLER_SPECIALIST":
      return new ErrorHandlerSpecialistAgent();
    case "DECOMPOSITION_SPECIALIST":
      return new DecompositionSpecialistAgent();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export interface DispatchOptions {
  timeoutMs?: number;
  tenantCapabilitiesSummary?: string;
}

export async function dispatchSpecialists(
  orchestrator: PipelineOrchestrator,
  context: PipelineContext,
  requirementsBrief: RequirementsBrief,
  blueprint: IntegrationBlueprint,
  options: DispatchOptions = {},
): Promise<AnyEnvelope[]> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const dispatches = [...blueprint.specialists].sort(
    (a, b) => (a.priority ?? 99) - (b.priority ?? 99),
  );

  const tasks = dispatches.map(async (dispatch): Promise<AnyEnvelope> => {
    const agent = makeAgent(dispatch.name) as unknown as import("../agent-base").BaseAgent<
      SpecialistInput,
      unknown
    >;
    const startedAt = Date.now();
    const input: SpecialistInput = {
      requirementsBrief,
      blueprint,
      dispatch,
      tenantCapabilitiesSummary: options.tenantCapabilitiesSummary,
    };

    try {
      const result = await withTimeout(
        orchestrator.runAgent(agent, input, context),
        timeoutMs,
        dispatch.name,
      );
      const durationMs = Date.now() - startedAt;
      if (result.success) {
        return {
          agent: dispatch.name as AgentName,
          ok: true,
          payload: result.output,
          durationMs,
          tokensUsed: result.tokensUsed ?? 0,
        };
      }
      return {
        agent: dispatch.name as AgentName,
        ok: false,
        error: result.error ?? "Unknown specialist failure",
        durationMs,
        tokensUsed: result.tokensUsed ?? 0,
      };
    } catch (err) {
      return {
        agent: dispatch.name as AgentName,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
        tokensUsed: 0,
      };
    }
  });

  return Promise.all(tasks);
}
