/**
 * Pipeline State Types & Interfaces
 * 
 * Defines the complete state model for the iFlow Creator multi-agent orchestration pipeline.
 * State is persisted in PostgreSQL via Prisma for UI updates (via polling).
 */

import type {
  IFlowDesign,
  IFlowDescription,
  PackageSelection,
  CreationResult,
} from '@/components/ai/v2/specialized/iflow-creator/types';

// ============================================================================
// PIPELINE PHASES
// ============================================================================

export type PipelinePhase =
  | 'INIT'
  // Studio (multi-agent v2)
  | 'CLARIFYING'
  | 'PLANNING'
  | 'SPECIALISTS'
  | 'INTEGRATING'
  | 'SAMPLE_GEN'
  | 'MODIFYING'
  | 'DRAFTED'
  // Shared / legacy linear pipeline
  | 'ARCHITECTURE'
  | 'DESIGN_REVIEW'
  | 'BPMN_GENERATION'
  | 'VALIDATION'
  | 'FIX_ATTEMPT'
  | 'SUMMARIZATION'
  | 'AWAITING_APPROVAL'
  | 'DEPLOYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type AgentName =
  | 'CLARIFIER'
  | 'PLANNER'
  | 'ADAPTER_SPECIALIST'
  | 'MAPPING_SPECIALIST'
  | 'SCRIPT_SPECIALIST'
  | 'EXTERNALIZATION_SPECIALIST'
  | 'ERROR_HANDLER_SPECIALIST'
  | 'DECOMPOSITION_SPECIALIST'
  | 'PATCH'
  | 'SAMPLE_DATA'
  | 'ARCHITECT'
  | 'REVIEWER'
  | 'VALIDATOR'
  | 'FIX'
  | 'SUMMARIZER';

export type AgentLogStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

// ============================================================================
// TENANT CAPABILITIES
// ============================================================================

export interface TenantCapabilities {
  availableAdapters: string[];
  runtimeVersion: string;
  supportedFeatures: string[];
  securityMaterials: string[];
  fetchedAt: number;
  /** Whether SAP API Management (APIM) is available on this tenant */
  apimEnabled?: boolean;
  /** Number of API proxies deployed in APIM (0 if APIM not available) */
  apimProxyCount?: number;
}

// ============================================================================
// DESIGN REVIEW TYPES
// ============================================================================

export interface DesignReview {
  overallScore: number; // 1-10
  verdict: 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED';

  categories: {
    architecture: ReviewCategory;
    adapters: ReviewCategory;
    security: ReviewCategory;
    performance: ReviewCategory;
    errorHandling: ReviewCategory;
    bestPractices: ReviewCategory;
  };

  issues: DesignIssue[];
  suggestions: DesignSuggestion[];
  autoFixable: DesignSuggestion[];
  requiresUserInput: DesignIssue[];
}

export interface ReviewCategory {
  score: number; // 1-10
  status: 'PASS' | 'WARN' | 'FAIL';
  findings: string[];
}

export interface DesignIssue {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  component: string;
  description: string;
  impact: string;
  recommendation: string;
}

export interface DesignSuggestion {
  id: string;
  category: string;
  component: string;
  current: string;
  suggested: string;
  reason: string;
  autoApplied: boolean;
}

export interface DesignDiff {
  path: string; // e.g., "adapters[0].connectionTimeout"
  before: unknown;
  after: unknown;
  reason: string;
}

// ============================================================================
// REVIEWER OUTPUT
// ============================================================================

