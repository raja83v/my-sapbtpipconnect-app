"use server";

import { getCurrentUser as _getCurrentUser } from "@/lib/auth-helpers";
import type { CurrentUser } from "@/lib/auth-helpers";

export type { CurrentUser };

/**
 * Get the current authenticated user.
 *
 * Delegates to the canonical implementation in lib/auth-helpers.ts which:
 *   - Reads from the Supabase session (server-side cookies)
 *   - Lazy-creates users on first login
 *   - Backfills supabaseId for legacy users
 *   - Is cached per request via React.cache()
 *
 * This thin wrapper exists because "use server" files can only export
 * async functions — a bare re-export of the cache()-wrapped helper is
 * rejected by Next.js.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return _getCurrentUser();
}
