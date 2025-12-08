"use server";

import { getCurrentUser } from "../user";
import { convex, api } from "@/lib/convex";
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
import { Id } from "@/convex/_generated/dataModel";

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

    // Get all tenants
    let tenants = await convex.query(api.tenants.listAll, { limit: 1000 });

    // Apply search filter
    if (params?.search) {
      const searchLower = params.search.toLowerCase();
      tenants = tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.slug.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    if (params?.sortBy) {
      tenants.sort((a, b) => {
        const aVal = a[params.sortBy as keyof typeof a];
        const bVal = b[params.sortBy as keyof typeof b];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        const comparison = aVal < bVal ? -1 : 1;
        return params.sortOrder === "desc" ? -comparison : comparison;
      });
    } else {
      tenants.sort((a, b) => b._creationTime - a._creationTime);
    }

    const total = tenants.length;
    const pageCount = Math.ceil(total / pageSize);

    // Apply pagination
    const skip = (page - 1) * pageSize;
    const paginatedTenants = tenants.slice(skip, skip + pageSize);

    // Get member and invitation counts
    const workspacesWithCounts = await Promise.all(
      paginatedTenants.map(async (tenant) => {
        const members = await convex.query(api.tenants.getMembers, { 
          tenantId: tenant._id 
        });
        const invitations = await convex.query(api.tenants.getPendingInvitations, { 
          tenantId: tenant._id 
        });
        return {
          id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          image: null, // Tenants don't have images in this schema
          createdAt: new Date(tenant._creationTime),
          updatedAt: new Date(tenant._creationTime),
          _count: {
            members: members.length,
            invitations: invitations.length,
          },
        };
      })
    );

    return {
      success: true,
      data: { workspaces: workspacesWithCounts, total, pageCount },
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
    const tenant = await convex.query(api.tenants.getWithMembers, { 
      tenantId: id as Id<"cpiTenants">
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    const invitations = await convex.query(api.tenants.getPendingInvitations, { 
      tenantId: id as Id<"cpiTenants">
    });

    return { 
      success: true, 
      data: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        image: null,
        createdAt: new Date(tenant._creationTime),
        updatedAt: new Date(tenant._creationTime),
        members: tenant.members,
        _count: {
          invitations: invitations.length,
        },
      }
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
    const existingTenant = await convex.query(api.tenants.getBySlug, { 
      slug: validatedData.slug 
    });

    if (existingTenant) {
      return { success: false, error: "Tenant with this slug already exists" };
    }

    // Get current user to add as owner
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "User session not found" };
    }

    // Create tenant with creator as owner
    // Note: This requires tenant URL and auth type - for admin creation, use defaults
    const tenantId = await convex.mutation(api.tenantMutations.create, {
      name: validatedData.name,
      slug: validatedData.slug,
      tenantUrl: "https://placeholder.example.com", // Admin-created tenants need manual configuration
      authType: "OAUTH",
      ownerId: currentUser.id as Id<"users">,
    });

    const tenant = await convex.query(api.tenants.getById, { id: tenantId });

    revalidatePath("/admin/workspaces");

    return { 
      success: true, 
      data: {
        id: tenant?._id,
        name: tenant?.name,
        slug: tenant?.slug,
        image: null,
        createdAt: tenant ? new Date(tenant._creationTime) : new Date(),
        _count: {
          members: 1,
        },
      }
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
    const existingTenant = await convex.query(api.tenants.getById, { 
      id: validatedData.id as Id<"cpiTenants">
    });

    if (!existingTenant) {
      return { success: false, error: "Tenant not found" };
    }

    // If slug is being updated, check for conflicts
    if (validatedData.slug && validatedData.slug !== existingTenant.slug) {
      const slugConflict = await convex.query(api.tenants.getBySlug, { 
        slug: validatedData.slug 
      });

      if (slugConflict) {
        return { success: false, error: "Slug already in use" };
      }
    }

    // Update tenant
    await convex.mutation(api.tenantMutations.update, {
      id: validatedData.id as Id<"cpiTenants">,
      name: validatedData.name,
      slug: validatedData.slug,
    });

    const members = await convex.query(api.tenants.getMembers, { 
      tenantId: validatedData.id as Id<"cpiTenants">
    });

    const tenant = await convex.query(api.tenants.getById, { 
      id: validatedData.id as Id<"cpiTenants">
    });

    revalidatePath("/admin/workspaces");
    revalidatePath(`/admin/workspaces/${validatedData.id}`);

    return { 
      success: true, 
      data: {
        id: tenant?._id,
        name: tenant?.name,
        slug: tenant?.slug,
        image: null,
        updatedAt: new Date(),
        _count: {
          members: members.length,
        },
      }
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
    const existingTenant = await convex.query(api.tenants.getById, { 
      id: validatedData.id as Id<"cpiTenants">
    });

    if (!existingTenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Delete tenant (this will cascade delete members, invitations, iflows, etc.)
    await convex.mutation(api.tenantMutations.deleteTenant, { 
      id: validatedData.id as Id<"cpiTenants">
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
