/**
 * Architect Agent
 * 
 * Generates an iFlow design from natural language description.
 * Enhanced version of the existing generateIFlowDesign() with:
 * - Tenant-aware design (only proposes available components)
 * - Structured output via generateText + JSON parsing (existing pattern)
 * - Design rationale alongside the design
 * 
 * Model: gemini-2.5-flash-lite (prototype)
 */

import type { LanguageModel } from 'ai';
import { BaseAgent } from '../agent-base';
import type { PipelineContext, TenantCapabilities } from '../pipeline-state';
import { createIFlowDesignPrompt, IFLOW_CREATOR_SYSTEM_PROMPT } from '@/lib/ai/prompts-iflow-creator';
import type { IFlowDescription, IFlowDesign } from '@/components/ai/v2/specialized/iflow-creator/types';
import { cleanAIJson, fixUnescapedQuotesStateMachine, tryFixAtPosition } from '../utils/json-cleaner';
import { runText } from '@/lib/ai/runtime/text';

// ============================================================================
// Input / Output Types
// ============================================================================

export interface ArchitectInput {
  description: IFlowDescription;
  tenantCapabilities: TenantCapabilities;
}

export interface ArchitectOutput {
  design: IFlowDesign;
  rationale: string;
}

// ============================================================================
// Agent Implementation
// ============================================================================

export class ArchitectAgent extends BaseAgent<ArchitectInput, ArchitectOutput> {
  readonly name = 'ARCHITECT' as const;
  readonly model: LanguageModel | null = null;
  readonly description = 'Generates iFlow design from natural language requirements';

  protected async run(
    input: ArchitectInput,
    _context: PipelineContext
  ): Promise<{ output: ArchitectOutput; tokensUsed: number }> {
    const { description, tenantCapabilities } = input;

    // Build enhanced prompt with tenant awareness
    const userPrompt = buildEnhancedPrompt(description, tenantCapabilities);

    // Call AI model
    const result = await runText({
      system: IFLOW_CREATOR_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 8000,
      temperature: 0.3, // Low temperature for more deterministic design
      modelKind: 'orchestrator',
    });
    const text = result.text;

    // Log raw response stats for debugging
    console.log(`[ArchitectAgent] Raw response: ${text.length} chars, has markdown: ${text.includes('\`\`\`')}, has newlines: ${text.includes('\\n')}`);
    console.log(`[ArchitectAgent] First 500 chars: ${text.substring(0, 500)}`);

    // Parse the AI response
    const design = parseDesignResponse(text);

    // Ensure all design arrays have defaults
    ensureDesignDefaults(design);

    // Extract rationale (if the AI included it)
    const rationale = extractRationale(text, design);

    const tokensUsed = result.usage.totalTokens ?? 0;

    return {
      output: { design, rationale },
      tokensUsed,
    };
  }
}

// ============================================================================
// Prompt Enhancement
// ============================================================================

function buildEnhancedPrompt(
  description: IFlowDescription,
  capabilities: TenantCapabilities
): string {
  // Use the existing prompt builder
  const basePrompt = createIFlowDesignPrompt(description);

  // Append tenant capability constraints
  const capabilitySection = `

## TENANT CONSTRAINTS (IMPORTANT)

The target SAP CPI tenant has the following capabilities. You MUST only use components from this list:

**Available Adapters:** ${capabilities.availableAdapters.join(', ')}

**Runtime Version:** ${capabilities.runtimeVersion}

**Available Security Materials (credential aliases):** ${
    capabilities.securityMaterials.length > 0
      ? capabilities.securityMaterials.join(', ')
      : 'None configured — use placeholder credential names like "MyCredential"'
  }

If a required adapter is not listed above, choose the closest available alternative and note it in performanceNotes.

## ADDITIONAL OUTPUT REQUEST

After the JSON design, on a new line starting with "RATIONALE:", provide a brief (2-3 sentence) explanation of your key design decisions — why you chose those specific adapters, patterns, and error handling strategies.
`;

  return basePrompt + capabilitySection;
}

// ============================================================================
// Response Parsing — robust cleaner adapted from the production iflow-creator
// ============================================================================

