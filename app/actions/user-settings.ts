"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  users,
  sessions,
  accounts,
  tenantMembers,
  tenantInvitations,
  cpiTenants,
  iFlows,
  iFlowExecutions,
  aiAgentExecutions,
  aiChatConversations,
  iFlowPipelines,
  iFlowPipelineAgentLogs,
} from "@/lib/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { getCurrentUser } from "./user";
import type { ActionResult } from "@/types/actions";
import {
  updateProfileSchema,
  type UpdateProfileInput,
} from "@/lib/validations/user-settings";

/**
 * Update the current user's profile settings
 */
export async function updateUserProfile(
  input: UpdateProfileInput,
): Promise<ActionResult<{ name: string | null; phone: string | null }>> {
  try {
    // Check authentication
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = updateProfileSchema.parse(input);

    // Update user profile
    await db
      .update(users)
      .set({
        name: validatedData.name,
        phone: validatedData.phone === "" ? null : validatedData.phone,
      })
      .where(eq(users.id, currentUser.id));

    // Revalidate paths
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");

    return {
      success: true,
      data: {
        name: validatedData.name ?? null,
        phone: validatedData.phone ?? null,
      },
    };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return {
      success: false,
      error: "Failed to update profile. Please try again.",
    };
  }
}

/**
 * Delete the current user's account and all associated data (hard delete)
 */
export async function deleteUserAccount(): Promise<ActionResult<void>> {
  try {
    // Check authentication
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = currentUser.id;

    // Resolve which tenants need full deletion BEFORE the transaction
    // (read-only queries outside of transaction to minimise lock time)
    const userMemberships = await db.query.tenantMembers.findMany({
      where: eq(tenantMembers.userId, userId),
    });

    const userTenantIds = userMemberships.map((m) => m.tenantId);
    const tenantsToDelete: string[] = [];

    for (const tenantId of userTenantIds) {
      const allMembers = await db.query.tenantMembers.findMany({
        where: eq(tenantMembers.tenantId, tenantId),
      });
      const owners = allMembers.filter((m) => m.role === "OWNER");
      const isOnlyOwner = owners.length === 1 && owners[0].userId === userId;
      if (isOnlyOwner) {
        tenantsToDelete.push(tenantId);
      }
    }

    // Execute all destructive operations atomically so a partial failure
    // cannot leave the database in an inconsistent state.
    await db.transaction(async (tx) => {
      if (userTenantIds.length > 0) {
        // 2. For tenants to be deleted: cascade delete all their data
        if (tenantsToDelete.length > 0) {
          // Get all iFlow IDs for these tenants
          const tenantIFlows = await tx
            .select({ id: iFlows.id })
            .from(iFlows)
            .where(inArray(iFlows.tenantId, tenantsToDelete));
          const iFlowIds = tenantIFlows.map((f) => f.id);

          // Get all pipeline IDs for these tenants
          const tenantPipelines = await tx
            .select({ id: iFlowPipelines.id })
            .from(iFlowPipelines)
            .where(inArray(iFlowPipelines.tenantId, tenantsToDelete));
          const pipelineIds = tenantPipelines.map((p) => p.id);

          // Delete iFlow executions
          if (iFlowIds.length > 0) {
            await tx
              .delete(iFlowExecutions)
              .where(inArray(iFlowExecutions.iFlowId, iFlowIds));
          }

          // Delete iFlows
          await tx
            .delete(iFlows)
            .where(inArray(iFlows.tenantId, tenantsToDelete));

          // Delete pipeline agent logs
          if (pipelineIds.length > 0) {
            await tx
              .delete(iFlowPipelineAgentLogs)
              .where(inArray(iFlowPipelineAgentLogs.pipelineId, pipelineIds));
          }

          // Delete pipelines for these tenants
          await tx
            .delete(iFlowPipelines)
            .where(inArray(iFlowPipelines.tenantId, tenantsToDelete));

          // Delete AI agent executions for these tenants
          await tx
            .delete(aiAgentExecutions)
            .where(inArray(aiAgentExecutions.tenantId, tenantsToDelete));

          // Delete AI chat conversations for these tenants
          await tx
            .delete(aiChatConversations)
            .where(inArray(aiChatConversations.tenantId, tenantsToDelete));

          // Delete all tenant members for these tenants
          await tx
            .delete(tenantMembers)
            .where(inArray(tenantMembers.tenantId, tenantsToDelete));

          // Delete tenant invitations for these tenants
          await tx
            .delete(tenantInvitations)
            .where(inArray(tenantInvitations.tenantId, tenantsToDelete));

          // Delete the tenants themselves
          await tx
            .delete(cpiTenants)
            .where(inArray(cpiTenants.id, tenantsToDelete));
        }

        // 3. Remove user from tenants they don't own (just remove their membership)
        const tenantsNotDeleted = userTenantIds.filter(
          (id) => !tenantsToDelete.includes(id),
        );
        if (tenantsNotDeleted.length > 0) {
          await tx
            .delete(tenantMembers)
            .where(
              and(
                eq(tenantMembers.userId, userId),
                inArray(tenantMembers.tenantId, tenantsNotDeleted),
              ),
            );
        }
      }

      // 4. Delete user's AI agent executions (not tenant-scoped)
      await tx
        .delete(aiAgentExecutions)
        .where(eq(aiAgentExecutions.userId, userId));

      // 5. Delete user's AI chat conversations (not tenant-scoped)
      await tx
        .delete(aiChatConversations)
        .where(eq(aiChatConversations.userId, userId));

      // 6. Delete user's iFlow pipelines (not tenant-scoped)
      const userPipelines = await tx
        .select({ id: iFlowPipelines.id })
        .from(iFlowPipelines)
        .where(eq(iFlowPipelines.userId, userId));
      if (userPipelines.length > 0) {
        const pipelineIds = userPipelines.map((p) => p.id);
        await tx
          .delete(iFlowPipelineAgentLogs)
          .where(inArray(iFlowPipelineAgentLogs.pipelineId, pipelineIds));
        await tx
          .delete(iFlowPipelines)
          .where(eq(iFlowPipelines.userId, userId));
      }

      // 7. Delete user's sessions and auth accounts
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.delete(accounts).where(eq(accounts.userId, userId));

      // 8. Hard delete the user record (must be last)
      await tx.delete(users).where(eq(users.id, userId));
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting user account:", error);
    return {
      success: false,
      error: "Failed to delete account. Please try again.",
    };
  }
}
