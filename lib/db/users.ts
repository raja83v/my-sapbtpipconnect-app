import { db } from "@/lib/db";
import { eq, ne, and, count, ilike, or, sql } from "drizzle-orm";
import {
  users,
  cpiTenants,
  iFlows,
  type UserRole,
  type UserStatus,
} from "@/lib/db/schema";

export async function getUserById(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) }) ?? null;
}

export async function getUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  }) ?? null;
}

export async function createUser(data: {
  email: string;
  name?: string;
  passwordHash: string;
  role?: UserRole;
  image?: string;
}) {
  const [user] = await db
    .insert(users)
    .values({
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash: data.passwordHash,
      role: data.role ?? "user",
      status: "ACTIVE",
      emailVerified: true,
      onboardingCompleted: false,
    })
    .returning();
  return user;
}

export async function updateUser(
  id: string,
  data: Partial<typeof users.$inferInsert>
) {
  const [user] = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return user;
}

export async function deleteUser(id: string) {
  const [user] = await db
    .update(users)
    .set({ status: "DELETED", updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return user;
}

export async function listUsers(options?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: UserStatus;
}) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (options?.status) {
    conditions.push(eq(users.status, options.status));
  }
  if (options?.search) {
    conditions.push(
      or(
        ilike(users.email, `%${options.search}%`),
        ilike(users.name, `%${options.search}%`)
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [userList, [{ total }]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        status: users.status,
        image: users.image,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        onboardingCompleted: users.onboardingCompleted,
      })
      .from(users)
      .where(where)
      .orderBy(sql`${users.createdAt} desc`)
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(users).where(where),
  ]);

  return {
    users: userList,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getUserCount() {
  const [{ total }] = await db
    .select({ total: count() })
    .from(users)
    .where(ne(users.status, "DELETED"));
  return total;
}

export async function getAdminStats() {
  const [totalUsers, activeUsers, totalTenants, totalIFlows] =
    await Promise.all([
      db.select({ c: count() }).from(users).then((r) => r[0].c),
      db.select({ c: count() }).from(users).where(eq(users.status, "ACTIVE")).then((r) => r[0].c),
      db.select({ c: count() }).from(cpiTenants).then((r) => r[0].c),
      db.select({ c: count() }).from(iFlows).then((r) => r[0].c),
    ]);

  return { totalUsers, activeUsers, totalTenants, totalIFlows };
}
