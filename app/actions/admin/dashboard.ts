"use server";

import { getCurrentUser } from "../user";
import { db } from "@/lib/db";
import { users, cpiTenants } from "@/lib/db/schema";
import { count, eq, gte, lt, and, desc } from "drizzle-orm";
import type { ActionResult } from "@/types/actions";

// Helper to check if user is admin
async function checkAdmin(): Promise<ActionResult<boolean>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized - Not authenticated" };
    }

    if (currentUser.role !== "admin") {
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
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [totalResult, newUsersResult, activeUsersResult, previousPeriodNewResult] = await Promise.all([
      db.select({ c: count() }).from(users),
      db.select({ c: count() }).from(users).where(gte(users.createdAt, thirtyDaysAgo)),
      db.select({ c: count() }).from(users).where(gte(users.lastLoginAt, thirtyDaysAgo)),
      db.select({ c: count() }).from(users).where(
        and(
          gte(users.createdAt, sixtyDaysAgo),
          lt(users.createdAt, thirtyDaysAgo)
        )
      ),
    ]);

    const total = totalResult[0].c;
    const newUsers = newUsersResult[0].c;
    const activeUsers = activeUsersResult[0].c;
    const previousPeriodNew = previousPeriodNewResult[0].c;

    const trend = previousPeriodNew > 0
      ? Math.round(((newUsers - previousPeriodNew) / previousPeriodNew) * 100)
      : newUsers > 0 ? 100 : 0;

    return {
      success: true,
      data: {
        users: {
          total,
          new: newUsers,
          active: activeUsers,
          trend,
        },
      },
    };
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
    const recentUsersData = await db.query.users.findMany({
      limit: 5,
      orderBy: desc(users.createdAt),
    });

    return {
      success: true,
      data: recentUsersData.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name || null,
        image: u.image || null,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
      })),
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
    const recentUsers = await db.query.users.findMany({
      limit: 3,
      orderBy: desc(users.createdAt),
    });

    // Get recent tenants
    const recentTenants = await db.query.cpiTenants.findMany({
      limit: 3,
      orderBy: desc(cpiTenants.createdAt),
    });

    // Combine and format activities
    const activities: ActivityItem[] = [
      ...recentUsers.map((user) => ({
        id: `user-${user.id}`,
        type: "user_registered" as const,
        description: `User "${user.name || user.email}" registered`,
        timestamp: user.createdAt,
      })),
      ...recentTenants.map((tenant) => ({
        id: `tenant-${tenant.id}`,
        type: "tenant_created" as const,
        description: `Tenant "${tenant.name}" created`,
        timestamp: tenant.createdAt,
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
