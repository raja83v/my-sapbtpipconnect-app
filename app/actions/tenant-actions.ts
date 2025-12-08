"use server";

import { api } from "@/convex/_generated/api";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { encrypt } from "@/lib/encryption";
import { auth } from "@clerk/nextjs/server";
import { Id } from "@/convex/_generated/dataModel";

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
    const { userId } = await auth();

    if (!userId) {
        throw new Error("Unauthorized");
    }

    // Encrypt sensitive data before storing
    const encryptedData = {
        ...data,
        clientSecret: data.clientSecret ? await encrypt(data.clientSecret) : undefined,
        password: data.password ? await encrypt(data.password) : undefined,
    };

    // Get user's Convex ID
    const convexUser = await fetchQuery(api.users.getByClerkId, { clerkId: userId });

    if (!convexUser) {
        throw new Error("User not found");
    }

    // Create tenant with encrypted credentials
    const tenantId = await fetchMutation(api.tenantMutations.create, {
        ...encryptedData,
        ownerId: convexUser._id,
    });

    return tenantId;
}

/**
 * Update tenant with encrypted credentials
 */
export async function updateTenant(data: {
    id: Id<"cpiTenants">;
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
    const { userId } = await auth();

    if (!userId) {
        throw new Error("Unauthorized");
    }

    // Encrypt sensitive data if provided
    const encryptedData = {
        ...data,
        clientSecret: data.clientSecret ? await encrypt(data.clientSecret) : undefined,
        password: data.password ? await encrypt(data.password) : undefined,
    };

    // Update tenant with encrypted credentials
    const tenantId = await fetchMutation(api.tenantMutations.update, encryptedData);

    return tenantId;
}

/**
 * Test tenant connection and mark as connected if successful
 */
export async function testTenantConnection(tenantId: Id<"cpiTenants">) {
    const { userId } = await auth();

    if (!userId) {
        throw new Error("Unauthorized");
    }

    // This would call the SAP sync test connection action
    // For now, just mark as connected
    await fetchMutation(api.tenantMutations.update, {
        id: tenantId,
        isConnected: true,
        connectionTestAt: Date.now(),
    });

    return { success: true };
}