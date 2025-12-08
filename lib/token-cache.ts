/**
 * Simple in-memory cache for OAuth tokens with expiration
 */

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

/**
 * Cache an OAuth token with expiration
 * @param key - Cache key (e.g., tenantId)
 * @param token - OAuth token
 * @param expiresIn - Expiration time in seconds (default: 50 minutes, tokens typically last 1 hour)
 */
export function cacheToken(key: string, token: string, expiresIn: number = 3000) {
  const expiresAt = Date.now() + (expiresIn * 1000);
  tokenCache.set(key, { token, expiresAt });
}

/**
 * Get a cached OAuth token if still valid
 * @param key - Cache key (e.g., tenantId)
 * @returns Cached token or null if expired/not found
 */
export function getCachedToken(key: string): string | null {
  const cached = tokenCache.get(key);
  
  if (!cached) {
    return null;
  }
  
  // Check if token is expired (with 5 minute buffer)
  if (Date.now() >= cached.expiresAt - (5 * 60 * 1000)) {
    tokenCache.delete(key);
    return null;
  }
  
  return cached.token;
}

/**
 * Clear a specific token from cache
 * @param key - Cache key (e.g., tenantId)
 */
export function clearCachedToken(key: string) {
  tokenCache.delete(key);
}

/**
 * Clear all cached tokens
 */
export function clearAllCachedTokens() {
  tokenCache.clear();
}
