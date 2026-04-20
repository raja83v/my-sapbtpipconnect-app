/**
 * SAP CPI MCP Server - Tool Registry
 *
 * Defines all available tools with their schemas, descriptions,
 * and configuration for caching, rate limiting, and confirmation.
 */

import { z } from "zod";
import {
  ToolDefinition,
  // Monitoring schemas
  GetMessageLogsInputSchema,
  GetMessageDetailsInputSchema,
  GetErrorInfoInputSchema,
  GetRunStepsInputSchema,
  // iFlow schemas
  ListIFlowsInputSchema,
  GetIFlowConfigInputSchema,
  GetIFlowPerformanceInputSchema,
  DownloadIFlowInputSchema,
  AnalyzeIFlowInputSchema,
  // Package schemas
  ListPackagesInputSchema,
  GetPackageDetailsInputSchema,
  CreatePackageInputSchema,
  // Action schemas
  DeployIFlowInputSchema,
  RestartIFlowInputSchema,
  CreateIFlowInputSchema,
  UndeployIFlowInputSchema,
  // Analytics schemas
  GetExecutionStatsInputSchema,
  GetErrorTrendsInputSchema,
  GetPerformanceMetricsInputSchema,
  GetTopErrorsInputSchema,
  // Catalog schemas
  SearchSAPCatalogInputSchema,
} from "../types";

// ============================================================================
// Tool Registry - All available SAP CPI tools
// ============================================================================

