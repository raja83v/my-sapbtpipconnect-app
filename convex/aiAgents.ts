import { query } from "./_generated/server";
import { v } from "convex/values";
import { aiAgentTypeValidator } from "./schema";

/**
 * Get AI agent execution by ID with user verification
 */
export const getById = query({
  args: {
    executionId: v.id("aiAgentExecutions"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);

    // If userId provided, verify ownership
    if (execution && args.userId && execution.userId !== args.userId) {
      return null;
    }

    return execution;
  },
});

/**
 * Get AI agent stats for analytics (matches getAgentAnalytics expected format)
 */
export const getStats = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const executions = await ctx.db
      .query("aiAgentExecutions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(100);

    const totalExecutions = executions.length;
    const totalTokens = executions.reduce((sum, e) => sum + e.tokensUsed, 0);

    // Group by agent type
    const byAgentType: Record<string, { executions: number; tokens: number }> = {};
    executions.forEach((execution) => {
      if (!byAgentType[execution.agentType]) {
        byAgentType[execution.agentType] = { executions: 0, tokens: 0 };
      }
      byAgentType[execution.agentType].executions++;
      byAgentType[execution.agentType].tokens += execution.tokensUsed;
    });

    const recentActivity = executions.slice(0, 10);

    return {
      totalExecutions,
      totalTokens,
      byAgentType,
      recentActivity,
    };
  },
});

/**
 * Get AI agent statistics grouped by agent type for a user
 */
export const getStatsByUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const executions = await ctx.db
      .query("aiAgentExecutions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Group by agent type and calculate stats
    const statsMap: Record<string, { executions: number; tokens: number }> = {};

    executions.forEach((execution) => {
      if (!statsMap[execution.agentType]) {
        statsMap[execution.agentType] = { executions: 0, tokens: 0 };
      }
      statsMap[execution.agentType].executions++;
      statsMap[execution.agentType].tokens += execution.tokensUsed;
    });

    // Convert to array format
    return Object.entries(statsMap).map(([agentType, stats]) => ({
      agentType,
      executions: stats.executions,
      tokens: stats.tokens,
    }));
  },
});

/**
 * Get AI agent executions for a user
 */
