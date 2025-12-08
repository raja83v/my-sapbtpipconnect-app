import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { aiAgentTypeValidator, aiAgentStatusValidator } from "./schema";

/**
 * Create an AI agent execution
 */
export const create = mutation({
  args: {
    userId: v.id("users"),
    agentType: aiAgentTypeValidator,
    inputPrompt: v.string(),
    tenantId: v.optional(v.id("cpiTenants")),
    iFlowId: v.optional(v.id("iFlows")),
    status: v.optional(aiAgentStatusValidator),
    prompt: v.optional(v.string()),
    context: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const executionId = await ctx.db.insert("aiAgentExecutions", {
      userId: args.userId,
      agentType: args.agentType,
      status: args.status || "RUNNING",
      input: args.inputPrompt || args.prompt || "",
      output: "",
      inputPrompt: args.inputPrompt || args.prompt || "",
      tenantId: args.tenantId ? String(args.tenantId) : undefined,
      iFlowId: args.iFlowId ? String(args.iFlowId) : undefined,
      tokensUsed: 0,
      success: false,
    });

    // Increment AI agent usage
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        currentAIAgentCalls: subscription.currentAIAgentCalls + 1,
      });
    }

    return executionId;
  },
});

/**
 * Complete an AI agent execution
 */
export const complete = mutation({
  args: {
    executionId: v.id("aiAgentExecutions"),
    response: v.optional(v.string()),
    outputData: v.optional(v.string()),
    tokensUsed: v.number(),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.executionId, {
      status: "COMPLETED",
      outputData: args.response || args.outputData,
      tokensUsed: args.tokensUsed,
      duration: args.duration,
    });

    return args.executionId;
  },
});

/**
 * Fail an AI agent execution
 */
export const fail = mutation({
  args: {
    executionId: v.id("aiAgentExecutions"),
    errorMessage: v.string(),
    tokensUsed: v.optional(v.number()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.executionId, {
      status: "FAILED",
      errorMessage: args.errorMessage,
      tokensUsed: args.tokensUsed ?? 0,
      duration: args.duration,
    });

    return args.executionId;
  },
});

/**
 * Cancel an AI agent execution
 */
export const cancel = mutation({
  args: {
    executionId: v.id("aiAgentExecutions"),
    tokensUsed: v.optional(v.number()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.executionId, {
      status: "CANCELLED",
      tokensUsed: args.tokensUsed ?? 0,
      duration: args.duration,
    });

    return args.executionId;
  },
});

/**
 * Update an AI agent execution
 */
export const update = mutation({
  args: {
    executionId: v.id("aiAgentExecutions"),
    status: v.optional(aiAgentStatusValidator),
    outputData: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { executionId, ...updates } = args;

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(executionId, filteredUpdates);
    }

    return executionId;
  },
});

/**
 * Delete an AI agent execution
 */
export const deleteExecution = mutation({
  args: { executionId: v.id("aiAgentExecutions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.executionId);
    return args.executionId;
  },
});

/**
 * Delete old AI agent executions (cleanup)
 */
export const deleteOldExecutions = mutation({
  args: {
    olderThanDays: v.number(),
  },
  handler: async (ctx, args) => {
    const cutoffTime = Date.now() - args.olderThanDays * 24 * 60 * 60 * 1000;

    const oldExecutions = await ctx.db
      .query("aiAgentExecutions")
      .filter((q) => q.lt(q.field("_creationTime"), cutoffTime))
      .collect();

    for (const execution of oldExecutions) {
      await ctx.db.delete(execution._id);
    }

    return { deleted: oldExecutions.length };
  },
});

/**
 * Track an AI agent execution (simplified version for quick tracking)
 */
export const trackExecution = mutation({
  args: {
    userId: v.id("users"),
    agentType: aiAgentTypeValidator,
    tenantId: v.optional(v.string()),
    iflowId: v.optional(v.string()),
    input: v.string(),
    output: v.string(),
    tokensUsed: v.number(),
    duration: v.optional(v.number()),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    const executionId = await ctx.db.insert("aiAgentExecutions", {
      userId: args.userId,
      agentType: args.agentType,
      status: args.success ? "COMPLETED" : "FAILED",
      input: args.input,
      output: args.output,
      tenantId: args.tenantId,
      iFlowId: args.iflowId,
      tokensUsed: args.tokensUsed,
      duration: args.duration,
      success: args.success,
    });

    // Increment AI agent usage
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        currentAIAgentCalls: subscription.currentAIAgentCalls + 1,
      });
    }

    return executionId;
  },
});
