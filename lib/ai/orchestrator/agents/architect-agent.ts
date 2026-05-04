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
import type {
  IntegrationBlueprint,
  PipelineContext,
  SpecialistResultEnvelope,
  TenantCapabilities,
} from '../pipeline-state';
import { createIFlowDesignPrompt, IFLOW_CREATOR_SYSTEM_PROMPT } from '@/lib/ai/prompts-iflow-creator';
import type { IFlowDescription, IFlowDesign } from '@/components/ai/v2/specialized/iflow-creator/types';
import {
  cleanAIJson,
  fixUnescapedQuotesStateMachine,
  parseAIJson,
  tryFixAtPosition,
} from '../utils/json-cleaner';
import { runText } from '@/lib/ai/runtime/text';

// ============================================================================
// Input / Output Types
// ============================================================================

export interface ArchitectInput {
  description: IFlowDescription;
  tenantCapabilities: TenantCapabilities;
  /** Studio mode: planner blueprint to guide pattern + decomposition. */
  blueprint?: IntegrationBlueprint;
  /** Studio mode: specialist outputs to merge into the design. */
  specialistResults?: SpecialistResultEnvelope<unknown>[];
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
    const { description, tenantCapabilities, blueprint, specialistResults } = input;

    // Build enhanced prompt with tenant awareness + (optionally) specialist context
    const userPrompt = buildEnhancedPrompt(
      description,
      tenantCapabilities,
      blueprint,
      specialistResults,
    );

    // Call AI model
    const result = await runText({
      system: IFLOW_CREATOR_SYSTEM_PROMPT,
      prompt: userPrompt,
      // The architect emits the full design — adapters, mappings, scripts,
      // error handlers, flow diagram — in one JSON. With multiple Groovy
      // scripts inline this can run long; 8000 was hitting truncation
      // mid-string. 16000 leaves comfortable headroom.
      maxTokens: 16000,
      temperature: 0.3, // Low temperature for more deterministic design
      modelKind: 'orchestrator',
      jsonMode: true,
    });
    const text = result.text;

    // Log raw response stats for debugging

