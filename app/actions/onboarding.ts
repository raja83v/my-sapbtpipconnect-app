"use server";

import { getCurrentUser } from "./user";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
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

      // Check if slug is already taken
      const existingTenant = await convex.query(api.tenants.getBySlug, {
        slug: tenantSlug,
      });

      if (existingTenant) {
        throw new Error("Tenant name already exists. Please choose another.");
      }

      // Encrypt sensitive data
      const encryptedClientSecret = data.clientSecret ? await encrypt(data.clientSecret) : undefined;
      const encryptedPassword = data.password ? await encrypt(data.password) : undefined;

      // Create CPI tenant with owner
      const tenantId = await convex.mutation(api.tenantMutations.create, {
        name: data.tenantName!,
        slug: tenantSlug,
        tenantUrl: data.tenantUrl!,
        authType: data.authType || "OAUTH",
        authenticationUrl: data.authenticationUrl || data.tokenUrl,
        clientId: data.clientId,
        clientSecret: encryptedClientSecret,
        username: data.username,
        password: encryptedPassword,
        status: "TESTING",
        isConnected: true,
        connectionTestAt: Date.now(),
        ownerId: currentUser.id as any,
      });

      // Update user with onboarding completion
      const onboardingData = {
        ...(data.organizationType && { organizationType: data.organizationType }),
        ...(data.companyName && { companyName: data.companyName }),
        ...(data.companySize && { companySize: data.companySize }),
        completedAt: new Date().toISOString(),
      };

      await convex.mutation(api.userMutations.update, {
        id: currentUser.id as any,
        onboardingCompleted: true,
        ...(data.firstName && { name: data.firstName }),
        onboardingData,
        defaultTenantId: tenantId,
      });

      const tenant = await convex.query(api.tenants.getById, { id: tenantId });
      return { success: true, tenant };
    }

    // Legacy workspace onboarding (converted to tenant)
    if (data.workspaceName) {
      const tenantSlug = data.workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");

      // Check if slug is already taken
      const existingTenant = await convex.query(api.tenants.getBySlug, {
        slug: tenantSlug,
      });

      if (existingTenant) {
        throw new Error("Workspace name already exists. Please choose another.");
      }

      // Create tenant (as workspace equivalent)
      const tenantId = await convex.mutation(api.tenantMutations.create, {
        name: data.workspaceName!,
        slug: tenantSlug,
        tenantUrl: "", // No tenant URL for workspace-style creation
        authType: "OAUTH",
        status: "ACTIVE",
        ownerId: currentUser.id as any,
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

      await convex.mutation(api.userMutations.update, {
        id: currentUser.id as any,
        onboardingCompleted: true,
        ...(data.firstName && { name: data.firstName }),
        onboardingData,
        defaultTenantId: tenantId,
      });

      const tenant = await convex.query(api.tenants.getById, { id: tenantId });
      return { success: true, workspace: tenant }; // Return as workspace for compatibility
    }

    throw new Error("Invalid onboarding data: neither tenant nor workspace information provided");
  } catch (error) {
    console.error("Error completing onboarding:", error);
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
    const user = await convex.query(api.users.getById, {
      id: currentUser.id as any,
    });

    const currentData = (user?.onboardingData || {}) as OnboardingData;

    await convex.mutation(api.userMutations.update, {
      id: currentUser.id as any,
      onboardingData: {
        ...currentData,
        ...data,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating onboarding data:", error);
    throw error;
  }
}
