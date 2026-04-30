/**
 * Per-section prompt builder for the streaming Documentation Generator.
 *
 * Strategy: each section is generated as raw Markdown (NOT JSON) via a
 * separate small AI call. This eliminates the JSON-repair churn and allows
 * the UI to stream tokens for each section independently.
 */

import type {
  IFlowDocMetadata,
  DocumentationType,
} from "@/types/documentation-generator";
import { getDocumentTypeTitle, AVAILABLE_SECTIONS } from "@/types/documentation-generator";

// ---------------------------------------------------------------------------
// Shared system prompt (lighter than the legacy one — it asks for Markdown
// instead of JSON, and reminds the model of Mermaid/Markdown rules).
// ---------------------------------------------------------------------------
export const SECTION_SYSTEM_PROMPT = `You are a senior SAP CPI integration architect writing professional technical documentation.

Output rules:
- Respond with PURE GitHub-Flavored Markdown only.
- DO NOT wrap your answer in code fences (\`\`\`markdown ... \`\`\`).
- DO NOT add a top-level H1 heading — the section heading is added by the renderer.
- Start the section directly (with prose, an H2/H3, a list, or a table).
- Use tables for any structured property lists (\`| Property | Value | Description |\`).
- Use fenced code blocks (\`\`\`groovy / \`\`\`xml / \`\`\`json) for code samples.
- Use Mermaid blocks (\`\`\`mermaid ... \`\`\`) only when explicitly asked.
- Never invent properties, scripts, or behaviour not present in the metadata supplied.
- Be concise but technically thorough. Use bullet points over long paragraphs where possible.

Mermaid rules (when used):
1. Keep node labels SHORT (2–4 words).
2. No special characters except spaces, hyphens, underscores.
3. Use square brackets [ ] for ALL nodes.
4. Keep edge labels SHORT (3–4 words max).
5. Prefer \`graph LR\` for flow diagrams.
6. NEVER use \\n, <br>, or quotes inside labels. Replace any line-break with a space. Example: write [Sender S4HANA] not [Sender\\nS4HANA].
7. Each statement on its own line; no blank lines between statements.`;

// ---------------------------------------------------------------------------
// Section-specific guidelines (lifted from legacy buildDocumentationPrompt).
// ---------------------------------------------------------------------------
export const SECTION_GUIDELINES: Record<string, string> = {
  overview:
    "Write a concise business overview: purpose, source/target systems, end-to-end data flow summary, and key metrics (steps, adapters, scripts count). 200–400 words.",
  architecture:
    "Describe the component breakdown and include a Mermaid flowchart that shows ALL adapters, scripts, mappings, routers, and error handlers. Add a brief system context note. Use one ```mermaid``` block.",
  "data-flow":
    "Step-by-step processing description from sender to receiver. Number each step. Describe each transformation, routing decision, and side-effect in order.",
  adapters:
    "Render a Markdown table for EACH adapter with columns | Property | Value | Description |. List type, direction, address, authentication, and EVERY configuration property exactly as supplied.",
  mappings:
    "Source-to-target field mappings in tables, transformation rules, data types, and any value mapping logic.",
  scripts:
    "For EACH script: purpose, input/output, key operations, and a function-by-function logic explanation grounded in the actual script source. Include short code snippets.",
  "error-handling":
    "Each error handler's strategy, retry configuration, exception subprocess details, alerting, and escalation procedures.",
  endpoints:
    "REST/SOAP endpoint URLs, HTTP methods, request/response formats, headers, authentication requirements, and a sample request/response payload.",
  security:
    "Authentication types (Basic, OAuth, Certificate), credential aliases, security materials, TLS settings, and the authorization model.",
  testing:
    "Test scenarios, expected inputs/outputs, validation criteria, edge cases, and integration test procedures. Provide a test matrix table.",
  troubleshooting:
    "Common failure scenarios with resolution steps, log analysis guidance, monitoring alerts, and a decision tree for diagnosis.",
  configuration:
    "All externalized parameters in a table | Parameter | Default | Description | Environment-Specific |, value mappings, and configuration best practices.",
  deployment:
    "Step-by-step deployment procedures, prerequisites, transport configuration, environment setup, and post-deployment verification.",
};

