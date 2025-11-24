"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
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
 */
export async function getCurrentWorkspace(): Promise<ActionResult<WorkspaceWithRole>> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get user's first workspace (they must be a member)
    const member = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      include: {
        workspace: true,
      },
      orderBy: { joinedAt: "asc" },
    });

    if (!member) {
      return { success: false, error: "No workspace found" };
    }

    const workspaceWithRole: WorkspaceWithRole = {
      id: member.workspace.id,
      name: member.workspace.name,
      slug: member.workspace.slug,
      image: member.workspace.image,
      memberRole: member.role as WorkspaceWithRole["memberRole"],
      createdAt: member.workspace.createdAt,
      updatedAt: member.workspace.updatedAt,
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
 */
export async function updateWorkspace(
  input: UpdateWorkspaceInput
): Promise<ActionResult<WorkspaceWithRole>> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = updateWorkspaceSchema.parse(input);

    // Check if user is OWNER or ADMIN of this workspace
    const member = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: session.user.id,
          workspaceId: validatedData.id,
        },
      },
      select: { role: true },
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return {
        success: false,
        error: "Workspace admin access required",
      };
    }

    // Check if slug is already taken (if changing slug)
    if (validatedData.slug) {
      const existingWorkspace = await prisma.workspace.findUnique({
        where: { slug: validatedData.slug },
        select: { id: true },
      });

      if (existingWorkspace && existingWorkspace.id !== validatedData.id) {
        return {
          success: false,
          error: "This slug is already taken",
        };
      }
    }

    // Update workspace
    const workspace = await prisma.workspace.update({
      where: { id: validatedData.id },
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Revalidate paths
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");

    const workspaceWithRole: WorkspaceWithRole = {
      ...workspace,
      memberRole: member.role as WorkspaceWithRole["memberRole"],
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
 * User will be added as OWNER and workspace set as default
 */
export async function createUserWorkspace(
  input: CreateWorkspaceInput
): Promise<ActionResult<WorkspaceWithRole>> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = createWorkspaceSchema.parse(input);

    // Check if workspace with slug already exists
    const existingWorkspace = await prisma.workspace.findUnique({
      where: { slug: validatedData.slug },
    });

    if (existingWorkspace) {
      return {
        success: false,
        error: "Workspace with this slug already exists",
      };
    }

    // Create workspace with user as owner and set as default
    const workspace = await prisma.workspace.create({
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
        image: validatedData.image || null,
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
        defaultForUsers: {
          connect: { id: session.user.id },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Revalidate paths
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");

    const workspaceWithRole: WorkspaceWithRole = {
      ...workspace,
      memberRole: "OWNER",
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
