"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { cpiTenants, tenantMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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
    const member = await db.query.tenantMembers.findFirst({
      where: eq(tenantMembers.userId, user.id),
      with: { tenant: true },
      orderBy: (tenantMembers, { asc }) => [asc(tenantMembers.joinedAt)],
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
    const member = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, currentUser.id),
        eq(tenantMembers.tenantId, validatedData.id),
      ),
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return {
        success: false,
        error: "Workspace admin access required",
      };
    }

    // Check if slug is already taken (if changing slug)
    if (validatedData.slug) {
      const existingTenant = await db.query.cpiTenants.findFirst({
        where: eq(cpiTenants.slug, validatedData.slug),
      });

      if (existingTenant && existingTenant.id !== validatedData.id) {
        return {
          success: false,
          error: "This slug is already taken",
        };
      }
    }

    // Update tenant
    const [updatedTenant] = await db.update(cpiTenants).set({
      name: validatedData.name,
      slug: validatedData.slug,
    }).where(eq(cpiTenants.id, validatedData.id)).returning();

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
    const existingTenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.slug, validatedData.slug),
    });

    if (existingTenant) {
      return {
        success: false,
        error: "Workspace with this slug already exists",
      };
    }

    // Create tenant with user as owner in a transaction
    const tenant = await db.transaction(async (tx) => {
      const [newTenant] = await tx.insert(cpiTenants).values({
          name: validatedData.name,
          tenantUrl: `https://${validatedData.slug}.example.com`, // Placeholder URL
          slug: validatedData.slug,
          image: validatedData.image || undefined,
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
