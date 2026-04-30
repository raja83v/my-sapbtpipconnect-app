"use server";

import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import { tenantMembers, aiAgentExecutions, iFlows, iFlowExecutions } from "@/lib/db/schema";
import { eq, and, count, sum, avg, desc, inArray, gte } from "drizzle-orm";
import type { ActionResult } from "@/types/actions";

export interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  totalIFlows: number;
  activeIFlows: number;
  stoppedIFlows: number;
  errorIFlows: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  totalAIExecutions: number;
  totalTokensUsed: number;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  isConnected: boolean;
  iFlowCount: number;
  lastSyncAt: Date | null;
}

export interface RecentExecution {
  id: string;
  messageId: string;
  status: string;
  startTime: Date;
  duration: number | null;
  iFlowName: string;
  iFlowId: string;
  tenantName: string;
  errorCategory: string | null;
}

export interface IFlowStatusSummary {
  name: string;
  status: string;
  tenantName: string;
  lastExecutedAt: Date | null;
  executionCount: number;
  successCount: number;
  failedCount: number;
}

export interface AIAgentUsage {
  agentType: string;
  count: number;
  tokensUsed: number;
}

export interface ActivityItem {
  id: string;
  type: "execution" | "ai_agent" | "tenant" | "iflow";
  title: string;
  description: string;
  timestamp: Date;
  status: string;
  metadata?: Record<string, any>;
}

export interface DashboardData {
  stats: DashboardStats;
  tenants: TenantSummary[];
  recentExecutions: RecentExecution[];
  iFlowStatuses: IFlowStatusSummary[];
  aiAgentUsage: AIAgentUsage[];
  recentActivity: ActivityItem[];
  executionTrend: { date: string; success: number; failed: number }[];
}

