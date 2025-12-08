import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  userRoleValidator,
  userStatusValidator,
} from "./schema";

/**
 * Create a new user
 */
export const create = mutation({
  args: {
    clerkId: v.optional(v.string()),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.optional(userRoleValidator),
    image: v.optional(v.string()),
    phone: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check if user with email already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Check if Clerk ID already exists
    if (args.clerkId) {
      const existingClerkUser = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
        .first();

      if (existingClerkUser) {
        throw new Error("User with this Clerk ID already exists");
      }
    }

    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      role: args.role ?? "user",
      status: "ACTIVE",
      emailVerified: args.emailVerified ?? false,
      image: args.image,
      phone: args.phone,
      onboardingCompleted: false,
    });

    return userId;
  },
});

/**
 * Update a user
 */
export const update = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    phone: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    role: v.optional(userRoleValidator),
    status: v.optional(userStatusValidator),
    onboardingCompleted: v.optional(v.boolean()),
    onboardingData: v.optional(v.any()),
    lastLoginAt: v.optional(v.number()),
    banned: v.optional(v.boolean()),
    banReason: v.optional(v.string()),
    banExpires: v.optional(v.number()),
    defaultTenantId: v.optional(v.id("cpiTenants")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length === 0) {
      return id;
    }

    await ctx.db.patch(id, filteredUpdates);
    return id;
  },
});

/**
 * Update Stripe info for a user
 */
export const updateStripeInfo = mutation({
  args: {
    id: v.id("users"),
    stripeCustomerId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripeCurrentPeriodEnd: v.optional(v.number()),
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
 * Delete a user (soft delete by setting status to DELETED)
 */
export const softDelete = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "DELETED" });
    return args.id;
  },
});

/**
 * Hard delete a user (actually removes from database)
 */
export const hardDelete = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    // Delete related records first
    // Sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.id))
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    // Accounts
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_userId", (q) => q.eq("userId", args.id))
      .collect();
    for (const account of accounts) {
      await ctx.db.delete(account._id);
    }

    // Tenant memberships
    const memberships = await ctx.db
      .query("tenantMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.id))
      .collect();
    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
    }

    // AI Agent executions
    const aiExecutions = await ctx.db
      .query("aiAgentExecutions")
      .withIndex("by_userId", (q) => q.eq("userId", args.id))
      .collect();
    for (const execution of aiExecutions) {
      await ctx.db.delete(execution._id);
    }

    // Subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.id))
      .first();
    if (subscription) {
      await ctx.db.delete(subscription._id);
    }

    // Invoices
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_userId", (q) => q.eq("userId", args.id))
      .collect();
    for (const invoice of invoices) {
      await ctx.db.delete(invoice._id);
    }

    // Finally delete the user
    await ctx.db.delete(args.id);
    return args.id;
  },
});

/**
 * Find or create user by Clerk ID
 */
export const findOrCreateByClerkId = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Try to find by Clerk ID first
    const existingByClerkId = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingByClerkId) {
      // Update user info if changed
      await ctx.db.patch(existingByClerkId._id, {
        email: args.email,
        name: args.name,
        image: args.image,
        lastLoginAt: Date.now(),
      });
      return existingByClerkId._id;
    }

    // Try to find by email and link Clerk ID
    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingByEmail) {
      await ctx.db.patch(existingByEmail._id, {
        clerkId: args.clerkId,
        name: args.name ?? existingByEmail.name,
        image: args.image ?? existingByEmail.image,
        lastLoginAt: Date.now(),
      });
      return existingByEmail._id;
    }

    // Check if this is the first user (make them admin)
    const userCount = await ctx.db.query("users").collect();
    const isFirstUser = userCount.length === 0;

    // Create new user
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      image: args.image,
      role: isFirstUser ? "admin" : "user",
      status: "ACTIVE",
      emailVerified: args.emailVerified ?? true, // Clerk handles email verification
      onboardingCompleted: false,
      lastLoginAt: Date.now(),
    });

    return userId;
  },
});

/**
 * Set default tenant for user
 */
export const setDefaultTenant = mutation({
  args: {
    userId: v.id("users"),
    tenantId: v.id("cpiTenants"),
  },
  handler: async (ctx, args) => {
    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify tenant exists and user is a member
    const membership = await ctx.db
      .query("tenantMembers")
      .withIndex("by_userId_tenantId", (q) =>
        q.eq("userId", args.userId).eq("tenantId", args.tenantId)
      )
      .first();

    if (!membership) {
      throw new Error("User is not a member of this tenant");
    }

    await ctx.db.patch(args.userId, { defaultTenantId: args.tenantId });
    return args.userId;
  },
});

/**
 * Complete onboarding
 */
export const completeOnboarding = mutation({
  args: {
    userId: v.id("users"),
    onboardingData: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      onboardingCompleted: true,
      onboardingData: args.onboardingData,
    });
    return args.userId;
  },
});
