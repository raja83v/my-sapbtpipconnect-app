"use server";

import { getCurrentUser } from "../user";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, tenantMembers } from "@/lib/db/schema";
import { eq, and, or, count, desc, asc, ilike, inArray } from "drizzle-orm";
import {
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type DeleteUserInput,
} from "@/lib/validations/user";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";

// Helper to check if user is admin
async function checkAdmin(): Promise<ActionResult<boolean>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized - Not authenticated" };
    }

    if (currentUser.role !== "admin") {
      return { success: false, error: "Unauthorized - Admin access required" };
    }

    return { success: true, data: true };
  } catch (error) {
    console.error("Error checking admin status:", error);
    return { success: false, error: "Failed to verify permissions" };
  }
}

// Get paginated users with search, sort, and filters
export async function getUsers(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  role?: string;
  status?: string;
}): Promise<ActionResult<{ users: any[]; total: number; pageCount: number }>> {
  const authCheck = await checkAdmin();
  if (!authCheck.success) return { success: false, error: authCheck.error };

  try {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const conditions: any[] = [];

    if (params?.search) {
      conditions.push(
        or(
          ilike(users.email, `%${params.search}%`),
          ilike(users.name, `%${params.search}%`)
        )
      );
    }

    if (params?.role) {
      conditions.push(eq(users.role, params.role as any));
    }

    if (params?.status) {
      conditions.push(eq(users.status, params.status as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Build orderBy
    const sortMap: Record<string, any> = {
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    };
    const sortCol = sortMap[params?.sortBy || "createdAt"] || users.createdAt;
    const orderByClause = params?.sortOrder === "asc" ? asc(sortCol) : desc(sortCol);

    const [usersList, [{ c: total }]] = await Promise.all([
      db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(pageSize)
        .offset(skip),
      db.select({ c: count() }).from(users).where(whereClause),
    ]);

    // Get tenant counts for these users
    const userIds = usersList.map(u => u.id);
    const tenantCounts = userIds.length > 0
      ? await db
          .select({ userId: tenantMembers.userId, c: count() })
          .from(tenantMembers)
          .where(inArray(tenantMembers.userId, userIds))
          .groupBy(tenantMembers.userId)
      : [];
    const tenantCountMap = new Map(tenantCounts.map(tc => [tc.userId, Number(tc.c)]));

    const pageCount = Math.ceil(total / pageSize);

    return {
      success: true,
      data: {
        users: usersList.map((user) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          status: user.status,
          phone: user.phone,
          emailVerified: user.emailVerified,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          _count: {
            tenants: tenantCountMap.get(user.id) ?? 0,
          },
        })),
        total,
        pageCount,
      },
    };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { success: false, error: "Failed to fetch users" };
  }
}

// Get single user by ID
export async function getUserById(id: string): Promise<ActionResult<any>> {
  const authCheck = await checkAdmin();
  if (!authCheck.success) return { success: false, error: authCheck.error };

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        tenants: {
          with: {
            tenant: {
              columns: { id: true, name: true, slug: true },
            },
          },
        },
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        status: user.status,
        phone: user.phone,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        tenants: user.tenants.map((m) => ({
          id: m.id,
          role: m.role,
          tenant: m.tenant,
        })),
      },
    };
  } catch (error) {
    console.error("Error fetching user:", error);
    return { success: false, error: "Failed to fetch user" };
  }
}

// Create a new user
export async function createUser(input: CreateUserInput): Promise<ActionResult<any>> {
  const authCheck = await checkAdmin();
  if (!authCheck.success) return { success: false, error: authCheck.error };

  try {
    // Validate input
    const validatedData = createUserSchema.parse(input);

    // Check if user with email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, validatedData.email),
    });

    if (existingUser) {
      return { success: false, error: "User with this email already exists" };
    }

    // Create user via BetterAuth (creates user + account with hashed password).
    // Default password is "changeme123!" — admins should rotate via reset email.
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: validatedData.email,
        password: "changeme123!",
        name: validatedData.name || validatedData.email.split("@")[0],
      },
    });

    if (!signUpResult?.user?.id) {
      return { success: false, error: "Failed to create authentication user" };
    }

    // Apply admin-controlled fields
    const [user] = await db
      .update(users)
      .set({
        role: (validatedData.role?.toLowerCase() ?? "user") as "user" | "admin",
        status: (validatedData.status ?? "ACTIVE") as
          | "ACTIVE"
          | "SUSPENDED"
          | "DELETED",
        phone: validatedData.phone || undefined,
        image: validatedData.image || undefined,
        emailVerified: true,
      })
      .where(eq(users.id, signUpResult.user.id))
      .returning();

    revalidatePath("/admin/users");

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        status: user.status,
        phone: user.phone,
        createdAt: user.createdAt,
      },
    };
  } catch (error: any) {
    console.error("Error creating user:", error);

    if (error.name === "ZodError") {
      return { success: false, error: error.errors[0]?.message ?? "Validation failed" };
    }

    return { success: false, error: "Failed to create user" };
  }
}

// Update a user
export async function updateUser(input: UpdateUserInput): Promise<ActionResult<any>> {
  const authCheck = await checkAdmin();
  if (!authCheck.success) return { success: false, error: authCheck.error };

  try {
    // Validate input
    const validatedData = updateUserSchema.parse(input);

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, validatedData.id),
    });

    if (!existingUser) {
      return { success: false, error: "User not found" };
    }

    // If email is being updated, check for conflicts
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailConflict = await db.query.users.findFirst({
        where: eq(users.email, validatedData.email),
      });

      if (emailConflict) {
        return { success: false, error: "Email already in use" };
      }
    }

    // Build update data
    const updateData: any = {};
    if (validatedData.email) updateData.email = validatedData.email;
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.role) updateData.role = validatedData.role.toLowerCase();
    if (validatedData.status) updateData.status = validatedData.status;
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone || null;
    if (validatedData.image !== undefined) updateData.image = validatedData.image || null;

    const [user] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, validatedData.id))
      .returning();

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${validatedData.id}`);

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        status: user.status,
        phone: user.phone,
        updatedAt: user.updatedAt,
      },
    };
  } catch (error: any) {
    console.error("Error updating user:", error);

    if (error.name === "ZodError") {
      return { success: false, error: error.errors[0]?.message ?? "Validation failed" };
    }

    return { success: false, error: "Failed to update user" };
  }
}

// Delete a user
export async function deleteUser(input: DeleteUserInput): Promise<ActionResult> {
  const authCheck = await checkAdmin();
  if (!authCheck.success) return { success: false, error: authCheck.error };

  try {
    // Validate input
    const validatedData = deleteUserSchema.parse(input);

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, validatedData.id),
    });

    if (!existingUser) {
      return { success: false, error: "User not found" };
    }

    // Prevent deleting the current user
    const currentUser = await getCurrentUser();

    if (currentUser?.id === validatedData.id) {
      return { success: false, error: "Cannot delete your own account" };
    }

    // Delete user (cascade will handle related records)
    await db.delete(users).where(eq(users.id, validatedData.id));

    revalidatePath("/admin/users");

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting user:", error);

    if (error.name === "ZodError") {
      return { success: false, error: error.errors[0]?.message ?? "Validation failed" };
    }

    return { success: false, error: "Failed to delete user" };
  }
}
