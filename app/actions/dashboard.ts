"use server";

import { getCurrentUser } from "./user";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/types/actions";
import { cache } from "react";

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

export const getDashboardData = cache(async (): Promise<ActionResult<DashboardData>> => {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    // Get user's accessible tenants via memberships
    const memberships = await prisma.tenantMember.findMany({
      where: { userId: currentUser.id },
      include: { tenant: true },
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

    const accessibleTenantIds = memberships.map((m) => m.tenantId);

    // Get AI agent usage stats
    const aiStatsRaw = await prisma.aIAgentExecution.groupBy({
      by: ["agentType"],
      where: { userId: currentUser.id },
      _count: { agentType: true },
      _sum: { tokensUsed: true },
    });
    const totalAIExecutions = await prisma.aIAgentExecution.count({
      where: { userId: currentUser.id },
    });
    const totalTokensUsed = await prisma.aIAgentExecution.aggregate({
      where: { userId: currentUser.id },
      _sum: { tokensUsed: true },
    });

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

    for (const membership of memberships) {
      const tenant = membership.tenant;

      // Get iFlow status counts
      const statusCounts = await prisma.iFlow.groupBy({
        by: ["status"],
        where: { tenantId: tenant.id },
        _count: { status: true },
      });

      const iflowTotal = statusCounts.reduce((sum, s) => sum + s._count.status, 0);
      const started = statusCounts.find((s) => s.status === "STARTED")?._count.status ?? 0;
      const stopped = statusCounts.find((s) => s.status === "STOPPED")?._count.status ?? 0;
      const error = statusCounts.find((s) => s.status === "ERROR")?._count.status ?? 0;

      // Get execution stats for last 30 days
      const tenantIFlowIds = await prisma.iFlow.findMany({
        where: { tenantId: tenant.id },
        select: { id: true },
      });
      const iFlowIds = tenantIFlowIds.map((i) => i.id);

      const execCounts = iFlowIds.length > 0
        ? await prisma.iFlowExecution.groupBy({
            by: ["status"],
            where: { iFlowId: { in: iFlowIds }, startTime: { gte: thirtyDaysAgo } },
            _count: { status: true },
          })
        : [];

      const tenantTotalExecs = execCounts.reduce((sum, s) => sum + s._count.status, 0);
      const tenantCompleted = execCounts.find((s) => s.status === "COMPLETED")?._count.status ?? 0;
      const tenantFailed = execCounts.find((s) => s.status === "FAILED")?._count.status ?? 0;

      // Get iFlows for status summary - prioritize STARTED
      const iflows = await prisma.iFlow.findMany({
        where: { tenantId: tenant.id },
        take: 20,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
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
    const allIFlowIds = await prisma.iFlow.findMany({
      where: { tenantId: { in: accessibleTenantIds } },
      select: { id: true, name: true, tenantId: true },
    });
    const iFlowMap = new Map(allIFlowIds.map((i) => [i.id, i]));
    const tenantMap = new Map(memberships.map((m) => [m.tenantId, m.tenant.name]));

    const recentExecs = allIFlowIds.length > 0
      ? await prisma.iFlowExecution.findMany({
          where: { iFlowId: { in: allIFlowIds.map((i) => i.id) } },
          take: 10,
          orderBy: { startTime: "desc" },
        })
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
      count: s._count.agentType,
      tokensUsed: s._sum.tokensUsed ?? 0,
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

    return {
      success: true,
      data: {
        stats: {
          totalTenants: tenantData.length,
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
          totalTokensUsed: totalTokensUsed._sum.tokensUsed ?? 0,
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
});