export interface ReviewerOutput {
  review: DesignReview;
  patchedDesign?: IFlowDesign;
  designDiff?: DesignDiff[];
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationError {
  id: string;
  type: 'STRUCTURAL' | 'SEMANTIC' | 'TENANT_COMPAT';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  location?: string;
  fixable: boolean;
}

export interface ValidationWarning {
  id: string;
  type: string;
  message: string;
  location?: string;
}

export interface SemanticValidation {
  passed: boolean;
  orphanedSteps: string[];
  unreachableSteps: string[];
  deadEndBranches: string[];
  circularReferences: string[];
  missingScriptFiles: string[];
  invalidRouterConditions: string[];
}

export interface TenantCompatValidation {
  passed: boolean;
  unavailableAdapters: TenantIssue[];
  unsupportedFeatures: TenantIssue[];
  versionMismatches: TenantIssue[];
  missingSecurityMaterials: TenantIssue[];
}

export interface TenantIssue {
  component: string;
  required: string;
  available: string;
  severity: 'CRITICAL' | 'WARNING';
  suggestion: string;
}

export interface ValidationReport {
  isValid: boolean;

  structural: {
    passed: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
  };

  semantic: SemanticValidation;

  tenantCompatibility: TenantCompatValidation;

  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    canProceed: boolean;
    requiresFix: boolean;
  };
}

// ============================================================================
// FIX AGENT TYPES
// ============================================================================

export type FixStrategy =
  | 'PATCH_DESIGN'
  | 'PATCH_XML'
  | 'REGENERATE'
  | 'SWAP_COMPONENT';

export interface FixAttempt {
  attemptNumber: number;
  errorsToFix: ValidationError[];
  strategy: FixStrategy;
  changes: FixChange[];
  result: 'FIXED' | 'PARTIAL' | 'FAILED';
  remainingErrors: ValidationError[];
}

export interface FixChange {
  errorId: string;
  strategy: FixStrategy;
  description: string;
  before: string;
  after: string;
}

// ============================================================================
// SUMMARIZER TYPES
// ============================================================================

export interface PipelineSummary {
  headline: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  readyToDeploy: boolean;

  flowDescription: string;
  components: ComponentSummary[];

  designScore: number;
  designChanges: DesignChange[];

  validationPassed: boolean;
  validationAttempts: number;
  fixesApplied: FixSummaryItem[];

  tenantCompatible: boolean;
  compatibilityNotes: string[];

  risks: Risk[];

  timeline: TimelineEvent[];

  totalDuration: number; // ms
  totalTokensUsed: number;
  agentBreakdown: AgentMetrics[];
}

export interface ComponentSummary {
  type: string;
  name: string;
  description: string;
  configuration: string;
}

export interface DesignChange {
  agent: string;
  component: string;
  change: string;
  reason: string;
  category: 'AUTO_FIX' | 'OPTIMIZATION' | 'CORRECTION' | 'SECURITY';
}

export interface FixSummaryItem {
  error: string;
  fix: string;
  strategy: FixStrategy;
}

export interface Risk {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  mitigation: string;
}

export interface TimelineEvent {
  timestamp: number;
  agent: string;
  action: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  duration: number;
  details: string;
}

export interface AgentMetrics {
  agent: AgentName;
  tokensUsed: number;
  duration: number;
  attempts: number;
  status: AgentLogStatus;
}

// ============================================================================
// AGENT RESULT (Generic wrapper for any agent output)
// ============================================================================

export interface AgentResult<T> {
  success: boolean;
  output?: T;
  error?: string;
  tokensUsed: number;
  duration: number;
}

// ============================================================================
// PIPELINE CONTEXT (shared state passed to agents)
// ============================================================================

export interface PipelineContext {
  pipelineId: string;
  tenantId: string;
  userId: string;
  tenantCapabilities: TenantCapabilities;
  packageSelection: PackageSelection;
  description: IFlowDescription;
}

// ============================================================================
// FULL PIPELINE STATE
// ============================================================================

export interface PipelineState {
  id: string;
  phase: PipelinePhase;
  startedAt: number;
  updatedAt: number;

  // Inputs
  tenantId: string;
  userId: string;
  packageSelection: PackageSelection;
  description: IFlowDescription;
  tenantCapabilities?: TenantCapabilities;

