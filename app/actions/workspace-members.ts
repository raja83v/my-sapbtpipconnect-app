"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "./user";
import type { ActionResult } from "@/types/actions";
import type { WorkspaceMemberWithUser } from "@/types/workspace";
import {
  updateMemberRoleSchema,
  removeMemberSchema,
  type UpdateMemberRoleInput,
  type RemoveMemberInput,
} from "@/lib/validations/workspace";

/**
 * Check if user is workspace admin (OWNER or ADMIN)
 */
async function checkWorkspaceAdmin(
  userId: string,
  tenantId: string
): Promise<ActionResult<boolean>> {
  const member = await prisma.tenantMember.findUnique({
    where: {
      userId_tenantId: { userId, tenantId },
    },
  });

  if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
    return {
      success: false,
      error: "Workspace admin access required",
    };
  }

  return { success: true, data: true };
}

/**
 * Get all members of a workspace (tenant)
 */
export async function getWorkspaceMembers(
  workspaceId: string
): Promise<ActionResult<WorkspaceMemberWithUser[]>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if user is a member of the tenant
    const isMember = await prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: {
          userId: currentUser.id,
          tenantId: workspaceId,
        },
      },
    });

    if (!isMember) {
      return { success: false, error: "Access denied" };
    }

    // Get all members with user info
    const members = await prisma.tenantMember.findMany({
      where: { tenantId: workspaceId },
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
      orderBy: { joinedAt: "asc" },
    });

    const membersWithUser: WorkspaceMemberWithUser[] = members.map((member) => ({
      id: member.id,
      role: member.role as WorkspaceMemberWithUser["role"],
      joinedAt: member.joinedAt,
      user: member.user,
    }));

    return { success: true, data: membersWithUser };
  } catch (error) {
    console.error("Error getting workspace members:", error);
    return {
      success: false,
      error: "Failed to load members",
    };
  }
}

/**
 * Update a member's role
 * Requires OWNER or ADMIN permission
 */
export async function updateMemberRole(
  input: UpdateMemberRoleInput
): Promise<ActionResult<WorkspaceMemberWithUser>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = updateMemberRoleSchema.parse(input);

    // Get member info
    const member = await prisma.tenantMember.findUnique({
      where: { id: validatedData.memberId },
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
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Check workspace admin permission
    const adminCheck = await checkWorkspaceAdmin(
      currentUser.id,
      member.tenantId
    );
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error };
    }

    // Prevent changing own role
    if (member.userId === currentUser.id) {
      return {
        success: false,
        error: "You cannot change your own role",
      };
    }

    // Prevent removing the last OWNER
    if (member.role === "OWNER" && validatedData.role !== "OWNER") {
      const ownerCount = await prisma.tenantMember.count({
        where: {
          tenantId: member.tenantId,
          role: "OWNER",
        },
      });

      if (ownerCount <= 1) {
        return {
          success: false,
          error: "Cannot change role - workspace must have at least one owner",
        };
      }
    }

    // Update role
    const updatedMember = await prisma.tenantMember.update({
      where: { id: validatedData.memberId },
      data: { role: validatedData.role as "OWNER" | "ADMIN" | "MEMBER" },
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
    });

    // Revalidate paths
    revalidatePath("/dashboard/settings");

    const memberWithUser: WorkspaceMemberWithUser = {
      id: updatedMember.id,
      role: updatedMember.role as WorkspaceMemberWithUser["role"],
      joinedAt: updatedMember.joinedAt,
      user: updatedMember.user,
    };

    return { success: true, data: memberWithUser };
  } catch (error) {
    console.error("Error updating member role:", error);
    return {
      success: false,
      error: "Failed to update role. Please try again.",
    };
  }
}

/**
 * Remove a member from the workspace (tenant)
 * Requires OWNER or ADMIN permission
 */
export async function removeMember(
  input: RemoveMemberInput
): Promise<ActionResult<void>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = removeMemberSchema.parse(input);

    // Get member info
    const member = await prisma.tenantMember.findUnique({
      where: { id: validatedData.memberId },
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Check workspace admin permission
    const adminCheck = await checkWorkspaceAdmin(
      currentUser.id,
      member.tenantId
    );
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error };
    }

    // Prevent removing self
    if (member.userId === currentUser.id) {
      return {
        success: false,
        error: "You cannot remove yourself from the workspace",
      };
    }

    // Prevent removing the last OWNER
    if (member.role === "OWNER") {
      const ownerCount = await prisma.tenantMember.count({
        where: {
          tenantId: member.tenantId,
          role: "OWNER",
        },
      });

      if (ownerCount <= 1) {
        return {
          success: false,
          error: "Cannot remove the last owner from the workspace",
        };
      }
    }

    // Remove member
    await prisma.tenantMember.delete({
      where: { id: validatedData.memberId },
    });

    // Revalidate paths
    revalidatePath("/dashboard/settings");

    return { success: true };
  } catch (error) {
    console.error("Error removing member:", error);
    return {
      success: false,
      error: "Failed to remove member. Please try again.",
    };
  }
}
