"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
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
  workspaceId: string
): Promise<ActionResult<boolean>> {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
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

  return { success: true, data: true };
}

/**
 * Get all members of a workspace
 */
export async function getWorkspaceMembers(
  workspaceId: string
): Promise<ActionResult<WorkspaceMemberWithUser[]>> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if user is a member of the workspace
    const isMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: session.user.id,
          workspaceId,
        },
      },
    });

    if (!isMember) {
      return { success: false, error: "Access denied" };
    }

    // Get all members
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
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
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = updateMemberRoleSchema.parse(input);

    // Get member info
    const member = await prisma.workspaceMember.findUnique({
      where: { id: validatedData.memberId },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        role: true,
      },
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Check workspace admin permission
    const adminCheck = await checkWorkspaceAdmin(
      session.user.id,
      member.workspaceId
    );
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error };
    }

    // Prevent changing own role
    if (member.userId === session.user.id) {
      return {
        success: false,
        error: "You cannot change your own role",
      };
    }

    // Prevent removing the last OWNER
    if (member.role === "OWNER" && validatedData.role !== "OWNER") {
      const ownerCount = await prisma.workspaceMember.count({
        where: {
          workspaceId: member.workspaceId,
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
    const updatedMember = await prisma.workspaceMember.update({
      where: { id: validatedData.memberId },
      data: { role: validatedData.role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
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
 * Remove a member from the workspace
 * Requires OWNER or ADMIN permission
 */
export async function removeMember(
  input: RemoveMemberInput
): Promise<ActionResult<void>> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = removeMemberSchema.parse(input);

    // Get member info
    const member = await prisma.workspaceMember.findUnique({
      where: { id: validatedData.memberId },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        role: true,
      },
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Check workspace admin permission
    const adminCheck = await checkWorkspaceAdmin(
      session.user.id,
      member.workspaceId
    );
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error };
    }

    // Prevent removing self
    if (member.userId === session.user.id) {
      return {
        success: false,
        error: "You cannot remove yourself from the workspace",
      };
    }

    // Prevent removing the last OWNER
    if (member.role === "OWNER") {
      const ownerCount = await prisma.workspaceMember.count({
        where: {
          workspaceId: member.workspaceId,
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
    await prisma.workspaceMember.delete({
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
