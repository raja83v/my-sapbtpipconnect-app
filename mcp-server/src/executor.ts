/**
 * SAP CPI MCP Server - Tool Executor
 * 
 * Main orchestrator that handles tool execution with:
 * - Caching
 * - Rate limiting
 * - Confirmation flows
 * - Audit logging
 * - Multi-tenant context
 */

import {
  TenantContext,
  ToolExecutionRequest,
  ToolExecutionResult,
  AuditLogEntry,
} from "./types";
import { toolRegistry, getToolByName } from "./tools/registry";
import { getCached, setCache, invalidateToolCache } from "./utils/cache";
import { checkRateLimit } from "./utils/rate-limiter";

// Monitoring handlers
import {
  handleGetMessageLogs,
  handleGetMessageDetails,
  handleGetErrorInfo,
  handleGetRunSteps,
  SAPCPIClientInterface as MonitoringClient,
} from "./handlers/monitoring";

// iFlow handlers
import {
  handleListIFlows,
  handleGetIFlowConfig,
  handleGetIFlowPerformance,
  handleDownloadIFlow,
  handleAnalyzeIFlow,
  handleSearchSAPCatalog,
  SAPCPIClientInterface as IFlowClient,
} from "./handlers/iflow";

// Action handlers
import {
  handleDeployIFlow,
  handleRestartIFlow,
  handleUndeployIFlow,
  handleCreateIFlow,
  handleCreatePackage,
  SAPCPIClientInterface as ActionClient,
} from "./handlers/actions";

// Analytics handlers
import {
  handleGetExecutionStats,
  handleGetErrorTrends,
  handleGetPerformanceMetrics,
  handleGetTopErrors,
  SAPCPIClientInterface as AnalyticsClient,
} from "./handlers/analytics";

// Combined client interface
export type SAPCPIClient = MonitoringClient & IFlowClient & ActionClient & AnalyticsClient;

// Audit log store (in production, this would be persisted)
const auditLog: AuditLogEntry[] = [];
const MAX_AUDIT_LOG_SIZE = 10000;

/**
 * Execute a tool with full middleware support
 */
