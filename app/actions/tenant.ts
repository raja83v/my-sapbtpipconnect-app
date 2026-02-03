"use server";

import { getCurrentUser } from "./user";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { encrypt, decrypt } from "@/lib/encryption";
import type { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";
import { checkSubscriptionLimit, incrementUsage } from "./billing";

// Configuration for execution sync
const EXECUTION_SYNC_CONFIG = {
  // Number of days to look back for executions
  daysToSync: 30,
  // Maximum executions per iFlow to sync (prevents overwhelming the DB)
  maxExecutionsPerIFlow: 100,
  // Batch size for database operations
  batchSize: 50,
};

export interface TenantWithRole {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tenantUrl: string;
  authType: string;
  status: string;
  isConnected: boolean;
  lastSyncAt: Date | null;
  connectionTestAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  memberRole: string;
}

/**
 * Get all tenants for the current user
 */
export async function getUserTenants(): Promise<ActionResult<TenantWithRole[]>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const tenantsData = await convex.query(api.tenants.listForUser, {
      userId: currentUser.id as any
    });

    // listForUser returns tenant data directly with memberRole merged in (not nested)
    const tenants: TenantWithRole[] = tenantsData.map((item: any) => ({
      id: item._id,
      name: item.name,
      slug: item.slug,
      description: item.description ?? null,
      tenantUrl: item.tenantUrl,
      authType: item.authType,
      status: item.status,
      isConnected: item.isConnected,
      lastSyncAt: item.lastSyncAt ? new Date(item.lastSyncAt) : null,
      connectionTestAt: item.connectionTestAt ? new Date(item.connectionTestAt) : null,
      createdAt: new Date(item._creationTime),
      updatedAt: new Date(item._creationTime),
      memberRole: item.memberRole,
    }));

    return { success: true, data: tenants };
  } catch (error) {
    console.error("Error fetching user tenants:", error);
    return { success: false, error: "Failed to fetch tenants" };
  }
}

/**
 * Get a tenant by ID (with user access check)
 */
export async function getTenantById(tenantId: string): Promise<ActionResult<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tenantUrl: string;
  tmUrl: string;
  authType: string;
  authenticationUrl?: string;
  clientId?: string;
  username?: string;
  password?: string;
  status: string;
  isConnected: boolean;
}>> {
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

    if (!membership) {
      return { success: false, error: "You don't have access to this tenant" };
    }

    // Get tenant details
    const tenant = await convex.query(api.tenants.getById, { id: tenantId as any });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Decrypt credentials if needed
    let decryptedPassword: string | undefined;
    if (tenant.password) {
      try {
        decryptedPassword = await decrypt(tenant.password);
      } catch {
        // Ignore decryption errors
      }
    }

    return {
      success: true,
      data: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        description: tenant.description ?? null,
        tenantUrl: tenant.tenantUrl,
        tmUrl: tenant.tenantUrl, // tmUrl is the same as tenantUrl for SAP CPI
        authType: tenant.authType,
        authenticationUrl: tenant.authenticationUrl,
        clientId: tenant.clientId,
        username: tenant.username,
        password: decryptedPassword,
        status: tenant.status,
        isConnected: tenant.isConnected,
      }
    };
  } catch (error) {
    console.error("Error fetching tenant:", error);
    return { success: false, error: "Failed to fetch tenant" };
  }
}

/**
 * Set the default tenant for the current user
 */
export async function setDefaultTenant(tenantId: string): Promise<ActionResult<void>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify user has access to this tenant
    const membership = await convex.query(api.tenants.getMembership, {
      userId: currentUser.id as any,
      tenantId: tenantId as any,
    });

    if (!membership) {
      return { success: false, error: "You don't have access to this tenant" };
    }

    // Update user's default tenant
    await convex.mutation(api.userMutations.update, {
      id: currentUser.id as any,
      defaultTenantId: tenantId as any,
    });

    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error setting default tenant:", error);
    return { success: false, error: "Failed to set default tenant" };
  }
}

/**
 * Create a new CPI tenant
 */
