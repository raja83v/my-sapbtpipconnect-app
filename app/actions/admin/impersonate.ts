"use server";

import { getCurrentUser } from "../user";
import { convex, api } from "@/lib/convex";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import { Id } from "@/convex/_generated/dataModel";

// Helper to check if user is admin
async function checkAdmin(): Promise<ActionResult<boolean>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized - Not authenticated" };
    }

    const user = await convex.query(api.users.getById, { 
      id: currentUser.id as Id<"users">
    });

    if (user?.role !== "admin") {
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

    // Get the session from database to check impersonatedBy field
    const sessions = await convex.query(api.users.getActiveSessions, { 
      userId: currentUser.id as Id<"users">
    });

    const latestSession = sessions[0];

    if (!latestSession?.impersonatedBy) {
      return {
        success: true,
        data: { isImpersonating: false },
      };
    }

    // Get user details
    const user = await convex.query(api.users.getById, { 
      id: currentUser.id as Id<"users">
    });

    // Get admin user details
    const adminUser = await convex.query(api.users.getById, { 
      id: latestSession.impersonatedBy as Id<"users">
    });

    return {
      success: true,
      data: {
        isImpersonating: true,
        impersonatedUser: user ? {
          id: user._id,
          email: user.email,
          name: user.name || null,
          image: user.image || null,
        } : undefined,
        adminUser: adminUser ? {
          id: adminUser._id,
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
    const targetUser = await convex.query(api.users.getById, { 
      id: userId as Id<"users">
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

    // Note: Impersonation requires auth provider integration
    // This is a placeholder - actual implementation depends on Clerk impersonation feature
    return { 
      success: false, 
      error: "Impersonation requires Clerk integration - feature not yet implemented" 
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

    // Note: Requires auth provider integration
    return { 
      success: false, 
      error: "Stop impersonation requires Clerk integration - feature not yet implemented" 
    };
  } catch (error: any) {
    console.error("Error stopping impersonation:", error);
    return {
      success: false,
      error: error.message || "Failed to stop impersonation",
    };
  }
}
