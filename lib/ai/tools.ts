/**
 * SAP CPI AI Tools
 *
 * Defines Vercel AI SDK tools that wrap MCP tool execution.
 * These tools can be used with streamText to enable function calling.
 */

import { tool } from "ai";
import { z } from "zod";
import {
  getToolsForAI,
  requiresConfirmation,
} from "@/mcp-server/src";

/**
 * Create Vercel AI SDK tools from MCP tool registry
 * Note: This function creates tool definitions that return pending status.
 * Actual execution happens via the API route.
 */
export function createSAPCPITools(tenantId: string, userId: string) {
  const mcpTools = getToolsForAI();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  for (const mcpTool of mcpTools) {
    // Create a tool with the proper schema
    // Note: This creates tool definitions that return pending status.
    // Actual execution happens via the API route.
    tools[mcpTool.name] = {
      description: mcpTool.description,
      parameters: mcpTool.parameters,
    };
  }

  return tools;
}

/**
 * Convert MCP tool JSON schema to Zod schema
 * This is a simplified converter for common schema patterns
 */
function mcpToolSchemaToZod(schema: any): z.ZodType<any> {
  if (!schema || !schema.properties) {
    return z.object({});
  }

  const shape: Record<string, z.ZodType<any>> = {};
  const required = schema.required || [];

  for (const [key, prop] of Object.entries(schema.properties) as [string, any][]) {
    let zodType = jsonSchemaTypeToZod(prop);

    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return z.object(shape);
}

/**
 * Convert JSON Schema type to Zod type
 */
function jsonSchemaTypeToZod(prop: any): z.ZodType<any> {
  if (prop.enum) {
    return z.enum(prop.enum as [string, ...string[]]);
  }

  switch (prop.type) {
    case "string":
      let stringSchema = z.string();
      if (prop.description) {
        stringSchema = stringSchema.describe(prop.description);
      }
      return stringSchema;

    case "number":
    case "integer":
      let numSchema = z.number();
      if (prop.minimum !== undefined) {
        numSchema = numSchema.min(prop.minimum);
      }
      if (prop.maximum !== undefined) {
        numSchema = numSchema.max(prop.maximum);
      }
      if (prop.description) {
        numSchema = numSchema.describe(prop.description);
      }
      return numSchema;

    case "boolean":
      return z.boolean();

    case "array":
      const itemSchema = prop.items
        ? jsonSchemaTypeToZod(prop.items)
        : z.any();
      return z.array(itemSchema);

    case "object":
      if (prop.properties) {
        return mcpToolSchemaToZod(prop);
      }
      return z.record(z.string(), z.any());

    default:
      return z.any();
  }
}


/**
 * Pre-defined tool schemas for common SAP CPI operations
 * These can be used directly without the MCP layer for simpler integrations
 */
export const sapCPIToolSchemas = {
  // Monitoring Tools
  getMessageLogs: z.object({
    iFlowId: z.string().optional().describe("Filter by specific iFlow ID"),
    status: z.enum(["COMPLETED", "FAILED", "PROCESSING", "RETRY", "ESCALATED"]).optional(),
    fromDate: z.string().optional().describe("Start date in ISO format"),
    toDate: z.string().optional().describe("End date in ISO format"),
    limit: z.number().min(1).max(500).default(50).optional(),
  }),

  getMessageDetails: z.object({
    messageGuid: z.string().describe("The unique message GUID"),
    includeSteps: z.boolean().default(true).optional(),
    includeAttachments: z.boolean().default(false).optional(),
  }),

  getErrorInfo: z.object({
    messageGuid: z.string().describe("The message GUID to get error info for"),
  }),

  // iFlow Tools
  listIFlows: z.object({
    status: z.enum(["STARTED", "STOPPED", "ERROR"]).optional(),
    searchQuery: z.string().optional().describe("Search by name or ID"),
    limit: z.number().min(1).max(200).default(50).optional(),
  }),

  getIFlowConfig: z.object({
    iFlowId: z.string().describe("The iFlow artifact ID"),
    version: z.string().default("active").optional(),
  }),

  getIFlowPerformance: z.object({
    iFlowId: z.string().describe("The iFlow artifact ID"),
    iFlowName: z.string().describe("The iFlow name"),
    daysBack: z.number().min(1).max(30).default(7).optional(),
  }),

  // Action Tools
  deployIFlow: z.object({
    iFlowId: z.string().describe("The iFlow artifact ID to deploy"),
  }),

  // Analytics Tools
  getExecutionStats: z.object({
    daysBack: z.number().min(1).max(90).default(30).optional(),
    iFlowId: z.string().optional().describe("Filter by specific iFlow"),
  }),

  getErrorTrends: z.object({
    daysBack: z.number().min(1).max(90).default(7).optional(),
    groupBy: z.enum(["day", "hour", "category"]).default("day").optional(),
  }),
};

/**
 * Tool execution result type
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  cached?: boolean;
  duration?: number;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
}

/**
 * Execute a tool via the API
 */
export async function executeToolViaAPI(
  toolName: string,
  parameters: Record<string, any>,
  tenantId: string,
  confirmationToken?: string
): Promise<ToolExecutionResult> {
  try {
    const response = await fetch("/api/mcp/tools", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        toolName,
        parameters,
        tenantId,
        confirmationToken,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || "Tool execution failed",
      };
    }

    if (result.requiresConfirmation) {
      return {
        success: true,
        requiresConfirmation: true,
        confirmationToken: result.confirmationToken,
        data: { message: result.message, expiresAt: result.expiresAt },
      };
    }

    return {
      success: true,
      data: result.data,
      cached: result.cached,
      duration: result.duration,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to execute tool",
    };
  }
}
