# iFlow Creator — Multi-Agent Orchestration Implementation Plan

**Status**: Proposed  
**Date**: February 10, 2026  
**Priority**: High — Next major evolution of iFlow Creator  
**Prerequisite**: Existing single-workflow iFlow Creator (Steps 1–5 wizard)

---

## Executive Summary

Transform the current single-pass iFlow Creator AI from a **linear wizard** into a **multi-agent orchestration pipeline** where specialized AI agents collaborate in a managed workflow. Each agent has a focused responsibility, agents communicate through a shared state bus, and the user sees a unified approval dashboard before any deployment.

### Current State (Single Workflow)

```
User Input → [Single AI Call] → JSON Design → BPMN2 Generator → Validator → Deploy
                                  ↑ no review              ↑ binary pass/fail
                                  ↑ no iteration           ↑ no self-healing
```

### Target State (Multi-Agent Orchestration)

```
User Input
    │
    ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR (Pipeline Controller)                                  │
│                                                                      │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐ │
│  │  ARCHITECT  │──▶│  REVIEWER  │──▶│ VALIDATOR  │──▶│ SUMMARIZER │ │
│  │   Agent     │   │   Agent    │   │   Agent    │   │   Agent    │ │
│  └────────────┘   └────────────┘   └────────────┘   └────────────┘ │
│        │                │                │                │         │
│        │                │          ┌─────┴─────┐          │         │
│        │                │          │ FIX Agent  │          │         │
│        │                │          │ (retry ≤3) │          │         │
│        │                │          └───────────┘          │         │
│        ▼                ▼                ▼                ▼         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              SHARED PIPELINE STATE (Convex)                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  USER APPROVAL DASHBOARD                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                          │
│  ✅ Design Review:  8/10 — 2 suggestions applied         │
│  ✅ BPMN2 Valid:    All 14 components verified           │
│  ✅ Tenant Compat:  All adapters available               │
│  📋 Summary:        Full change log + rationale          │
│                                                          │
│  [✅ Approve & Deploy]  [✏️ Request Changes]  [❌ Cancel] │
└──────────────────────────────────────────────────────────┘
```

---

## Agent Specifications

### Agent 1: Architect Agent (Existing — Enhanced)