export const listByUser = query({
  args: {
    userId: v.id("users"),
    agentType: v.optional(
      v.union(
        v.literal("GENERAL_ASSISTANT"),
        v.literal("IFLOW_CREATOR"),
        v.literal("SMART_MONITOR"),
        v.literal("PERFORMANCE_OPTIMIZER"),
        v.literal("ERROR_DIAGNOSTICIAN"),
        v.literal("SECURITY_AUDITOR"),
        v.literal("DOCUMENTATION_GENERATOR"),
        v.literal("TEST_CASE_GENERATOR"),
        v.literal("COST_ANALYZER"),
        v.literal("PREDICTIVE_INSIGHTS")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    let executions = await ctx.db
      .query("aiAgentExecutions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    if (args.agentType) {
      executions = executions.filter((e) => e.agentType === args.agentType);
    }

    return executions;
  },
});

/**
 * Get AI agent executions by user and agent type (for chat history)
 */
export const getExecutionsByUser = query({
  args: {
    userId: v.id("users"),
    agentType: aiAgentTypeValidator,
    tenantId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    let query = ctx.db
      .query("aiAgentExecutions")
      .withIndex("by_userId_agentType", (q) =>
        q.eq("userId", args.userId).eq("agentType", args.agentType)
      )
      .order("desc")
      .take(limit);

    const executions = await query;

    // Filter by tenantId if provided
    if (args.tenantId) {
      return executions.filter(e => e.tenantId === args.tenantId);
    }

    return executions;
  },
});

/**
 * Get AI agent executions for a tenant
 */
export const listByTenant = query({
  args: {
    tenantId: v.string(),
    agentType: v.optional(
      v.union(
        v.literal("GENERAL_ASSISTANT"),
        v.literal("IFLOW_CREATOR"),
        v.literal("SMART_MONITOR"),
        v.literal("PERFORMANCE_OPTIMIZER"),
        v.literal("ERROR_DIAGNOSTICIAN"),
        v.literal("SECURITY_AUDITOR"),
        v.literal("DOCUMENTATION_GENERATOR"),
        v.literal("TEST_CASE_GENERATOR"),
        v.literal("COST_ANALYZER"),
        v.literal("PREDICTIVE_INSIGHTS")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    let executions = await ctx.db
      .query("aiAgentExecutions")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit);

    if (args.agentType) {
      executions = executions.filter((e) => e.agentType === args.agentType);
    }

    return executions;
  },
});

/**
 * Get AI agent usage statistics for a user
 */
export const getUsageStats = query({
  args: {
    userId: v.id("users"),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysBack = args.daysBack ?? 30;
    const startTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    const executions = await ctx.db
      .query("aiAgentExecutions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.gte(q.field("_creationTime"), startTime))
      .collect();

    const stats = {
      totalExecutions: executions.length,
      totalTokensUsed: 0,
      avgDuration: 0,
      byAgentType: {} as Record<string, number>,
      byStatus: {
        RUNNING: 0,
        COMPLETED: 0,
        FAILED: 0,
        CANCELLED: 0,
      } as Record<string, number>,
    };

    let totalDuration = 0;
    let durationsCount = 0;

    for (const execution of executions) {
      // Count by agent type
      stats.byAgentType[execution.agentType] =
        (stats.byAgentType[execution.agentType] || 0) + 1;

      // Count by status
      stats.byStatus[execution.status]++;

      // Sum tokens
      stats.totalTokensUsed += execution.tokensUsed;

      // Calculate average duration
      if (execution.duration) {
        totalDuration += execution.duration;
        durationsCount++;
      }
    }

    stats.avgDuration = durationsCount > 0 ? Math.round(totalDuration / durationsCount) : 0;

    return stats;
  },
});

/**
 * Get recent AI agent executions (admin)
 */
export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("RUNNING"),
        v.literal("COMPLETED"),
        v.literal("FAILED"),
        v.literal("CANCELLED")
      )
    ),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    let executions;
    if (args.status) {
      executions = await ctx.db
        .query("aiAgentExecutions")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    } else {
      executions = await ctx.db
        .query("aiAgentExecutions")
        .order("desc")
        .take(limit);
    }

    // Enrich with user info
    const enriched = await Promise.all(
      executions.map(async (execution) => {
        const user = await ctx.db.get(execution.userId);
        return {
          ...execution,
          user: user
            ? {
              id: user._id,
              email: user.email,
              name: user.name,
            }
            : null,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get AI agent global statistics (admin)
 */
export const getGlobalStats = query({
  args: {
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysBack = args.daysBack ?? 30;
    const startTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    const executions = await ctx.db
      .query("aiAgentExecutions")
      .filter((q) => q.gte(q.field("_creationTime"), startTime))
      .collect();

    const stats = {
      totalExecutions: executions.length,
      totalTokensUsed: 0,
      totalDuration: 0,
      avgTokensPerExecution: 0,
      avgDuration: 0,
      byAgentType: {} as Record<string, { count: number; tokens: number }>,
      byStatus: {
        RUNNING: 0,
        COMPLETED: 0,
        FAILED: 0,
        CANCELLED: 0,
      } as Record<string, number>,
      uniqueUsers: 0,
    };

    const userIds = new Set<string>();
    let durationsCount = 0;

    for (const execution of executions) {
      // Track unique users
      userIds.add(execution.userId);

      // Count by agent type
      if (!stats.byAgentType[execution.agentType]) {
        stats.byAgentType[execution.agentType] = { count: 0, tokens: 0 };
      }
      stats.byAgentType[execution.agentType].count++;
      stats.byAgentType[execution.agentType].tokens += execution.tokensUsed;

      // Count by status
      stats.byStatus[execution.status]++;

      // Sum tokens
      stats.totalTokensUsed += execution.tokensUsed;

      // Sum duration
      if (execution.duration) {
        stats.totalDuration += execution.duration;
        durationsCount++;
      }
    }

    stats.uniqueUsers = userIds.size;
    stats.avgTokensPerExecution =
      executions.length > 0 ? Math.round(stats.totalTokensUsed / executions.length) : 0;
    stats.avgDuration = durationsCount > 0 ? Math.round(stats.totalDuration / durationsCount) : 0;

    return stats;
  },
});
