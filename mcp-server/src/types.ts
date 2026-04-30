/**
 * SAP CPI MCP Server - Type Definitions
 * 
 * Core types for the Model Context Protocol server that exposes
 * SAP CPI APIs as AI-callable tools.
 */

import { z } from "zod";

// ============================================================================
// Tool Categories
// ============================================================================

export type ToolCategory =
  | "monitoring"    // Message logs, error info, run steps
  | "iflow"         // iFlow CRUD operations
  | "package"       // Integration package operations
  | "action"        // Deployment, restart, create (requires confirmation)
  | "analytics"     // Stats, trends, metrics
  | "apim";         // SAP API Management monitoring

// ============================================================================
// Tenant Context
// ============================================================================

export interface TenantContext {
  tenantId: string;
  tenantName: string;
  tenantUrl: string;
  userId: string;
  userRole: "owner" | "admin" | "member" | "viewer";
}

// ============================================================================
// Tool Execution
// ============================================================================

export interface ToolExecutionRequest {
  toolName: string;
  arguments: Record<string, unknown>;
  tenantContext: TenantContext;
  confirmationToken?: string; // Required for action tools
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationDetails?: ConfirmationDetails;
  cached?: boolean;
  executionTimeMs?: number;
}

export interface ConfirmationDetails {
  action: string;
  description: string;
  affectedResources: string[];
  confirmationToken: string;
  expiresAt: Date;
  severity: "low" | "medium" | "high" | "critical";
}

// ============================================================================
// Tool Definition Schema
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: z.ZodType<unknown>;
  requiresConfirmation: boolean;
  cacheTTLSeconds: number; // 0 = no cache
  rateLimit: {
    maxCalls: number;
    windowSeconds: number;
  };
}

// ============================================================================
// Monitoring Tool Schemas
// ============================================================================

export const GetMessageLogsInputSchema = z.object({
  status: z.enum(["COMPLETED", "FAILED", "PROCESSING", "RETRY", "ESCALATED", "CANCELLED"]).optional(),
  iFlowId: z.string().optional(),
  fromDate: z.string().optional().describe("ISO 8601 date string"),
  toDate: z.string().optional().describe("ISO 8601 date string"),
  limit: z.number().min(1).max(100).default(50),
  searchQuery: z.string().optional().describe("Search in message ID or correlation ID"),
});

export const GetMessageDetailsInputSchema = z.object({
  messageGuid: z.string().describe("The unique identifier of the message"),
  includeRunSteps: z.boolean().default(true),
  includeAttachments: z.boolean().default(false),
  includeErrorInfo: z.boolean().default(true),
});

export const GetErrorInfoInputSchema = z.object({
  messageGuid: z.string().describe("The unique identifier of the failed message"),
  includeStackTrace: z.boolean().default(true),
});

export const GetRunStepsInputSchema = z.object({
  messageGuid: z.string().describe("The unique identifier of the message"),
});

// ============================================================================
// iFlow Tool Schemas
// ============================================================================

export const ListIFlowsInputSchema = z.object({
  status: z.enum(["STARTED", "STOPPED", "ERROR", "STARTING"]).optional(),
  packageId: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});

export const GetIFlowConfigInputSchema = z.object({
  iFlowId: z.string().describe("The technical ID of the iFlow"),
  version: z.string().optional().describe("Specific version, defaults to latest"),
});

export const GetIFlowPerformanceInputSchema = z.object({
  iFlowId: z.string().describe("The technical ID of the iFlow"),
  fromDate: z.string().optional().describe("ISO 8601 date string, defaults to last 24 hours"),
  toDate: z.string().optional().describe("ISO 8601 date string"),
});

export const DownloadIFlowInputSchema = z.object({
  iFlowId: z.string().describe("The technical ID of the iFlow"),
  version: z.string().optional(),
});

export const AnalyzeIFlowInputSchema = z.object({
  iFlowId: z.string().describe("The technical ID of the iFlow"),
  analysisType: z.enum(["security", "performance", "documentation", "errors"]).default("errors"),
});

// ============================================================================
// Package Tool Schemas
// ============================================================================

export const ListPackagesInputSchema = z.object({
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});

export const GetPackageDetailsInputSchema = z.object({
  packageId: z.string().describe("The technical ID of the integration package"),
  includeArtifacts: z.boolean().default(true),
});

export const CreatePackageInputSchema = z.object({
  id: z.string().describe("Technical ID for the package (no spaces)"),
  name: z.string().describe("Display name of the package"),
  description: z.string().optional(),
  shortText: z.string().optional(),
  version: z.string().default("1.0.0"),
  vendor: z.string().optional(),
});

// ============================================================================
// Action Tool Schemas (Require Confirmation)
// ============================================================================

export const DeployIFlowInputSchema = z.object({
  iFlowId: z.string().describe("The technical ID of the iFlow to deploy"),
  version: z.string().optional().describe("Specific version to deploy"),
});

export const RestartIFlowInputSchema = z.object({
  iFlowId: z.string().describe("The technical ID of the iFlow to restart"),
});

export const CreateIFlowInputSchema = z.object({
  packageId: z.string().describe("The package to create the iFlow in"),
  id: z.string().describe("Technical ID for the iFlow (no spaces)"),
  name: z.string().describe("Display name of the iFlow"),
  description: z.string().optional(),
  // The actual iFlow content will be generated by AI based on conversation
});

export const UndeployIFlowInputSchema = z.object({
  iFlowId: z.string().describe("The technical ID of the iFlow to undeploy"),
});

// ============================================================================
// Analytics Tool Schemas
// ============================================================================

export const GetExecutionStatsInputSchema = z.object({
  iFlowId: z.string().optional().describe("Filter by specific iFlow"),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  groupBy: z.enum(["hour", "day", "week"]).default("day"),
});

