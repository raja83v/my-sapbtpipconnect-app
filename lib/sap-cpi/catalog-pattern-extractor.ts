/**
 * SAP CPI Catalog Pattern Extractor
 *
 * Orchestrates the full pipeline:
 *   1. Build smart OData search from user's iFlow description
 *   2. Search the SAP catalog for matching packages
 *   3. Fetch artifacts for the top matches
 *   4. Download & parse BPMN2 from the most relevant iFlows
 *   5. Extract compact design patterns suitable for AI prompt injection
 *
 * The resulting CatalogPatternReference[] is kept compact (~2000 tokens)
 * so it can be injected into the LLM prompt without overwhelming it.
 */

import type { IFlowDescription } from "@/components/ai/v2/specialized/iflow-creator/types";
import type {
  CatalogPackage,
  CatalogPatternReference,
  CatalogSearchResult,
} from "@/types/catalog";
import type { BPMN2ParseResult } from "./bpmn2-parser";
import { CatalogClient } from "./catalog-client";
import { SAPCPIClient } from "./client";

// ============================================================================
// Keyword extraction helpers
// ============================================================================

/**
 * Extract meaningful search keywords from the user's iFlow description.
 * Targets system names, protocol types, and integration patterns.
 */
function extractKeywords(description: IFlowDescription): string[] {
  const keywords: string[] = [];

  // Source/target system names
  if (description.sourceSystem) keywords.push(description.sourceSystem);
  if (description.targetSystem) keywords.push(description.targetSystem);

  // Data format hints
  if (description.dataFormat) keywords.push(description.dataFormat);

  // Extract meaningful terms from the free-text description
  const text = description.description.toLowerCase();

  // SAP product names
  const sapProducts = [
    "s/4hana", "s4hana", "ecc", "ariba", "concur", "fieldglass",
    "successfactors", "c4c", "commerce", "ibp", "btp",
    "hana", "erp", "crm", "srm", "bw", "mdg",
  ];
  for (const product of sapProducts) {
    if (text.includes(product)) keywords.push(product);
  }

  // Integration protocol/pattern names
  const protocols = [
    "idoc", "rfc", "bapi", "odata", "soap", "rest",
    "sftp", "kafka", "jms", "amqp", "as2", "as4",
    "edi", "edifact", "x12",
  ];
  for (const proto of protocols) {
    if (text.includes(proto)) keywords.push(proto);
  }

  // Business domain keywords
  const domains = [
    "purchase order", "sales order", "invoice", "delivery",
    "material", "customer", "vendor", "employee",
    "payment", "inventory", "shipment", "master data",
  ];
  for (const domain of domains) {
    if (text.includes(domain)) keywords.push(domain);
  }

  // Additional requirements
  if (description.requirements) {
    for (const req of description.requirements) {
      // Short requirements are often specific keywords
      if (req.length < 30) keywords.push(req);
    }
  }

  // Deduplicate
  return [...new Set(keywords)].slice(0, 8);
}

// ============================================================================
// Relevance scoring
// ============================================================================

/** Score how relevant a catalog package is to the user's description. */
function scoreRelevance(
  pkg: CatalogPackage,
  description: IFlowDescription
): number {
  let score = 0;
  const combined = `${pkg.Name} ${pkg.Description ?? ""} ${pkg.Keywords ?? ""}`.toLowerCase();
  const userText = description.description.toLowerCase();

  // System name matches score highly
  if (description.sourceSystem && combined.includes(description.sourceSystem.toLowerCase())) {
    score += 0.3;
  }
  if (description.targetSystem && combined.includes(description.targetSystem.toLowerCase())) {
    score += 0.3;
  }

  // Keyword overlap
  const userWords = userText.split(/\s+/).filter((w) => w.length > 3);
  const matchCount = userWords.filter((w) => combined.includes(w)).length;
  score += Math.min(0.3, matchCount * 0.03);

  // Data format match
  if (description.dataFormat && combined.includes(description.dataFormat.toLowerCase())) {
    score += 0.1;
  }

  return Math.min(1, score);
}

// ============================================================================
// Pattern extraction from BPMN2 parse result
// ============================================================================

function extractPatterns(
  pkg: CatalogPackage,
  artifactId: string,
  artifactName: string,
  parseResult: BPMN2ParseResult,
  relevanceScore: number
): CatalogPatternReference {
  return {
    packageName: pkg.Name,
    packageDescription: (pkg.Description ?? "").slice(0, 200),
    artifactId,
    artifactName,
    adapters: parseResult.adapters.map((a) => ({
      type: a.type,
      direction: a.direction,
      address: a.address,
      properties: a.properties ?? {},
    })),
    flowTopology: [
      ...parseResult.routes.map((r) => `Router: ${r.condition ?? "default"}`),
    ],
    errorHandling: {
      retryEnabled: parseResult.errorHandlers.some((e) => e.retryEnabled),
      maxRetries: parseResult.errorHandlers[0]?.maxRetries,
      hasExceptionSubprocess: parseResult.errorHandlers.length > 0,
    },
    scripts: parseResult.scripts.map((s) => ({
      type: s.type,
      complexity: s.complexity,
      linesOfCode: s.linesOfCode,
    })),
    mappings: parseResult.mappings.map((m) => m.type),
    relevanceScore,
  };
}

