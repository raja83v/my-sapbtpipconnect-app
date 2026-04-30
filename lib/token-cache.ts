/**
 * Simple in-memory cache for OAuth tokens with expiration, size limit, and
 * periodic cleanup to prevent unbounded memory growth.
 */

interface CachedToken {
  token: string;
  expiresAt: number;
}

/** Maximum number of tokens to keep in cache (one per tenant, typically) */
const MAX_CACHE_SIZE = 500;

/** Buffer before actual expiry to proactively refresh tokens (5 minutes) */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

const tokenCache = new Map<string, CachedToken>();

/**
 * Evict the oldest expired entries, or — if the cache is still at capacity —
 * evict the soonest-to-expire entries to stay within MAX_CACHE_SIZE.
 */
function evictIfNeeded(): void {
  const now = Date.now();

  // First pass: remove already-expired entries
  for (const [key, entry] of tokenCache.entries()) {
    if (now >= entry.expiresAt) {
      tokenCache.delete(key);
    }
  }

  // Second pass: if still over capacity, evict soonest-to-expire entries
  if (tokenCache.size >= MAX_CACHE_SIZE) {
    const sorted = [...tokenCache.entries()].sort(
      ([, a], [, b]) => a.expiresAt - b.expiresAt,
    );
    const toRemove = sorted.slice(0, tokenCache.size - MAX_CACHE_SIZE + 1);
    for (const [key] of toRemove) {
      tokenCache.delete(key);
    }
  }
}

// Periodic cleanup every 10 minutes
setInterval(() => evictIfNeeded(), 10 * 60 * 1000);

/**
 * Cache an OAuth token with expiration.
 * @param key       - Cache key (e.g., tenantId)
 * @param token     - OAuth token
 * @param expiresIn - Expiration time in seconds (default: 50 minutes)
 */
export function cacheToken(
  key: string,
  token: string,
  expiresIn: number = 3000,
): void {
  evictIfNeeded();
  const expiresAt = Date.now() + expiresIn * 1000;
  tokenCache.set(key, { token, expiresAt });
}

/**
 * Get a cached OAuth token if still valid (with 5-minute buffer).
 * @param key - Cache key (e.g., tenantId)
 * @returns Cached token or null if expired/not found
 */
export function getCachedToken(key: string): string | null {
  const cached = tokenCache.get(key);

  if (!cached) {
    return null;
  }

  // Check if token is expired (with buffer)
  if (Date.now() >= cached.expiresAt - EXPIRY_BUFFER_MS) {
    tokenCache.delete(key);
    return null;
  }

  return cached.token;
}

/**
 * Clear a specific token from cache.
 * @param key - Cache key (e.g., tenantId)
 */
export function clearCachedToken(key: string): void {
  tokenCache.delete(key);
}

/**
 * Clear all cached tokens.
 */
export function clearAllCachedTokens(): void {
  tokenCache.clear();
}