export async function createTenant(data: {
  tenantName: string;
  tenantUrl: string;
  description?: string;
  authType: "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY";
  authenticationUrl?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
}): Promise<ActionResult<{ tenantId: string }>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    // Check subscription limit for tenants
    const limitCheck = await checkSubscriptionLimit("tenants");
    if (!limitCheck.success) {
      return { success: false, error: limitCheck.error };
    }

    if (!limitCheck.data?.allowed) {
      const { current, max } = limitCheck.data || { current: 0, max: 0 };
      return {
        success: false,
        error: `Tenant limit reached (${current}/${max}). Please upgrade your plan to add more tenants.`,
      };
    }

    const tenantSlug = data.tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if tenant slug already exists
    const existingTenant = await convex.query(api.tenants.getBySlug, { slug: tenantSlug });

    if (existingTenant) {
      return { success: false, error: "Tenant name already exists. Please choose another." };
    }

    // Encrypt sensitive credentials if provided
    const encryptedClientSecret = data.clientSecret ? await encrypt(data.clientSecret) : undefined;
    const encryptedPassword = data.password ? await encrypt(data.password) : undefined;

    // Test OAuth connection if credentials provided
    let isConnected = false;
    let connectionTestAt: number | undefined;

    if (data.authType === "OAUTH" && data.authenticationUrl && data.clientId && data.clientSecret) {
      try {
        console.log("Testing OAuth connection...");
        await getSAPToken(data.authenticationUrl, data.clientId, data.clientSecret);
        isConnected = true;
        connectionTestAt = Date.now();
        console.log("✅ OAuth connection successful");
      } catch (error) {
        console.warn("⚠️ OAuth connection failed:", error instanceof Error ? error.message : "Unknown error");
        // Don't fail tenant creation, just mark as not connected
        isConnected = false;
      }
    }

    // Create tenant and add user as owner
    const tenantId = await convex.mutation(api.tenantMutations.create, {
      name: data.tenantName,
      slug: tenantSlug,
      description: data.description,
      tenantUrl: data.tenantUrl,
      authType: data.authType,
      authenticationUrl: data.authenticationUrl,
      clientId: data.clientId,
      clientSecret: encryptedClientSecret,
      username: data.username,
      password: encryptedPassword,
      isConnected,
      connectionTestAt,
      ownerId: currentUser.id as any,
    });

    // Increment tenant usage after successful creation
    await incrementUsage("tenants");

    revalidatePath("/dashboard/settings");
    return { success: true, data: { tenantId } };
  } catch (error) {
    console.error("Error creating tenant:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create tenant";
    console.error("Detailed error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Update a tenant
 */
export async function updateTenant(
  tenantId: string,
  data: {
    name?: string;
    description?: string;
    tenantUrl?: string;
    authType?: "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY";
    authenticationUrl?: string;
    clientId?: string;
    clientSecret?: string;
    username?: string;
    password?: string;
  }
): Promise<ActionResult<void>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    // Check if user has admin rights on this tenant
    const membership = await convex.query(api.tenants.getMembership, {
      userId: currentUser.id as any,
      tenantId: tenantId as any,
    });

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      return { success: false, error: "You don't have permission to update this tenant" };
    }

    const updateData: any = {};

    if (data.name) {
      const newSlug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      updateData.name = data.name;
      updateData.slug = newSlug;
    }

    if (data.description !== undefined) updateData.description = data.description;
    if (data.tenantUrl) updateData.tenantUrl = data.tenantUrl;
    if (data.authType) updateData.authType = data.authType;
    if (data.authenticationUrl !== undefined) updateData.authenticationUrl = data.authenticationUrl;
    if (data.clientId !== undefined) updateData.clientId = data.clientId;
    if (data.clientSecret) updateData.clientSecret = await encrypt(data.clientSecret);
    if (data.username !== undefined) updateData.username = data.username;
    if (data.password) updateData.password = await encrypt(data.password);

    await convex.mutation(api.tenantMutations.update, {
      id: tenantId as any,
      ...updateData,
    });

    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    console.error("Error updating tenant:", error);
    return { success: false, error: "Failed to update tenant" };
  }
}

