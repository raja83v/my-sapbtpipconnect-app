/**
 * BPMN2 Validator Agent
 *
 * Three-phase validation of BPMN2 XML:
 * 1. Structural — extends existing validateBPMN2() with additional checks
 * 2. Semantic — graph-based: reachability, dead-ends, cycles, orphaned steps
 * 3. Tenant Compatibility — checks components against tenant capabilities
 *
 * This agent is fully deterministic (no LLM needed).
 * Model: null
 */

import { BaseAgent } from '../agent-base';
import type { LanguageModel } from 'ai';
import type {
  PipelineContext,
  ValidationReport,
  ValidationError,
  ValidationWarning,
  SemanticValidation,
  TenantCompatValidation,
  TenantIssue,
  TenantCapabilities,
} from '../pipeline-state';
import type { IFlowDesign } from '@/components/ai/v2/specialized/iflow-creator/types';
import { validateBPMN2 } from '@/lib/sap-cpi/bpmn2-validator';

// ============================================================================
// Input / Output Types
// ============================================================================

export interface Bpmn2ValidatorInput {
  xml: string;
  design: IFlowDesign;
  tenantCapabilities: TenantCapabilities;
  scriptFiles?: { path: string; content: string }[];
}

export type Bpmn2ValidatorOutput = ValidationReport;

// ============================================================================
// Agent Implementation
// ============================================================================

export class Bpmn2ValidatorAgent extends BaseAgent<Bpmn2ValidatorInput, Bpmn2ValidatorOutput> {
  readonly name = 'VALIDATOR' as const;
  readonly model: LanguageModel | null = null; // Deterministic — no AI needed
  readonly description = 'Validates BPMN2 XML structurally, semantically, and against tenant capabilities';

  protected async run(
    input: Bpmn2ValidatorInput,
    _context: PipelineContext
  ): Promise<{ output: Bpmn2ValidatorOutput; tokensUsed: number }> {
    const { xml, design, tenantCapabilities, scriptFiles } = input;

    // Phase 1: Structural validation (extends existing)
    const structural = runStructuralValidation(xml);

    // Phase 2: Semantic validation (graph-based)
    const semantic = runSemanticValidation(xml, design, scriptFiles);

    // Phase 3: Tenant compatibility
    const tenantCompat = runTenantCompatibilityValidation(xml, design, tenantCapabilities);

    // Aggregate into summary
    const allErrors = [
      ...structural.errors,
      ...semanticToErrors(semantic),
      ...tenantCompatToErrors(tenantCompat),
    ];

    const allWarnings = [...structural.warnings];

    const criticalCount = allErrors.filter((e) => e.severity === 'CRITICAL').length;
    const highCount = allErrors.filter((e) => e.severity === 'HIGH').length;
    const fixableCount = allErrors.filter((e) => e.fixable).length;

    const canProceed = criticalCount === 0;
    const requiresFix = allErrors.length > 0 && fixableCount > 0;

    const report: ValidationReport = {
      isValid: allErrors.length === 0,
      structural: {
        passed: structural.errors.length === 0,
        errors: structural.errors,
        warnings: structural.warnings,
      },
      semantic,
      tenantCompatibility: tenantCompat,
      summary: {
        totalChecks: structural.totalChecks + semantic.totalChecks + tenantCompat.totalChecks,
        passed:
          structural.totalChecks -
          structural.errors.length +
          (semantic.passed ? semantic.totalChecks : 0) +
          (tenantCompat.passed ? tenantCompat.totalChecks : 0),
        failed: allErrors.length,
        warnings: allWarnings.length,
        canProceed,
        requiresFix,
      },
    };

    return {
      output: report,
      tokensUsed: 0, // No AI used
    };
  }
}

// ============================================================================
// Phase 1: Structural Validation
// ============================================================================

interface StructuralResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  totalChecks: number;
}

