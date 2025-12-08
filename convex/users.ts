import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get a user by their Clerk ID
 */
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

/**
 * Get a user by their email
 */
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

/**
 * Get a user by their ID
 */
export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get a user by their Stripe customer ID
 */
export const getByStripeCustomerId = query({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_stripeCustomerId", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();
  },
});

/**
 * Get a user by their Stripe subscription ID
 */
export const getByStripeSubscriptionId = query({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_stripeSubscriptionId", (q) => q.eq("stripeSubscriptionId", args.stripeSubscriptionId))
      .first();
  },
});

/**
 * Get all users (admin only - implement auth check in action layer)
 */
export const listAll = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const users = await ctx.db.query("users").take(limit);
    return users;
  },
});

/**
 * Get user count
 */
export const getCount = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.length;
  },
});

/**
 * Get users by status
 */
export const listByStatus = query({
  args: { 
    status: v.union(v.literal("ACTIVE"), v.literal("SUSPENDED"), v.literal("DELETED")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("status"), args.status))
      .take(limit);
    return users;
  },
});

/**
 * Search users by email or name
 */
export const search = query({
  args: { 
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const searchLower = args.searchTerm.toLowerCase();
    
    const allUsers = await ctx.db.query("users").collect();
    
    const filtered = allUsers.filter((user) => {
      const emailMatch = user.email.toLowerCase().includes(searchLower);
      const nameMatch = user.name?.toLowerCase().includes(searchLower) ?? false;
      return emailMatch || nameMatch;
    });
    
    return filtered.slice(0, limit);
  },
});

/**
 * List users for pagination
 */
export const list = query({
  args: { 
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db.query("users").take(limit);
  },
});

/**
 * List recent users (admin)
 */
export const listRecent = query({
  args: { 
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    return await ctx.db.query("users").order("desc").take(limit);
  },
});

/**
 * Get admin dashboard statistics
 */
export const getAdminStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

    const allUsers = await ctx.db.query("users").collect();

    const totalUsers = allUsers.length;
    const newUsersLast30Days = allUsers.filter(
      (u) => u._creationTime >= thirtyDaysAgo
    ).length;
    const newUsersPrevious30Days = allUsers.filter(
      (u) => u._creationTime >= sixtyDaysAgo && u._creationTime < thirtyDaysAgo
    ).length;
    const activeUsers = allUsers.filter(
      (u) => u.lastLoginAt && u.lastLoginAt >= thirtyDaysAgo
    ).length;

    // Calculate user trend
    const userTrend =
      newUsersPrevious30Days === 0
        ? 100
        : ((newUsersLast30Days - newUsersPrevious30Days) /
            newUsersPrevious30Days) *
          100;

    return {
      users: {
        total: totalUsers,
        new: newUsersLast30Days,
        active: activeUsers,
        trend: Math.round(userTrend * 10) / 10,
      },
    };
  },
});

/**
 * Get active sessions for a user
 */
export const getActiveSessions = query({
  args: { 
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);
  },
});
