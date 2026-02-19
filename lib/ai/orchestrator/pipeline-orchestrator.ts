/**
 * Pipeline Orchestrator
 * 
 * Controls the multi-agent iFlow creation pipeline. Manages state transitions,
 * sequences agent execution, handles retries, and persists everything to Convex
 * for real-time UI updates.
 * 
 * Usage:
 *   const orchestrator = new PipelineOrchestrator(pipelineId, convexClient);
 *   await orchestrator.run(context);
 */

import type { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { BaseAgent } from './agent-base';
import type {
  PipelinePhase,
  PipelineContext,
  AgentResult,
  AgentName,
  AgentLogStatus,
} from './pipeline-state';
import { isValidTransition } from './pipeline-state';

// Pipeline mutations may not be in generated API yet — access dynamically
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pipelineApi = (api as any).iflowPipelineMutations as Record<string, any>;

const MAX_FIX_ATTEMPTS = 3;

/**
 * Truncate a JSON string for log storage (Convex has field size limits)
 */
function truncateForLog(json: string, maxLength = 8000): string {
  if (json.length <= maxLength) return json;
  return json.substring(0, maxLength) + '...[truncated]';
}

export class PipelineOrchestrator {
  private pipelineId: Id<'iflowPipelines'>;
  private convex: ConvexHttpClient;
  private _currentPhase: PipelinePhase = 'INIT';

  constructor(pipelineId: Id<'iflowPipelines'>, convexClient: ConvexHttpClient, initialPhase?: PipelinePhase) {
    this.pipelineId = pipelineId;
    this.convex = convexClient;
    if (initialPhase) {
      this._currentPhase = initialPhase;
    }
  }

  get currentPhase(): PipelinePhase {
    return this._currentPhase;
  }

  /**
   * Transition to a new pipeline phase with validation
   */
  async transition(to: PipelinePhase): Promise<void> {
    if (!isValidTransition(this._currentPhase, to)) {
      throw new Error(
        `Invalid pipeline transition: ${this._currentPhase} → ${to}`
      );
    }

    console.log(`[Pipeline:${this.pipelineId}] Phase: ${this._currentPhase} → ${to}`);
    this._currentPhase = to;

    await this.convex.mutation(pipelineApi.updatePhase, {
      pipelineId: this.pipelineId,
      phase: to,
    });
  }

  /**
   * Run an agent with full logging to Convex.
   * Creates a log entry on start, updates it on completion/failure.
   */
  async runAgent<TInput, TOutput>(
    agent: BaseAgent<TInput, TOutput>,
    input: TInput,
    context: PipelineContext,
    attemptNumber?: number
  ): Promise<AgentResult<TOutput>> {
    // Log start
    const logId = await this.convex.mutation(
      pipelineApi.logAgentStart,
      {
        pipelineId: this.pipelineId,
        agentName: agent.name,
        input: truncateForLog(JSON.stringify(input)),
        attemptNumber,
      }
    );

    // Execute
    const result = await agent.execute(input, context);

    // Log completion
    const logStatus: AgentLogStatus = result.success ? 'COMPLETED' : 'FAILED';
    await this.convex.mutation(
      pipelineApi.logAgentComplete,
      {
        logId,
        status: logStatus,
        output: result.output
          ? truncateForLog(JSON.stringify(result.output))
          : undefined,
        errorMessage: result.error,
        tokensUsed: result.tokensUsed,
        duration: result.duration,
      }
    );

    return result;
  }

  /**
   * Mark the pipeline as failed with an error
   */
  async fail(phase: PipelinePhase, message: string, recoverable = false): Promise<void> {
    console.error(`[Pipeline:${this.pipelineId}] FAILED at ${phase}: ${message}`);
    this._currentPhase = 'FAILED';

    await this.convex.mutation(pipelineApi.setError, {
      pipelineId: this.pipelineId,
      errorPhase: phase,
      errorMessage: message,
      errorRecoverable: recoverable,
    });
  }

  /**
   * Store tenant capabilities
   */
  async setTenantCapabilities(capabilities: unknown): Promise<void> {
    await this.convex.mutation(
      pipelineApi.setTenantCapabilities,
      {
        pipelineId: this.pipelineId,
        tenantCapabilities: JSON.stringify(capabilities),
      }
    );
  }

  /**
   * Store architect result
   */
  async setArchitectResult(result: unknown, tokensUsed: number): Promise<void> {
    await this.convex.mutation(
      pipelineApi.setArchitectResult,
      {
        pipelineId: this.pipelineId,
        architectResult: JSON.stringify(result),
        tokensUsed,
      }
    );
  }

  /**
   * Store reviewer result, optionally with a patched design
   */
  async setReviewerResult(
    result: unknown,
    tokensUsed: number,
    finalDesign?: unknown
  ): Promise<void> {
    await this.convex.mutation(
      pipelineApi.setReviewerResult,
      {
        pipelineId: this.pipelineId,
        reviewerResult: JSON.stringify(result),
        finalDesign: finalDesign ? JSON.stringify(finalDesign) : undefined,
        tokensUsed,
      }
    );
  }

  /**
   * Store BPMN2 generation result
   */
  async setBpmn2Result(
    xml: string,
    scriptFiles?: { path: string; content: string }[]
  ): Promise<void> {
    await this.convex.mutation(
      pipelineApi.setBpmn2Result,
      {
        pipelineId: this.pipelineId,
        bpmn2Xml: xml,
        bpmn2ScriptFiles: scriptFiles ? JSON.stringify(scriptFiles) : undefined,
      }
    );
  }

  /**
   * Store validator result
   */
  async setValidatorResult(result: unknown): Promise<void> {
    await this.convex.mutation(
      pipelineApi.setValidatorResult,
      {
        pipelineId: this.pipelineId,
        validatorResult: JSON.stringify(result),
      }
    );
  }

  /**
   * Append a fix attempt
   */
  async appendFixAttempt(
    attempt: unknown,
    tokensUsed: number,
    updatedDesign?: unknown
  ): Promise<void> {
    await this.convex.mutation(
      pipelineApi.appendFixAttempt,
      {
        pipelineId: this.pipelineId,
        fixAttempt: JSON.stringify(attempt),
        updatedDesign: updatedDesign ? JSON.stringify(updatedDesign) : undefined,
        tokensUsed,
      }
    );
  }

  /**
   * Store summarizer result
   */
  async setSummarizerResult(result: unknown, tokensUsed: number): Promise<void> {
    await this.convex.mutation(
      pipelineApi.setSummarizerResult,
      {
        pipelineId: this.pipelineId,
        summarizerResult: JSON.stringify(result),
        tokensUsed,
      }
    );
  }

  /**
   * Store deployment result
   */
  async setDeploymentResult(result: unknown): Promise<void> {
    await this.convex.mutation(
      pipelineApi.setDeploymentResult,
      {
        pipelineId: this.pipelineId,
        deploymentResult: JSON.stringify(result),
      }
    );
  }

  /**
   * Get the max number of fix attempts allowed
   */
  get maxFixAttempts(): number {
    return MAX_FIX_ATTEMPTS;
  }
}
