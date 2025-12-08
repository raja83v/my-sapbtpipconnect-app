import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  iFlowStatusValidator,
  executionStatusValidator,
  errorCategoryValidator,
} from "./schema";

/**
 * Create or update an iFlow (upsert)
 */
export const upsert = mutation({
  args: {
    tenantId: v.id("cpiTenants"),
    iFlowId: v.string(),
    name: v.string(),
    packageName: v.optional(v.string()),
    version: v.optional(v.string()),
    status: iFlowStatusValidator,
    lastDeployedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if iFlow already exists for this tenant
    const existing = await ctx.db
      .query("iFlows")
      .withIndex("by_tenantId_iFlowId", (q) =>
        q.eq("tenantId", args.tenantId).eq("iFlowId", args.iFlowId)
      )
      .first();

    if (existing) {
      // Update
      await ctx.db.patch(existing._id, {
        name: args.name,
        packageName: args.packageName,
        version: args.version,
        status: args.status,
        lastDeployedAt: args.lastDeployedAt,
      });
      return existing._id;
    } else {
      // Create
      const id = await ctx.db.insert("iFlows", {
        tenantId: args.tenantId,
        iFlowId: args.iFlowId,
        name: args.name,
        packageName: args.packageName,
        version: args.version,
        status: args.status,
        lastDeployedAt: args.lastDeployedAt,
      });
      return id;
    }
  },
});

/**
 * Batch upsert iFlows
 */
export const batchUpsert = mutation({
  args: {
    tenantId: v.id("cpiTenants"),
    iFlows: v.array(
      v.object({
        iFlowId: v.string(),
        name: v.string(),
        packageName: v.optional(v.string()),
        version: v.optional(v.string()),
        status: iFlowStatusValidator,
        lastDeployedAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results = [];

    for (const iFlow of args.iFlows) {
      const existing = await ctx.db
        .query("iFlows")
        .withIndex("by_tenantId_iFlowId", (q) =>
          q.eq("tenantId", args.tenantId).eq("iFlowId", iFlow.iFlowId)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: iFlow.name,
          packageName: iFlow.packageName,
          version: iFlow.version,
          status: iFlow.status,
          lastDeployedAt: iFlow.lastDeployedAt,
        });
        results.push({ id: existing._id, action: "updated" });
      } else {
        const id = await ctx.db.insert("iFlows", {
          tenantId: args.tenantId,
          ...iFlow,
        });
        results.push({ id, action: "created" });
      }
    }

    return {
      total: results.length,
      created: results.filter((r) => r.action === "created").length,
      updated: results.filter((r) => r.action === "updated").length,
    };
  },
});

/**
 * Update an iFlow
 */
export const update = mutation({
  args: {
    id: v.id("iFlows"),
    name: v.optional(v.string()),
    packageName: v.optional(v.string()),
    version: v.optional(v.string()),
    status: v.optional(iFlowStatusValidator),
    lastDeployedAt: v.optional(v.number()),
    lastExecutedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(id, filteredUpdates);
    }

    return id;
  },
});

/**
 * Delete an iFlow and its executions
 */
export const deleteIFlow = mutation({
  args: { id: v.id("iFlows") },
  handler: async (ctx, args) => {
    // Delete all executions first
    const executions = await ctx.db
      .query("iFlowExecutions")
      .withIndex("by_iFlowId", (q) => q.eq("iFlowId", args.id))
      .collect();

    for (const execution of executions) {
      await ctx.db.delete(execution._id);
    }

    // Delete the iFlow
    await ctx.db.delete(args.id);
    return args.id;
  },
});

/**
 * Create an iFlow execution
 */
