"use server";

import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import { users, tenantMembers, cpiTenants, iFlows, iFlowExecutions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";
import type { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";

// Configuration for execution sync
const EXECUTION_SYNC_CONFIG = {
  // Number of days to look back for executions
  daysToSync: 30,
  // Maximum executions per iFlow to sync (prevents overwhelming the DB)
  maxExecutionsPerIFlow: 100,
  // Batch size for database operations
  batchSize: 50,
};

type SAPMessageProcessingLog = {
  LogStart?: unknown;
  LogEnd?: unknown;
  Status?: string;
  MessageGuid?: string;
  MessageId?: string;
  IntegrationFlowName?: string;
  IntegrationArtifact?: {
    Id?: string;
    Type?: string;
  };
  Sender?: string;
  Receiver?: string;
  ErrorMessage?: string | null;
};

type ExecutionLogInsert = {
  messageId: string;
  status: "COMPLETED" | "FAILED" | "PROCESSING" | "RETRY" | "SKIPPED";
  startTime: Date;
  endTime: Date | null;
  duration: number | null;
  sender?: string;
  receiver?: string;
  interfaceType?: string;
  errorMessage?: string;
  errorCategory: "SYSTEM" | "NETWORK" | "MAPPING" | "SECURITY" | "TIMEOUT" | "BUSINESS_LOGIC" | "UNKNOWN" | null;
  iFlowId: string;
};

export interface TenantWithRole {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tenantUrl: string;
  authType: string;
  // Non-sensitive config fields (no secrets/passwords)
  authenticationUrl: string | null;
  clientId: string | null;
  username: string | null;
  apimUrl: string | null;
  tokenUrl: string | null;
  // APIM-specific credentials (non-sensitive parts only)
  apimAuthType: string | null;
  apimClientId: string | null;
  apimUsername: string | null;
  // Secrets are NOT included — only boolean indicators
  hasClientSecret: boolean;
  hasPassword: boolean;
  hasApimClientSecret: boolean;
  hasApimPassword: boolean;
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

    const memberships = await db.query.tenantMembers.findMany({
      where: eq(tenantMembers.userId, currentUser.id),
      with: { tenant: true },
      orderBy: (tenantMembers, { desc }) => [desc(tenantMembers.joinedAt)],
    });

    const tenants: TenantWithRole[] = memberships.map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      description: m.tenant.description ?? null,
      tenantUrl: m.tenant.tenantUrl,
      authType: m.tenant.authType,
      authenticationUrl: m.tenant.authenticationUrl ?? null,
      clientId: m.tenant.clientId ?? null,
      username: m.tenant.username ?? null,
      apimUrl: m.tenant.apimUrl ?? null,
      tokenUrl: m.tenant.tokenUrl ?? null,
      apimAuthType: m.tenant.apimAuthType ?? null,
      apimClientId: m.tenant.apimClientId ?? null,
      apimUsername: m.tenant.apimUsername ?? null,
      hasClientSecret: !!m.tenant.clientSecret,
      hasPassword: !!m.tenant.password,
      hasApimClientSecret: !!m.tenant.apimClientSecret,
      hasApimPassword: !!m.tenant.apimPassword,
      status: m.tenant.status,
      isConnected: m.tenant.isConnected,
      lastSyncAt: m.tenant.lastSyncAt,
      connectionTestAt: m.tenant.connectionTestAt,
      createdAt: m.tenant.createdAt,
      updatedAt: m.tenant.updatedAt,
      memberRole: m.role,
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
    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, currentUser.id),
        eq(tenantMembers.tenantId, tenantId),
      ),
    });

    if (!membership) {
      return { success: false, error: "You don't have access to this tenant" };
    }

    // Get tenant details
    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, tenantId),
    });

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
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        description: tenant.description ?? null,
        tenantUrl: tenant.tenantUrl,
        tmUrl: tenant.tenantUrl,
        authType: tenant.authType,
        authenticationUrl: tenant.authenticationUrl ?? undefined,
        clientId: tenant.clientId ?? undefined,
        username: tenant.username ?? undefined,
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
    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, currentUser.id),
        eq(tenantMembers.tenantId, tenantId),
      ),
    });

    if (!membership) {
      return { success: false, error: "You don't have access to this tenant" };
    }

    // Update user's default tenant
    await db.update(users).set({ defaultTenantId: tenantId }).where(eq(users.id, currentUser.id));

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
  apimUrl?: string;
  tokenUrl?: string;
  // APIM-specific credentials (all optional; null/absent = use CPI credentials)
  apimAuthType?: "OAUTH" | "BASIC_AUTH" | null;
  apimClientId?: string;
  apimClientSecret?: string;
  apimUsername?: string;
  apimPassword?: string;
}): Promise<ActionResult<{ tenantId: string }>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const tenantSlug = data.tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if current user already has a tenant with this name
    const userExistingTenantResult = await db.select({ id: cpiTenants.id })
      .from(cpiTenants)
      .innerJoin(tenantMembers, eq(tenantMembers.tenantId, cpiTenants.id))
      .where(and(
        eq(cpiTenants.slug, tenantSlug),
        eq(tenantMembers.userId, currentUser.id),
      ))
      .limit(1);

    if (userExistingTenantResult.length > 0) {
      return { success: false, error: "Tenant name already exists. Please choose another." };
    }

    // If slug is globally taken by another user's tenant, append a unique suffix
    let finalSlug = tenantSlug;
    const globalSlugConflict = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.slug, tenantSlug),
    });
    if (globalSlugConflict) {
      finalSlug = `${tenantSlug}-${currentUser.id.slice(-6)}`;
    }

    // Encrypt sensitive credentials if provided
    const encryptedClientSecret = data.clientSecret ? await encrypt(data.clientSecret) : undefined;
    const encryptedPassword = data.password ? await encrypt(data.password) : undefined;
    const encryptedApimClientSecret = data.apimClientSecret ? await encrypt(data.apimClientSecret) : undefined;
    const encryptedApimPassword = data.apimPassword ? await encrypt(data.apimPassword) : undefined;

    // Test OAuth connection if credentials provided
    let isConnected = false;
    let connectionTestAt: Date | undefined;

    if (data.authType === "OAUTH" && data.authenticationUrl && data.clientId && data.clientSecret) {
      try {
        await getSAPToken(data.authenticationUrl, data.clientId, data.clientSecret);
        isConnected = true;
        connectionTestAt = new Date();
      } catch (error) {
        console.warn("⚠️ OAuth connection failed:", error instanceof Error ? error.message : "Unknown error");
        isConnected = false;
      }
    }

    // Create tenant and add user as owner in a transaction
    const tenant = await db.transaction(async (tx) => {
      const [newTenant] = await tx.insert(cpiTenants).values({
          name: data.tenantName,
          slug: finalSlug,
          description: data.description,
          tenantUrl: data.tenantUrl,
          authType: data.authType,
          authenticationUrl: data.authenticationUrl,
          clientId: data.clientId,
          clientSecret: encryptedClientSecret,
          username: data.username,
          password: encryptedPassword,
          apimUrl: data.apimUrl || null,
          tokenUrl: data.tokenUrl || null,
          apimAuthType: data.apimAuthType || null,
          apimClientId: data.apimClientId || null,
          apimClientSecret: encryptedApimClientSecret || null,
          apimUsername: data.apimUsername || null,
          apimPassword: encryptedApimPassword || null,
          isConnected,
          connectionTestAt,
      }).returning();

      // Add user as OWNER
      await tx.insert(tenantMembers).values({
          userId: currentUser.id,
          tenantId: newTenant.id,
          role: "OWNER",
      });

      return newTenant;
    });

    revalidatePath("/dashboard/settings");
    return { success: true, data: { tenantId: tenant.id } };
  } catch (error) {
    console.error("Error creating tenant:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create tenant";
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
    apimUrl?: string | null;
    tokenUrl?: string | null;
    // APIM-specific credentials
    apimAuthType?: "OAUTH" | "BASIC_AUTH" | null;
    apimClientId?: string | null;
    apimClientSecret?: string;
    apimUsername?: string | null;
    apimPassword?: string;
  }
): Promise<ActionResult<void>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    // Check if user has admin rights on this tenant
    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, currentUser.id),
        eq(tenantMembers.tenantId, tenantId),
      ),
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
    if (data.apimUrl !== undefined) updateData.apimUrl = data.apimUrl;
    if (data.tokenUrl !== undefined) updateData.tokenUrl = data.tokenUrl;
    if (data.apimAuthType !== undefined) updateData.apimAuthType = data.apimAuthType;
    if (data.apimClientId !== undefined) updateData.apimClientId = data.apimClientId;
    if (data.apimClientSecret) updateData.apimClientSecret = await encrypt(data.apimClientSecret);
    if (data.apimUsername !== undefined) updateData.apimUsername = data.apimUsername;
    if (data.apimPassword) updateData.apimPassword = await encrypt(data.apimPassword);

    await db.update(cpiTenants).set(updateData).where(eq(cpiTenants.id, tenantId));

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
    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, currentUser.id),
        eq(tenantMembers.tenantId, tenantId),
      ),
    });

    if (!membership || membership.role !== "OWNER") {
      return { success: false, error: "Only the owner can delete this tenant" };
    }

    await db.delete(cpiTenants).where(eq(cpiTenants.id, tenantId));

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
 * Build the Authorization header for a CPI tenant (OAUTH or BASIC_AUTH)
 */
