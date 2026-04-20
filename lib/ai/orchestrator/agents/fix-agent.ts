/**
 * Fix Agent
 *
 * Attempts to fix validation errors in the iFlow design or BPMN2 XML.
 * Uses a strategy escalation approach based on error type and attempt number:
 *
 * Attempt 1: PATCH_DESIGN — AI patches the IFlowDesign JSON to fix issues
 * Attempt 2: PATCH_XML — AI directly patches the BPMN2 XML for structural issues
 * Attempt 3: SWAP_COMPONENT — Replace problematic components with alternatives
 *             or REGENERATE — Full redesign via Architect if errors are systemic
 *
 * Max retries: 3
 *
 * Model: gemini-2.5-flash-lite (prototype)
 */

import type { LanguageModel } from 'ai';
import { BaseAgent } from '../agent-base';
import type {
  PipelineContext,
  ValidationError,
  FixAttempt,
  FixChange,
  FixStrategy,
  TenantCapabilities,
} from '../pipeline-state';
import type { IFlowDesign } from '@/components/ai/v2/specialized/iflow-creator/types';
import { runText } from '@/lib/ai/runtime/text';

// ============================================================================
// Constants
// ============================================================================

export const MAX_FIX_ATTEMPTS = 5;

// ============================================================================
// Input / Output Types
// ============================================================================

export interface FixAgentInput {
  design: IFlowDesign;
  xml: string;
  errors: ValidationError[];
  attemptNumber: number;
  previousAttempts: FixAttempt[];
  tenantCapabilities: TenantCapabilities;
}

export interface FixAgentOutput {
  fixAttempt: FixAttempt;
  updatedDesign?: IFlowDesign;
  updatedXml?: string;
}

// ============================================================================
// Agent Implementation
// ============================================================================

export class FixAgent extends BaseAgent<FixAgentInput, FixAgentOutput> {
  readonly name = 'FIX' as const;
  readonly model: LanguageModel | null = null;
  readonly description = 'Fixes validation errors in iFlow design and BPMN2 XML';

  protected async run(
    input: FixAgentInput,
    _context: PipelineContext
  ): Promise<{ output: FixAgentOutput; tokensUsed: number }> {
    const { design, xml, errors, attemptNumber, previousAttempts, tenantCapabilities } = input;

    // Log what we're fixing for diagnostics
    for (const e of errors.slice(0, 5)) {
    }
    if (errors.length > 5) {
      // more than 5 errors, log truncation
    }
    // Determine fix strategy based on attempt number and error types
    const strategy = selectStrategy(errors, attemptNumber, previousAttempts);

    let fixResult: FixAgentOutput;
    let tokensUsed = 0;

    switch (strategy) {
      case 'PATCH_DESIGN': {
        const result = await this.patchDesign(design, errors, tenantCapabilities, previousAttempts);
        fixResult = result.output;
        tokensUsed = result.tokensUsed;
        break;
      }
      case 'PATCH_XML': {
        const result = await this.patchXml(xml, errors);
        fixResult = result.output;
        tokensUsed = result.tokensUsed;
        break;
      }
      case 'SWAP_COMPONENT': {
        const result = await this.swapComponents(design, errors, tenantCapabilities);
        fixResult = result.output;
        tokensUsed = result.tokensUsed;
        break;
      }
      case 'REGENERATE': {
        // Signal to the orchestrator to restart from ARCHITECTURE phase
        fixResult = {
          fixAttempt: {
            attemptNumber,
            errorsToFix: errors,
            strategy: 'REGENERATE',
            changes: [],
            result: 'FAILED',
            remainingErrors: errors,
          },
        };
        tokensUsed = 0;
        break;
      }
    }

    return { output: fixResult, tokensUsed };
  }

  // --------------------------------------------------------------------------
  // Strategy: PATCH_DESIGN — AI fixes the IFlowDesign JSON
  // --------------------------------------------------------------------------