function runStructuralValidation(xml: string): StructuralResult {
  // Run existing validator
  const existing = validateBPMN2(xml);

  const errors: ValidationError[] = existing.errors.map((msg, i) => ({
    id: `STRUCT-${String(i + 1).padStart(3, '0')}`,
    type: 'STRUCTURAL' as const,
    severity: categorizeSeverity(msg),
    message: msg,
    location: extractErrorLocation(msg),
    fixable: isAutoFixable(msg),
  }));

  const warnings: ValidationWarning[] = existing.warnings.map((msg, i) => ({
    id: `STRUCT-W-${String(i + 1).padStart(3, '0')}`,
    type: 'structural',
    message: msg,
    location: extractErrorLocation(msg),
  }));

  // Additional structural checks beyond existing validator
  const additionalChecks = runAdditionalStructuralChecks(xml);
  errors.push(...additionalChecks.errors);
  warnings.push(...additionalChecks.warnings);

  return {
    errors,
    warnings,
    totalChecks: 11 + additionalChecks.checkCount, // existing has 11 main checks
  };
}

function runAdditionalStructuralChecks(xml: string): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  checkCount: number;
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let checkCount = 0;
  let errorIndex = 100;

  // Check: Well-formed XML (basic check for balanced tags)
  checkCount++;
  const openingDefs = (xml.match(/<bpmn2:definitions/g) || []).length;
  const closingDefs = (xml.match(/<\/bpmn2:definitions>/g) || []).length;
  if (openingDefs !== closingDefs) {
    errors.push({
      id: `STRUCT-${++errorIndex}`,
      type: 'STRUCTURAL',
      severity: 'CRITICAL',
      message: 'Unbalanced bpmn2:definitions tags — XML is malformed',
      fixable: false,
    });
  }

  // Check: No empty process elements
  checkCount++;
  const emptyProcessMatch = xml.match(
    /<bpmn2:process[^>]*\/>/g
  );
  if (emptyProcessMatch) {
    errors.push({
      id: `STRUCT-${++errorIndex}`,
      type: 'STRUCTURAL',
      severity: 'HIGH',
      message: `Found ${emptyProcessMatch.length} self-closing (empty) process element(s)`,
      fixable: true,
    });
  }

  // Check: ifl:property values are not empty
  checkCount++;
  const emptyValueMatch = xml.match(/<value\s*\/>/g);
  if (emptyValueMatch && emptyValueMatch.length > 5) {
    warnings.push({
      id: `STRUCT-W-${++errorIndex}`,
      type: 'structural',
      message: `${emptyValueMatch.length} empty <value/> tags found — some may need configuration`,
    });
  }

  // Check: XML size sanity (typical iFlows are 10KB-500KB)
  checkCount++;
  if (xml.length > 1_000_000) {
    warnings.push({
      id: `STRUCT-W-${++errorIndex}`,
      type: 'structural',
      message: `XML is unusually large (${(xml.length / 1024).toFixed(0)}KB) — may indicate bloated generation`,
    });
  }

  // Check: Unique IDs across all elements
  checkCount++;
  const allIds = new Set<string>();
  const duplicateIds: string[] = [];
  const idRegex = /\bid="([^"]+)"/g;
  let idMatch: RegExpExecArray | null;
  while ((idMatch = idRegex.exec(xml)) !== null) {
    const id = idMatch[1];
    if (allIds.has(id)) {
      duplicateIds.push(id);
    }
    allIds.add(id);
  }
  if (duplicateIds.length > 0) {
    errors.push({
      id: `STRUCT-${++errorIndex}`,
      type: 'STRUCTURAL',
      severity: 'CRITICAL',
      message: `Duplicate element IDs found: ${duplicateIds.slice(0, 10).join(', ')}${duplicateIds.length > 10 ? ` (+${duplicateIds.length - 10} more)` : ''}`,
      fixable: true,
    });
  }

  // Check: sourceRef and targetRef on sequenceFlow point to valid elements
  checkCount++;
  const seqFlowRefRegex =
    /<bpmn2:sequenceFlow[^>]+sourceRef="([^"]+)"[^>]+targetRef="([^"]+)"/g;
  let sfMatch: RegExpExecArray | null;
  const invalidRefs: string[] = [];
  while ((sfMatch = seqFlowRefRegex.exec(xml)) !== null) {
    const src = sfMatch[1];
    const tgt = sfMatch[2];
    if (!allIds.has(src)) invalidRefs.push(`sourceRef="${src}"`);
    if (!allIds.has(tgt)) invalidRefs.push(`targetRef="${tgt}"`);
  }
  if (invalidRefs.length > 0) {
    errors.push({
      id: `STRUCT-${++errorIndex}`,
      type: 'STRUCTURAL',
      severity: 'HIGH',
      message: `Sequence flows reference non-existent elements: ${invalidRefs.slice(0, 5).join(', ')}`,
      fixable: false,
    });
  }

  return { errors, warnings, checkCount };
}

// ============================================================================
// Phase 2: Semantic Validation
// ============================================================================

interface SemanticResult extends SemanticValidation {
  totalChecks: number;
}

function runSemanticValidation(
  xml: string,
  design: IFlowDesign,
  scriptFiles?: { path: string; content: string }[]
): SemanticResult {
  const orphanedSteps: string[] = [];
  const unreachableSteps: string[] = [];
  const deadEndBranches: string[] = [];
  const circularReferences: string[] = [];
  const missingScriptFiles: string[] = [];
  const invalidRouterConditions: string[] = [];
  let totalChecks = 0;

  // Build adjacency graph from sequence flows
  const graph = buildFlowGraph(xml);

  // Build a set of exception subprocess IDs — these are triggered by errors,
  // NOT connected via sequence flows, so they are expected to be "orphaned".
  const exceptionSubprocessIds = new Set<string>();
  if (design.exceptionSubprocesses) {
    for (const esp of design.exceptionSubprocesses) {
      exceptionSubprocessIds.add(esp.id);
    }
  }
  // Also detect them from the XML (triggeredByEvent="true")
  const espRegex = /bpmn2:subProcess\s+id="([^"]+)"[^>]*triggeredByEvent="true"/g;
  let espMatch: RegExpExecArray | null;
  while ((espMatch = espRegex.exec(xml)) !== null) {
    exceptionSubprocessIds.add(espMatch[1]);
  }

  // Helper: check if a node ID belongs to an exception subprocess
  //   - matches the subprocess container ID itself
  //   - matches any child element whose ID starts with the subprocess ID prefix
  //     (e.g., "exception_subprocess_ErrorStart", "exception_subprocess_Flow_1")
  const isExceptionSubprocessElement = (nodeId: string): boolean => {
    if (exceptionSubprocessIds.has(nodeId)) return true;
    for (const espId of exceptionSubprocessIds) {
      if (nodeId.startsWith(espId + '_')) return true;
    }
    return false;
  };

  // Check 1: Find orphaned steps (no incoming + no outgoing, not start/end, not exception subprocess)
  totalChecks++;
  const startEvents = extractElementIds(xml, 'startEvent');
  const endEvents = extractElementIds(xml, 'endEvent');
  const allNodes = new Set([...graph.nodes]);

  for (const node of allNodes) {
    const isStart = startEvents.includes(node);
    const isEnd = endEvents.includes(node);
    const isEspElement = isExceptionSubprocessElement(node);
    const hasIncoming = graph.incomingEdges.get(node)?.size ?? 0;
    const hasOutgoing = graph.outgoingEdges.get(node)?.size ?? 0;

    if (!isStart && !isEnd && !isEspElement && hasIncoming === 0 && hasOutgoing === 0) {
      orphanedSteps.push(node);
    }
  }

  // Check 2: Find unreachable steps (not reachable from any start event, excluding exception subprocesses)
  totalChecks++;
  const reachable = new Set<string>();
  for (const start of startEvents) {
    bfs(graph, start, reachable);
  }
  for (const node of allNodes) {
    if (!reachable.has(node) && !startEvents.includes(node) && !isExceptionSubprocessElement(node)) {
      unreachableSteps.push(node);
    }
  }

  // Check 3: Dead-end branches (non-end nodes with outgoing but no path to any end event)
  totalChecks++;
  const reverseReachable = new Set<string>();
  for (const end of endEvents) {
    bfsReverse(graph, end, reverseReachable);
  }
  for (const node of allNodes) {
    const hasOutgoing = (graph.outgoingEdges.get(node)?.size ?? 0) > 0;
    if (hasOutgoing && !endEvents.includes(node) && !isExceptionSubprocessElement(node) && !reverseReachable.has(node)) {
      deadEndBranches.push(node);
    }
  }

  // Check 4: Circular references (simple cycle detection via DFS)
  totalChecks++;
  const cycles = detectCycles(graph, startEvents);
  circularReferences.push(...cycles);

  // Check 5: Missing script files referenced in the design
  totalChecks++;
  if (design.scripts) {
    const availableScripts = new Set(
      (scriptFiles ?? []).map((f) => f.path.replace(/^.*[\\/]/, ''))
    );
    for (const script of design.scripts) {
      const fileName = script.name?.endsWith('.groovy')
        ? script.name
        : `${script.name || 'unnamed'}.groovy`;
      // If scriptContent is empty and no file provided, it's missing
      if (!script.scriptContent && !availableScripts.has(fileName)) {
        missingScriptFiles.push(fileName);
      }
    }
  }

  // Check 6: Invalid router conditions
  totalChecks++;
  if (design.routers) {
    for (const router of design.routers) {
      if (router.routingConditions) {
        for (const route of router.routingConditions) {
          if (
            route.expression &&
            !route.expression.includes('${') &&
            !route.expression.includes('header') &&
            !route.expression.includes('property') &&
            route.expression !== 'otherwise' &&
            route.expression !== 'Otherwise'
          ) {
            invalidRouterConditions.push(
              `Router "${router.name}": condition "${route.expression}" may not be a valid XPath/Simple expression`
            );
          }
        }
      }
    }
  }

  const passed =
    orphanedSteps.length === 0 &&
    unreachableSteps.length === 0 &&
    deadEndBranches.length === 0 &&
    circularReferences.length === 0 &&
    missingScriptFiles.length === 0 &&
    invalidRouterConditions.length === 0;

  return {
    passed,
    orphanedSteps,
    unreachableSteps,
    deadEndBranches,
    circularReferences,
    missingScriptFiles,
    invalidRouterConditions,
    totalChecks,
  };
}

