"use server";

import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import { users, tenantMembers, cpiTenants, iFlows, iFlowExecutions } from "@/lib/db/schema";
import { eq, and, or, ilike, inArray, count, desc } from "drizzle-orm";
import type { ActionResult } from "@/types/actions";
import { runText } from "@/lib/ai/runtime/text";
import { ERROR_DIAGNOSIS_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { revalidatePath } from "next/cache";
import { getCachedToken, cacheToken } from "@/lib/token-cache";
import { decrypt } from "@/lib/encryption";
import {
  createSAPCPIClient,
  type IFlowConfiguration,
  type IFlowResource,
  type AdapterConfig,
  type MappingConfig,
  type ScriptConfig,
} from "@/lib/sap-cpi/client";
import { parseSAPDate } from "@/lib/sap-date";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper function to get iFlow by either DB ID or SAP CPI iFlow ID
 * Handles both ID formats automatically
 */
export async function getIFlowByAnyId(iflowId: string, userId: string) {
  const trimmedId = iflowId.trim();

  // First try to find by database ID
  try {
    const iflow = await db.query.iFlows.findFirst({ where: eq(iFlows.id, trimmedId) });
    if (iflow) return iflow;
  } catch {
    // Not a valid DB ID format, try by SAP CPI iFlow ID
  }

  // Search by SAP CPI iFlow ID across user's accessible tenants
  const memberships = await db.query.tenantMembers.findMany({
    where: eq(tenantMembers.userId, userId),
    columns: { tenantId: true },
  });

  for (const { tenantId } of memberships) {
    const foundIFlow = await db.query.iFlows.findFirst({
      where: and(
        eq(iFlows.tenantId, tenantId),
        eq(iFlows.iFlowId, trimmedId),
      ),
    });

    if (foundIFlow) {
      return foundIFlow;
    }
  }

  return null;
}

// ============================================================================
// Types
// ============================================================================

export interface IFlowData {
  id: string;
  iFlowId: string;
  name: string;
  packageName: string | null;
  version: string | null;
  status: string;
  lastDeployedAt: Date | null;
  lastExecutedAt: Date | null;
  tenantId: string;
  tenantName: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Extended iFlow data with design-time and runtime details */
export interface IFlowDetailData extends IFlowData {
  // Design-time metadata
  description: string | null;
  sender: string | null;
  receiver: string | null;
  createdBy: string | null;
  modifiedBy: string | null;
  modifiedAt: Date | null;

  // Runtime metadata
  deployedBy: string | null;
  deployedOn: Date | null;
  runtimeStatus: string | null;
  errorInformation: { type: string; message: string } | null;

  // Configuration (from BPMN2 parsing)
  configuration: IFlowConfiguration | null;

  // Link to SAP CPI
  sapCpiWebLink: string | null;

  // Stats
  stats: IFlowStats | null;
}

export interface IFlowStats {
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  successRate: number;
  avgDuration: number;
  lastExecutionStatus: string | null;
  executionsByDay: Array<{ date: string; completed: number; failed: number }>;
}

export { type IFlowConfiguration, type IFlowResource, type AdapterConfig, type MappingConfig, type ScriptConfig };

export interface GetIFlowsParams {
  tenantId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  /** If true, fetch iFlows from all accessible tenants. Otherwise, uses user's defaultTenantId */
  showAllTenants?: boolean;
}

export interface GetIFlowsResult {
  iflows: IFlowData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Get iFlows with filtering, pagination, and sorting
 */
export async function getIFlows(
  params: GetIFlowsParams = {}
): Promise<ActionResult<GetIFlowsResult>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const {
      tenantId,
      status,
      search,
      page = 1,
      pageSize = 10,
      showAllTenants = false,
    } = params;

    // Get user's accessible tenant IDs
    const memberships = await db.query.tenantMembers.findMany({
      where: eq(tenantMembers.userId, currentUser.id),
      columns: { tenantId: true },
    });

    const accessibleTenantIds = memberships.map(m => m.tenantId);

    if (accessibleTenantIds.length === 0) {
      return {
        success: true,
        data: {
          iflows: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        },
      };
    }

    // Determine which tenant(s) to fetch iFlows for
    let targetTenantIds: string[];

    if (tenantId) {
      // Explicit tenant ID provided
      targetTenantIds = [tenantId];
    } else if (!showAllTenants) {
      // Use user's default tenant if available, otherwise use first accessible tenant
      const user = await db.query.users.findFirst({
        where: eq(users.id, currentUser.id),
        columns: { defaultTenantId: true },
      });
      const defaultTenantId = user?.defaultTenantId;

      if (defaultTenantId && accessibleTenantIds.includes(defaultTenantId)) {
        targetTenantIds = [defaultTenantId];
      } else if (accessibleTenantIds.length > 0) {
        targetTenantIds = [accessibleTenantIds[0]];
      } else {
        targetTenantIds = [];
      }
    } else {
      // Show all tenants
      targetTenantIds = accessibleTenantIds;
    }

    // Build Drizzle where clause
    const conditions = [inArray(iFlows.tenantId, targetTenantIds)];

    if (status) {
      conditions.push(eq(iFlows.status, status as any));
    }

    if (search) {
      conditions.push(
        or(
          ilike(iFlows.name, `%${search}%`),
          ilike(iFlows.iFlowId, `%${search}%`),
          ilike(iFlows.packageName, `%${search}%`),
        )!
      );
    }

    const whereClause = and(...conditions);

    // Count + fetch with pagination
    const [totalResult, iflowsList] = await Promise.all([
      db.select({ c: count() }).from(iFlows).where(whereClause).then(r => r[0].c),
      db.query.iFlows.findMany({
        where: whereClause,
        offset: (page - 1) * pageSize,
        limit: pageSize,
        with: { tenant: { columns: { name: true } } },
        orderBy: (iFlows, { desc }) => [desc(iFlows.createdAt)],
      }),
    ]);

    const total = totalResult;

    const iflowsData: IFlowData[] = iflowsList.map((iflow) => ({
      id: iflow.id,
      iFlowId: iflow.iFlowId,
      name: iflow.name,
      packageName: iflow.packageName ?? null,
      version: iflow.version ?? null,
      status: iflow.status,
      lastDeployedAt: iflow.lastDeployedAt,
      lastExecutedAt: iflow.lastExecutedAt,
      tenantId: iflow.tenantId,
      tenantName: iflow.tenant.name,
      createdAt: iflow.createdAt,
      updatedAt: iflow.updatedAt,
    }));

    return {
      success: true,
      data: {
        iflows: iflowsData,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Error fetching iFlows:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch iFlows";
    return { success: false, error: errorMessage };
  }
}

/**
 * Get all tenants accessible by the current user
 */
export async function getUserTenantsForFilter(): Promise<
  ActionResult<Array<{ id: string; name: string }>>
> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const memberships = await db.query.tenantMembers.findMany({
      where: eq(tenantMembers.userId, currentUser.id),
      with: { tenant: { columns: { id: true, name: true } } },
    });

    const tenants = memberships.map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
    }));

    return { success: true, data: tenants };
  } catch (error) {
    console.error("Error fetching tenants:", error);
    return { success: false, error: "Failed to fetch tenants" };
  }
}