export const createExecution = mutation({
  args: {
    iFlowId: v.id("iFlows"),
    messageId: v.string(),
    status: executionStatusValidator,
    startTime: v.number(),
    endTime: v.optional(v.number()),
    duration: v.optional(v.number()),
    requestPayload: v.optional(v.string()),
    responsePayload: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    errorCategory: v.optional(errorCategoryValidator),
    sender: v.optional(v.string()),
    receiver: v.optional(v.string()),
    interfaceType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if execution with messageId already exists
    const existing = await ctx.db
      .query("iFlowExecutions")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .first();

    if (existing) {
      // Update existing execution
      const { iFlowId, messageId, ...updates } = args;
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    const id = await ctx.db.insert("iFlowExecutions", args);

    // Update iFlow's lastExecutedAt
    await ctx.db.patch(args.iFlowId, { lastExecutedAt: args.startTime });

    return id;
  },
});

/**
 * Batch create executions
 */
export const batchCreateExecutions = mutation({
  args: {
    executions: v.array(
      v.object({
        iFlowId: v.id("iFlows"),
        messageId: v.string(),
        status: executionStatusValidator,
        startTime: v.number(),
        endTime: v.optional(v.number()),
        duration: v.optional(v.number()),
        requestPayload: v.optional(v.string()),
        responsePayload: v.optional(v.string()),
        errorMessage: v.optional(v.string()),
        errorCategory: v.optional(errorCategoryValidator),
        sender: v.optional(v.string()),
        receiver: v.optional(v.string()),
        interfaceType: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let skipped = 0;
    const iFlowLastExecuted = new Map<string, number>();

    for (const execution of args.executions) {
      // Check if already exists
      const existing = await ctx.db
        .query("iFlowExecutions")
        .withIndex("by_messageId", (q) => q.eq("messageId", execution.messageId))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("iFlowExecutions", execution);
      created++;

      // Track latest execution per iFlow
      const iFlowIdStr = execution.iFlowId.toString();
      const current = iFlowLastExecuted.get(iFlowIdStr);
      if (!current || execution.startTime > current) {
        iFlowLastExecuted.set(iFlowIdStr, execution.startTime);
      }
    }

    // Update lastExecutedAt for affected iFlows
    for (const [iFlowIdStr, lastExecutedAt] of iFlowLastExecuted) {
      // Note: We need to cast back to the proper ID type
      // This is a workaround since Convex doesn't easily allow string to ID conversion in mutations
      const iFlow = await ctx.db
        .query("iFlows")
        .filter((q) => q.eq(q.field("_id"), iFlowIdStr as any))
        .first();
      if (iFlow) {
        await ctx.db.patch(iFlow._id, { lastExecutedAt });
      }
    }

    return { created, skipped, total: args.executions.length };
  },
});

/**
 * Update an execution
 */
export const updateExecution = mutation({
  args: {
    id: v.id("iFlowExecutions"),
    status: v.optional(executionStatusValidator),
    endTime: v.optional(v.number()),
    duration: v.optional(v.number()),
    responsePayload: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    errorCategory: v.optional(errorCategoryValidator),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(id, filteredUpdates);
    }

    return id;
  },
});

/**
 * Delete an execution
 */
export const deleteExecution = mutation({
  args: { id: v.id("iFlowExecutions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

/**
 * Delete old executions (cleanup)
 */
export const deleteOldExecutions = mutation({
  args: {
    tenantId: v.id("cpiTenants"),
    olderThanDays: v.number(),
  },
  handler: async (ctx, args) => {
    const cutoffTime = Date.now() - args.olderThanDays * 24 * 60 * 60 * 1000;

    // Get all iFlows for this tenant
    const iFlows = await ctx.db
      .query("iFlows")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    let deleted = 0;

    for (const iFlow of iFlows) {
      const oldExecutions = await ctx.db
        .query("iFlowExecutions")
        .withIndex("by_iFlowId", (q) => q.eq("iFlowId", iFlow._id))
        .filter((q) => q.lt(q.field("startTime"), cutoffTime))
        .collect();

      for (const execution of oldExecutions) {
        await ctx.db.delete(execution._id);
        deleted++;
      }
    }

    return { deleted };
  },
});

/**
 * Internal version of batchUpsert for use by cron jobs
 */
export const batchUpsertInternal = internalMutation({
  args: {
    tenantId: v.id("cpiTenants"),
    iFlows: v.array(
      v.object({
        iFlowId: v.string(),
        name: v.string(),
        packageName: v.optional(v.string()),
        version: v.optional(v.string()),
        status: iFlowStatusValidator,
        lastDeployedAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results = [];

    for (const iFlow of args.iFlows) {
      const existing = await ctx.db
        .query("iFlows")
        .withIndex("by_tenantId_iFlowId", (q) =>
          q.eq("tenantId", args.tenantId).eq("iFlowId", iFlow.iFlowId)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: iFlow.name,
          packageName: iFlow.packageName,
          version: iFlow.version,
          status: iFlow.status,
          lastDeployedAt: iFlow.lastDeployedAt,
        });
        results.push({ id: existing._id, action: "updated" });
      } else {
        const id = await ctx.db.insert("iFlows", {
          tenantId: args.tenantId,
          ...iFlow,
        });
        results.push({ id, action: "created" });
      }
    }

    return {
      total: results.length,
      created: results.filter((r) => r.action === "created").length,
      updated: results.filter((r) => r.action === "updated").length,
    };
  },
});

/**
 * Internal version of batchCreateExecutions for use by cron jobs
 */
export const batchCreateExecutionsInternal = internalMutation({
  args: {
    executions: v.array(
      v.object({
        iFlowId: v.id("iFlows"),
        messageId: v.string(),
        status: executionStatusValidator,
        startTime: v.number(),
        endTime: v.optional(v.number()),
        duration: v.optional(v.number()),
        requestPayload: v.optional(v.string()),
        responsePayload: v.optional(v.string()),
        errorMessage: v.optional(v.string()),
        errorCategory: v.optional(errorCategoryValidator),
        sender: v.optional(v.string()),
        receiver: v.optional(v.string()),
        interfaceType: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let skipped = 0;

    for (const execution of args.executions) {
      // Check if already exists
      const existing = await ctx.db
        .query("iFlowExecutions")
        .withIndex("by_messageId", (q) => q.eq("messageId", execution.messageId))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("iFlowExecutions", execution);
      created++;
    }

    return { created, skipped, total: args.executions.length };
  },
});

/**
 * Internal version of update for use by cron jobs
 */
export const updateInternal = internalMutation({
  args: {
    id: v.id("iFlows"),
    name: v.optional(v.string()),
    packageName: v.optional(v.string()),
    version: v.optional(v.string()),
    status: v.optional(iFlowStatusValidator),
    lastDeployedAt: v.optional(v.number()),
    lastExecutedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(id, filteredUpdates);
    }

    return id;
  },
});