  // Agent Outputs (populated progressively)
  architectResult?: {
    design: IFlowDesign;
    rationale: string;
    tokensUsed: number;
    duration: number;
  };

  reviewerResult?: {
    review: DesignReview;
    patchedDesign?: IFlowDesign;
    designDiff?: DesignDiff[];
    tokensUsed: number;
    duration: number;
  };

  bpmn2Result?: {
    xml: string;
    scriptFiles: { path: string; content: string }[];
    generationDuration: number;
  };

  validatorResult?: {
    report: ValidationReport;
    duration: number;
  };

  fixAttempts?: FixAttempt[];

  summarizerResult?: {
    summary: PipelineSummary;
    tokensUsed: number;
    duration: number;
  };

  deploymentResult?: CreationResult;

  // The final design (after review + fixes)
  finalDesign?: IFlowDesign;

  // Error tracking
  error?: {
    phase: PipelinePhase;
    message: string;
    recoverable: boolean;
  };
}

// ============================================================================
// PHASE TRANSITIONS (Valid state machine transitions)
// ============================================================================

export const VALID_TRANSITIONS: Record<PipelinePhase, PipelinePhase[]> = {
  INIT: ['CLARIFYING', 'PLANNING', 'ARCHITECTURE', 'FAILED', 'CANCELLED'],
  // Studio path
  CLARIFYING: ['PLANNING', 'CANCELLED', 'FAILED'],
  PLANNING: ['SPECIALISTS', 'INTEGRATING', 'ARCHITECTURE', 'CANCELLED', 'FAILED'],
  SPECIALISTS: ['INTEGRATING', 'ARCHITECTURE', 'CANCELLED', 'FAILED'],
  INTEGRATING: ['ARCHITECTURE', 'DESIGN_REVIEW', 'CANCELLED', 'FAILED'],
  SAMPLE_GEN: ['AWAITING_APPROVAL', 'CANCELLED', 'FAILED'],
  MODIFYING: ['DESIGN_REVIEW', 'AWAITING_APPROVAL', 'CANCELLED', 'FAILED'],
  DRAFTED: ['DEPLOYING', 'MODIFYING', 'CANCELLED'],
  // Shared
  ARCHITECTURE: ['DESIGN_REVIEW', 'FAILED', 'CANCELLED'],
  DESIGN_REVIEW: ['BPMN_GENERATION', 'AWAITING_APPROVAL', 'FAILED', 'CANCELLED'],
  BPMN_GENERATION: ['VALIDATION', 'FAILED', 'CANCELLED'],
  VALIDATION: ['SUMMARIZATION', 'FIX_ATTEMPT', 'SAMPLE_GEN', 'FAILED', 'CANCELLED'],
  FIX_ATTEMPT: ['BPMN_GENERATION', 'VALIDATION', 'SUMMARIZATION', 'FAILED', 'CANCELLED'],
  SUMMARIZATION: ['AWAITING_APPROVAL', 'SAMPLE_GEN', 'FAILED', 'CANCELLED'],
  AWAITING_APPROVAL: ['DEPLOYING', 'DRAFTED', 'MODIFYING', 'ARCHITECTURE', 'CANCELLED'],
  DEPLOYING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: ['ARCHITECTURE', 'CLARIFYING'],
  CANCELLED: [],
};

/**
 * Check if a phase transition is valid
 */
export function isValidTransition(from: PipelinePhase, to: PipelinePhase): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get human-readable label for a pipeline phase
 */
