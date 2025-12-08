/**
 * SAP CPI MCP Server - Analytics Tool Handlers
 * 
 * Implements handlers for analytics tools:
 * - get_execution_stats
 * - get_error_trends
 * - get_performance_metrics
 * - get_top_errors
 */

import { z } from "zod";
import {
  TenantContext,
  ToolExecutionResult,
  GetExecutionStatsInputSchema,
  GetErrorTrendsInputSchema,
  GetPerformanceMetricsInputSchema,
  GetTopErrorsInputSchema,
  ExecutionStats,
  ErrorTrend,
  PerformanceMetrics,
} from "../types";

// Type for the SAP CPI client (will be injected)
export interface SAPCPIClientInterface {
  getMessageProcessingLogs(params: {
    status?: string;
    fromDate?: string;
    toDate?: string;
    top?: number;
    filter?: string;
  }): Promise<{ results: any[] }>;
  
  getMessageErrorInformation(messageGuid: string): Promise<any>;
  
  getIntegrationRuntimeArtifacts(): Promise<{ results: any[] }>;
}

/**
 * Handle get_execution_stats tool
 */
export async function handleGetExecutionStats(
  client: SAPCPIClientInterface,
  args: z.infer<typeof GetExecutionStatsInputSchema>,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    // Default to last 7 days if not specified
    const toDate = args.toDate || new Date().toISOString();
    const fromDate = args.fromDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Build filter
    let filter = "";
    if (args.iFlowId) {
      filter = `IntegrationFlowName eq '${args.iFlowId}'`;
    }

    const logsResult = await client.getMessageProcessingLogs({
      filter: filter || undefined,
      fromDate,
      toDate,
      top: 5000, // Get more for aggregation
    });

    const logs = logsResult.results;

    if (logs.length === 0) {
      return {
        success: true,
        data: {
          period: { from: fromDate, to: toDate },
          groupBy: args.groupBy,
          data: [],
          message: "No executions found in the specified period",
        } as ExecutionStats,
      };
    }

    // Group by time bucket
    const buckets: Record<string, { total: number; success: number; failed: number; durations: number[] }> = {};

    for (const log of logs) {
      const date = new Date(log.LogStart);
      let bucketKey: string;

      switch (args.groupBy) {
        case "hour":
          bucketKey = date.toISOString().substring(0, 13) + ":00:00Z";
          break;
        case "week":
          // Get start of week (Sunday)
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          bucketKey = weekStart.toISOString().substring(0, 10);
          break;
        case "day":
        default:
          bucketKey = date.toISOString().substring(0, 10);
          break;
      }

      if (!buckets[bucketKey]) {
        buckets[bucketKey] = { total: 0, success: 0, failed: 0, durations: [] };
      }

      buckets[bucketKey].total++;
      
      if (log.Status === "COMPLETED") {
        buckets[bucketKey].success++;
      } else if (log.Status === "FAILED") {
        buckets[bucketKey].failed++;
      }

      // Calculate duration
      if (log.LogEnd && log.LogStart) {
        const duration = new Date(log.LogEnd).getTime() - new Date(log.LogStart).getTime();
        buckets[bucketKey].durations.push(duration);
      }
    }

    // Build result data
    const data = Object.entries(buckets)
      .map(([timestamp, stats]) => ({
        timestamp,
        total: stats.total,
        success: stats.success,
        failed: stats.failed,
        avgDuration: stats.durations.length > 0
          ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
          : 0,
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const result: ExecutionStats = {
      period: { from: fromDate, to: toDate },
      groupBy: args.groupBy,
      data,
    };

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get execution stats: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Handle get_error_trends tool
 */
export async function handleGetErrorTrends(
  client: SAPCPIClientInterface,
  args: z.infer<typeof GetErrorTrendsInputSchema>,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    // Default to last 7 days if not specified
    const toDate = args.toDate || new Date().toISOString();
    const fromDate = args.fromDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Build filter for failed messages
    let filter = "Status eq 'FAILED'";
    if (args.iFlowId) {
      filter += ` and IntegrationFlowName eq '${args.iFlowId}'`;
    }

    const logsResult = await client.getMessageProcessingLogs({
      status: "FAILED",
      filter,
      fromDate,
      toDate,
      top: 500,
    });

    const failedLogs = logsResult.results;

    if (failedLogs.length === 0) {
      return {
        success: true,
        data: {
          period: { from: fromDate, to: toDate },
          trends: [],
          message: "No failures found in the specified period",
        },
      };
    }

    // Group errors by error message/type
    const errorGroups: Record<string, {
      count: number;
      iFlows: Set<string>;
      lastOccurrence: string;
      example?: any;
    }> = {};

    for (const log of failedLogs) {
      // Use custom status or a generic categorization
      const errorType = log.CustomStatus || categorizeError(log);
      
      if (!errorGroups[errorType]) {
        errorGroups[errorType] = {
          count: 0,
          iFlows: new Set(),
          lastOccurrence: log.LogStart,
          example: log,
        };
      }

      errorGroups[errorType].count++;
      errorGroups[errorType].iFlows.add(log.IntegrationFlowName);
      
      if (log.LogStart > errorGroups[errorType].lastOccurrence) {
        errorGroups[errorType].lastOccurrence = log.LogStart;
        errorGroups[errorType].example = log;
      }
    }

    // Convert to trends array and sort by count
    const trends: ErrorTrend[] = Object.entries(errorGroups)
      .map(([errorType, data]) => ({
        errorType,
        count: data.count,
        percentage: Math.round((data.count / failedLogs.length) * 100 * 100) / 100,
        affectedIFlows: Array.from(data.iFlows),
        lastOccurrence: data.lastOccurrence,
        exampleMessage: data.example?.MessageGuid,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, args.limit);

    return {
      success: true,
      data: {
        period: { from: fromDate, to: toDate },
        totalFailures: failedLogs.length,
        trends,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get error trends: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Handle get_performance_metrics tool
 */
export async function handleGetPerformanceMetrics(
  client: SAPCPIClientInterface,
  args: z.infer<typeof GetPerformanceMetricsInputSchema>,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    // Default to last 24 hours if not specified
    const toDate = args.toDate || new Date().toISOString();
    const fromDate = args.fromDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Build filter
    let filter = "";
    if (args.iFlowId) {
      filter = `IntegrationFlowName eq '${args.iFlowId}'`;
    }

    const logsResult = await client.getMessageProcessingLogs({
      filter: filter || undefined,
      fromDate,
      toDate,
      top: 2000,
    });

    const logs = logsResult.results;

    if (logs.length === 0) {
      return {
        success: true,
        data: {
          period: { from: fromDate, to: toDate },
          metrics: {},
          message: "No executions found in the specified period",
        },
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

    const periodHours = (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60);

    const metrics: Record<string, number> = {};

    if (args.metrics.includes("avgDuration") && durations.length > 0) {
      metrics.avgDurationMs = Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length
      );
    }

    if (args.metrics.includes("p95Duration") && durations.length > 0) {
      const p95Index = Math.floor(durations.length * 0.95);
      metrics.p95DurationMs = durations[p95Index] || metrics.avgDurationMs;
    }

    if (args.metrics.includes("p99Duration") && durations.length > 0) {
      const p99Index = Math.floor(durations.length * 0.99);
      metrics.p99DurationMs = durations[p99Index] || metrics.avgDurationMs;
    }

    if (args.metrics.includes("throughput")) {
      metrics.throughputPerHour = Math.round(logs.length / periodHours * 100) / 100;
    }

    if (args.metrics.includes("errorRate")) {
      metrics.errorRatePercent = Math.round((failedLogs.length / logs.length) * 100 * 100) / 100;
    }

    return {
      success: true,
      data: {
        period: { from: fromDate, to: toDate },
        iFlowId: args.iFlowId,
        totalExecutions: logs.length,
        successCount: successLogs.length,
        failureCount: failedLogs.length,
        metrics,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get performance metrics: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Handle get_top_errors tool
 */
export async function handleGetTopErrors(
  client: SAPCPIClientInterface,
  args: z.infer<typeof GetTopErrorsInputSchema>,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    // Default to last 24 hours if not specified
    const toDate = args.toDate || new Date().toISOString();
    const fromDate = args.fromDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const logsResult = await client.getMessageProcessingLogs({
      status: "FAILED",
      fromDate,
      toDate,
      top: 500,
    });

    const failedLogs = logsResult.results;

    if (failedLogs.length === 0) {
      return {
        success: true,
        data: {
          period: { from: fromDate, to: toDate },
          errors: [],
          message: "No failures found in the specified period",
        },
      };
    }

    // Group by iFlow and error type
    const errorsByIFlow: Record<string, {
      iFlowId: string;
      iFlowName: string;
      count: number;
      lastError: string;
      errorTypes: Set<string>;
    }> = {};

    for (const log of failedLogs) {
      const iFlowId = log.IntegrationFlowName;
      const errorType = log.CustomStatus || categorizeError(log);

      if (!errorsByIFlow[iFlowId]) {
        errorsByIFlow[iFlowId] = {
          iFlowId,
          iFlowName: log.IntegrationFlowName,
          count: 0,
          lastError: log.LogStart,
          errorTypes: new Set(),
        };
      }

      errorsByIFlow[iFlowId].count++;
      errorsByIFlow[iFlowId].errorTypes.add(errorType);
      
      if (log.LogStart > errorsByIFlow[iFlowId].lastError) {
        errorsByIFlow[iFlowId].lastError = log.LogStart;
      }
    }

    // Convert to array and sort by count
    const topErrors = Object.values(errorsByIFlow)
      .map(data => ({
        iFlowId: data.iFlowId,
        iFlowName: data.iFlowName,
        errorCount: data.count,
        errorTypes: Array.from(data.errorTypes),
        lastErrorAt: data.lastError,
        percentageOfTotal: Math.round((data.count / failedLogs.length) * 100 * 100) / 100,
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, args.limit);

    return {
      success: true,
      data: {
        period: { from: fromDate, to: toDate },
        totalFailures: failedLogs.length,
        topErrors,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get top errors: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Helper to categorize errors based on common patterns
 */
function categorizeError(log: any): string {
  // This would be enhanced with actual error message analysis
  // For now, use a simple categorization
  
  if (log.ApplicationMessage) {
    if (log.ApplicationMessage.includes("timeout")) return "Timeout Error";
    if (log.ApplicationMessage.includes("connection")) return "Connection Error";
    if (log.ApplicationMessage.includes("authentication")) return "Authentication Error";
    if (log.ApplicationMessage.includes("mapping")) return "Mapping Error";
    if (log.ApplicationMessage.includes("script")) return "Script Error";
  }

  return "Unknown Error";
}