export async function executeTool(
  request: ToolExecutionRequest,
  client: SAPCPIClient
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  const { toolName, arguments: args, tenantContext, confirmationToken } = request;

  // Get tool definition
  const tool = getToolByName(toolName);
  if (!tool) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
    };
  }

  // Check rate limits
  const rateCheck = checkRateLimit(
    tenantContext.userId,
    toolName,
    tool.rateLimit.maxCalls,
    tool.rateLimit.windowSeconds
  );

  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Rate limit exceeded for ${toolName}. Try again in ${rateCheck.resetInSeconds} seconds.`,
    };
  }

  // Check cache for read operations (non-action tools)
  if (!tool.requiresConfirmation && tool.cacheTTLSeconds > 0) {
    const cached = getCached<unknown>(toolName, tenantContext.tenantId, args);
    if (cached !== null) {
      logAudit({
        toolName,
        category: tool.category,
        tenantContext,
        args,
        result: "success",
        executionTimeMs: Date.now() - startTime,
        cached: true,
      });

      return {
        success: true,
        data: cached,
        cached: true,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  // Execute the tool
  let result: ToolExecutionResult;

  try {
    result = await executeToolHandler(
      toolName,
      args,
      tenantContext,
      client,
      confirmationToken
    );
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }

  // Cache successful results for cacheable tools
  if (result.success && !tool.requiresConfirmation && tool.cacheTTLSeconds > 0 && result.data) {
    setCache(toolName, tenantContext.tenantId, args, result.data, tool.cacheTTLSeconds);
  }

  // Invalidate related caches for action tools
  if (result.success && tool.requiresConfirmation && !result.requiresConfirmation) {
    // Action completed, invalidate related caches
    invalidateRelatedCaches(toolName, tenantContext.tenantId, args);
  }

  // Log audit
  logAudit({
    toolName,
    category: tool.category,
    tenantContext,
    args,
    result: result.success ? "success" : "failure",
    executionTimeMs: Date.now() - startTime,
    error: result.error,
    confirmationToken: result.confirmationDetails?.confirmationToken,
  });

  result.executionTimeMs = Date.now() - startTime;
  return result;
}

/**
 * Route to the appropriate handler based on tool name
 */
async function executeToolHandler(
  toolName: string,
  args: Record<string, unknown>,
  context: TenantContext,
  client: SAPCPIClient,
  confirmationToken?: string
): Promise<ToolExecutionResult> {
  switch (toolName) {
    // Monitoring tools
    case "get_message_logs":
      return handleGetMessageLogs(client, args as any, context);
    case "get_message_details":
      return handleGetMessageDetails(client, args as any, context);
    case "get_error_info":
      return handleGetErrorInfo(client, args as any, context);
    case "get_run_steps":
      return handleGetRunSteps(client, args as any, context);

    // iFlow tools
    case "list_iflows":
      return handleListIFlows(client, args as any, context);
    case "get_iflow_config":
      return handleGetIFlowConfig(client, args as any, context);
    case "get_iflow_performance":
      return handleGetIFlowPerformance(client, args as any, context);
    case "download_iflow":
      return handleDownloadIFlow(client, args as any, context);
    case "analyze_iflow":
      return handleAnalyzeIFlow(client, args as any, context);
    case "search_sap_catalog":
      return handleSearchSAPCatalog(client as any, args as any, context);

    // Package tools
    case "list_packages":
      return handleListPackages(client, args as any, context);
    case "get_package_details":
      return handleGetPackageDetails(client, args as any, context);
    case "create_package":
      return handleCreatePackage(client, args as any, context, confirmationToken);

    // Action tools
    case "deploy_iflow":
      return handleDeployIFlow(client, args as any, context, confirmationToken);
    case "restart_iflow":
      return handleRestartIFlow(client, args as any, context, confirmationToken);
    case "undeploy_iflow":
      return handleUndeployIFlow(client, args as any, context, confirmationToken);
    case "create_iflow":
      return handleCreateIFlow(client, args as any, context, confirmationToken);

    // Analytics tools
    case "get_execution_stats":
      return handleGetExecutionStats(client, args as any, context);
    case "get_error_trends":
      return handleGetErrorTrends(client, args as any, context);
    case "get_performance_metrics":
      return handleGetPerformanceMetrics(client, args as any, context);
    case "get_top_errors":
      return handleGetTopErrors(client, args as any, context);

    default:
      return {
        success: false,
        error: `No handler found for tool: ${toolName}`,
      };
  }
}

/**
 * Placeholder for package handlers (would be similar to iFlow handlers)
 */
async function handleListPackages(
  client: SAPCPIClient,
  args: any,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    // This would use client.getIntegrationPackages()
    return {
      success: true,
      data: {
        packages: [],
        message: "Package listing not yet implemented",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list packages: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function handleGetPackageDetails(
  client: SAPCPIClient,
  args: any,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    // This would use client.getIntegrationPackage()
    return {
      success: true,
      data: {
        package: null,
        message: "Package details not yet implemented",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get package details: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Invalidate caches that might be stale after an action
 */
function invalidateRelatedCaches(
  toolName: string,
  tenantId: string,
  args: Record<string, unknown>
): void {
  switch (toolName) {
    case "deploy_iflow":
    case "restart_iflow":
    case "undeploy_iflow":
      invalidateToolCache("list_iflows", tenantId);
      invalidateToolCache("get_iflow_config", tenantId);
      invalidateToolCache("get_iflow_performance", tenantId);
      break;
    case "create_iflow":
      invalidateToolCache("list_iflows", tenantId);
      invalidateToolCache("list_packages", tenantId);
      invalidateToolCache("get_package_details", tenantId);
      break;
    case "create_package":
      invalidateToolCache("list_packages", tenantId);
      break;
  }
}

/**
 * Log an audit entry
 */
function logAudit(params: {
  toolName: string;
  category: string;
  tenantContext: TenantContext;
  args: Record<string, unknown>;
  result: "success" | "failure" | "pending_confirmation";
  executionTimeMs: number;
  cached?: boolean;
  error?: string;
  confirmationToken?: string;
}): void {
  const entry: AuditLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    userId: params.tenantContext.userId,
    tenantId: params.tenantContext.tenantId,
    toolName: params.toolName,
    category: params.category as any,
    arguments: params.args,
    result: params.result,
    executionTimeMs: params.executionTimeMs,
    errorMessage: params.error,
    confirmationToken: params.confirmationToken,
  };

  auditLog.unshift(entry);

  // Keep audit log size bounded
  if (auditLog.length > MAX_AUDIT_LOG_SIZE) {
    auditLog.pop();
  }
}

/**
 * Get recent audit log entries
 */
export function getAuditLog(params: {
  userId?: string;
  tenantId?: string;
  toolName?: string;
  limit?: number;
}): AuditLogEntry[] {
  let entries = [...auditLog];

  if (params.userId) {
    entries = entries.filter(e => e.userId === params.userId);
  }

  if (params.tenantId) {
    entries = entries.filter(e => e.tenantId === params.tenantId);
  }

  if (params.toolName) {
    entries = entries.filter(e => e.toolName === params.toolName);
  }

  return entries.slice(0, params.limit || 100);
}

/**
 * Get tool execution statistics
 */
export function getToolStats(tenantId?: string): Record<string, {
  totalCalls: number;
  successRate: number;
  avgExecutionTime: number;
}> {
  let entries = tenantId
    ? auditLog.filter(e => e.tenantId === tenantId)
    : auditLog;

  const stats: Record<string, { total: number; success: number; totalTime: number }> = {};

  for (const entry of entries) {
    if (!stats[entry.toolName]) {
      stats[entry.toolName] = { total: 0, success: 0, totalTime: 0 };
    }

    stats[entry.toolName].total++;
    if (entry.result === "success") {
      stats[entry.toolName].success++;
    }
    stats[entry.toolName].totalTime += entry.executionTimeMs;
  }

  return Object.fromEntries(
    Object.entries(stats).map(([name, data]) => [
      name,
      {
        totalCalls: data.total,
        successRate: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0,
        avgExecutionTime: data.total > 0 ? Math.round(data.totalTime / data.total) : 0,
      },
    ])
  );
}
