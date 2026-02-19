/**
 * Summarizer Agent
 *
 * Aggregates all pipeline agent results into a comprehensive PipelineSummary
 * for display in the user approval UI. Combines structured data with
 * AI-generated natural language summaries.
 *
 * Model: gemini-2.5-flash-lite (prototype)
 */

import { generateText, type LanguageModel } from 'ai';
import { google } from '@ai-sdk/google';
import { BaseAgent } from '../agent-base';
import type {
  PipelineContext,
  PipelineSummary,
  PipelineState,
  ComponentSummary,
  DesignChange,
  FixSummaryItem,
  Risk,
  TimelineEvent,
  AgentMetrics,
  AgentName,
} from '../pipeline-state';
import type { IFlowDesign } from '@/components/ai/v2/specialized/iflow-creator/types';

// ============================================================================
// Input / Output Types
// ============================================================================

export interface SummarizerInput {
  pipelineState: PipelineState;
  finalDesign: IFlowDesign;
}

export type SummarizerOutput = PipelineSummary;

// ============================================================================
// Agent Implementation
// ============================================================================

export class SummarizerAgent extends BaseAgent<SummarizerInput, SummarizerOutput> {
  readonly name = 'SUMMARIZER' as const;
  readonly model: LanguageModel = google('gemini-2.5-flash-lite');
  readonly description = 'Generates human-readable summary of the entire pipeline execution';

  protected async run(
    input: SummarizerInput,
    _context: PipelineContext
  ): Promise<{ output: SummarizerOutput; tokensUsed: number }> {
    const { pipelineState, finalDesign } = input;

    // Step 1: Build structured data from pipeline state (deterministic)
    const components = extractComponents(finalDesign);
    const designChanges = extractDesignChanges(pipelineState);
    const fixesApplied = extractFixes(pipelineState);
    const timeline = buildTimeline(pipelineState);
    const agentBreakdown = buildAgentBreakdown(pipelineState);
    const risks = identifyRisks(pipelineState);

    const validationPassed = pipelineState.validatorResult?.report.isValid ?? false;
    const validationAttempts = (pipelineState.fixAttempts?.length ?? 0) + 1;
    const tenantCompatible =
      pipelineState.validatorResult?.report.tenantCompatibility.passed ?? true;

    const compatibilityNotes = extractCompatibilityNotes(pipelineState);

    const totalDuration =
      pipelineState.updatedAt - pipelineState.startedAt;
    const totalTokensUsed = agentBreakdown.reduce((sum, a) => sum + a.tokensUsed, 0);

    const designScore = pipelineState.reviewerResult?.review.overallScore ?? 0;

    // Step 2: Generate AI headline and flow description
    const { headline, flowDescription, tokensUsed } = await this.generateNarrativeSummary(
      finalDesign,
      pipelineState,
      {
        designScore,
        validationPassed,
        validationAttempts,
        fixesApplied: fixesApplied.length,
        risksCount: risks.length,
        tenantCompatible,
      }
    );

    // Step 3: Determine overall confidence
    const confidence = determineConfidence(
      designScore,
      validationPassed,
      fixesApplied.length,
      risks
    );

    const readyToDeploy =
      validationPassed && confidence !== 'LOW' && !risks.some((r) => r.level === 'HIGH');

    const summary: PipelineSummary = {
      headline,
      confidence,
      readyToDeploy,
      flowDescription,
      components,
      designScore,
      designChanges,
      validationPassed,
      validationAttempts,
      fixesApplied,
      tenantCompatible,
      compatibilityNotes,
      risks,
      timeline,
      totalDuration,
      totalTokensUsed: totalTokensUsed + tokensUsed,
      agentBreakdown,
    };

    return { output: summary, tokensUsed };
  }

  // --------------------------------------------------------------------------
  // AI Narrative Generation
  // --------------------------------------------------------------------------

