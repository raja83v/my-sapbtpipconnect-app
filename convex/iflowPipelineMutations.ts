import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { pipelinePhaseValidator, pipelineAgentLogStatusValidator } from "./schema";

/**
 * Create a new pipeline execution
 */
export const create = mutation({
  args: {
    userId: v.id("users"),
    tenantId: v.id("cpiTenants"),
    packageSelection: v.string(), // JSON
    description: v.string(), // JSON
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const pipelineId = await ctx.db.insert("iflowPipelines", {
      userId: args.userId,
      tenantId: args.tenantId,
      phase: "INIT",
      packageSelection: args.packageSelection,
      description: args.description,
      totalTokensUsed: 0,
      startedAt: now,
      updatedAt: now,
    });
    return pipelineId;
  },
});

/**
 * Update pipeline phase (state transition)
 */
export const updatePhase = mutation({
  args: {
    pipelineId: v.id("iflowPipelines"),
    phase: pipelinePhaseValidator,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const updates: Record<string, unknown> = {
      phase: args.phase,
      updatedAt: now,
    };

    // Set completedAt for terminal phases
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(args.phase)) {
      updates.completedAt = now;
      const pipeline = await ctx.db.get(args.pipelineId);
      if (pipeline) {
        updates.totalDuration = now - pipeline.startedAt;
      }
    }

    await ctx.db.patch(args.pipelineId, updates);
    return args.pipelineId;
  },
});

/**
 * Store tenant capabilities
 */
export const setTenantCapabilities = mutation({
  args: {
    pipelineId: v.id("iflowPipelines"),
    tenantCapabilities: v.string(), // JSON
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pipelineId, {
      tenantCapabilities: args.tenantCapabilities,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Store Architect Agent result
 */
export const setArchitectResult = mutation({
  args: {
    pipelineId: v.id("iflowPipelines"),
    architectResult: v.string(), // JSON
    tokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    const pipeline = await ctx.db.get(args.pipelineId);
    await ctx.db.patch(args.pipelineId, {
      architectResult: args.architectResult,
      totalTokensUsed: (pipeline?.totalTokensUsed ?? 0) + args.tokensUsed,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Store Design Reviewer result
 */
export const setReviewerResult = mutation({
  args: {
    pipelineId: v.id("iflowPipelines"),
    reviewerResult: v.string(), // JSON
    finalDesign: v.optional(v.string()), // JSON — patched design if auto-fixed
    tokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    const pipeline = await ctx.db.get(args.pipelineId);
    const updates: Record<string, unknown> = {
      reviewerResult: args.reviewerResult,
      totalTokensUsed: (pipeline?.totalTokensUsed ?? 0) + args.tokensUsed,
      updatedAt: Date.now(),
    };
    if (args.finalDesign) {
      updates.finalDesign = args.finalDesign;
    }
    await ctx.db.patch(args.pipelineId, updates);
  },
});

/**
 * Store BPMN2 generation result
 */
export const setBpmn2Result = mutation({
  args: {
    pipelineId: v.id("iflowPipelines"),
    bpmn2Xml: v.string(),
    bpmn2ScriptFiles: v.optional(v.string()), // JSON
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pipelineId, {
      bpmn2Xml: args.bpmn2Xml,
      bpmn2ScriptFiles: args.bpmn2ScriptFiles,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Store Validator Agent result
 */
export const setValidatorResult = mutation({
  args: {
    pipelineId: v.id("iflowPipelines"),
    validatorResult: v.string(), // JSON
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pipelineId, {
      validatorResult: args.validatorResult,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Append a fix attempt result
 */
export const appendFixAttempt = mutation({
  args: {
    pipelineId: v.id("iflowPipelines"),
    fixAttempt: v.string(), // JSON of a single FixAttempt
    updatedDesign: v.optional(v.string()), // JSON — new finalDesign after fix
    tokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    const pipeline = await ctx.db.get(args.pipelineId);
    if (!pipeline) throw new Error("Pipeline not found");

    // Parse existing fix attempts array and append
    const existing: unknown[] = pipeline.fixAttempts
      ? JSON.parse(pipeline.fixAttempts)
      : [];
    existing.push(JSON.parse(args.fixAttempt));

    const updates: Record<string, unknown> = {
      fixAttempts: JSON.stringify(existing),
      totalTokensUsed: pipeline.totalTokensUsed + args.tokensUsed,
      updatedAt: Date.now(),
    };

    if (args.updatedDesign) {
      updates.finalDesign = args.updatedDesign;
    }

    await ctx.db.patch(args.pipelineId, updates);
  },
});

/**
 * Store Summarizer result
 */
export const setSummarizerResult = mutation({
  args: {
    pipelineId: v.id("iflowPipelines"),
    summarizerResult: v.string(), // JSON
    tokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    const pipeline = await ctx.db.get(args.pipelineId);
    await ctx.db.patch(args.pipelineId, {
      summarizerResult: args.summarizerResult,
      totalTokensUsed: (pipeline?.totalTokensUsed ?? 0) + args.tokensUsed,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Store deployment result
 */
export const setDeploymentResult = mutation({
  args: {
    pipelineId: v.id("iflowPipelines"),
    deploymentResult: v.string(), // JSON
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pipelineId, {
      deploymentResult: args.deploymentResult,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Set error state on the pipeline
 */
export const setError = mutation({
  args: {
    pipelineId: v.id("iflowPipelines"),
    errorPhase: v.string(),
    errorMessage: v.string(),
    errorRecoverable: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pipelineId, {
      phase: "FAILED",
      errorPhase: args.errorPhase,
      errorMessage: args.errorMessage,
      errorRecoverable: args.errorRecoverable,
      updatedAt: Date.now(),
      completedAt: Date.now(),
    });
  },
});

// ============================================================================
// Agent Log Mutations
// ============================================================================

/**
 * Log an agent execution start
 */
export const logAgentStart = mutation({
  args: {
    pipelineId: v.id("iflowPipelines"),
    agentName: v.string(),
    input: v.optional(v.string()), // JSON (truncated)
    attemptNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("iflowPipelineAgentLogs", {
      pipelineId: args.pipelineId,
      agentName: args.agentName,
      status: "RUNNING",
      input: args.input,
      tokensUsed: 0,
      duration: 0,
      attemptNumber: args.attemptNumber,
      startedAt: Date.now(),
    });
    return logId;
  },
});

/**
 * Complete an agent execution log
 */
export const logAgentComplete = mutation({
  args: {
    logId: v.id("iflowPipelineAgentLogs"),
    status: pipelineAgentLogStatusValidator,
    output: v.optional(v.string()), // JSON (truncated)
    errorMessage: v.optional(v.string()),
    tokensUsed: v.number(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.logId, {
      status: args.status,
      output: args.output,
      errorMessage: args.errorMessage,
      tokensUsed: args.tokensUsed,
      duration: args.duration,
      completedAt: Date.now(),
    });
  },
});
