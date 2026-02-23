/**
 * AI Agent with Tool Support
 *
 * Enhanced AI agent execution that supports MCP tool calling.
 * Uses Vercel AI SDK's function calling capabilities.
 */

"use server";

import { getCurrentUser } from "./user";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/types/actions";
import { runText } from "@/lib/ai/runtime/text";
import { runWithTools } from "@/lib/ai/runtime/tools";
import * as prompts from "@/lib/ai/prompts";
import { revalidatePath } from "next/cache";
import type { AIAgentType } from "@/lib/ai/agent-types";
import { createSAPCPIClient, type SAPCPIClient } from "@/lib/sap-cpi/client";
import { z } from "zod";

export interface ExecuteAgentWithToolsParams {
  agentType: AIAgentType;
  prompt: string;
  tenantId: string;
  iflowId?: string;
  context?: Record<string, any>;
  enableTools?: boolean;
  maxToolCalls?: number;
}

export interface AgentToolCallResult {
  executionId: string;
  response: string;
  tokensUsed: number;
  duration: number;
  toolCalls?: Array<{
    toolName: string;
    parameters: Record<string, any>;
    result: any;
    cached?: boolean;
  }>;
}

/**
 * Get system prompt for agent with tool awareness
 */
function getToolAwareSystemPrompt(agentType: AIAgentType): string {
  const basePrompt = getBaseSystemPrompt(agentType);

  const toolInstructions = `

## Available Tools

You have access to SAP CPI monitoring and management tools. Use them when:
- The user asks about message logs, errors, or execution status
- You need to fetch real-time data from SAP CPI
- The user wants to analyze iFlow performance or configuration
- You need specific data to provide accurate recommendations

When using tools:
1. Analyze the user's request to determine what data you need
2. Call the appropriate tool(s) to fetch that data
3. Use the tool results to provide informed, data-driven responses
4. If a tool fails, explain what happened and suggest alternatives

Do NOT use tools for:
- General knowledge questions about SAP CPI
- Explaining concepts or best practices
- Tasks that don't require real-time data

`;

  return basePrompt + toolInstructions;
}

/**
 * Get base system prompt for agent type
 */
function getBaseSystemPrompt(agentType: AIAgentType): string {
  const promptMap: Record<AIAgentType, string> = {
    IFLOW_CREATOR: prompts.IFLOW_CREATOR_PROMPT,
    SMART_MONITOR: prompts.SMART_MONITOR_PROMPT,
    PERFORMANCE_OPTIMIZER: prompts.PERFORMANCE_OPTIMIZER_PROMPT,
    ERROR_DIAGNOSTICIAN: prompts.ERROR_DIAGNOSIS_SYSTEM_PROMPT,
    SECURITY_AUDITOR: prompts.SECURITY_AUDITOR_PROMPT,
    DOCUMENTATION_GENERATOR: prompts.DOCUMENTATION_GENERATOR_PROMPT,
    TEST_CASE_GENERATOR: prompts.TEST_CASE_GENERATOR_PROMPT,
    COST_ANALYZER: prompts.COST_ANALYZER_PROMPT,
    PREDICTIVE_INSIGHTS: prompts.PREDICTIVE_INSIGHTS_PROMPT,
  };

  return promptMap[agentType] || prompts.ERROR_DIAGNOSIS_SYSTEM_PROMPT;
}

/**
 * Build tool-enabled context for the agent
 */
async function buildToolContext(
  agentType: AIAgentType,
  tenantId: string,
  iflowId?: string
): Promise<string> {
  const contextParts: string[] = [];

  // Get tenant information
  const tenant = await prisma.cpiTenant.findUnique({ where: { id: tenantId } });
  if (tenant) {
    contextParts.push(`**Current Tenant:** ${tenant.name}`);
    contextParts.push(`**Status:** ${tenant.status}`);
    contextParts.push("");
  }

  // Get specific iFlow if provided
  if (iflowId) {
    const iflow = await prisma.iFlow.findUnique({ where: { id: iflowId } });
    if (iflow) {
      contextParts.push(`**Selected iFlow:** ${iflow.name} (${iflow.iFlowId})`);
      contextParts.push(`**Status:** ${iflow.status}`);
      contextParts.push("");
    }
  }

  return contextParts.join("\n");
}