async function getAuthHeaderForTenant(tenant: { authType: string; authenticationUrl: string | null; clientId: string | null; clientSecret: string | null; username: string | null; password: string | null }): Promise<string> {
  if (tenant.authType === "OAUTH") {
    if (!tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
      throw new Error("OAuth credentials not configured");
    }
    const decryptedSecret = await decrypt(tenant.clientSecret);
    const accessToken = await getSAPToken(tenant.authenticationUrl, tenant.clientId, decryptedSecret);
    return `Bearer ${accessToken}`;
  }

  if (tenant.authType === "BASIC_AUTH") {
    if (!tenant.username || !tenant.password) {
      throw new Error("Basic Auth credentials not configured");
    }
    let password: string;
    try {
      password = await decrypt(tenant.password);
    } catch {
      password = tenant.password;
    }
    return `Basic ${Buffer.from(`${tenant.username}:${password}`).toString("base64")}`;
  }

  throw new Error(`Unsupported auth type: ${tenant.authType}`);
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
 */
export async function syncTenantExecutions(
  tenantId: string,
  authHeader: string,
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
    maxLogs = 5000
  } = options;

  let totalSynced = 0;
  void silent;

  try {
    // Get all iFlows for this tenant
    const iFlowsList = await db.query.iFlows.findMany({
      where: eq(iFlows.tenantId, tenantId),
    });

    if (iFlowsList.length === 0) {
      return { synced: 0, errors: 0 };
    }

    // Build a map of iFlow IDs to database IDs
    const convertToUnderscoreFormat = (id: string): string => {
      return id.replace(/([a-z])([A-Z])/g, '$1_$2');
    };

    const iFlowMap = new Map<string, { id: string; name: string }>();
    for (const iflow of iFlowsList) {
      const variants = [
        iflow.iFlowId,
        iflow.iFlowId.toLowerCase(),
        convertToUnderscoreFormat(iflow.iFlowId),
        convertToUnderscoreFormat(iflow.iFlowId).toLowerCase(),
        iflow.name,
        iflow.name.toLowerCase(),
      ];
      for (const variant of variants) {
        iFlowMap.set(variant, { id: iflow.id, name: iflow.name });
      }
    }

    // Calculate date filter
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    if (maxLogs <= 0) {
      return { synced: 0, errors: 0 };
    }

    const now = new Date();
    const firstDay = new Date(Date.UTC(
      sinceDate.getUTCFullYear(),
      sinceDate.getUTCMonth(),
      sinceDate.getUTCDate(),
    ));
    const pageSize = Math.min(500, maxLogs);
    const allLogs: SAPMessageProcessingLog[] = [];

    for (const dayStart = new Date(firstDay); dayStart < now; dayStart.setUTCDate(dayStart.getUTCDate() + 1)) {
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const fromDateStr = dayStart.toISOString().split(".")[0];
      const toDateStr = (dayEnd < now ? dayEnd : now).toISOString().split(".")[0];
      const filterQuery = `LogStart ge datetime'${fromDateStr}' and LogStart lt datetime'${toDateStr}'`;
      let fetchedForDay = 0;

      for (let skip = 0; skip < maxLogs; skip += pageSize) {
        const top = Math.min(pageSize, maxLogs - fetchedForDay);
        const logsUrl = `${tenantUrl}/api/v1/MessageProcessingLogs?$format=json&$orderby=LogStart desc&$filter=${encodeURIComponent(filterQuery)}&$top=${top}&$skip=${skip}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        const logsResponse = await fetch(logsUrl, {
          method: "GET",
          headers: {
            "Authorization": authHeader,
            "Accept": "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!logsResponse.ok) {
          return { synced: totalSynced, errors: 1 };
        }

        const logsData = (await logsResponse.json()) as {
          d?: { results?: SAPMessageProcessingLog[] };
        };
        const pageLogs = logsData.d?.results || [];
        allLogs.push(...pageLogs);
        fetchedForDay += pageLogs.length;

        if (pageLogs.length < top || fetchedForDay >= maxLogs) {
          break;
        }
      }
    }

    if (allLogs.length === 0) {
      return { synced: 0, errors: 0 };
    }

    // Helper to parse SAP OData date format
    const parseSAPDate = (dateValue: unknown): Date | null => {
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
    const logsToInsert: ExecutionLogInsert[] = [];
    const iFlowLastExecuted = new Map<string, Date>();

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
        status: mapExecutionStatus(log.Status ?? ""),
        startTime,
        endTime,
        duration,
        sender: log.Sender || undefined,
        receiver: log.Receiver || undefined,
        interfaceType: log.IntegrationArtifact?.Type || undefined,
        errorMessage: log.Status?.toUpperCase() === "FAILED" ? (log.ErrorMessage || "Error occurred") : undefined,
        errorCategory: log.Status?.toUpperCase() === "FAILED" ? categorizeError(log.ErrorMessage ?? null) : null,
        iFlowId: iflowMatch.id,
      });

      // Track latest execution per iFlow
      if (startTime) {
        const current = iFlowLastExecuted.get(iflowMatch.id);
        if (!current || startTime > current) {
          iFlowLastExecuted.set(iflowMatch.id, startTime);
        }
      }
    }

    if (logsToInsert.length === 0) return { synced: 0, errors: 0 };

    // Batch insert executions using Drizzle
    // Use onConflictDoUpdate to handle existing messageIds
    let created = 0;
    for (const log of logsToInsert) {
      try {
        await db.insert(iFlowExecutions).values({
            messageId: log.messageId,
            status: log.status,
            startTime: log.startTime,
            endTime: log.endTime,
            duration: log.duration,
            sender: log.sender,
            receiver: log.receiver,
            interfaceType: log.interfaceType,
            errorMessage: log.errorMessage,
            errorCategory: log.errorCategory,
            iFlowId: log.iFlowId,
        }).onConflictDoUpdate({
          target: iFlowExecutions.messageId,
          set: {
            status: log.status,
            endTime: log.endTime,
            duration: log.duration,
            errorMessage: log.errorMessage,
            errorCategory: log.errorCategory,
          },
        });
        created++;
      } catch {
        // Skip duplicates or errors
      }
    }

    totalSynced = created;

    // Update lastExecutedAt for affected iFlows
    for (const [id, time] of iFlowLastExecuted.entries()) {
      try {
        await db.update(iFlows).set({ lastExecutedAt: time }).where(eq(iFlows.id, id));
      } catch {
        // Ignore errors
      }
    }

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
    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, tenantId),
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    if (!tenant.tenantUrl) {
      return { success: false, error: "Tenant URL not configured" };
    }

    let authHeader: string;
    try {
      authHeader = await getAuthHeaderForTenant(tenant);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Auth credentials not configured" };
    }

    // Sync iFlows - First get runtime artifacts for status
    const iflowsUrl = `${tenant.tenantUrl}/api/v1/IntegrationRuntimeArtifacts`;
    const iflowsResponse = await fetch(iflowsUrl, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
    });

    if (!iflowsResponse.ok) {
      throw new Error(`Failed to fetch iFlows: ${iflowsResponse.status}`);
    }

    const iflowsData = await iflowsResponse.json();
    const runtimeIflows = iflowsData.d?.results || [];

    // Create a map of iFlow ID to runtime info
    const runtimeMap = new Map<string, any>();
    for (const iflow of runtimeIflows) {
      runtimeMap.set(iflow.Id, iflow);
    }

    // Fetch packages and their artifacts to get PackageId for each iFlow
    const packagesUrl = `${tenant.tenantUrl}/api/v1/IntegrationPackages`;
    const packagesResponse = await fetch(packagesUrl, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
    });

    const packageMap = new Map<string, string>();

    if (packagesResponse.ok) {
      const packagesData = await packagesResponse.json();
      const packages = packagesData.d?.results || [];

      for (const pkg of packages) {
        try {
          const artifactsUrl = `${tenant.tenantUrl}/api/v1/IntegrationPackages('${pkg.Id}')/IntegrationDesigntimeArtifacts`;
          const artifactsResponse = await fetch(artifactsUrl, {
            method: "GET",
            headers: {
              "Authorization": authHeader,
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
          console.warn(`Failed to fetch artifacts for package ${pkg.Id}:`, err);
        }
      }
    }

    // Batch sync iFlows using Drizzle
    const iflowsToSync = runtimeIflows.map((iflow: any) => ({
      iFlowId: iflow.Id,
      name: iflow.Name || iflow.Id,
      packageName: packageMap.get(iflow.Id) || undefined,
      version: iflow.Version,
      status: iflow.Status === "STARTED" ? "STARTED" as const : "STOPPED" as const,
      lastDeployedAt: iflow.DeployedOn ? new Date(iflow.DeployedOn) : undefined,
    }));

    // Upsert iFlows
    for (const iflowData of iflowsToSync) {
      await db.insert(iFlows).values({
          tenantId,
          iFlowId: iflowData.iFlowId,
          name: iflowData.name,
          packageName: iflowData.packageName,
          version: iflowData.version,
          status: iflowData.status,
          lastDeployedAt: iflowData.lastDeployedAt,
      }).onConflictDoUpdate({
        target: [iFlows.tenantId, iFlows.iFlowId],
        set: {
          name: iflowData.name,
          packageName: iflowData.packageName,
          version: iflowData.version,
          status: iflowData.status,
          lastDeployedAt: iflowData.lastDeployedAt,
        },
      });
    }

    // Sync executions
    const executionResult = await syncTenantExecutions(tenantId, authHeader, tenant.tenantUrl, { silent: true });

    // Update tenant
    await db.update(cpiTenants).set({
      lastSyncAt: new Date(),
      isConnected: true,
    }).where(eq(cpiTenants.id, tenantId));

    return {
      success: true,
      data: { iflows: runtimeIflows.length, executions: executionResult.synced }
    };
  } catch (error) {
    console.error(`Error syncing tenant ${tenantId}:`, error);

    try {
      await db.update(cpiTenants).set({ isConnected: false }).where(eq(cpiTenants.id, tenantId));
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
    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, currentUser.id),
        eq(tenantMembers.tenantId, tenantId),
      ),
    });

    if (!membership) {
      return { success: false, error: "You don't have access to this tenant" };
    }

    // Get tenant details
    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, tenantId),
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Validate tenant configuration
    if (!tenant.tenantUrl) {
      return { success: false, error: "Tenant URL is not configured" };
    }

    let authHeader: string;
    try {
      authHeader = await getAuthHeaderForTenant(tenant);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Auth credentials not configured" };
    }

    // Fetch iFlows from SAP CPI - Runtime Artifacts for status
    const iflowsUrl = `${tenant.tenantUrl}/api/v1/IntegrationRuntimeArtifacts`;
    const iflowsResponse = await fetch(iflowsUrl, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
    });

    if (!iflowsResponse.ok) {
      const errorText = await iflowsResponse.text();
      throw new Error(`Failed to fetch iFlows: ${iflowsResponse.status} - ${errorText}`);
    }

    const iflowsData = await iflowsResponse.json();
    const runtimeIflows = iflowsData.d?.results || [];

    if (runtimeIflows.length > 0) {
    }

    // Fetch packages to get PackageId for each iFlow
    const packagesUrl = `${tenant.tenantUrl}/api/v1/IntegrationPackages`;
    const packageMap = new Map<string, string>();

    try {
      const packagesResponse = await fetch(packagesUrl, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Accept": "application/json",
        },
      });

      if (packagesResponse.ok) {
        const packagesData = await packagesResponse.json();
        const packages = packagesData.d?.results || [];


        for (const pkg of packages) {
          try {
            const artifactsUrl = `${tenant.tenantUrl}/api/v1/IntegrationPackages('${pkg.Id}')/IntegrationDesigntimeArtifacts`;
            const artifactsResponse = await fetch(artifactsUrl, {
              method: "GET",
              headers: {
                "Authorization": authHeader,
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

      }
    } catch (err) {
      console.warn('[Sync] Failed to fetch packages, continuing without package info:', err);
    }

    // Batch sync iFlows
    console.time('iFlow sync');

    const iflowsToSync = runtimeIflows.map((iflow: any) => ({
      iFlowId: iflow.Id,
      name: iflow.Name || iflow.Id,
      packageName: packageMap.get(iflow.Id) || undefined,
      version: iflow.Version,
      status: iflow.Status === "STARTED" ? "STARTED" as const : "STOPPED" as const,
      lastDeployedAt: iflow.DeployedOn ? new Date(iflow.DeployedOn) : undefined,
    }));

    let created = 0;
    let updated = 0;

    for (const iflowData of iflowsToSync) {
      const existing = await db.query.iFlows.findFirst({
        where: and(
          eq(iFlows.tenantId, tenantId),
          eq(iFlows.iFlowId, iflowData.iFlowId),
        ),
      });

      await db.insert(iFlows).values({
          tenantId,
          iFlowId: iflowData.iFlowId,
          name: iflowData.name,
          packageName: iflowData.packageName,
          version: iflowData.version,
          status: iflowData.status,
          lastDeployedAt: iflowData.lastDeployedAt,
      }).onConflictDoUpdate({
        target: [iFlows.tenantId, iFlows.iFlowId],
        set: {
          name: iflowData.name,
          packageName: iflowData.packageName,
          version: iflowData.version,
          status: iflowData.status,
          lastDeployedAt: iflowData.lastDeployedAt,
        },
      });

      if (existing) {
        updated++;
      } else {
        created++;
      }
    }

    const syncedCount = created + updated;
    console.timeEnd('iFlow sync');

    // Sync executions if enabled
    let executionsSynced = 0;
    if (options.syncExecutions !== false) {
      console.time('Execution sync');
      const executionResult = await syncTenantExecutions(
        tenantId,
        authHeader,
        tenant.tenantUrl,
        { silent: false }
      );
      executionsSynced = executionResult.synced;
      console.timeEnd('Execution sync');
    }

    // Update tenant's last sync time
    await db.update(cpiTenants).set({
      lastSyncAt: new Date(),
      isConnected: true,
    }).where(eq(cpiTenants.id, tenantId));

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
      await db.update(cpiTenants).set({ isConnected: false }).where(eq(cpiTenants.id, tenantId));
    } catch (updateError) {
      console.error("Failed to update tenant connection status:", updateError);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to sync iFlows"
    };
  }
}
