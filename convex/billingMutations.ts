import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  subscriptionPlanValidator,
  subscriptionStatusValidator,
  invoiceStatusValidator,
} from "./schema";

/**
 * Create a subscription for a user
 */
export const createSubscription = mutation({
  args: {
    userId: v.id("users"),
    plan: subscriptionPlanValidator,
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    stripeCurrentPeriodStart: v.optional(v.number()),
    stripeCurrentPeriodEnd: v.optional(v.number()),
    trialStart: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if user already has a subscription
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      throw new Error("User already has a subscription");
    }

    // Set plan limits based on plan type
    const planLimits = getPlanLimits(args.plan);

    const subscriptionId = await ctx.db.insert("subscriptions", {
      userId: args.userId,
      plan: args.plan,
      status: args.trialEnd ? "TRIALING" : "ACTIVE",
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripePriceId: args.stripePriceId,
      stripeCurrentPeriodStart: args.stripeCurrentPeriodStart,
      stripeCurrentPeriodEnd: args.stripeCurrentPeriodEnd,
      ...planLimits,
      currentTenantCount: 0,
      currentIFlowCount: 0,
      currentTeamMemberCount: 0,
      currentAIAgentCalls: 0,
      trialStart: args.trialStart,
      trialEnd: args.trialEnd,
      cancelAtPeriodEnd: false,
    });

    return subscriptionId;
  },
});

/**
 * Update a subscription
 */
export const updateSubscription = mutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    data: v.optional(v.object({
      plan: v.optional(subscriptionPlanValidator),
      status: v.optional(v.string()),
      stripeSubscriptionId: v.optional(v.string()),
      stripeCustomerId: v.optional(v.string()),
      stripePriceId: v.optional(v.string()),
      stripeCurrentPeriodStart: v.optional(v.number()),
      stripeCurrentPeriodEnd: v.optional(v.number()),
      maxTenants: v.optional(v.number()),
      maxIFlows: v.optional(v.number()),
      maxTeamMembers: v.optional(v.number()),
      maxAIAgentCalls: v.optional(v.number()),
      cancelAtPeriodEnd: v.optional(v.boolean()),
      canceledAt: v.optional(v.union(v.number(), v.null())),
    })),
    // Also support direct args (legacy)
    plan: v.optional(subscriptionPlanValidator),
    status: v.optional(subscriptionStatusValidator),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    stripeCurrentPeriodStart: v.optional(v.number()),
    stripeCurrentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    canceledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { subscriptionId, data, ...directUpdates } = args;

    // Use data object if provided, otherwise use direct args
    const updates = data || directUpdates;
    const { plan, ...restUpdates } = updates as any;

    const filteredUpdates: any = Object.fromEntries(
      Object.entries(restUpdates).filter(([_, v]) => v !== undefined && v !== null)
    );

    // Handle canceledAt being set to undefined (null in Convex)
    if (data && 'canceledAt' in data && data.canceledAt === undefined) {
      filteredUpdates.canceledAt = undefined;
    }

    // If plan is changing, update limits
    if (plan) {
      const planLimits = getPlanLimits(plan);
      filteredUpdates.plan = plan;
      filteredUpdates.maxTenants = planLimits.maxTenants;
      filteredUpdates.maxIFlows = planLimits.maxIFlows;
      filteredUpdates.maxTeamMembers = planLimits.maxTeamMembers;
      filteredUpdates.maxAIAgentCalls = planLimits.maxAIAgentCalls;
    }

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(subscriptionId, filteredUpdates);
    }

    return subscriptionId;
  },
});

/**
 * Update subscription by Stripe subscription ID
 */