/**
 * Create SAP CPI tools for the agent
 */
/**
 * Create agent tools for SAP CPI operations
 * Uses a simplified approach compatible with AI SDK v5
 */
function createAgentTools(sapClient: SAPCPIClient, _userId: string, _tenantId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  // Monitoring Tools
  tools.get_message_logs = {
    description: "Fetch message processing logs from SAP CPI. Use this to see recent executions, check for errors, or analyze processing patterns.",
    parameters: z.object({
      iFlowId: z.string().optional().describe("Filter by specific iFlow ID"),
      status: z.enum(["COMPLETED", "FAILED", "PROCESSING", "RETRY", "ESCALATED"]).optional().describe("Filter by status"),
      limit: z.number().min(1).max(100).default(20).describe("Number of logs to fetch"),
    }),
    execute: async (params: { iFlowId?: string; status?: string; limit?: number }) => {
      try {
        const logs = await sapClient.getMessageProcessingLogs({
          iFlowId: params.iFlowId,
          status: params.status,
          top: params.limit || 20,
        });
        return { success: true, data: logs };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to get message logs" };
      }
    },
  };

  tools.get_message_details = {
    description: "Get detailed information about a specific message execution, including run steps and error details.",
    parameters: z.object({
      messageGuid: z.string().describe("The unique message GUID"),
      includeSteps: z.boolean().default(true).describe("Include run steps"),
    }),
    execute: async (params: { messageGuid: string; includeSteps?: boolean }) => {
      try {
        const details = await sapClient.getMessageProcessingLogById(params.messageGuid);
        let runSteps = null;
        if (params.includeSteps) {
          runSteps = await sapClient.getMessageRunSteps(params.messageGuid);
        }
        return { success: true, data: { ...details, runSteps } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to get message details" };
      }
    },
  };

  tools.get_error_info = {
    description: "Get detailed error information for a failed message execution.",
    parameters: z.object({
      messageGuid: z.string().describe("The message GUID to get error info for"),
    }),
    execute: async (params: { messageGuid: string }) => {
      try {
        const errorInfo = await sapClient.getMessageErrorInformation(params.messageGuid);
        const errorText = await sapClient.getMessageErrorInformationValue(params.messageGuid);
        return { success: true, data: { errorInfo, errorText } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to get error info" };
      }
    },
  };

  // iFlow Tools
  tools.list_iflows = {
    description: "List all deployed integration flows (iFlows) in the tenant.",
    parameters: z.object({
      status: z.enum(["STARTED", "STOPPED", "ERROR"]).optional().describe("Filter by deployment status"),
      searchQuery: z.string().optional().describe("Search by name or ID"),
    }),
    execute: async (params: { status?: string; searchQuery?: string }) => {
      try {
        const iflows = await sapClient.listDeployedIFlows();
        let filtered = iflows;
        if (params.status) {
          filtered = filtered.filter(f => f.Status === params.status);
        }
        if (params.searchQuery) {
          const query = params.searchQuery.toLowerCase();
          filtered = filtered.filter(f =>
            f.Name.toLowerCase().includes(query) ||
            f.Id.toLowerCase().includes(query)
          );
        }
        return { success: true, data: filtered };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to list iFlows" };
      }
    },
  };

  tools.get_iflow_config = {
    description: "Get the configuration details of an iFlow, including adapters, mappings, and scripts.",
    parameters: z.object({
      iFlowId: z.string().describe("The iFlow artifact ID"),
    }),
    execute: async (params: { iFlowId: string }) => {
      try {
        const config = await sapClient.getIFlowConfiguration(params.iFlowId);
        return { success: true, data: config };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to get iFlow config" };
      }
    },
  };

  tools.get_iflow_performance = {
    description: "Get performance metrics for an iFlow over the past few days.",
    parameters: z.object({
      iFlowId: z.string().describe("The iFlow artifact ID"),
      iFlowName: z.string().describe("The iFlow name"),
      daysBack: z.number().min(1).max(30).default(7).describe("Number of days to look back"),
    }),
    execute: async (params: { iFlowId: string; iFlowName: string; daysBack?: number }) => {
      try {
        const metrics = await sapClient.getIFlowPerformanceMetrics(
          params.iFlowId,
          params.iFlowName,
          params.daysBack || 7
        );
        return { success: true, data: metrics };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to get iFlow performance" };
      }
    },
  };

  // Analytics Tools
  tools.get_execution_stats = {
    description: "Get aggregated execution statistics for the tenant.",
    parameters: z.object({
      daysBack: z.number().min(1).max(90).default(30).describe("Number of days to look back"),
      iFlowId: z.string().optional().describe("Filter by specific iFlow"),
    }),
    execute: async (params: { daysBack?: number; iFlowId?: string }) => {
      try {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - (params.daysBack || 30));

        const logs = await sapClient.getAllMessageProcessingLogs({
          fromDate,
          top: 500,
        });

        const stats = {
          total: logs.results.length,
          completed: logs.results.filter((l) => l.Status === "COMPLETED").length,
          failed: logs.results.filter((l) => l.Status === "FAILED").length,
          processing: logs.results.filter((l) => l.Status === "PROCESSING").length,
          successRate: 0,
        };

        if (stats.total > 0) {
          stats.successRate = Math.round((stats.completed / stats.total) * 100);
        }

        return { success: true, data: stats };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to get execution stats" };
      }
    },
  };

  tools.get_top_executed_iflows = {
    description: "Get the most frequently executed iFlows in the tenant. Use this to find which iFlows have the highest execution counts.",
    parameters: z.object({
      daysBack: z.number().min(1).max(90).default(7).describe("Number of days to look back"),
      limit: z.number().min(1).max(50).default(10).describe("Number of top iFlows to return"),
    }),
    execute: async (params: { daysBack?: number; limit?: number }) => {
      try {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - (params.daysBack || 7));

        const logs = await sapClient.getAllMessageProcessingLogs({
          fromDate,
          top: 1000,
        });

        // Aggregate by iFlow name
        const iflowCounts: Record<string, { name: string; total: number; completed: number; failed: number; successRate: number }> = {};

        for (const log of logs.results) {
          const name = log.IntegrationFlowName;
          if (!name) continue;

          if (!iflowCounts[name]) {
            iflowCounts[name] = { name, total: 0, completed: 0, failed: 0, successRate: 0 };
          }
          iflowCounts[name].total++;
          if (log.Status === "COMPLETED") iflowCounts[name].completed++;
          else if (log.Status === "FAILED") iflowCounts[name].failed++;
        }

        // Calculate success rates
        for (const key of Object.keys(iflowCounts)) {
          const stats = iflowCounts[key];
          stats.successRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
        }

        const topIFlows = Object.values(iflowCounts)
          .sort((a, b) => b.total - a.total)
          .slice(0, params.limit || 10);

        return { success: true, data: { topIFlows, totalLogsAnalyzed: logs.results.length } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to get top executed iFlows" };
      }
    },
  };

  tools.get_error_trends = {
    description: "Get error trends and patterns over time.",
    parameters: z.object({
      daysBack: z.number().min(1).max(90).default(7).describe("Number of days to look back"),
      groupBy: z.enum(["day", "hour", "category"]).default("day").describe("How to group the trends"),
    }),
    execute: async (params: { daysBack?: number; groupBy?: string }) => {
      try {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - (params.daysBack || 7));

        const logs = await sapClient.getAllMessageProcessingLogs({
          status: "FAILED",
          fromDate,
          top: 200,
        });

        // Group by day
        const trends: Record<string, number> = {};
        for (const log of logs.results) {
          const date = new Date(log.LogStart).toISOString().split('T')[0];
          trends[date] = (trends[date] || 0) + 1;
        }

        return {
          success: true,
          data: {
            totalErrors: logs.results.length,
            trends: Object.entries(trends).map(([date, count]) => ({ date, count })),
          }
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to get error trends" };
      }
    },
  };

  return tools;
}

/**
 * Execute an AI agent with tool calling support
 */
export async function executeAgentWithTools(
  params: ExecuteAgentWithToolsParams
): Promise<ActionResult<AgentToolCallResult>> {
  const startTime = Date.now();

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const {
      agentType,
      prompt,
      tenantId,
      iflowId,
      enableTools = true,
      maxToolCalls = 5,
    } = params;

    // Validate tenant access
    const membership = await prisma.tenantMember.findUnique({
      where: { userId_tenantId: { userId: currentUser.id, tenantId } },
    });

    if (!membership) {
      return { success: false, error: "You don't have access to this tenant" };
    }

    // Get tenant
    const tenant = await prisma.cpiTenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Build context
    const agentContext = await buildToolContext(agentType, tenantId, iflowId);

    // Get system prompt
    const systemPrompt = enableTools
      ? getToolAwareSystemPrompt(agentType)
      : getBaseSystemPrompt(agentType);

    // Create execution record
    const execution = await prisma.aIAgentExecution.create({
      data: {
        userId: currentUser.id,
        agentType: agentType,
        input: prompt,
        tenantId: tenantId,
        iFlowId: iflowId,
        status: "RUNNING",
      },
    });
    const executionId = execution.id;

    try {
      // Build the full prompt
      const fullPrompt = `${agentContext ? `---\n\n${agentContext}\n\n---\n\n` : ""}User Request:\n${prompt}`;

      let result;
      const toolCalls: Array<{
        toolName: string;
        parameters: Record<string, any>;
        result: any;
        cached?: boolean;
      }> = [];

      if (enableTools) {
        // Create SAP client
        const sapClient = await createSAPClientForTenant(tenant);

        if (!sapClient) {
          // Fall back to non-tool execution
          result = await runText({
            system: systemPrompt,
            prompt: fullPrompt,
            temperature: 0.7,
          });
        } else {
          // Create tools
          const tools = createAgentTools(sapClient as SAPCPIClient, currentUser.id, tenantId);

          // Execute with tools
          result = await runWithTools({
            system: systemPrompt,
            prompt: fullPrompt,
            temperature: 0.7,
            tools,
          });

          // Collect tool call results
          if (result.toolCalls) {
            for (const call of result.toolCalls) {
              toolCalls.push({
                toolName: call.toolName,
                parameters: call.args as Record<string, unknown> || {},
                result: call.result,
                cached: ((call.result as { cached?: boolean } | undefined)?.cached),
              });
            }
          }
        }
      } else {
        // Execute without tools
        result = await runText({
          system: systemPrompt,
          prompt: fullPrompt,
          temperature: 0.7,
        });
      }

      const response = result.text;
      const duration = Date.now() - startTime;

      // Estimate tokens used
      const tokensUsed = result.usage.totalTokens
        ?? Math.ceil((systemPrompt.length + fullPrompt.length + response.length) / 4);

      // Update execution record
      await prisma.aIAgentExecution.update({
        where: { id: executionId },
        data: {
          status: "COMPLETED",
          output: response,
          tokensUsed: tokensUsed as number,
          duration,
          success: true,
        },
      });

      revalidatePath("/dashboard/ai-agents");

      return {
        success: true,
        data: {
          executionId,
          response,
          tokensUsed: tokensUsed as number,
          duration,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        },
      };
    } catch (aiError) {
      // Update execution record with error
      await prisma.aIAgentExecution.update({
        where: { id: executionId },
        data: {
          status: "FAILED",
          errorMessage: aiError instanceof Error ? aiError.message : "AI generation failed",
          duration: Date.now() - startTime,
        },
      });

      throw aiError;
    }
  } catch (error) {
    console.error("Error executing agent with tools:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to execute agent",
    };
  }
}

