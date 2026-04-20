"use server";

import { getCurrentUser } from "../user";
import type { ActionResult } from "@/types/actions";

async function checkAdmin(): Promise<ActionResult<boolean>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Unauthorized" };
    if (currentUser.role !== "admin") return { success: false, error: "Admin access required" };
    return { success: true, data: true };
  } catch {
    return { success: false, error: "Failed to verify permissions" };
  }
}

export interface BillingStats {
  totalActiveSubscriptions: number;
  mrr: number; // monthly recurring revenue in cents
  planBreakdown: Record<string, number>; // planType → count
  revenueThisMonth: number; // cents — sum of paid invoices this calendar month
  failedPaymentsCount: number;
}

export async function getAdminBillingStats(): Promise<ActionResult<BillingStats>> {
  const check = await checkAdmin();
  if (!check.success) return { success: false, error: check.error };

  try {
    // Billing has been removed
    return {
      success: true,
      data: {
        totalActiveSubscriptions: 0,
        mrr: 0,
        planBreakdown: {},
        revenueThisMonth: 0,
        failedPaymentsCount: 0,
      },
    };
  } catch (error) {
    console.error("getAdminBillingStats error:", error);
    return { success: false, error: "Failed to load billing stats" };
  }
}

export interface AdminSubscriptionRow {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  planType: string;
  status: string;
  currentPeriodEnd: Date | null;
  createdAt: Date;
}

export interface GetAdminSubscriptionsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  planType?: string;
}

export interface GetAdminSubscriptionsResult {
  subscriptions: AdminSubscriptionRow[];
  total: number;
  pageCount: number;
}

export async function getAdminSubscriptions(
  params: GetAdminSubscriptionsParams = {}
): Promise<ActionResult<GetAdminSubscriptionsResult>> {
  const check = await checkAdmin();
  if (!check.success) return { success: false, error: check.error };

  try {
    // Billing has been removed
    return {
      success: true,
      data: {
        subscriptions: [],
        total: 0,
        pageCount: 0,
      },
    };
  } catch (error) {
    console.error("getAdminSubscriptions error:", error);
    return { success: false, error: "Failed to load subscriptions" };
  }
}