function parseDesignResponse(text: string): IFlowDesign {
  // Step 1: Clean & extract JSON from the raw AI text
  let json = cleanAIJson(text);

  console.log(`[ArchitectAgent] Cleaned JSON length: ${json.length}`);

  // Step 2: Try direct parse
  try {
    return JSON.parse(json);
  } catch (firstError) {
    const errorMsg = firstError instanceof Error ? firstError.message : String(firstError);
    console.warn(`[ArchitectAgent] Direct parse failed: ${errorMsg}`);

    // Log context around the error position for diagnostics
    const posMatch = errorMsg.match(/position\s+(\d+)/i);
    if (posMatch) {
      const pos = parseInt(posMatch[1]);
      const start = Math.max(0, pos - 80);
      const end = Math.min(json.length, pos + 80);
      console.warn(`[ArchitectAgent] Context around pos ${pos}:`);
      console.warn(json.substring(start, pos) + '>>>HERE<<<' + json.substring(pos, end));
    }

    // Step 3: Try state-machine based repair (handles arbitrary unescaped quotes)
    try {
      const smFixed = fixUnescapedQuotesStateMachine(json);
      const parsed = JSON.parse(smFixed);
      console.log('[ArchitectAgent] ✅ Parsed after state-machine quote repair');
      return parsed;
    } catch {
      // continue
    }

    // Step 4: Progressive repair strategies (cumulative)
    let repaired = json;
    const repairs: { name: string; fn: (s: string) => string }[] = [
      {
        name: 'Fix Groovy method call quotes',
        fn: (s) => {
          let r = s;
          r = r.replace(
            /(contains|containsKey|containsValue|get|put|equals|startsWith|endsWith|matches|split|indexOf|replace|replaceFirst|append|concat|find|findAll|collect|join|format|substring|charAt|valueOf|compareTo)\s*\(\s*"([^"\\]*)"\s*\)/g,
            (_m, method: string, arg: string) => `${method}(\\"${arg}\\")`
          );
          r = r.replace(
            /(getProperty|setProperty|getHeader|setHeader|getBody|setBody)\s*\(\s*"([^"\\]*)"\s*\)/g,
            (_m, method: string, arg: string) => `${method}(\\"${arg}\\")`
          );
          r = r.replace(
            /(println|log\.info|log\.debug|log\.error|log\.warn)\s+"([^"\\]*)"/g,
            (_m, method: string, arg: string) => `${method} \\"${arg}\\"`
          );
          r = r.replace(/==\s*"([^"\\]*)"/g, '== \\"$1\\"');
          r = r.replace(/!=\s*"([^"\\]*)"/g, '!= \\"$1\\"');
          // General catch-all for any remaining method("arg") patterns
          r = r.replace(
            /(\w+)\s*\(\s*"([^"\\]{1,100})"\s*\)/g,
            (_m, method: string, arg: string) => `${method}(\\"${arg}\\")`
          );
          return r;
        },
      },
      {
        name: 'Simplify complex Groovy scriptContent',
        fn: (s) =>
          s.replace(
            /"scriptContent"\s*:\s*"((?:[^"\\]|\\.)*(?:\.append|replaceAll)[^"]*(?:[^"\\]|\\.)*)"/gi,
            (_match, content: string) => {
              if (/\.append\s*\(\s*'\\/.test(content) || /replaceAll\s*\(\s*'\\{2,}/.test(content)) {
                return '"scriptContent": "// Complex script — see script file\\nimport com.sap.gateway.ip.core.customdev.util.Message\\n\\ndef Message processData(Message message) {\\n    def body = message.getBody(String)\\n    // TODO: Implement script logic\\n    message.setBody(body)\\n    return message\\n}"';
              }
              return _match;
            }
          ),
      },
      {
        name: 'Fix trailing commas',
        fn: (s) => s.replace(/,(\s*[}\]])/g, '$1'),
      },
      {
        name: 'Fix multiple commas',
        fn: (s) => s.replace(/,(\s*,)+/g, ','),
      },
      {
        name: 'Normalize smart quotes & remove BOM/zero-width',
        fn: (s) =>
          s
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\uFEFF\u200B-\u200D\u2060]/g, ''),
      },
      {
        name: 'Fix single quotes in script content',
        fn: (s) =>
          s.replace(/"scriptContent"\s*:\s*"((?:[^"\\]|\\.)*)"/g, (_match, content: string) => {
            const fixed = content
              .replace(/\\{4,}/g, '\\\\')
              .replace(/\\+'(?=[^'])/g, "\\'")
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t');
            return `"scriptContent": "${fixed}"`;
          }),
      },
      {
        name: 'Fix Groovy replaceAll patterns',
        fn: (s) =>
          s.replace(
            /replaceAll\s*\(\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/g,
            (_match, p1: string, p2: string) => {
              const safeP1 = p1.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
              const safeP2 = p2.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
              return `replaceAll("${safeP1}", "${safeP2}")`;
            }
          ),
      },
      {
        name: 'Escape unescaped newlines in strings',
        fn: (s) =>
          s.replace(/"([^"]*)"/g, (_match, content: string) => {
            const fixed = content
              .replace(/(?<!\\)\n/g, '\\n')
              .replace(/(?<!\\)\r/g, '\\r')
              .replace(/(?<!\\)\t/g, '\\t');
            return `"${fixed}"`;
          }),
      },
      {
        name: 'Remove all scriptContent (last resort)',
        fn: (s) =>
          s.replace(
            /"scriptContent"\s*:\s*"(?:[^"\\]|\\.)*"/g,
            '"scriptContent": "// Script content removed due to parsing issues"'
          ),
      },
      {
        name: 'Truncate long strings (>500 chars)',
        fn: (s) => {
          let r = s.replace(/"([^"]{500,})"/g, '"[content truncated]"');
          r = r.replace(/,(\s*[}\]])/g, '$1');
          return r;
        },
      },
    ];

    for (const repair of repairs) {
      repaired = repair.fn(repaired);
      try {
        const parsed = JSON.parse(repaired);
        console.log(`[ArchitectAgent] ✅ Parsed after repair: ${repair.name}`);
        return parsed;
      } catch {
        // Continue to next repair
      }
    }

    // Step 5: State-machine repair on the fully-repaired string
    try {
      const smFixed = fixUnescapedQuotesStateMachine(repaired);
      const parsed = JSON.parse(smFixed);
      console.log('[ArchitectAgent] ✅ Parsed after cumulative repairs + state-machine');
      return parsed;
    } catch {
      // continue
    }

    // Step 6: Iterative position-based fixing — try up to 10 times
    let iterJson = repaired;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        return JSON.parse(iterJson);
      } catch (iterError) {
        const msg = iterError instanceof Error ? iterError.message : String(iterError);
        const pMatch = msg.match(/position\s+(\d+)/i);
        if (!pMatch) break;

        const errPos = parseInt(pMatch[1]);
        if (errPos >= iterJson.length) break;

        // Look at what's at the error position and try to fix it
        const fixed = tryFixAtPosition(iterJson, errPos);
        if (fixed === iterJson) break; // no change, give up
        iterJson = fixed;
      }
    }

    // Step 7: Nuclear option — strip ALL string values longer than 200 chars
    try {
      let nuclear = repaired.replace(/"([^"]{200,})"/g, '"[content simplified]"');
      nuclear = nuclear.replace(/,(\s*[}\]])/g, '$1');
      const parsed = JSON.parse(nuclear);
      console.log('[ArchitectAgent] ✅ Parsed after nuclear string truncation');
      return parsed;
    } catch {
      // continue
    }

    throw new Error(
      'Failed to parse AI design response after all repair attempts. The AI output was malformed.'
    );
  }
}