export async function getDashboardData(): Promise<ActionResult<DashboardData>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    // Get user's accessible tenants via memberships
    const memberships = await db.query.tenantMembers.findMany({
      where: eq(tenantMembers.userId, currentUser.id),
      with: { tenant: true },
    });

    if (memberships.length === 0) {
      return {
        success: true,
        data: {
          stats: {
            totalTenants: 0, activeTenants: 0, totalIFlows: 0,
            activeIFlows: 0, stoppedIFlows: 0, errorIFlows: 0,
            totalExecutions: 0, successfulExecutions: 0, failedExecutions: 0,
            successRate: 0, totalAIExecutions: 0, totalTokensUsed: 0,
          },
          tenants: [], recentExecutions: [], iFlowStatuses: [],
          aiAgentUsage: [], recentActivity: [], executionTrend: [],
        },
      };
    }

    const allAccessibleTenantIds = memberships.map((m) => m.tenantId);

    // Filter to selected tenant if user has a default tenant set
    const accessibleTenantIds = currentUser.defaultTenantId &&
      allAccessibleTenantIds.includes(currentUser.defaultTenantId)
      ? [currentUser.defaultTenantId]
      : allAccessibleTenantIds;

    const filteredMemberships = memberships.filter((m) =>
      accessibleTenantIds.includes(m.tenantId)
    );

    // Get AI agent usage stats
    const aiStatsRaw = await db.select({
      agentType: aiAgentExecutions.agentType,
      countAgentType: count(),
      sumTokensUsed: sum(aiAgentExecutions.tokensUsed),
    }).from(aiAgentExecutions)
      .where(eq(aiAgentExecutions.userId, currentUser.id))
      .groupBy(aiAgentExecutions.agentType);

    const [{ c: totalAIExecutions }] = await db.select({ c: count() })
      .from(aiAgentExecutions)
      .where(eq(aiAgentExecutions.userId, currentUser.id));

    const [{ total: totalTokensUsedVal }] = await db.select({ total: sum(aiAgentExecutions.tokensUsed) })
      .from(aiAgentExecutions)
      .where(eq(aiAgentExecutions.userId, currentUser.id));

    // Process each tenant
    const tenantData: TenantSummary[] = [];
    let totalIFlows = 0;
    let activeIFlows = 0;
    let stoppedIFlows = 0;
    let errorIFlows = 0;
    const allIFlowStatuses: IFlowStatusSummary[] = [];
    let totalExecutions = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;

    const executionTrendMap = new Map<string, { success: number; failed: number }>();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const membership of filteredMemberships) {
      const tenant = membership.tenant;

      // Get iFlow status counts
      const statusCounts = await db.select({
        status: iFlows.status,
        statusCount: count(),
      }).from(iFlows)
        .where(eq(iFlows.tenantId, tenant.id))
        .groupBy(iFlows.status);

      const iflowTotal = statusCounts.reduce((s, r) => s + r.statusCount, 0);
      const started = statusCounts.find((s) => s.status === "STARTED")?.statusCount ?? 0;
      const stopped = statusCounts.find((s) => s.status === "STOPPED")?.statusCount ?? 0;
      const error = statusCounts.find((s) => s.status === "ERROR")?.statusCount ?? 0;

      // Get execution stats for last 30 days
      const tenantIFlowIds = await db.select({ id: iFlows.id })
        .from(iFlows)
        .where(eq(iFlows.tenantId, tenant.id));
      const iFlowIds = tenantIFlowIds.map((i) => i.id);

      const execCounts = iFlowIds.length > 0
        ? await db.select({
            status: iFlowExecutions.status,
            statusCount: count(),
          }).from(iFlowExecutions)
            .where(and(
              inArray(iFlowExecutions.iFlowId, iFlowIds),
              gte(iFlowExecutions.startTime, thirtyDaysAgo),
            ))
            .groupBy(iFlowExecutions.status)
        : [];

      const tenantTotalExecs = execCounts.reduce((s, r) => s + r.statusCount, 0);
      const tenantCompleted = execCounts.find((s) => s.status === "COMPLETED")?.statusCount ?? 0;
      const tenantFailed = execCounts.find((s) => s.status === "FAILED")?.statusCount ?? 0;

      // Get iFlows for status summary - prioritize STARTED
      const iflows = await db.query.iFlows.findMany({
        where: eq(iFlows.tenantId, tenant.id),
        limit: 20,
      });

      const sortedIFlows = [...iflows].sort((a, b) => {
        if (a.status === "STARTED" && b.status !== "STARTED") return -1;
        if (a.status !== "STARTED" && b.status === "STARTED") return 1;
        return 0;
      });

      tenantData.push({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        isConnected: tenant.isConnected,
        iFlowCount: iflowTotal,
        lastSyncAt: tenant.lastSyncAt,
      });

      totalIFlows += iflowTotal;
      activeIFlows += started;
      stoppedIFlows += stopped;
      errorIFlows += error;
      totalExecutions += tenantTotalExecs;
      successfulExecutions += tenantCompleted;
      failedExecutions += tenantFailed;

      for (const iflow of sortedIFlows.slice(0, 10)) {
        allIFlowStatuses.push({
          name: iflow.name,
          status: iflow.status,
          tenantName: tenant.name,
          lastExecutedAt: iflow.lastExecutedAt,
          executionCount: 0,
          successCount: 0,
          failedCount: 0,
        });
      }
    }

    allIFlowStatuses.sort((a, b) => {
      if (a.status === "STARTED" && b.status !== "STARTED") return -1;
      if (a.status !== "STARTED" && b.status === "STARTED") return 1;
      return 0;
    });

    // Get recent executions across all accessible tenants
    const allIFlowIds = await db.select({ id: iFlows.id, name: iFlows.name, tenantId: iFlows.tenantId })
      .from(iFlows)
      .where(inArray(iFlows.tenantId, accessibleTenantIds));
    const iFlowMap = new Map(allIFlowIds.map((i) => [i.id, i]));
    const tenantMap = new Map(filteredMemberships.map((m) => [m.tenantId, m.tenant.name]));

    const recentExecs = allIFlowIds.length > 0
      ? await db.select().from(iFlowExecutions)
          .where(inArray(iFlowExecutions.iFlowId, allIFlowIds.map((i) => i.id)))
          .orderBy(desc(iFlowExecutions.startTime))
          .limit(10)
      : [];

    const recentExecutions: RecentExecution[] = recentExecs.map((e) => {
      const iflow = iFlowMap.get(e.iFlowId);
      return {
        id: e.id,
        messageId: e.messageId,
        status: e.status,
        startTime: e.startTime,
        duration: e.duration ?? null,
        iFlowName: iflow?.name || "Unknown",
        iFlowId: e.iFlowId,
        tenantName: iflow ? (tenantMap.get(iflow.tenantId) || "Unknown") : "Unknown",
        errorCategory: e.errorCategory ?? null,
      };
    });

    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

    // Format AI agent usage
    const aiAgentUsage: AIAgentUsage[] = aiStatsRaw.map((s) => ({
      agentType: s.agentType,
      count: s.countAgentType,
      tokensUsed: Number(s.sumTokensUsed) ?? 0,
    }));

    // Build execution trend (last 7 days)
    const executionTrend: { date: string; success: number; failed: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      const trendData = executionTrendMap.get(dateStr) || { success: 0, failed: 0 };
      executionTrend.push({ date: dateStr, success: trendData.success, failed: trendData.failed });
    }

    // Build recent activity
    const recentActivity: ActivityItem[] = recentExecutions.slice(0, 5).map((e) => ({
      id: e.id,
      type: "execution" as const,
      title: e.iFlowName,
      description: `Message ${e.messageId.substring(0, 8)}... ${e.status.toLowerCase()}`,
      timestamp: e.startTime,
      status: e.status,
      metadata: { duration: e.duration, tenantName: e.tenantName },
    }));

    // Fetch subscription info for cloud mode

    return {
      success: true,
      data: {
        stats: {
          totalTenants: allAccessibleTenantIds.length,
          activeTenants: tenantData.filter((t) => t.isConnected).length,
          totalIFlows,
          activeIFlows,
          stoppedIFlows,
          errorIFlows,
          totalExecutions,
          successfulExecutions,
          failedExecutions,
          successRate,
          totalAIExecutions,
          totalTokensUsed: Number(totalTokensUsedVal) ?? 0,
        },
        tenants: tenantData,
        recentExecutions,
        iFlowStatuses: allIFlowStatuses.slice(0, 10),
        aiAgentUsage,
        recentActivity,
        executionTrend,
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return { success: false, error: "Failed to fetch dashboard data" };
  }
}