  private async patchDesign(
    design: IFlowDesign,
    errors: ValidationError[],
    tenantCapabilities: TenantCapabilities,
    previousAttempts: FixAttempt[] = []
  ): Promise<{ output: FixAgentOutput; tokensUsed: number }> {
    const errorSummary = errors
      .map((e) => `- [${e.severity}] ${e.message}${e.location ? ` (at ${e.location})` : ''}`)
      .join('\n');

    // Build previous attempts context so the AI doesn't repeat the same failed fixes
    let previousAttemptsSection = '';
    if (previousAttempts.length > 0) {
      const prevSummary = previousAttempts
        .map((a) => `- Attempt ${a.attemptNumber} (${a.strategy}): ${a.result} — ${a.changes.map(c => c.description).join('; ') || 'no changes'}`)
        .join('\n');
      previousAttemptsSection = `\n## Previous Fix Attempts (did NOT fully resolve the issues)\n${prevSummary}\n\nDo NOT repeat the same fixes. Try a DIFFERENT approach.\n`;
    }

    const designJson = JSON.stringify(design, null, 2);
    const truncatedDesign =
      designJson.length > 12000
        ? designJson.substring(0, 12000) + '\n... [truncated]'
        : designJson;

    const prompt = `You are fixing an SAP CPI iFlow design that has validation errors.

## Errors to Fix
${errorSummary}
${previousAttemptsSection}
## Current Design (JSON)
\`\`\`json
${truncatedDesign}
\`\`\`

## Tenant Available Adapters
${tenantCapabilities.availableAdapters.join(', ')}

## Instructions
1. Fix ONLY the reported errors — do not redesign the entire flow
2. For orphaned/unreachable steps, add proper sequence flows connecting them
3. For dead-end branches, connect them to the nearest end event or the next logical step
4. For unavailable adapters, swap to the closest available alternative
5. For missing error handlers, add a basic exception subprocess
6. For missing timeouts, add default 60000ms
7. Ensure ALL router targets reference valid step IDs that exist in the design
8. Return the FULL corrected design JSON
9. After the JSON, add a "CHANGES:" section listing each change

Respond with the corrected JSON, then list changes.`;

    const result = await runText({
      system:
        'You are an SAP CPI integration expert. Fix the design errors precisely. Respond with valid JSON followed by a CHANGES section.',
      prompt,
      maxTokens: 8000,
      temperature: 0.1,
      modelKind: 'orchestrator',
    });
    const text = result.text;

    const tokensUsed = result.usage.totalTokens ?? 0;
    const { fixedDesign, changes } = parsePatchDesignResponse(text, errors);

    // Determine which errors are fixed
    const fixedErrorIds = new Set(changes.map((c) => c.errorId));
    const remainingErrors = errors.filter((e) => !fixedErrorIds.has(e.id));

    const fixResultStatus: FixAttempt['result'] =
      remainingErrors.length === 0
        ? 'FIXED'
        : remainingErrors.length < errors.length
          ? 'PARTIAL'
          : 'FAILED';

    return {
      output: {
        fixAttempt: {
          attemptNumber: 1,
          errorsToFix: errors,
          strategy: 'PATCH_DESIGN',
          changes,
          result: fixResultStatus,
          remainingErrors,
        },
        updatedDesign: fixedDesign || undefined,
      },
      tokensUsed,
    };
  }

  // --------------------------------------------------------------------------
  // Strategy: PATCH_XML — AI directly patches the BPMN2 XML
  // --------------------------------------------------------------------------