/**
 * Get detailed iFlow information by ID
 * Returns basic data from database - use getIFlowFullDetails for SAP CPI data
 */
export async function getIFlowDetails(iflowId: string): Promise<ActionResult<IFlowData>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const iflow = await getIFlowByAnyId(iflowId, currentUser.id);

    if (!iflow) {
      return { success: false, error: "iFlow not found" };
    }

    // Get tenant details
    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, iflow.tenantId),
    });

    // Check if user has access to this tenant
    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, currentUser.id),
        eq(tenantMembers.tenantId, iflow.tenantId),
      ),
    });

    if (!membership) {
      return { success: false, error: "You don't have access to this iFlow" };
    }

    const iflowData: IFlowData = {
      id: iflow.id,
      iFlowId: iflow.iFlowId,
      name: iflow.name,
      packageName: iflow.packageName ?? null,
      version: iflow.version ?? null,
      status: iflow.status,
      lastDeployedAt: iflow.lastDeployedAt,
      lastExecutedAt: iflow.lastExecutedAt,
      tenantId: iflow.tenantId,
      tenantName: tenant?.name || "Unknown",
      createdAt: iflow.createdAt,
      updatedAt: iflow.updatedAt,
    };

    return { success: true, data: iflowData };
  } catch (error) {
    console.error("Error fetching iFlow details:", error);
    return { success: false, error: "Failed to fetch iFlow details" };
  }
}

/**
 * Get OAuth token for SAP CPI
 */
