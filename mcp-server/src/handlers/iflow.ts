/**
 * SAP CPI MCP Server - iFlow Tool Handlers
 * 
 * Implements handlers for iFlow tools:
 * - list_iflows
 * - get_iflow_config
 * - get_iflow_performance
 * - download_iflow
 * - analyze_iflow
 */

import { z } from "zod";
import {
  TenantContext,
  ToolExecutionResult,
  ListIFlowsInputSchema,
  GetIFlowConfigInputSchema,
  GetIFlowPerformanceInputSchema,
  DownloadIFlowInputSchema,
  AnalyzeIFlowInputSchema,
  SearchSAPCatalogInputSchema,
  IFlowSummary,
  IFlowConfig,
  PerformanceMetrics,
} from "../types";

// Type for the SAP CPI client (will be injected)
export interface SAPCPIClientInterface {
  getIntegrationRuntimeArtifacts(): Promise<{ results: any[] }>;
  
  getIntegrationDesigntimeArtifact(id: string, version?: string): Promise<any>;
  
  downloadIFlowContent(id: string, version?: string): Promise<Buffer>;
  
  getIFlowPerformanceStats(id: string, fromDate?: string, toDate?: string): Promise<any>;
  
  parseIFlowBPMN(bpmnContent: string): Promise<any>;
  
  getMessageProcessingLogs(params: {
    status?: string;
    fromDate?: string;
    toDate?: string;
    top?: number;
    filter?: string;
  }): Promise<{ results: any[] }>;
}

/**
 * Handle list_iflows tool
 */
