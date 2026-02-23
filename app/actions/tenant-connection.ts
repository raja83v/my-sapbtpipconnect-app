"use server";

import { getCurrentUser } from "./user";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/types/actions";

/**
 * Mark a tenant as connected (for testing/debugging)
 */
export async function markTenantConnected(tenantId: string): Promise<ActionResult<void>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        // Check if user has access to this tenant
        const membership = await prisma.tenantMember.findUnique({
            where: {
                userId_tenantId: {
                    userId: currentUser.id,
                    tenantId: tenantId,
                },
            },
        });

        if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
            return { success: false, error: "You don't have permission to update this tenant" };
        }

        // Mark tenant as connected
        await prisma.cpiTenant.update({
            where: { id: tenantId },
            data: {
                isConnected: true,
                connectionTestAt: new Date(),
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Error marking tenant as connected:", error);
        return { success: false, error: "Failed to update tenant" };
    }
}
