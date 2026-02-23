"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
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
    const member = await prisma.tenantMember.findFirst({
      where: { userId: user.id },
      include: { tenant: true },
      orderBy: { joinedAt: "asc" },
    });

    if (!member) {
      return { success: false, error: "No workspace found" };
    }

    const workspaceWithRole: WorkspaceWithRole = {
      id: member.tenant.id,
      name: member.tenant.name,
      slug: member.tenant.slug || member.tenant.id,
      image: member.tenant.image || null,
      memberRole: member.role as WorkspaceWithRole["memberRole"],
      createdAt: member.tenant.createdAt,
      updatedAt: member.tenant.updatedAt,
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
    const member = await prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: {
          userId: currentUser.id,
          tenantId: validatedData.id,
        },
      },
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return {
        success: false,
        error: "Workspace admin access required",
      };
    }

    // Check if slug is already taken (if changing slug)
    if (validatedData.slug) {
      const existingTenant = await prisma.cpiTenant.findUnique({
        where: { slug: validatedData.slug },
      });

      if (existingTenant && existingTenant.id !== validatedData.id) {
        return {
          success: false,
          error: "This slug is already taken",
        };
      }
    }

    // Update tenant
    const updatedTenant = await prisma.cpiTenant.update({
      where: { id: validatedData.id },
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
      },
    });

    // Revalidate paths
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");

    const workspaceWithRole: WorkspaceWithRole = {
      id: updatedTenant.id,
      name: updatedTenant.name,
      slug: updatedTenant.slug || updatedTenant.id,
      image: updatedTenant.image || null,
      memberRole: member.role as WorkspaceWithRole["memberRole"],
      createdAt: updatedTenant.createdAt,
      updatedAt: updatedTenant.updatedAt,
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
    const existingTenant = await prisma.cpiTenant.findUnique({
      where: { slug: validatedData.slug },
    });

    if (existingTenant) {
      return {
        success: false,
        error: "Workspace with this slug already exists",
      };
    }

    // Create tenant with user as owner in a transaction
    const tenant = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.cpiTenant.create({
        data: {
          name: validatedData.name,
          tenantUrl: `https://${validatedData.slug}.example.com`, // Placeholder URL
          slug: validatedData.slug,
          image: validatedData.image || undefined,
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

    // Revalidate paths
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");

    const workspaceWithRole: WorkspaceWithRole = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug || tenant.id,
      image: tenant.image || null,
      memberRole: "OWNER",
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
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