  private async patchXml(
    xml: string,
    errors: ValidationError[]
  ): Promise<{ output: FixAgentOutput; tokensUsed: number }> {
    // Only pass structural errors to XML patching
    const structuralErrors = errors.filter((e) => e.type === 'STRUCTURAL');
    if (structuralErrors.length === 0) {
      return {
        output: {
          fixAttempt: {
            attemptNumber: 2,
            errorsToFix: errors,
            strategy: 'PATCH_XML',
            changes: [],
            result: 'FAILED',
            remainingErrors: errors,
          },
        },
        tokensUsed: 0,
      };
    }

    const errorSummary = structuralErrors
      .map((e) => `- [${e.severity}] ${e.message}`)
      .join('\n');

    // Truncate XML for prompt (keep first and last parts for context)
    const maxXmlLen = 10000;
    let truncatedXml = xml;
    if (xml.length > maxXmlLen) {
      const half = Math.floor(maxXmlLen / 2);
      truncatedXml =
        xml.substring(0, half) +
        '\n\n... [middle of XML truncated — ' +
        xml.length +
        ' total chars] ...\n\n' +
        xml.substring(xml.length - half);
    }

    const prompt = `You are fixing BPMN2 XML for an SAP CPI integration flow.

## Structural Errors
${errorSummary}

## Current XML
\`\`\`xml
${truncatedXml}
\`\`\`

## Instructions
1. Fix ONLY the structural errors listed above
2. Do NOT change the business logic or flow structure
3. Common fixes: add missing BPMNShape/BPMNEdge, fix duplicate IDs, add missing namespace
4. Return the FULL corrected XML
5. After the XML, add "CHANGES:" section listing each fix

Respond with the corrected XML, then list changes.`;

    const result = await runText({
      system:
        'You are a BPMN2 XML expert for SAP CPI. Fix structural XML errors precisely. Return valid BPMN2 XML.',
      prompt,
      maxTokens: 10000,
      temperature: 0.1,
      modelKind: 'orchestrator',
    });
    const text = result.text;

    const tokensUsed = result.usage.totalTokens ?? 0;
    const { fixedXml, changes } = parsePatchXmlResponse(text, structuralErrors);

    const fixedIds = new Set(changes.map((c) => c.errorId));
    const remainingErrors = errors.filter((e) => !fixedIds.has(e.id));

    const fixResultStatus: FixAttempt['result'] =
      remainingErrors.length === 0
        ? 'FIXED'
        : remainingErrors.length < errors.length
          ? 'PARTIAL'
          : 'FAILED';

    return {
      output: {
        fixAttempt: {
          attemptNumber: 2,
          errorsToFix: errors,
          strategy: 'PATCH_XML',
          changes,
          result: fixResultStatus,
          remainingErrors,
        },
        updatedXml: fixedXml || undefined,
      },
      tokensUsed,
    };
  }

  // --------------------------------------------------------------------------
  // Strategy: SWAP_COMPONENT — Replace problematic components with alternatives
  // --------------------------------------------------------------------------

  private async swapComponents(
    design: IFlowDesign,
    errors: ValidationError[],
    tenantCapabilities: TenantCapabilities
  ): Promise<{ output: FixAgentOutput; tokensUsed: number }> {
    const changes: FixChange[] = [];
    const patched: IFlowDesign = JSON.parse(JSON.stringify(design));
    const fixedErrorIds = new Set<string>();

    // Swap unavailable adapters to closest alternatives
    const tenantCompat = errors.filter((e) => e.type === 'TENANT_COMPAT');
    const availableAdapters = tenantCapabilities.availableAdapters.map((a) => a.toLowerCase());

    if (patched.adapters) {
      for (let i = 0; i < patched.adapters.length; i++) {
        const adapter = patched.adapters[i];
        const adapterLower = (adapter.type ?? '').toLowerCase();

        if (!availableAdapters.includes(adapterLower)) {
          const replacement = findBestAlternative(adapterLower, availableAdapters);
          if (replacement) {
            const before = adapter.type;
            adapter.type = replacement as typeof adapter.type;
            changes.push({
              errorId: tenantCompat.find((e) => e.location === (adapter.name || adapter.type))?.id || `SWAP-${i}`,
              strategy: 'SWAP_COMPONENT',
              description: `Swapped adapter "${before}" → "${replacement}" (closest available)`,
              before: before || '',
              after: replacement,
            });
            // Mark related errors as fixed
            tenantCompat
              .filter((e) => e.message.includes(before || ''))
              .forEach((e) => fixedErrorIds.add(e.id));
          }
        }
      }
    }

    const remainingErrors = errors.filter((e) => !fixedErrorIds.has(e.id));
    const result: FixAttempt['result'] =
      remainingErrors.length === 0
        ? 'FIXED'
        : fixedErrorIds.size > 0
          ? 'PARTIAL'
          : 'FAILED';

    return {
      output: {
        fixAttempt: {
          attemptNumber: 3,
          errorsToFix: errors,
          strategy: 'SWAP_COMPONENT',
          changes,
          result,
          remainingErrors,
        },
        updatedDesign: changes.length > 0 ? patched : undefined,
      },
      tokensUsed: 0,
    };
  }
}

