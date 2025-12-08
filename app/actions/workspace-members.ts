"use server";

import { revalidatePath } from "next/cache";
import { convex, api } from "@/lib/convex";
import { getCurrentUser } from "./user";
import type { ActionResult } from "@/types/actions";
import type { WorkspaceMemberWithUser } from "@/types/workspace";
import {
  updateMemberRoleSchema,
  removeMemberSchema,
  type UpdateMemberRoleInput,
  type RemoveMemberInput,
} from "@/lib/validations/workspace";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Check if user is workspace admin (OWNER or ADMIN)
 */
async function checkWorkspaceAdmin(
  userId: Id<"users">,
  tenantId: Id<"cpiTenants">
): Promise<ActionResult<boolean>> {
  const member = await convex.query(api.tenants.getMembership, {
    userId,
    tenantId,
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

    const tenantId = workspaceId as Id<"cpiTenants">;

    // Check if user is a member of the tenant
    const isMember = await convex.query(api.tenants.getMembership, {
      userId: currentUser.id,
      tenantId,
    });

    if (!isMember) {
      return { success: false, error: "Access denied" };
    }

    // Get all members
    const members = await convex.query(api.tenants.getMembers, {
      tenantId,
    });

    const membersWithUser: WorkspaceMemberWithUser[] = members.map((member: any) => ({
      id: member.id,
      role: member.role as WorkspaceMemberWithUser["role"],
      joinedAt: new Date(member.joinedAt),
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
    const member = await convex.query(api.tenants.getMemberById, {
      memberId: validatedData.memberId as Id<"tenantMembers">,
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
      const allMembers = await convex.query(api.tenants.getMembers, {
        tenantId: member.tenantId,
      });
      const ownerCount = allMembers.filter((m: any) => m.role === "OWNER").length;

      if (ownerCount <= 1) {
        return {
          success: false,
          error: "Cannot change role - workspace must have at least one owner",
        };
      }
    }

    // Update role
    await convex.mutation(api.tenantMutations.updateMemberRole, {
      memberId: validatedData.memberId as Id<"tenantMembers">,
      role: validatedData.role as "OWNER" | "ADMIN" | "MEMBER",
    });

    // Get updated member
    const updatedMember = await convex.query(api.tenants.getMemberById, {
      memberId: validatedData.memberId as Id<"tenantMembers">,
    });

    if (!updatedMember) {
      return { success: false, error: "Failed to update member" };
    }

    // Revalidate paths
    revalidatePath("/dashboard/settings");

    const memberWithUser: WorkspaceMemberWithUser = {
      id: updatedMember.id,
      role: updatedMember.role as WorkspaceMemberWithUser["role"],
      joinedAt: new Date(updatedMember.joinedAt),
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
    const member = await convex.query(api.tenants.getMemberById, {
      memberId: validatedData.memberId as Id<"tenantMembers">,
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
      const allMembers = await convex.query(api.tenants.getMembers, {
        tenantId: member.tenantId,
      });
      const ownerCount = allMembers.filter((m: any) => m.role === "OWNER").length;

      if (ownerCount <= 1) {
        return {
          success: false,
          error: "Cannot remove the last owner from the workspace",
        };
      }
    }

    // Remove member
    await convex.mutation(api.tenantMutations.removeMember, {
      memberId: validatedData.memberId as Id<"tenantMembers">,
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
