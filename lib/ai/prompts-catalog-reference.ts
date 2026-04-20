/**
 * Catalog Reference Pattern Prompt Builder
 *
 * Formats extracted SAP catalog patterns into a structured prompt section
 * that can be injected into the iFlow creator's LLM prompt. The output is
 * kept within a ~2000 token budget to avoid overwhelming the model.
 */

import type { CatalogPatternReference } from "@/types/catalog";

/**
 * Build a prompt section describing SAP catalog reference patterns.
 *
 * Returns an empty string when no patterns are available so the caller
 * can safely concatenate it with the main prompt.
 */
export function buildCatalogReferencePrompt(
  patterns: CatalogPatternReference[]
): string {
  if (!patterns || patterns.length === 0) return "";

  const sections: string[] = [];

  sections.push(`
## SAP Standard Catalog Reference Patterns

The following SAP-provided standard integration packages match the user's requirements.
Use these as reference patterns — follow their adapter choices, flow topology, and
error-handling strategies wherever applicable. Deviate only when the user's specific
requirements demand a different approach, and note the deviation in your recommendations.
`);

  for (const pattern of patterns.slice(0, 3)) {
    const lines: string[] = [];
    lines.push(`### ${pattern.packageName} (relevance: ${(pattern.relevanceScore * 100).toFixed(0)}%)`);
    if (pattern.packageDescription) {
      lines.push(pattern.packageDescription);
    }
    lines.push(`Artifact: ${pattern.artifactName}`);

    // Adapters
    if (pattern.adapters.length > 0) {
      lines.push("");
      lines.push("**Adapters:**");
      for (const a of pattern.adapters) {
        const propSummary = Object.entries(a.properties ?? {})
          .slice(0, 3)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");
        lines.push(
          `- ${a.type} (${a.direction})${a.address ? ` → ${a.address}` : ""}${propSummary ? ` [${propSummary}]` : ""}`
        );
      }
    }

    // Flow topology
    if (pattern.flowTopology.length > 0) {
      lines.push("");
      lines.push("**Flow Topology:**");
      for (const t of pattern.flowTopology.slice(0, 5)) {
        lines.push(`- ${t}`);
      }
    }

    // Error handling
    if (pattern.errorHandling.hasExceptionSubprocess || pattern.errorHandling.retryEnabled) {
      lines.push("");
      lines.push("**Error Handling:**");
      if (pattern.errorHandling.retryEnabled) {
        lines.push(
          `- Retry enabled${pattern.errorHandling.maxRetries ? ` (max ${pattern.errorHandling.maxRetries})` : ""}`
        );
      }
      if (pattern.errorHandling.hasExceptionSubprocess) {
        lines.push("- Exception subprocess present");
      }
    }

    // Scripts
    if (pattern.scripts.length > 0) {
      lines.push("");
      lines.push("**Scripts:**");
      for (const s of pattern.scripts.slice(0, 3)) {
        lines.push(`- ${s.type} (${s.complexity}, ${s.linesOfCode} lines)`);
      }
    }

    // Mappings
    if (pattern.mappings.length > 0) {
      lines.push("");
      lines.push(
        `**Mappings:** ${[...new Set(pattern.mappings)].join(", ")}`
      );
    }

    sections.push(lines.join("\n"));
  }

  sections.push(`
**Instructions for using these references:**
1. Prefer the same adapter types and configurations shown above when they match the user's source/target systems.
2. Follow the same error-handling strategy (retry config, exception subprocess) unless user requires otherwise.
3. Mirror the flow topology (routers, splitters, aggregators) if the integration pattern is similar.
4. In your metadata, note which catalog package(s) inspired the design.
5. If you deviate from the reference patterns, explain why in performanceNotes or securityNotes.
`);

  return sections.join("\n\n");
}
