"use server";

import { getCurrentUser } from "./user";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
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
        const membership = await convex.query(api.tenants.getMembership, {
            userId: currentUser.id as any,
            tenantId: tenantId as any,
        });

        if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
            return { success: false, error: "You don't have permission to update this tenant" };
        }

        // Mark tenant as connected
        await convex.mutation(api.tenantMutations.update, {
            id: tenantId as any,
            isConnected: true,
            connectionTestAt: Date.now(),
        });

        return { success: true };
    } catch (error) {
        console.error("Error marking tenant as connected:", error);
        return { success: false, error: "Failed to update tenant" };
    }
}