"use server";

import { revalidatePath } from "next/cache";
import { convex, api } from "@/lib/convex";
import { getCurrentUser } from "./user";
import type { ActionResult } from "@/types/actions";
import type { WorkspaceWithRole } from "@/types/workspace";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
} from "@/lib/validations/workspace";

/**
 * Get the current user's default workspace with their role
 * Note: In the new tenant-based architecture, this returns the user's primary tenant
 */
export async function getCurrentWorkspace(): Promise<ActionResult<WorkspaceWithRole>> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get user's first tenant membership
    const member = await convex.query(api.tenants.getFirstMembershipForUser, {
      userId: user.id,
    });

    if (!member) {
      return { success: false, error: "No workspace found" };
    }

    const workspaceWithRole: WorkspaceWithRole = {
      id: member.tenant._id,
      name: member.tenant.name,
      slug: member.tenant.slug || member.tenant._id,
      image: member.tenant.image || null,
      memberRole: member.role as WorkspaceWithRole["memberRole"],
      createdAt: new Date(member.tenant.createdAt),
      updatedAt: new Date(member.tenant.updatedAt),
    };

    return { success: true, data: workspaceWithRole };
  } catch (error) {
    console.error("Error getting current workspace:", error);
    return { success: false, error: "Failed to load workspace" };
  }
}

/**
 * Update workspace settings (name, slug)
 * Requires OWNER or ADMIN role
 * Note: In new architecture, this updates a tenant
 */
export async function updateWorkspace(
  input: UpdateWorkspaceInput
): Promise<ActionResult<WorkspaceWithRole>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = updateWorkspaceSchema.parse(input);

    // Check if user is OWNER or ADMIN of this tenant
    const member = await convex.query(api.tenants.getMembership, {
      userId: currentUser.id,
      tenantId: validatedData.id as any,
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return {
        success: false,
        error: "Workspace admin access required",
      };
    }

    // Check if slug is already taken (if changing slug)
    if (validatedData.slug) {
      const existingTenant = await convex.query(api.tenants.getBySlug, {
        slug: validatedData.slug,
      });

      if (existingTenant && existingTenant._id !== validatedData.id) {
        return {
          success: false,
          error: "This slug is already taken",
        };
      }
    }

    // Update tenant
    await convex.mutation(api.tenantMutations.update, {
      id: validatedData.id as any,
      name: validatedData.name,
      slug: validatedData.slug,
    });

    // Get updated tenant
    const updatedTenant = await convex.query(api.tenants.getById, {
      id: validatedData.id as any,
    });

    if (!updatedTenant) {
      return { success: false, error: "Tenant not found after update" };
    }

    // Revalidate paths
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");

    const workspaceWithRole: WorkspaceWithRole = {
      id: updatedTenant._id,
      name: updatedTenant.name,
      slug: updatedTenant.slug || updatedTenant._id,
      image: updatedTenant.image || null,
      memberRole: member.role as WorkspaceWithRole["memberRole"],
      createdAt: new Date(updatedTenant.createdAt),
      updatedAt: new Date(updatedTenant.updatedAt),
    };

    return { success: true, data: workspaceWithRole };
  } catch (error) {
    console.error("Error updating workspace:", error);
    return {
      success: false,
      error: "Failed to update workspace. Please try again.",
    };
  }
}

/**
 * Create a new workspace for the current user
 * User will be added as OWNER
 * Note: In new architecture, this creates a tenant
 */
export async function createUserWorkspace(
  input: CreateWorkspaceInput
): Promise<ActionResult<WorkspaceWithRole>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = createWorkspaceSchema.parse(input);

    // Check if tenant with slug already exists
    const existingTenant = await convex.query(api.tenants.getBySlug, {
      slug: validatedData.slug,
    });

    if (existingTenant) {
      return {
        success: false,
        error: "Workspace with this slug already exists",
      };
    }

    // Create tenant with user as owner
    const tenantId = await convex.mutation(api.tenantMutations.create, {
      name: validatedData.name,
      url: `https://${validatedData.slug}.example.com`, // Placeholder URL
      slug: validatedData.slug,
      image: validatedData.image || undefined,
      ownerId: currentUser.id,
    });

    // Get the created tenant
    const tenant = await convex.query(api.tenants.getById, {
      id: tenantId,
    });

    if (!tenant) {
      return { success: false, error: "Failed to create workspace" };
    }

    // Revalidate paths
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");

    const workspaceWithRole: WorkspaceWithRole = {
      id: tenant._id,
      name: tenant.name,
      slug: tenant.slug || tenant._id,
      image: tenant.image || null,
      memberRole: "OWNER",
      createdAt: new Date(tenant.createdAt),
      updatedAt: new Date(tenant.updatedAt),
    };

    return { success: true, data: workspaceWithRole };
  } catch (error: any) {
    console.error("Error creating workspace:", error);

    if (error.name === "ZodError") {
      return {
        success: false,
        error: error.errors[0]?.message ?? "Validation failed",
      };
    }

    return { success: false, error: "Failed to create workspace" };
  }
}