/**
 * Helper to create SAP CPI client for a tenant
 *
 * Note: The SAP CPI client handles decryption internally in getAccessToken().
 * We pass the raw values from the database (which may be encrypted or plain text).
 * The client will attempt decryption and fall back to using the value as-is if decryption fails.
 */
async function createSAPClientForTenant(tenant: any) {
  try {
    console.log("[createSAPClientForTenant] Creating client for tenant:", {
      name: tenant.name,
      authType: tenant.authType,
      hasClientId: !!tenant.clientId,
      hasClientSecret: !!tenant.clientSecret,
      hasTokenUrl: !!tenant.tokenUrl,
      hasAuthenticationUrl: !!tenant.authenticationUrl,
    });

    const credentials: any = {
      tenantUrl: tenant.tenantUrl,
      authType: tenant.authType,
    };

    if (tenant.authType === "OAUTH") {
      credentials.clientId = tenant.clientId;
      // Pass the clientSecret as-is - the SAP client will handle decryption
      credentials.clientSecret = tenant.clientSecret;
      // Use authenticationUrl if tokenUrl is not available (tokenUrl is deprecated)
      credentials.tokenUrl = tenant.tokenUrl || tenant.authenticationUrl;

      console.log("[createSAPClientForTenant] OAuth credentials prepared:", {
        hasClientId: !!credentials.clientId,
        hasClientSecret: !!credentials.clientSecret,
        clientSecretFormat: credentials.clientSecret?.includes(':') ? 'encrypted (iv:ciphertext)' : 'plain text',
        hasTokenUrl: !!credentials.tokenUrl,
        tokenUrl: credentials.tokenUrl,
      });
    } else if (tenant.authType === "BASIC_AUTH") {
      credentials.username = tenant.username;
      // Pass the password as-is - the SAP client will handle decryption
      credentials.password = tenant.password;
    }

    return createSAPCPIClient(credentials);
  } catch (error) {
    console.error("[createSAPClientForTenant] Error creating SAP client:", error);
    return null;
  }
}