  private async generateNarrativeSummary(
    design: IFlowDesign,
    state: PipelineState,
    stats: {
      designScore: number;
      validationPassed: boolean;
      validationAttempts: number;
      fixesApplied: number;
      risksCount: number;
      tenantCompatible: boolean;
    }
  ): Promise<{ headline: string; flowDescription: string; tokensUsed: number }> {
    const adapterList = design.adapters?.map((a) => `${a.type} (${a.name})`).join(', ') ?? 'none';
    const pattern = design.integrationPattern ?? 'PointToPoint';
    const scriptCount = design.scripts?.length ?? 0;

    const prompt = `Summarize this SAP CPI integration flow for a technical user who needs to approve deployment.

## Flow Facts
- **Pattern:** ${pattern}
- **Adapters:** ${adapterList}
- **Scripts:** ${scriptCount}
- **Design Score:** ${stats.designScore}/10
- **Validation:** ${stats.validationPassed ? 'Passed' : 'Failed'} (${stats.validationAttempts} attempt${stats.validationAttempts > 1 ? 's' : ''})
- **Fixes Applied:** ${stats.fixesApplied}
- **Risks:** ${stats.risksCount}
- **Tenant Compatible:** ${stats.tenantCompatible ? 'Yes' : 'No'}
- **User Request:** "${state.description.description}"

## Instructions
1. Write a one-sentence **headline** (max 100 chars) that captures the essence of this flow
2. Write a 2-4 sentence **flowDescription** explaining what the flow does, its key components, and anything notable

Respond in JSON:
{
  "headline": "...",
  "flowDescription": "..."
}`;

    try {
      const { text, usage } = await generateText({
        model: this.model,
        system:
          'You are summarizing an AI-generated SAP CPI integration flow. Be concise and technical. Respond with JSON only.',
        prompt,
        maxOutputTokens: 500,
        temperature: 0.3,
      });

      const tokensUsed = usage?.totalTokens ?? 0;
      const parsed = parseJsonSafe(text);

      return {
        headline: (parsed?.headline as string) || generateFallbackHeadline(design),
        flowDescription: (parsed?.flowDescription as string) || generateFallbackDescription(design),
        tokensUsed,
      };
    } catch {
      // Fallback to deterministic summary
      return {
        headline: generateFallbackHeadline(design),
        flowDescription: generateFallbackDescription(design),
        tokensUsed: 0,
      };
    }
  }
}

// ============================================================================
// Data Extraction Helpers
// ============================================================================

function extractComponents(design: IFlowDesign): ComponentSummary[] {
  const components: ComponentSummary[] = [];

  // Adapters
  if (design.adapters) {
    for (const adapter of design.adapters) {
      components.push({
        type: 'Adapter',
        name: adapter.name || adapter.type || 'Unknown Adapter',
        description: `${adapter.type} adapter — ${adapter.direction || 'Sender/Receiver'}`,
        configuration: summarizeConfig(adapter as unknown as Record<string, unknown>),
      });
    }
  }

  // Scripts
  if (design.scripts) {
    for (const script of design.scripts) {
      components.push({
        type: 'Script',
        name: script.name || 'Unnamed Script',
        description: `${script.type || 'Groovy'} script — ${script.purpose || 'Processing'}`,
        configuration: `Language: ${script.type || 'groovy'}`,
      });
    }
  }

  // Mappings
  if (design.mappings) {
    for (const mapping of design.mappings) {
      components.push({
        type: 'Mapping',
        name: mapping.name || 'Unnamed Mapping',
        description: `Message mapping — ${mapping.type || 'XSLT/MessageMapping'}`,
        configuration: `Type: ${mapping.type || 'MessageMapping'}`,
      });
    }
  }

  // Routers
  if (design.routers) {
    for (const router of design.routers) {
      components.push({
        type: 'Router',
        name: router.name || 'Router',
        description: `Content-based router with ${router.routingConditions?.length ?? 0} route(s)`,
        configuration: `Routes: ${router.routingConditions?.map((r: { name?: string; expression?: string }) => r.name || r.expression).join(', ') || 'none'}`,
      });
    }
  }

  // Error Handlers
  if (design.errorHandlers) {
    for (const handler of design.errorHandlers) {
      components.push({
        type: 'ErrorHandler',
        name: handler.name || 'Error Handler',
        description: `Error handling — ${handler.errorType || 'Exception Subprocess'}`,
        configuration: `Type: ${handler.errorType || 'exception'}`,
      });
    }
  }

  return components;
}

function extractDesignChanges(state: PipelineState): DesignChange[] {
  const changes: DesignChange[] = [];

  // From reviewer
  if (state.reviewerResult?.designDiff) {
    for (const diff of state.reviewerResult.designDiff) {
      changes.push({
        agent: 'REVIEWER',
        component: diff.path,
        change: `${JSON.stringify(diff.before)} → ${JSON.stringify(diff.after)}`,
        reason: diff.reason,
        category: 'OPTIMIZATION',
      });
    }
  }

  // From fix attempts
  if (state.fixAttempts) {
    for (const attempt of state.fixAttempts) {
      for (const change of attempt.changes) {
        changes.push({
          agent: 'FIX',
          component: change.description,
          change: change.before ? `${change.before} → ${change.after}` : change.description,
          reason: `Fix attempt ${attempt.attemptNumber} (${attempt.strategy})`,
          category: 'CORRECTION',
        });
      }
    }
  }

  return changes;
}

function extractFixes(state: PipelineState): FixSummaryItem[] {
  const fixes: FixSummaryItem[] = [];

  if (state.fixAttempts) {
    for (const attempt of state.fixAttempts) {
      for (const change of attempt.changes) {
        fixes.push({
          error: change.description,
          fix: change.after || change.description,
          strategy: attempt.strategy,
        });
      }
    }
  }

  return fixes;
}

