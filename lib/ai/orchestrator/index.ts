/**
 * Multi-Agent Orchestrator for iFlow Creator
 * 
 * Barrel export for the orchestration module.
 */

export { PipelineOrchestrator } from './pipeline-orchestrator';
export { BaseAgent } from './agent-base';
export {
  // Types
  type PipelinePhase,
  type PipelineState,
  type PipelineContext,
  type AgentName,
  type AgentResult,
  type AgentLogStatus,
  type TenantCapabilities,
  type DesignReview,
  type ReviewCategory,
  type DesignIssue,
  type DesignSuggestion,
  type DesignDiff,
  type ReviewerOutput,
  type ValidationReport,
  type ValidationError,
  type ValidationWarning,
  type SemanticValidation,
  type TenantCompatValidation,
  type TenantIssue,
  type FixStrategy,
  type FixAttempt,
  type FixChange,
  type PipelineSummary,
  type ComponentSummary,
  type DesignChange,
  type FixSummaryItem,
  type Risk,
  type TimelineEvent,
  type AgentMetrics,
  // Utilities
  isValidTransition,
  getPhaseLabel,
  isTerminalPhase,
  getPhaseIndex,
  getPhaseProgress,
  VALID_TRANSITIONS,
} from './pipeline-state';

// Agents
export { ArchitectAgent } from './agents/architect-agent';
export type { ArchitectInput, ArchitectOutput } from './agents/architect-agent';
export { DesignReviewerAgent } from './agents/design-reviewer-agent';
export type { DesignReviewerInput } from './agents/design-reviewer-agent';
export { Bpmn2ValidatorAgent } from './agents/bpmn2-validator-agent';
export type { Bpmn2ValidatorInput, Bpmn2ValidatorOutput } from './agents/bpmn2-validator-agent';
export { FixAgent, MAX_FIX_ATTEMPTS } from './agents/fix-agent';
export type { FixAgentInput, FixAgentOutput } from './agents/fix-agent';
export { SummarizerAgent } from './agents/summarizer-agent';
export type { SummarizerInput, SummarizerOutput } from './agents/summarizer-agent';
