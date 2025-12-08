import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get iFlow by ID
 */
export const getById = query({
  args: { id: v.id("iFlows") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get iFlows for a tenant
 */
export const listByTenant = query({
  args: {
    tenantId: v.id("cpiTenants"),
    status: v.optional(
      v.union(
        v.literal("STARTED"),
        v.literal("STOPPED"),
        v.literal("STARTING"),
        v.literal("STOPPING"),
        v.literal("ERROR")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    let iFlows;
    if (args.status) {
      iFlows = await ctx.db
        .query("iFlows")
        .withIndex("by_tenantId_status", (q) =>
          q.eq("tenantId", args.tenantId).eq("status", args.status!)
        )
        .take(limit);
    } else {
      iFlows = await ctx.db
        .query("iFlows")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
        .take(limit);
    }

    return iFlows;
  },
});

/**
 * Get iFlow by tenant and SAP iFlow ID
 */
export const getByTenantAndIFlowId = query({
  args: {
    tenantId: v.id("cpiTenants"),
    iFlowId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("iFlows")
      .withIndex("by_tenantId_iFlowId", (q) =>
        q.eq("tenantId", args.tenantId).eq("iFlowId", args.iFlowId)
      )
      .first();
  },
});

/**
 * Get iFlow count by tenant
 */
export const getCountByTenant = query({
  args: { tenantId: v.id("cpiTenants") },
  handler: async (ctx, args) => {
    const iFlows = await ctx.db
      .query("iFlows")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    return iFlows.length;
  },
});

/**
 * Get iFlow statistics by status for a tenant
 */
export const getStatsByTenant = query({
  args: { tenantId: v.id("cpiTenants") },
  handler: async (ctx, args) => {
    const iFlows = await ctx.db
      .query("iFlows")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const stats = {
      total: iFlows.length,
      started: 0,
      stopped: 0,
      starting: 0,
      stopping: 0,
      error: 0,
    };

    for (const iFlow of iFlows) {
      switch (iFlow.status) {
        case "STARTED":
          stats.started++;
          break;
        case "STOPPED":
          stats.stopped++;
          break;
        case "STARTING":
          stats.starting++;
          break;
        case "STOPPING":
          stats.stopping++;
          break;
        case "ERROR":
          stats.error++;
          break;
      }
    }

    return stats;
  },
});

/**
 * Get iFlow executions
 */
export const getExecutions = query({
  args: {
    iFlowId: v.id("iFlows"),
    status: v.optional(
      v.union(
        v.literal("COMPLETED"),
        v.literal("FAILED"),
        v.literal("PROCESSING"),
        v.literal("SKIPPED"),
        v.literal("RETRY")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    let executions = await ctx.db
      .query("iFlowExecutions")
      .withIndex("by_iFlowId", (q) => q.eq("iFlowId", args.iFlowId))
      .order("desc")
      .take(limit);

    if (args.status) {
      executions = executions.filter((e) => e.status === args.status);
    }

    return executions;
  },
});

/**
 * Get execution by message ID
 */
export const getExecutionByMessageId = query({
  args: {
    messageId: v.string(),
    iFlowId: v.optional(v.id("iFlows")),
  },
  handler: async (ctx, args) => {
    const execution = await ctx.db
      .query("iFlowExecutions")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .first();

    // If iFlowId provided, verify it matches
    if (execution && args.iFlowId && execution.iFlowId !== args.iFlowId) {
      return null;
    }

    return execution;
  },
});

/**
 * Get execution statistics for a tenant
 */
export const getExecutionStatsByTenant = query({
  args: {
    tenantId: v.id("cpiTenants"),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysBack = args.daysBack ?? 7;
    const startTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    // Get all iFlows for this tenant
    const iFlows = await ctx.db
      .query("iFlows")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const iFlowIds = new Set(iFlows.map((i) => i._id));

    // Get all executions for these iFlows in the time range
    const allExecutions = await ctx.db
      .query("iFlowExecutions")
      .withIndex("by_startTime")
      .filter((q) => q.gte(q.field("startTime"), startTime))
      .collect();

    // Filter to only executions for this tenant's iFlows
    const executions = allExecutions.filter((e) => iFlowIds.has(e.iFlowId));

    // Calculate stats
    const stats = {
      total: executions.length,
      completed: 0,
      failed: 0,
      processing: 0,
      avgDuration: 0,
      byDate: {} as Record<string, { completed: number; failed: number; total: number }>,
    };

    let totalDuration = 0;
    let durationsCount = 0;

    for (const execution of executions) {
      // Count by status
      switch (execution.status) {
        case "COMPLETED":
          stats.completed++;
          break;
        case "FAILED":
          stats.failed++;
          break;
        case "PROCESSING":
          stats.processing++;
          break;
      }

      // Calculate average duration
      if (execution.duration) {
        totalDuration += execution.duration;
        durationsCount++;
      }

      // Group by date - safely handle invalid timestamps
      if (execution.startTime && typeof execution.startTime === 'number' && execution.startTime > 0) {
        const dateObj = new Date(execution.startTime);
        if (!isNaN(dateObj.getTime())) {
          const date = dateObj.toISOString().split("T")[0];
          if (!stats.byDate[date]) {
            stats.byDate[date] = { completed: 0, failed: 0, total: 0 };
          }
          stats.byDate[date].total++;
          if (execution.status === "COMPLETED") {
            stats.byDate[date].completed++;
          } else if (execution.status === "FAILED") {
            stats.byDate[date].failed++;
          }
        }
      }
    }

    stats.avgDuration = durationsCount > 0 ? Math.round(totalDuration / durationsCount) : 0;

    return stats;
  },
});

/**
 * Get recent executions across multiple tenants (for dashboard)
 */
export const getRecentExecutionsForTenants = query({
  args: {
    tenantIds: v.array(v.id("cpiTenants")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const tenantIdSet = new Set(args.tenantIds);

    // Get all iFlows for these tenants
    const iFlows = await Promise.all(
      args.tenantIds.map((tenantId) =>
        ctx.db
          .query("iFlows")
          .withIndex("by_tenantId", (q) => q.eq("tenantId", tenantId))
          .collect()
      )
    );

    const flatIFlows = iFlows.flat();
    const iFlowMap = new Map(flatIFlows.map((i) => [i._id, i]));
    const iFlowIds = new Set(flatIFlows.map((i) => i._id));

    // Get recent executions
    const recentExecutions = await ctx.db
      .query("iFlowExecutions")
      .order("desc")
      .take(limit * 3); // Fetch more to filter

    // Filter to only include executions from the specified tenants
    const filtered = recentExecutions
      .filter((e) => iFlowIds.has(e.iFlowId))
      .slice(0, limit);

    // Enrich with iFlow and tenant info
    return filtered.map((execution) => {
      const iFlow = iFlowMap.get(execution.iFlowId);
      return {
        ...execution,
        iFlowName: iFlow?.name,
        iFlowPackage: iFlow?.packageName,
        tenantId: iFlow?.tenantId,
      };
    });
  },
});

/**
 * Internal version of listByTenant for use by cron jobs
 */
export const listByTenantInternal = internalQuery({
  args: {
    tenantId: v.id("cpiTenants"),
    status: v.optional(
      v.union(
        v.literal("STARTED"),
        v.literal("STOPPED"),
        v.literal("STARTING"),
        v.literal("STOPPING"),
        v.literal("ERROR")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    let iFlows;
    if (args.status) {
      iFlows = await ctx.db
        .query("iFlows")
        .withIndex("by_tenantId_status", (q) =>
          q.eq("tenantId", args.tenantId).eq("status", args.status!)
        )
        .take(limit);
    } else {
      iFlows = await ctx.db
        .query("iFlows")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
        .take(limit);
    }

    return iFlows;
  },
});
