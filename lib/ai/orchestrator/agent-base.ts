/**
 * Base Agent Abstract Class
 * 
 * All pipeline agents extend this class. Provides:
 * - Standardized execute() wrapper with error handling and metrics
 * - Abstract run() method for agent-specific logic
 * - Logging integration
 */

import type { LanguageModel } from 'ai';
import type { AgentResult, PipelineContext, AgentName } from './pipeline-state';

export abstract class BaseAgent<TInput, TOutput> {
  /** Agent identifier used in logs and state */
  abstract readonly name: AgentName;

  /** AI model used by this agent (null for deterministic agents like Validator) */
  abstract readonly model: LanguageModel | null;

  /** Human-readable description */
  abstract readonly description: string;

  /**
   * Execute the agent with full error handling and metrics tracking.
   * This is the public entry point — subclasses implement run().
   */
  async execute(input: TInput, context: PipelineContext): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();

    try {

      const result = await this.run(input, context);

      const duration = Date.now() - startTime;

      return {
        success: true,
        output: result.output,
        tokensUsed: result.tokensUsed,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(
        `[Pipeline:${context.pipelineId}] ${this.name} agent failed after ${duration}ms: ${errorMessage}`
      );

      return {
        success: false,
        error: errorMessage,
        tokensUsed: 0,
        duration,
      };
    }
  }

  /**
   * Agent-specific logic. Subclasses must implement this.
   * 
   * @param input - Agent-specific input data
   * @param context - Shared pipeline context (tenantId, capabilities, etc.)
   * @returns output data and token usage
   */
  protected abstract run(
    input: TInput,
    context: PipelineContext
  ): Promise<{
    output: TOutput;
    tokensUsed: number;
  }>;
}
