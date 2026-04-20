"use server";

import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import { cpiTenants, tenantMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt } from "@/lib/encryption";

export interface OnboardingData {
  role?: string; // Legacy field
  organizationType?: string;
  useCase?: string;
  discoverySource?: string;
  workspaceName?: string;
  firstName?: string;
  businessName?: string;
  businessPhone?: string;
  companyName?: string;
  companySize?: string;
  // CPI Tenant fields
  tenantName?: string;
  tenantUrl?: string;
  authType?: "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY";
  authenticationUrl?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  username?: string;
  password?: string;
}

export async function completeOnboarding(data: OnboardingData) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    // Handle CPI Tenant onboarding
    if (data.tenantName && data.tenantUrl) {
      const tenantSlug = data.tenantName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");

      // Check if current user already has a tenant with this name
      const userExistingTenantResult = await db.select({ id: cpiTenants.id })
        .from(cpiTenants)
        .innerJoin(tenantMembers, and(eq(tenantMembers.tenantId, cpiTenants.id), eq(tenantMembers.userId, currentUser.id)))
        .where(eq(cpiTenants.slug, tenantSlug))
        .limit(1);
      const userExistingTenant = userExistingTenantResult[0] ?? null;

      if (userExistingTenant) {
        throw new Error("Tenant name already exists. Please choose another.");
      }

      // If slug is globally taken by another user's tenant, append a unique suffix
      let finalTenantSlug = tenantSlug;
      const globalSlugConflict = await db.query.cpiTenants.findFirst({
        where: eq(cpiTenants.slug, tenantSlug),
      });
      if (globalSlugConflict) {
        finalTenantSlug = `${tenantSlug}-${currentUser.id.slice(-6)}`;
      }

      // Encrypt sensitive data
      const encryptedClientSecret = data.clientSecret ? await encrypt(data.clientSecret) : undefined;
      const encryptedPassword = data.password ? await encrypt(data.password) : undefined;

      // Create CPI tenant with owner membership in a transaction
      const tenant = await db.transaction(async (tx) => {
        const [newTenant] = await tx.insert(cpiTenants).values({
            name: data.tenantName!,
            slug: finalTenantSlug,
            tenantUrl: data.tenantUrl!,
            authType: data.authType || "OAUTH",
            authenticationUrl: data.authenticationUrl || data.tokenUrl,
            clientId: data.clientId,
            clientSecret: encryptedClientSecret,
            username: data.username,
            password: encryptedPassword,
            status: "TESTING",
            isConnected: true,
            connectionTestAt: new Date(),
        }).returning();

        // Add current user as OWNER
        await tx.insert(tenantMembers).values({
            userId: currentUser.id,
            tenantId: newTenant.id,
            role: "OWNER",
        });

        return newTenant;
      });

      // Update user with onboarding completion
      const onboardingData = {
        ...(data.organizationType && { organizationType: data.organizationType }),
        ...(data.companyName && { companyName: data.companyName }),
        ...(data.companySize && { companySize: data.companySize }),
        completedAt: new Date().toISOString(),
      };

      await db.update(users).set({
          onboardingCompleted: true,
          ...(data.firstName && { name: data.firstName }),
          onboardingData,
          defaultTenantId: tenant.id,
      }).where(eq(users.id, currentUser.id));

      return { success: true, tenant };
    }

    // Legacy workspace onboarding (converted to tenant)
    if (data.workspaceName) {
      const tenantSlug = data.workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");

      // Check if slug is already taken
      const existingTenant = await db.query.cpiTenants.findFirst({
        where: eq(cpiTenants.slug, tenantSlug),
      });

      if (existingTenant) {
        throw new Error("Workspace name already exists. Please choose another.");
      }

      // Create tenant (as workspace equivalent) with owner membership
      const tenant = await db.transaction(async (tx) => {
        const [newTenant] = await tx.insert(cpiTenants).values({
            name: data.workspaceName!,
            slug: tenantSlug,
            tenantUrl: "", // No tenant URL for workspace-style creation
            authType: "OAUTH",
            status: "ACTIVE",
        }).returning();

        // Add current user as OWNER
        await tx.insert(tenantMembers).values({
            userId: currentUser.id,
            tenantId: newTenant.id,
            role: "OWNER",
        });

        return newTenant;
      });

      // Update user with onboarding completion
      const onboardingData = {
        ...(data.role && { role: data.role }),
        ...(data.useCase && { useCase: data.useCase }),
        ...(data.discoverySource && { discoverySource: data.discoverySource }),
        ...(data.businessName && { businessName: data.businessName }),
        ...(data.businessPhone && { businessPhone: data.businessPhone }),
        completedAt: new Date().toISOString(),
      };

      await db.update(users).set({
          onboardingCompleted: true,
          ...(data.firstName && { name: data.firstName }),
          onboardingData,
          defaultTenantId: tenant.id,
      }).where(eq(users.id, currentUser.id));

      return { success: true, workspace: tenant }; // Return as workspace for compatibility
    }

    throw new Error("Invalid onboarding data: neither tenant nor workspace information provided");
  } catch (error) {
    console.error("Error completing onboarding:", error);
    throw error;
  }
}

