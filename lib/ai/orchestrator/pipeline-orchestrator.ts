/**
 * Pipeline Orchestrator
 *
 * Controls the multi-agent iFlow creation pipeline. Manages state transitions,
 * sequences agent execution, handles retries, and persists everything to PostgreSQL
 * via Prisma for real-time UI updates (via polling).
 *
 * Usage:
 *   const orchestrator = new PipelineOrchestrator(pipelineId);
 *   await orchestrator.run(context);
 */

import { prisma } from '@/lib/db';
import type { BaseAgent } from './agent-base';
import type {
  PipelinePhase,
  PipelineContext,
  AgentResult,
  AgentLogStatus,
} from './pipeline-state';
import { isValidTransition } from './pipeline-state';

const MAX_FIX_ATTEMPTS = 3;

/**
 * Truncate a JSON string for log storage
 */
function truncateForLog(json: string, maxLength = 8000): string {
  if (json.length <= maxLength) return json;
  return json.substring(0, maxLength) + '...[truncated]';
}

export class PipelineOrchestrator {
  private pipelineId: string;
  private _currentPhase: PipelinePhase = 'INIT';

  constructor(pipelineId: string, initialPhase?: PipelinePhase) {
    this.pipelineId = pipelineId;
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

    await prisma.iFlowPipeline.update({
      where: { id: this.pipelineId },
      data: { phase: to },
    });
  }

  /**
   * Run an agent with full logging to database.
   * Creates a log entry on start, updates it on completion/failure.
   */
  async runAgent<TInput, TOutput>(
    agent: BaseAgent<TInput, TOutput>,
    input: TInput,
    context: PipelineContext,
    attemptNumber?: number
  ): Promise<AgentResult<TOutput>> {
    // Log start
    const agentLog = await prisma.iFlowPipelineAgentLog.create({
      data: {
        pipelineId: this.pipelineId,
        agentName: agent.name,
        input: truncateForLog(JSON.stringify(input)),
        attemptNumber,
        status: 'RUNNING',
      },
    });

    // Execute
    const result = await agent.execute(input, context);

    // Log completion
    const logStatus: AgentLogStatus = result.success ? 'COMPLETED' : 'FAILED';
    await prisma.iFlowPipelineAgentLog.update({
      where: { id: agentLog.id },
      data: {
        status: logStatus,
        output: result.output
          ? truncateForLog(JSON.stringify(result.output))
          : undefined,
        errorMessage: result.error,
        tokensUsed: result.tokensUsed ?? 0,
        duration: result.duration ?? 0,
        completedAt: new Date(),
      },
    });

    return result;
  }

  /**
   * Mark the pipeline as failed with an error
   */
  async fail(phase: PipelinePhase, message: string, recoverable = false): Promise<void> {
    console.error(`[Pipeline:${this.pipelineId}] FAILED at ${phase}: ${message}`);
    this._currentPhase = 'FAILED';

    await prisma.iFlowPipeline.update({
      where: { id: this.pipelineId },
      data: {
        phase: 'FAILED',
        errorPhase: phase,
        errorMessage: message,
        errorRecoverable: recoverable,
      },
    });
  }

  /**
   * Store tenant capabilities
   */
  async setTenantCapabilities(capabilities: unknown): Promise<void> {
    await prisma.iFlowPipeline.update({
      where: { id: this.pipelineId },
      data: {
        tenantCapabilities: JSON.stringify(capabilities),
      },
    });
  }

  /**
   * Store architect result
   */
  async setArchitectResult(result: unknown, tokensUsed: number): Promise<void> {
    await prisma.iFlowPipeline.update({
      where: { id: this.pipelineId },
      data: {
        architectResult: JSON.stringify(result),
        totalTokensUsed: { increment: tokensUsed },
      },
    });
  }

  /**
   * Store reviewer result, optionally with a patched design
   */
  async setReviewerResult(
    result: unknown,
    tokensUsed: number,
    finalDesign?: unknown
  ): Promise<void> {
    await prisma.iFlowPipeline.update({
      where: { id: this.pipelineId },
      data: {
        reviewerResult: JSON.stringify(result),
        finalDesign: finalDesign ? JSON.stringify(finalDesign) : undefined,
        totalTokensUsed: { increment: tokensUsed },
      },
    });
  }

  /**
   * Store BPMN2 generation result
   */
  async setBpmn2Result(
    xml: string,
    scriptFiles?: { path: string; content: string }[]
  ): Promise<void> {
    await prisma.iFlowPipeline.update({
      where: { id: this.pipelineId },
      data: {
        bpmn2Xml: xml,
        bpmn2ScriptFiles: scriptFiles ? JSON.stringify(scriptFiles) : undefined,
      },
    });
  }

  /**
   * Store validator result
   */
  async setValidatorResult(result: unknown): Promise<void> {
    await prisma.iFlowPipeline.update({
      where: { id: this.pipelineId },
      data: {
        validatorResult: JSON.stringify(result),
      },
    });
  }

  /**
   * Append a fix attempt
   */
  async appendFixAttempt(
    attempt: unknown,
    tokensUsed: number,
    updatedDesign?: unknown
  ): Promise<void> {
    // Get current fix attempts
    const pipeline = await prisma.iFlowPipeline.findUnique({
      where: { id: this.pipelineId },
      select: { fixAttempts: true },
    });

    const existingAttempts = pipeline?.fixAttempts
      ? JSON.parse(pipeline.fixAttempts)
      : [];
    existingAttempts.push(attempt);

    await prisma.iFlowPipeline.update({
      where: { id: this.pipelineId },
      data: {
        fixAttempts: JSON.stringify(existingAttempts),
        finalDesign: updatedDesign ? JSON.stringify(updatedDesign) : undefined,
        totalTokensUsed: { increment: tokensUsed },
      },
    });
  }

  /**
   * Store summarizer result
   */
  async setSummarizerResult(result: unknown, tokensUsed: number): Promise<void> {
    await prisma.iFlowPipeline.update({
      where: { id: this.pipelineId },
      data: {
        summarizerResult: JSON.stringify(result),
        totalTokensUsed: { increment: tokensUsed },
      },
    });
  }

  /**
   * Store deployment result
   */
  async setDeploymentResult(result: unknown): Promise<void> {
    await prisma.iFlowPipeline.update({
      where: { id: this.pipelineId },
      data: {
        deploymentResult: JSON.stringify(result),
      },
    });
  }

  /**
   * Get the max number of fix attempts allowed
   */
  get maxFixAttempts(): number {
    return MAX_FIX_ATTEMPTS;
  }
}
