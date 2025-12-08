"use server";

import { getCurrentUser } from "../user";
import { convex, api } from "@/lib/convex";
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
      userId: currentUser.id as Id<"users"> 
    });

    if (user?.role !== "admin") {
      return {
        success: false,
        error: "Unauthorized - Admin access required",
      };
    }

    return { success: true, data: true };
  } catch (error) {
    console.error("Error checking admin status:", error);
    return { success: false, error: "Failed to verify permissions" };
  }
}

export interface DashboardStats {
  users: {
    total: number;
    new: number; // Last 30 days
    active: number; // Last 30 days with login
    trend: number; // Percentage change vs previous period
  };
}

export interface RecentUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  status: string;
  createdAt: Date;
}

export interface ActivityItem {
  id: string;
  type: "user_registered" | "tenant_created" | "user_status_changed";
  description: string;
  timestamp: Date;
  metadata?: any;
}

// Get dashboard statistics
export async function getDashboardStats(): Promise<
  ActionResult<DashboardStats>
> {
  const authCheck = await checkAdmin();
  if (!authCheck.success) return { success: false, error: authCheck.error };

  try {
    const stats = await convex.query(api.users.getAdminStats, {});

    return { success: true, data: stats };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return { success: false, error: "Failed to fetch dashboard statistics" };
  }
}

// Get recent users (last 5)
export async function getRecentUsers(): Promise<ActionResult<RecentUser[]>> {
  const authCheck = await checkAdmin();
  if (!authCheck.success) return { success: false, error: authCheck.error };

  try {
    const users = await convex.query(api.users.listRecent, { limit: 5 });

    return { 
      success: true, 
      data: users.map(u => ({
        id: u._id,
        email: u.email,
        name: u.name || null,
        image: u.image || null,
        role: u.role,
        status: u.status,
        createdAt: new Date(u._creationTime),
      }))
    };
  } catch (error) {
    console.error("Error fetching recent users:", error);
    return { success: false, error: "Failed to fetch recent users" };
  }
}

// Get recent activity feed
export async function getRecentActivity(): Promise<
  ActionResult<ActivityItem[]>
> {
  const authCheck = await checkAdmin();
  if (!authCheck.success) return { success: false, error: authCheck.error };

  try {
    // Get recent users
    const recentUsers = await convex.query(api.users.listRecent, { limit: 3 });

    // Get recent tenants
    const recentTenants = await convex.query(api.tenants.listRecent, { limit: 3 });

    // Combine and format activities
    const activities: ActivityItem[] = [
      ...recentUsers.map((user) => ({
        id: `user-${user._id}`,
        type: "user_registered" as const,
        description: `User "${user.name || user.email}" registered`,
        timestamp: new Date(user._creationTime),
      })),
      ...recentTenants.map((tenant) => ({
        id: `tenant-${tenant._id}`,
        type: "tenant_created" as const,
        description: `Tenant "${tenant.name}" created`,
        timestamp: new Date(tenant._creationTime),
      })),
    ];

    // Sort by timestamp and take 5
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return { success: true, data: activities.slice(0, 5) };
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return { success: false, error: "Failed to fetch recent activity" };
  }
}