/**
 * Send a chat message with tool support for the General AI Assistant
 */
export async function sendChatMessageWithTools(params: {
  message: string;
  tenantId: string;
  iflowId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  enableTools?: boolean;
}): Promise<ActionResult<{
  response: string;
  messageId: string;
  tokensUsed: number;
  toolCalls?: Array<{
    id: string;
    toolName: string;
    parameters: Record<string, any>;
    status: "completed" | "failed";
    result?: any;
    error?: string;
    duration?: number;
    cached?: boolean;
  }>;
  requiresConfirmation?: {
    toolName: string;
    parameters: Record<string, any>;
    confirmationToken: string;
    message: string;
    expiresAt: number;
  };
}>> {
  const startTime = Date.now();

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const {
      message,
      tenantId,
      iflowId,
      conversationHistory = [],
      enableTools = true,
    } = params;

    // Validate tenant access
    const membership = await prisma.tenantMember.findUnique({
      where: { userId_tenantId: { userId: currentUser.id, tenantId } },
    });

    if (!membership) {
      return { success: false, error: "You don't have access to this tenant" };
    }

    // Get tenant details
    const tenant = await prisma.cpiTenant.findUnique({ where: { id: tenantId } });

    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Build context
    let contextInfo = `\n**Current Tenant:** ${tenant.name} (${tenant.tenantUrl})`;
    if (iflowId) {
      contextInfo += `\n**Selected iFlow:** ${iflowId}`;
    }

    // Build conversation context
    const conversationContext = conversationHistory
      .slice(-10)
      .map(msg => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n");

    // System prompt with tool awareness
    const systemPrompt = `${prompts.GENERAL_ASSISTANT_SYSTEM_PROMPT}

## Available Tools

You have access to SAP CPI tools to fetch real-time data. Choose the RIGHT tool based on what the user is asking:

### Tool Selection Guide:

1. **get_top_executed_iflows** - Use when user asks about:
   - "most frequently executed iFlows"
   - "top executed iFlows"
   - "busiest iFlows"
   - "which iFlows run the most"
   - "iFlow execution rankings"
   - Any question about execution frequency or volume across multiple iFlows

2. **get_message_logs** - Use when user asks about:
   - Recent message executions for a SPECIFIC iFlow
   - Message processing status
   - Failed messages or errors for a specific iFlow
   - Requires iFlowId or iFlowName parameter

3. **list_iflows** - Use when user asks about:
   - List of all deployed iFlows
   - What iFlows exist in the tenant
   - Search for iFlows by name

4. **get_iflow_config** - Use when user asks about:
   - iFlow configuration details
   - Adapters, mappings, scripts in an iFlow
   - Requires specific iFlowId

5. **get_iflow_performance** - Use when user asks about:
   - Performance metrics for a SPECIFIC iFlow (by name)
   - Average duration, success rate for ONE iFlow
   - Requires both iFlowId AND iFlowName

6. **get_execution_stats** - Use when user asks about:
   - Overall tenant execution statistics
   - Total success/failure rates across all iFlows

7. **get_tenant_overview** - Use when user asks about:
   - Tenant summary
   - How many iFlows are deployed
   - Package counts

8. **get_error_info** - Use when user asks about:
   - Detailed error information for a specific failed message
   - Requires messageGuid

CRITICAL:
- For "most frequently executed" or "top iFlows" questions → ALWAYS use get_top_executed_iflows
- Do NOT use get_message_logs for aggregate statistics - it's for individual message details
- After using a tool, analyze the results and provide a clear, helpful response based on the actual data.`;

    const fullPrompt = `${contextInfo}

${conversationContext ? `**Recent Conversation:**\n${conversationContext}\n` : ""}

**User Request:**
${message}`;

    const messageId = `msg-${Date.now()}`;
    const toolCalls: Array<{
      id: string;
      toolName: string;
      parameters: Record<string, any>;
      status: "completed" | "failed";
      result?: any;
      error?: string;
      duration?: number;
      cached?: boolean;
    }> = [];

    let result;

    if (enableTools && tenant) {
      // Create SAP client
      const sapClient = await createSAPClientForTenant(tenant);

      if (sapClient) {
        // Create tools for Vercel AI SDK
        const tools = createChatTools(sapClient as SAPCPIClient, currentUser.id, tenantId);

        result = await runWithTools({
          system: systemPrompt,
          prompt: fullPrompt,
          temperature: 0.7,
          tools,
        });

        // Collect tool call results
        if (result.toolCalls) {
          for (const call of result.toolCalls) {
            const resultData = call.result as {
              success?: boolean;
              data?: unknown;
              error?: string;
              duration?: number;
              cached?: boolean;
            } | undefined;
            toolCalls.push({
              id: call.toolCallId,
              toolName: call.toolName,
              parameters: call.args as Record<string, unknown> || {},
              status: resultData?.success ? "completed" : "failed",
              result: resultData?.data,
              error: resultData?.error,
              duration: resultData?.duration,
              cached: resultData?.cached,
            });
          }
        }
      } else {
        // Fallback to non-tool execution
        result = await runText({
          system: systemPrompt,
          prompt: fullPrompt,
          temperature: 0.7,
        });
      }
    } else {
      // Execute without tools
      result = await runText({
        system: systemPrompt,
        prompt: fullPrompt,
        temperature: 0.7,
      });
    }

    const response = result.text;
    const duration = Date.now() - startTime;

    // Calculate tokens
    const tokensUsed = result.usage.totalTokens
      ?? Math.ceil((message.length + response.length) / 4);

    // Track execution
    try {
      await prisma.aIAgentExecution.create({
        data: {
          userId: currentUser.id,
          agentType: "GENERAL_ASSISTANT",
          tenantId: tenantId || undefined,
          iFlowId: iflowId || undefined,
          input: message,
          output: response,
          tokensUsed: tokensUsed as number,
          duration,
          success: true,
          status: "COMPLETED",
        },
      });
    } catch (trackError) {
      console.error("Failed to track execution:", trackError);
    }

    revalidatePath("/dashboard/ai-agents");

    return {
      success: true,
      data: {
        response,
        messageId,
        tokensUsed: tokensUsed as number,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      },
    };
  } catch (error) {
    console.error("Error in chat with tools:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get response",
    };
  }
}

