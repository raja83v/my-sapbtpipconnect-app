/**
 * User type returned from getCurrentUser() action.
 * The canonical implementation is in lib/auth-helpers.ts.
 * Re-exported here for backward compatibility.
 */
export type { CurrentUser } from "@/lib/auth-helpers";

/**
 * Minimal user shape needed by sidebar components (accepts either CurrentUser variant).
 */
type AnyUser = {
  name?: string | null;
  email: string;
  image?: string | null;
  role?: "user" | "admin";
} | null;

/**
 * Simplified user type for sidebar components
 */
export type SidebarUser = {
  name: string;
  email: string;
  image?: string | null;
  role?: "user" | "admin";
} | null;

/**
 * Helper to convert CurrentUser to SidebarUser
 */
export function toSidebarUser(user: AnyUser): SidebarUser {
  if (!user) return null;

  return {
    name: user.name || "Unknown User",
    email: user.email,
    image: user.image,
    role: user.role,
  };
}
