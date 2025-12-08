import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  authTypeValidator,
  tenantStatusValidator,
  roleValidator,
} from "./schema";

/**
 * Generate a random ID for tokens
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

/**
 * Create a new tenant with owner
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    tenantUrl: v.optional(v.string()),
    image: v.optional(v.string()),
    authType: v.optional(authTypeValidator),
    authenticationUrl: v.optional(v.string()),
    clientId: v.optional(v.string()),
    clientSecret: v.optional(v.string()),
    username: v.optional(v.string()),
    password: v.optional(v.string()),
    status: v.optional(tenantStatusValidator),
    isConnected: v.optional(v.boolean()),
    connectionTestAt: v.optional(v.number()),
    ownerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if slug already exists
    const existingTenant = await ctx.db
      .query("cpiTenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existingTenant) {
      throw new Error("A tenant with this slug already exists");
    }

    // Use url or tenantUrl (for backwards compatibility)
    const tenantUrl = args.url || args.tenantUrl || `https://${args.slug}.example.com`;

    // Create tenant
    const tenantId = await ctx.db.insert("cpiTenants", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      image: args.image,
      tenantUrl: tenantUrl,
      authType: args.authType || "OAUTH",
      authenticationUrl: args.authenticationUrl,
      clientId: args.clientId,
      clientSecret: args.clientSecret, // Should be encrypted before calling
      username: args.username,
      password: args.password, // Should be encrypted before calling
      status: args.status || "ACTIVE",
      isConnected: args.isConnected ?? false,
      connectionTestAt: args.connectionTestAt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Add owner as member
    await ctx.db.insert("tenantMembers", {
      userId: args.ownerId,
      tenantId,
      role: "OWNER",
      joinedAt: Date.now(),
    });

    return tenantId;
  },
});

/**
 * Update a tenant
 */
export const update = mutation({
  args: {
    id: v.id("cpiTenants"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    tenantUrl: v.optional(v.string()),
    authType: v.optional(authTypeValidator),
    authenticationUrl: v.optional(v.string()),
    clientId: v.optional(v.string()),
    clientSecret: v.optional(v.string()),
    username: v.optional(v.string()),
    password: v.optional(v.string()),
    status: v.optional(tenantStatusValidator),
    isConnected: v.optional(v.boolean()),
    lastSyncAt: v.optional(v.number()),
    connectionTestAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // If updating slug, check for uniqueness
    if (updates.slug) {
      const existingTenant = await ctx.db
        .query("cpiTenants")
        .withIndex("by_slug", (q) => q.eq("slug", updates.slug!))
        .first();

      if (existingTenant && existingTenant._id !== id) {
        throw new Error("A tenant with this slug already exists");
      }
    }

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(id, {
        ...filteredUpdates,
        updatedAt: Date.now(),
      });
    }

    return id;
  },
});

/**
 * Delete a tenant and all related data
 */
export const deleteTenant = mutation({
  args: { id: v.id("cpiTenants") },
  handler: async (ctx, args) => {
    // Delete iFlow executions first (via iFlows)
    const iFlows = await ctx.db
      .query("iFlows")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.id))
      .collect();

    for (const iFlow of iFlows) {
      const executions = await ctx.db
        .query("iFlowExecutions")
        .withIndex("by_iFlowId", (q) => q.eq("iFlowId", iFlow._id))
        .collect();
      for (const execution of executions) {
        await ctx.db.delete(execution._id);
      }
      await ctx.db.delete(iFlow._id);
    }

    // Delete tenant members
    const members = await ctx.db
      .query("tenantMembers")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.id))
      .collect();
    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Delete tenant invitations
    const invitations = await ctx.db
      .query("tenantInvitations")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.id))
      .collect();
    for (const invitation of invitations) {
      await ctx.db.delete(invitation._id);
    }

    // Clear default tenant from users
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      if (user.defaultTenantId === args.id) {
        await ctx.db.patch(user._id, { defaultTenantId: undefined });
      }
    }

    // Clear active tenant from sessions
    const sessions = await ctx.db.query("sessions").collect();
    for (const session of sessions) {
      if (session.activeTenantId === args.id) {
        await ctx.db.patch(session._id, { activeTenantId: undefined });
      }
    }

    // Finally delete the tenant
    await ctx.db.delete(args.id);
    return args.id;
  },
});

/**
 * Add a member to a tenant
 */
export const addMember = mutation({
  args: {
    tenantId: v.id("cpiTenants"),
    userId: v.id("users"),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    // Check if already a member
    const existingMember = await ctx.db
      .query("tenantMembers")
      .withIndex("by_userId_tenantId", (q) =>
        q.eq("userId", args.userId).eq("tenantId", args.tenantId)
      )
      .first();

    if (existingMember) {
      throw new Error("User is already a member of this tenant");
    }

    const memberId = await ctx.db.insert("tenantMembers", {
      userId: args.userId,
      tenantId: args.tenantId,
      role: args.role,
      joinedAt: Date.now(),
    });

    return memberId;
  },
});

/**
 * Update member role
 */