export async function handleListIFlows(
  client: SAPCPIClientInterface,
  args: z.infer<typeof ListIFlowsInputSchema>,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    const result = await client.getIntegrationRuntimeArtifacts();
    
    let iflows: IFlowSummary[] = result.results.map((artifact: any) => ({
      id: artifact.Id || artifact.Name,
      name: artifact.Name,
      version: artifact.Version,
      packageId: artifact.PackageId,
      packageName: artifact.PackageName,
      status: artifact.Status || "UNKNOWN",
      deployedOn: artifact.DeployedOn,
      modifiedAt: artifact.ModifiedAt,
    }));

    // Apply filters
    if (args.status) {
      iflows = iflows.filter(f => f.status === args.status);
    }

    if (args.packageId) {
      iflows = iflows.filter(f => f.packageId === args.packageId);
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      iflows = iflows.filter(f => 
        f.id.toLowerCase().includes(searchLower) ||
        f.name.toLowerCase().includes(searchLower)
      );
    }

    // Apply limit
    const limited = iflows.slice(0, args.limit);

    return {
      success: true,
      data: {
        iflows: limited,
        total: iflows.length,
        returned: limited.length,
        hasMore: iflows.length > limited.length,
        filters: {
          status: args.status,
          packageId: args.packageId,
          search: args.search,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list iFlows: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Handle get_iflow_config tool
 */
export async function handleGetIFlowConfig(
  client: SAPCPIClientInterface,
  args: z.infer<typeof GetIFlowConfigInputSchema>,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    // Get design-time artifact
    const artifact = await client.getIntegrationDesigntimeArtifact(args.iFlowId, args.version);
    
    if (!artifact) {
      return {
        success: false,
        error: `iFlow not found: ${args.iFlowId}`,
      };
    }

    // Download and parse the BPMN content
    let parsedConfig: any = null;
    try {
      const content = await client.downloadIFlowContent(args.iFlowId, args.version);
      if (content) {
        parsedConfig = await client.parseIFlowBPMN(content.toString());
      }
    } catch (e) {
      // BPMN parsing might fail for some iFlows
    }

    const config: IFlowConfig = {
      id: artifact.Id,
      name: artifact.Name,
      description: artifact.Description,
      version: artifact.Version,
    };

    // Add parsed configuration if available
    if (parsedConfig) {
      config.sender = parsedConfig.sender;
      config.receiver = parsedConfig.receiver;
      config.scripts = parsedConfig.scripts?.map((s: any) => ({
        name: s.name,
        type: s.type,
        content: s.content?.substring(0, 500) + (s.content?.length > 500 ? "..." : ""),
      }));
      config.mappings = parsedConfig.mappings;
      config.errorHandler = parsedConfig.errorHandler;
    }

    return {
      success: true,
      data: config,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get iFlow config: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Handle get_iflow_performance tool
 */
export async function handleGetIFlowPerformance(
  client: SAPCPIClientInterface,
  args: z.infer<typeof GetIFlowPerformanceInputSchema>,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    // Default to last 24 hours if not specified
    const toDate = args.toDate || new Date().toISOString();
    const fromDate = args.fromDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get message logs for this iFlow
    const logsResult = await client.getMessageProcessingLogs({
      filter: `IntegrationFlowName eq '${args.iFlowId}'`,
      fromDate,
      toDate,
      top: 1000,
    });

    const logs = logsResult.results;

    if (logs.length === 0) {
      return {
        success: true,
        data: {
          iFlowId: args.iFlowId,
          period: { from: fromDate, to: toDate },
          totalExecutions: 0,
          message: "No executions found in the specified period",
        } as Partial<PerformanceMetrics>,
      };
    }

    // Calculate metrics
    const successLogs = logs.filter((l: any) => l.Status === "COMPLETED");
    const failedLogs = logs.filter((l: any) => l.Status === "FAILED");

    // Calculate durations
    const durations = logs
      .filter((l: any) => l.LogEnd && l.LogStart)
      .map((l: any) => new Date(l.LogEnd).getTime() - new Date(l.LogStart).getTime())
      .sort((a, b) => a - b);

    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    // Calculate time period in hours for throughput
    const periodHours = (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60);

    const metrics: PerformanceMetrics = {
      iFlowId: args.iFlowId,
      period: { from: fromDate, to: toDate },
      totalExecutions: logs.length,
      successCount: successLogs.length,
      failureCount: failedLogs.length,
      avgDurationMs: Math.round(avgDuration),
      p95DurationMs: durations[p95Index] || avgDuration,
      p99DurationMs: durations[p99Index] || avgDuration,
      throughputPerHour: Math.round(logs.length / periodHours * 100) / 100,
      errorRate: Math.round((failedLogs.length / logs.length) * 100 * 100) / 100,
    };

    return {
      success: true,
      data: metrics,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get iFlow performance: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Handle download_iflow tool
 */
export async function handleDownloadIFlow(
  client: SAPCPIClientInterface,
  args: z.infer<typeof DownloadIFlowInputSchema>,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    const content = await client.downloadIFlowContent(args.iFlowId, args.version);
    
    if (!content) {
      return {
        success: false,
        error: `Failed to download iFlow: ${args.iFlowId}`,
      };
    }

    // Parse the BPMN content
    const parsed = await client.parseIFlowBPMN(content.toString());

    return {
      success: true,
      data: {
        iFlowId: args.iFlowId,
        version: args.version || "latest",
        parsed,
        rawSize: content.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to download iFlow: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Handle analyze_iflow tool
 */
export async function handleAnalyzeIFlow(
  client: SAPCPIClientInterface,
  args: z.infer<typeof AnalyzeIFlowInputSchema>,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    // Download and parse iFlow
    const content = await client.downloadIFlowContent(args.iFlowId);
    
    if (!content) {
      return {
        success: false,
        error: `Failed to download iFlow for analysis: ${args.iFlowId}`,
      };
    }

    const parsed = await client.parseIFlowBPMN(content.toString());
    
    // Get recent execution data for error/performance analysis
    const logsResult = await client.getMessageProcessingLogs({
      filter: `IntegrationFlowName eq '${args.iFlowId}'`,
      fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      top: 100,
    });

    const logs = logsResult.results;

    // Build analysis based on type
    let analysis: any = {
      iFlowId: args.iFlowId,
      analysisType: args.analysisType,
      timestamp: new Date().toISOString(),
    };

    switch (args.analysisType) {
      case "security":
        analysis.findings = analyzeSecurityIssues(parsed);
        break;
      case "performance":
        analysis.findings = analyzePerformanceIssues(parsed, logs);
        break;
      case "documentation":
        analysis.documentation = generateDocumentation(parsed);
        break;
      case "errors":
        analysis.findings = analyzeErrorPatterns(logs);
        break;
    }

    return {
      success: true,
      data: analysis,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to analyze iFlow: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// Helper functions for analysis

function analyzeSecurityIssues(parsed: any): any[] {
  const issues: any[] = [];

  // Check for hardcoded credentials
  if (parsed.scripts) {
    for (const script of parsed.scripts) {
      if (script.content && /password|secret|apikey|token/i.test(script.content)) {
        issues.push({
          severity: "high",
          category: "credentials",
          message: `Potential hardcoded credentials in script: ${script.name}`,
          recommendation: "Use external parameters or secure store for credentials",
        });
      }
    }
  }

  // Check authentication settings
  if (parsed.sender?.authentication === "None") {
    issues.push({
      severity: "medium",
      category: "authentication",
      message: "Sender endpoint has no authentication configured",
      recommendation: "Enable authentication (OAuth, Basic, Certificate) for production",
    });
  }

  // Check for sensitive data in logging
  if (parsed.scripts?.some((s: any) => s.content?.includes("log.info") && s.content?.includes("password"))) {
    issues.push({
      severity: "high",
      category: "logging",
      message: "Potential sensitive data being logged",
      recommendation: "Avoid logging sensitive information",
    });
  }

  return issues;
}

function analyzePerformanceIssues(parsed: any, logs: any[]): any[] {
  const issues: any[] = [];

  // Check for synchronous external calls without timeout
  if (parsed.receiver?.type === "HTTP" && !parsed.receiver?.parameters?.timeout) {
    issues.push({
      severity: "medium",
      category: "timeout",
      message: "HTTP receiver has no timeout configured",
      recommendation: "Set appropriate timeout to prevent hanging executions",
    });
  }

  // Check for large script complexity
  if (parsed.scripts?.some((s: any) => s.content?.length > 5000)) {
    issues.push({
      severity: "low",
      category: "complexity",
      message: "Large script detected which may impact performance",
      recommendation: "Consider breaking down into smaller, modular scripts",
    });
  }

  // Analyze execution durations from logs
  const durations = logs
    .filter((l: any) => l.LogEnd && l.LogStart)
    .map((l: any) => new Date(l.LogEnd).getTime() - new Date(l.LogStart).getTime());

  if (durations.length > 0) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    if (avg > 30000) { // > 30 seconds
      issues.push({
        severity: "medium",
        category: "duration",
        message: `Average execution time is ${Math.round(avg / 1000)}s which is high`,
        recommendation: "Review processing logic and consider async patterns",
      });
    }
  }

  return issues;
}

function generateDocumentation(parsed: any): any {
  return {
    overview: {
      name: parsed.name,
      description: parsed.description || "No description provided",
      version: parsed.version,
    },
    sender: parsed.sender ? {
      type: parsed.sender.type,
      endpoint: parsed.sender.address,
      authentication: parsed.sender.authentication,
    } : null,
    receiver: parsed.receiver ? {
      type: parsed.receiver.type,
      endpoint: parsed.receiver.address,
      authentication: parsed.receiver.authentication,
    } : null,
    processingSteps: [
      ...(parsed.scripts?.map((s: any) => ({
        type: "Script",
        name: s.name,
        language: s.type,
      })) || []),
      ...(parsed.mappings?.map((m: any) => ({
        type: "Mapping",
        name: m.name,
        mappingType: m.type,
      })) || []),
    ],
    errorHandling: parsed.errorHandler ? {
      type: parsed.errorHandler.type,
      strategy: parsed.errorHandler.strategy,
    } : "Default (no custom error handling)",
  };
}

function analyzeErrorPatterns(logs: any[]): any[] {
  const failedLogs = logs.filter((l: any) => l.Status === "FAILED");
  
  if (failedLogs.length === 0) {
    return [{
      severity: "info",
      category: "status",
      message: "No failures in the analyzed period",
      recommendation: "Continue monitoring",
    }];
  }

  const errorRate = (failedLogs.length / logs.length) * 100;
  const issues: any[] = [];

  if (errorRate > 10) {
    issues.push({
      severity: "high",
      category: "error_rate",
      message: `High error rate: ${errorRate.toFixed(1)}% of executions failed`,
      recommendation: "Investigate common error patterns and fix root causes",
    });
  } else if (errorRate > 5) {
    issues.push({
      severity: "medium",
      category: "error_rate",
      message: `Moderate error rate: ${errorRate.toFixed(1)}% of executions failed`,
      recommendation: "Review failed executions for patterns",
    });
  }

  // Group errors by time to detect spikes
  const errorsByHour: Record<string, number> = {};
  for (const log of failedLogs) {
    const hour = new Date(log.LogStart).toISOString().substring(0, 13);
    errorsByHour[hour] = (errorsByHour[hour] || 0) + 1;
  }

  const maxErrorsPerHour = Math.max(...Object.values(errorsByHour));
  if (maxErrorsPerHour > 10) {
    issues.push({
      severity: "medium",
      category: "spike",
      message: `Error spike detected: ${maxErrorsPerHour} errors in a single hour`,
      recommendation: "Check for system issues or data problems at that time",
    });
  }

  return issues;
}

/**
 * Handle search_sap_catalog tool
 *
 * Queries the catalog.svc OData endpoint for SAP-provided standard
 * integration content packages matching the given keywords.
 */
export async function handleSearchSAPCatalog(
  client: SAPCPIClientInterface & { tenantUrl?: string; getAuthHeader?: () => Promise<string> },
  args: z.infer<typeof SearchSAPCatalogInputSchema>,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    const tenantUrl = client.tenantUrl ?? context.tenantId;
    const authHeader = client.getAuthHeader
      ? await client.getAuthHeader()
      : undefined;

    if (!tenantUrl || !authHeader) {
      return {
        success: false,
        error: "Catalog search requires tenant URL and authentication. Ensure the CPI client exposes tenantUrl and getAuthHeader.",
      };
    }

    // Build $filter
    const filterParts: string[] = [];

    if (args.supportedPlatform) {
      filterParts.push(`SupportedPlatforms eq '${args.supportedPlatform}'`);
    } else {
      filterParts.push(
        "(SupportedPlatforms eq 'SAP HANA Cloud Integration' or SupportedPlatforms eq 'SAP Process Orchestration')"
      );
    }

    // Split query into keywords and search Name/Description/Keywords
    const keywords = args.query
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 5); // limit to 5 keywords

    if (keywords.length > 0) {
      const kwFilter = keywords
        .map((kw) => {
          const safe = kw.replace(/'/g, "''");
          return [
            `substringof('${safe}', Name)`,
            `substringof('${safe}', Description)`,
            `substringof('${safe}', Keywords)`,
          ].join(" or ");
        })
        .map((group) => `(${group})`)
        .join(" or ");

      filterParts.push(`(${kwFilter})`);
    }

    const filterStr = filterParts.join(" and ");

    const params = new URLSearchParams({
      $filter: filterStr,
      $orderby: "ModifiedAt desc",
      $top: String(args.top),
      $format: "json",
    });

    const url = `${tenantUrl}/odata/1.0/catalog.svc/ContentEntities.ContentPackages?${params}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Catalog search failed (${response.status}): ${errorText}`,
      };
    }

    const data = await response.json();
    const packages = (data.d?.results ?? []).map((pkg: any) => ({
      id: pkg.Id,
      name: pkg.Name,
      description: pkg.Description || pkg.ShortText || "",
      version: pkg.Version,
      vendor: pkg.Vendor,
      supportedPlatforms: pkg.SupportedPlatforms,
      products: pkg.Products,
      keywords: pkg.Keywords,
    }));

    return {
      success: true,
      data: {
        packages,
        totalCount: packages.length,
        query: args.query,
        filter: filterStr,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to search SAP catalog: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
