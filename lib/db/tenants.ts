import { db } from "@/lib/db";
import { eq, and, count, isNull, gt, lt, or, sql, asc, desc } from "drizzle-orm";
import {
  cpiTenants,
  tenantMembers,
  tenantInvitations,
  users,
  type Role,
  type TenantStatus,
} from "@/lib/db/schema";

// ============================================================================
// Tenant CRUD
// ============================================================================

export async function getTenantById(id: string) {
  return db.query.cpiTenants.findFirst({ where: eq(cpiTenants.id, id) }) ?? null;
}

export async function getTenantBySlug(slug: string) {
  return db.query.cpiTenants.findFirst({ where: eq(cpiTenants.slug, slug) }) ?? null;
}

export async function createTenant(data: {
  name: string;
  slug: string;
  description?: string;
  tenantUrl: string;
  authType: "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY";
  authenticationUrl?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
}) {
  const [tenant] = await db
    .insert(cpiTenants)
    .values({
      ...data,
      status: "ACTIVE",
      isConnected: false,
      updatedAt: new Date(),
    })
    .returning();
  return tenant;
}

export async function updateTenant(
  id: string,
  data: Partial<typeof cpiTenants.$inferInsert>
) {
  const [tenant] = await db
    .update(cpiTenants)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(cpiTenants.id, id))
    .returning();
  return tenant;
}

export async function deleteTenant(id: string) {
  const [tenant] = await db
    .delete(cpiTenants)
    .where(eq(cpiTenants.id, id))
    .returning();
  return tenant;
}

export async function listAllTenants(options?: {
  page?: number;
  pageSize?: number;
  status?: TenantStatus;
}) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const where = options?.status ? eq(cpiTenants.status, options.status) : undefined;

  const [tenants, [{ total }]] = await Promise.all([
    db
      .select()
      .from(cpiTenants)
      .where(where)
      .orderBy(desc(cpiTenants.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(cpiTenants).where(where),
  ]);

  return { tenants, total };
}

// ============================================================================
// Tenant Members
// ============================================================================

export async function listTenantsForUser(userId: string) {
  const memberships = await db.query.tenantMembers.findMany({
    where: eq(tenantMembers.userId, userId),
    with: { tenant: true },
    orderBy: desc(tenantMembers.joinedAt),
  });

  return memberships.map((m) => ({
    ...m.tenant,
    role: m.role,
    membershipId: m.id,
  }));
}

export async function getMembership(userId: string, tenantId: string) {
  return db.query.tenantMembers.findFirst({
    where: and(
      eq(tenantMembers.userId, userId),
      eq(tenantMembers.tenantId, tenantId)
    ),
  }) ?? null;
}

export async function getMembers(tenantId: string) {
  return db.query.tenantMembers.findMany({
    where: eq(tenantMembers.tenantId, tenantId),
    with: {
      user: {
        columns: {
          id: true,
          email: true,
          name: true,
          image: true,
          status: true,
        },
      },
    },
    orderBy: asc(tenantMembers.joinedAt),
  });
}

export async function addMember(data: {
  userId: string;
  tenantId: string;
  role: Role;
}) {
  const [member] = await db
    .insert(tenantMembers)
    .values(data)
    .returning();
  return member;
}

export async function updateMember(id: string, data: { role: Role }) {
  const [member] = await db
    .update(tenantMembers)
    .set({ role: data.role })
    .where(eq(tenantMembers.id, id))
    .returning();
  return member;
}

export async function removeMember(id: string) {
  const [member] = await db
    .delete(tenantMembers)
    .where(eq(tenantMembers.id, id))
    .returning();
  return member;
}

export async function getMemberCount(tenantId: string) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(tenantMembers)
    .where(eq(tenantMembers.tenantId, tenantId));
  return total;
}

// ============================================================================
// Tenant Invitations
// ============================================================================

export async function createInvitation(data: {
  email: string;
  role: Role;
  tenantId: string;
  invitedById: string;
  expiresAt: Date;
}) {
  const [invitation] = await db
    .insert(tenantInvitations)
    .values(data)
    .returning();
  return invitation;
}

export async function getInvitationByToken(token: string) {
  return db.query.tenantInvitations.findFirst({
    where: eq(tenantInvitations.token, token),
    with: {
      tenant: { columns: { id: true, name: true, slug: true } },
      invitedBy: { columns: { id: true, name: true, email: true } },
    },
  }) ?? null;
}

export async function getPendingInvitations(tenantId: string) {
  return db.query.tenantInvitations.findMany({
    where: and(
      eq(tenantInvitations.tenantId, tenantId),
      isNull(tenantInvitations.acceptedAt),
      gt(tenantInvitations.expiresAt, new Date())
    ),
    with: {
      invitedBy: { columns: { id: true, name: true, email: true } },
    },
    orderBy: desc(tenantInvitations.createdAt),
  });
}

export async function acceptInvitation(token: string, userId: string) {
  const invitation = await db.query.tenantInvitations.findFirst({
    where: eq(tenantInvitations.token, token),
  });

  if (!invitation) throw new Error("Invitation not found");
  if (invitation.acceptedAt) throw new Error("Invitation already accepted");
  if (invitation.expiresAt < new Date()) throw new Error("Invitation expired");

  return db.transaction(async (tx) => {
    await tx
      .update(tenantInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(tenantInvitations.token, token));

    const [member] = await tx
      .insert(tenantMembers)
      .values({
        userId,
        tenantId: invitation.tenantId,
        role: invitation.role,
      })
      .returning();

    return member;
  });
}

export async function deleteInvitation(id: string) {
  const [invitation] = await db
    .delete(tenantInvitations)
    .where(eq(tenantInvitations.id, id))
    .returning();
  return invitation;
}

// ============================================================================
// Sync Helpers
// ============================================================================

export async function getTenantsNeedingSync(options?: {
  minTimeSinceSync?: number;
  limit?: number;
}) {
  const minTime = options?.minTimeSinceSync ?? 5 * 60 * 1000;
  const cutoff = new Date(Date.now() - minTime);

  return db
    .select()
    .from(cpiTenants)
    .where(
      and(
        eq(cpiTenants.status, "ACTIVE"),
        eq(cpiTenants.isConnected, true),
        or(
          isNull(cpiTenants.lastSyncAt),
          lt(cpiTenants.lastSyncAt, cutoff)
        )
      )
    )
    .orderBy(asc(cpiTenants.lastSyncAt))
    .limit(options?.limit ?? 10);
}