// ============================================================================
// Public API
// ============================================================================

export interface PatternExtractionResult {
  patterns: CatalogPatternReference[];
  searchResult: CatalogSearchResult;
  /** Any non-fatal warnings that occurred during extraction. */
  warnings: string[];
}

/**
 * Search the SAP catalog and extract design patterns relevant to the user's
 * iFlow description. This is the main orchestration function.
 *
 * @param sapClient  - An authenticated SAPCPIClient (same tenant creds)
 * @param description - The user's iFlow description from the wizard
 * @param maxPackages - Maximum packages to deeply inspect (default 3)
 */
export async function extractCatalogPatterns(
  sapClient: SAPCPIClient,
  description: IFlowDescription,
  maxPackages = 3
): Promise<PatternExtractionResult> {
  const warnings: string[] = [];

  // 1. Build keywords from description
  const keywords = extractKeywords(description);
  if (keywords.length === 0) {
    return {
      patterns: [],
      searchResult: { packages: [], totalCount: 0, query: "(no keywords)" },
      warnings: ["No meaningful keywords could be extracted from the description"],
    };
  }

  // 2. Search catalog
  const catalogClient = new CatalogClient(sapClient);
  let searchResult: CatalogSearchResult;

  try {
    searchResult = await catalogClient.searchCatalogPackages({
      keywords,
      top: 10,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      patterns: [],
      searchResult: { packages: [], totalCount: 0, query: keywords.join(", ") },
      warnings: [`Catalog search failed: ${msg}`],
    };
  }

  if (searchResult.packages.length === 0) {
    return { patterns: [], searchResult, warnings: [] };
  }

  // 3. Score & rank packages by relevance
  const scored = searchResult.packages
    .map((pkg) => ({ pkg, score: scoreRelevance(pkg, description) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPackages);

  // 4. For each top package, fetch artifacts and extract patterns
  const patterns: CatalogPatternReference[] = [];

  for (const { pkg, score } of scored) {
    try {
      // Fetch artifacts list
      const artifacts = await catalogClient.getCatalogPackageArtifacts(pkg.Id);
      const iflowArtifacts = artifacts.filter(
        (a) => a.Type === "IntegrationFlow"
      );

      if (iflowArtifacts.length === 0) {
        // No iFlows — create a metadata-only reference
        patterns.push({
          packageName: pkg.Name,
          packageDescription: (pkg.Description ?? "").slice(0, 200),
          artifactId: pkg.Id,
          artifactName: pkg.Name,
          adapters: [],
          flowTopology: [],
          errorHandling: {
            retryEnabled: false,
            hasExceptionSubprocess: false,
          },
          scripts: [],
          mappings: [],
          relevanceScore: score * 0.5, // Lower score for metadata-only
        });
        continue;
      }

      // Pick the first iFlow artifact to download & parse
      const targetArtifact = iflowArtifacts[0];

      try {
        const parseResult = await sapClient.downloadAndParseIFlow(
          targetArtifact.Id
        );

        if (parseResult) {
          patterns.push(
            extractPatterns(
              pkg,
              targetArtifact.Id,
              targetArtifact.Name,
              parseResult,
              score
            )
          );
        } else {
          warnings.push(
            `Could not parse BPMN2 for ${targetArtifact.Name} in ${pkg.Name}`
          );
        }
      } catch (downloadErr) {
        // Download may fail for browse-only catalog content
        warnings.push(
          `Cannot download ${targetArtifact.Name}: ${
            downloadErr instanceof Error ? downloadErr.message : String(downloadErr)
          }`
        );

        // Fall back to metadata-only reference
        patterns.push({
          packageName: pkg.Name,
          packageDescription: (pkg.Description ?? "").slice(0, 200),
          artifactId: targetArtifact.Id,
          artifactName: targetArtifact.Name,
          adapters: [],
          flowTopology: [],
          errorHandling: {
            retryEnabled: false,
            hasExceptionSubprocess: false,
          },
          scripts: [],
          mappings: [],
          relevanceScore: score * 0.5,
        });
      }
    } catch (pkgErr) {
      warnings.push(
        `Failed to process package ${pkg.Name}: ${
          pkgErr instanceof Error ? pkgErr.message : String(pkgErr)
        }`
      );
    }
  }

  // Sort by relevance (highest first)
  patterns.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return { patterns, searchResult, warnings };
}
