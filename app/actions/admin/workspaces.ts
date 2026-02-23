"use server";

import { getCurrentUser } from "../user";
import { prisma } from "@/lib/db";
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
    const where: any = {};

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { slug: { contains: params.search, mode: "insensitive" } },
      ];
    }

    // Build orderBy
    const orderBy: any = {};
    if (params?.sortBy) {
      orderBy[params.sortBy] = params.sortOrder || "asc";
    } else {
      orderBy.createdAt = "desc";
    }

    const [tenants, total] = await Promise.all([
      prisma.cpiTenant.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          _count: {
            select: {
              members: true,
              invitations: true,
            },
          },
        },
      }),
      prisma.cpiTenant.count({ where }),
    ]);

    const pageCount = Math.ceil(total / pageSize);

    return {
      success: true,
      data: {
        workspaces: tenants.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          image: tenant.image || null,
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
          _count: {
            members: tenant._count.members,
            invitations: tenant._count.invitations,
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
    const tenant = await prisma.cpiTenant.findUnique({
      where: { id },
      include: {
        members: {
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
        },
        _count: {
          select: { invitations: true },
        },
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
          invitations: tenant._count.invitations,
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
    const existingTenant = await prisma.cpiTenant.findUnique({
      where: { slug: validatedData.slug },
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
    const tenant = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.cpiTenant.create({
        data: {
          name: validatedData.name,
          slug: validatedData.slug,
          tenantUrl: "https://placeholder.example.com", // Admin-created tenants need manual configuration
          authType: "OAUTH",
          status: "ACTIVE",
        },
      });

      // Add current user as OWNER
      await tx.tenantMember.create({
        data: {
          userId: currentUser.id,
          tenantId: newTenant.id,
          role: "OWNER",
        },
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
    const existingTenant = await prisma.cpiTenant.findUnique({
      where: { id: validatedData.id },
    });

    if (!existingTenant) {
      return { success: false, error: "Tenant not found" };
    }

    // If slug is being updated, check for conflicts
    if (validatedData.slug && validatedData.slug !== existingTenant.slug) {
      const slugConflict = await prisma.cpiTenant.findUnique({
        where: { slug: validatedData.slug },
      });

      if (slugConflict) {
        return { success: false, error: "Slug already in use" };
      }
    }

    // Update tenant
    const tenant = await prisma.cpiTenant.update({
      where: { id: validatedData.id },
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

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
        _count: {
          members: tenant._count.members,
        },
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
    const existingTenant = await prisma.cpiTenant.findUnique({
      where: { id: validatedData.id },
    });

    if (!existingTenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Delete tenant (cascade will handle members, invitations, iflows, etc.)
    await prisma.cpiTenant.delete({
      where: { id: validatedData.id },
    });

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