async function getSAPToken(
  authenticationUrl: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(authenticationUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get OAuth token: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Get full iFlow details including SAP CPI design-time and runtime data
 */
export async function getIFlowFullDetails(iflowId: string): Promise<ActionResult<IFlowDetailData>> {
  try {
    // Validate iflowId
    if (!iflowId || typeof iflowId !== 'string' || iflowId.trim() === '') {
      return { success: false, error: "Invalid iFlow ID" };
    }

    const trimmedId = iflowId.trim();
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    // Get iFlow by either DB ID or SAP CPI iFlow ID
    const iflow = await getIFlowByAnyId(trimmedId, currentUser.id);

    if (!iflow) {
      return { success: false, error: "iFlow not found" };
    }

    // Get tenant details
    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, iflow.tenantId),
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Check if user has access to this tenant
    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, currentUser.id),
        eq(tenantMembers.tenantId, iflow.tenantId),
      ),
    });

    if (!membership) {
      return { success: false, error: "You don't have access to this iFlow" };
    }

    // Initialize extended data with defaults
    let designTimeData: any = null;
    let runtimeData: any = null;
    let configuration: IFlowConfiguration | null = null;
    let sapCpiWebLink: string | null = null;

    // Try to fetch from SAP CPI if credentials are available
    if (tenant.authType === "OAUTH" && tenant.authenticationUrl && tenant.clientId && tenant.clientSecret) {
      try {
        // Get or refresh token
        let accessToken = getCachedToken(tenant.id);

        if (!accessToken) {
          const decryptedClientSecret = await decrypt(tenant.clientSecret);
          accessToken = await getSAPToken(
            tenant.authenticationUrl,
            tenant.clientId,
            decryptedClientSecret
          );
          cacheToken(tenant.id, accessToken);
        }

        // Create SAP CPI client
        const client = createSAPCPIClient({
          tenantUrl: tenant.tenantUrl,
          authType: "OAUTH",
          clientId: tenant.clientId,
          clientSecret: tenant.clientSecret,
          tokenUrl: tenant.authenticationUrl,
        });

        // Override the token since we already have it
        (client as any).accessToken = accessToken;
        (client as any).tokenExpiry = Date.now() + 3600000;

        // Fetch design-time artifact
        try {
          designTimeData = await client.getIntegrationDesigntimeArtifact(iflow.iFlowId);
        } catch (err) {
          // Log message only (avoid passing raw Error so Turbopack does not
          // attempt to symbolicate stack frames from dependencies that ship
          // malformed sourcemaps, which produces a misleading
          // "Invalid source map" console error in dev).
          const message = err instanceof Error ? err.message : String(err);
          // 404 = artifact deleted or never deployed to this tenant; expected.
          if (message.includes("(404)") || /not\s+found/i.test(message)) {
            // Quiet — page will render DB-only data.
          } else {
            console.warn(`Failed to fetch design-time artifact: ${message}`);
          }
        }

        // Fetch runtime artifact
        try {
          runtimeData = await client.getIntegrationRuntimeArtifact(iflow.iFlowId);
        } catch (err) {
          // Silently handle - runtime data is optional
        }

        // Fetch and parse iFlow configuration from BPMN2
        try {
          configuration = await client.getIFlowConfiguration(iflow.iFlowId);
        } catch (err) {
          // Silently handle - configuration is optional
        }

        // Build SAP CPI Web UI link
        if (iflow.packageName) {
          sapCpiWebLink = `${tenant.tenantUrl}/shell/design/contentpackage/${iflow.packageName}/integrationflows/${iflow.iFlowId}`;
        }

      } catch (err) {
        // Silently handle SAP CPI API errors - the page will still show DB data
      }
    }

    // Fetch execution stats from database
    let stats: IFlowStats | null = null;
    try {
      const executions = await db.query.iFlowExecutions.findMany({
        where: eq(iFlowExecutions.iFlowId, iflow.id),
        orderBy: (iFlowExecutions, { desc }) => [desc(iFlowExecutions.startTime)],
        limit: 1000,
      });

      if (executions && executions.length > 0) {
        const completed = executions.filter((e) => e.status === "COMPLETED").length;
        const failed = executions.filter((e) => e.status === "FAILED").length;
        const total = executions.length;
        const durations = executions
          .filter((e) => e.duration != null)
          .map((e) => e.duration as number);
        const avgDuration = durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0;

        // Group by day for chart
        const byDay = new Map<string, { completed: number; failed: number }>();
        for (const exec of executions) {
          const date = exec.startTime.toISOString().split('T')[0];
          const current = byDay.get(date) || { completed: 0, failed: 0 };
          if (exec.status === "COMPLETED") current.completed++;
          if (exec.status === "FAILED") current.failed++;
          byDay.set(date, current);
        }

        // Get last 7 days
        const executionsByDay: Array<{ date: string; completed: number; failed: number }> = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          executionsByDay.push({
            date: dateStr,
            completed: byDay.get(dateStr)?.completed || 0,
            failed: byDay.get(dateStr)?.failed || 0,
          });
        }

        stats = {
          totalExecutions: total,
          completedExecutions: completed,
          failedExecutions: failed,
          successRate: total > 0 ? (completed / total) * 100 : 0,
          avgDuration,
          lastExecutionStatus: executions[0]?.status || null,
          executionsByDay,
        };
      }
    } catch (err) {
      console.warn("Failed to fetch execution stats:", err);
    }

    const iflowDetailData: IFlowDetailData = {
      // Base data
      id: iflow.id,
      iFlowId: iflow.iFlowId,
      name: iflow.name,
      packageName: iflow.packageName ?? null,
      version: iflow.version ?? null,
      status: iflow.status,
      lastDeployedAt: iflow.lastDeployedAt,
      lastExecutedAt: iflow.lastExecutedAt,
      tenantId: iflow.tenantId,
      tenantName: tenant.name,
      createdAt: iflow.createdAt,
      updatedAt: iflow.updatedAt,

      // Design-time metadata
      description: designTimeData?.Description || null,
      sender: designTimeData?.Sender || null,
      receiver: designTimeData?.Receiver || null,
      createdBy: designTimeData?.CreatedBy || null,
      modifiedBy: designTimeData?.ModifiedBy || null,
      modifiedAt: designTimeData?.ModifiedAt ? new Date(designTimeData.ModifiedAt) : null,

      // Runtime metadata
      deployedBy: runtimeData?.DeployedBy || null,
      deployedOn: runtimeData?.DeployedOn ? new Date(runtimeData.DeployedOn) : null,
      runtimeStatus: runtimeData?.Status || null,
      errorInformation: runtimeData?.ErrorInformation || null,

      // Configuration
      configuration,

      // SAP CPI link
      sapCpiWebLink,

      // Stats
      stats,
    };

    return { success: true, data: iflowDetailData };
  } catch (error) {
    console.error("Error fetching full iFlow details:", error);
    return { success: false, error: "Failed to fetch iFlow details" };
  }
}