// ============================================================================
// Phase 3: Tenant Compatibility Validation
// ============================================================================

interface TenantCompatResult extends TenantCompatValidation {
  totalChecks: number;
}

function runTenantCompatibilityValidation(
  _xml: string,
  design: IFlowDesign,
  capabilities: TenantCapabilities
): TenantCompatResult {
  const unavailableAdapters: TenantIssue[] = [];
  const unsupportedFeatures: TenantIssue[] = [];
  const versionMismatches: TenantIssue[] = [];
  const missingSecurityMaterials: TenantIssue[] = [];
  let totalChecks = 0;

  const availableAdaptersLower = capabilities.availableAdapters.map((a) => a.toLowerCase());
  const supportedFeaturesLower = capabilities.supportedFeatures.map((f) => f.toLowerCase());

  // Check 1: Adapter availability
  totalChecks++;
  if (design.adapters && capabilities.availableAdapters.length > 0) {
    for (const adapter of design.adapters) {
      const adapterType = (adapter.type ?? '').toLowerCase();
      if (adapterType && !availableAdaptersLower.includes(adapterType)) {
        // Check for close matches (e.g., "odata" matching "odatav2")
        const closeMatch = availableAdaptersLower.find(
          (a) => a.includes(adapterType) || adapterType.includes(a)
        );
        unavailableAdapters.push({
          component: adapter.name || adapter.type || 'unknown',
          required: adapter.type || 'unknown',
          available: closeMatch || 'none',
          severity: closeMatch ? 'WARNING' : 'CRITICAL',
          suggestion: closeMatch
            ? `Use "${closeMatch}" instead of "${adapter.type}"`
            : `Install the "${adapter.type}" adapter on the tenant, or use an alternative`,
        });
      }
    }
  }

  // Check 2: Feature/component availability
  totalChecks++;
  const componentTypes = [
    ...(design.splitters ? design.splitters.map(() => 'Splitter') : []),
    ...(design.aggregators ? design.aggregators.map(() => 'Aggregator') : []),
    ...(design.encryptors ? design.encryptors.map(() => 'Encryptor') : []),
    ...(design.decryptors ? design.decryptors.map(() => 'Decryptor') : []),
    ...(design.signers ? design.signers.map(() => 'XMLSigner') : []),
    ...(design.verifiers ? design.verifiers.map(() => 'XMLVerifier') : []),
    ...(design.dataStores ? design.dataStores.map(() => 'DataStoreOperations') : []),
  ];

  if (supportedFeaturesLower.length > 0) {
    for (const compType of componentTypes) {
      if (!supportedFeaturesLower.includes(compType.toLowerCase())) {
        unsupportedFeatures.push({
          component: compType,
          required: compType,
          available: 'Not found in tenant features',
          severity: 'WARNING',
          suggestion: `Verify "${compType}" is available on the tenant runtime`,
        });
      }
    }
  }

  // Check 3: Security material references
  totalChecks++;
  const referencedCredentials: string[] = [];
  if (design.adapters) {
    for (const adapter of design.adapters) {
      const cred =
        adapter.authentication?.credentialName ||
        adapter.authentication?.credentials ||
        '';
      if (cred) referencedCredentials.push(cred);
    }
  }

  if (capabilities.securityMaterials.length > 0) {
    const materialsLower = capabilities.securityMaterials.map((m) => m.toLowerCase());
    for (const cred of referencedCredentials) {
      if (!materialsLower.includes(cred.toLowerCase())) {
        missingSecurityMaterials.push({
          component: cred,
          required: cred,
          available: capabilities.securityMaterials.join(', ') || 'none',
          severity: 'WARNING',
          suggestion: `Create credential "${cred}" on the tenant, or use an existing one: ${capabilities.securityMaterials.join(', ')}`,
        });
      }
    }
  }

  // Check 4: Runtime version compatibility
  totalChecks++;
  // Basic version check — SAP CPI runtime 3.x+ supports all modern features
  if (capabilities.runtimeVersion) {
    const major = parseInt(capabilities.runtimeVersion.split('.')[0], 10);
    if (!isNaN(major) && major < 3) {
      versionMismatches.push({
        component: 'runtime',
        required: '3.0+',
        available: capabilities.runtimeVersion,
        severity: 'WARNING',
        suggestion: 'Some modern integration patterns may not be supported on older runtimes',
      });
    }
  }

  const passed =
    unavailableAdapters.length === 0 &&
    unsupportedFeatures.length === 0 &&
    versionMismatches.length === 0 &&
    missingSecurityMaterials.length === 0;

  return {
    passed,
    unavailableAdapters,
    unsupportedFeatures,
    versionMismatches,
    missingSecurityMaterials,
    totalChecks,
  };
}

