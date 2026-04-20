"use server";

import { getCurrentUser } from "../user";
import { db } from "@/lib/db";
import { cpiTenants, tenantMembers, tenantInvitations, users } from "@/lib/db/schema";
import { eq, or, ilike, count, desc, asc } from "drizzle-orm";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  deleteWorkspaceSchema,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
  type DeleteWorkspaceInput,
} from "@/lib/validations/workspace";
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

// Get paginated tenants (formerly workspaces) with search, sort, and filters
export async function getWorkspaces(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<ActionResult<{ workspaces: any[]; total: number; pageCount: number }>> {
  const authCheck = await checkAdmin();
  if (!authCheck.success) return { success: false, error: authCheck.error };

  try {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const whereConditions = params?.search
      ? or(
          ilike(cpiTenants.name, `%${params.search}%`),
          ilike(cpiTenants.slug, `%${params.search}%`),
        )
      : undefined;

    // Build orderBy
    const orderByClause = params?.sortBy
      ? (params.sortOrder === "desc" ? desc(cpiTenants[params.sortBy as keyof typeof cpiTenants._.columns] as any) : asc(cpiTenants[params.sortBy as keyof typeof cpiTenants._.columns] as any))
      : desc(cpiTenants.createdAt);

    const [tenantsResult, totalResult] = await Promise.all([
      db.query.cpiTenants.findMany({
        where: whereConditions,
        offset: skip,
        limit: pageSize,
        orderBy: () => [orderByClause],
        with: {
          members: { columns: { id: true } },
          invitations: { columns: { id: true } },
        },
      }),
      db.select({ c: count() }).from(cpiTenants).where(whereConditions).then(r => r[0].c),
    ]);

    const total = totalResult;
    const pageCount = Math.ceil(total / pageSize);

    return {
      success: true,
      data: {
        workspaces: tenantsResult.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          image: tenant.image || null,
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
          _count: {
            members: tenant.members.length,
            invitations: tenant.invitations.length,
          },
        })),
        total,
        pageCount,
      },
    };
  } catch (error) {
    console.error("Error fetching tenants:", error);
    return { success: false, error: "Failed to fetch tenants" };
  }
}

// Get single tenant by ID
export async function getWorkspaceById(id: string): Promise<ActionResult<any>> {
  const authCheck = await checkAdmin();
  if (!authCheck.success) return { success: false, error: authCheck.error };

  try {
    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, id),
      with: {
        members: {
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
        },
        invitations: { columns: { id: true } },
      },
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    return {
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        image: tenant.image || null,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        members: tenant.members.map((m) => ({
          id: m.id,
          role: m.role,
          joinedAt: m.joinedAt,
          user: m.user,
        })),
        _count: {
          invitations: tenant.invitations.length,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching tenant:", error);
    return { success: false, error: "Failed to fetch tenant" };
  }
}

// Create a new tenant (formerly workspace)
export async function createWorkspace(input: CreateWorkspaceInput): Promise<ActionResult<any>> {
  const authCheck = await checkAdmin();
  if (!authCheck.success) return { success: false, error: authCheck.error };

  try {
    // Validate input
    const validatedData = createWorkspaceSchema.parse(input);

    // Check if tenant with slug already exists
    const existingTenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.slug, validatedData.slug),
    });

    if (existingTenant) {
      return { success: false, error: "Tenant with this slug already exists" };
    }

    // Get current user to add as owner
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "User session not found" };
    }

    // Create tenant with creator as owner in a transaction
    const tenant = await db.transaction(async (tx) => {
      const [newTenant] = await tx.insert(cpiTenants).values({
          name: validatedData.name,
          slug: validatedData.slug,
          tenantUrl: "https://placeholder.example.com", // Admin-created tenants need manual configuration
          authType: "OAUTH",
          status: "ACTIVE",
      }).returning();

      // Add current user as OWNER
      await tx.insert(tenantMembers).values({
          userId: currentUser.id,
          tenantId: newTenant.id,
          role: "OWNER",
      });

      return newTenant;
    });

    revalidatePath("/admin/workspaces");

    return {
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        image: tenant.image || null,
        createdAt: tenant.createdAt,
        _count: {
          members: 1,
        },
      },
    };
  } catch (error: any) {
    console.error("Error creating tenant:", error);

    if (error.name === "ZodError") {
      return { success: false, error: error.errors[0]?.message ?? "Validation failed" };
    }

    return { success: false, error: "Failed to create tenant" };
  }
}

// Update a tenant
export async function updateWorkspace(input: UpdateWorkspaceInput): Promise<ActionResult<any>> {
  const authCheck = await checkAdmin();
  if (!authCheck.success) return { success: false, error: authCheck.error };

  try {
    // Validate input
    const validatedData = updateWorkspaceSchema.parse(input);

    // Check if tenant exists
    const existingTenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, validatedData.id),
    });

    if (!existingTenant) {
      return { success: false, error: "Tenant not found" };
    }

    // If slug is being updated, check for conflicts
    if (validatedData.slug && validatedData.slug !== existingTenant.slug) {
      const slugConflict = await db.query.cpiTenants.findFirst({
        where: eq(cpiTenants.slug, validatedData.slug),
      });

      if (slugConflict) {
        return { success: false, error: "Slug already in use" };
      }
    }

    // Update tenant
    const [tenant] = await db.update(cpiTenants).set({
      name: validatedData.name,
      slug: validatedData.slug,
    }).where(eq(cpiTenants.id, validatedData.id)).returning();

    revalidatePath("/admin/workspaces");
    revalidatePath(`/admin/workspaces/${validatedData.id}`);

    return {
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        image: tenant.image || null,
        updatedAt: tenant.updatedAt,
      },
    };
  } catch (error: any) {
    console.error("Error updating tenant:", error);

    if (error.name === "ZodError") {
      return { success: false, error: error.errors[0]?.message ?? "Validation failed" };
    }

    return { success: false, error: "Failed to update tenant" };
  }
}

// Delete a tenant
export async function deleteWorkspace(input: DeleteWorkspaceInput): Promise<ActionResult> {
  const authCheck = await checkAdmin();
  if (!authCheck.success) return { success: false, error: authCheck.error };

  try {
    // Validate input
    const validatedData = deleteWorkspaceSchema.parse(input);

    // Check if tenant exists
    const existingTenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, validatedData.id),
    });

    if (!existingTenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Delete tenant (cascade will handle members, invitations, iflows, etc.)
    await db.delete(cpiTenants).where(eq(cpiTenants.id, validatedData.id));

    revalidatePath("/admin/workspaces");

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting tenant:", error);

    if (error.name === "ZodError") {
      return { success: false, error: error.errors[0]?.message ?? "Validation failed" };
    }

    return { success: false, error: "Failed to delete tenant" };
  }
}