/**
 * Fetch content of a specific resource file from the iFlow ZIP package
 */
export async function getIFlowResourceContent(
  iflowId: string,
  resourcePath: string
): Promise<ActionResult<{ content: string; name: string; type: string; size: number }>> {
  try {
    if (!iflowId || !resourcePath) {
      return { success: false, error: "Invalid iFlow ID or resource path" };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const iflow = await getIFlowByAnyId(iflowId.trim(), currentUser.id);
    if (!iflow) {
      return { success: false, error: "iFlow not found" };
    }

    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, iflow.tenantId),
    });
    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, currentUser.id),
        eq(tenantMembers.tenantId, iflow.tenantId),
      ),
    });
    if (!membership) {
      return { success: false, error: "You don't have access to this iFlow" };
    }

    if (!(tenant.authType === "OAUTH" && tenant.authenticationUrl && tenant.clientId && tenant.clientSecret)) {
      return { success: false, error: "SAP CPI credentials not configured for this tenant" };
    }

    let accessToken = getCachedToken(tenant.id);
    if (!accessToken) {
      const decryptedClientSecret = await decrypt(tenant.clientSecret);
      accessToken = await getSAPToken(
        tenant.authenticationUrl,
        tenant.clientId,
        decryptedClientSecret
      );
      cacheToken(tenant.id, accessToken);
    }

    const client = createSAPCPIClient({
      tenantUrl: tenant.tenantUrl,
      authType: "OAUTH",
      clientId: tenant.clientId,
      clientSecret: tenant.clientSecret,
      tokenUrl: tenant.authenticationUrl,
    });
    (client as any).accessToken = accessToken;
    (client as any).tokenExpiry = Date.now() + 3600000;

    // Download the ZIP and extract content for the specific resource
    const AdmZip = (await import("adm-zip")).default;
    const zipBuffer = await client.downloadIFlowPackage(iflow.iFlowId);
    const zip = new AdmZip(zipBuffer);
    let entry = zip.getEntry(resourcePath);

    // Fallbacks for path normalization mismatches (slashes/prefixes)
    if (!entry) {
      const normalizedPath = resourcePath.replace(/\\/g, "/").replace(/^\/+/, "");
      entry = zip.getEntry(normalizedPath);
      if (!entry) {
        // Try with/without src/main/resources/ prefix
        const altPath = normalizedPath.startsWith("src/main/resources/")
          ? normalizedPath.replace("src/main/resources/", "")
          : `src/main/resources/${normalizedPath}`;
        entry = zip.getEntry(altPath);
      }
      if (!entry) {
        // Last resort: search by filename match across all ZIP entries
        const targetFileName = resourcePath.split("/").pop()?.toLowerCase();
        if (targetFileName) {
          for (const zipEntry of zip.getEntries()) {
            if (!zipEntry.isDirectory) {
              const entryFileName = zipEntry.entryName.split("/").pop()?.toLowerCase();
              if (entryFileName === targetFileName) {
                entry = zipEntry;
                break;
              }
            }
          }
        }
      }
    }

    if (!entry) {
      return { success: false, error: `Resource not found in package: ${resourcePath}` };
    }

    // Binary files are not viewable
    const binaryExtensions = ['.jar', '.class', '.zip', '.gz', '.tar', '.png', '.jpg', '.gif', '.ico', '.pdf'];
    const isBinary = binaryExtensions.some(ext => resourcePath.toLowerCase().endsWith(ext));
    if (isBinary) {
      return { success: false, error: "Binary files cannot be viewed as text" };
    }

    const content = entry.getData().toString("utf8");
    const name = resourcePath.split("/").pop() || resourcePath;

    // Determine type from extension
    let type = "text";
    if (resourcePath.endsWith(".groovy")) type = "groovy";
    else if (resourcePath.endsWith(".js")) type = "javascript";
    else if (resourcePath.endsWith(".xml") || resourcePath.endsWith(".iflw") || resourcePath.endsWith(".bpmn") || resourcePath.endsWith(".bpmn2")) type = "xml";
    else if (resourcePath.endsWith(".xsd")) type = "xml";
    else if (resourcePath.endsWith(".wsdl")) type = "xml";
    else if (resourcePath.endsWith(".edmx")) type = "xml";
    else if (resourcePath.endsWith(".xslt") || resourcePath.endsWith(".xsl")) type = "xml";
    else if (resourcePath.endsWith(".json")) type = "json";
    else if (resourcePath.endsWith(".properties")) type = "properties";
    else if (resourcePath.endsWith(".mmap")) type = "xml";

    return {
      success: true,
      data: { content, name, type, size: entry.header.size },
    };
  } catch (error) {
    console.error("Error fetching resource content:", error);
    return { success: false, error: "Failed to fetch resource content" };
  }
}