// ============================================================================
// Flow Graph Helpers
// ============================================================================

interface FlowGraph {
  nodes: Set<string>;
  outgoingEdges: Map<string, Set<string>>;
  incomingEdges: Map<string, Set<string>>;
}

function buildFlowGraph(xml: string): FlowGraph {
  const nodes = new Set<string>();
  const outgoingEdges = new Map<string, Set<string>>();
  const incomingEdges = new Map<string, Set<string>>();

  // Extract all element IDs as nodes
  const elementRegex =
    /bpmn2:(?:startEvent|endEvent|callActivity|subProcess|exclusiveGateway|parallelGateway|serviceTask|task|sendTask|receiveTask)\s+id="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = elementRegex.exec(xml)) !== null) {
    nodes.add(match[1]);
  }

  // Extract sequence flows as edges
  const seqFlowRegex =
    /<bpmn2:sequenceFlow[^>]+sourceRef="([^"]+)"[^>]+targetRef="([^"]+)"/g;
  while ((match = seqFlowRegex.exec(xml)) !== null) {
    const source = match[1];
    const target = match[2];

    nodes.add(source);
    nodes.add(target);

    if (!outgoingEdges.has(source)) outgoingEdges.set(source, new Set());
    outgoingEdges.get(source)!.add(target);

    if (!incomingEdges.has(target)) incomingEdges.set(target, new Set());
    incomingEdges.get(target)!.add(source);
  }

  return { nodes, outgoingEdges, incomingEdges };
}

function extractElementIds(xml: string, elementType: string): string[] {
  const ids: string[] = [];
  const regex = new RegExp(`bpmn2:${elementType}\\s+id="([^"]+)"`, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

/** BFS forward traversal from a start node */
function bfs(graph: FlowGraph, start: string, visited: Set<string>): void {
  const queue: string[] = [start];
  visited.add(start);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = graph.outgoingEdges.get(current);
    if (neighbors) {
      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
  }
}

/** BFS reverse traversal from an end node (following incoming edges) */
function bfsReverse(graph: FlowGraph, end: string, visited: Set<string>): void {
  const queue: string[] = [end];
  visited.add(end);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = graph.incomingEdges.get(current);
    if (neighbors) {
      for (const prev of neighbors) {
        if (!visited.has(prev)) {
          visited.add(prev);
          queue.push(prev);
        }
      }
    }
  }
}

/** Detect cycles using DFS from start events */
function detectCycles(graph: FlowGraph, startEvents: string[]): string[] {
  const cycles: string[] = [];
  const globalVisited = new Set<string>();

  for (const start of startEvents) {
    const visiting = new Set<string>(); // Current DFS path
    const stack: { node: string; path: string[] }[] = [{ node: start, path: [start] }];

    while (stack.length > 0) {
      const { node, path } = stack.pop()!;

      if (visiting.has(node)) {
        // Found a cycle — extract the cycle portion
        const cycleStart = path.indexOf(node);
        const cyclePath = path.slice(cycleStart);
        cycles.push(`Cycle: ${cyclePath.join(' → ')} → ${node}`);
        continue;
      }

      if (globalVisited.has(node)) continue;

      visiting.add(node);
      globalVisited.add(node);

      const neighbors = graph.outgoingEdges.get(node);
      if (neighbors) {
        for (const next of neighbors) {
          if (visiting.has(next)) {
            const cycleStart = path.indexOf(next);
            const cyclePath = path.slice(cycleStart);
            cycles.push(`Cycle: ${cyclePath.join(' → ')} → ${next}`);
          } else if (!globalVisited.has(next)) {
            stack.push({ node: next, path: [...path, next] });
          }
        }
      }

      // Note: This simplified DFS may miss some edge cases with complex graphs,
      // but is sufficient for typical iFlow structures.
    }
  }

  return [...new Set(cycles)]; // Deduplicate
}

// ============================================================================
// Conversion Helpers
// ============================================================================

function semanticToErrors(semantic: SemanticResult): ValidationError[] {
  const errors: ValidationError[] = [];
  let idx = 200;

  for (const step of semantic.orphanedSteps) {
    errors.push({
      id: `SEM-${++idx}`,
      type: 'SEMANTIC',
      severity: 'HIGH',
      message: `Orphaned step "${step}" — not connected to any flow`,
      location: step,
      fixable: true,
    });
  }

  for (const step of semantic.unreachableSteps) {
    errors.push({
      id: `SEM-${++idx}`,
      type: 'SEMANTIC',
      severity: 'MEDIUM',
      message: `Unreachable step "${step}" — no path from start event`,
      location: step,
      fixable: true,
    });
  }

  for (const branch of semantic.deadEndBranches) {
    errors.push({
      id: `SEM-${++idx}`,
      type: 'SEMANTIC',
      severity: 'MEDIUM',
      message: `Dead-end branch at "${branch}" — no path to end event`,
      location: branch,
      fixable: true,
    });
  }

  for (const cycle of semantic.circularReferences) {
    errors.push({
      id: `SEM-${++idx}`,
      type: 'SEMANTIC',
      severity: 'HIGH',
      message: cycle,
      fixable: false,
    });
  }

  for (const script of semantic.missingScriptFiles) {
    errors.push({
      id: `SEM-${++idx}`,
      type: 'SEMANTIC',
      severity: 'MEDIUM',
      message: `Missing script file: "${script}"`,
      location: script,
      fixable: false,
    });
  }

  for (const condition of semantic.invalidRouterConditions) {
    errors.push({
      id: `SEM-${++idx}`,
      type: 'SEMANTIC',
      severity: 'LOW',
      message: condition,
      fixable: false,
    });
  }

  return errors;
}

function tenantCompatToErrors(compat: TenantCompatResult): ValidationError[] {
  const errors: ValidationError[] = [];
  let idx = 300;

  const toError = (issue: TenantIssue, type: string): ValidationError => ({
    id: `COMPAT-${++idx}`,
    type: 'TENANT_COMPAT',
    severity: issue.severity === 'CRITICAL' ? 'CRITICAL' : 'MEDIUM',
    message: `${type}: "${issue.component}" requires "${issue.required}" but tenant has "${issue.available}"`,
    location: issue.component,
    fixable: issue.severity !== 'CRITICAL',
  });

  for (const issue of compat.unavailableAdapters) {
    errors.push(toError(issue, 'Adapter unavailable'));
  }
  for (const issue of compat.unsupportedFeatures) {
    errors.push(toError(issue, 'Feature unsupported'));
  }
  for (const issue of compat.versionMismatches) {
    errors.push(toError(issue, 'Version mismatch'));
  }
  for (const issue of compat.missingSecurityMaterials) {
    errors.push(toError(issue, 'Missing credential'));
  }

  return errors;
}

// ============================================================================
// Utilities
// ============================================================================

function categorizeSeverity(errorMsg: string): ValidationError['severity'] {
  const msg = errorMsg.toLowerCase();
  if (
    msg.includes('missing bpmn2:definitions') ||
    msg.includes('missing xml declaration') ||
    msg.includes('missing namespace') ||
    msg.includes('missing bpmn2:process') ||
    msg.includes('duplicate element id')
  ) {
    return 'CRITICAL';
  }
  if (
    msg.includes('missing start event') ||
    msg.includes('missing end event') ||
    msg.includes('missing bpmnshape') ||
    msg.includes('references non-existent')
  ) {
    return 'HIGH';
  }
  if (msg.includes('missing')) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function extractErrorLocation(msg: string): string | undefined {
  // Try to extract element IDs from the error message
  const idMatch = msg.match(/(?:elements?|flows?|for)\s*:?\s*([A-Za-z_][\w,\s]+)/);
  return idMatch ? idMatch[1].trim() : undefined;
}

function isAutoFixable(msg: string): boolean {
  const msg_lower = msg.toLowerCase();
  return (
    msg_lower.includes('missing bpmnshape') ||
    msg_lower.includes('missing bpmnedge') ||
    msg_lower.includes('component version') ||
    msg_lower.includes('missing componentversion') ||
    msg_lower.includes('duplicate')
  );
}