// ---------------------------------------------------------------------------
// Section-aware metadata slice (keeps prompts small and focused).
// ---------------------------------------------------------------------------
function sliceMetadataForSection(
  metadata: IFlowDocMetadata,
  sectionId: string,
): string {
  const header = `### iFlow
- **Name:** ${metadata.name}
- **Description:** ${metadata.description || "N/A"}
- **Version:** ${metadata.version || "1.0.0"}
- **Total Steps:** ${metadata.totalSteps}
- **Parallel Processing:** ${metadata.hasParallelProcessing ? "Yes" : "No"}
- **Loops:** ${metadata.hasLoops ? "Yes" : "No"}
`;

  const adapterDetails = () =>
    metadata.adapters
      .map((a) => {
        const props = a.properties && Object.keys(a.properties).length > 0
          ? "\n  - **Properties:**\n" +
            Object.entries(a.properties)
              .map(([k, v]) => {
                const display =
                  typeof v === "object" ? JSON.stringify(v) : String(v);
                return `    - \`${k}\`: ${display}`;
              })
              .join("\n")
          : "";
        return `- **${a.name}** (${a.type}, ${a.direction})${a.address ? ` — \`${a.address}\`` : ""}${props}`;
      })
      .join("\n");

  const scriptDetails = (includeContent: boolean) =>
    metadata.scripts
      .map((s) => {
        let detail = `- **${s.name}** (${s.type}, ${s.linesOfCode} LOC, ${s.complexity})`;
        if (includeContent && s.content) {
          const max = 1800;
          const content =
            s.content.length > max
              ? s.content.slice(0, max) + "\n// ... (truncated)"
              : s.content;
          detail += `\n\`\`\`groovy\n${content}\n\`\`\``;
        }
        return detail;
      })
      .join("\n");

  const mappingSummary = () =>
    metadata.mappings
      .map((m) => `- **${m.name}** (${m.type}, ${m.complexity})`)
      .join("\n");

  const errorHandlerSummary = () =>
    metadata.errorHandlers
      .map(
        (e) =>
          `- **${e.type}** — Retry ${e.retryEnabled ? `enabled (max ${e.maxRetries ?? "N/A"} retries)` : "disabled"}`,
      )
      .join("\n");

  const routeSummary = () =>
    metadata.routes
      .map(
        (r) =>
          `- → **${r.target}**${r.condition ? ` _(when \`${r.condition}\`)_` : " (default)"}`,
      )
      .join("\n");

  const counts = `**Counts:** adapters=${metadata.adapters.length}, scripts=${metadata.scripts.length}, mappings=${metadata.mappings.length}, errorHandlers=${metadata.errorHandlers.length}, routes=${metadata.routes.length}`;

  switch (sectionId) {
    case "overview":
      return `${header}\n${counts}`;
    case "architecture":
    case "data-flow":
      return `${header}\n${counts}\n\n#### Adapters\n${adapterDetails() || "_none_"}\n\n#### Scripts\n${scriptDetails(false) || "_none_"}\n\n#### Mappings\n${mappingSummary() || "_none_"}\n\n#### Error Handlers\n${errorHandlerSummary() || "_none_"}\n\n#### Routes\n${routeSummary() || "_none_"}`;
    case "adapters":
      return `${header}\n\n#### Adapters\n${adapterDetails() || "_none_"}`;
    case "mappings":
      return `${header}\n\n#### Mappings\n${mappingSummary() || "_none_"}`;
    case "scripts":
      return `${header}\n\n#### Scripts (with source)\n${scriptDetails(true) || "_none_"}`;
    case "error-handling":
      return `${header}\n\n#### Error Handlers\n${errorHandlerSummary() || "_none_"}\n\n#### Routes\n${routeSummary() || "_none_"}`;
    case "endpoints":
    case "security":
      return `${header}\n\n#### Adapters\n${adapterDetails() || "_none_"}`;
    case "testing":
    case "troubleshooting":
      return `${header}\n${counts}\n\n#### Adapters\n${adapterDetails() || "_none_"}\n\n#### Error Handlers\n${errorHandlerSummary() || "_none_"}`;
    case "configuration":
    case "deployment":
      return `${header}\n${counts}\n\n#### Adapters\n${adapterDetails() || "_none_"}`;
    default:
      return `${header}\n${counts}`;
  }
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------
export interface SectionPrompt {
  system: string;
  prompt: string;
  /** Title to display for this section in the UI / docx. */
  title: string;
}

export function buildSectionPrompt(
  metadata: IFlowDocMetadata,
  sectionId: string,
  documentationType: DocumentationType,
): SectionPrompt {
  const def = AVAILABLE_SECTIONS.find((s) => s.id === sectionId);
  const title = def?.name || sectionId;
  const guideline =
    SECTION_GUIDELINES[sectionId] ||
    def?.description ||
    "Write a focused, technically accurate section.";

  const slice = sliceMetadataForSection(metadata, sectionId);
  const docTypeTitle = getDocumentTypeTitle(documentationType);

  const prompt = `You are writing the **${title}** section of a ${docTypeTitle} for an SAP CPI integration flow.

## Section guideline
${guideline}

## iFlow context
${slice}

---

Write the **${title}** section now in pure Markdown. Do not wrap in code fences. Do not include a top-level H1.`;

  return {
    system: SECTION_SYSTEM_PROMPT,
    prompt,
    title,
  };
}