export interface MessageLog {
  id: string;
  messageId: string;
  correlationId: string | null;
  status: string;
  logStart: Date;
  logEnd: Date | null;
  sender: string | null;
  receiver: string | null;
  integrationFlowName: string;
  customStatus: string | null;
  logLevel: string | null;
  errorMessage: string | null;
  errorCategory: string | null;
  interfaceType: string | null;
  requestPayload: string | null;
  responsePayload: string | null;
}

export interface GetMessageLogsParams {
  iflowId: string;
  page?: number;
  pageSize?: number;
  status?: string;
}

export interface GetMessageLogsResult {
  logs: MessageLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Get message processing logs for an iFlow from SAP CPI
 */
export async function getMessageLogs(
  params: GetMessageLogsParams
): Promise<ActionResult<GetMessageLogsResult>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const { iflowId, page = 1, pageSize = 20, status } = params;

    // Get iFlow with tenant details
    const iflow = await getIFlowByAnyId(iflowId, currentUser.id);

    if (!iflow) {
      return { success: false, error: "iFlow not found" };
    }

    // Get tenant details
    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, iflow.tenantId),
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Check access
    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, currentUser.id),
        eq(tenantMembers.tenantId, iflow.tenantId),
      ),
    });

    if (!membership) {
      return { success: false, error: "You don't have access to this iFlow" };
    }

    // Build auth header
    let authHeader: string;
    if (tenant.authType === "OAUTH") {
      if (!tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
        return { success: false, error: "OAuth credentials not configured" };
      }
      let accessToken = getCachedToken(tenant.id);
      if (!accessToken) {
        const decryptedClientSecret = await decrypt(tenant.clientSecret);
        accessToken = await getSAPToken(tenant.authenticationUrl, tenant.clientId, decryptedClientSecret);
        cacheToken(tenant.id, accessToken);
      }
      authHeader = `Bearer ${accessToken}`;
    } else if (tenant.authType === "BASIC_AUTH") {
      if (!tenant.username || !tenant.password) {
        return { success: false, error: "Basic Auth credentials not configured" };
      }
      let password: string;
      try { password = await decrypt(tenant.password); } catch { password = tenant.password; }
      authHeader = `Basic ${Buffer.from(`${tenant.username}:${password}`).toString("base64")}`;
    } else {
      return { success: false, error: "Unsupported authentication type" };
    }

    // Build filter query
    let filterQuery = `IntegrationArtifact/Id eq '${iflow.iFlowId}'`;
    if (status) {
      filterQuery += ` and Status eq '${status}'`;
    }

    // Calculate skip for pagination
    const skip = (page - 1) * pageSize;

    // Fetch message logs from SAP CPI
    const logsUrl = `${tenant.tenantUrl}/api/v1/MessageProcessingLogs?$format=json&$orderby=LogEnd desc&$filter=${encodeURIComponent(filterQuery)}&$top=${pageSize}&$skip=${skip}`;

    const logsResponse = await fetch(logsUrl, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
    });

    if (!logsResponse.ok) {
      const errorText = await logsResponse.text();
      throw new Error(`Failed to fetch message logs: ${logsResponse.status} - ${errorText}`);
    }

    const logsData = await logsResponse.json();
    const results = logsData.d?.results || [];

    // Use inline count from response or estimate total
    const inlineCount = logsData.d?.__count;
    let total = inlineCount || results.length;

    if (!inlineCount && results.length === pageSize) {
      total = (page * pageSize) + 1;
    }

    const logs: MessageLog[] = results.map((log: any) => ({
      id: log.MessageGuid || log.MessageId,
      messageId: log.MessageGuid || log.MessageId,
      correlationId: log.CorrelationId || null,
      status: log.Status,
      logStart: parseSAPDate(log.LogStart) ?? new Date(0),
      logEnd: parseSAPDate(log.LogEnd),
      sender: log.Sender || null,
      receiver: log.Receiver || null,
      integrationFlowName: log.IntegrationFlowName || iflow.name,
      customStatus: log.CustomStatus || null,
      logLevel: log.LogLevel || null,
      errorMessage: log.Status?.toUpperCase() === "FAILED"
        ? "Error occurred - click 'Explain Error with AI' for details"
        : null,
      errorCategory: null,
      interfaceType: log.IntegrationArtifact?.Type || null,
      requestPayload: null,
      responsePayload: null,
    }));

    return {
      success: true,
      data: {
        logs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Error fetching message logs:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch message logs"
    };
  }
}

