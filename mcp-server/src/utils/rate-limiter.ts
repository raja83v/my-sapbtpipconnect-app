/**
 * SAP CPI MCP Server - Rate Limiter
 * 
 * Implements per-user, per-tool rate limiting to prevent abuse.
 */

import { RateLimitState, RateLimitResult } from "../types";

// In-memory rate limit store
const rateLimitStore = new Map<string, RateLimitState>();

/**
 * Generate a rate limit key
 */
function getRateLimitKey(userId: string, toolName: string): string {
  return `${userId}:${toolName}`;
}

/**
 * Check if a request is allowed under rate limits
 */
export function checkRateLimit(
  userId: string,
  toolName: string,
  maxCalls: number,
  windowSeconds: number
): RateLimitResult {
  const key = getRateLimitKey(userId, toolName);
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  let state = rateLimitStore.get(key);

  // Initialize or reset if window has passed
  if (!state || now - state.windowStart > windowMs) {
    state = {
      userId,
      toolName,
      windowStart: now,
      callCount: 0,
    };
    rateLimitStore.set(key, state);
  }

  // Check if within limits
  if (state.callCount >= maxCalls) {
    const resetIn = Math.ceil((state.windowStart + windowMs - now) / 1000);
    return {
      allowed: false,
      remainingCalls: 0,
      resetInSeconds: Math.max(0, resetIn),
    };
  }

  // Increment and allow
  state.callCount++;
  rateLimitStore.set(key, state);

  const resetIn = Math.ceil((state.windowStart + windowMs - now) / 1000);
  return {
    allowed: true,
    remainingCalls: maxCalls - state.callCount,
    resetInSeconds: Math.max(0, resetIn),
  };
}

/**
 * Reset rate limit for a user/tool
 */
export function resetRateLimit(userId: string, toolName?: string): void {
  if (toolName) {
    rateLimitStore.delete(getRateLimitKey(userId, toolName));
  } else {
    // Reset all limits for user
    for (const key of rateLimitStore.keys()) {
      if (key.startsWith(`${userId}:`)) {
        rateLimitStore.delete(key);
      }
    }
  }
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(
  userId: string,
  toolName: string,
  maxCalls: number,
  windowSeconds: number
): RateLimitResult {
  const key = getRateLimitKey(userId, toolName);
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const state = rateLimitStore.get(key);

  if (!state || now - state.windowStart > windowMs) {
    return {
      allowed: true,
      remainingCalls: maxCalls,
      resetInSeconds: windowSeconds,
    };
  }

  const resetIn = Math.ceil((state.windowStart + windowMs - now) / 1000);
  return {
    allowed: state.callCount < maxCalls,
    remainingCalls: Math.max(0, maxCalls - state.callCount),
    resetInSeconds: Math.max(0, resetIn),
  };
}

/**
 * Clean up expired rate limit entries
 */
export function cleanupRateLimits(maxAgeSeconds: number = 3600): number {
  const now = Date.now();
  const maxAgeMs = maxAgeSeconds * 1000;
  let cleaned = 0;

  for (const [key, state] of rateLimitStore.entries()) {
    if (now - state.windowStart > maxAgeMs) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Cleanup old entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    cleanupRateLimits();
  }, 300000);
}
