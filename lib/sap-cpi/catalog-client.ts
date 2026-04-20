/**
 * SAP CPI Content Catalog OData Client
 *
 * Queries the catalog.svc OData endpoint to search for SAP-provided standard
 * integration content packages. Uses the same OAuth/Basic Auth credentials
 * as the tenant's CPI APIs.
 *
 * Reference endpoint:
 *   GET {tenantUrl}/odata/1.0/catalog.svc/ContentEntities.ContentPackages
 */

import type {
  CatalogPackage,
  CatalogArtifact,
  CatalogSearchOptions,
  CatalogSearchResult,
} from "@/types/catalog";
import { SAPCPIClient } from "./client";

// ============================================================================
// In-memory cache (catalog content is relatively static)
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  // Evict oldest 10% if we hit 200 entries
  if (cache.size >= 200) {
    const entries = [...cache.entries()].sort(
      (a, b) => a[1].expiresAt - b[1].expiresAt
    );
    const toDelete = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toDelete; i++) {
      cache.delete(entries[i][0]);
    }
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ============================================================================
// Catalog Client
// ============================================================================

export class CatalogClient {
  private sapClient: SAPCPIClient;
  private baseUrl: string;

  constructor(sapClient: SAPCPIClient) {
    this.sapClient = sapClient;
    // The tenant URL is on the client — we access it via the helper.
    this.baseUrl = (sapClient as any).credentials.tenantUrl as string;
  }

  /**
   * Search for SAP-provided content packages in the catalog.
   *
   * Mirrors the OData call:
   *   GET /odata/1.0/catalog.svc/ContentEntities.ContentPackages
   *       ?$filter=SupportedPlatforms eq '...'
   *       &$orderby=ModifiedAt desc
   *       &$format=json
   */
  async searchCatalogPackages(
    options: CatalogSearchOptions = {}
  ): Promise<CatalogSearchResult> {
    const {
      keywords = [],
      supportedPlatform,
      top = 10,
      orderBy = "ModifiedAt desc",
    } = options;

    // Build $filter
    const filterParts: string[] = [];

    // Platform filter — default to SAP HANA Cloud Integration + SAP Process Orchestration
    if (supportedPlatform) {
      filterParts.push(`SupportedPlatforms eq '${supportedPlatform}'`);
    } else {
      filterParts.push(
        "(SupportedPlatforms eq 'SAP HANA Cloud Integration' or SupportedPlatforms eq 'SAP Process Orchestration')"
      );
    }

    // Keyword search via substringof against Name, Description, Keywords
    if (keywords.length > 0) {
      const kwFilter = keywords
        .map((kw) => {
          const safe = kw.replace(/'/g, "''");
          return [
            `substringof('${safe}', Name)`,
            `substringof('${safe}', Description)`,
            `substringof('${safe}', Keywords)`,
          ].join(" or ");
        })
        .map((group) => `(${group})`)
        .join(" or ");

      filterParts.push(`(${kwFilter})`);
    }

    const filterStr = filterParts.join(" and ");

    const cacheKey = `catalog:packages:${filterStr}:${top}:${orderBy}`;
    const cached = getCached<CatalogSearchResult>(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      $filter: filterStr,
      $orderby: orderBy,
      $top: String(top),
      $format: "json",
    });

    const url = `${this.baseUrl}/odata/1.0/catalog.svc/ContentEntities.ContentPackages?${params}`;
    const authHeader = await (this.sapClient as any).getAuthHeader();

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Catalog search failed (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    const packages: CatalogPackage[] = data.d?.results ?? [];

    const result: CatalogSearchResult = {
      packages,
      totalCount: packages.length,
      query: filterStr,
    };

    setCache(cacheKey, result);
    return result;
  }

  /**
   * Fetch the artifacts (iFlows, value mappings, etc.) inside a catalog package.
   *
   * Uses OData navigation:
   *   GET /odata/1.0/catalog.svc/ContentEntities.ContentPackages('{id}')/Artifacts
   *       ?$format=json
   */
  async getCatalogPackageArtifacts(
    packageId: string
  ): Promise<CatalogArtifact[]> {
    const cacheKey = `catalog:artifacts:${packageId}`;
    const cached = getCached<CatalogArtifact[]>(cacheKey);
    if (cached) return cached;

    const safeId = encodeURIComponent(packageId);
    const url = `${this.baseUrl}/odata/1.0/catalog.svc/ContentEntities.ContentPackages('${safeId}')/Artifacts?$format=json`;
    const authHeader = await (this.sapClient as any).getAuthHeader();

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      // Non-critical — some packages may not expose artifacts
      console.warn(
        `Failed to fetch artifacts for package ${packageId}: ${response.status}`
      );
      return [];
    }

    const data = await response.json();
    const artifacts: CatalogArtifact[] = data.d?.results ?? [];

    setCache(cacheKey, artifacts);
    return artifacts;
  }
}