/**
 * Deploy or undeploy an iFlow
 */
export async function toggleIFlowDeployment(
  iflowId: string,
  action: "deploy" | "undeploy"
): Promise<ActionResult<{ status: string }>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    // Get iFlow with tenant details
    const iflow = await getIFlowByAnyId(iflowId, currentUser.id);

    if (!iflow) {
      return { success: false, error: "iFlow not found" };
    }

    // Get tenant details
    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, iflow.tenantId),
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Check access (only ADMIN and OWNER can deploy/undeploy)
    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, currentUser.id),
        eq(tenantMembers.tenantId, iflow.tenantId),
      ),
    });

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      return { success: false, error: "You don't have permission to deploy/undeploy iFlows" };
    }

    // Get auth token
    let deployAuthHeader: string;
    if (tenant.authType === "OAUTH") {
      if (!tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
        return { success: false, error: "OAuth credentials not configured" };
      }
      const decryptedClientSecret = await decrypt(tenant.clientSecret);
      const accessToken = await getSAPToken(tenant.authenticationUrl, tenant.clientId, decryptedClientSecret);
      deployAuthHeader = `Bearer ${accessToken}`;
    } else if (tenant.authType === "BASIC_AUTH") {
      if (!tenant.username || !tenant.password) {
        return { success: false, error: "Basic Auth credentials not configured" };
      }
      let password: string;
      try { password = await decrypt(tenant.password); } catch { password = tenant.password; }
      deployAuthHeader = `Basic ${Buffer.from(`${tenant.username}:${password}`).toString("base64")}`;
    } else {
      return { success: false, error: "Unsupported authentication type" };
    }

    // Deploy or undeploy via SAP CPI API
    const deployUrl = `${tenant.tenantUrl}/api/v1/IntegrationRuntimeArtifacts('${iflow.iFlowId}')`;
    const deployResponse = await fetch(deployUrl, {
      method: action === "deploy" ? "POST" : "DELETE",
      headers: {
        "Authorization": deployAuthHeader,
        "Accept": "application/json",
      },
    });

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      throw new Error(`Failed to ${action} iFlow: ${deployResponse.status} - ${errorText}`);
    }

    // Update status in database
    const newStatus = action === "deploy" ? "STARTING" : "STOPPING";
    await db.update(iFlows).set({
      status: newStatus as any,
      ...(action === "deploy" && { lastDeployedAt: new Date() }),
    }).where(eq(iFlows.id, iflow.id));

    revalidatePath(`/dashboard/iflows/${iflowId}`);
    revalidatePath("/dashboard/iflows");

    return {
      success: true,
      data: { status: newStatus }
    };
  } catch (error) {
    console.error(`Error ${action}ing iFlow:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : `Failed to ${action} iFlow`
    };
  }
}

/**
 * Diagnose an iFlow execution error using AI
 * Accepts messageId and iflowId to fetch details from SAP API or database
 */
export async function diagnoseExecutionError(
  messageId: string,
  iflowId: string
): Promise<ActionResult<{ diagnosis: string }>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Get iFlow and tenant info
    const iflow = await getIFlowByAnyId(iflowId, currentUser.id);

    if (!iflow) {
      return { success: false, error: "iFlow not found" };
    }

    // Get tenant details
    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, iflow.tenantId),
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Check tenant access
    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, currentUser.id),
        eq(tenantMembers.tenantId, iflow.tenantId),
      ),
    });

    if (!membership) {
      return { success: false, error: "Access denied" };
    }

    // First try to get execution from database
    const execution = await db.query.iFlowExecutions.findFirst({
      where: eq(iFlowExecutions.messageId, messageId),
    });

    let executionData: any;

    if (execution) {
      executionData = {
        messageId: execution.messageId,
        status: execution.status,
        startTime: execution.startTime,
        endTime: execution.endTime,
        duration: execution.duration,
        errorMessage: execution.errorMessage,
        errorCategory: execution.errorCategory,
        sender: execution.sender,
        receiver: execution.receiver,
        interfaceType: execution.interfaceType,
        requestPayload: null,
        responsePayload: null,
        iFlow: iflow,
      };
    } else {
      // Fetch message details from SAP CPI API
      try {
        let authHeaderForDetail: string;
        if (tenant.authType === "OAUTH") {
          if (!tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
            return { success: false, error: "OAuth credentials not configured" };
          }
          const decryptedClientSecret = await decrypt(tenant.clientSecret);
          const accessToken = await getSAPToken(tenant.authenticationUrl, tenant.clientId, decryptedClientSecret);
          authHeaderForDetail = `Bearer ${accessToken}`;
        } else if (tenant.authType === "BASIC_AUTH") {
          if (!tenant.username || !tenant.password) {
            return { success: false, error: "Basic Auth credentials not configured" };
          }
          let password: string;
          try { password = await decrypt(tenant.password); } catch { password = tenant.password; }
          authHeaderForDetail = `Basic ${Buffer.from(`${tenant.username}:${password}`).toString("base64")}`;
        } else {
          return { success: false, error: "Unsupported authentication type" };
        }

        // Fetch message log details
        const messageUrl = `${tenant.tenantUrl}/api/v1/MessageProcessingLogs('${messageId}')?$format=json`;
        const messageResponse = await fetch(messageUrl, {
          method: "GET",
          headers: {
            "Authorization": authHeaderForDetail,
            "Accept": "application/json",
          },
        });

        if (!messageResponse.ok) {
          return { success: false, error: "Failed to fetch message details from SAP CPI" };
        }

        const messageData = await messageResponse.json();
        const log = messageData.d || messageData;

        const logStart = parseSAPDate(log.LogStart);
        const logEnd = parseSAPDate(log.LogEnd);

        // Fetch actual error message if status is FAILED
        let actualErrorMessage = null;
        if (log.Status && log.Status.toUpperCase() === "FAILED") {
          try {
            const errorUrl = `${tenant.tenantUrl}/api/v1/MessageProcessingLogs('${messageId}')/ErrorInformation/$value`;
            const errorResponse = await fetch(errorUrl, {
              method: "GET",
              headers: {
                "Authorization": authHeaderForDetail,
                "Accept": "text/plain",
              },
            });

            if (errorResponse.ok) {
              actualErrorMessage = await errorResponse.text();
            }
          } catch (errorFetchError) {
            console.error("Failed to fetch error details:", errorFetchError);
            actualErrorMessage = log.AlternateWebLink || log.CustomHeaderProperties?.find((p: any) => p.Name === "SAP_ErrorMessage")?.Value;
          }
        }

        executionData = {
          messageId: log.MessageGuid || messageId,
          status: log.Status || "UNKNOWN",
          startTime: logStart,
          endTime: logEnd,
          duration: logStart && logEnd ? logEnd.getTime() - logStart.getTime() : null,
          errorMessage: actualErrorMessage,
          errorCategory: null,
          sender: log.Sender || null,
          receiver: log.Receiver || null,
          interfaceType: log.IntegrationArtifact?.Type || null,
          requestPayload: null,
          responsePayload: null,
          iFlow: iflow,
        };
      } catch (apiError) {
        console.error("Error fetching from SAP API:", apiError);
        return { success: false, error: "Failed to fetch message details" };
      }
    }

    // Truncate payloads to avoid token limits (max 10KB each)
    const MAX_PAYLOAD_LENGTH = 10000;
    const truncatePayload = (payload: string | null) => {
      if (!payload) return null;
      return payload.length > MAX_PAYLOAD_LENGTH
        ? payload.substring(0, MAX_PAYLOAD_LENGTH) + "\n\n[Truncated...]"
        : payload;
    };

    const formatDate = (date: Date | null | undefined): string => {
      if (!date) return "N/A";
      try {
        return date.toISOString();
      } catch {
        return "Invalid date";
      }
    };

    const context = `
**Execution Details:**
- Message ID: ${executionData.messageId}
- iFlow: ${executionData.iFlow.name} (${executionData.iFlow.iFlowId})
- Package: ${executionData.iFlow.packageName || "N/A"}
- Status: ${executionData.status}
- Error Category: ${executionData.errorCategory || "UNKNOWN"}
- Duration: ${executionData.duration ? `${executionData.duration}ms` : "N/A"}
- Start Time: ${formatDate(executionData.startTime)}
- End Time: ${formatDate(executionData.endTime)}
- Sender: ${executionData.sender || "N/A"}
- Receiver: ${executionData.receiver || "N/A"}
- Interface Type: ${executionData.interfaceType || "N/A"}

**Error Message:**
${executionData.errorMessage || "No error message available"}

**Request Payload:**
${truncatePayload(executionData.requestPayload) || "No request payload available"}

**Response Payload:**
${truncatePayload(executionData.responsePayload) || "No response payload available"}

Analyze this error and provide a comprehensive diagnosis with root cause, detailed analysis, recommended fix, and prevention strategy.
`;

    // Generate diagnosis using AI
    try {
      const result = await runText({
        prompt: `${ERROR_DIAGNOSIS_SYSTEM_PROMPT}

---

${context}`,
        temperature: 0.7,
      });

      const diagnosis = result.text;

      if (!diagnosis || diagnosis.trim().length === 0) {
        console.error("AI returned empty response");
        return {
          success: false,
          error: "AI model returned an empty response. Please try again.",
        };
      }

      return {
        success: true,
        data: { diagnosis },
      };
    } catch (aiError) {
      console.error("AI Generation Error:", aiError);

      const errorMessage = aiError instanceof Error
        ? aiError.message
        : "Failed to generate diagnosis";

      return {
        success: false,
        error: `AI Error: ${errorMessage}. Please check your API key and try again.`,
      };
    }
  } catch (error) {
    console.error("Error diagnosing execution:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate diagnosis",
    };
  }
}
