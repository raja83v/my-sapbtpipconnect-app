import { prisma } from "@/lib/db";
import type { Prisma, Role, TenantStatus } from "@prisma/client";

// ============================================================================
// Tenant CRUD
// ============================================================================

export async function getTenantById(id: string) {
  return prisma.cpiTenant.findUnique({ where: { id } });
}

export async function getTenantBySlug(slug: string) {
  return prisma.cpiTenant.findUnique({ where: { slug } });
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
  return prisma.cpiTenant.create({
    data: {
      ...data,
      status: "ACTIVE",
      isConnected: false,
    },
  });
}

export async function updateTenant(
  id: string,
  data: Prisma.CpiTenantUpdateInput
) {
  return prisma.cpiTenant.update({ where: { id }, data });
}

export async function deleteTenant(id: string) {
  return prisma.cpiTenant.delete({ where: { id } });
}

export async function listAllTenants(options?: {
  page?: number;
  pageSize?: number;
  status?: TenantStatus;
}) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const skip = (page - 1) * pageSize;

  const where: Prisma.CpiTenantWhereInput = {};
  if (options?.status) where.status = options.status;

  const [tenants, total] = await Promise.all([
    prisma.cpiTenant.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.cpiTenant.count({ where }),
  ]);

  return { tenants, total };
}

// ============================================================================
// Tenant Members
// ============================================================================

export async function listTenantsForUser(userId: string) {
  const memberships = await prisma.tenantMember.findMany({
    where: { userId },
    include: {
      tenant: true,
    },
    orderBy: { joinedAt: "desc" },
  });

  return memberships.map((m) => ({
    ...m.tenant,
    role: m.role,
    membershipId: m.id,
  }));
}

export async function getMembership(userId: string, tenantId: string) {
  return prisma.tenantMember.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });
}

export async function getMembers(tenantId: string) {
  return prisma.tenantMember.findMany({
    where: { tenantId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          status: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
}

export async function addMember(data: {
  userId: string;
  tenantId: string;
  role: Role;
}) {
  return prisma.tenantMember.create({ data });
}

export async function updateMember(id: string, data: { role: Role }) {
  return prisma.tenantMember.update({
    where: { id },
    data: { role: data.role },
  });
}

export async function removeMember(id: string) {
  return prisma.tenantMember.delete({ where: { id } });
}

export async function getMemberCount(tenantId: string) {
  return prisma.tenantMember.count({ where: { tenantId } });
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
  return prisma.tenantInvitation.create({ data });
}

export async function getInvitationByToken(token: string) {
  return prisma.tenantInvitation.findUnique({
    where: { token },
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getPendingInvitations(tenantId: string) {
  return prisma.tenantInvitation.findMany({
    where: {
      tenantId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      invitedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function acceptInvitation(token: string, userId: string) {
  const invitation = await prisma.tenantInvitation.findUnique({
    where: { token },
  });

  if (!invitation) throw new Error("Invitation not found");
  if (invitation.acceptedAt) throw new Error("Invitation already accepted");
  if (invitation.expiresAt < new Date()) throw new Error("Invitation expired");

  // Use a transaction to accept invitation and add member
  return prisma.$transaction(async (tx) => {
    // Mark invitation as accepted
    await tx.tenantInvitation.update({
      where: { token },
      data: { acceptedAt: new Date() },
    });

    // Add user as member
    const member = await tx.tenantMember.create({
      data: {
        userId,
        tenantId: invitation.tenantId,
        role: invitation.role,
      },
    });

    return member;
  });
}

export async function deleteInvitation(id: string) {
  return prisma.tenantInvitation.delete({ where: { id } });
}

// ============================================================================
// Sync Helpers
// ============================================================================

export async function getTenantsNeedingSync(options?: {
  minTimeSinceSync?: number; // ms
  limit?: number;
}) {
  const minTime = options?.minTimeSinceSync ?? 5 * 60 * 1000; // 5 minutes default
  const cutoff = new Date(Date.now() - minTime);

  return prisma.cpiTenant.findMany({
    where: {
      status: "ACTIVE",
      isConnected: true,
      OR: [
        { lastSyncAt: null },
        { lastSyncAt: { lt: cutoff } },
      ],
    },
    take: options?.limit ?? 10,
    orderBy: { lastSyncAt: "asc" },
  });
}