export function getPhaseLabel(phase: PipelinePhase): string {
  const labels: Record<PipelinePhase, string> = {
    INIT: 'Initializing',
    CLARIFYING: 'Gathering requirements',
    PLANNING: 'Planning architecture',
    SPECIALISTS: 'Specialists at work',
    INTEGRATING: 'Assembling design',
    SAMPLE_GEN: 'Generating samples',
    MODIFYING: 'Applying changes',
    DRAFTED: 'Saved as draft',
    ARCHITECTURE: 'Designing iFlow',
    DESIGN_REVIEW: 'Reviewing design',
    BPMN_GENERATION: 'Generating BPMN2 XML',
    VALIDATION: 'Validating',
    FIX_ATTEMPT: 'Fixing errors',
    SUMMARIZATION: 'Summarizing',
    AWAITING_APPROVAL: 'Awaiting approval',
    DEPLOYING: 'Deploying to SAP CPI',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
  };
  return labels[phase];
}

/**
 * Check if a phase represents a terminal state
 */
export function isTerminalPhase(phase: PipelinePhase): boolean {
  return ['COMPLETED', 'FAILED', 'CANCELLED'].includes(phase);
}

/**
 * Get the phase order index (for progress bar calculations)
 */
export function getPhaseIndex(phase: PipelinePhase): number {
  const order: PipelinePhase[] = [
    'INIT',
    'ARCHITECTURE',
    'DESIGN_REVIEW',
    'BPMN_GENERATION',
    'VALIDATION',
    'FIX_ATTEMPT',
    'SUMMARIZATION',
    'AWAITING_APPROVAL',
    'DEPLOYING',
    'COMPLETED',
  ];
  const idx = order.indexOf(phase);
  return idx === -1 ? 0 : idx;
}

/**
 * Get progress percentage (0-100) for a pipeline phase
 */
export function getPhaseProgress(phase: PipelinePhase): number {
  if (phase === 'FAILED' || phase === 'CANCELLED') return 0;
  const idx = getPhaseIndex(phase);
  // 10 phases total (INIT through COMPLETED)
  return Math.round((idx / 9) * 100);
}

// ============================================================================
// STUDIO (Multi-agent v2) — Conversational types
// ============================================================================

/** Outcome of the Clarifier agent — structured requirements brief. */
export interface RequirementsBrief {
  goal: string;
  sourceSystem?: string;
  targetSystem?: string;
  trigger: 'message' | 'timer' | 'event';
  schedule?: string; // CRON or human description
  payloadFormat?: string;
  authentication?: string;
  expectedThroughput?: string;
  errorPolicy?: 'fail-fast' | 'retry' | 'dlc' | 'alert' | string;
  logLevel?: 'NONE' | 'INFO' | 'DEBUG' | 'TRACE';
  externalizationHints?: string[];
  partnerIds?: string[];
  additionalRequirements?: string[];
  /** Open clarifier questions still unanswered. Empty array → ready to plan. */
  openQuestions?: ClarifierQuestion[];
  /** Confidence the brief is complete enough to plan (0-1). */
  confidence?: number;
}

export interface ClarifierQuestion {
  id: string;
  question: string;
  /** Optional preset choices to render as quick replies. */
  options?: string[];
  /** Required answers block planning. */
  required: boolean;
}

// ============================================================================
// STUDIO — Planning types
// ============================================================================

/** Planner output — high-level architectural blueprint */
export interface IntegrationBlueprint {
  pattern:
    | 'PointToPoint'
    | 'PublishSubscribe'
    | 'ContentBasedRouter'
    | 'Splitter'
    | 'Aggregator'
    | 'ScatterGather'
    | 'Pipeline'
    | 'RecipientList';
  /** Specialist agents the planner wants to dispatch (in parallel). */
  specialists: SpecialistDispatch[];
  /** Local Integration Processes the planner wants to factor out. */
  localProcesses: BlueprintLocalProcess[];
  /** Whether to generate exception subprocesses. */
  exceptionStrategy: 'NONE' | 'BASIC' | 'RETRY_DLC' | 'RETRY_DLC_ALERT';
  /** Hints about what should be externalized. */
  externalizationTargets: string[];
  /** Brief rationale for the chosen pattern. */
  rationale: string;
}

