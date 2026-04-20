"use server";

import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import { tenantMembers, cpiTenants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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
        const membership = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, currentUser.id), eq(tenantMembers.tenantId, tenantId)),
        });

        if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
            return { success: false, error: "You don't have permission to update this tenant" };
        }

        // Mark tenant as connected
        await db.update(cpiTenants).set({
            isConnected: true,
            connectionTestAt: new Date(),
        }).where(eq(cpiTenants.id, tenantId));

        return { success: true };
    } catch (error) {
        console.error("Error marking tenant as connected:", error);
        return { success: false, error: "Failed to update tenant" };
    }
}
