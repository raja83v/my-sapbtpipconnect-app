"use server";

import { revalidatePath } from "next/cache";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
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
  const member = await convex.query(api.tenants.getMembership, {
    tenantId: tenantId as any,
    userId: userId as any,
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
    const isMember = await convex.query(api.tenants.checkMembership, {
      tenantId: tenantId as any,
      userId: currentUser.id as any,
    });

    if (!isMember) {
      return { success: false, error: "Access denied" };
    }

    // Get all members
    const members = await convex.query(api.tenants.getMembers, {
      tenantId: tenantId as any,
    });

    const membersWithUser: TenantMemberWithUser[] = members.map((member: any) => ({
      id: member._id,
      role: member.role as TenantMemberWithUser["role"],
      joinedAt: member.joinedAt ? new Date(member.joinedAt) : new Date(member._creationTime),
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
    const member = await convex.query(api.tenants.getMemberById, {
      memberId: validatedData.memberId as any,
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

    // Update role using mutation
    await convex.mutation(api.tenantMutations.updateMemberRole, {
      memberId: validatedData.memberId as any,
      role: validatedData.role,
      currentUserId: currentUser.id as any,
    });

    // Get updated member
    const updatedMember = await convex.query(api.tenants.getMemberById, {
      memberId: validatedData.memberId as any,
    });

    // Revalidate paths
    revalidatePath("/dashboard/settings");

    const memberWithUser: TenantMemberWithUser = {
      id: updatedMember!._id,
      role: updatedMember!.role as TenantMemberWithUser["role"],
      joinedAt: updatedMember!.joinedAt ? new Date(updatedMember!.joinedAt) : new Date(updatedMember!._creationTime),
      user: updatedMember!.user,
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
    const member = await convex.query(api.tenants.getMemberById, {
      memberId: validatedData.memberId as any,
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

    // Remove member using mutation
    await convex.mutation(api.tenantMutations.removeMember, {
      memberId: validatedData.memberId as any,
      currentUserId: currentUser.id as any,
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
