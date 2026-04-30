/**
 * Diagrams prompt builder for the streaming Documentation Generator.
 *
 * Returns a small JSON-only response: { diagrams: MermaidDiagram[] }.
 */

import type {
  IFlowDocMetadata,
  DocumentationType,
  MermaidDiagram,
} from "@/types/documentation-generator";
import { getDocumentTypeTitle } from "@/types/documentation-generator";
import { cleanAIJson } from "@/lib/ai/orchestrator/utils/json-cleaner";

export const DIAGRAMS_SYSTEM_PROMPT = `You produce SAP CPI architecture and flow diagrams as Mermaid code, packaged in strict JSON.

Output rules:
- Respond with a JSON object ONLY. No prose, no code fences.
- Shape: { "diagrams": [ { "id": "kebab-id", "title": "Short Title", "type": "flowchart"|"sequence"|"class"|"state", "mermaidCode": "..." } ] }.

Mermaid rules:
1. Keep node labels SHORT (2–4 words).
2. No special characters except spaces, hyphens, underscores.
3. Use square brackets [ ] for ALL nodes.
4. Keep edge labels SHORT (3–4 words).
5. Prefer \`graph LR\` for flow diagrams.
6. NEVER include literal \\n, <br>, or quotes inside node labels. Replace any line break with a space. Example: write [Sender S4HANA] not [Sender\\nS4HANA].
7. Each Mermaid statement on its own line; no blank lines between statements.
8. Escape newlines in the surrounding JSON string as \\n (this rule is about JSON, not the label text).`;

export interface DiagramsPrompt {
  system: string;
  prompt: string;
}

export function buildDiagramsPrompt(
  metadata: IFlowDocMetadata,
  documentationType: DocumentationType,
): DiagramsPrompt {
  const adapters = metadata.adapters
    .map((a) => `- ${a.name} (${a.type}, ${a.direction})`)
    .join("\n");
  const scripts = metadata.scripts
    .map((s) => `- ${s.name}`)
    .join("\n");
  const mappings = metadata.mappings.map((m) => `- ${m.name}`).join("\n");
  const errors = metadata.errorHandlers
    .map((e) => `- ${e.type}`)
    .join("\n");
  const routes = metadata.routes
    .map(
      (r) =>
        `- → ${r.target}${r.condition ? ` (when ${r.condition})` : " (default)"}`,
    )
    .join("\n");

  const prompt = `Generate 1–2 Mermaid diagrams for the **${getDocumentTypeTitle(documentationType)}** of this SAP CPI iFlow.

## iFlow: ${metadata.name}
Steps: ${metadata.totalSteps}, Parallel: ${metadata.hasParallelProcessing ? "yes" : "no"}, Loops: ${metadata.hasLoops ? "yes" : "no"}

### Adapters
${adapters || "_none_"}

### Scripts
${scripts || "_none_"}

### Mappings
${mappings || "_none_"}

### Error Handlers
${errors || "_none_"}

### Routes
${routes || "_none_"}

Required diagrams:
1. **architecture-overview** — \`flowchart\` LR showing the end-to-end flow with sender adapter → processing steps (scripts/mappings/routers) → receiver adapter, plus error handler branches.
2. (optional) **sequence** if there is a clear request/response interaction.

Respond with the JSON object only.`;

  return { system: DIAGRAMS_SYSTEM_PROMPT, prompt };
}

export function parseDiagramsResponse(text: string): MermaidDiagram[] {
  const cleaned = cleanAIJson(text);
  try {
    const parsed = JSON.parse(cleaned) as { diagrams?: MermaidDiagram[] };
    if (parsed && Array.isArray(parsed.diagrams)) {
      return parsed.diagrams.filter(
        (d): d is MermaidDiagram =>
          !!d && typeof d.mermaidCode === "string" && d.mermaidCode.length > 0,
      );
    }
  } catch (err) {
    console.warn("[DocGenerator] Failed to parse diagrams JSON:", err);
  }
  return [];
}
