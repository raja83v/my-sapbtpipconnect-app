import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Re-export the api for convenience
export { api };

/**
 * Server-side Convex client for use in Server Actions and API routes
 * Use this for server-side data fetching and mutations
 */
export const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Helper to get the Convex client
 * Can be extended to add authentication headers if needed
 */
export function getConvexClient() {
  return convex;
}