/**
 * Save CPI tenant configuration WITHOUT marking onboarding complete.
 * Used in the tenant step so the user can proceed to the AI config step.
 */
export async function saveTenantConfig(data: OnboardingData) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    if (!data.tenantName || !data.tenantUrl) {
      throw new Error("Tenant name and URL are required");
    }

    const tenantSlug = data.tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");

    // Check if current user already has a tenant with this name
    const userExistingTenantResult = await db.select({ id: cpiTenants.id })
      .from(cpiTenants)
      .innerJoin(tenantMembers, and(eq(tenantMembers.tenantId, cpiTenants.id), eq(tenantMembers.userId, currentUser.id)))
      .where(eq(cpiTenants.slug, tenantSlug))
      .limit(1);

    if (userExistingTenantResult[0]) {
      throw new Error("Tenant name already exists. Please choose another.");
    }

    let finalTenantSlug = tenantSlug;
    const globalSlugConflict = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.slug, tenantSlug),
    });
    if (globalSlugConflict) {
      finalTenantSlug = `${tenantSlug}-${currentUser.id.slice(-6)}`;
    }

    const encryptedClientSecret = data.clientSecret ? await encrypt(data.clientSecret) : undefined;
    const encryptedPassword = data.password ? await encrypt(data.password) : undefined;

    const tenant = await db.transaction(async (tx) => {
      const [newTenant] = await tx.insert(cpiTenants).values({
        name: data.tenantName!,
        slug: finalTenantSlug,
        tenantUrl: data.tenantUrl!,
        authType: data.authType || "OAUTH",
        authenticationUrl: data.authenticationUrl || data.tokenUrl,
        clientId: data.clientId,
        clientSecret: encryptedClientSecret,
        username: data.username,
        password: encryptedPassword,
        status: "TESTING",
        isConnected: true,
        connectionTestAt: new Date(),
      }).returning();

      await tx.insert(tenantMembers).values({
        userId: currentUser.id,
        tenantId: newTenant.id,
        role: "OWNER",
      });

      return newTenant;
    });

    // Save profile data and set default tenant, but do NOT mark onboarding complete
    const onboardingData = {
      ...(data.organizationType && { organizationType: data.organizationType }),
      ...(data.companyName && { companyName: data.companyName }),
      ...(data.companySize && { companySize: data.companySize }),
    };

    await db.update(users).set({
      ...(data.firstName && { name: data.firstName }),
      onboardingData,
      defaultTenantId: tenant.id,
    }).where(eq(users.id, currentUser.id));

    return { success: true, tenant };
  } catch (error) {
    console.error("Error saving tenant config:", error);
    throw error;
  }
}

/**
 * Mark onboarding as complete. Called after the AI config step (or skip).
 */
export async function finalizeOnboarding() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, currentUser.id),
    });

    const currentData = (user?.onboardingData || {}) as Record<string, unknown>;

    await db.update(users).set({
      onboardingCompleted: true,
      onboardingData: {
        ...currentData,
        completedAt: new Date().toISOString(),
      },
    }).where(eq(users.id, currentUser.id));

    return { success: true };
  } catch (error) {
    console.error("Error finalizing onboarding:", error);
    throw error;
  }
}

export async function updateOnboardingData(data: Partial<OnboardingData>) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    // Get current user with onboarding data
    const user = await db.query.users.findFirst({
      where: eq(users.id, currentUser.id),
    });

    const currentData = (user?.onboardingData || {}) as OnboardingData;

    await db.update(users).set({
        onboardingData: {
          ...currentData,
          ...data,
        },
    }).where(eq(users.id, currentUser.id));

    return { success: true };
  } catch (error) {
    console.error("Error updating onboarding data:", error);
    throw error;
  }
}