    // Parse the AI response — with an LLM-based repair fallback when the
    // deterministic repair pipeline can't recover (e.g. unescaped quotes
    // inside Groovy strings that don't match any of our regex heuristics).
    let design: IFlowDesign;
    try {
      design = parseDesignResponse(text);
    } catch (firstParseErr) {
      const errMsg = firstParseErr instanceof Error ? firstParseErr.message : String(firstParseErr);
      console.warn(`[ArchitectAgent] Deterministic repair failed (${errMsg}); falling back to LLM repair`);
      const repair = await runText({
        system:
          "You repair invalid JSON. Return ONLY the corrected JSON object — no prose, no markdown fences. Preserve all keys, values, and structure exactly. The most common bug is unescaped double quotes inside string values containing Groovy or JavaScript code: convert any inline double-quoted Groovy/JS string literals to single-quoted ones (Groovy and JS both accept single quotes), and escape any genuinely needed double quotes as \\\".",
        prompt: `The following response should be a single JSON object but failed to parse with: ${errMsg}\n\nRaw response:\n${text}`,
        modelKind: 'orchestrator',
        temperature: 0,
        maxTokens: 16000,
        jsonMode: true,
      });
      design = parseDesignResponse(repair.text);
    }

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
  capabilities: TenantCapabilities,
  blueprint?: IntegrationBlueprint,
  specialistResults?: SpecialistResultEnvelope<unknown>[],
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
`;

  const integratorSection = buildIntegratorSection(blueprint, specialistResults);

  const rationaleSection = `

## ADDITIONAL OUTPUT REQUEST

After the JSON design, on a new line starting with "RATIONALE:", provide a brief (2-3 sentence) explanation of your key design decisions — why you chose those specific adapters, patterns, and error handling strategies.
`;

  return basePrompt + capabilitySection + integratorSection + rationaleSection;
}

/**
 * When studio specialists have already produced typed outputs (adapters,
 * mappings, scripts, externalization, error handlers, decomposition), the
 * architect's job shifts from "design from scratch" to "integrate the
 * specialists' work into a single coherent IFlowDesign".
 *
 * We pass each specialist's payload as structured context plus an explicit
 * instruction to keep their decisions intact rather than re-deriving them.
 */
function buildIntegratorSection(
  blueprint?: IntegrationBlueprint,
  specialistResults?: SpecialistResultEnvelope<unknown>[],
): string {
  if (!blueprint && (!specialistResults || specialistResults.length === 0)) {
    return '';
  }

  const lines: string[] = [];
  lines.push('\n\n## STUDIO MULTI-AGENT CONTEXT (AUTHORITATIVE)');
  lines.push(
    'You are now acting as **Architect-as-Integrator**. A planner and 1-6 specialists have already produced typed outputs. **Reuse them verbatim** — do not redesign their decisions. Your job is to assemble a single valid `IFlowDesign` JSON that wires their work together.',
  );

  if (blueprint) {
    lines.push('');
    lines.push('### Planner blueprint');
    lines.push('```json');
    lines.push(JSON.stringify(blueprint, null, 2));
    lines.push('```');
    lines.push(
      `- Set \`integrationPattern\` on the design to **${blueprint.pattern}**.`,
    );
    if (blueprint.localProcesses?.length) {
      lines.push(
        `- Emit ${blueprint.localProcesses.length} local integration process(es) matching the planner's list.`,
      );
    }
    if (blueprint.exceptionStrategy && blueprint.exceptionStrategy !== 'NONE') {
      lines.push(
        `- Apply exception strategy **${blueprint.exceptionStrategy}** via \`errorHandlers\` and \`exceptionSubprocesses\`.`,
      );
    }
  }

  if (specialistResults && specialistResults.length > 0) {
    const ok = specialistResults.filter((r) => r.ok);
    const failed = specialistResults.filter((r) => !r.ok);
    lines.push('');
    lines.push('### Specialist outputs');
    for (const env of ok) {
      lines.push(`#### ${env.agent} (${env.durationMs}ms)`);
      lines.push('```json');
      lines.push(JSON.stringify(env.payload, null, 2));
      lines.push('```');
    }
    if (failed.length > 0) {
      lines.push('');
      lines.push('### Failed specialists (work around these)');
      for (const env of failed) {
        lines.push(`- **${env.agent}**: ${env.error}`);
      }
    }

    lines.push('');
    lines.push('### Integration rules');
    lines.push(
      '- Adapter specialist output → populate `adapters[]` with the same `id`/`type`/`config` values; preserve `"{{paramName}}"` placeholders.',
    );
    lines.push(
      '- Mapping specialist output → emit one `mappings[]` entry per mapping ref. The actual `.mmap` file content is stored separately; reference it by its `artifactRef`.',
    );
    lines.push(
      '- Script specialist output → emit one `scripts[]` entry per script ref. Set `scriptContent` to a SHORT placeholder comment (`"// see <artifactRef>"`); the real source is persisted alongside the design.',
    );
    lines.push(
      '- Externalization specialist output → wire the externalized values as `"{{PARAM_NAME}}"` placeholders inside adapter `config` and script properties; the parameters.prop file is persisted separately.',
    );
    lines.push(
      '- Error handler specialist output → emit `errorHandlers[]` and `exceptionSubprocesses[]` matching the specialist\'s steps.',
    );
    lines.push(
      '- Decomposition specialist output → emit `localProcesses[]` and reference them via call activities in `flowDiagram[]`/`steps[]`.',
    );
    lines.push(
      '- For any failed specialist above, fall back to a minimal stub of that concern (e.g. an inline mapping or basic error handler) and note the fallback in `performanceNotes`.',
    );
  }

  return lines.join('\n');
}

// ============================================================================
// Response Parsing — robust cleaner adapted from the production iflow-creator
// ============================================================================

function parseDesignResponse(text: string): IFlowDesign {
  // Step 0: Try the deterministic cascade first. It runs the state-machine
  // quote fixer on the freshly-extracted root JSON BEFORE any aggressive
  // regex munging, which correctly recovers Groovy strings like
  // `props.get("RETRY_COUNT")` that the regex pipeline can miss when many
  // similar patterns appear in one scriptContent value.
  try {
    return parseAIJson<IFlowDesign>(text);
  } catch {
    // Fall through to the legacy repair pipeline below.
  }

  // Step 1: Clean & extract JSON from the raw AI text
  let json = cleanAIJson(text);


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
        return parsed;
      } catch {
        // Continue to next repair
      }
    }

    // Step 5: State-machine repair on the fully-repaired string
    try {
      const smFixed = fixUnescapedQuotesStateMachine(repaired);
      const parsed = JSON.parse(smFixed);
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
