/**
 * Type definitions for SAP CPI Content Catalog integration.
 *
 * The catalog OData API at /odata/1.0/catalog.svc/ContentEntities.ContentPackages
 * exposes SAP-provided standard integration content that can be used as reference
 * patterns when generating new iFlows.
 */

// ============================================================================
// Catalog OData Response Types
// ============================================================================

/** A single content package from the SAP catalog OData API. */
export interface CatalogPackage {
  Id: string;
  Name: string;
  Description: string;
  ShortText?: string;
  Version: string;
  Vendor?: string;
  SupportedPlatforms?: string;
  Products?: string;
  Industries?: string;
  LineOfBusiness?: string;
  Keywords?: string;
  CreatedAt?: string;
  ModifiedAt?: string;
  CreatedBy?: string;
  ModifiedBy?: string;
}

/** An artifact inside a catalog content package. */
export interface CatalogArtifact {
  Id: string;
  Name: string;
  Description?: string;
  Type: string; // IntegrationFlow, ValueMapping, ScriptCollection, etc.
  Version?: string;
}

// ============================================================================
// Catalog Search
// ============================================================================

export interface CatalogSearchOptions {
  /** Free-text keywords to search by (applied to Name, Description, Keywords). */
  keywords?: string[];
  /** Filter by supported platform. Defaults to 'SAP HANA Cloud Integration'. */
  supportedPlatform?: string;
  /** Maximum number of packages to return. Defaults to 10. */
  top?: number;
  /** OData orderby clause. Defaults to 'ModifiedAt desc'. */
  orderBy?: string;
}

export interface CatalogSearchResult {
  packages: CatalogPackage[];
  totalCount: number;
  query: string;
}

// ============================================================================
// Pattern Extraction
// ============================================================================

/** Compact representation of patterns extracted from a reference iFlow. */
export interface CatalogPatternReference {
  /** Source catalog package name. */
  packageName: string;
  /** Source catalog package description. */
  packageDescription: string;
  /** ID of the reference iFlow artifact. */
  artifactId: string;
  /** Name of the reference iFlow artifact. */
  artifactName: string;
  /** Adapter types and directions found in the reference iFlow. */
  adapters: {
    type: string;
    direction: "sender" | "receiver";
    address?: string;
    properties?: Record<string, string>;
  }[];
  /** Flow topology elements (routers, splitters, aggregators, etc.). */
  flowTopology: string[];
  /** Error handling patterns found. */
  errorHandling: {
    retryEnabled: boolean;
    maxRetries?: number;
    hasExceptionSubprocess: boolean;
  };
  /** Script types and their complexity. */
  scripts: {
    type: string;
    complexity: string;
    linesOfCode: number;
  }[];
  /** Mapping/transformation types found. */
  mappings: string[];
  /** Match relevance score (0-1). */
  relevanceScore: number;
}
