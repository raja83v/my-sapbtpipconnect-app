"use server";

import { getCurrentUser } from "../user";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { ActionResult } from "@/types/actions";

// Helper to check if user is admin
async function checkAdmin(): Promise<ActionResult<boolean>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized - Not authenticated" };
    }

    if (currentUser.role !== "admin") {
      return { success: false, error: "Unauthorized - Admin access required" };
    }

    return { success: true, data: true };
  } catch (error) {
    console.error("Error checking admin status:", error);
    return { success: false, error: "Failed to verify permissions" };
  }
}

// Get impersonation status
export async function getImpersonationStatus(): Promise<
  ActionResult<{
    isImpersonating: boolean;
    impersonatedUser?: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
    };
    adminUser?: {
      id: string;
      email: string;
      name: string | null;
    };
  }>
> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return {
        success: true,
        data: { isImpersonating: false },
      };
    }

    // Get the latest session to check impersonatedBy field
    const latestSession = await db.query.sessions.findFirst({
      where: eq(sessions.userId, currentUser.id),
      orderBy: desc(sessions.createdAt),
    });

    if (!latestSession?.impersonatedBy) {
      return {
        success: true,
        data: { isImpersonating: false },
      };
    }

    // Get user details
    const user = await db.query.users.findFirst({
      where: eq(users.id, currentUser.id),
    });

    // Get admin user details
    const adminUser = await db.query.users.findFirst({
      where: eq(users.id, latestSession.impersonatedBy),
    });

    return {
      success: true,
      data: {
        isImpersonating: true,
        impersonatedUser: user ? {
          id: user.id,
          email: user.email,
          name: user.name || null,
          image: user.image || null,
        } : undefined,
        adminUser: adminUser ? {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name || null,
        } : undefined,
      },
    };
  } catch (error) {
    console.error("Error checking impersonation status:", error);
    return { success: false, error: "Failed to check impersonation status" };
  }
}

// Impersonate a user
export async function impersonateUser(userId: string): Promise<ActionResult> {
  const authCheck = await checkAdmin();
  if (!authCheck.success) return { success: false, error: authCheck.error };

  try {
    // Check if target user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    if (targetUser.status !== "ACTIVE") {
      return {
        success: false,
        error: "Cannot impersonate non-active users",
      };
    }

    // Get current session user
    const currentSessionUser = await getCurrentUser();

    if (!currentSessionUser) {
      return { success: false, error: "No active session" };
    }

    // Prevent self-impersonation
    if (currentSessionUser.id === userId) {
      return { success: false, error: "Cannot impersonate yourself" };
    }

    // TODO: Implement JWT-based impersonation
    // This would create a new session for the target user with the admin's ID in impersonatedBy
    return {
      success: false,
      error: "Impersonation feature not yet implemented for custom JWT auth",
    };
  } catch (error: any) {
    console.error("Error impersonating user:", error);
    return {
      success: false,
      error: error.message || "Failed to impersonate user",
    };
  }
}

// Stop impersonating
export async function stopImpersonating(): Promise<ActionResult> {
  try {
    // Check if currently impersonating
    const status = await getImpersonationStatus();
    if (!status.success || !status.data?.isImpersonating) {
      return { success: false, error: "Not currently impersonating" };
    }

    // TODO: Implement stop impersonation
    return {
      success: false,
      error: "Stop impersonation feature not yet implemented for custom JWT auth",
    };
  } catch (error: any) {
    console.error("Error stopping impersonation:", error);
    return {
      success: false,
      error: error.message || "Failed to stop impersonation",
    };
  }
}
