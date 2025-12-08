"use server";

import { getCurrentUser } from "../user";
import { convex, api } from "@/lib/convex";
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
import { Id } from "@/convex/_generated/dataModel";

// Helper to check if user is admin
async function checkAdmin(): Promise<ActionResult<boolean>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized - Not authenticated" };
    }

    const user = await convex.query(api.users.getById, { 
      id: currentUser.id as Id<"users">
    });

    if (user?.role !== "admin") {
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

    // Get all users and filter in memory (Convex doesn't have complex querying like Prisma)
    let users = await convex.query(api.users.listAll, { limit: 1000 });

    // Apply search filter
    if (params?.search) {
      const searchLower = params.search.toLowerCase();
      users = users.filter(
        (u) =>
          u.email.toLowerCase().includes(searchLower) ||
          u.name?.toLowerCase().includes(searchLower)
      );
    }

    // Apply role filter
    if (params?.role) {
      users = users.filter((u) => u.role === params.role);
    }

    // Apply status filter
    if (params?.status) {
      users = users.filter((u) => u.status === params.status);
    }

    // Apply sorting
    if (params?.sortBy) {
      users.sort((a, b) => {
        const aVal = a[params.sortBy as keyof typeof a];
        const bVal = b[params.sortBy as keyof typeof b];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        const comparison = aVal < bVal ? -1 : 1;
        return params.sortOrder === "desc" ? -comparison : comparison;
      });
    } else {
      // Default sort by creation time desc
      users.sort((a, b) => b._creationTime - a._creationTime);
    }

    const total = users.length;
    const pageCount = Math.ceil(total / pageSize);

    // Apply pagination
    const skip = (page - 1) * pageSize;
    const paginatedUsers = users.slice(skip, skip + pageSize);

    // Get tenant membership count for each user
    const usersWithCounts = await Promise.all(
      paginatedUsers.map(async (user) => {
        const memberships = await convex.query(api.tenants.listForUser, { 
          userId: user._id 
        });
        return {
          id: user._id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          status: user.status,
          phone: user.phone,
          emailVerified: user.emailVerified,
          lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
          createdAt: new Date(user._creationTime),
          updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(user._creationTime),
          _count: {
            tenants: memberships.length,
          },
        };
      })
    );

    return {
      success: true,
      data: { users: usersWithCounts, total, pageCount },
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
    const user = await convex.query(api.users.getById, { 
      id: id as Id<"users">
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Get tenant memberships
    const memberships = await convex.query(api.tenants.listForUser, { 
      userId: user._id 
    });

    return { 
      success: true, 
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        status: user.status,
        phone: user.phone,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
        createdAt: new Date(user._creationTime),
        updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(user._creationTime),
        tenants: memberships.map((m) => ({
          id: m._id,
          role: m.memberRole,
          tenant: {
            id: m._id,
            name: m.name,
            slug: m.slug,
          },
        })),
      }
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
    const existingUser = await convex.query(api.users.getByEmail, { 
      email: validatedData.email 
    });

    if (existingUser) {
      return { success: false, error: "User with this email already exists" };
    }

    // Create user
    const userId = await convex.mutation(api.userMutations.create, {
      email: validatedData.email,
      name: validatedData.name || undefined,
      role: (validatedData.role?.toLowerCase() ?? "user") as "user" | "admin",
      status: (validatedData.status ?? "ACTIVE") as "ACTIVE" | "SUSPENDED" | "DELETED",
      phone: validatedData.phone || undefined,
      image: validatedData.image || undefined,
    });

    const user = await convex.query(api.users.getById, { id: userId });

    revalidatePath("/admin/users");

    return { 
      success: true, 
      data: {
        id: user?._id,
        email: user?.email,
        name: user?.name,
        image: user?.image,
        role: user?.role,
        status: user?.status,
        phone: user?.phone,
        createdAt: user ? new Date(user._creationTime) : new Date(),
      }
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
    const existingUser = await convex.query(api.users.getById, { 
      id: validatedData.id as Id<"users">
    });

    if (!existingUser) {
      return { success: false, error: "User not found" };
    }

    // If email is being updated, check for conflicts
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailConflict = await convex.query(api.users.getByEmail, { 
        email: validatedData.email 
      });

      if (emailConflict) {
        return { success: false, error: "Email already in use" };
      }
    }

    // Update user
    await convex.mutation(api.userMutations.update, {
      id: validatedData.id as Id<"users">,
      email: validatedData.email,
      name: validatedData.name,
      role: validatedData.role?.toLowerCase() as "user" | "admin" | undefined,
      status: validatedData.status as "ACTIVE" | "SUSPENDED" | "DELETED" | undefined,
      phone: validatedData.phone || undefined,
      image: validatedData.image || undefined,
    });

    const user = await convex.query(api.users.getById, { 
      id: validatedData.id as Id<"users">
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${validatedData.id}`);

    return { 
      success: true, 
      data: {
        id: user?._id,
        email: user?.email,
        name: user?.name,
        image: user?.image,
        role: user?.role,
        status: user?.status,
        phone: user?.phone,
        updatedAt: user?.updatedAt ? new Date(user.updatedAt) : new Date(),
      }
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
    const existingUser = await convex.query(api.users.getById, { 
      id: validatedData.id as Id<"users">
    });

    if (!existingUser) {
      return { success: false, error: "User not found" };
    }

    // Prevent deleting the current user
    const currentUser = await getCurrentUser();

    if (currentUser?.id === validatedData.id) {
      return { success: false, error: "Cannot delete your own account" };
    }

    // Delete user
    await convex.mutation(api.userMutations.deleteUser, { 
      id: validatedData.id as Id<"users">
    });

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
