import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get a tenant by ID
 */
export const getById = query({
  args: { id: v.id("cpiTenants") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get a tenant by slug
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cpiTenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

/**
 * Get all tenants for a user
 */
export const listForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get all tenant memberships for this user
    const memberships = await ctx.db
      .query("tenantMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Fetch tenant details for each membership
    const tenantsWithRole = await Promise.all(
      memberships.map(async (membership) => {
        const tenant = await ctx.db.get(membership.tenantId);
        if (!tenant) return null;
        return {
          ...tenant,
          memberRole: membership.role,
          joinedAt: membership.joinedAt,
        };
      })
    );

    return tenantsWithRole.filter((t) => t !== null);
  },
});

/**
 * Get tenant with members
 */
export const getWithMembers = query({
  args: { tenantId: v.id("cpiTenants") },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;

    const memberships = await ctx.db
      .query("tenantMembers")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const membersWithUser = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        return {
          id: membership._id,
          role: membership.role,
          joinedAt: membership.joinedAt,
          user: user
            ? {
                id: user._id,
                email: user.email,
                name: user.name,
                image: user.image,
              }
            : null,
        };
      })
    );

    return {
      ...tenant,
      members: membersWithUser.filter((m) => m.user !== null),
    };
  },
});

/**
 * Get all tenants by status
 */
export const listByStatus = query({
  args: {
    status: v.union(
      v.literal("ACTIVE"),
      v.literal("INACTIVE"),
      v.literal("TESTING"),
      v.literal("ERROR")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("cpiTenants")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .take(limit);
  },
});

/**
 * List all tenants (admin only)
 */
export const listAll = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db.query("cpiTenants").take(limit);
  },
});

/**
 * Get tenant count
 */
export const getCount = query({
  args: {},
  handler: async (ctx) => {
    const tenants = await ctx.db.query("cpiTenants").collect();
    return tenants.length;
  },
});

/**
 * List recent tenants (admin)
 */
export const listRecent = query({
  args: { 
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    return await ctx.db.query("cpiTenants").order("desc").take(limit);
  },
});

/**
 * Check if user is tenant member
 */
export const checkMembership = query({
  args: {
    userId: v.id("users"),
    tenantId: v.id("cpiTenants"),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("tenantMembers")
      .withIndex("by_userId_tenantId", (q) =>
        q.eq("userId", args.userId).eq("tenantId", args.tenantId)
      )
      .first();

    return membership;
  },
});

/**
 * Get membership - alias for checkMembership for consistency
 */
export const getMembership = query({
  args: {
    userId: v.id("users"),
    tenantId: v.id("cpiTenants"),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("tenantMembers")
      .withIndex("by_userId_tenantId", (q) =>
        q.eq("userId", args.userId).eq("tenantId", args.tenantId)
      )
      .first();

    return membership;
  },
});

/**
 * Get tenant members
 */
export const getMembers = query({
  args: { tenantId: v.id("cpiTenants") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("tenantMembers")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const membersWithUser = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        return {
          ...membership,
          id: membership._id,
          role: membership.role,
          joinedAt: membership.joinedAt,
          user: user
            ? {
                id: user._id,
                email: user.email,
                name: user.name,
                image: user.image,
              }
            : null,
        };
      })
    );

    return membersWithUser.filter((m) => m.user !== null);
  },
});

/**
 * Get a single member by ID
 */
export const getMemberById = query({
  args: { memberId: v.id("tenantMembers") },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.memberId);
    if (!membership) return null;

    const user = await ctx.db.get(membership.userId);
    
    return {
      ...membership,
      id: membership._id,
      role: membership.role,
      joinedAt: membership.joinedAt,
      user: user
        ? {
            id: user._id,
            email: user.email,
            name: user.name,
            image: user.image,
          }
        : null,
    };
  },
});

/**
 * Get pending invitations for a tenant
 */
export const getPendingInvitations = query({
  args: { tenantId: v.id("cpiTenants") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const invitations = await ctx.db
      .query("tenantInvitations")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) =>
        q.and(
          q.eq(q.field("acceptedAt"), undefined),
          q.gt(q.field("expiresAt"), now)
        )
      )
      .collect();

    const invitationsWithInviter = await Promise.all(
      invitations.map(async (inv) => {
        const inviter = await ctx.db.get(inv.invitedById);
        return {
          id: inv._id,
          email: inv.email,
          role: inv.role,
          token: inv.token,
          expiresAt: inv.expiresAt,
          createdAt: inv._creationTime,
          invitedBy: inviter
            ? {
                id: inviter._id,
                name: inviter.name,
                email: inviter.email,
              }
            : null,
        };
      })
    );

    return invitationsWithInviter;
  },
});

/**
 * Get invitation by token
 */
export const getInvitationByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("tenantInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) return null;

    const tenant = await ctx.db.get(invitation.tenantId);
    const inviter = await ctx.db.get(invitation.invitedById);

    return {
      ...invitation,
      tenant,
      invitedBy: inviter,
    };
  },
});

// Get invitation by ID
export const getInvitationById = query({
  args: {
    invitationId: v.id("tenantInvitations"),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) return null;

    const tenant = await ctx.db.get(invitation.tenantId);
    const inviter = await ctx.db.get(invitation.invitedById);

    return {
      ...invitation,
      tenant,
      invitedBy: inviter,
    };
  },
});

/**
 * Get first tenant membership for a user
 */
export const getFirstMembershipForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("tenantMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!membership) return null;

    const tenant = await ctx.db.get(membership.tenantId);
    if (!tenant) return null;

    return {
      ...membership,
      tenant,
    };
  },
});

// Get tenants that need syncing for cron job
export const getTenantsNeedingSync = query({
  args: {
    minSyncTime: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all active OAuth tenants with required credentials
    const allTenants = await ctx.db
      .query("cpiTenants")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "ACTIVE"),
          q.eq(q.field("authType"), "OAUTH"),
          q.neq(q.field("clientId"), undefined),
          q.neq(q.field("clientSecret"), undefined),
          q.neq(q.field("authenticationUrl"), undefined)
        )
      )
      .collect();

    // Filter for tenants needing sync
    const tenantsNeedingSync = allTenants
      .filter((tenant) => {
        return !tenant.lastSyncAt || tenant.lastSyncAt < args.minSyncTime;
      })
      // Sort by lastSyncAt (null first, then oldest first)
      .sort((a, b) => {
        if (!a.lastSyncAt && !b.lastSyncAt) return 0;
        if (!a.lastSyncAt) return -1;
        if (!b.lastSyncAt) return 1;
        return a.lastSyncAt - b.lastSyncAt;
      })
      .slice(0, args.limit);

    return tenantsNeedingSync;
  },
});