export const updateMemberRole = mutation({
  args: {
    memberId: v.id("tenantMembers"),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new Error("Member not found");
    }

    // Check if this is the last owner
    if (member.role === "OWNER" && args.role !== "OWNER") {
      const ownerCount = await ctx.db
        .query("tenantMembers")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", member.tenantId))
        .filter((q) => q.eq(q.field("role"), "OWNER"))
        .collect();

      if (ownerCount.length <= 1) {
        throw new Error("Cannot change role - tenant must have at least one owner");
      }
    }

    await ctx.db.patch(args.memberId, { role: args.role });
    return args.memberId;
  },
});

/**
 * Remove a member from a tenant
 */
export const removeMember = mutation({
  args: { memberId: v.id("tenantMembers") },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new Error("Member not found");
    }

    // Check if this is the last owner
    if (member.role === "OWNER") {
      const ownerCount = await ctx.db
        .query("tenantMembers")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", member.tenantId))
        .filter((q) => q.eq(q.field("role"), "OWNER"))
        .collect();

      if (ownerCount.length <= 1) {
        throw new Error("Cannot remove the last owner from the tenant");
      }
    }

    await ctx.db.delete(args.memberId);
    return args.memberId;
  },
});

/**
 * Create a tenant invitation
 */
export const createInvitation = mutation({
  args: {
    tenantId: v.id("cpiTenants"),
    email: v.string(),
    role: roleValidator,
    invitedById: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if there's already a pending invitation
    const existingInvitation = await ctx.db
      .query("tenantInvitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantId"), args.tenantId),
          q.eq(q.field("acceptedAt"), undefined),
          q.gt(q.field("expiresAt"), Date.now())
        )
      )
      .first();

    if (existingInvitation) {
      throw new Error("An invitation has already been sent to this email");
    }

    // Check if user is already a member
    const users = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (users) {
      const existingMember = await ctx.db
        .query("tenantMembers")
        .withIndex("by_userId_tenantId", (q) =>
          q.eq("userId", users._id).eq("tenantId", args.tenantId)
        )
        .first();

      if (existingMember) {
        throw new Error("This user is already a member of the tenant");
      }
    }

    const token = generateId();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    const invitationId = await ctx.db.insert("tenantInvitations", {
      tenantId: args.tenantId,
      email: args.email,
      role: args.role,
      token,
      invitedById: args.invitedById,
      expiresAt,
    });

    return { id: invitationId, token };
  },
});

/**
 * Accept a tenant invitation
 */
export const acceptInvitation = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("tenantInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      throw new Error("Invalid invitation token");
    }

    if (invitation.expiresAt < Date.now()) {
      throw new Error("This invitation has expired");
    }

    if (invitation.acceptedAt) {
      throw new Error("This invitation has already been accepted");
    }

    // Get user email
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify email matches
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error("This invitation was sent to a different email address");
    }

    // Check if already a member
    const existingMember = await ctx.db
      .query("tenantMembers")
      .withIndex("by_userId_tenantId", (q) =>
        q.eq("userId", args.userId).eq("tenantId", invitation.tenantId)
      )
      .first();

    if (existingMember) {
      throw new Error("You are already a member of this tenant");
    }

    // Create membership
    await ctx.db.insert("tenantMembers", {
      userId: args.userId,
      tenantId: invitation.tenantId,
      role: invitation.role,
      joinedAt: Date.now(),
    });

    // Mark invitation as accepted
    await ctx.db.patch(invitation._id, { acceptedAt: Date.now() });

    return invitation.tenantId;
  },
});

/**
 * Cancel a tenant invitation
 */
export const cancelInvitation = mutation({
  args: { invitationId: v.id("tenantInvitations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.invitationId);
    return args.invitationId;
  },
});

/**
 * Update tenant sync status
 */
export const updateSyncStatus = mutation({
  args: {
    id: v.id("cpiTenants"),
    isConnected: v.boolean(),
    lastSyncAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isConnected: args.isConnected,
      lastSyncAt: args.lastSyncAt ?? (args.isConnected ? Date.now() : undefined),
    });
    return args.id;
  },
});

/**
 * Internal version of update for use by cron jobs
 */
export const updateInternal = internalMutation({
  args: {
    id: v.id("cpiTenants"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    tenantUrl: v.optional(v.string()),
    authType: v.optional(authTypeValidator),
    authenticationUrl: v.optional(v.string()),
    clientId: v.optional(v.string()),
    clientSecret: v.optional(v.string()),
    username: v.optional(v.string()),
    password: v.optional(v.string()),
    status: v.optional(tenantStatusValidator),
    isConnected: v.optional(v.boolean()),
    lastSyncAt: v.optional(v.number()),
    connectionTestAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // If updating slug, check for uniqueness
    if (updates.slug) {
      const existingTenant = await ctx.db
        .query("cpiTenants")
        .withIndex("by_slug", (q) => q.eq("slug", updates.slug!))
        .first();

      if (existingTenant && existingTenant._id !== id) {
        throw new Error("A tenant with this slug already exists");
      }
    }

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(id, {
        ...filteredUpdates,
        updatedAt: Date.now(),
      });
    }

    return id;
  },
});