**Role**: Generate the initial iFlow design from natural language.  
**Model**: `gemini-2.5-flash-lite` (prototype) → upgradeable to `gemini-2.5-flash` for production  
**Input**: `IFlowDescription` (user's natural language + structured metadata)  
**Output**: `IFlowDesign` JSON  

**Changes from current implementation:**
- Keep `gemini-2.5-flash-lite` for prototype; model is configurable per-agent
- Enhanced prompt to include SAP CPI tenant capabilities (fetched live) so the AI only proposes adapters/components the tenant actually supports
- Add structured output mode (Vercel AI SDK `experimental_output`) to eliminate JSON parsing fragility
- Emit design rationale alongside the design (why each adapter/pattern was chosen)
- Track token usage & latency in pipeline state

**Key Enhancement — Tenant-Aware Design:**
```typescript
// Before calling Architect Agent, fetch tenant capabilities
const tenantCapabilities = await sapCpiClient.getAvailableComponents(tenantId);
// { adapters: ["HTTP","SFTP","SOAP",...], runtimeVersion: "6.53", features: [...] }

// Inject into prompt
const prompt = createIFlowDesignPrompt(description, {
  availableAdapters: tenantCapabilities.adapters,
  runtimeVersion: tenantCapabilities.runtimeVersion,
  supportedFeatures: tenantCapabilities.features,
});
```

---

### Agent 2: Design Reviewer Agent (NEW)

**Role**: Critically review the Architect's proposed design for correctness, best practices, performance, and security.  
**Model**: `gemini-2.5-flash-lite` (prototype) → upgradeable for production  
**Input**: `IFlowDesign` + `IFlowDescription` (original requirements) + `tenantCapabilities`  
**Output**: `DesignReview`

```typescript
interface DesignReview {
  overallScore: number;           // 1-10
  verdict: 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED';
  
  categories: {
    architecture: ReviewCategory;   // Pattern selection, flow structure
    adapters: ReviewCategory;       // Correct adapter types, configs
    security: ReviewCategory;       // Auth, encryption, certificate usage
    performance: ReviewCategory;    // Timeouts, pooling, batch sizes
    errorHandling: ReviewCategory;  // Exception subprocesses, retries
    bestPractices: ReviewCategory;  // SAP CPI recommended patterns
  };
  
  issues: DesignIssue[];           // Problems found
  suggestions: DesignSuggestion[]; // Improvements
  
  autoFixable: DesignSuggestion[]; // Issues the Reviewer can fix itself
  requiresUserInput: DesignIssue[]; // Issues needing human decision
}

interface ReviewCategory {
  score: number;       // 1-10
  status: 'PASS' | 'WARN' | 'FAIL';
  findings: string[];
}

interface DesignIssue {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  component: string;     // Which adapter/script/step
  description: string;
  impact: string;
  recommendation: string;
}

interface DesignSuggestion {
  id: string;
  category: string;
  component: string;
  current: string;
  suggested: string;
  reason: string;
  autoApplied: boolean;
}
```

**Review Checklist (encoded in system prompt):**

1. **Architecture Review**
   - Is the integration pattern correct for the use case? (P2P vs Pub/Sub vs Content-Based Router)
   - Are there unnecessary steps that could be simplified?
   - Is ProcessDirect used appropriately for modularization?
   - Does the flow handle both happy path and error scenarios?

2. **Adapter Review**
   - Are the chosen adapters the best fit? (e.g., OData_V4 preferred over OData_V2 when target supports it)
   - Are connection parameters reasonable? (timeouts ≥ 30s, pool sizes ≥ 10)
   - Is the authentication type appropriate for the target system?
   - Are sender/receiver directions correct?

3. **Security Review**
   - Is sensitive data encrypted in transit?
   - Are credentials stored in Security Material (not hardcoded)?
   - Is certificate pinning configured where needed?
   - Are unnecessary permissions avoided?

4. **Performance Review**
   - Are timeouts configured for all external calls?
   - Is connection pooling enabled?
   - Are large payloads handled with streaming?
   - Are scripts efficient (no sync calls in loops)?

5. **Error Handling Review**
   - Is there an Exception Subprocess?
   - Are retries configured with exponential backoff?
   - Is there a Dead Letter Channel for unrecoverable failures?
   - Are error messages descriptive?

6. **SAP CPI Best Practices**
   - Groovy preferred over JavaScript for scripts
   - Content Modifier preferred over script for simple header/property changes
   - XSLT preferred for complex XML transformations
   - Variables used for temporary storage (not DataStore)

**Auto-Fix Capability:**
When `verdict === 'NEEDS_CHANGES'` and issues are `autoFixable`, the Reviewer Agent produces a patched `IFlowDesign` with the fixes applied. The changes are tracked as a diff for the Summarizer to report.

```typescript
interface ReviewerOutput {
  review: DesignReview;
  patchedDesign?: IFlowDesign;     // Only if auto-fixes applied
  designDiff?: DesignDiff[];        // Track what changed
}

interface DesignDiff {
  path: string;       // e.g., "adapters[0].connectionTimeout"
  before: any;
  after: any;
  reason: string;
}
```

**Decision Logic:**
- `overallScore >= 7` and no CRITICAL issues → `APPROVED` (proceed to Validator)
- `overallScore >= 5` and autoFixable → `NEEDS_CHANGES` (auto-fix, then proceed)
- `overallScore < 5` or CRITICAL issues that aren't autoFixable → `REJECTED` (return to user with explanation)

---

### Agent 3: BPMN2 Validator Agent (NEW)

**Role**: Validate the generated BPMN2 XML is structurally correct AND that all referenced components are available on the target SAP BTP tenant.  
**Model**: No LLM needed — this is a deterministic validation agent (code-only) with AI-assisted error explanation.  
**Input**: BPMN2 XML string + `tenantCapabilities` + `IFlowDesign`  
**Output**: `ValidationReport`

```typescript
interface ValidationReport {
  phase: 'STRUCTURAL' | 'SEMANTIC' | 'TENANT_COMPAT';
  isValid: boolean;
  
  structural: {
    // From existing validateBPMN2() — 11 checks
    passed: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    diagnostics: ValidationDiagnostics;
  };
  
  semantic: {
    // New: Deep validation of component relationships
    passed: boolean;
    orphanedSteps: string[];           // Steps with no incoming/outgoing flow
    unreachableSteps: string[];        // Steps not reachable from StartEvent
    deadEndBranches: string[];         // Branches that don't reach EndEvent
    circularReferences: string[];      // Infinite loops
    missingScriptFiles: string[];      // Scripts referenced but not provided
    invalidRouterConditions: string[]; // XPath/conditions that won't evaluate
  };
  
  tenantCompatibility: {
    // New: Verify against actual SAP BTP tenant
    passed: boolean;
    unavailableAdapters: TenantIssue[];
    unsupportedFeatures: TenantIssue[];
    versionMismatches: TenantIssue[];
    missingSecurityMaterials: TenantIssue[];
  };
  
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    canProceed: boolean;           // true if no CRITICAL errors
    requiresFix: boolean;          // true if errors exist but are fixable
  };
}

interface TenantIssue {
  component: string;
  required: string;
  available: string;
  severity: 'CRITICAL' | 'WARNING';
  suggestion: string;
}
```

**Three Validation Phases:**

#### Phase 1: Structural Validation (existing — enhanced)
Extends the current `validateBPMN2()` in [lib/sap-cpi/bpmn2-validator.ts](lib/sap-cpi/bpmn2-validator.ts):
- All 11 existing checks (XML structure, namespaces, participants, shapes, edges, etc.)
- **New**: Validate `ifl:property` values against known SAP CPI property schemas
- **New**: Validate component version strings match expected patterns

#### Phase 2: Semantic Validation (NEW)
Graph-based analysis of the flow logic:
- Parse BPMN2 into a directed graph (nodes = steps, edges = sequence flows)
- Run reachability analysis from StartEvent
- Detect orphaned nodes, dead ends, and cycles
- Verify all script file references have corresponding script content
- Validate router conditions are syntactically valid XPath/expressions
- Check splitter → aggregator pairing (every split must eventually aggregate)

#### Phase 3: Tenant Compatibility Validation (NEW)
Live check against the SAP BTP tenant:
```typescript
// Fetch what the tenant actually supports
const tenantInfo = await sapCpiClient.getRuntimeInfo(tenantId);
const availableAdapters = await sapCpiClient.getAvailableAdapterTypes(tenantId);
const securityMaterials = await sapCpiClient.getSecurityMaterials(tenantId);

// Cross-reference with what the design requires
for (const adapter of design.adapters) {
  if (!availableAdapters.includes(adapter.type)) {
    report.tenantCompatibility.unavailableAdapters.push({
      component: adapter.name,
      required: adapter.type,
      available: availableAdapters.join(', '),
      severity: 'CRITICAL',
      suggestion: `Replace ${adapter.type} with a supported alternative`,
    });
  }
}

// Check if referenced security artifacts exist
for (const adapter of design.adapters) {
  if (adapter.credentialName && !securityMaterials.includes(adapter.credentialName)) {
    report.tenantCompatibility.missingSecurityMaterials.push({...});
  }
}
```

---

### Agent 4: Fix Agent (NEW)

**Role**: When the Validator Agent reports fixable errors, automatically regenerate or patch the BPMN2 XML.  
**Model**: `gemini-2.5-flash-lite` (prototype) → upgradeable for production  
**Input**: `ValidationReport` (with errors) + `IFlowDesign` + original BPMN2 XML  
**Output**: Corrected `IFlowDesign` and/or corrected BPMN2 XML  
**Retry Limit**: 3 attempts maximum

```typescript
interface FixAttempt {
  attemptNumber: number;
  errorsToFix: ValidationError[];
  strategy: FixStrategy;
  changes: FixChange[];
  result: 'FIXED' | 'PARTIAL' | 'FAILED';
  remainingErrors: ValidationError[];
}

type FixStrategy = 
  | 'PATCH_DESIGN'       // Modify IFlowDesign JSON, then regenerate BPMN2
  | 'PATCH_XML'          // Directly fix BPMN2 XML (for structural issues)
  | 'REGENERATE'         // Ask Architect Agent to regenerate with constraints
  | 'SWAP_COMPONENT';    // Replace unsupported component with alternative

interface FixChange {
  errorId: string;
  strategy: FixStrategy;
  description: string;
  before: string;
  after: string;
}
```

**Fix Strategy Selection:**

| Error Type | Strategy | Example |
|------------|----------|---------|
| Missing BPMNShape/Edge | `PATCH_XML` | Add missing diagram elements |
| Invalid adapter type | `SWAP_COMPONENT` | Replace `OData_V4` → `OData_V2` |
| Orphaned step | `PATCH_DESIGN` | Add missing sequence flow connection |
| Invalid script content | `PATCH_DESIGN` | Regenerate script with error context |
| Structural XML error | `REGENERATE` | Re-run Architect with validation feedback |
| Missing security material | `PATCH_DESIGN` | Update credential reference |

**Retry Loop:**
```
Attempt 1: Try PATCH_DESIGN for all fixable errors
    → Re-validate
    → If still failing:
Attempt 2: Try PATCH_XML for structural errors + SWAP_COMPONENT for compat errors
    → Re-validate
    → If still failing:
Attempt 3: REGENERATE with full error context as constraints
    → Re-validate
    → If still failing: Mark as FAILED, escalate to user
```

**AI Prompt for Fix Agent:**
```
You are a BPMN2 XML repair specialist for SAP CPI integration flows.

Given the following validation errors:
{errors_json}

And the current iFlow design:
{design_json}

Fix the errors by modifying the design. For each fix:
1. Explain what was wrong
2. Explain what you changed
3. Ensure the fix doesn't introduce new errors

Constraints:
- Only use adapters from this list: {available_adapters}
- Runtime version: {runtime_version}
- Do NOT change the core business logic
- Preserve all user-specified requirements
```

---

### Agent 5: Summarizer Agent (NEW)

**Role**: Aggregate the full pipeline history into a clear, actionable summary for user approval.  
**Model**: `gemini-2.5-flash-lite` (prototype and production — summarization is lightweight)  
**Input**: Full `PipelineState` (all agent outputs)  
**Output**: `PipelineSummary`

```typescript
interface PipelineSummary {
  // Executive Summary
  headline: string;                    // e.g., "SFTP-to-REST Integration Flow Ready for Deployment"
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  readyToDeploy: boolean;
  
  // What was built
  flowDescription: string;             // Plain English summary of the iFlow
  components: ComponentSummary[];      // List of all components with descriptions
  
  // Design Review Results
  designScore: number;
  designChanges: DesignChange[];       // What the Reviewer changed and why
  
  // Validation Results
  validationPassed: boolean;
  validationAttempts: number;
  fixesApplied: FixSummary[];          // What the Fix Agent corrected
  
  // Tenant Compatibility
  tenantCompatible: boolean;
  compatibilityNotes: string[];
  
  // Risk Assessment
  risks: Risk[];
  
  // Full Audit Trail
  timeline: TimelineEvent[];           // Chronological log of all agent actions
  
  // Metrics
  totalDuration: number;               // ms
  totalTokensUsed: number;
  agentBreakdown: AgentMetrics[];
}

interface ComponentSummary {
  type: string;             // "Sender Adapter", "Script", "Router", etc.
  name: string;
  description: string;      // Plain English
  configuration: string;    // Key config values
}

interface DesignChange {
  agent: string;            // Which agent made the change
  component: string;
  change: string;           // What changed
  reason: string;           // Why
  category: 'AUTO_FIX' | 'OPTIMIZATION' | 'CORRECTION' | 'SECURITY';
}

interface Risk {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  mitigation: string;
}

interface TimelineEvent {
  timestamp: number;
  agent: string;
  action: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  duration: number;
  details: string;
}
```

---

## Orchestrator Design

### Pipeline State Machine

The Orchestrator is the controller that sequences agent execution, manages state transitions, and handles failures.

```typescript
type PipelinePhase = 
  | 'INIT'
  | 'ARCHITECTURE'        // Architect Agent running
  | 'DESIGN_REVIEW'       // Reviewer Agent running
  | 'BPMN_GENERATION'     // BPMN2Generator (deterministic)
  | 'VALIDATION'           // Validator Agent running
  | 'FIX_ATTEMPT'          // Fix Agent running (retry loop)
  | 'SUMMARIZATION'        // Summarizer Agent running
  | 'AWAITING_APPROVAL'    // User decision needed
  | 'DEPLOYING'            // Creating in SAP CPI
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

interface PipelineState {
  id: string;
  phase: PipelinePhase;
  startedAt: number;
  updatedAt: number;
  
  // Inputs
  tenantId: string;
  userId: string;
  packageSelection: PackageSelection;
  description: IFlowDescription;
  tenantCapabilities: TenantCapabilities;
  
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
    scriptFiles: ScriptFile[];
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
  
  deploymentResult?: {
    success: boolean;
    iflowId: string;
    deploymentUrl: string;
    error?: string;
  };
  
  // Error tracking
  error?: {
    phase: PipelinePhase;
    message: string;
    recoverable: boolean;
  };
}
```

### State Transition Diagram

```
INIT
 │
 ├─── [Fetch tenant capabilities]
 │
 ▼
ARCHITECTURE
 │
 ├─── Architect Agent generates IFlowDesign
 │    ├─── Success → DESIGN_REVIEW
 │    └─── Failure → FAILED
 │
 ▼
DESIGN_REVIEW
 │
 ├─── Reviewer Agent evaluates design
 │    ├─── APPROVED (score ≥ 7) ──────────────────→ BPMN_GENERATION
 │    ├─── NEEDS_CHANGES (auto-fixable) ──────────→ BPMN_GENERATION (with patched design)
 │    └─── REJECTED (critical, needs user input) ─→ AWAITING_APPROVAL (with rejection details)
 │
 ▼
BPMN_GENERATION
 │
 ├─── BPMN2Generator.generate(finalDesign)
 │    ├─── Success → VALIDATION
 │    └─── Exception → FAILED
 │
 ▼
VALIDATION
 │
 ├─── Validator Agent (3-phase validation)
 │    ├─── All passed → SUMMARIZATION
 │    ├─── Fixable errors → FIX_ATTEMPT
 │    └─── Critical unfixable → FAILED (with details)
 │
 ▼
FIX_ATTEMPT (loop, max 3)
 │
 ├─── Fix Agent patches design/XML
 │    ├─── Re-validate → BPMN_GENERATION (with fixed design)
 │    │    ├─── Valid → SUMMARIZATION
 │    │    └─── Still errors → FIX_ATTEMPT (attempt++)
 │    └─── Max retries exceeded → FAILED
 │
 ▼
SUMMARIZATION
 │
 ├─── Summarizer Agent aggregates everything
 │    ├─── Success → AWAITING_APPROVAL
 │    └─── Failure → AWAITING_APPROVAL (with raw data)
 │
 ▼
AWAITING_APPROVAL
 │
 ├─── User reviews summary
 │    ├─── Approve → DEPLOYING
 │    ├─── Request Changes → ARCHITECTURE (with feedback as additional context)
 │    └─── Cancel → CANCELLED
 │
 ▼
DEPLOYING
 │
 ├─── Create package (if new)
 ├─── Upload iFlow
 ├─── Deploy
 │    ├─── Success → COMPLETED
 │    └─── Failure → FAILED (iFlow created but not deployed)
 │
 ▼
COMPLETED / FAILED / CANCELLED
```

---

## Technical Architecture

### New File Structure

```
lib/ai/
├── client.ts                              # (existing) AI model instances
├── orchestrator/
│   ├── pipeline-orchestrator.ts           # State machine controller
│   ├── pipeline-state.ts                  # State types & transitions
│   ├── agent-base.ts                      # Base agent class/interface
│   └── agents/
│       ├── architect-agent.ts             # Enhanced iFlow design generation
│       ├── design-reviewer-agent.ts       # Design review & auto-fix
│       ├── bpmn2-validator-agent.ts       # 3-phase validation
│       ├── fix-agent.ts                   # Error correction with retry
│       └── summarizer-agent.ts            # Pipeline summary generation
├── orchestrator/prompts/
│   ├── architect-prompts.ts               # (refactored from prompts-iflow-creator.ts)
│   ├── reviewer-prompts.ts                # Design review system prompt
│   ├── fix-prompts.ts                     # Fix agent system prompt
│   └── summarizer-prompts.ts              # Summary generation prompt
├── prompts-iflow-creator.ts               # (existing — preserved for backward compat)
├── prompts.ts                             # (existing)
├── tools.ts                               # (existing)
└── types.ts                               # (existing)

lib/sap-cpi/
├── client.ts                              # (existing — extended with new methods)
├── bpmn2-generator.ts                     # (existing)
├── bpmn2-parser.ts                        # (existing)
├── bpmn2-validator.ts                     # (existing — extended with semantic/tenant checks)
└── tenant-capabilities.ts                 # NEW: Fetch/cache tenant adapter & feature catalog

app/actions/
├── iflow-creator.ts                       # (existing — preserved)
├── create-iflow.ts                        # (existing — preserved)
├── iflow-orchestrator.ts                  # NEW: Server actions for multi-agent pipeline
└── ...

components/ai/v2/specialized/iflow-creator/
├── iflow-creator.tsx                      # (existing — enhanced with orchestrator mode)
├── iflow-orchestrator-view.tsx            # NEW: Multi-agent pipeline UI
├── steps/
│   ├── package-selection.tsx              # (existing)
│   ├── description-input.tsx              # (existing)
│   ├── ai-design-review.tsx               # (existing — enhanced)
│   ├── approval-review.tsx                # (existing — replaced by orchestrator dashboard)
│   ├── creation-progress.tsx              # (existing)
│   ├── pipeline-progress.tsx              # NEW: Real-time pipeline status
│   └── approval-dashboard.tsx             # NEW: Summary-based approval UI
├── components/
│   ├── agent-status-card.tsx              # NEW: Individual agent status display
│   ├── pipeline-timeline.tsx              # NEW: Chronological event viewer
│   ├── design-diff-viewer.tsx             # NEW: Before/after design changes
│   ├── validation-report-card.tsx         # NEW: Validation results display
│   ├── summary-panel.tsx                  # NEW: Summarizer output display
│   └── risk-assessment.tsx                # NEW: Risk visualization
└── types.ts                               # (existing — extended)

convex/
├── schema.ts                              # (existing — extended with pipeline tables)
├── iflowPipeline.ts                       # NEW: Pipeline state queries
└── iflowPipelineMutations.ts             # NEW: Pipeline state mutations
```

### Convex Schema Extensions

```typescript
// Add to convex/schema.ts

// Pipeline execution status
export const pipelinePhaseValidator = v.union(
  v.literal("INIT"),
  v.literal("ARCHITECTURE"),
  v.literal("DESIGN_REVIEW"),
  v.literal("BPMN_GENERATION"),
  v.literal("VALIDATION"),
  v.literal("FIX_ATTEMPT"),
  v.literal("SUMMARIZATION"),
  v.literal("AWAITING_APPROVAL"),
  v.literal("DEPLOYING"),
  v.literal("COMPLETED"),
  v.literal("FAILED"),
  v.literal("CANCELLED")
);

// iFlow Pipeline Execution table
iflowPipelines: defineTable({
  // Identity
  userId: v.id("users"),
  tenantId: v.id("cpiTenants"),
  
  // Current state
  phase: pipelinePhaseValidator,
  
  // Inputs (stored as JSON strings)
  packageSelection: v.string(),       // JSON
  description: v.string(),            // JSON
  tenantCapabilities: v.optional(v.string()), // JSON
  
  // Agent outputs (populated progressively, JSON strings)
  architectResult: v.optional(v.string()),
  reviewerResult: v.optional(v.string()),
  bpmn2Xml: v.optional(v.string()),
  validatorResult: v.optional(v.string()),
  fixAttempts: v.optional(v.string()),       // JSON array
  summarizerResult: v.optional(v.string()),
  deploymentResult: v.optional(v.string()),
  
  // The final approved design
  finalDesign: v.optional(v.string()),       // JSON
  
  // Error state
  errorPhase: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  errorRecoverable: v.optional(v.boolean()),
  
  // Metrics
  totalTokensUsed: v.number(),
  totalDuration: v.optional(v.number()),
  
  // Timestamps
  startedAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index("by_userId", ["userId"])
  .index("by_tenantId", ["tenantId"])
  .index("by_phase", ["phase"])
  .index("by_userId_tenantId", ["userId", "tenantId"]),

// Individual agent execution logs (for audit trail)
iflowPipelineAgentLogs: defineTable({
  pipelineId: v.id("iflowPipelines"),
  agentName: v.string(),                // "ARCHITECT" | "REVIEWER" | "VALIDATOR" | "FIX" | "SUMMARIZER"
  
  status: v.union(
    v.literal("RUNNING"),
    v.literal("COMPLETED"),
    v.literal("FAILED"),
    v.literal("SKIPPED")
  ),
  
  input: v.optional(v.string()),         // JSON (truncated for large inputs)
  output: v.optional(v.string()),        // JSON
  errorMessage: v.optional(v.string()),
  
  tokensUsed: v.number(),
  duration: v.number(),                  // ms
  attemptNumber: v.optional(v.number()), // For Fix Agent retries
  
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index("by_pipelineId", ["pipelineId"])
  .index("by_pipelineId_agentName", ["pipelineId", "agentName"]),
```

---

## Implementation Phases

### Phase 1: Foundation & Orchestrator Core (Week 1)

**Goal**: Build the pipeline state machine and agent base infrastructure.

| Task | File | Description |
|------|------|-------------|
| 1.1 | `lib/ai/orchestrator/pipeline-state.ts` | Define all types: `PipelineState`, `PipelinePhase`, agent input/output interfaces |
| 1.2 | `lib/ai/orchestrator/agent-base.ts` | Create `BaseAgent` abstract class with `execute()`, error handling, metrics tracking, logging |
| 1.3 | `lib/ai/orchestrator/pipeline-orchestrator.ts` | Implement state machine: transition logic, phase sequencing, error recovery, retry management |
| 1.4 | `convex/schema.ts` | Add `iflowPipelines` and `iflowPipelineAgentLogs` tables |
| 1.5 | `convex/iflowPipeline.ts` | Queries: `getById`, `listByUser`, `getAgentLogs` |
| 1.6 | `convex/iflowPipelineMutations.ts` | Mutations: `create`, `updatePhase`, `setAgentResult`, `logAgentExecution` |

**Key Design Decisions:**
- Pipeline state stored in Convex for real-time reactivity (UI updates automatically)
- Each agent writes its output via Convex mutation → UI re-renders instantly
- Orchestrator runs server-side as a Next.js server action (long-running)
- Use Convex's real-time subscriptions so the frontend reflects pipeline progress without polling

```typescript
// lib/ai/orchestrator/agent-base.ts
export abstract class BaseAgent<TInput, TOutput> {
  abstract name: string;
  abstract model: LanguageModel;
  
  async execute(input: TInput, context: PipelineContext): Promise<AgentResult<TOutput>> {
    const startTime = Date.now();
    try {
      const result = await this.run(input, context);
      return {
        success: true,
        output: result.output,
        tokensUsed: result.tokensUsed,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        tokensUsed: 0,
        duration: Date.now() - startTime,
      };
    }
  }
  
  protected abstract run(input: TInput, context: PipelineContext): Promise<{
    output: TOutput;
    tokensUsed: number;
  }>;
}
```

---

### Phase 2: Architect Agent Enhancement (Week 1–2)

**Goal**: Upgrade the existing design generation with structured output and tenant awareness.

| Task | File | Description |
|------|------|-------------|
| 2.1 | `lib/sap-cpi/tenant-capabilities.ts` | Create tenant capability fetcher: available adapters, runtime version, security materials, features |
| 2.2 | `lib/sap-cpi/client.ts` | Extend `SAPCPIClient` with `getRuntimeInfo()`, `getAvailableAdapterTypes()`, `getSecurityMaterials()` |
| 2.3 | `lib/ai/orchestrator/agents/architect-agent.ts` | Refactor `generateIFlowDesign()` into `ArchitectAgent` class |
| 2.4 | `lib/ai/orchestrator/prompts/architect-prompts.ts` | Enhanced prompts with tenant capabilities injection |
| 2.5 | Upgrade to structured output | Use Vercel AI SDK `experimental_output` with Zod schema for `IFlowDesign` to eliminate JSON parsing fragility |

**Key Improvement — Structured Output:**
```typescript
// Instead of parsing raw text JSON:
const { object: design } = await generateObject({
  model: google('gemini-2.5-flash-lite'),  // Prototype; swap for production
  schema: iFlowDesignSchema,  // Zod schema matching IFlowDesign
  system: ARCHITECT_SYSTEM_PROMPT,
  prompt: createArchitectPrompt(description, tenantCapabilities),
});
```
This completely eliminates the `cleanAIJson()` fragility and the 8-step repair pipeline.

---

### Phase 3: Design Reviewer Agent (Week 2)

**Goal**: Build the design review and auto-fix agent.

| Task | File | Description |
|------|------|-------------|
| 3.1 | `lib/ai/orchestrator/agents/design-reviewer-agent.ts` | Implement `DesignReviewerAgent` with review logic |
| 3.2 | `lib/ai/orchestrator/prompts/reviewer-prompts.ts` | System prompt with SAP CPI best practice rules, scoring rubric |
| 3.3 | Design diff engine | Implement `computeDesignDiff(original, patched)` to track changes |
| 3.4 | Auto-fix logic | When `verdict === 'NEEDS_CHANGES'`, apply fixes and produce `patchedDesign` |

**Reviewer Agent Flow:**
```typescript
class DesignReviewerAgent extends BaseAgent<ReviewerInput, ReviewerOutput> {
  name = 'REVIEWER';
  model = google('gemini-2.5-flash');
  
  protected async run(input: ReviewerInput, context: PipelineContext) {
    const { design, description, tenantCapabilities } = input;
    
    // 1. Get AI review
    const { object: review } = await generateObject({
      model: this.model,
      schema: designReviewSchema,
      system: REVIEWER_SYSTEM_PROMPT,
      prompt: createReviewerPrompt(design, description, tenantCapabilities),
    });
    
    // 2. If needs changes and auto-fixable, generate patched design
    let patchedDesign: IFlowDesign | undefined;
    let designDiff: DesignDiff[] | undefined;
    
    if (review.verdict === 'NEEDS_CHANGES' && review.autoFixable.length > 0) {
      const { object: fixed } = await generateObject({
        model: this.model,
        schema: iFlowDesignSchema,
        system: REVIEWER_FIX_PROMPT,
        prompt: createFixPrompt(design, review.autoFixable),
      });
      patchedDesign = fixed;
      designDiff = computeDesignDiff(design, fixed);
    }
    
    return {
      output: { review, patchedDesign, designDiff },
      tokensUsed: /* sum of both calls */,
    };
  }
}
```

---

### Phase 4: BPMN2 Validator Agent (Week 3)

**Goal**: Extend validation to semantic analysis and tenant compatibility checking.

| Task | File | Description |
|------|------|-------------|
| 4.1 | `lib/sap-cpi/bpmn2-validator.ts` | Add `validateSemantic()` — graph-based flow analysis |
| 4.2 | `lib/sap-cpi/bpmn2-validator.ts` | Add `validateTenantCompatibility()` — live tenant checks |
| 4.3 | `lib/ai/orchestrator/agents/bpmn2-validator-agent.ts` | Wrap validation in agent interface with 3-phase orchestration |
| 4.4 | Graph analysis utilities | Implement BFS/DFS reachability, cycle detection, dead-end detection |

**Semantic Validation Implementation:**
```typescript
function validateSemantic(xml: string, design: IFlowDesign): SemanticValidation {
  const graph = parseBPMN2ToGraph(xml);
  
  return {
    passed: true,
    orphanedSteps: findOrphanedNodes(graph),
    unreachableSteps: findUnreachableFromStart(graph),
    deadEndBranches: findDeadEnds(graph),
    circularReferences: detectCycles(graph),
    missingScriptFiles: checkScriptReferences(xml, design.scripts),
    invalidRouterConditions: validateRouterXPath(xml, design.routers),
  };
}

function parseBPMN2ToGraph(xml: string): FlowGraph {
  // Parse XML → extract sequenceFlows → build adjacency list
  // Nodes: startEvents, endEvents, callActivities, gateways, subProcesses
  // Edges: sequenceFlow sourceRef/targetRef
}
```

---

### Phase 5: Fix Agent (Week 3–4)

**Goal**: Implement automated error correction with retry loop.

| Task | File | Description |
|------|------|-------------|
| 5.1 | `lib/ai/orchestrator/agents/fix-agent.ts` | Implement `FixAgent` with strategy selection |
| 5.2 | `lib/ai/orchestrator/prompts/fix-prompts.ts` | Targeted fix prompts per strategy type |
| 5.3 | Fix strategy engine | Classify errors → select fix strategy → apply |
| 5.4 | Retry loop integration | Wire into orchestrator with max 3 attempts |

**Fix Agent Strategy Selection:**
```typescript
class FixAgent extends BaseAgent<FixInput, FixOutput> {
  name = 'FIX';
  model = google('gemini-2.5-flash');
  
  protected async run(input: FixInput, context: PipelineContext) {
    const { errors, design, bpmn2Xml, attemptNumber } = input;
    
    // Select strategy based on error types and attempt number
    const strategy = this.selectStrategy(errors, attemptNumber);
    const changes: FixChange[] = [];
    
    switch (strategy) {
      case 'PATCH_DESIGN':
        // Ask AI to fix the IFlowDesign JSON
        const { object: fixedDesign } = await generateObject({
          model: this.model,
          schema: iFlowDesignSchema,
          system: FIX_DESIGN_PROMPT,
          prompt: createDesignFixPrompt(design, errors),
        });
        return { output: { fixedDesign, strategy, changes }, ... };
        
      case 'PATCH_XML':
        // Deterministic XML fixes (missing shapes, edges, namespaces)
        const fixedXml = this.patchXML(bpmn2Xml, errors);
        return { output: { fixedXml, strategy, changes }, ... };
        
      case 'SWAP_COMPONENT':
        // Replace unsupported components with alternatives
        const swapped = this.swapComponents(design, errors, context.tenantCapabilities);
        return { output: { fixedDesign: swapped, strategy, changes }, ... };
        
      case 'REGENERATE':
        // Last resort: re-run Architect with error constraints
        return { output: { regenerate: true, constraints: errors, strategy, changes }, ... };
    }
  }
  
  private selectStrategy(errors: ValidationError[], attempt: number): FixStrategy {
    if (attempt === 1) return 'PATCH_DESIGN';
    if (attempt === 2) return errors.some(e => e.type === 'STRUCTURAL') ? 'PATCH_XML' : 'SWAP_COMPONENT';
    return 'REGENERATE';  // attempt 3
  }
}
```

---

### Phase 6: Summarizer Agent (Week 4)

**Goal**: Build the summary generation and user approval interface.

| Task | File | Description |
|------|------|-------------|
| 6.1 | `lib/ai/orchestrator/agents/summarizer-agent.ts` | Implement `SummarizerAgent` |
| 6.2 | `lib/ai/orchestrator/prompts/summarizer-prompts.ts` | Summary generation prompt |
| 6.3 | Build audit trail from pipeline logs | Aggregate all agent executions into timeline |

**Summarizer Output Format:**
```typescript
class SummarizerAgent extends BaseAgent<PipelineState, PipelineSummary> {
  name = 'SUMMARIZER';
  model = google('gemini-2.5-flash-lite');  // Lightweight model sufficient
  
  protected async run(input: PipelineState, context: PipelineContext) {
    // Build context from all agent outputs
    const summaryContext = this.buildContext(input);
    
    const { object: summary } = await generateObject({
      model: this.model,
      schema: pipelineSummarySchema,
      system: SUMMARIZER_SYSTEM_PROMPT,
      prompt: summaryContext,
    });
    
    // Enrich with computed metrics
    summary.totalDuration = Date.now() - input.startedAt;
    summary.totalTokensUsed = this.computeTotalTokens(input);
    summary.agentBreakdown = this.computeAgentMetrics(input);
    summary.timeline = await this.buildTimeline(input.id);
    
    return { output: summary, tokensUsed: /* ... */ };
  }
}
```

---

### Phase 7: Server Actions & API Layer (Week 4–5)

**Goal**: Wire the orchestrator into Next.js server actions.

| Task | File | Description |
|------|------|-------------|
| 7.1 | `app/actions/iflow-orchestrator.ts` | Main server actions: `startPipeline()`, `approvePipeline()`, `cancelPipeline()`, `retryPipeline()` |
| 7.2 | Real-time state updates | Use Convex mutations within orchestrator to push state updates |
| 7.3 | Streaming progress | Implement server-sent events or leverage Convex subscriptions for live UI updates |

```typescript
// app/actions/iflow-orchestrator.ts

'use server';

export async function startIFlowPipeline(
  tenantId: string,
  packageSelection: PackageSelection,
  description: IFlowDescription
): Promise<string> {  // Returns pipeline ID
  
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  
  // 1. Create pipeline record in Convex
  const pipelineId = await convex.mutation(api.iflowPipelineMutations.create, {
    userId: user._id,
    tenantId,
    packageSelection: JSON.stringify(packageSelection),
    description: JSON.stringify(description),
    phase: 'INIT',
  });
  
  // 2. Run orchestrator (non-blocking — updates Convex as it progresses)
  // Use a background execution pattern
  runPipelineAsync(pipelineId, tenantId, user._id, packageSelection, description);
  
  return pipelineId;
}

async function runPipelineAsync(
  pipelineId: string,
  tenantId: string,
  userId: string,
  packageSelection: PackageSelection,
  description: IFlowDescription
) {
  const orchestrator = new PipelineOrchestrator(pipelineId, convex);
  
  try {
    // Phase 1: Fetch tenant capabilities
    await orchestrator.transition('INIT');
    const capabilities = await fetchTenantCapabilities(tenantId);
    
    // Phase 2: Architect
    await orchestrator.transition('ARCHITECTURE');
    const architectResult = await orchestrator.runAgent(
      new ArchitectAgent(), 
      { description, tenantCapabilities: capabilities }
    );
    
    // Phase 3: Design Review
    await orchestrator.transition('DESIGN_REVIEW');
    const reviewResult = await orchestrator.runAgent(
      new DesignReviewerAgent(),
      { design: architectResult.design, description, tenantCapabilities: capabilities }
    );
    
    // Handle review verdict
    if (reviewResult.review.verdict === 'REJECTED') {
      await orchestrator.transition('AWAITING_APPROVAL');
      return; // User must provide feedback
    }
    
    const finalDesign = reviewResult.patchedDesign || architectResult.design;
    
    // Phase 4: BPMN2 Generation
    await orchestrator.transition('BPMN_GENERATION');
    const generator = new BPMN2Generator();
    const bpmn2Xml = generator.generate(finalDesign);
    
    // Phase 5: Validation (with retry loop)
    let validationPassed = false;
    let currentDesign = finalDesign;
    let currentXml = bpmn2Xml;
    let fixAttempt = 0;
    
    while (!validationPassed && fixAttempt < 3) {
      await orchestrator.transition('VALIDATION');
      const validationResult = await orchestrator.runAgent(
        new BPMN2ValidatorAgent(),
        { xml: currentXml, design: currentDesign, tenantCapabilities: capabilities }
      );
      
      if (validationResult.summary.canProceed) {
        validationPassed = true;
      } else if (validationResult.summary.requiresFix) {
        fixAttempt++;
        await orchestrator.transition('FIX_ATTEMPT');
        const fixResult = await orchestrator.runAgent(
          new FixAgent(),
          { 
            errors: validationResult, 
            design: currentDesign, 
            bpmn2Xml: currentXml,
            attemptNumber: fixAttempt,
            tenantCapabilities: capabilities
          }
        );
        
        if (fixResult.fixedDesign) {
          currentDesign = fixResult.fixedDesign;
          currentXml = generator.generate(currentDesign);
        } else if (fixResult.fixedXml) {
          currentXml = fixResult.fixedXml;
        }
      } else {
        // Unfixable — fail
        await orchestrator.fail('VALIDATION', 'Critical validation errors that cannot be auto-fixed');
        return;
      }
    }
    
    if (!validationPassed) {
      await orchestrator.fail('FIX_ATTEMPT', 'Max fix attempts exceeded');
      return;
    }
    
    // Phase 6: Summarize
    await orchestrator.transition('SUMMARIZATION');
    const summary = await orchestrator.runAgent(
      new SummarizerAgent(),
      orchestrator.getState()
    );
    
    // Phase 7: Await user approval
    await orchestrator.transition('AWAITING_APPROVAL');
    // UI will show the approval dashboard
    
  } catch (error) {
    await orchestrator.fail(orchestrator.currentPhase, String(error));
  }
}

export async function approveIFlowPipeline(pipelineId: string): Promise<CreationResult> {
  const pipeline = await convex.query(api.iflowPipeline.getById, { pipelineId });
  if (pipeline.phase !== 'AWAITING_APPROVAL') {
    throw new Error('Pipeline is not awaiting approval');
  }
  
  // Deploy to SAP CPI
  await convex.mutation(api.iflowPipelineMutations.updatePhase, { 
    pipelineId, phase: 'DEPLOYING' 
  });
  
  const result = await createIFlowInSAPCPI(
    pipeline.tenantId,
    JSON.parse(pipeline.packageSelection),
    JSON.parse(pipeline.finalDesign)
  );
  
  await convex.mutation(api.iflowPipelineMutations.updatePhase, {
    pipelineId,
    phase: result.success ? 'COMPLETED' : 'FAILED',
    deploymentResult: JSON.stringify(result),
  });
  
  return result;
}

export async function cancelIFlowPipeline(pipelineId: string): Promise<void> {
  await convex.mutation(api.iflowPipelineMutations.updatePhase, { 
    pipelineId, phase: 'CANCELLED' 
  });
}
```

---

### Phase 8: Frontend — Pipeline Progress UI (Week 5)

**Goal**: Build real-time pipeline visualization and approval dashboard.

| Task | File | Description |
|------|------|-------------|
| 8.1 | `components/ai/v2/specialized/iflow-creator/iflow-orchestrator-view.tsx` | Main orchestrator UI wrapper |
| 8.2 | `components/ai/v2/specialized/iflow-creator/steps/pipeline-progress.tsx` | Real-time agent progress display |
| 8.3 | `components/ai/v2/specialized/iflow-creator/steps/approval-dashboard.tsx` | Summary-based approval interface |
| 8.4 | `components/ai/v2/specialized/iflow-creator/components/agent-status-card.tsx` | Per-agent status card |
| 8.5 | `components/ai/v2/specialized/iflow-creator/components/pipeline-timeline.tsx` | Chronological event viewer |
| 8.6 | `components/ai/v2/specialized/iflow-creator/components/design-diff-viewer.tsx` | Before/after change viewer |
| 8.7 | `components/ai/v2/specialized/iflow-creator/components/validation-report-card.tsx` | Validator results display |
| 8.8 | `components/ai/v2/specialized/iflow-creator/components/summary-panel.tsx` | Summarizer output UI |

**Pipeline Progress UI Wireframe:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  🔧 iFlow Creator — Multi-Agent Pipeline                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Pipeline Status: DESIGN_REVIEW                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━① ━━② ━━③ ━━④ ━━⑤ ━━━━━━━━━━━━━━  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ ✅ Architect Agent                            12.3s  │ 4,200 tok │
│  │ Generated: SFTP-to-REST integration with 6 components       │  │
│  │ Confidence: HIGH                                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 🔄 Design Reviewer Agent                     Running…        │  │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░ 60%                             │  │
│  │ Checking: Performance configuration…                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ ⏳ BPMN2 Validator Agent                      Pending        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ ⏳ Summarizer Agent                           Pending        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  📊 Total: 4,200 tokens │ 12.3s elapsed                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Approval Dashboard UI Wireframe:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  ✅ Pipeline Complete — Ready for Your Approval                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📋 SFTP-to-REST Integration Flow                                   │
│  Confidence: HIGH │ Score: 8/10 │ 42.7s total │ 18,400 tokens     │
│                                                                     │
│  ┌─────────────────────────── What Was Built ─────────────────────┐│
│  │                                                                 ││
│  │  📡 Adapters (2)                                                ││
│  │  • Sender: SFTP — polls /inbound/ every 5min                   ││
│  │  • Receiver: HTTP — POST to api.example.com/orders             ││
│  │                                                                 ││
│  │  📝 Scripts (1)                                                 ││
│  │  • Groovy: CSV-to-JSON transformer (47 lines)                  ││
│  │                                                                 ││
│  │  🔄 Flow Control (1)                                            ││
│  │  • Content-Based Router: route by order_type header             ││
│  │                                                                 ││
│  │  ⚠️ Error Handling                                               ││
│  │  • Exception Subprocess with 3x retry (exponential backoff)    ││
│  │  • Dead Letter Channel → /error/ directory on SFTP             ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌────────────────────── Design Review Results ───────────────────┐│
│  │ Score: 8/10 — APPROVED with 2 auto-fixes                       ││
│  │                                                                 ││
│  │ Auto-Applied Changes:                                           ││
│  │ ✅ Increased SFTP connection timeout 10s → 30s (performance)   ││
│  │ ✅ Added Content-Type header to HTTP receiver (best practice)   ││
│  │                                                                 ││
│  │ [View Full Review] [View Design Diff]                           ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌──────────────────── Validation Results ────────────────────────┐│
│  │ ✅ Structural: 11/11 checks passed                              ││
│  │ ✅ Semantic: All steps reachable, no dead ends                  ││
│  │ ✅ Tenant: All adapters available on tenant "PROD-EU-01"        ││
│  │                                                                 ││
│  │ Attempts: 1 (passed first try)                                  ││
│  │ [View Full Report]                                              ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌────────────────────── Risk Assessment ─────────────────────────┐│
│  │ 🟢 LOW RISK                                                     ││
│  │ • No high-risk components detected                              ││
│  │ • All security best practices followed                          ││
│  │ • Performance configuration within recommended ranges           ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌────────────────────── Pipeline Timeline ───────────────────────┐│
│  │ 00:00  INIT          Fetched tenant capabilities (2.1s)        ││
│  │ 00:02  ARCHITECT     Generated 6-component design (12.3s)      ││
│  │ 00:15  REVIEWER      Scored 8/10, 2 auto-fixes (8.7s)         ││
│  │ 00:23  BPMN_GEN      Generated 847-line BPMN2 XML (1.2s)      ││
│  │ 00:25  VALIDATOR     Passed all 3 phases (3.8s)                ││
│  │ 00:28  SUMMARIZER    Generated approval summary (4.1s)         ││
│  │ 00:33  AWAITING      Ready for approval                        ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│                                                                     │
│  ┌────────────┐  ┌──────────────────┐  ┌────────────┐             │
│  │ ✅ Approve  │  │ ✏️ Request Changes │  │ ❌ Cancel  │             │
│  │ & Deploy   │  │                  │  │            │             │
│  └────────────┘  └──────────────────┘  └────────────┘             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Real-time updates via Convex subscription:**
```typescript
// In the React component
function PipelineProgress({ pipelineId }: { pipelineId: string }) {
  // Real-time subscription — UI updates automatically as agents complete
  const pipeline = useQuery(api.iflowPipeline.getById, { pipelineId });
  const agentLogs = useQuery(api.iflowPipeline.getAgentLogs, { pipelineId });
  
  return (
    <div>
      <PhaseProgress phase={pipeline?.phase} />
      {agentLogs?.map(log => (
        <AgentStatusCard key={log._id} log={log} />
      ))}
      {pipeline?.phase === 'AWAITING_APPROVAL' && (
        <ApprovalDashboard pipeline={pipeline} />
      )}
    </div>
  );
}
```

---

### Phase 9: Integration & Enhanced Wizard (Week 5–6)

**Goal**: Integrate the orchestrator into the existing wizard, offering users a choice between legacy (fast, single-pass) and orchestrator (thorough, multi-agent) modes.

| Task | File | Description |
|------|------|-------------|
| 9.1 | `components/ai/v2/specialized/iflow-creator/iflow-creator.tsx` | Add mode toggle: "Quick Create" vs "AI-Reviewed Create" |
| 9.2 | Feature flag | `lib/config.ts` — add `FEATURE_IFLOW_ORCHESTRATOR` flag |
| 9.3 | Wizard flow update | Steps 1–2 remain the same; Step 3+ branches by mode |
| 9.4 | Backward compatibility | Legacy flow still works exactly as before |

**Updated Wizard Flow:**
```
Steps 1-2: Package Selection + Description Input (unchanged)
                    │
                    ├─── Quick Mode → Existing single-AI flow (Steps 3-5)
                    │
                    └─── Reviewed Mode → Multi-Agent Pipeline
                              │
                              ├── Pipeline Progress (real-time)
                              ├── Approval Dashboard (summary)
                              └── Deployment (on approve)
```

---

### Phase 10: Testing & Hardening (Week 6)

| Task | Description |
|------|-------------|
| 10.1 | Unit tests for each agent (mock AI responses) |
| 10.2 | Integration test: full pipeline with real Gemini calls |
| 10.3 | Test Fix Agent retry loop (inject validation errors) |
| 10.4 | Test edge cases: reviewer rejects, max retries exceeded, tenant missing adapters |
| 10.5 | Performance benchmark: total pipeline latency budget |
| 10.6 | Error recovery: what happens if a Convex mutation fails mid-pipeline? |
| 10.7 | Concurrent pipelines: ensure user can only have 1 active pipeline per tenant |

---

## Performance Budget

| Agent | Expected Latency | Token Budget | Model |
|-------|-------------------|-------------|-------|
| Tenant Capabilities | 2–5s | 0 | N/A (API call) |
| Architect | 5–12s | 3,000–6,000 | gemini-2.5-flash-lite |
| Design Reviewer | 4–8s | 2,000–4,000 | gemini-2.5-flash-lite |
| BPMN2 Generation | 0.5–2s | 0 | N/A (deterministic) |
| Validator | 1–5s | 0 (structural/semantic) + API calls (tenant) | N/A |
| Fix Agent (per attempt) | 4–8s | 2,000–4,000 | gemini-2.5-flash-lite |
| Summarizer | 2–4s | 1,000–2,000 | gemini-2.5-flash-lite |
| **Total (happy path)** | **20–42s** | **6,000–12,000** | |
| **Total (with 1 fix)** | **30–57s** | **8,000–16,000** | |

---

## Error Handling Strategy

### Agent-Level Errors
| Error | Response |
|-------|----------|
| AI model timeout | Retry once; if still fails, mark pipeline FAILED with clear message |
| AI returns invalid JSON | With structured output (Zod), this should not happen; fallback to text parsing |
| AI hallucination (invents adapter types) | Validator Agent catches this as "unsupported adapter"; Fix Agent swaps it |
| SAP CPI API error (tenant check) | Continue without tenant compat validation; add warning to summary |
| Convex mutation fails | Retry with exponential backoff (3 attempts) |

### Pipeline-Level Recovery
- **Resumable**: If pipeline fails at VALIDATION or later, user can "Retry from Last Phase"
- **Feedback Loop**: If user clicks "Request Changes", their feedback is injected as additional context for the Architect Agent on re-run
- **Graceful Degradation**: If Summarizer fails, show raw agent outputs directly (no summary, but still functional)

---

## Data Flow Diagram

```
┌──────────┐
│   User   │
│  Input   │
└────┬─────┘
     │ IFlowDescription + PackageSelection
     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          PIPELINE ORCHESTRATOR                             │
│                                                                            │
│  ┌──────────────┐                                                         │
│  │  Tenant API   │◄── SAP CPI REST APIs                                   │
│  │  Capabilities │                                                         │
│  └──────┬───────┘                                                         │
│         │ TenantCapabilities                                               │
│         ▼                                                                  │
│  ┌──────────────┐     IFlowDesign                                         │
│  │  Architect    │─────────────────┐                                      │
│  │  Agent (AI)   │                 │                                      │
│  └──────────────┘                 ▼                                       │
│                           ┌──────────────┐                                │
│                           │  Reviewer     │                               │
│                           │  Agent (AI)   │                               │
│                           └──────┬───────┘                                │
│                                  │ ReviewerOutput (patchedDesign?)        │
│                                  ▼                                        │
│                           ┌──────────────┐                                │
│                           │  BPMN2       │                                │
│                           │  Generator   │ (deterministic)                │
│                           └──────┬───────┘                                │
│                                  │ BPMN2 XML string                      │
│                                  ▼                                        │
│                           ┌──────────────┐                                │
│                           │  Validator    │◄── SAP CPI APIs (tenant check)│
│                           │  Agent       │                                │
│                           └──────┬───────┘                                │
│                                  │                                        │
│                        ┌─────────┴──────────┐                            │
│                        │ Valid?              │                            │
│                   Yes  │                No   │                            │
│                        ▼                ▼                                 │
│                  ┌───────────┐   ┌──────────────┐                        │
│                  │ Summarizer│   │  Fix Agent    │                        │
│                  │ Agent (AI)│   │  (AI, ≤3x)   │──── retry loop back    │
│                  └─────┬─────┘   └──────────────┘     to BPMN2 Generator │
│                        │                                                  │
│                        │ PipelineSummary                                  │
│                        ▼                                                  │
│                  ┌──────────────────┐                                     │
│                  │ AWAITING_APPROVAL │                                     │
│                  └──────────────────┘                                     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
     │
     │ User Decision
     ▼
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│ ✅ Approve     │   │ ✏️ Feedback     │   │ ❌ Cancel       │
│ → DEPLOYING    │   │ → ARCHITECTURE │   │ → CANCELLED    │
│ → SAP CPI API  │   │   (with notes) │   │                │
│ → COMPLETED    │   │                │   │                │
└────────────────┘   └────────────────┘   └────────────────┘
```

---

## Model Selection Rationale

| Agent | Model (Prototype) | Model (Production) | Reasoning |
|-------|-------------------|-------------------|----------|
| Architect | `gemini-2.5-flash-lite` | `gemini-2.5-flash` or higher | Needs deep SAP CPI domain knowledge, generates complex JSON |
| Reviewer | `gemini-2.5-flash-lite` | `gemini-2.5-flash` or higher | Critical review requires strong reasoning |
| Fix Agent | `gemini-2.5-flash-lite` | `gemini-2.5-flash` or higher | Code generation for BPMN2 repair requires precision |
| Summarizer | `gemini-2.5-flash-lite` | `gemini-2.5-flash-lite` | Straightforward text summarization; speed/cost optimized |

> **Note**: All agents use `gemini-2.5-flash-lite` during prototype. Model selection is configurable per-agent via `lib/ai/client.ts` and can be upgraded per-agent for production.

**Why `gemini-2.5-flash-lite` for prototype?**
- Current codebase already uses Google AI (Gemini) via Vercel AI SDK
- Flash Lite is the fastest and cheapest option for rapid iteration
- Each agent declares its model independently — trivial to upgrade per-agent for production
- Can always swap to `gemini-2.5-flash`, `gemini-2.5-pro`, GPT-4o, or Claude per-agent later

---

## Migration Strategy

1. **No breaking changes** — existing single-pass wizard continues to work
2. **Feature flag** — `FEATURE_IFLOW_ORCHESTRATOR=true` enables multi-agent mode
3. **UI toggle** — users choose "Quick Create" (legacy) or "Thorough Create" (orchestrator)
4. **Gradual rollout** — start with internal testing, then beta users, then GA
5. **Metrics comparison** — track success rates, deployment failures, and user satisfaction for both modes

---

## Dependencies

### New npm Dependencies
| Package | Purpose | Needed? |
|---------|---------|---------|
| None | Orchestrator is built on existing Vercel AI SDK + Convex | ✅ All existing |

### Existing Dependencies Leveraged
- `ai` (Vercel AI SDK) — `generateObject()` with Zod schemas
- `@ai-sdk/google` — Gemini model provider
- `convex` — Real-time state management
- `fast-xml-parser` — BPMN2 XML parsing for validator
- `zod` — Schema validation for structured AI output

### SAP CPI APIs (existing + new)
| API | Status | Used By |
|-----|--------|---------|
| `GET /IntegrationPackages` | Existing | Architect Agent (context) |
| `POST /IntegrationPackages` | Existing | Deployment |
| `POST /IntegrationDesigntimeArtifacts` | Existing | Deployment |
| `POST /DeployIntegrationDesigntimeArtifact` | Existing | Deployment |
| `GET /IntegrationRuntimeArtifacts` | **New** | Validator Agent (tenant compat) |
| `GET /SecurityArtifactDescriptor` | **New** | Validator Agent (security check) |

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| End-to-end pipeline success rate | > 90% | Pipeline reaches AWAITING_APPROVAL without FAILED |
| First-attempt validation pass rate | > 70% | Validator passes without needing Fix Agent |
| Fix Agent success rate (when needed) | > 80% | Fix resolves errors within 3 attempts |
| User approval rate | > 85% | User clicks Approve (not Cancel/Changes) |
| Total pipeline latency (happy path) | < 45s | INIT → AWAITING_APPROVAL |
| SAP CPI deployment success | > 95% | Deployed iFlow starts without error |
| Design review catches real issues | > 5 issues/100 designs | Issues that would have caused deployment failure |

---

## Estimated Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Foundation | Week 1 | Pipeline state machine, Convex schema, base agent |
| Phase 2: Architect Enhancement | Week 1–2 | Structured output, tenant-aware prompts |
| Phase 3: Design Reviewer | Week 2 | Review agent with auto-fix |
| Phase 4: BPMN2 Validator | Week 3 | Semantic + tenant compatibility validation |
| Phase 5: Fix Agent | Week 3–4 | Auto-correction with retry loop |
| Phase 6: Summarizer | Week 4 | Summary generation and approval data |
| Phase 7: Server Actions | Week 4–5 | API layer, async pipeline execution |
| Phase 8: Frontend UI | Week 5 | Pipeline progress, approval dashboard |
| Phase 9: Integration | Week 5–6 | Wizard mode toggle, feature flag |
| Phase 10: Testing | Week 6 | Full test coverage, edge cases |

**Total: 6 weeks** (1 developer) or **3–4 weeks** (2 developers)

---

## Future Enhancements (Post-MVP)

1. **Learning Loop**: Track deployment success/failure across users → feed back into prompts
2. **Template Agent**: Suggest similar existing iFlows as starting points
3. **Cost Estimator Agent**: Predict runtime costs before deployment
4. **Test Data Generator Agent**: Create test payloads for the new iFlow
5. **Monitoring Setup Agent**: Auto-configure alert rules for the deployed iFlow
6. **Collaborative Review**: Multiple users can review/approve (approval chain)
7. **Version Control Agent**: Track iFlow versions and generate changelogs
8. **Cross-Tenant Deployment**: Deploy the same iFlow to multiple tenants (dev → QA → prod)