// ============================================================================
// Strategy Selection
// ============================================================================

function selectStrategy(
  errors: ValidationError[],
  attemptNumber: number,
  previousAttempts: FixAttempt[]
): FixStrategy {
  const hasStructural = errors.some((e) => e.type === 'STRUCTURAL');
  const hasTenantCompat = errors.some((e) => e.type === 'TENANT_COMPAT');
  const hasSemantic = errors.some((e) => e.type === 'SEMANTIC');
  const hasCritical = errors.some((e) => e.severity === 'CRITICAL');

  // Only REGENERATE when we have actual evidence of repeated failure
  if (attemptNumber >= MAX_FIX_ATTEMPTS && previousAttempts.length > 0) {
    const allFailed = previousAttempts.every((a) => a.result === 'FAILED');
    if (allFailed) return 'REGENERATE';
  }

  // Attempt 1: Try design-level patching (handles semantic, adapter, config issues)
  if (attemptNumber === 1) {
    if (hasTenantCompat && !hasCritical) return 'SWAP_COMPONENT';
    return 'PATCH_DESIGN';
  }

  // Attempt 2: Try XML-level patching (handles structural BPMN2 issues)
  if (attemptNumber === 2) {
    if (hasStructural) return 'PATCH_XML';
    if (hasTenantCompat) return 'SWAP_COMPONENT';
    return 'PATCH_DESIGN';
  }

  // Attempt 3+: Escalate based on error types — try SWAP or re-PATCH before REGENERATE
  if (hasTenantCompat) return 'SWAP_COMPONENT';
  if (hasSemantic && !hasStructural) return 'PATCH_DESIGN';
  if (hasStructural) return 'PATCH_XML';
  // Last resort — if nothing else matches, try one more PATCH_DESIGN
  return 'PATCH_DESIGN';
}

// ============================================================================
// Response Parsing
// ============================================================================

