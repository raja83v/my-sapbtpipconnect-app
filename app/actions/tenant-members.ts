"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "./user";
import type { ActionResult } from "@/types/actions";
import type { TenantMemberWithUser } from "@/types/workspace";
import {
  updateMemberRoleSchema,
  removeMemberSchema,
  type UpdateMemberRoleInput,
  type RemoveMemberInput,
} from "@/lib/validations/workspace";

/**
 * Check if user is tenant admin (OWNER or ADMIN)
 */
async function checkTenantAdmin(
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
      error: "Tenant admin access required",
    };
  }

  return { success: true, data: true };
}

/**
 * Get all members of a tenant
 */
export async function getTenantMembers(
  tenantId: string
): Promise<ActionResult<TenantMemberWithUser[]>> {
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
          tenantId,
        },
      },
    });

    if (!isMember) {
      return { success: false, error: "Access denied" };
    }

    // Get all members with user info
    const members = await prisma.tenantMember.findMany({
      where: { tenantId },
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

    const membersWithUser: TenantMemberWithUser[] = members.map((member) => ({
      id: member.id,
      role: member.role as TenantMemberWithUser["role"],
      joinedAt: member.joinedAt,
      user: member.user,
    }));

    return { success: true, data: membersWithUser };
  } catch (error) {
    console.error("Error getting tenant members:", error);
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
): Promise<ActionResult<TenantMemberWithUser>> {
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

    // Check tenant admin permission
    const adminCheck = await checkTenantAdmin(
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

    const memberWithUser: TenantMemberWithUser = {
      id: updatedMember.id,
      role: updatedMember.role as TenantMemberWithUser["role"],
      joinedAt: updatedMember.joinedAt,
      user: updatedMember.user,
    };

    return { success: true, data: memberWithUser };
  } catch (error: any) {
    console.error("Error updating member role:", error);
    return {
      success: false,
      error: error.message || "Failed to update role. Please try again.",
    };
  }
}

/**
 * Remove a member from the tenant
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

    // Check tenant admin permission
    const adminCheck = await checkTenantAdmin(
      currentUser.id,
      member.tenantId
    );
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error };
    }

    // Remove member
    await prisma.tenantMember.delete({
      where: { id: validatedData.memberId },
    });

    // Revalidate paths
    revalidatePath("/dashboard/settings");

    return { success: true };
  } catch (error: any) {
    console.error("Error removing member:", error);
    return {
      success: false,
      error: error.message || "Failed to remove member. Please try again.",
    };
  }
}

// Legacy aliases - these map to the same underlying tenant operations
export const getWorkspaceMembers = getTenantMembers;
