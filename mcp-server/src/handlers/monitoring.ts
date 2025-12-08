/**
 * SAP CPI MCP Server - Monitoring Tool Handlers
 * 
 * Implements handlers for monitoring tools:
 * - get_message_logs
 * - get_message_details
 * - get_error_info
 * - get_run_steps
 */

import { z } from "zod";
import {
  TenantContext,
  ToolExecutionResult,
  GetMessageLogsInputSchema,
  GetMessageDetailsInputSchema,
  GetErrorInfoInputSchema,
  GetRunStepsInputSchema,
  MessageLogSummary,
  MessageLogDetail,
  ErrorInfo,
  RunStep,
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
  
  getMessageProcessingLogById(messageGuid: string): Promise<any>;
  
  getMessageRunSteps(messageGuid: string): Promise<{ results: any[] }>;
  
  getMessageAttachments(messageGuid: string): Promise<{ results: any[] }>;
  
  getMessageErrorInformation(messageGuid: string): Promise<any>;
  
  getMessageErrorInformationValue(messageGuid: string): Promise<string>;
}

/**
 * Handle get_message_logs tool
 */
export async function handleGetMessageLogs(
  client: SAPCPIClientInterface,
  args: z.infer<typeof GetMessageLogsInputSchema>,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    // Build OData filter
    const filters: string[] = [];
    
    if (args.status) {
      filters.push(`Status eq '${args.status}'`);
    }
    
    if (args.iFlowId) {
      filters.push(`IntegrationFlowName eq '${args.iFlowId}'`);
    }
    
    if (args.searchQuery) {
      filters.push(`(substringof('${args.searchQuery}', MessageGuid) or substringof('${args.searchQuery}', CorrelationId))`);
    }

    const result = await client.getMessageProcessingLogs({
      status: args.status,
      fromDate: args.fromDate,
      toDate: args.toDate,
      top: args.limit,
      filter: filters.length > 0 ? filters.join(" and ") : undefined,
    });

    // Transform to our format
    const logs: MessageLogSummary[] = result.results.map((log: any) => ({
      messageGuid: log.MessageGuid,
      status: log.Status,
      logStart: log.LogStart,
      logEnd: log.LogEnd,
      duration: log.LogEnd && log.LogStart 
        ? new Date(log.LogEnd).getTime() - new Date(log.LogStart).getTime()
        : undefined,
      sender: log.Sender,
      receiver: log.Receiver,
      iFlowId: log.IntegrationFlowName,
      iFlowName: log.IntegrationFlowName,
      correlationId: log.CorrelationId,
      customStatus: log.CustomStatus,
    }));

    return {
      success: true,
      data: {
        logs,
        total: logs.length,
        hasMore: logs.length === args.limit,
        filters: {
          status: args.status,
          iFlowId: args.iFlowId,
          fromDate: args.fromDate,
          toDate: args.toDate,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch message logs: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Handle get_message_details tool
 */
export async function handleGetMessageDetails(
  client: SAPCPIClientInterface,
  args: z.infer<typeof GetMessageDetailsInputSchema>,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    // Fetch main message details
    const message = await client.getMessageProcessingLogById(args.messageGuid);
    
    if (!message) {
      return {
        success: false,
        error: `Message not found: ${args.messageGuid}`,
      };
    }

    const detail: MessageLogDetail = {
      messageGuid: message.MessageGuid,
      status: message.Status,
      logStart: message.LogStart,
      logEnd: message.LogEnd,
      duration: message.LogEnd && message.LogStart
        ? new Date(message.LogEnd).getTime() - new Date(message.LogStart).getTime()
        : undefined,
      sender: message.Sender,
      receiver: message.Receiver,
      iFlowId: message.IntegrationFlowName,
      iFlowName: message.IntegrationFlowName,
      correlationId: message.CorrelationId,
      customStatus: message.CustomStatus,
    };

    // Fetch run steps if requested
    if (args.includeRunSteps) {
      try {
        const stepsResult = await client.getMessageRunSteps(args.messageGuid);
        detail.runSteps = stepsResult.results.map((step: any) => ({
          stepId: step.StepId,
          modelStepId: step.ModelStepId,
          branchId: step.BranchId,
          status: step.StepStatus || step.Status,
          startTime: step.StepStart,
          endTime: step.StepStop,
          duration: step.StepStop && step.StepStart
            ? new Date(step.StepStop).getTime() - new Date(step.StepStart).getTime()
            : undefined,
          error: step.Error,
        }));
      } catch (e) {
        // Run steps might not be available for all messages
      }
    }

    // Fetch attachments if requested
    if (args.includeAttachments) {
      try {
        const attachResult = await client.getMessageAttachments(args.messageGuid);
        detail.attachments = attachResult.results.map((att: any) => ({
          id: att.Id,
          name: att.Name,
          contentType: att.ContentType,
          size: att.PayloadSize,
        }));
      } catch (e) {
        // Attachments might not be available
      }
    }

    // Fetch error info if requested and message failed
    if (args.includeErrorInfo && message.Status === "FAILED") {
      try {
        const errorInfo = await client.getMessageErrorInformation(args.messageGuid);
        if (errorInfo) {
          detail.errorInfo = {
            type: errorInfo.Type || "Unknown",
            message: errorInfo.Message || errorInfo.LastErrorMessage,
            lastErrorAt: errorInfo.LastErrorAt,
          };

          // Get stack trace
          try {
            const stackTrace = await client.getMessageErrorInformationValue(args.messageGuid);
            if (stackTrace && detail.errorInfo) {
              detail.errorInfo.stackTrace = stackTrace;
            }
          } catch (e) {
            // Stack trace might not be available
          }
        }
      } catch (e) {
        // Error info might not be available
      }
    }

    return {
      success: true,
      data: detail,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch message details: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Handle get_error_info tool
 */
export async function handleGetErrorInfo(
  client: SAPCPIClientInterface,
  args: z.infer<typeof GetErrorInfoInputSchema>,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    const errorInfo = await client.getMessageErrorInformation(args.messageGuid);
    
    if (!errorInfo) {
      return {
        success: false,
        error: `No error information found for message: ${args.messageGuid}`,
      };
    }

    const result: ErrorInfo = {
      type: errorInfo.Type || "Unknown",
      message: errorInfo.Message || errorInfo.LastErrorMessage,
      lastErrorAt: errorInfo.LastErrorAt,
    };

    // Get stack trace if requested
    if (args.includeStackTrace) {
      try {
        const stackTrace = await client.getMessageErrorInformationValue(args.messageGuid);
        result.stackTrace = stackTrace;
      } catch (e) {
        // Stack trace might not be available
      }
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch error info: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Handle get_run_steps tool
 */
export async function handleGetRunSteps(
  client: SAPCPIClientInterface,
  args: z.infer<typeof GetRunStepsInputSchema>,
  context: TenantContext
): Promise<ToolExecutionResult> {
  try {
    const stepsResult = await client.getMessageRunSteps(args.messageGuid);
    
    const steps: RunStep[] = stepsResult.results.map((step: any) => ({
      stepId: step.StepId,
      modelStepId: step.ModelStepId,
      branchId: step.BranchId,
      status: step.StepStatus || step.Status,
      startTime: step.StepStart,
      endTime: step.StepStop,
      duration: step.StepStop && step.StepStart
        ? new Date(step.StepStop).getTime() - new Date(step.StepStart).getTime()
        : undefined,
      error: step.Error,
    }));

    // Sort by start time
    steps.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    return {
      success: true,
      data: {
        messageGuid: args.messageGuid,
        steps,
        totalSteps: steps.length,
        hasErrors: steps.some(s => s.error),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch run steps: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
