"use server";

import { revalidatePath } from "next/cache";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
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
import { sendTenantInvitationEmail } from "./email";

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
 * Invite a member to the tenant via email
 */
export async function inviteMember(
  input: InviteMemberInput
): Promise<ActionResult<PendingInvitation>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input - note: workspaceId maps to tenantId
    const validatedData = inviteMemberSchema.parse(input);
    const tenantId = validatedData.workspaceId; // Legacy field name

    // Check tenant admin permission
    const adminCheck = await checkTenantAdmin(currentUser.id, tenantId);
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error };
    }

    // Check if user is already a member
    const existingUser = await convex.query(api.users.getByEmail, {
      email: validatedData.email,
    });

    if (existingUser) {
      const existingMember = await convex.query(api.tenants.getMembership, {
        tenantId: tenantId as any,
        userId: existingUser._id,
      });

      if (existingMember) {
        return {
          success: false,
          error: "This user is already a member of the tenant",
        };
      }
    }

    // Check if there's already a pending invitation
    const pendingInvitations = await convex.query(api.tenants.getPendingInvitations, {
      tenantId: tenantId as any,
    });

    const existingInvitation = pendingInvitations.find(
      (inv: any) => inv.email.toLowerCase() === validatedData.email.toLowerCase()
    );

    if (existingInvitation) {
      return {
        success: false,
        error: "An invitation has already been sent to this email",
      };
    }

    // Get tenant and inviter details
    const tenant = await convex.query(api.tenants.getById, {
      id: tenantId as any,
    });

    const inviter = await convex.query(api.users.getById, {
      id: currentUser.id as any,
    });

    if (!tenant || !inviter) {
      return { success: false, error: "Tenant or inviter not found" };
    }

    // Create invitation
    const invitationId = await convex.mutation(api.tenantMutations.createInvitation, {
      tenantId: tenantId as any,
      email: validatedData.email,
      role: validatedData.role,
      invitedById: currentUser.id as any,
    });

    // Get the created invitation
    const invitation = await convex.query(api.tenants.getInvitationById, {
      invitationId,
    });

    if (!invitation) {
      return { success: false, error: "Failed to create invitation" };
    }

    // Send invitation email
    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invitation?token=${invitation.token}`;

    await sendTenantInvitationEmail(
      {
        inviterName: inviter.name || inviter.email,
        tenantName: tenant.name,
        inviteeEmail: validatedData.email,
        acceptUrl,
      },
      validatedData.email
    );

    // Revalidate paths
    revalidatePath("/dashboard/settings");

    const pendingInvitation: PendingInvitation = {
      id: invitation._id,
      email: invitation.email,
      role: invitation.role as PendingInvitation["role"],
      token: invitation.token,
      expiresAt: new Date(invitation.expiresAt),
      createdAt: new Date(invitation._creationTime),
      invitedBy: {
        id: currentUser.id,
        name: inviter.name || null,
        email: inviter.email,
      },
    };

    return { success: true, data: pendingInvitation };
  } catch (error) {
    console.error("Error inviting member:", error);
    return {
      success: false,
      error: "Failed to send invitation. Please try again.",
    };
  }
}

/**
 * Get pending invitations for a tenant
 */
export async function getPendingInvitations(
  tenantId: string
): Promise<ActionResult<PendingInvitation[]>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Check tenant admin permission
    const adminCheck = await checkTenantAdmin(currentUser.id, tenantId);
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error };
    }

    // Get pending invitations
    const invitations = await convex.query(api.tenants.getPendingInvitations, {
      tenantId: tenantId as any,
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
      invitationId: validatedData.invitationId as any,
    });

    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    // Check tenant admin permission
    const adminCheck = await checkTenantAdmin(
      currentUser.id,
      invitation.tenantId
    );
    if (!adminCheck.success) {
      return { success: false, error: adminCheck.error };
    }

    // Delete invitation
    await convex.mutation(api.tenantMutations.cancelInvitation, {
      invitationId: validatedData.invitationId as any,
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
 * Accept a tenant invitation
 */
export async function acceptInvitation(
  input: AcceptInvitationInput
): Promise<ActionResult<{ tenantId: string }>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized - Please sign in" };
    }

    // Validate input
    const validatedData = acceptInvitationSchema.parse(input);

    // Find invitation
    const invitation = await convex.query(api.tenants.getInvitationByToken, {
      token: validatedData.token,
    });

    if (!invitation) {
      return { success: false, error: "Invalid invitation token" };
    }

    // Check if expired
    if (invitation.expiresAt < Date.now()) {
      return { success: false, error: "This invitation has expired" };
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return { success: false, error: "This invitation has already been accepted" };
    }

    // Get current user
    const user = await convex.query(api.users.getById, {
      id: currentUser.id as any,
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Check if invitation email matches user email (case-insensitive)
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return {
        success: false,
        error: "This invitation was sent to a different email address",
      };
    }

    // Check if already a member
    const existingMember = await convex.query(api.tenants.getMembership, {
      tenantId: invitation.tenantId,
      userId: currentUser.id as any,
    });

    if (existingMember) {
      return {
        success: false,
        error: "You are already a member of this tenant",
      };
    }

    // Accept invitation (creates member and marks invitation as accepted)
    await convex.mutation(api.tenantMutations.acceptInvitation, {
      invitationId: invitation._id,
      userId: currentUser.id as any,
    });

    // Revalidate paths
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    revalidatePath("/"); // Revalidate root to ensure proper auth state

    return {
      success: true,
      data: { tenantId: invitation.tenantId },
    };
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return {
      success: false,
      error: "Failed to accept invitation. Please try again.",
    };
  }
}
