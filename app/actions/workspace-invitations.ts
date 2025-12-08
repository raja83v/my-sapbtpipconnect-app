"use server";

import { revalidatePath } from "next/cache";
import { convex, api } from "@/lib/convex";
import { getCurrentUser } from "./user";
import type { ActionResult } from "@/types/actions";
import type { PendingInvitation } from "@/types/workspace";
import {
  inviteMemberSchema,
  cancelInvitationSchema,
  acceptInvitationSchema,
  type InviteMemberInput,
  type CancelInvitationInput,
  type AcceptInvitationInput,
} from "@/lib/validations/workspace";
import { sendWorkspaceInvitationEmail } from "./email";
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
 * Invite a member to the workspace (tenant) via email
 */
export async function inviteMember(
  input: InviteMemberInput
): Promise<ActionResult<PendingInvitation>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = inviteMemberSchema.parse(input);
    const tenantId = validatedData.workspaceId as Id<"cpiTenants">;

    // Check workspace admin permission
    const adminCheck = await checkWorkspaceAdmin(currentUser.id, tenantId);
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error };
    }

    // Check if user is already a member
    const existingUser = await convex.query(api.users.getByEmail, {
      email: validatedData.email,
    });

    if (existingUser) {
      const existingMember = await convex.query(api.tenants.getMembership, {
        userId: existingUser._id,
        tenantId,
      });

      if (existingMember) {
        return {
          success: false,
          error: "This user is already a member of the workspace",
        };
      }
    }

    // Get tenant details
    const tenant = await convex.query(api.tenants.getById, { id: tenantId });
    if (!tenant) {
      return { success: false, error: "Workspace not found" };
    }

    // Get inviter details
    const inviter = await convex.query(api.users.getById, { id: currentUser.id });
    if (!inviter) {
      return { success: false, error: "Inviter not found" };
    }

    // Create invitation
    const result = await convex.mutation(api.tenantMutations.createInvitation, {
      tenantId,
      email: validatedData.email,
      role: validatedData.role as "OWNER" | "ADMIN" | "MEMBER",
      invitedById: currentUser.id,
    });

    // Send invitation email
    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invitation?token=${result.token}`;

    await sendWorkspaceInvitationEmail(
      {
        inviterName: inviter.name || inviter.email,
        workspaceName: tenant.name,
        inviteeEmail: validatedData.email,
        acceptUrl,
      },
      validatedData.email
    );

    // Revalidate paths
    revalidatePath("/dashboard/settings");

    const pendingInvitation: PendingInvitation = {
      id: result.id,
      email: validatedData.email,
      role: validatedData.role as PendingInvitation["role"],
      token: result.token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      invitedBy: {
        id: inviter._id,
        name: inviter.name || null,
        email: inviter.email,
      },
    };

    return { success: true, data: pendingInvitation };
  } catch (error: any) {
    console.error("Error inviting member:", error);
    return {
      success: false,
      error: error.message || "Failed to send invitation. Please try again.",
    };
  }
}

/**
 * Get pending invitations for a workspace (tenant)
 */
export async function getPendingInvitations(
  workspaceId: string
): Promise<ActionResult<PendingInvitation[]>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    const tenantId = workspaceId as Id<"cpiTenants">;

    // Check workspace admin permission
    const adminCheck = await checkWorkspaceAdmin(currentUser.id, tenantId);
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error };
    }

    // Get pending invitations
    const invitations = await convex.query(api.tenants.getPendingInvitations, {
      tenantId,
    });

    const pendingInvitations: PendingInvitation[] = invitations.map((inv: any) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role as PendingInvitation["role"],
      token: inv.token,
      expiresAt: new Date(inv.expiresAt),
      createdAt: new Date(inv.createdAt),
      invitedBy: inv.invitedBy,
    }));

    return { success: true, data: pendingInvitations };
  } catch (error) {
    console.error("Error getting pending invitations:", error);
    return {
      success: false,
      error: "Failed to load invitations",
    };
  }
}

/**
 * Cancel a pending invitation
 */
export async function cancelInvitation(
  input: CancelInvitationInput
): Promise<ActionResult<void>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = cancelInvitationSchema.parse(input);

    // Get invitation to check tenant
    const invitation = await convex.query(api.tenants.getInvitationById, {
      invitationId: validatedData.invitationId as Id<"tenantInvitations">,
    });

    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    // Check workspace admin permission
    const adminCheck = await checkWorkspaceAdmin(
      currentUser.id,
      invitation.tenantId
    );
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error };
    }

    // Delete invitation
    await convex.mutation(api.tenantMutations.cancelInvitation, {
      invitationId: validatedData.invitationId as Id<"tenantInvitations">,
    });

    // Revalidate paths
    revalidatePath("/dashboard/settings");

    return { success: true };
  } catch (error) {
    console.error("Error canceling invitation:", error);
    return {
      success: false,
      error: "Failed to cancel invitation",
    };
  }
}

/**
 * Accept a workspace (tenant) invitation
 */
export async function acceptInvitation(
  input: AcceptInvitationInput
): Promise<ActionResult<{ workspaceId: string }>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized - Please sign in" };
    }

    // Validate input
    const validatedData = acceptInvitationSchema.parse(input);

    // Accept invitation via Convex mutation
    const tenantId = await convex.mutation(api.tenantMutations.acceptInvitation, {
      token: validatedData.token,
      userId: currentUser.id,
    });

    // Revalidate paths
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    revalidatePath("/");

    return {
      success: true,
      data: { workspaceId: tenantId },
    };
  } catch (error: any) {
    console.error("Error accepting invitation:", error);
    return {
      success: false,
      error: error.message || "Failed to accept invitation. Please try again.",
    };
  }
}
