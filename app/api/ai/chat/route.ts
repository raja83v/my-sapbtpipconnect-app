import { getCurrentUser } from "@/app/actions/user";
import { db } from "@/lib/db";
import {
  cpiTenants,
  tenantMembers,
  aiAgentExecutions,
  aiChatConversations,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createSAPCPIClient, type SAPCPIClient } from "@/lib/sap-cpi/client";
import { getDecryptedCPICredentials } from "@/lib/sap-cpi/credentials";
import { z } from "zod";
import * as prompts from "@/lib/ai/prompts";
import {
  createLLMLiteClient,
  getOpenAIModelForKind,
  getGoogleModelForKind,
  ensureConfig,
  resolveProviderAsync,
  createClaudeClient,
} from "@/lib/ai/runtime/provider";
import { getModelForKind } from "@/lib/ai/runtime/models";
import { generateText } from "ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SSEvent {
  event: string;
  data: unknown;
}

function encodeSSE(e: SSEvent): string {
  return `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`;
}

// ---------------------------------------------------------------------------
// Tool definitions (mirrors createChatTools in ai-agents-tools.ts)
// ---------------------------------------------------------------------------

function createChatTools(sapClient: SAPCPIClient) {
  const tools: Record<
    string,
    {
      description: string;
      parameters: z.ZodTypeAny;
      execute: (params: Record<string, unknown>) => Promise<unknown>;
    }
  > = {};

  tools.list_iflows = {
    description:
      "List all deployed integration flows (iFlows) in the current SAP CPI tenant.",
    parameters: z.object({
      searchQuery: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
    }),
    execute: async (params) => {
      const toolStart = Date.now();
      try {
        const iflows = await sapClient.listDeployedIFlows();
        let filtered = iflows;
        if (params.searchQuery) {
          const q = (params.searchQuery as string).toLowerCase();
          filtered = iflows.filter(
            (f) =>
              f.Name.toLowerCase().includes(q) ||
              f.Id.toLowerCase().includes(q),
          );
        }
        const limited = filtered.slice(0, (params.limit as number) || 20);
        return {
          success: true,
          data: limited.map((f) => ({
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
          error: error instanceof Error ? error.message : "Failed",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  tools.get_message_logs = {
    description: "Fetch message processing logs from SAP CPI.",
    parameters: z.object({
      iFlowId: z.string().optional(),
      iFlowName: z.string().optional(),
      status: z
        .enum(["COMPLETED", "FAILED", "PROCESSING", "RETRY", "ESCALATED"])
        .optional(),
      limit: z.number().min(1).max(100).default(20),
    }),
    execute: async (params) => {
      const toolStart = Date.now();
      try {
        const logs = await sapClient.getMessageProcessingLogs({
          iFlowId: params.iFlowId as string | undefined,
          iFlowName: params.iFlowName as string | undefined,
          status: params.status as string | undefined,
          top: (params.limit as number) || 20,
        });
        return {
          success: true,
          data: logs.map((log) => ({
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
          error: error instanceof Error ? error.message : "Failed",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  tools.get_iflow_config = {
    description:
      "Get detailed configuration of an iFlow including adapters, mappings, scripts.",
    parameters: z.object({ iFlowId: z.string() }),
    execute: async (params) => {
      const toolStart = Date.now();
      try {
        const config = await sapClient.getIFlowConfiguration(
          params.iFlowId as string,
        );
        if (!config)
          return {
            success: false,
            error: "Not found",
            duration: Date.now() - toolStart,
          };
        return {
          success: true,
          data: {
            id: config.id,
            name: config.name,
            version: config.version,
            packageId: config.packageId,
            adaptersCount: config.adapters?.length || 0,
            mappingsCount: config.mappings?.length || 0,
            scriptsCount: config.scripts?.length || 0,
          },
          duration: Date.now() - toolStart,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  tools.get_iflow_performance = {
    description: "Get performance metrics for an iFlow.",
    parameters: z.object({
      iFlowId: z.string(),
      iFlowName: z.string(),
      daysBack: z.number().min(1).max(30).default(7),
    }),
    execute: async (params) => {
      const toolStart = Date.now();
      try {
        const metrics = await sapClient.getIFlowPerformanceMetrics(
          params.iFlowId as string,
          params.iFlowName as string,
          (params.daysBack as number) || 7,
        );
        return {
          success: true,
          data: metrics,
          duration: Date.now() - toolStart,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  tools.get_error_info = {
    description:
      "Get detailed error information for a specific failed message.",
    parameters: z.object({ messageGuid: z.string() }),
    execute: async (params) => {
      const toolStart = Date.now();
      try {
        const errorInfo = await sapClient.getMessageErrorInformation(
          params.messageGuid as string,
        );
        const errorText = await sapClient.getMessageErrorText(
          params.messageGuid as string,
        );
        return {
          success: true,
          data: { errorInfo, errorText },
          duration: Date.now() - toolStart,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  tools.get_execution_stats = {
    description: "Get aggregated execution statistics for the tenant.",
    parameters: z.object({ daysBack: z.number().min(1).max(90).default(30) }),
    execute: async (params) => {
      const toolStart = Date.now();
      try {
        const fromDate = new Date();
        fromDate.setDate(
          fromDate.getDate() - ((params.daysBack as number) || 30),
        );
        const logs = await sapClient.getAllMessageProcessingLogs({
          fromDate,
          top: 500,
        });
        const stats = {
          total: logs.results.length,
          completed: logs.results.filter((l) => l.Status === "COMPLETED")
            .length,
          failed: logs.results.filter((l) => l.Status === "FAILED").length,
          processing: logs.results.filter((l) => l.Status === "PROCESSING")
            .length,
          successRate: 0,
        };
        if (stats.total > 0)
          stats.successRate = Math.round((stats.completed / stats.total) * 100);
        return { success: true, data: stats, duration: Date.now() - toolStart };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  tools.get_tenant_overview = {
    description: "Get a summary overview of the SAP CPI tenant.",
    parameters: z.object({}),
    execute: async () => {
      const toolStart = Date.now();
      try {
        const [iflows, packages] = await Promise.all([
          sapClient.listDeployedIFlows(),
          sapClient.getIntegrationPackages(),
        ]);
        const statusCounts = iflows.reduce(
          (acc, f) => {
            acc[f.Status] = (acc[f.Status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );
        return {
          success: true,
          data: {
            totalIFlows: iflows.length,
            totalPackages: packages.length,
            statusBreakdown: statusCounts,
          },
          duration: Date.now() - toolStart,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  tools.get_top_executed_iflows = {
    description: "Get the most frequently executed iFlows in the tenant.",
    parameters: z.object({
      daysBack: z.number().min(1).max(90).default(7),
      limit: z.number().min(1).max(50).default(10),
    }),
    execute: async (params) => {
      const toolStart = Date.now();
      try {
        const fromDate = new Date();
        fromDate.setDate(
          fromDate.getDate() - ((params.daysBack as number) || 7),
        );
        const logs = await sapClient.getAllMessageProcessingLogs({
          fromDate,
          top: 1000,
        });
        const iflowCounts: Record<
          string,
          {
            name: string;
            total: number;
            completed: number;
            failed: number;
            successRate: number;
          }
        > = {};
        for (const log of logs.results) {
          const name = log.IntegrationFlowName;
          if (!name) continue;
          if (!iflowCounts[name])
            iflowCounts[name] = {
              name,
              total: 0,
              completed: 0,
              failed: 0,
              successRate: 0,
            };
          iflowCounts[name].total++;
          if (log.Status === "COMPLETED") iflowCounts[name].completed++;
          else if (log.Status === "FAILED") iflowCounts[name].failed++;
        }
        for (const key of Object.keys(iflowCounts)) {
          const s = iflowCounts[key];
          s.successRate =
            s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
        }
        const topIFlows = Object.values(iflowCounts)
          .sort((a, b) => b.total - a.total)
          .slice(0, (params.limit as number) || 10);
        return {
          success: true,
          data: {
            topIFlows,
            totalLogsAnalyzed: logs.results.length,
            periodDays: (params.daysBack as number) || 7,
          },
          duration: Date.now() - toolStart,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed",
          duration: Date.now() - toolStart,
        };
      }
    },
  };

  return tools;
}

// ---------------------------------------------------------------------------
// SAP CPI client for tenant
// ---------------------------------------------------------------------------

async function createSAPClient(
  tenant: Parameters<typeof getDecryptedCPICredentials>[0],
) {
  try {
    const credentials = await getDecryptedCPICredentials(tenant);
    return createSAPCPIClient(
      credentials as Parameters<typeof createSAPCPIClient>[0],
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OpenAI-compatible tool loop with streaming
// ---------------------------------------------------------------------------

function toJsonSchema(schema: unknown) {
  if (!schema) return { type: "object", properties: {} };
  if (
    typeof schema === "object" &&
    "_def" in (schema as Record<string, unknown>)
  ) {
    return z.toJSONSchema(schema as z.ZodTypeAny);
  }
  return schema as Record<string, unknown>;
}

async function runToolLoopStreaming(
  systemPrompt: string,
  userPrompt: string,
  tools: ReturnType<typeof createChatTools>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
) {
  await ensureConfig();
  const provider = await resolveProviderAsync();
  const modelKind = "default";

  // For non-OpenAI providers, fall back to non-streaming tool call
  if (provider === "google" || provider === "gemini" || provider === "claude") {
    let aiModel: any;
    if (provider === "claude") {
      const anthropic = await createClaudeClient();
      aiModel = anthropic(getModelForKind(modelKind));
    } else {
      aiModel = getGoogleModelForKind(modelKind);
    }

    const result = await generateText({
      model: aiModel,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
      tools: tools as any,
    });

    // Emit tool calls
    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            const toolResult = step.toolResults?.find(
              (r: { toolCallId: string }) => r.toolCallId === tc.toolCallId,
            );
            writer.write(
              encoder.encode(
                encodeSSE({
                  event: "tool_call",
                  data: {
                    id: tc.toolCallId,
                    toolName: tc.toolName,
                    parameters: (tc as any).args || {},
                    status: "completed",
                    result: (toolResult as any)?.result,
                  },
                }),
              ),
            );
          }
        }
      }
    }

    // Stream text in chunks
    const text = result.text;
    const chunkSize = 20;
    for (let i = 0; i < text.length; i += chunkSize) {
      writer.write(
        encoder.encode(
          encodeSSE({ event: "text", data: text.slice(i, i + chunkSize) }),
        ),
      );
    }

    return {
      text: result.text,
      toolCalls:
        result.steps?.flatMap(
          (s) =>
            s.toolCalls?.map((tc) => ({
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: (tc as any).args || {},
            })) || [],
        ) || [],
      usage: result.usage,
    };
  }

  // OpenAI / LiteLLM path — true streaming with tool loop
  const client = createLLMLiteClient();
  const model = getOpenAIModelForKind(modelKind);
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const openAITools = Object.entries(tools).map(([name, tool]) => ({
    type: "function" as const,
    function: {
      name,
      description: tool.description,
      parameters: toJsonSchema(tool.parameters),
    },
  }));

  const maxRounds = 5;
  const executedToolCalls: Array<{
    id: string;
    toolName: string;
    parameters: Record<string, unknown>;
    status: string;
    result?: unknown;
    error?: string;
    duration?: number;
  }> = [];
  let finalText = "";
  let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  for (let i = 0; i < maxRounds; i++) {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.7,
      messages: messages as any,
      tools: openAITools as any,
      tool_choice: "auto",
    });

    const choice = completion.choices?.[0];
    const message = choice?.message;
    const rawUsage = completion.usage as unknown as Record<
      string,
      number
    > | null;
    usage = {
      inputTokens: rawUsage?.prompt_tokens || 0,
      outputTokens: rawUsage?.completion_tokens || 0,
      totalTokens: rawUsage?.total_tokens || 0,
    };

    const toolCalls = message?.tool_calls || [];

    if (toolCalls.length === 0) {
      // No more tool calls — stream the final text
      // If we still have a non-streamed response, stream it now. Otherwise do a streaming call.
      if (message?.content) {
        finalText = message.content;
        // Stream in small chunks for visual effect
        const chunkSize = 20;
        for (let j = 0; j < finalText.length; j += chunkSize) {
          writer.write(
            encoder.encode(
              encodeSSE({
                event: "text",
                data: finalText.slice(j, j + chunkSize),
              }),
            ),
          );
        }
      }
      break;
    }

    // Process tool calls
    messages.push({
      role: "assistant",
      content: message?.content || "",
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const fnCall = (toolCall as any).function as
        | { name?: string; arguments?: string }
        | undefined;
      const toolName = fnCall?.name || "";
      const tool = tools[toolName];

      // Emit tool_start event
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(fnCall?.arguments || "{}");
      } catch {
        args = {};
      }

      writer.write(
        encoder.encode(
          encodeSSE({
            event: "tool_start",
            data: { id: toolCall.id, toolName, parameters: args },
          }),
        ),
      );

      if (!tool) {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: "Unknown tool" }),
        });
        writer.write(
          encoder.encode(
            encodeSSE({
              event: "tool_call",
              data: {
                id: toolCall.id,
                toolName,
                parameters: args,
                status: "failed",
                error: "Unknown tool",
              },
            }),
          ),
        );
        continue;
      }

      const toolStart = Date.now();
      const toolResult = await tool.execute(args);
      const duration = Date.now() - toolStart;

      executedToolCalls.push({
        id: toolCall.id,
        toolName,
        parameters: args,
        status: (toolResult as any)?.success ? "completed" : "failed",
        result: (toolResult as any)?.data,
        error: (toolResult as any)?.error,
        duration,
      });

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });

      writer.write(
        encoder.encode(
          encodeSSE({
            event: "tool_call",
            data: {
              id: toolCall.id,
              toolName,
              parameters: args,
              status: (toolResult as any)?.success ? "completed" : "failed",
              result: (toolResult as any)?.data,
              error: (toolResult as any)?.error,
              duration,
            },
          }),
        ),
      );
    }

    // After processing tool calls and the LLM is about to generate final text
    // in the next loop iteration, we stream if it's the final round.
    if (i === maxRounds - 1) {
      // Last round — just use whatever text the LLM returns
      finalText = message?.content || "";
    }
  }

  // Try streaming the final answer if we haven't done so yet and there's no text
  if (!finalText && messages.length > 2) {
    try {
      const stream = await client.chat.completions.create({
        model,
        temperature: 0.7,
        messages: messages as any,
        stream: true,
      });

      for await (const part of stream) {
        const delta = part.choices?.[0]?.delta?.content;
        if (delta) {
          finalText += delta;
          writer.write(
            encoder.encode(encodeSSE({ event: "text", data: delta })),
          );
        }
      }
    } catch {
      // Fallback
    }
  }

  return { text: finalText, toolCalls: executedToolCalls, usage };
}

// ---------------------------------------------------------------------------
// POST /api/ai/chat — streaming SSE endpoint
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const {
      message,
      tenantId,
      iflowId,
      conversationId,
      conversationHistory = [],
    } = body;

    if (!message || !tenantId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate tenant access
    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, currentUser.id),
        eq(tenantMembers.tenantId, tenantId),
      ),
    });
    if (!membership) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, tenantId),
    });
    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build prompts
    let contextInfo = `\n**Current Tenant:** ${tenant.name} (${tenant.tenantUrl})`;
    if (iflowId) contextInfo += `\n**Selected iFlow:** ${iflowId}`;

    const conversationContext = (
      conversationHistory as Array<{ role: string; content: string }>
    )
      .slice(-10)
      .map(
        (msg) =>
          `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`,
      )
      .join("\n");

    const systemPrompt = `${prompts.GENERAL_ASSISTANT_SYSTEM_PROMPT}

## Response Formatting Rules

When presenting data in your response:
- Use well-formatted markdown tables for any list of items (iFlows, messages, errors, metrics)
- Include status emoji indicators: ✅ for success/completed, ❌ for failed, ⏳ for processing, ⚠️ for warnings
- Use bold headers and clear column alignment
- Add a summary line after tables (e.g., "Showing 10 of 42 total iFlows")
- For numbers, use locale formatting where appropriate
- Use ### headers to organize sections
- Keep responses concise but informative

## Available Tools

You have access to SAP CPI tools to fetch real-time data. Choose the RIGHT tool based on what the user is asking:

### Tool Selection Guide:

1. **get_top_executed_iflows** - Use for "most frequently executed", "top iFlows", "busiest iFlows"
2. **get_message_logs** - Use for recent message executions for a SPECIFIC iFlow
3. **list_iflows** - Use for listing all deployed iFlows
4. **get_iflow_config** - Use for iFlow configuration details
5. **get_iflow_performance** - Use for performance metrics of a SPECIFIC iFlow
6. **get_execution_stats** - Use for overall tenant execution statistics
7. **get_tenant_overview** - Use for tenant summary
8. **get_error_info** - Use for detailed error information for a specific failed message

CRITICAL:
- For "most frequently executed" or "top iFlows" questions → ALWAYS use get_top_executed_iflows
- Do NOT use get_message_logs for aggregate statistics
- After using a tool, analyze the results and provide a clear, helpful response with markdown tables.`;

    const fullPrompt = `${contextInfo}\n\n${conversationContext ? `**Recent Conversation:**\n${conversationContext}\n\n` : ""}**User Request:**\n${message}`;

    // Create SAP client and tools (uses centralized decryption)
    const sapClient = await createSAPClient(tenant);
    const tools = sapClient ? createChatTools(sapClient as SAPCPIClient) : {};

    // Start SSE stream
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream<
      Uint8Array,
      Uint8Array
    >();
    const writer = writable.getWriter();

    // Abort controller tied to the request signal so the background task
    // stops when the client disconnects.
    const abortController = new AbortController();
    if (request.signal) {
      request.signal.addEventListener("abort", () => abortController.abort(), {
        once: true,
      });
    }

    const startTime = Date.now();

    // Run the tool loop in the background
    (async () => {
      try {
        // Bail early if the client already disconnected
        if (abortController.signal.aborted) return;

        const result = await runToolLoopStreaming(
          systemPrompt,
          fullPrompt,
          tools,
          writer,
          encoder,
        );

        // Bail if aborted while streaming
        if (abortController.signal.aborted) return;

        // Emit done event
        writer.write(
          encoder.encode(
            encodeSSE({
              event: "done",
              data: {
                toolCalls: result.toolCalls,
                tokensUsed:
                  result.usage.totalTokens ||
                  Math.ceil((message.length + result.text.length) / 4),
              },
            }),
          ),
        );

        // Track in DB (skip if aborted)
        if (!abortController.signal.aborted) {
          const duration = Date.now() - startTime;
          try {
            await db.insert(aiAgentExecutions).values({
              userId: currentUser.id,
              agentType: "GENERAL_ASSISTANT",
              tenantId,
              iFlowId: iflowId || undefined,
              conversationId: conversationId || undefined,
              input: message,
              output: result.text.slice(0, 10000),
              tokensUsed:
                result.usage.totalTokens ||
                Math.ceil((message.length + result.text.length) / 4),
              duration,
              success: true,
              status: "COMPLETED",
              updatedAt: new Date(),
            });

            // Update conversation's updatedAt for sidebar ordering
            if (conversationId) {
              await db
                .update(aiChatConversations)
                .set({ updatedAt: new Date() })
                .where(eq(aiChatConversations.id, conversationId));
            }
          } catch (dbError) {
            console.error("[ai/chat] Failed to save execution to DB:", dbError);
          }
        }
      } catch (error) {
        // Suppress abort errors — the client disconnected intentionally
        if (abortController.signal.aborted) return;
        writer.write(
          encoder.encode(
            encodeSSE({
              event: "error",
              data: {
                message:
                  error instanceof Error
                    ? error.message
                    : "Failed to get response",
              },
            }),
          ),
        );
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