export const GetErrorTrendsInputSchema = z.object({
  iFlowId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.number().min(1).max(50).default(10),
});

export const GetPerformanceMetricsInputSchema = z.object({
  iFlowId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  metrics: z.array(z.enum(["avgDuration", "p95Duration", "p99Duration", "throughput", "errorRate"])).default(["avgDuration", "errorRate"]),
});

export const GetTopErrorsInputSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.number().min(1).max(20).default(10),
});

// Catalog schemas
export const SearchSAPCatalogInputSchema = z.object({
  query: z.string().describe("Keywords to search for in the SAP content catalog (e.g., 'S/4HANA', 'SuccessFactors', 'Ariba')"),
  supportedPlatform: z.string().optional().describe("Filter by platform (e.g., 'SAP HANA Cloud Integration')"),
  top: z.number().min(1).max(20).default(10).describe("Maximum number of packages to return"),
});

// ============================================================================
// APIM Monitoring Tool Schemas
// ============================================================================

export const GetAPIMLogsInputSchema = z.object({
  proxyName: z.string().optional().describe("Filter by specific API proxy name"),
  statusFilter: z.enum(["all", "2xx", "3xx", "4xx", "5xx", "error"]).optional().default("all").describe("Filter by HTTP status category"),
  method: z.enum(["all", "GET", "POST", "PUT", "PATCH", "DELETE"]).optional().default("all").describe("Filter by HTTP method"),
  fromDate: z.string().optional().describe("ISO 8601 date string for start of range"),
  toDate: z.string().optional().describe("ISO 8601 date string for end of range"),
  limit: z.number().min(1).max(100).default(50).describe("Maximum number of log entries to return"),
});

export const GetAPIMProxyListInputSchema = z.object({
  search: z.string().optional().describe("Search term to filter proxies by name or title"),
  state: z.enum(["DEPLOYED", "UNDEPLOYED"]).optional().describe("Filter by proxy deployment state"),
  limit: z.number().min(1).max(200).default(50).describe("Maximum number of proxies to return"),
});

export const GetAPIMErrorsInputSchema = z.object({
  proxyName: z.string().optional().describe("Filter errors by specific API proxy name"),
  fromDate: z.string().optional().describe("ISO 8601 date string for start of range"),
  toDate: z.string().optional().describe("ISO 8601 date string for end of range"),
  limit: z.number().min(1).max(50).default(20).describe("Maximum number of error entries to return"),
});

// ============================================================================
// Tool Response Types
// ============================================================================

export interface MessageLogSummary {
  messageGuid: string;
  status: string;
  logStart: string;
  logEnd?: string;
  duration?: number;
  sender?: string;
  receiver?: string;
  iFlowId: string;
  iFlowName: string;
  correlationId?: string;
  customStatus?: string;
}

export interface MessageLogDetail extends MessageLogSummary {
  runSteps?: RunStep[];
  attachments?: Attachment[];
  errorInfo?: ErrorInfo;
}

export interface RunStep {
  stepId: string;
  modelStepId: string;
  branchId: string;
  status: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  error?: string;
}

export interface Attachment {
  id: string;
  name: string;
  contentType: string;
  size?: number;
}

export interface ErrorInfo {
  type: string;
  message: string;
  stackTrace?: string;
  lastErrorAt?: string;
}

export interface IFlowSummary {
  id: string;
  name: string;
  version: string;
  packageId: string;
  packageName?: string;
  status: string;
  deployedOn?: string;
  modifiedAt?: string;
}

export interface IFlowConfig {
  id: string;
  name: string;
  description?: string;
  version: string;
  sender?: AdapterConfig;
  receiver?: AdapterConfig;
  scripts?: ScriptConfig[];
  mappings?: MappingConfig[];
  errorHandler?: ErrorHandlerConfig;
}

export interface AdapterConfig {
  type: string;
  address?: string;
  authentication?: string;
  parameters?: Record<string, string>;
}

export interface ScriptConfig {
  name: string;
  type: "groovy" | "javascript" | "xslt";
  content?: string;
}

export interface MappingConfig {
  name: string;
  type: string;
  source?: string;
  target?: string;
}

export interface ErrorHandlerConfig {
  type: string;
  stepId?: string;
}

export interface PerformanceMetrics {
  iFlowId: string;
  period: { from: string; to: string };
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  p95DurationMs?: number;
  p99DurationMs?: number;
  throughputPerHour: number;
  errorRate: number;
}

export interface ExecutionStats {
  period: { from: string; to: string };
  groupBy: string;
  data: Array<{
    timestamp: string;
    total: number;
    success: number;
    failed: number;
    avgDuration: number;
  }>;
}

export interface ErrorTrend {
  errorType: string;
  count: number;
  percentage: number;
  affectedIFlows: string[];
  lastOccurrence: string;
  exampleMessage?: string;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlSeconds: number;
  tenantId: string;
  toolName: string;
  argsHash: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  oldestEntry?: number;
}

// ============================================================================
// Audit Log Types
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  tenantId: string;
  toolName: string;
  category: ToolCategory;
  arguments: Record<string, unknown>;
  result: "success" | "failure" | "pending_confirmation";
  executionTimeMs: number;
  errorMessage?: string;
  confirmationToken?: string;
}

// ============================================================================
// Rate Limit Types
// ============================================================================

export interface RateLimitState {
  userId: string;
  toolName: string;
  windowStart: number;
  callCount: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingCalls: number;
  resetInSeconds: number;
}

// ============================================================================
// Tool Execution Context (for external callers)
// ============================================================================

export interface ToolExecutionContext {
  userId: string;
  tenantId: string;
  sapClient: any; // SAPCPIClient from lib/sap-cpi/client
  parameters: Record<string, unknown>;
}
