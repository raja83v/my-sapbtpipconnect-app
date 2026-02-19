import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get a pipeline execution by ID
 */
export const getById = query({
  args: {
    pipelineId: v.id("iflowPipelines"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.pipelineId);
  },
});

/**
 * Get a pipeline by ID with user ownership verification
 */
export const getByIdForUser = query({
  args: {
    pipelineId: v.id("iflowPipelines"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const pipeline = await ctx.db.get(args.pipelineId);
    if (pipeline && pipeline.userId !== args.userId) {
      return null;
    }
    return pipeline;
  },
});

/**
 * List pipelines for a user (most recent first)
 */
export const listByUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("iflowPipelines")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * List pipelines for a user + tenant combination
 */
export const listByUserAndTenant = query({
  args: {
    userId: v.id("users"),
    tenantId: v.id("cpiTenants"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const pipelines = await ctx.db
      .query("iflowPipelines")
      .withIndex("by_userId_tenantId", (q) =>
        q.eq("userId", args.userId).eq("tenantId", args.tenantId)
      )
      .order("desc")
      .take(limit);
    return pipelines;
  },
});

/**
 * Get active (non-terminal) pipelines for a user + tenant
 * Used to check if there's already a pipeline running
 */
export const getActivePipeline = query({
  args: {
    userId: v.id("users"),
    tenantId: v.id("cpiTenants"),
  },
  handler: async (ctx, args) => {
    const pipelines = await ctx.db
      .query("iflowPipelines")
      .withIndex("by_userId_tenantId", (q) =>
        q.eq("userId", args.userId).eq("tenantId", args.tenantId)
      )
      .order("desc")
      .take(10);

    // Find first non-terminal pipeline
    const terminalPhases = ["COMPLETED", "FAILED", "CANCELLED"];
    return pipelines.find((p) => !terminalPhases.includes(p.phase)) ?? null;
  },
});

/**
 * Get all agent logs for a pipeline (ordered by startedAt)
 */
export const getAgentLogs = query({
  args: {
    pipelineId: v.id("iflowPipelines"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("iflowPipelineAgentLogs")
      .withIndex("by_pipelineId", (q) => q.eq("pipelineId", args.pipelineId))
      .order("asc")
      .collect();
  },
});

/**
 * Get logs for a specific agent within a pipeline
 */
export const getAgentLogsByName = query({
  args: {
    pipelineId: v.id("iflowPipelines"),
    agentName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("iflowPipelineAgentLogs")
      .withIndex("by_pipelineId_agentName", (q) =>
        q.eq("pipelineId", args.pipelineId).eq("agentName", args.agentName)
      )
      .order("asc")
      .collect();
  },
});
