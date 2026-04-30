/**
 * Simple in-process rate limiter for Next.js API routes.
 *
 * Uses a sliding window algorithm with a Map keyed by identifier (IP address,
 * email, etc.).  Each entry tracks request timestamps within the current window.
 *
 * NOTE: This is an in-memory, single-process implementation.  It works for
 * self-hosted single-instance deployments.  For multi-instance deployments
 * (e.g. Vercel Edge, Kubernetes) replace with a Redis-backed rate limiter.
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitConfig {
  /** Maximum number of requests allowed per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup every 10 minutes to prevent unbounded memory growth
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      // Remove entries where all timestamps are outside the largest possible window (1 hour)
      if (entry.timestamps.every((ts) => now - ts > 3_600_000)) {
        store.delete(key);
      }
    }
  },
  10 * 60 * 1000,
);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix ms timestamp when the window resets
}

/**
 * Check and record a rate limit for the given identifier.
 *
 * @param identifier - Unique key (e.g. IP address, user email)
 * @param config     - Rate limit configuration
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const entry = store.get(identifier) ?? { timestamps: [] };

  // Keep only timestamps within the current window
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  if (entry.timestamps.length >= config.limit) {
    const oldestInWindow = entry.timestamps[0];
    const resetAt = oldestInWindow + config.windowMs;
    store.set(identifier, entry);
    return { allowed: false, remaining: 0, resetAt };
  }

  // Record this request
  entry.timestamps.push(now);
  store.set(identifier, entry);

  return {
    allowed: true,
    remaining: config.limit - entry.timestamps.length,
    resetAt: now + config.windowMs,
  };
}

/**
 * Pre-configured rate limiters for common use cases.
 */
export const rateLimiters = {
  /** Sign-in: 10 attempts per 15 minutes per IP */
  signIn: (identifier: string) =>
    checkRateLimit(identifier, { limit: 10, windowMs: 15 * 60 * 1000 }),

  /** Sign-up: 5 registrations per hour per IP */
  signUp: (identifier: string) =>
    checkRateLimit(identifier, { limit: 5, windowMs: 60 * 60 * 1000 }),
} as const;

/**
 * Extract the best available IP from a Next.js Request.
 * Handles Vercel, Cloudflare, and direct connections.
 */
export function getClientIP(request: Request): string {
  const headers = request instanceof Request ? request.headers : new Headers();
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    "unknown"
  );
}