export interface SpecialistDispatch {
  name:
    | 'ADAPTER_SPECIALIST'
    | 'MAPPING_SPECIALIST'
    | 'SCRIPT_SPECIALIST'
    | 'EXTERNALIZATION_SPECIALIST'
    | 'ERROR_HANDLER_SPECIALIST'
    | 'DECOMPOSITION_SPECIALIST';
  brief: string;
  priority: number;
}

export interface BlueprintLocalProcess {
  id: string;
  name: string;
  responsibility: string;
}

// ============================================================================
// STUDIO — Specialist agent results (heterogeneous; merged by Architect-as-integrator)
// ============================================================================

export interface SpecialistResultEnvelope<T> {
  agent: AgentName;
  ok: boolean;
  payload?: T;
  error?: string;
  durationMs: number;
  tokensUsed: number;
}

export interface AdapterSpecialistOutput {
  adapters: unknown[]; // AdapterConfig[] but kept loose to avoid cycles
}

export interface MappingSpecialistOutput {
  /** Generated message-mapping artifact files (.mmap, .xml). */
  files: { path: string; content: string }[];
  /** Mapping refs to wire into the design. */
  mappings: unknown[];
}

export interface ScriptSpecialistOutput {
  /** Groovy/JS script files plus any unit-test files. */
  files: { path: string; content: string }[];
  /** Script step references to wire into the design. */
  scripts: unknown[];
}

export interface ExternalizationSpecialistOutput {
  /** parameters.prop content. */
  parametersFile: string;
  /** External parameter metadata. */
  parameters: ExternalParameter[];
  /** Patches: paths into the design where literals were replaced with `{{name}}`. */
  patches: { path: string; before: unknown; after: unknown }[];
}

export interface ExternalParameter {
  name: string;
  type: 'string' | 'integer' | 'boolean' | 'password' | 'credential';
  defaultValue?: string;
  description?: string;
  /** Component IDs that reference this parameter. */
  usedBy?: string[];
}

export interface ErrorHandlerSpecialistOutput {
  /** Exception subprocess configs. */
  exceptionSubprocesses: unknown[];
  /** DLC config / retry strategy summary. */
  strategy: 'NONE' | 'BASIC' | 'RETRY_DLC' | 'RETRY_DLC_ALERT';
}

export interface DecompositionSpecialistOutput {
  localProcesses: unknown[];
  callActivities: unknown[];
}

export type SpecialistResult =
  | SpecialistResultEnvelope<AdapterSpecialistOutput>
  | SpecialistResultEnvelope<MappingSpecialistOutput>
  | SpecialistResultEnvelope<ScriptSpecialistOutput>
  | SpecialistResultEnvelope<ExternalizationSpecialistOutput>
  | SpecialistResultEnvelope<ErrorHandlerSpecialistOutput>
  | SpecialistResultEnvelope<DecompositionSpecialistOutput>;

// ============================================================================
// STUDIO — Patch / Modify loop
// ============================================================================

export interface DesignPatch {
  id: string;
  instruction: string;
  diffs: DesignDiff[];
  rationale: string;
  appliedAt: number;
}

// ============================================================================
// STUDIO — Sample data
// ============================================================================

export interface SampleDataOutput {
  inputPayloads: { name: string; contentType: string; content: string }[];
  expectedOutputs: { name: string; contentType: string; content: string }[];
  curlSnippet?: string;
  notes?: string[];
}

// ============================================================================
// STUDIO — Chat thread
// ============================================================================

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'agent';

export type ChatMessageKind =
  | 'TEXT'
  | 'CLARIFIER_QUESTION'
  | 'CLARIFIER_ANSWER'
  | 'MODIFY_REQUEST'
  | 'PATCH_RESULT'
  | 'AGENT_STATUS'
  | 'BLUEPRINT'
  | 'DESIGN_READY';

export interface ChatMessageMetadata {
  agentName?: AgentName;
  questionIds?: string[];
  patchId?: string;
  designVersion?: number;
  [key: string]: unknown;
}