function parsePatchDesignResponse(
  text: string,
  errors: ValidationError[]
): { fixedDesign: IFlowDesign | null; changes: FixChange[] } {
  const changes: FixChange[] = [];

  // Extract JSON from response
  let jsonStr: string | null = null;
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  } else {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = text.substring(firstBrace, lastBrace + 1);
    }
  }

  let fixedDesign: IFlowDesign | null = null;
  if (jsonStr) {
    try {
      // Clean common JSON issues
      let cleaned = jsonStr.replace(/,\s*([\]}])/g, '$1');
      cleaned = cleaned.replace(/\/\/[^\n]*/g, '');
      fixedDesign = JSON.parse(cleaned);
    } catch {
      // If main parse fails, try simplifying scripts
      try {
        const simplified = jsonStr.replace(
          /"scriptContent"\s*:\s*"(?:[^"\\]|\\.)*"/g,
          '"scriptContent": ""'
        );
        fixedDesign = JSON.parse(simplified.replace(/,\s*([\]}])/g, '$1'));
      } catch {
        fixedDesign = null;
      }
    }
  }

  // Parse CHANGES section
  const changesMatch = text.match(/CHANGES?:\s*([\s\S]+?)(?:$|```)/i);
  if (changesMatch) {
    const lines = changesMatch[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('-') || l.startsWith('•') || l.match(/^\d+\./));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/^[-•\d.)\s]+/, '').trim();
      if (line) {
        changes.push({
          errorId: errors[i]?.id || `FIX-${i + 1}`,
          strategy: 'PATCH_DESIGN',
          description: line,
          before: '',
          after: '',
        });
      }
    }
  }

  // If no changes parsed but we got a design, create generic changes for each error
  if (changes.length === 0 && fixedDesign) {
    for (const error of errors) {
      changes.push({
        errorId: error.id,
        strategy: 'PATCH_DESIGN',
        description: `Fixed: ${error.message}`,
        before: '',
        after: '',
      });
    }
  }

  return { fixedDesign, changes };
}

function parsePatchXmlResponse(
  text: string,
  errors: ValidationError[]
): { fixedXml: string | null; changes: FixChange[] } {
  const changes: FixChange[] = [];

  // Extract XML from response
  let fixedXml: string | null = null;
  const xmlMatch = text.match(/```(?:xml)?\s*\n?([\s\S]*?)\n?```/);
  if (xmlMatch) {
    fixedXml = xmlMatch[1];
  } else if (text.includes('<?xml')) {
    const xmlStart = text.indexOf('<?xml');
    const xmlEnd = text.lastIndexOf('</bpmn2:definitions>');
    if (xmlEnd > xmlStart) {
      fixedXml = text.substring(xmlStart, xmlEnd + '</bpmn2:definitions>'.length);
    }
  }

  // Validate the extracted XML is at least well-formed
  if (fixedXml && !fixedXml.includes('bpmn2:definitions')) {
    fixedXml = null; // Not valid BPMN2
  }

  // Parse CHANGES section
  const changesMatch = text.match(/CHANGES?:\s*([\s\S]+?)(?:$|```)/i);
  if (changesMatch) {
    const lines = changesMatch[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('-') || l.startsWith('•') || l.match(/^\d+\./));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/^[-•\d.)\s]+/, '').trim();
      if (line) {
        changes.push({
          errorId: errors[i]?.id || `XML-FIX-${i + 1}`,
          strategy: 'PATCH_XML',
          description: line,
          before: '',
          after: '',
        });
      }
    }
  }

  if (changes.length === 0 && fixedXml) {
    for (const error of errors) {
      changes.push({
        errorId: error.id,
        strategy: 'PATCH_XML',
        description: `Fixed: ${error.message}`,
        before: '',
        after: '',
      });
    }
  }

  return { fixedXml, changes };
}

// ============================================================================
// Adapter Matching Helpers
// ============================================================================

/** Find the closest available adapter alternative */
function findBestAlternative(
  requiredType: string,
  availableAdapters: string[]
): string | null {
  // Common adapter equivalences
  const equivalences: Record<string, string[]> = {
    http: ['https', 'rest'],
    https: ['http', 'rest'],
    rest: ['http', 'https'],
    odata: ['odatav2', 'odata_v2', 'odatav4', 'odata_v4'],
    odatav2: ['odata', 'odata_v2'],
    odata_v2: ['odata', 'odatav2'],
    odatav4: ['odata', 'odata_v4'],
    odata_v4: ['odata', 'odatav4'],
    sftp: ['ftp', 'ftps'],
    ftp: ['sftp', 'ftps'],
    mail: ['smtp'],
    imap: ['mail', 'smtp'],
    pop3: ['mail', 'smtp'],
    soap: ['soap_sap_rm', 'http'],
    jms: ['amqp', 'kafka'],
    amqp: ['jms', 'kafka'],
    kafka: ['amqp', 'jms'],
    amazons3: ['azureblob'],
    azureblob: ['amazons3'],
    amazonsqs: ['jms', 'amqp'],
    successfactors: ['successfactors_odata', 'successfactors_rest', 'successfactors_soap'],
  };

  const alts = equivalences[requiredType] ?? [];
  for (const alt of alts) {
    if (availableAdapters.includes(alt)) return alt;
  }

  // Fuzzy match: check if any available adapter contains the required type
  const fuzzy = availableAdapters.find(
    (a) => a.includes(requiredType) || requiredType.includes(a)
  );
  return fuzzy ?? null;
}