/**
 * Delete a tenant
 */
export async function deleteTenant(tenantId: string): Promise<ActionResult<void>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    // Check if user is the owner of this tenant
    const membership = await convex.query(api.tenants.getMembership, {
      userId: currentUser.id as any,
      tenantId: tenantId as any,
    });

    if (!membership || membership.role !== "OWNER") {
      return { success: false, error: "Only the owner can delete this tenant" };
    }

    await convex.mutation(api.tenantMutations.deleteTenant, {
      id: tenantId as any,
    });

    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    console.error("Error deleting tenant:", error);
    return { success: false, error: "Failed to delete tenant" };
  }
}

/**
 * Get OAuth token from SAP CPI
 */
async function getSAPToken(
  authenticationUrl: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(authenticationUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get OAuth token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OAuth token request timed out');
    }
    throw error;
  }
}

/**
 * Map SAP CPI status to our ExecutionStatus enum
 */
function mapExecutionStatus(sapStatus: string): "COMPLETED" | "FAILED" | "PROCESSING" | "RETRY" | "SKIPPED" {
  const statusMap: Record<string, "COMPLETED" | "FAILED" | "PROCESSING" | "RETRY" | "SKIPPED"> = {
    "COMPLETED": "COMPLETED",
    "FAILED": "FAILED",
    "PROCESSING": "PROCESSING",
    "RETRY": "RETRY",
    "DISCARDED": "SKIPPED",
    "ESCALATED": "FAILED",
    "ABANDONED": "FAILED",
  };
  return statusMap[sapStatus?.toUpperCase()] || "PROCESSING";
}

/**
 * Map error message to ErrorCategory
 */
function categorizeError(errorMessage: string | null): "SYSTEM" | "NETWORK" | "MAPPING" | "SECURITY" | "TIMEOUT" | "BUSINESS_LOGIC" | "UNKNOWN" | null {
  if (!errorMessage) return null;

  const lowerError = errorMessage.toLowerCase();

  if (lowerError.includes("timeout") || lowerError.includes("timed out")) return "TIMEOUT";
  if (lowerError.includes("connection") || lowerError.includes("network") || lowerError.includes("socket")) return "NETWORK";
  if (lowerError.includes("mapping") || lowerError.includes("transform") || lowerError.includes("conversion")) return "MAPPING";
  if (lowerError.includes("auth") || lowerError.includes("certificate") || lowerError.includes("credential") || lowerError.includes("permission")) return "SECURITY";
  if (lowerError.includes("business") || lowerError.includes("validation") || lowerError.includes("invalid")) return "BUSINESS_LOGIC";
  if (lowerError.includes("system") || lowerError.includes("internal") || lowerError.includes("server")) return "SYSTEM";

  return "UNKNOWN";
}

/**
 * Sync execution logs for all iFlows from SAP CPI in a single API call
 * This is optimized for performance - fetches all logs at once instead of per-iFlow
 */