/**
 * Create chat tools for the general assistant
 */
/**
 * Create chat tools for the general assistant
 * Uses a simplified approach compatible with AI SDK v5
 */
function createChatTools(sapClient: SAPCPIClient, _userId: string, _tenantId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  tools.list_iflows = {
    description: "List all deployed integration flows (iFlows) in the current SAP CPI tenant. Returns iFlow names, IDs, status, and deployment info.",
    parameters: z.object({
      searchQuery: z.string().optional().describe("Optional search term to filter iFlows by name"),
      limit: z.number().min(1).max(100).default(20).describe("Maximum number of iFlows to return"),
    }),
    execute: async (params: { searchQuery?: string; limit?: number }) => {
      const toolStart = Date.now();
      try {
        const iflows = await sapClient.listDeployedIFlows();
        let filtered = iflows;

        if (params.searchQuery) {
          const query = params.searchQuery.toLowerCase();
          filtered = iflows.filter(f =>
            f.Name.toLowerCase().includes(query) ||
            f.Id.toLowerCase().includes(query)
          );
        }

        const limited = filtered.slice(0, params.limit || 20);

        return {
          success: true,
          data: limited.map(f => ({
            id: f.Id,
            name: f.Name,
            version: f.Version,
            status: f.Status,
            deployedBy: f.DeployedBy,
            deployedOn: f.DeployedOn,
          })),
          count: limited.length,
          total: iflows.length,
          duration: Date.now() - toolStart,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to list iFlows",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  tools.get_message_logs = {
    description: "Fetch message processing logs from SAP CPI. Use this to see recent executions, check for errors, or analyze processing status.",
    parameters: z.object({
      iFlowId: z.string().optional().describe("Filter by specific iFlow ID"),
      iFlowName: z.string().optional().describe("Filter by iFlow name"),
      status: z.enum(["COMPLETED", "FAILED", "PROCESSING", "RETRY", "ESCALATED"]).optional().describe("Filter by execution status"),
      limit: z.number().min(1).max(100).default(20).describe("Number of logs to fetch"),
    }),
    execute: async (params: { iFlowId?: string; iFlowName?: string; status?: string; limit?: number }) => {
      const toolStart = Date.now();
      try {
        const logs = await sapClient.getMessageProcessingLogs({
          iFlowId: params.iFlowId,
          iFlowName: params.iFlowName,
          status: params.status,
          top: params.limit || 20,
        });

        return {
          success: true,
          data: logs.map(log => ({
            messageGuid: log.MessageGuid,
            iflowName: log.IntegrationFlowName,
            status: log.Status,
            logStart: log.LogStart,
            logEnd: log.LogEnd,
            sender: log.Sender,
            receiver: log.Receiver,
          })),
          count: logs.length,
          duration: Date.now() - toolStart,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get message logs",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  tools.get_iflow_config = {
    description: "Get detailed configuration of an iFlow including adapters, mappings, scripts, and error handling settings.",
    parameters: z.object({
      iFlowId: z.string().describe("The iFlow artifact ID"),
    }),
    execute: async (params: { iFlowId: string }) => {
      const toolStart = Date.now();
      try {
        const config = await sapClient.getIFlowConfiguration(params.iFlowId);

        if (!config) {
          return {
            success: false,
            error: "iFlow configuration not found",
            duration: Date.now() - toolStart,
          };
        }

        return {
          success: true,
          data: {
            id: config.id,
            name: config.name,
            version: config.version,
            packageId: config.packageId,
            description: config.description,
            adaptersCount: config.adapters?.length || 0,
            adapters: config.adapters?.map(a => ({
              id: a.id,
              type: a.type,
              direction: a.direction,
            })),
            mappingsCount: config.mappings?.length || 0,
            scriptsCount: config.scripts?.length || 0,
            errorHandling: config.errorHandling,
          },
          duration: Date.now() - toolStart,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get iFlow config",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  tools.get_iflow_performance = {
    description: "Get performance metrics for an iFlow over a time period, including execution counts, success rates, and average duration.",
    parameters: z.object({
      iFlowId: z.string().describe("The iFlow artifact ID"),
      iFlowName: z.string().describe("The iFlow name"),
      daysBack: z.number().min(1).max(30).default(7).describe("Number of days to analyze"),
    }),
    execute: async (params: { iFlowId: string; iFlowName: string; daysBack?: number }) => {
      const toolStart = Date.now();
      try {
        const metrics = await sapClient.getIFlowPerformanceMetrics(
          params.iFlowId,
          params.iFlowName,
          params.daysBack || 7
        );

        return {
          success: true,
          data: metrics,
          duration: Date.now() - toolStart,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get performance metrics",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  tools.get_error_info = {
    description: "Get detailed error information for a specific failed message execution.",
    parameters: z.object({
      messageGuid: z.string().describe("The message GUID to get error info for"),
    }),
    execute: async (params: { messageGuid: string }) => {
      const toolStart = Date.now();
      try {
        const errorInfo = await sapClient.getMessageErrorInformation(params.messageGuid);
        const errorText = await sapClient.getMessageErrorText(params.messageGuid);

        return {
          success: true,
          data: {
            errorInfo,
            errorText,
          },
          duration: Date.now() - toolStart,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get error info",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  tools.get_execution_stats = {
    description: "Get aggregated execution statistics for the tenant including total executions, success rate, and trends.",
    parameters: z.object({
      daysBack: z.number().min(1).max(90).default(30).describe("Number of days to analyze"),
    }),
    execute: async (params: { daysBack?: number }) => {
      const toolStart = Date.now();
      try {
        // Get recent logs to calculate stats
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - (params.daysBack || 30));

        const logs = await sapClient.getAllMessageProcessingLogs({
          fromDate,
          top: 500,
        });

        const stats = {
          total: logs.results.length,
          completed: logs.results.filter(l => l.Status === "COMPLETED").length,
          failed: logs.results.filter(l => l.Status === "FAILED").length,
          processing: logs.results.filter(l => l.Status === "PROCESSING").length,
          successRate: 0,
        };

        if (stats.total > 0) {
          stats.successRate = Math.round((stats.completed / stats.total) * 100);
        }

        return {
          success: true,
          data: stats,
          duration: Date.now() - toolStart,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get execution stats",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  tools.get_tenant_overview = {
    description: "Get a summary overview of the SAP CPI tenant including deployed iFlows count and recent activity.",
    parameters: z.object({}),
    execute: async () => {
      const toolStart = Date.now();
      try {
        const [iflows, packages] = await Promise.all([
          sapClient.listDeployedIFlows(),
          sapClient.getIntegrationPackages(),
        ]);

        const statusCounts = iflows.reduce((acc, f) => {
          acc[f.Status] = (acc[f.Status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return {
          success: true,
          data: {
            totalIFlows: iflows.length,
            totalPackages: packages.length,
            statusBreakdown: statusCounts,
            iflowTypes: iflows.reduce((acc, f) => {
              acc[f.Type] = (acc[f.Type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
          },
          duration: Date.now() - toolStart,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get tenant overview",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  tools.get_top_executed_iflows = {
    description: "Get the most frequently executed iFlows in the tenant. Use this to find which iFlows have the highest execution counts over a time period.",
    parameters: z.object({
      daysBack: z.number().min(1).max(90).default(7).describe("Number of days to look back"),
      limit: z.number().min(1).max(50).default(10).describe("Number of top iFlows to return"),
    }),
    execute: async (params: { daysBack?: number; limit?: number }) => {
      const toolStart = Date.now();
      console.log("[get_top_executed_iflows] Starting with params:", params);
      try {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - (params.daysBack || 7));
        console.log("[get_top_executed_iflows] Fetching logs from:", fromDate.toISOString());

        // Fetch message logs to aggregate by iFlow
        const logs = await sapClient.getAllMessageProcessingLogs({
          fromDate,
          top: 1000, // Get a good sample size
        });
        console.log("[get_top_executed_iflows] Fetched logs count:", logs.results.length);

        // Aggregate execution counts by iFlow name
        const iflowCounts: Record<string, {
          name: string;
          total: number;
          completed: number;
          failed: number;
          successRate: number;
        }> = {};

        for (const log of logs.results) {
          const name = log.IntegrationFlowName;
          if (!name) continue;

          if (!iflowCounts[name]) {
            iflowCounts[name] = { name, total: 0, completed: 0, failed: 0, successRate: 0 };
          }
          iflowCounts[name].total++;
          if (log.Status === "COMPLETED") {
            iflowCounts[name].completed++;
          } else if (log.Status === "FAILED") {
            iflowCounts[name].failed++;
          }
        }

        // Calculate success rates
        for (const key of Object.keys(iflowCounts)) {
          const stats = iflowCounts[key];
          stats.successRate = stats.total > 0
            ? Math.round((stats.completed / stats.total) * 100)
            : 0;
        }

        // Sort by total executions and take top N
        const topIFlows = Object.values(iflowCounts)
          .sort((a, b) => b.total - a.total)
          .slice(0, params.limit || 10);

        console.log("[get_top_executed_iflows] Top iFlows found:", topIFlows.length);

        return {
          success: true,
          data: {
            topIFlows,
            totalLogsAnalyzed: logs.results.length,
            periodDays: params.daysBack || 7,
          },
          duration: Date.now() - toolStart,
        };
      } catch (error) {
        console.error("[get_top_executed_iflows] Error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get top executed iFlows",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  return tools;
}