function buildTimeline(state: PipelineState): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Architecture
  if (state.architectResult) {
    events.push({
      timestamp: state.startedAt,
      agent: 'ARCHITECT',
      action: 'Generated iFlow design',
      status: 'SUCCESS',
      duration: state.architectResult.duration,
      details: `Design created with ${state.architectResult.design.adapters?.length ?? 0} adapters, ${state.architectResult.design.scripts?.length ?? 0} scripts`,
    });
  }

  // Review
  if (state.reviewerResult) {
    const reviewStartTime =
      state.startedAt + (state.architectResult?.duration ?? 0);
    events.push({
      timestamp: reviewStartTime,
      agent: 'REVIEWER',
      action: `Design reviewed — ${state.reviewerResult.review.verdict}`,
      status: state.reviewerResult.review.verdict === 'REJECTED' ? 'FAILED' : 'SUCCESS',
      duration: state.reviewerResult.duration,
      details: `Score: ${state.reviewerResult.review.overallScore}/10, ${state.reviewerResult.review.issues.length} issues found`,
    });
  }

  // BPMN2 Generation
  if (state.bpmn2Result) {
    events.push({
      timestamp: state.startedAt + accumulatedDuration(state, 'BPMN_GENERATION'),
      agent: 'BPMN2',
      action: 'Generated BPMN2 XML',
      status: 'SUCCESS',
      duration: state.bpmn2Result.generationDuration,
      details: `XML size: ${(state.bpmn2Result.xml.length / 1024).toFixed(1)}KB, ${state.bpmn2Result.scriptFiles.length} script files`,
    });
  }

  // Validation
  if (state.validatorResult) {
    const passed = state.validatorResult.report.isValid;
    events.push({
      timestamp: state.startedAt + accumulatedDuration(state, 'VALIDATION'),
      agent: 'VALIDATOR',
      action: passed ? 'Validation passed' : 'Validation found errors',
      status: passed ? 'SUCCESS' : 'FAILED',
      duration: state.validatorResult.duration,
      details: `${state.validatorResult.report.summary.passed}/${state.validatorResult.report.summary.totalChecks} checks passed`,
    });
  }

  // Fix attempts
  if (state.fixAttempts) {
    for (const attempt of state.fixAttempts) {
      events.push({
        timestamp: state.startedAt + accumulatedDuration(state, 'FIX_ATTEMPT'),
        agent: 'FIX',
        action: `Fix attempt ${attempt.attemptNumber} (${attempt.strategy})`,
        status: attempt.result === 'FIXED' ? 'SUCCESS' : 'FAILED',
        duration: 0, // Could track per-attempt duration
        details: `Result: ${attempt.result}, ${attempt.changes.length} changes, ${attempt.remainingErrors.length} remaining errors`,
      });
    }
  }

  return events;
}

function buildAgentBreakdown(state: PipelineState): AgentMetrics[] {
  const metrics: AgentMetrics[] = [];

  if (state.architectResult) {
    metrics.push({
      agent: 'ARCHITECT',
      tokensUsed: state.architectResult.tokensUsed,
      duration: state.architectResult.duration,
      attempts: 1,
      status: 'COMPLETED',
    });
  }

  if (state.reviewerResult) {
    metrics.push({
      agent: 'REVIEWER',
      tokensUsed: state.reviewerResult.tokensUsed,
      duration: state.reviewerResult.duration,
      attempts: 1,
      status: 'COMPLETED',
    });
  }

  if (state.validatorResult) {
    metrics.push({
      agent: 'VALIDATOR',
      tokensUsed: 0,
      duration: state.validatorResult.duration,
      attempts: 1,
      status: 'COMPLETED',
    });
  }

  if (state.fixAttempts && state.fixAttempts.length > 0) {
    metrics.push({
      agent: 'FIX',
      tokensUsed: 0, // TODO: track per-attempt tokens
      duration: 0,
      attempts: state.fixAttempts.length,
      status: state.fixAttempts.some((a) => a.result === 'FIXED') ? 'COMPLETED' : 'FAILED',
    });
  }

  return metrics;
}