export const toolRegistry: Record<string, ToolDefinition> = {
  // ==========================================================================
  // MONITORING TOOLS - Real-time message and execution monitoring
  // ==========================================================================

  get_message_logs: {
    name: "get_message_logs",
    description: `Retrieve message processing logs from SAP CPI. Use this to:
- Monitor recent integration executions
- Filter by status (COMPLETED, FAILED, PROCESSING, etc.)
- Search for specific messages by ID or correlation ID
- Filter by date range or specific iFlow

Returns a list of message summaries with status, duration, and identifiers.`,
    category: "monitoring",
    inputSchema: GetMessageLogsInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 30, // Short cache for near real-time data
    rateLimit: { maxCalls: 60, windowSeconds: 60 },
  },

  get_message_details: {
    name: "get_message_details",
    description: `Get detailed information about a specific message execution. Use this to:
- Investigate a specific failed or successful message
- View execution run steps and timing
- Check attached payloads and headers
- Retrieve error information and stack traces

Requires the messageGuid from get_message_logs.`,
    category: "monitoring",
    inputSchema: GetMessageDetailsInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 60,
    rateLimit: { maxCalls: 120, windowSeconds: 60 },
  },

  get_error_info: {
    name: "get_error_info",
    description: `Get detailed error information for a failed message. Use this to:
- Retrieve the full error message and type
- Get the complete stack trace for debugging
- Understand the root cause of failures

Best used after identifying a failed message with get_message_logs.`,
    category: "monitoring",
    inputSchema: GetErrorInfoInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 120, // Errors don't change
    rateLimit: { maxCalls: 60, windowSeconds: 60 },
  },

  get_run_steps: {
    name: "get_run_steps",
    description: `Get the execution trace (run steps) for a message. Use this to:
- See each step the message went through
- Identify which step failed or was slow
- Analyze the execution flow and timing
- Debug complex integration scenarios

Shows the sequence of adapters, scripts, and mappings executed.`,
    category: "monitoring",
    inputSchema: GetRunStepsInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 120,
    rateLimit: { maxCalls: 60, windowSeconds: 60 },
  },

  // ==========================================================================
  // IFLOW TOOLS - Integration flow management
  // ==========================================================================

  list_iflows: {
    name: "list_iflows",
    description: `List all integration flows (iFlows) in the tenant. Use this to:
- Get an overview of all deployed integrations
- Filter by status (STARTED, STOPPED, ERROR)
- Search for specific iFlows by name
- Find iFlows in a specific package

Returns iFlow IDs, names, versions, and deployment status.`,
    category: "iflow",
    inputSchema: ListIFlowsInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 60,
    rateLimit: { maxCalls: 30, windowSeconds: 60 },
  },

  get_iflow_config: {
    name: "get_iflow_config",
    description: `Get the configuration details of an iFlow. Use this to:
- Understand the iFlow's structure and components
- View sender and receiver adapter configurations
- See scripts, mappings, and error handlers
- Analyze the integration design

Returns detailed configuration including adapters, scripts, and mappings.`,
    category: "iflow",
    inputSchema: GetIFlowConfigInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 300, // Config changes less frequently
    rateLimit: { maxCalls: 30, windowSeconds: 60 },
  },

  get_iflow_performance: {
    name: "get_iflow_performance",
    description: `Get performance metrics for a specific iFlow. Use this to:
- Analyze average, p95, and p99 response times
- Check throughput and execution counts
- Monitor error rates over time
- Identify performance trends

Returns comprehensive performance statistics.`,
    category: "iflow",
    inputSchema: GetIFlowPerformanceInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 60,
    rateLimit: { maxCalls: 30, windowSeconds: 60 },
  },

  download_iflow: {
    name: "download_iflow",
    description: `Download an iFlow's BPMN2 configuration. Use this to:
- Get the full iFlow definition for analysis
- Extract scripts and mappings for review
- Prepare for migration or backup
- Deep-dive into complex integrations

Returns the parsed iFlow structure from the BPMN2 XML.`,
    category: "iflow",
    inputSchema: DownloadIFlowInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 600, // Design artifacts are stable
    rateLimit: { maxCalls: 10, windowSeconds: 60 },
  },

  analyze_iflow: {
    name: "analyze_iflow",
    description: `Perform automated analysis on an iFlow. Use this to:
- Security: Check for vulnerabilities and best practices
- Performance: Identify bottlenecks and optimization opportunities
- Documentation: Generate technical documentation
- Errors: Analyze common failure patterns

Returns detailed analysis results with recommendations.`,
    category: "iflow",
    inputSchema: AnalyzeIFlowInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 300,
    rateLimit: { maxCalls: 10, windowSeconds: 60 },
  },

  // ==========================================================================
  // PACKAGE TOOLS - Integration package management
  // ==========================================================================

  list_packages: {
    name: "list_packages",
    description: `List all integration packages in the tenant. Use this to:
- Get an overview of all packages
- Search for specific packages
- Find packages to create new iFlows in

Returns package IDs, names, versions, and artifact counts.`,
    category: "package",
    inputSchema: ListPackagesInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 120,
    rateLimit: { maxCalls: 30, windowSeconds: 60 },
  },

  get_package_details: {
    name: "get_package_details",
    description: `Get detailed information about an integration package. Use this to:
- View all artifacts in a package
- Check package metadata and version
- List iFlows, value mappings, and other artifacts

Returns comprehensive package information.`,
    category: "package",
    inputSchema: GetPackageDetailsInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 120,
    rateLimit: { maxCalls: 30, windowSeconds: 60 },
  },

  create_package: {
    name: "create_package",
    description: `Create a new integration package. Use this to:
- Set up a new package for organizing iFlows
- Create a container for related integrations

⚠️ This action modifies the tenant and requires confirmation.`,
    category: "package",
    inputSchema: CreatePackageInputSchema,
    requiresConfirmation: true,
    cacheTTLSeconds: 0,
    rateLimit: { maxCalls: 5, windowSeconds: 60 },
  },

  // ==========================================================================
  // ACTION TOOLS - Deployment and lifecycle management (REQUIRE CONFIRMATION)
  // ==========================================================================

  deploy_iflow: {
    name: "deploy_iflow",
    description: `Deploy an iFlow to the runtime. Use this to:
- Deploy a new version of an iFlow
- Activate changes made in design time
- Start a stopped iFlow

⚠️ CRITICAL: This will deploy the iFlow to production runtime.
Requires explicit user confirmation before execution.`,
    category: "action",
    inputSchema: DeployIFlowInputSchema,
    requiresConfirmation: true,
    cacheTTLSeconds: 0,
    rateLimit: { maxCalls: 5, windowSeconds: 60 },
  },

  restart_iflow: {
    name: "restart_iflow",
    description: `Restart a deployed iFlow. Use this to:
- Apply configuration changes
- Recover from error state
- Clear cached connections

⚠️ WARNING: This will briefly interrupt message processing.
Requires explicit user confirmation before execution.`,
    category: "action",
    inputSchema: RestartIFlowInputSchema,
    requiresConfirmation: true,
    cacheTTLSeconds: 0,
    rateLimit: { maxCalls: 3, windowSeconds: 60 },
  },

  create_iflow: {
    name: "create_iflow",
    description: `Create a new iFlow in an integration package. Use this to:
- Create a new integration from scratch
- Add a new iFlow to an existing package

⚠️ This creates a new design-time artifact.
Requires explicit user confirmation before execution.`,
    category: "action",
    inputSchema: CreateIFlowInputSchema,
    requiresConfirmation: true,
    cacheTTLSeconds: 0,
    rateLimit: { maxCalls: 3, windowSeconds: 60 },
  },

  undeploy_iflow: {
    name: "undeploy_iflow",
    description: `Undeploy (stop) an iFlow from the runtime. Use this to:
- Stop a running iFlow
- Remove from production runtime
- Prepare for maintenance

⚠️ CRITICAL: This will stop the iFlow and reject incoming messages.
Requires explicit user confirmation before execution.`,
    category: "action",
    inputSchema: UndeployIFlowInputSchema,
    requiresConfirmation: true,
    cacheTTLSeconds: 0,
    rateLimit: { maxCalls: 3, windowSeconds: 60 },
  },

  // ==========================================================================
  // ANALYTICS TOOLS - Statistics, trends, and insights
  // ==========================================================================

  get_execution_stats: {
    name: "get_execution_stats",
    description: `Get execution statistics over time. Use this to:
- View success/failure trends
- Analyze execution patterns by hour/day/week
- Monitor overall system health
- Identify usage patterns

Returns time-series data for charting and analysis.`,
    category: "analytics",
    inputSchema: GetExecutionStatsInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 60,
    rateLimit: { maxCalls: 30, windowSeconds: 60 },
  },

  get_error_trends: {
    name: "get_error_trends",
    description: `Analyze error trends and patterns. Use this to:
- Identify most common error types
- See which iFlows have the most errors
- Track error frequencies over time
- Find recurring issues

Returns error categorization with counts and affected iFlows.`,
    category: "analytics",
    inputSchema: GetErrorTrendsInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 60,
    rateLimit: { maxCalls: 30, windowSeconds: 60 },
  },

  get_performance_metrics: {
    name: "get_performance_metrics",
    description: `Get detailed performance metrics. Use this to:
- Compare performance across iFlows
- Track response time trends
- Monitor throughput and capacity
- Identify performance degradation

Returns metrics like avg/p95/p99 duration, throughput, and error rates.`,
    category: "analytics",
    inputSchema: GetPerformanceMetricsInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 60,
    rateLimit: { maxCalls: 30, windowSeconds: 60 },
  },

  get_top_errors: {
    name: "get_top_errors",
    description: `Get the most frequent errors across all iFlows. Use this to:
- Quickly identify the biggest issues
- Prioritize error resolution
- See error impact across the system

Returns ranked list of errors with counts and examples.`,
    category: "analytics",
    inputSchema: GetTopErrorsInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 60,
    rateLimit: { maxCalls: 30, windowSeconds: 60 },
  },

  // ==========================================================================
  // CATALOG TOOLS - SAP standard content catalog
  // ==========================================================================

  search_sap_catalog: {
    name: "search_sap_catalog",
    description: `Search the SAP standard content catalog for integration packages. Use this to:
- Find SAP-provided standard iFlows and integration content
- Discover best-practice patterns for specific SAP products
- Check if a standard integration already exists before building custom
- Browse available adapters and integration patterns

Returns matching catalog packages with their artifacts.`,
    category: "iflow",
    inputSchema: SearchSAPCatalogInputSchema,
    requiresConfirmation: false,
    cacheTTLSeconds: 3600, // Catalog content is relatively static
    rateLimit: { maxCalls: 10, windowSeconds: 60 },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all tools as an array
 */
export function getAllTools(): ToolDefinition[] {
  return Object.values(toolRegistry);
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: string): ToolDefinition[] {
  return Object.values(toolRegistry).filter(tool => tool.category === category);
}

/**
 * Get tool by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return toolRegistry[name];
}

/**
 * Get all action tools (require confirmation)
 */
export function getActionTools(): ToolDefinition[] {
  return Object.values(toolRegistry).filter(tool => tool.requiresConfirmation);
}

/**
 * Check if a tool requires confirmation
 */
export function requiresConfirmation(toolName: string): boolean {
  return toolRegistry[toolName]?.requiresConfirmation ?? false;
}

/**
 * Convert tool registry to OpenAI/Vercel AI SDK format
 */
export function getToolsForAI() {
  return Object.entries(toolRegistry).map(([name, tool]) => ({
    name,
    description: tool.description,
    parameters: tool.inputSchema,
  }));
}
