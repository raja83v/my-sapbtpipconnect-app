import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get subscription by user ID (alias for getByUserId)
 */
export const getSubscription = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/**
 * Get subscription by user ID
 */
export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/**
 * Get subscription by Stripe subscription ID
 */
export const getByStripeSubscriptionId = query({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();
  },
});

/**
 * Get subscription by Stripe customer ID
 */
export const getByStripeCustomerId = query({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeCustomerId", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();
  },
});

/**
 * Get invoices for a user (alias)
 */
export const getInvoices = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("invoices")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get invoices for a user
 */
export const getInvoicesByUserId = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("invoices")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get invoice by Stripe invoice ID
 */
export const getInvoiceByStripeId = query({
  args: { stripeInvoiceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoices")
      .withIndex("by_stripeInvoiceId", (q) =>
        q.eq("stripeInvoiceId", args.stripeInvoiceId)
      )
      .first();
  },
});

/**
 * Get subscription with user details
 */
export const getWithUser = query({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) return null;

    const user = await ctx.db.get(subscription.userId);
    return {
      ...subscription,
      user,
    };
  },
});

/**
 * List subscriptions by plan
 */
export const listByPlan = query({
  args: {
    plan: v.union(
      v.literal("FREE"),
      v.literal("STARTER"),
      v.literal("PROFESSIONAL"),
      v.literal("ENTERPRISE")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const subscriptions = await ctx.db
      .query("subscriptions")
      .filter((q) => q.eq(q.field("plan"), args.plan))
      .take(limit);

    return subscriptions;
  },
});

/**
 * List subscriptions by status
 */
export const listByStatus = query({
  args: {
    status: v.union(
      v.literal("ACTIVE"),
      v.literal("CANCELED"),
      v.literal("INCOMPLETE"),
      v.literal("INCOMPLETE_EXPIRED"),
      v.literal("PAST_DUE"),
      v.literal("TRIALING"),
      v.literal("UNPAID"),
      v.literal("PAUSED")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const subscriptions = await ctx.db
      .query("subscriptions")
      .filter((q) => q.eq(q.field("status"), args.status))
      .take(limit);

    return subscriptions;
  },
});

/**
 * Get billing statistics (admin)
 */
export const getBillingStats = query({
  args: {},
  handler: async (ctx) => {
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const invoices = await ctx.db.query("invoices").collect();

    const stats = {
      totalSubscriptions: subscriptions.length,
      byPlan: {
        FREE: 0,
        STARTER: 0,
        PROFESSIONAL: 0,
        ENTERPRISE: 0,
      } as Record<string, number>,
      byStatus: {
        ACTIVE: 0,
        CANCELED: 0,
        TRIALING: 0,
        PAST_DUE: 0,
        OTHER: 0,
      } as Record<string, number>,
      totalRevenue: 0,
      monthlyRevenue: 0,
    };

    for (const sub of subscriptions) {
      // Count by plan
      stats.byPlan[sub.plan] = (stats.byPlan[sub.plan] || 0) + 1;
      
      // Count by status
      if (["ACTIVE", "CANCELED", "TRIALING", "PAST_DUE"].includes(sub.status)) {
        stats.byStatus[sub.status]++;
      } else {
        stats.byStatus.OTHER++;
      }
    }

    // Calculate revenue from paid invoices
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const invoice of invoices) {
      if (invoice.status === "PAID") {
        stats.totalRevenue += invoice.amountPaid;
        if (invoice.paidAt && invoice.paidAt > thirtyDaysAgo) {
          stats.monthlyRevenue += invoice.amountPaid;
        }
      }
    }

    // Convert from cents to dollars
    stats.totalRevenue = stats.totalRevenue / 100;
    stats.monthlyRevenue = stats.monthlyRevenue / 100;

    return stats;
  },
});

/**
 * Check subscription limits
 */
export const checkLimits = query({
  args: { 
    userId: v.id("users"),
    limitType: v.optional(v.union(
      v.literal("tenants"),
      v.literal("iflows"),
      v.literal("teamMembers"),
      v.literal("aiAgentCalls")
    )),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    // Default free tier limits
    const defaultLimits = {
      maxTenants: 1,
      maxIFlows: 10,
      maxTeamMembers: 3,
      maxAIAgentCalls: 100,
    };

    const plan = subscription?.plan || "FREE";
    const limits = subscription ? {
      maxTenants: subscription.maxTenants,
      maxIFlows: subscription.maxIFlows,
      maxTeamMembers: subscription.maxTeamMembers,
      maxAIAgentCalls: subscription.maxAIAgentCalls,
    } : defaultLimits;

    const usage = {
      tenants: subscription?.currentTenantCount ?? 0,
      iFlows: subscription?.currentIFlowCount ?? 0,
      teamMembers: subscription?.currentTeamMemberCount ?? 0,
      aiAgentCalls: subscription?.currentAIAgentCalls ?? 0,
    };

    // If a specific limit type is requested, return that info
    if (args.limitType) {
      const limitMap: Record<string, { current: number; max: number }> = {
        tenants: { current: usage.tenants, max: limits.maxTenants },
        iflows: { current: usage.iFlows, max: limits.maxIFlows },
        teamMembers: { current: usage.teamMembers, max: limits.maxTeamMembers },
        aiAgentCalls: { current: usage.aiAgentCalls, max: limits.maxAIAgentCalls },
      };
      
      const { current, max } = limitMap[args.limitType];
      const allowed = max === -1 || current < max;
      
      return { allowed, current, max, plan };
    }

    return {
      plan,
      limits,
      usage,
      canAddTenant: limits.maxTenants === -1 || usage.tenants < limits.maxTenants,
      canAddIFlow: limits.maxIFlows === -1 || usage.iFlows < limits.maxIFlows,
      canAddTeamMember: limits.maxTeamMembers === -1 || usage.teamMembers < limits.maxTeamMembers,
      canUseAIAgent: limits.maxAIAgentCalls === -1 || usage.aiAgentCalls < limits.maxAIAgentCalls,
    };
  },
});