function identifyRisks(state: PipelineState): Risk[] {
  const risks: Risk[] = [];

  // Risk: Validation required fixes
  if (state.fixAttempts && state.fixAttempts.length > 0) {
    const lastAttempt = state.fixAttempts[state.fixAttempts.length - 1];
    if (lastAttempt.remainingErrors.length > 0) {
      risks.push({
        level: 'HIGH',
        description: `${lastAttempt.remainingErrors.length} validation error(s) could not be fixed automatically`,
        mitigation: 'Review remaining errors manually before deploying',
      });
    } else {
      risks.push({
        level: 'LOW',
        description: `Design required ${state.fixAttempts.length} fix attempt(s) — auto-fixed successfully`,
        mitigation: 'Review fix changes to ensure correctness',
      });
    }
  }

  // Risk: Low design score
  const score = state.reviewerResult?.review.overallScore ?? 0;
  if (score < 5) {
    risks.push({
      level: 'HIGH',
      description: `Design review score is ${score}/10 — below production threshold`,
      mitigation: 'Consider regenerating the design or applying manual improvements',
    });
  } else if (score < 7) {
    risks.push({
      level: 'MEDIUM',
      description: `Design review score is ${score}/10 — acceptable but has improvement areas`,
      mitigation: 'Review the suggestions from the Design Reviewer',
    });
  }

  // Risk: Tenant compatibility issues
  if (state.validatorResult?.report.tenantCompatibility) {
    const compat = state.validatorResult.report.tenantCompatibility;
    if (compat.unavailableAdapters.length > 0) {
      risks.push({
        level: 'HIGH',
        description: `${compat.unavailableAdapters.length} adapter(s) not available on target tenant`,
        mitigation: 'Install required adapters or use available alternatives',
      });
    }
    if (compat.missingSecurityMaterials.length > 0) {
      risks.push({
        level: 'MEDIUM',
        description: `${compat.missingSecurityMaterials.length} credential(s) not found on tenant`,
        mitigation: 'Create the required credentials on the tenant before deploying',
      });
    }
  }

  // Risk: No error handling
  const review = state.reviewerResult?.review;
  if (review?.categories.errorHandling.status === 'FAIL') {
    risks.push({
      level: 'MEDIUM',
      description: 'Error handling is insufficient — flow may fail silently',
      mitigation: 'Add exception subprocesses and error alerts',
    });
  }

  return risks;
}

function extractCompatibilityNotes(state: PipelineState): string[] {
  const notes: string[] = [];

  const compat = state.validatorResult?.report.tenantCompatibility;
  if (!compat) return notes;

  for (const issue of compat.unavailableAdapters) {
    notes.push(`Adapter "${issue.required}" → ${issue.suggestion}`);
  }
  for (const issue of compat.missingSecurityMaterials) {
    notes.push(`Credential "${issue.required}" → ${issue.suggestion}`);
  }
  for (const issue of compat.versionMismatches) {
    notes.push(`Runtime: ${issue.suggestion}`);
  }

  return notes;
}

// ============================================================================
// Utility Functions
// ============================================================================

function accumulatedDuration(
  state: PipelineState,
  upTo: string
): number {
  let total = 0;
  const phases = ['ARCHITECTURE', 'DESIGN_REVIEW', 'BPMN_GENERATION', 'VALIDATION', 'FIX_ATTEMPT'];
  for (const phase of phases) {
    if (phase === upTo) break;
    if (phase === 'ARCHITECTURE') total += state.architectResult?.duration ?? 0;
    if (phase === 'DESIGN_REVIEW') total += state.reviewerResult?.duration ?? 0;
    if (phase === 'BPMN_GENERATION') total += state.bpmn2Result?.generationDuration ?? 0;
    if (phase === 'VALIDATION') total += state.validatorResult?.duration ?? 0;
  }
  return total;
}

function summarizeConfig(adapter: Record<string, unknown>): string {
  const keys = Object.keys(adapter).filter(
    (k) => !['name', 'type', 'direction', 'description'].includes(k)
  );
  if (keys.length === 0) return 'Default configuration';
  return keys.slice(0, 5).map((k) => `${k}: ${String(adapter[k]).substring(0, 50)}`).join(', ');
}

function generateFallbackHeadline(design: IFlowDesign): string {
  const pattern = design.integrationPattern ?? 'PointToPoint';
  const adapterCount = design.adapters?.length ?? 0;
  return `${pattern} integration flow with ${adapterCount} adapter(s)`;
}

function generateFallbackDescription(design: IFlowDesign): string {
  const adapters = design.adapters?.map((a) => a.type).join(', ') ?? 'none';
  const scripts = design.scripts?.length ?? 0;
  return `An AI-generated integration flow using adapters [${adapters}] with ${scripts} script(s). Complexity: ${design.estimatedComplexity ?? 'medium'}.`;
}

function parseJsonSafe(text: string): Record<string, unknown> | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function determineConfidence(
  designScore: number,
  validationPassed: boolean,
  fixCount: number,
  risks: Risk[]
): PipelineSummary['confidence'] {
  const highRisks = risks.filter((r) => r.level === 'HIGH').length;

  if (designScore >= 7 && validationPassed && fixCount === 0 && highRisks === 0) {
    return 'HIGH';
  }
  if (designScore >= 5 && validationPassed && highRisks <= 1) {
    return 'MEDIUM';
  }
  return 'LOW';
}