export async function syncTenantExecutions(
  tenantId: string,
  accessToken: string,
  tenantUrl: string,
  options: {
    daysBack?: number;
    silent?: boolean;
    maxLogs?: number;
  } = {}
): Promise<{ synced: number; errors: number }> {
  const {
    daysBack = EXECUTION_SYNC_CONFIG.daysToSync,
    silent = false,
    maxLogs = 500
  } = options;

  let totalSynced = 0;

  try {
    // Get all iFlows for this tenant to map logs to
    const iFlows = await convex.query(api.iflows.listByTenant, {
      tenantId: tenantId as any
    });

    if (iFlows.length === 0) {
      if (!silent) console.log("[Sync] No iFlows found for tenant");
      return { synced: 0, errors: 0 };
    }

    // Build a map of iFlow IDs (multiple formats) to database IDs
    const convertToUnderscoreFormat = (id: string): string => {
      return id.replace(/([a-z])([A-Z])/g, '$1_$2');
    };

    const iFlowMap = new Map<string, { id: string; name: string }>();
    for (const iflow of iFlows) {
      const variants = [
        iflow.iFlowId,
        iflow.iFlowId.toLowerCase(),
        convertToUnderscoreFormat(iflow.iFlowId),
        convertToUnderscoreFormat(iflow.iFlowId).toLowerCase(),
        iflow.name,
        iflow.name.toLowerCase(),
      ];
      for (const variant of variants) {
        iFlowMap.set(variant, { id: iflow._id, name: iflow.name });
      }
    }

    // Calculate date filter
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    if (!silent) console.log(`[Sync] Fetching all message logs (last ${daysBack} days, max ${maxLogs})...`);

    // Fetch ALL message logs in ONE API call
    const logsUrl = `${tenantUrl}/api/v1/MessageProcessingLogs?$format=json&$orderby=LogEnd desc&$top=${maxLogs}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const logsResponse = await fetch(logsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!logsResponse.ok) {
      const errorText = await logsResponse.text().catch(() => "Unknown error");
      if (!silent) console.error(`[Sync] Failed to fetch logs: ${logsResponse.status} - ${errorText.substring(0, 200)}`);
      return { synced: 0, errors: 1 };
    }

    const logsData = await logsResponse.json();
    const allLogs = logsData.d?.results || [];

    if (!silent) console.log(`[Sync] Fetched ${allLogs.length} total message logs from SAP CPI`);

    if (allLogs.length === 0) {
      return { synced: 0, errors: 0 };
    }

    // Helper to parse SAP OData date format
    const parseSAPDate = (dateValue: any): Date | null => {
      if (!dateValue) return null;
      if (typeof dateValue === 'string') {
        const odataMatch = dateValue.match(/\/Date\((\d+)\)\//);
        if (odataMatch) return new Date(parseInt(odataMatch[1], 10));
        const parsed = new Date(dateValue);
        if (!isNaN(parsed.getTime())) return parsed;
      }
      if (typeof dateValue === 'number') return new Date(dateValue);
      return null;
    };

    // Process and filter logs
    const logsToInsert: any[] = [];
    const iFlowLastExecuted = new Map<string, number>();

    for (const log of allLogs) {
      const logDate = parseSAPDate(log.LogEnd) || parseSAPDate(log.LogStart);
      if (logDate && logDate < sinceDate) continue;

      // Find matching iFlow
      const artifactId = log.IntegrationArtifact?.Id || log.IntegrationFlowName || '';
      const iflowMatch = iFlowMap.get(artifactId) || iFlowMap.get(artifactId.toLowerCase());
      if (!iflowMatch) continue;

      const messageId = log.MessageGuid || log.MessageId;
      if (!messageId) continue;

      const startTime = parseSAPDate(log.LogStart) || new Date();
      const endTime = parseSAPDate(log.LogEnd);
      const duration = startTime && endTime ? endTime.getTime() - startTime.getTime() : null;

      logsToInsert.push({
        messageId,
        status: mapExecutionStatus(log.Status),
        startTime: startTime.getTime(),
        endTime: endTime?.getTime(),
        duration,
        sender: log.Sender || undefined,
        receiver: log.Receiver || undefined,
        interfaceType: log.IntegrationArtifact?.Type || undefined,
        errorMessage: log.Status?.toUpperCase() === "FAILED" ? (log.ErrorMessage || "Error occurred") : undefined,
        errorCategory: log.Status?.toUpperCase() === "FAILED" ? categorizeError(log.ErrorMessage) : undefined,
        iFlowId: iflowMatch.id,
      });

      // Track latest execution per iFlow
      if (startTime) {
        const current = iFlowLastExecuted.get(iflowMatch.id);
        if (!current || startTime.getTime() > current) {
          iFlowLastExecuted.set(iflowMatch.id, startTime.getTime());
        }
      }
    }

    if (!silent) console.log(`[Sync] ${logsToInsert.length} logs matched to known iFlows`);

    if (logsToInsert.length === 0) return { synced: 0, errors: 0 };

    // Batch insert using Convex mutation
    const result = await convex.mutation(api.iflowMutations.batchCreateExecutions, {
      executions: logsToInsert,
    });

    totalSynced = result.created;

    // Update lastExecutedAt for affected iFlows
    for (const [id, time] of iFlowLastExecuted.entries()) {
      try {
        await convex.mutation(api.iflowMutations.update, {
          id: id as any,
          lastExecutedAt: time,
        });
      } catch {
        // Ignore errors
      }
    }

    if (!silent) console.log(`[Sync] Successfully synced ${totalSynced} executions`);
    return { synced: totalSynced, errors: 0 };
  } catch (error) {
    console.error("[Sync] Error:", error);
    return { synced: totalSynced, errors: 1 };
  }
}

/**
 * Internal function to sync a tenant without user authentication
 * Used by cron jobs and background tasks
 */
export async function syncTenantInternal(tenantId: string): Promise<ActionResult<{ iflows: number; executions: number }>> {
  try {
    const tenant = await convex.query(api.tenants.getById, { id: tenantId as any });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    if (!tenant.tenantUrl || tenant.authType !== "OAUTH" || !tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
      return { success: false, error: "Tenant credentials not configured" };
    }

    const decryptedClientSecret = await decrypt(tenant.clientSecret);
    const accessToken = await getSAPToken(
      tenant.authenticationUrl,
      tenant.clientId,
      decryptedClientSecret
    );

    // Sync iFlows - First get runtime artifacts for status
    const iflowsUrl = `${tenant.tenantUrl}/api/v1/IntegrationRuntimeArtifacts`;
    const iflowsResponse = await fetch(iflowsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (!iflowsResponse.ok) {
      throw new Error(`Failed to fetch iFlows: ${iflowsResponse.status}`);
    }

    const iflowsData = await iflowsResponse.json();
    const runtimeIflows = iflowsData.d?.results || [];

    // Create a map of iFlow ID to runtime info (status, deployedOn, etc.)
    const runtimeMap = new Map<string, any>();
    for (const iflow of runtimeIflows) {
      runtimeMap.set(iflow.Id, iflow);
    }

    // Fetch packages and their artifacts to get PackageId for each iFlow
    const packagesUrl = `${tenant.tenantUrl}/api/v1/IntegrationPackages`;
    const packagesResponse = await fetch(packagesUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    // Map iFlow ID to package ID
    const packageMap = new Map<string, string>();

    if (packagesResponse.ok) {
      const packagesData = await packagesResponse.json();
      const packages = packagesData.d?.results || [];

      // For each package, fetch its design-time artifacts
      for (const pkg of packages) {
        try {
          const artifactsUrl = `${tenant.tenantUrl}/api/v1/IntegrationPackages('${pkg.Id}')/IntegrationDesigntimeArtifacts`;
          const artifactsResponse = await fetch(artifactsUrl, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Accept": "application/json",
            },
          });

          if (artifactsResponse.ok) {
            const artifactsData = await artifactsResponse.json();
            const artifacts = artifactsData.d?.results || [];

            for (const artifact of artifacts) {
              packageMap.set(artifact.Id, pkg.Id);
            }
          }
        } catch (err) {
          // Continue with other packages if one fails
          console.warn(`Failed to fetch artifacts for package ${pkg.Id}:`, err);
        }
      }
    }

    // Batch sync iFlows using Convex - combine runtime status with package info
    const iflowsToSync = runtimeIflows.map((iflow: any) => ({
      iFlowId: iflow.Id,
      name: iflow.Name || iflow.Id,
      packageName: packageMap.get(iflow.Id) || undefined,
      version: iflow.Version,
      status: iflow.Status === "STARTED" ? "STARTED" as const : "STOPPED" as const,
      lastDeployedAt: iflow.DeployedOn ? new Date(iflow.DeployedOn).getTime() : undefined,
    }));

    await convex.mutation(api.iflowMutations.batchUpsert, {
      tenantId: tenantId as any,
      iFlows: iflowsToSync,
    });

    // Sync executions
    const executionResult = await syncTenantExecutions(tenantId, accessToken, tenant.tenantUrl, { silent: true });

    // Update tenant
    await convex.mutation(api.tenantMutations.update, {
      id: tenantId as any,
      lastSyncAt: Date.now(),
      isConnected: true,
    });

    return {
      success: true,
      data: { iflows: runtimeIflows.length, executions: executionResult.synced }
    };
  } catch (error) {
    console.error(`Error syncing tenant ${tenantId}:`, error);

    try {
      await convex.mutation(api.tenantMutations.update, {
        id: tenantId as any,
        isConnected: false,
      });
    } catch {
      // Ignore update errors
    }

    return { success: false, error: error instanceof Error ? error.message : "Sync failed" };
  }
}

/**
 * Sync iFlows and executions from SAP CPI tenant
 */
export async function syncTenantIFlows(
  tenantId: string,
  options: { syncExecutions?: boolean } = { syncExecutions: true }
): Promise<ActionResult<{ count: number; executionsSynced?: number }>> {
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

    if (!membership) {
      return { success: false, error: "You don't have access to this tenant" };
    }

    // Get tenant details
    const tenant = await convex.query(api.tenants.getById, { id: tenantId as any });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Validate tenant configuration
    if (!tenant.tenantUrl) {
      return { success: false, error: "Tenant URL is not configured" };
    }

    let accessToken: string;

    // Get authentication token based on auth type
    if (tenant.authType === "OAUTH") {
      if (!tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
        return { success: false, error: "OAuth credentials not configured" };
      }

      const decryptedClientSecret = await decrypt(tenant.clientSecret);
      accessToken = await getSAPToken(
        tenant.authenticationUrl,
        tenant.clientId,
        decryptedClientSecret
      );
    } else {
      return { success: false, error: "Only OAuth authentication is currently supported" };
    }

    // Fetch iFlows from SAP CPI - Runtime Artifacts for status
    const iflowsUrl = `${tenant.tenantUrl}/api/v1/IntegrationRuntimeArtifacts`;
    const iflowsResponse = await fetch(iflowsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (!iflowsResponse.ok) {
      const errorText = await iflowsResponse.text();
      throw new Error(`Failed to fetch iFlows: ${iflowsResponse.status} - ${errorText}`);
    }

    const iflowsData = await iflowsResponse.json();
    const runtimeIflows = iflowsData.d?.results || [];

    // Debug: Log first iFlow structure to understand the API response
    if (runtimeIflows.length > 0) {
      console.log('[Sync] Sample iFlow from API:', JSON.stringify(runtimeIflows[0], null, 2));
    }

    // Fetch packages to get PackageId for each iFlow
    const packagesUrl = `${tenant.tenantUrl}/api/v1/IntegrationPackages`;
    const packageMap = new Map<string, string>();

    try {
      const packagesResponse = await fetch(packagesUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
      });

      if (packagesResponse.ok) {
        const packagesData = await packagesResponse.json();
        const packages = packagesData.d?.results || [];

        console.log(`[Sync] Found ${packages.length} packages, fetching artifacts...`);

        // For each package, fetch its design-time artifacts
        for (const pkg of packages) {
          try {
            const artifactsUrl = `${tenant.tenantUrl}/api/v1/IntegrationPackages('${pkg.Id}')/IntegrationDesigntimeArtifacts`;
            const artifactsResponse = await fetch(artifactsUrl, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Accept": "application/json",
              },
            });

            if (artifactsResponse.ok) {
              const artifactsData = await artifactsResponse.json();
              const artifacts = artifactsData.d?.results || [];

              for (const artifact of artifacts) {
                packageMap.set(artifact.Id, pkg.Id);
              }
            }
          } catch (err) {
            console.warn(`[Sync] Failed to fetch artifacts for package ${pkg.Id}:`, err);
          }
        }

        console.log(`[Sync] Mapped ${packageMap.size} iFlows to packages`);
      }
    } catch (err) {
      console.warn('[Sync] Failed to fetch packages, continuing without package info:', err);
    }

    // Batch sync iFlows using Convex
    console.time('iFlow sync');

    const iflowsToSync = runtimeIflows.map((iflow: any) => ({
      iFlowId: iflow.Id,
      name: iflow.Name || iflow.Id,
      packageName: packageMap.get(iflow.Id) || undefined,
      version: iflow.Version,
      status: iflow.Status === "STARTED" ? "STARTED" as const : "STOPPED" as const,
      lastDeployedAt: iflow.DeployedOn ? new Date(iflow.DeployedOn).getTime() : undefined,
    }));

    // Check subscription limit for iFlows before syncing
    // We need to determine how many NEW iFlows would be created
    const existingIFlows = await convex.query(api.iflows.listByTenant, {
      tenantId: tenantId as any,
    });
    const existingIFlowIds = new Set(existingIFlows.map((iflow: any) => iflow.iFlowId));
    const newIFlowsCount = iflowsToSync.filter(iflow => !existingIFlowIds.has(iflow.iFlowId)).length;

    if (newIFlowsCount > 0) {
      // Check if we can add these new iFlows
      const limitCheck = await checkSubscriptionLimit("iflows");
      if (!limitCheck.success) {
        return { success: false, error: limitCheck.error };
      }

      if (!limitCheck.data?.allowed) {
        const { current, max } = limitCheck.data || { current: 0, max: 0 };
        // Calculate how many we can still add
        const remainingSlots = max === -1 ? Infinity : Math.max(0, max - current);

        if (remainingSlots === 0) {
          return {
            success: false,
            error: `iFlow limit reached (${current}/${max}). Please upgrade your plan to sync more iFlows.`,
          };
        }

        // Filter to only sync existing iFlows + as many new ones as we can fit
        const newIFlowsToAdd = iflowsToSync
          .filter(iflow => !existingIFlowIds.has(iflow.iFlowId))
          .slice(0, remainingSlots);
        const existingIFlowsToUpdate = iflowsToSync.filter(iflow => existingIFlowIds.has(iflow.iFlowId));

        // Replace iflowsToSync with the limited set
        iflowsToSync.length = 0;
        iflowsToSync.push(...existingIFlowsToUpdate, ...newIFlowsToAdd);

        console.log(`[Sync] Limited to ${newIFlowsToAdd.length} new iFlows due to subscription limit`);
      }
    }

    const syncResult = await convex.mutation(api.iflowMutations.batchUpsert, {
      tenantId: tenantId as any,
      iFlows: iflowsToSync,
    });

    // Increment iFlow usage for newly created iFlows
    if (syncResult.created > 0) {
      for (let i = 0; i < syncResult.created; i++) {
        await incrementUsage("iflows");
      }
    }

    const syncedCount = syncResult.created + syncResult.updated;
    console.timeEnd('iFlow sync');
    console.log(`Synced ${syncedCount} iFlows (${syncResult.updated} updated, ${syncResult.created} created)`);

    // Sync executions if enabled
    let executionsSynced = 0;
    if (options.syncExecutions !== false) {
      console.time('Execution sync');
      const executionResult = await syncTenantExecutions(
        tenantId,
        accessToken,
        tenant.tenantUrl,
        { silent: false }
      );
      executionsSynced = executionResult.synced;
      console.timeEnd('Execution sync');
      console.log(`Synced ${executionsSynced} executions (${executionResult.errors} errors)`);
    }

    // Update tenant's last sync time
    await convex.mutation(api.tenantMutations.update, {
      id: tenantId as any,
      lastSyncAt: Date.now(),
      isConnected: true,
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/iflows");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: {
        count: syncedCount,
        executionsSynced,
      }
    };
  } catch (error) {
    console.error("Error syncing iFlows:", error);

    // Update tenant connection status
    try {
      await convex.mutation(api.tenantMutations.update, {
        id: tenantId as any,
        isConnected: false,
      });
    } catch (updateError) {
      console.error("Failed to update tenant connection status:", updateError);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync iFlows"
    };
  }
}