export const updateByStripeId = mutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: v.optional(subscriptionStatusValidator),
    plan: v.optional(subscriptionPlanValidator),
    stripePriceId: v.optional(v.string()),
    stripeCurrentPeriodStart: v.optional(v.number()),
    stripeCurrentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    canceledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { stripeSubscriptionId, plan, ...updates } = args;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", stripeSubscriptionId)
      )
      .first();

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    const filteredUpdates: any = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (plan) {
      const planLimits = getPlanLimits(plan);
      filteredUpdates.plan = plan;
      filteredUpdates.maxTenants = planLimits.maxTenants;
      filteredUpdates.maxIFlows = planLimits.maxIFlows;
      filteredUpdates.maxTeamMembers = planLimits.maxTeamMembers;
      filteredUpdates.maxAIAgentCalls = planLimits.maxAIAgentCalls;
    }

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(subscription._id, filteredUpdates);
    }

    return subscription._id;
  },
});

/**
 * Increment usage counter
 */
export const incrementUsage = mutation({
  args: {
    userId: v.id("users"),
    usageType: v.union(
      v.literal("tenants"),
      v.literal("iflows"),
      v.literal("teamMembers"),
      v.literal("aiAgentCalls")
    ),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const amount = args.amount ?? 1;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!subscription) {
      // Create default free subscription
      const planLimits = getPlanLimits("FREE");
      const newSubId = await ctx.db.insert("subscriptions", {
        userId: args.userId,
        plan: "FREE",
        status: "ACTIVE",
        ...planLimits,
        currentTenantCount: args.usageType === "tenants" ? amount : 0,
        currentIFlowCount: args.usageType === "iflows" ? amount : 0,
        currentTeamMemberCount: args.usageType === "teamMembers" ? amount : 0,
        currentAIAgentCalls: args.usageType === "aiAgentCalls" ? amount : 0,
        cancelAtPeriodEnd: false,
      });
      return newSubId;
    }

    const updates: any = {};
    switch (args.usageType) {
      case "tenants":
        updates.currentTenantCount = subscription.currentTenantCount + amount;
        break;
      case "iflows":
        updates.currentIFlowCount = subscription.currentIFlowCount + amount;
        break;
      case "teamMembers":
        updates.currentTeamMemberCount = subscription.currentTeamMemberCount + amount;
        break;
      case "aiAgentCalls":
        updates.currentAIAgentCalls = subscription.currentAIAgentCalls + amount;
        break;
    }

    await ctx.db.patch(subscription._id, updates);
    return subscription._id;
  },
});

/**
 * Decrement usage counter
 */
export const decrementUsage = mutation({
  args: {
    userId: v.id("users"),
    usageType: v.union(
      v.literal("tenants"),
      v.literal("iflows"),
      v.literal("teamMembers"),
      v.literal("aiAgentCalls")
    ),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const amount = args.amount ?? 1;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!subscription) {
      return null;
    }

    const updates: any = {};
    switch (args.usageType) {
      case "tenants":
        updates.currentTenantCount = Math.max(0, subscription.currentTenantCount - amount);
        break;
      case "iflows":
        updates.currentIFlowCount = Math.max(0, subscription.currentIFlowCount - amount);
        break;
      case "teamMembers":
        updates.currentTeamMemberCount = Math.max(0, subscription.currentTeamMemberCount - amount);
        break;
      case "aiAgentCalls":
        updates.currentAIAgentCalls = Math.max(0, subscription.currentAIAgentCalls - amount);
        break;
    }

    await ctx.db.patch(subscription._id, updates);
    return subscription._id;
  },
});

/**
 * Reset monthly AI agent calls (for cron job)
 */
export const resetMonthlyAIAgentCalls = mutation({
  args: {},
  handler: async (ctx) => {
    const subscriptions = await ctx.db.query("subscriptions").collect();

    for (const subscription of subscriptions) {
      await ctx.db.patch(subscription._id, { currentAIAgentCalls: 0 });
    }

    return { reset: subscriptions.length };
  },
});

/**
 * Internal version of reset monthly AI agent calls (for cron job)
 */
