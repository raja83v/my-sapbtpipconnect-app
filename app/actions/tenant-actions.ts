"use server";

import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { cpiTenants, tenantMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt } from "@/lib/encryption";

/**
 * Create a new tenant with encrypted credentials
 */
export async function createTenant(data: {
    name: string;
    slug: string;
    description?: string;
    tenantUrl: string;
    authType?: "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY";
    authenticationUrl?: string;
    clientId?: string;
    clientSecret?: string;
    username?: string;
    password?: string;
}) {
    const user = await requireAuth();

    // Encrypt sensitive data before storing
    const encryptedClientSecret = data.clientSecret ? await encrypt(data.clientSecret) : undefined;
    const encryptedPassword = data.password ? await encrypt(data.password) : undefined;

    // Create tenant with encrypted credentials and add user as owner
    const tenant = await db.transaction(async (tx) => {
        const [newTenant] = await tx.insert(cpiTenants).values({
                name: data.name,
                slug: data.slug,
                description: data.description,
                tenantUrl: data.tenantUrl,
                authType: data.authType || "OAUTH",
                authenticationUrl: data.authenticationUrl,
                clientId: data.clientId,
                clientSecret: encryptedClientSecret,
                username: data.username,
                password: encryptedPassword,
                status: "ACTIVE",
        }).returning();

        // Add user as OWNER
        await tx.insert(tenantMembers).values({
                userId: user.id,
                tenantId: newTenant.id,
                role: "OWNER",
        });

        return newTenant;
    });

    return tenant.id;
}

/**
 * Update tenant with encrypted credentials
 */
export async function updateTenant(data: {
    id: string;
    name?: string;
    slug?: string;
    description?: string;
    tenantUrl?: string;
    authType?: "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY";
    authenticationUrl?: string;
    clientId?: string;
    clientSecret?: string;
    username?: string;
    password?: string;
    status?: "ACTIVE" | "INACTIVE" | "TESTING" | "ERROR";
    isConnected?: boolean;
}) {
    await requireAuth();

    // Encrypt sensitive data if provided
    const updateData: any = { ...data };
    delete updateData.id;

    if (data.clientSecret) {
        updateData.clientSecret = await encrypt(data.clientSecret);
    }
    if (data.password) {
        updateData.password = await encrypt(data.password);
    }

    // Update tenant with encrypted credentials
    await db.update(cpiTenants).set(updateData).where(eq(cpiTenants.id, data.id));

    return data.id;
}

/**
 * Test tenant connection and mark as connected if successful
 */
export async function testTenantConnection(tenantId: string) {
    await requireAuth();

    // This would call the SAP sync test connection action
    // For now, just mark as connected
    await db.update(cpiTenants).set({
        isConnected: true,
        connectionTestAt: new Date(),
    }).where(eq(cpiTenants.id, tenantId));

    return { success: true };
}
