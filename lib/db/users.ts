import { prisma } from "@/lib/db";
import type { Prisma, UserRole, UserStatus } from "@prisma/client";

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function createUser(data: {
  email: string;
  name?: string;
  passwordHash: string;
  role?: UserRole;
  image?: string;
}) {
  return prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash: data.passwordHash,
      role: data.role ?? "user",
      status: "ACTIVE",
      emailVerified: true,
      onboardingCompleted: false,
    },
  });
}

export async function updateUser(
  id: string,
  data: Prisma.UserUpdateInput
) {
  return prisma.user.update({ where: { id }, data });
}

export async function deleteUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { status: "DELETED" },
  });
}

export async function listUsers(options?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: UserStatus;
}) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.UserWhereInput = {};

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.search) {
    where.OR = [
      { email: { contains: options.search, mode: "insensitive" } },
      { name: { contains: options.search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        image: true,
        lastLoginAt: true,
        createdAt: true,
        onboardingCompleted: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getUserCount() {
  return prisma.user.count({ where: { status: { not: "DELETED" } } });
}

export async function getAdminStats() {
  const [totalUsers, activeUsers, totalTenants, totalIFlows] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.cpiTenant.count(),
      prisma.iFlow.count(),
    ]);

  return { totalUsers, activeUsers, totalTenants, totalIFlows };
}
