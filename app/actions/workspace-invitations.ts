"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
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
    const tenantId = validatedData.workspaceId;

    // Check workspace admin permission
    const adminCheck = await checkWorkspaceAdmin(currentUser.id, tenantId);
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error };
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      const existingMember = await prisma.tenantMember.findUnique({
        where: {
          userId_tenantId: {
            userId: existingUser.id,
            tenantId,
          },
        },
      });

      if (existingMember) {
        return {
          success: false,
          error: "This user is already a member of the workspace",
        };
      }
    }

    // Get tenant details
    const tenant = await prisma.cpiTenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      return { success: false, error: "Workspace not found" };
    }

    // Get inviter details
    const inviter = await prisma.user.findUnique({
      where: { id: currentUser.id },
    });
    if (!inviter) {
      return { success: false, error: "Inviter not found" };
    }

    // Create invitation
    const invitation = await prisma.tenantInvitation.create({
      data: {
        tenantId,
        email: validatedData.email,
        role: validatedData.role as "OWNER" | "ADMIN" | "MEMBER",
        invitedById: currentUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Send invitation email
    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invitation?token=${invitation.token}`;

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
      id: invitation.id,
      email: validatedData.email,
      role: validatedData.role as PendingInvitation["role"],
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      invitedBy: {
        id: inviter.id,
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

    // Check workspace admin permission
    const adminCheck = await checkWorkspaceAdmin(currentUser.id, workspaceId);
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error };
    }

    // Get pending invitations
    const invitations = await prisma.tenantInvitation.findMany({
      where: {
        tenantId: workspaceId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const pendingInvitations: PendingInvitation[] = invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role as PendingInvitation["role"],
      token: inv.token,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
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
    const invitation = await prisma.tenantInvitation.findUnique({
      where: { id: validatedData.invitationId },
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
    await prisma.tenantInvitation.delete({
      where: { id: validatedData.invitationId },
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

    // Get invitation
    const invitation = await prisma.tenantInvitation.findUnique({
      where: { token: validatedData.token },
    });

    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    if (invitation.acceptedAt) {
      return { success: false, error: "Invitation already accepted" };
    }

    if (invitation.expiresAt < new Date()) {
      return { success: false, error: "Invitation has expired" };
    }

    // Accept invitation and add member in a transaction
    await prisma.$transaction(async (tx) => {
      // Mark invitation as accepted
      await tx.tenantInvitation.update({
        where: { token: validatedData.token },
        data: { acceptedAt: new Date() },
      });

      // Add user as member
      await tx.tenantMember.create({
        data: {
          userId: currentUser.id,
          tenantId: invitation.tenantId,
          role: invitation.role,
        },
      });
    });

    // Revalidate paths
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    revalidatePath("/");

    return {
      success: true,
      data: { workspaceId: invitation.tenantId },
    };
  } catch (error: any) {
    console.error("Error accepting invitation:", error);
    return {
      success: false,
      error: error.message || "Failed to accept invitation. Please try again.",
    };
  }
}
