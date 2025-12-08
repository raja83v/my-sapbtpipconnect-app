"use server";

import { getCurrentUser } from "./user";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
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

    // Get user's accessible tenants
    const userTenants = await convex.query(api.tenants.listForUser, { 
      userId: currentUser.id as any 
    });

    const accessibleTenantIds = userTenants.map((t: any) => t._id);

    if (accessibleTenantIds.length === 0) {
      return {
        success: true,
        data: {
          stats: {
            totalTenants: 0,
            activeTenants: 0,
            totalIFlows: 0,
            activeIFlows: 0,
            stoppedIFlows: 0,
            errorIFlows: 0,
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            successRate: 0,
            totalAIExecutions: 0,
            totalTokensUsed: 0,
          },
          tenants: [],
          recentExecutions: [],
          iFlowStatuses: [],
          aiAgentUsage: [],
          recentActivity: [],
          executionTrend: [],
        },
      };
    }

    // Get AI agent usage
    const aiStats = await convex.query(api.aiAgents.getUsageStats, { 
      userId: currentUser.id as any 
    }) || { totalExecutions: 0, totalTokensUsed: 0, byAgentType: {} };

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
    
    // Aggregate execution trend data by date
    const executionTrendMap = new Map<string, { success: number; failed: number }>();

    for (const tenant of userTenants) {
      const tenantDetail = tenant as any;
      
      // Get iFlow count and stats
      const iflowStats = await convex.query(api.iflows.getStatsByTenant, { 
        tenantId: tenantDetail._id 
      });
      
      // Get execution stats
      const execStats = await convex.query(api.iflows.getExecutionStatsByTenant, { 
        tenantId: tenantDetail._id,
        daysBack: 30,
      });
      
      // Get iFlows for status summary - prioritize STARTED (active) iFlows
      const iflows = await convex.query(api.iflows.listByTenant, { 
        tenantId: tenantDetail._id,
        limit: 20,
      });

      // Sort to prioritize STARTED iFlows first
      const sortedIFlows = [...iflows].sort((a, b) => {
        if (a.status === "STARTED" && b.status !== "STARTED") return -1;
        if (a.status !== "STARTED" && b.status === "STARTED") return 1;
        return 0;
      });

      tenantData.push({
        id: tenantDetail._id,
        name: tenantDetail.name,
        slug: tenantDetail.slug,
        status: tenantDetail.status,
        isConnected: tenantDetail.isConnected,
        iFlowCount: iflowStats.total,
        lastSyncAt: tenantDetail.lastSyncAt ? new Date(tenantDetail.lastSyncAt) : null,
      });

      totalIFlows += iflowStats.total;
      activeIFlows += iflowStats.started;
      stoppedIFlows += iflowStats.stopped;
      errorIFlows += iflowStats.error;

      totalExecutions += execStats.total;
      successfulExecutions += execStats.completed;
      failedExecutions += execStats.failed;

      // Aggregate execution trend data from this tenant
      if (execStats.byDate) {
        for (const [date, data] of Object.entries(execStats.byDate)) {
          const existing = executionTrendMap.get(date) || { success: 0, failed: 0 };
          const dateData = data as { completed: number; failed: number };
          executionTrendMap.set(date, {
            success: existing.success + (dateData.completed || 0),
            failed: existing.failed + (dateData.failed || 0),
          });
        }
      }

      // Add iFlow statuses - include up to 10 from each tenant, prioritizing active ones
      for (const iflow of sortedIFlows.slice(0, 10)) {
        allIFlowStatuses.push({
          name: iflow.name,
          status: iflow.status,
          tenantName: tenantDetail.name,
          lastExecutedAt: iflow.lastExecutedAt ? new Date(iflow.lastExecutedAt) : null,
          executionCount: 0,
          successCount: 0,
          failedCount: 0,
        });
      }
    }

    // Sort all iFlow statuses to prioritize STARTED ones globally
    allIFlowStatuses.sort((a, b) => {
      if (a.status === "STARTED" && b.status !== "STARTED") return -1;
      if (a.status !== "STARTED" && b.status === "STARTED") return 1;
      return 0;
    });

    // Get recent executions
    const recentExecs = await convex.query(api.iflows.getRecentExecutionsForTenants, {
      tenantIds: accessibleTenantIds as any[],
      limit: 10,
    });

    // Get tenant names map
    const tenantMap = new Map(userTenants.map((t: any) => [t._id, t.name]));

    const recentExecutions: RecentExecution[] = recentExecs.map((e: any) => ({
      id: e._id,
      messageId: e.messageId,
      status: e.status,
      startTime: new Date(e.startTime),
      duration: e.duration ?? null,
      iFlowName: e.iFlowName || "Unknown",
      iFlowId: e.iFlowId,
      tenantName: tenantMap.get(e.tenantId) || "Unknown",
      errorCategory: e.errorCategory ?? null,
    }));

    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

    // Format AI agent usage - byAgentType returns { count, tokens } for getUsageStats
    const aiAgentUsage: AIAgentUsage[] = Object.entries(aiStats.byAgentType || {}).map(([agentType, count]: [string, any]) => ({
      agentType,
      count: typeof count === 'number' ? count : (count?.count || 0),
      tokensUsed: typeof count === 'number' ? 0 : (count?.tokensUsed || count?.tokens || 0),
    }));

    // Build execution trend from aggregated stats
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
          totalAIExecutions: aiStats.totalExecutions || 0,
          totalTokensUsed: aiStats.totalTokensUsed || 0,
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
