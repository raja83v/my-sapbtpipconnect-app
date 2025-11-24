import { Prisma } from "@/generated/prisma/client";

/**
 * User type returned from getCurrentUser() action
 * Matches the select fields from the user query
 */
export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  phone: string | null;
  role: "user" | "admin";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  emailVerified: boolean;
  onboardingCompleted: boolean;
  createdAt: Date;
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
export function toSidebarUser(user: CurrentUser): SidebarUser {
  if (!user) return null;

  return {
    name: user.name || "Unknown User",
    email: user.email,
    image: user.image,
    role: user.role,
  };
}
