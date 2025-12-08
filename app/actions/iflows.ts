"use server";

import { getCurrentUser } from "./user";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { ActionResult } from "@/types/actions";
import { streamText } from "ai";
import { aiModel } from "@/lib/ai/client";
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

    // Get user's accessible tenants
    const userTenants = await convex.query(api.tenants.listForUser, { 
      userId: currentUser.id as any 
    });

    const accessibleTenantIds = userTenants.map((t: any) => t._id);

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
    // Priority: explicit tenantId > user's defaultTenantId > all accessible tenants
    let targetTenantIds: string[];
    
    // Convert accessible tenant IDs to strings for comparison
    const accessibleTenantIdStrings = accessibleTenantIds.map((id: any) => String(id));
    
    if (tenantId) {
      // Explicit tenant ID provided
      targetTenantIds = [tenantId];
    } else if (!showAllTenants) {
      // Use user's default tenant if available, otherwise use first accessible tenant
      const user = await convex.query(api.users.getById, { id: currentUser.id as any });
      const defaultTenantId = user?.defaultTenantId ? String(user.defaultTenantId) : null;
      
      if (defaultTenantId && accessibleTenantIdStrings.includes(defaultTenantId)) {
        targetTenantIds = [defaultTenantId];
      } else if (accessibleTenantIds.length > 0) {
        // Fallback to first accessible tenant
        targetTenantIds = [accessibleTenantIds[0]];
      } else {
        targetTenantIds = [];
      }
    } else {
      // Show all tenants
      targetTenantIds = accessibleTenantIds;
    }

    // Get all iFlows for target tenants
    const allIflows: any[] = [];
    
    for (const tid of targetTenantIds) {
      const tenantIflows = await convex.query(api.iflows.listByTenant, { 
        tenantId: tid as any,
        status: status as any,
        limit: 1000,
      });
      
      // Get tenant name
      const tenant = await convex.query(api.tenants.getById, { id: tid as any });
      
      for (const iflow of tenantIflows) {
        // Apply search filter
        if (search) {
          const searchLower = search.toLowerCase();
          if (
            !iflow.name.toLowerCase().includes(searchLower) &&
            !iflow.iFlowId.toLowerCase().includes(searchLower) &&
            !(iflow.packageName?.toLowerCase().includes(searchLower))
          ) {
            continue;
          }
        }
        allIflows.push({ ...iflow, tenantName: tenant?.name || "Unknown" });
      }
    }

    // Sort and paginate
    const total = allIflows.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedIflows = allIflows.slice(startIndex, startIndex + pageSize);

    const iflowsData: IFlowData[] = paginatedIflows.map((iflow: any) => ({
      id: iflow._id,
      iFlowId: iflow.iFlowId,
      name: iflow.name,
      packageName: iflow.packageName ?? null,
      version: iflow.version ?? null,
      status: iflow.status,
      lastDeployedAt: iflow.lastDeployedAt ? new Date(iflow.lastDeployedAt) : null,
      lastExecutedAt: iflow.lastExecutedAt ? new Date(iflow.lastExecutedAt) : null,
      tenantId: iflow.tenantId,
      tenantName: iflow.tenantName,
      createdAt: new Date(iflow._creationTime),
      updatedAt: new Date(iflow._creationTime),
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

    const userTenants = await convex.query(api.tenants.listForUser, { 
      userId: currentUser.id as any 
    });

    const tenants = userTenants.map((item: any) => ({
      id: item._id,
      name: item.name,
    }));

    return { success: true, data: tenants };
  } catch (error) {
    console.error("Error fetching tenants:", error);
    return { success: false, error: "Failed to fetch tenants" };
  }
}

/**
 * Get detailed iFlow information by ID
 * Returns basic data from Convex - use getIFlowFullDetails for SAP CPI data
 */
export async function getIFlowDetails(iflowId: string): Promise<ActionResult<IFlowData>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const iflow = await convex.query(api.iflows.getById, { id: iflowId as any });

    if (!iflow) {
      return { success: false, error: "iFlow not found" };
    }

    // Get tenant details
    const tenant = await convex.query(api.tenants.getById, { id: iflow.tenantId });

    // Check if user has access to this tenant
    const membership = await convex.query(api.tenants.getMembership, {
      userId: currentUser.id as any,
      tenantId: iflow.tenantId,
    });

    if (!membership) {
      return { success: false, error: "You don't have access to this iFlow" };
    }

    const iflowData: IFlowData = {
      id: iflow._id,
      iFlowId: iflow.iFlowId,
      name: iflow.name,
      packageName: iflow.packageName ?? null,
      version: iflow.version ?? null,
      status: iflow.status,
      lastDeployedAt: iflow.lastDeployedAt ? new Date(iflow.lastDeployedAt) : null,
      lastExecutedAt: iflow.lastExecutedAt ? new Date(iflow.lastExecutedAt) : null,
      tenantId: iflow.tenantId,
      tenantName: tenant?.name || "Unknown",
      createdAt: new Date(iflow._creationTime),
      updatedAt: new Date(iflow._creationTime),
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

    let iflow;
    try {
      iflow = await convex.query(api.iflows.getById, { id: trimmedId as any });
    } catch (convexError) {
      console.error("Convex query error:", convexError);
      return { success: false, error: `Database error: ${convexError instanceof Error ? convexError.message : String(convexError)}` };
    }

    if (!iflow) {
      return { success: false, error: "iFlow not found" };
    }

    // Get tenant details
    const tenant = await convex.query(api.tenants.getById, { id: iflow.tenantId });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Check if user has access to this tenant
    const membership = await convex.query(api.tenants.getMembership, {
      userId: currentUser.id as any,
      tenantId: iflow.tenantId,
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
        let accessToken = getCachedToken(tenant._id);

        if (!accessToken) {
          const decryptedClientSecret = await decrypt(tenant.clientSecret);
          accessToken = await getSAPToken(
            tenant.authenticationUrl,
            tenant.clientId,
            decryptedClientSecret
          );
          cacheToken(tenant._id, accessToken);
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
          console.warn("Failed to fetch design-time artifact:", err);
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
        // Format: https://<tenant>.integrationsuite.cfapps.<region>.hana.ondemand.com/shell/design/contentpackage/<packageId>/integrationflows/<iFlowId>
        if (iflow.packageName) {
          const tenantUrlParts = tenant.tenantUrl.replace('https://', '').split('.');
          if (tenantUrlParts.length > 0) {
            sapCpiWebLink = `${tenant.tenantUrl}/shell/design/contentpackage/${iflow.packageName}/integrationflows/${iflow.iFlowId}`;
          }
        }

      } catch (err) {
        // Silently handle SAP CPI API errors - the page will still show Convex data
      }
    }

    // Fetch execution stats from Convex
    let stats: IFlowStats | null = null;
    try {
      const executions = await convex.query(api.iflows.getExecutions, {
        iFlowId: iflowId as any,
        limit: 1000,
      });

      if (executions && executions.length > 0) {
        const completed = executions.filter((e: any) => e.status === "COMPLETED").length;
        const failed = executions.filter((e: any) => e.status === "FAILED").length;
        const total = executions.length;
        const durations = executions
          .filter((e: any) => e.duration != null)
          .map((e: any) => e.duration as number);
        const avgDuration = durations.length > 0 
          ? durations.reduce((a, b) => a + b, 0) / durations.length 
          : 0;

        // Group by day for chart
        const byDay = new Map<string, { completed: number; failed: number }>();
        for (const exec of executions) {
          const date = new Date(exec.startTime).toISOString().split('T')[0];
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
      id: iflow._id,
      iFlowId: iflow.iFlowId,
      name: iflow.name,
      packageName: iflow.packageName ?? null,
      version: iflow.version ?? null,
      status: iflow.status,
      lastDeployedAt: iflow.lastDeployedAt ? new Date(iflow.lastDeployedAt) : null,
      lastExecutedAt: iflow.lastExecutedAt ? new Date(iflow.lastExecutedAt) : null,
      tenantId: iflow.tenantId,
      tenantName: tenant.name,
      createdAt: new Date(iflow._creationTime),
      updatedAt: new Date(iflow._creationTime),

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
    const iflow = await convex.query(api.iflows.getById, { id: iflowId as any });

    if (!iflow) {
      return { success: false, error: "iFlow not found" };
    }

    // Get tenant details
    const tenant = await convex.query(api.tenants.getById, { id: iflow.tenantId });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Check access
    const membership = await convex.query(api.tenants.getMembership, {
      userId: currentUser.id as any,
      tenantId: iflow.tenantId,
    });

    if (!membership) {
      return { success: false, error: "You don't have access to this iFlow" };
    }

    // Get OAuth token (with caching)
    if (tenant.authType !== "OAUTH" || !tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
      return { success: false, error: "OAuth credentials not configured" };
    }

    // Try to get cached token first
    let accessToken = getCachedToken(tenant._id);
    
    if (!accessToken) {
      // Token not cached or expired, fetch new one
      const { decrypt } = await import("@/lib/encryption");
      const decryptedClientSecret = decrypt(tenant.clientSecret);
      accessToken = await getSAPToken(
        tenant.authenticationUrl,
        tenant.clientId,
        decryptedClientSecret
      );
      
      // Cache the token for future requests
      cacheToken(tenant._id, accessToken);
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
        "Authorization": `Bearer ${accessToken}`,
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
      logStart: new Date(log.LogStart),
      logEnd: log.LogEnd ? new Date(log.LogEnd) : null,
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
    const iflow = await convex.query(api.iflows.getById, { id: iflowId as any });

    if (!iflow) {
      return { success: false, error: "iFlow not found" };
    }

    // Get tenant details
    const tenant = await convex.query(api.tenants.getById, { id: iflow.tenantId });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Check access (only ADMIN and OWNER can deploy/undeploy)
    const membership = await convex.query(api.tenants.getMembership, {
      userId: currentUser.id as any,
      tenantId: iflow.tenantId,
    });

    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      return { success: false, error: "You don't have permission to deploy/undeploy iFlows" };
    }

    // Get OAuth token
    if (tenant.authType !== "OAUTH" || !tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
      return { success: false, error: "OAuth credentials not configured" };
    }

    const { decrypt } = await import("@/lib/encryption");
    const decryptedClientSecret = decrypt(tenant.clientSecret);
    const accessToken = await getSAPToken(
      tenant.authenticationUrl,
      tenant.clientId,
      decryptedClientSecret
    );

    // Deploy or undeploy via SAP CPI API
    const deployUrl = `${tenant.tenantUrl}/api/v1/IntegrationRuntimeArtifacts('${iflow.iFlowId}')`;
    const deployResponse = await fetch(deployUrl, {
      method: action === "deploy" ? "POST" : "DELETE",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      throw new Error(`Failed to ${action} iFlow: ${deployResponse.status} - ${errorText}`);
    }

    // Update status in database
    const newStatus = action === "deploy" ? "STARTING" : "STOPPING";
    await convex.mutation(api.iflowMutations.update, {
      id: iflowId as any,
      status: newStatus as any,
      ...(action === "deploy" && { lastDeployedAt: Date.now() }),
    });

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
    const iflow = await convex.query(api.iflows.getById, { id: iflowId as any });

    if (!iflow) {
      return { success: false, error: "iFlow not found" };
    }

    // Get tenant details
    const tenant = await convex.query(api.tenants.getById, { id: iflow.tenantId });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Check tenant access
    const membership = await convex.query(api.tenants.getMembership, {
      userId: currentUser.id as any,
      tenantId: iflow.tenantId,
    });

    if (!membership) {
      return { success: false, error: "Access denied" };
    }

    // First try to get execution from database
    const execution = await convex.query(api.iflows.getExecutionByMessageId, { 
      messageId,
      iFlowId: iflowId as any,
    });

    let executionData: any;

    if (execution) {
      executionData = {
        messageId: execution.messageId,
        status: execution.status,
        startTime: execution.startTime ? new Date(execution.startTime) : null,
        endTime: execution.endTime ? new Date(execution.endTime) : null,
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
        if (tenant.authType !== "OAUTH" || !tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
          return { success: false, error: "OAuth credentials not configured" };
        }

        const { decrypt } = await import("@/lib/encryption");
        const decryptedClientSecret = decrypt(tenant.clientSecret);
        const accessToken = await getSAPToken(
          tenant.authenticationUrl,
          tenant.clientId,
          decryptedClientSecret
        );

        // Fetch message log details
        const messageUrl = `${tenant.tenantUrl}/api/v1/MessageProcessingLogs('${messageId}')?$format=json`;
        const messageResponse = await fetch(messageUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/json",
          },
        });

        if (!messageResponse.ok) {
          return { success: false, error: "Failed to fetch message details from SAP CPI" };
        }

        const messageData = await messageResponse.json();
        const log = messageData.d || messageData;

        const parseDate = (dateStr: any): Date | null => {
          if (!dateStr) return null;
          try {
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
          } catch {
            return null;
          }
        };

        const logStart = parseDate(log.LogStart);
        const logEnd = parseDate(log.LogEnd);

        // Fetch actual error message if status is FAILED
        let actualErrorMessage = null;
        if (log.Status && log.Status.toUpperCase() === "FAILED") {
          try {
            const errorUrl = `${tenant.tenantUrl}/api/v1/MessageProcessingLogs('${messageId}')/ErrorInformation/$value`;
            const errorResponse = await fetch(errorUrl, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
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
      const result = await streamText({
        model: aiModel,
        prompt: `${ERROR_DIAGNOSIS_SYSTEM_PROMPT}

---

${context}`,
        temperature: 0.7,
      });

      const diagnosis = await result.text;

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