export const resetAllMonthlyAIAgentCalls = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log('🔄 Resetting monthly AI agent calls for all subscriptions...');

    const subscriptions = await ctx.db.query("subscriptions").collect();
    let resetCount = 0;

    for (const subscription of subscriptions) {
      if (subscription.currentAIAgentCalls > 0) {
        await ctx.db.patch(subscription._id, { currentAIAgentCalls: 0 });
        resetCount++;
      }
    }

    console.log(`✅ Reset AI agent calls for ${resetCount} subscriptions (${subscriptions.length} total)`);
    return { reset: resetCount, total: subscriptions.length };
  },
});

/**
 * Delete a subscription
 */
export const deleteSubscription = mutation({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

/**
 * Create an invoice
 */
export const createInvoice = mutation({
  args: {
    userId: v.id("users"),
    stripeInvoiceId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    amountPaid: v.number(),
    amountDue: v.number(),
    currency: v.optional(v.string()),
    status: invoiceStatusValidator,
    invoiceUrl: v.optional(v.string()),
    invoicePdf: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    paidAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if invoice already exists
    const existing = await ctx.db
      .query("invoices")
      .withIndex("by_stripeInvoiceId", (q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
      .first();

    if (existing) {
      // Update existing invoice
      const { stripeInvoiceId, userId, ...updates } = args;
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    const invoiceId = await ctx.db.insert("invoices", {
      ...args,
      currency: args.currency ?? "usd",
    });

    return invoiceId;
  },
});

/**
 * Update an invoice
 */
export const updateInvoice = mutation({
  args: {
    invoiceId: v.id("invoices"),
    data: v.optional(v.object({
      status: v.optional(invoiceStatusValidator),
      amountPaid: v.optional(v.number()),
      amountDue: v.optional(v.number()),
      currency: v.optional(v.string()),
      stripePaymentIntentId: v.optional(v.string()),
      paidAt: v.optional(v.number()),
      invoiceUrl: v.optional(v.string()),
      invoicePdf: v.optional(v.string()),
      hostedInvoiceUrl: v.optional(v.string()),
      periodStart: v.optional(v.number()),
      periodEnd: v.optional(v.number()),
    })),
    // Also support direct args (legacy)
    status: v.optional(invoiceStatusValidator),
    amountPaid: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    invoiceUrl: v.optional(v.string()),
    invoicePdf: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { invoiceId, data, ...directUpdates } = args;

    // Use data object if provided, otherwise use direct args
    const updates = data || directUpdates;

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(invoiceId, filteredUpdates);
    }

    return invoiceId;
  },
});

/**
 * Update invoice by Stripe invoice ID
 */
export const updateInvoiceByStripeId = mutation({
  args: {
    stripeInvoiceId: v.string(),
    status: v.optional(invoiceStatusValidator),
    amountPaid: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    invoiceUrl: v.optional(v.string()),
    invoicePdf: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { stripeInvoiceId, ...updates } = args;

    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_stripeInvoiceId", (q) => q.eq("stripeInvoiceId", stripeInvoiceId))
      .first();

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(invoice._id, filteredUpdates);
    }

    return invoice._id;
  },
});

/**
 * Helper to get plan limits
 */
function getPlanLimits(plan: "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE") {
  const limits = {
    FREE: {
      maxTenants: 1,
      maxIFlows: 10,
      maxTeamMembers: 3,
      maxAIAgentCalls: 100,
    },
    STARTER: {
      maxTenants: 3,
      maxIFlows: 50,
      maxTeamMembers: 10,
      maxAIAgentCalls: 500,
    },
    PROFESSIONAL: {
      maxTenants: 10,
      maxIFlows: 200,
      maxTeamMembers: 25,
      maxAIAgentCalls: 2000,
    },
    ENTERPRISE: {
      maxTenants: 999,
      maxIFlows: 9999,
      maxTeamMembers: 999,
      maxAIAgentCalls: 99999,
    },
  };

  return limits[plan];
}
