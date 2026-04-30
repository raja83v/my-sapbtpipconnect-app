"use server";

/**
 * @deprecated These workspace-invitation actions are legacy wrappers around the
 * tenant-invitation system. Use `app/actions/tenant-invitations.ts` directly instead.
 * This file is kept for backward compatibility and will be removed in a future
 * cleanup pass.
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  tenantMembers,
  users,
  tenantInvitations,
  cpiTenants,
} from "@/lib/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
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
  tenantId: string,
): Promise<ActionResult<boolean>> {
  const member = await db.query.tenantMembers.findFirst({
    where: and(
      eq(tenantMembers.userId, userId),
      eq(tenantMembers.tenantId, tenantId),
    ),
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
  input: InviteMemberInput,
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
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, validatedData.email),
    });

    if (existingUser) {
      const existingMember = await db.query.tenantMembers.findFirst({
        where: and(
          eq(tenantMembers.userId, existingUser.id),
          eq(tenantMembers.tenantId, tenantId),
        ),
      });

      if (existingMember) {
        return {
          success: false,
          error: "This user is already a member of the workspace",
        };
      }
    }

    // Get tenant details
    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, tenantId),
    });
    if (!tenant) {
      return { success: false, error: "Workspace not found" };
    }

    // Get inviter details
    const inviter = await db.query.users.findFirst({
      where: eq(users.id, currentUser.id),
    });
    if (!inviter) {
      return { success: false, error: "Inviter not found" };
    }

    // Create invitation
    const [invitation] = await db
      .insert(tenantInvitations)
      .values({
        tenantId,
        email: validatedData.email,
        role: validatedData.role as "OWNER" | "ADMIN" | "MEMBER",
        invitedById: currentUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning();

    // Send invitation email
    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invitation?token=${invitation.token}`;

    await sendWorkspaceInvitationEmail(
      {
        inviterName: inviter.name || inviter.email,
        workspaceName: tenant.name,
        inviteeEmail: validatedData.email,
        acceptUrl,
      },
      validatedData.email,
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
  workspaceId: string,
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
    const invitations = await db.query.tenantInvitations.findMany({
      where: and(
        eq(tenantInvitations.tenantId, workspaceId),
        isNull(tenantInvitations.acceptedAt),
        gt(tenantInvitations.expiresAt, new Date()),
      ),
      with: {
        invitedBy: { columns: { id: true, name: true, email: true } },
      },
      orderBy: (tenantInvitations, { desc }) => [
        desc(tenantInvitations.createdAt),
      ],
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
  input: CancelInvitationInput,
): Promise<ActionResult<void>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = cancelInvitationSchema.parse(input);

    // Get invitation to check tenant
    const invitation = await db.query.tenantInvitations.findFirst({
      where: eq(tenantInvitations.id, validatedData.invitationId),
    });

    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    // Check workspace admin permission
    const adminCheck = await checkWorkspaceAdmin(
      currentUser.id,
      invitation.tenantId,
    );
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error };
    }

    // Delete invitation
    await db
      .delete(tenantInvitations)
      .where(eq(tenantInvitations.id, validatedData.invitationId));

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
  input: AcceptInvitationInput,
): Promise<ActionResult<{ workspaceId: string }>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized - Please sign in" };
    }

    // Validate input
    const validatedData = acceptInvitationSchema.parse(input);

    // Get invitation
    const invitation = await db.query.tenantInvitations.findFirst({
      where: eq(tenantInvitations.token, validatedData.token),
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
    await db.transaction(async (tx) => {
      // Mark invitation as accepted
      await tx
        .update(tenantInvitations)
        .set({ acceptedAt: new Date() })
        .where(eq(tenantInvitations.token, validatedData.token));

      // Add user as member
      await tx.insert(tenantMembers).values({
        userId: currentUser.id,
        tenantId: invitation.tenantId,
        role: invitation.role,
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
