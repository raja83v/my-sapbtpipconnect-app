import { auth, currentUser } from "@clerk/nextjs/server";
import { convex, api } from "@/lib/convex";
import { cache } from "react";
import { Id } from "@/convex/_generated/dataModel";

export type CurrentUser = {
  id: Id<"users">;
  email: string;
  name: string | undefined;
  role: "user" | "admin";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  image: string | undefined;
  onboardingCompleted: boolean;
  defaultTenantId: Id<"cpiTenants"> | undefined;
};

/**
 * Get the current authenticated user from Clerk and fetch associated user data from database
 * This is cached per request to avoid multiple database calls
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const { userId } = await auth();
  
  if (!userId) {
    return null;
  }

  // Fetch user from database by clerkId
  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });

  if (!user) {
    return null;
  }

  return {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    image: user.image,
    onboardingCompleted: user.onboardingCompleted ?? false,
    defaultTenantId: user.defaultTenantId,
  };
});

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

/**
 * Get the Clerk user ID from the current session
 */
export async function getClerkUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * Get both Clerk user and database user
 */
export async function getFullUser() {
  const clerkUser = await currentUser();
  const dbUser = await getCurrentUser();
  
  return {
    clerkUser,
    dbUser,
  };
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Require admin role - throws if not admin
 */
export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}
