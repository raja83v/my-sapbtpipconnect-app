/**
 * SAP CPI MCP Server - Cache Manager
 * 
 * Implements short TTL (30s-60s) caching for read operations.
 * No caching for mutations/action tools.
 */

import { CacheEntry, CacheStats } from "../types";
import { createHash } from "crypto";

// In-memory cache store
const cache = new Map<string, CacheEntry<unknown>>();

// Cache statistics
let cacheStats: CacheStats = {
  hits: 0,
  misses: 0,
  size: 0,
  oldestEntry: undefined,
};

// Maximum cache entries (prevent memory issues)
const MAX_CACHE_ENTRIES = 1000;

/**
 * Generate a cache key from tool name, tenant, and arguments
 */
export function generateCacheKey(
  toolName: string,
  tenantId: string,
  args: Record<string, unknown>
): string {
  const argsHash = createHash("md5")
    .update(JSON.stringify(args))
    .digest("hex")
    .substring(0, 12);
  
  return `${tenantId}:${toolName}:${argsHash}`;
}

/**
 * Get cached data if available and not expired
 */
export function getCached<T>(
  toolName: string,
  tenantId: string,
  args: Record<string, unknown>
): T | null {
  const key = generateCacheKey(toolName, tenantId, args);
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (!entry) {
    cacheStats.misses++;
    return null;
  }

  const now = Date.now();
  const expiresAt = entry.cachedAt + entry.ttlSeconds * 1000;

  if (now > expiresAt) {
    // Entry expired, remove it
    cache.delete(key);
    cacheStats.misses++;
    cacheStats.size = cache.size;
    return null;
  }

  cacheStats.hits++;
  return entry.data;
}

/**
 * Store data in cache
 */
export function setCache<T>(
  toolName: string,
  tenantId: string,
  args: Record<string, unknown>,
  data: T,
  ttlSeconds: number
): void {
  // Don't cache if TTL is 0
  if (ttlSeconds <= 0) {
    return;
  }

  const key = generateCacheKey(toolName, tenantId, args);
  const argsHash = createHash("md5")
    .update(JSON.stringify(args))
    .digest("hex")
    .substring(0, 12);

  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_ENTRIES) {
    evictOldest(Math.floor(MAX_CACHE_ENTRIES * 0.1)); // Evict 10%
  }

  const entry: CacheEntry<T> = {
    data,
    cachedAt: Date.now(),
    ttlSeconds,
    tenantId,
    toolName,
    argsHash,
  };

  cache.set(key, entry);
  cacheStats.size = cache.size;

  // Update oldest entry tracking
  if (!cacheStats.oldestEntry || entry.cachedAt < cacheStats.oldestEntry) {
    cacheStats.oldestEntry = entry.cachedAt;
  }
}

/**
 * Evict oldest entries from cache
 */
function evictOldest(count: number): void {
  const entries = Array.from(cache.entries())
    .sort((a, b) => a[1].cachedAt - b[1].cachedAt)
    .slice(0, count);

  for (const [key] of entries) {
    cache.delete(key);
  }

  cacheStats.size = cache.size;
  
  // Update oldest entry
  if (cache.size > 0) {
    const oldest = Array.from(cache.values())
      .sort((a, b) => a.cachedAt - b.cachedAt)[0];
    cacheStats.oldestEntry = oldest?.cachedAt;
  } else {
    cacheStats.oldestEntry = undefined;
  }
}

/**
 * Invalidate cache entries for a specific tenant
 */
export function invalidateTenantCache(tenantId: string): number {
  let invalidated = 0;
  
  for (const [key, entry] of cache.entries()) {
    if (entry.tenantId === tenantId) {
      cache.delete(key);
      invalidated++;
    }
  }

  cacheStats.size = cache.size;
  return invalidated;
}

/**
 * Invalidate cache entries for a specific tool
 */
export function invalidateToolCache(toolName: string, tenantId?: string): number {
  let invalidated = 0;
  
  for (const [key, entry] of cache.entries()) {
    if (entry.toolName === toolName && (!tenantId || entry.tenantId === tenantId)) {
      cache.delete(key);
      invalidated++;
    }
  }

  cacheStats.size = cache.size;
  return invalidated;
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  cache.clear();
  cacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    oldestEntry: undefined,
  };
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats & { hitRate: number } {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? cacheStats.hits / total : 0;
  
  return {
    ...cacheStats,
    hitRate,
  };
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupExpired(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of cache.entries()) {
    const expiresAt = entry.cachedAt + entry.ttlSeconds * 1000;
    if (now > expiresAt) {
      cache.delete(key);
      cleaned++;
    }
  }

  cacheStats.size = cache.size;
  return cleaned;
}

// Run cleanup every 60 seconds
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    cleanupExpired();
  }, 60000);
}