// ============================================================================
// Design Defaults
// ============================================================================

function ensureDesignDefaults(design: IFlowDesign): void {
  if (!design.adapters) design.adapters = [];
  if (!design.scripts) design.scripts = [];
  if (!design.mappings) design.mappings = [];
  if (!design.errorHandlers) design.errorHandlers = [];
  if (!design.flowDiagram) design.flowDiagram = [];
  if (!design.performanceNotes) design.performanceNotes = [];
  if (!design.estimatedComplexity) design.estimatedComplexity = 'medium';
  if (!design.converters) design.converters = [];
  if (!design.contentModifiers) design.contentModifiers = [];
  if (!design.routers) design.routers = [];
  if (!design.multicasts) design.multicasts = [];
  if (!design.splitters) design.splitters = [];
  if (!design.aggregators) design.aggregators = [];
  if (!design.joins) design.joins = [];
  if (!design.gathers) design.gathers = [];
  if (!design.filters) design.filters = [];
  if (!design.encryptors) design.encryptors = [];
  if (!design.decryptors) design.decryptors = [];
  if (!design.signers) design.signers = [];
  if (!design.verifiers) design.verifiers = [];
  if (!design.dataStores) design.dataStores = [];
  if (!design.variables) design.variables = [];
  if (!design.persistMessages) design.persistMessages = [];
  if (!design.requestReplies) design.requestReplies = [];
  if (!design.contentEnrichers) design.contentEnrichers = [];
  if (!design.loopingCalls) design.loopingCalls = [];
  if (!design.idempotentCalls) design.idempotentCalls = [];
  if (!design.localProcesses) design.localProcesses = [];
  if (!design.exceptionSubprocesses) design.exceptionSubprocesses = [];
  if (!design.securityNotes) design.securityNotes = [];
  if (!design.flowSteps) design.flowSteps = [];

  // Ensure metadata exists
  if (!design.metadata) {
    design.metadata = {
      name: 'Generated_iFlow',
      id: 'Generated_iFlow',
      description: 'AI-generated integration flow',
      version: '1.0.0',
    };
  }
}

// ============================================================================
// Rationale Extraction
// ============================================================================

function extractRationale(fullText: string, design: IFlowDesign): string {
  // Look for explicit RATIONALE: section
  const rationaleMatch = fullText.match(/RATIONALE:\s*([\s\S]+?)(?:$|```)/i);
  if (rationaleMatch) {
    return rationaleMatch[1].trim();
  }

  // Auto-generate a basic rationale from the design
  const adapterTypes = design.adapters?.map((a) => a.type).join(', ') ?? 'none';
  const scriptCount = design.scripts?.length ?? 0;
  const pattern = design.integrationPattern ?? 'PointToPoint';

  return `Designed a ${pattern} integration flow using adapters [${adapterTypes}] with ${scriptCount} script(s). Complexity: ${design.estimatedComplexity}.`;
}
