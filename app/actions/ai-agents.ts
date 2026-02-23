"use server";

import { getCurrentUser } from "./user";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/types/actions";
import { runText } from "@/lib/ai/runtime/text";
import * as prompts from "@/lib/ai/prompts";
import { revalidatePath } from "next/cache";
import type { AIAgentType } from "@/lib/ai/agent-types";

export interface ExecuteAgentParams {
  agentType: AIAgentType;
  prompt: string;
  tenantId?: string;
  iflowId?: string;
  context?: Record<string, any>;
}

export interface AgentExecutionResult {
  executionId: string;
  response: string;
  tokensUsed: number;
  duration: number;
}

/**
 * Get the system prompt for a specific agent type
 */
function getSystemPrompt(agentType: AIAgentType): string {
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
 * Build context for the agent based on tenant and iFlow data
 */
async function buildAgentContext(
  agentType: AIAgentType,
  userId: string,
  tenantId?: string,
  iflowId?: string
): Promise<string> {
  let contextParts: string[] = [];

  // Get tenant information if provided
  if (tenantId) {
    const tenant = await prisma.cpiTenant.findUnique({ where: { id: tenantId } });

    if (tenant) {
      // Get iFlow stats
      const iflowStats = { total: await prisma.iFlow.count({ where: { tenantId } }) };
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const executions = await prisma.iFlowExecution.findMany({
        where: { iFlow: { tenantId }, startTime: { gte: thirtyDaysAgo } },
      });
      const execStats = {
        total: executions.length,
        completed: executions.filter(e => e.status === "COMPLETED").length,
        failed: executions.filter(e => e.status === "FAILED").length,
      };

      contextParts.push(`**Tenant Context:**`);
      contextParts.push(`- Name: ${tenant.name}`);
      contextParts.push(`- URL: ${tenant.tenantUrl}`);
      contextParts.push(`- Status: ${tenant.status}`);
      contextParts.push(`- Total iFlows: ${iflowStats.total}`);
      contextParts.push("");

      if (execStats.total > 0) {
        const successRate = ((execStats.completed / execStats.total) * 100).toFixed(1);
        contextParts.push(`**Integration Statistics:**`);
        contextParts.push(`- Total Executions: ${execStats.total}`);
        contextParts.push(`- Failed Executions: ${execStats.failed}`);
        contextParts.push(`- Success Rate: ${successRate}%`);
        contextParts.push("");
      }
    }
  }

  // Get specific iFlow information if provided
  if (iflowId) {
    // Use helper to handle both DB ID and SAP CPI iFlow ID
    const { getIFlowByAnyId } = await import("./iflows");
    const iflow = await getIFlowByAnyId(iflowId, userId);

    if (iflow) {
      const tenant = await prisma.cpiTenant.findUnique({ where: { id: iflow.tenantId } });
      const executions = await prisma.iFlowExecution.findMany({
        where: { iFlowId: iflow.id },
        take: 50,
        orderBy: { startTime: "desc" },
      });

      contextParts.push(`**iFlow Details:**`);
      contextParts.push(`- Name: ${iflow.name}`);
      contextParts.push(`- ID: ${iflow.iFlowId}`);
      contextParts.push(`- Package: ${iflow.packageName || "N/A"}`);
      contextParts.push(`- Version: ${iflow.version || "N/A"}`);
      contextParts.push(`- Status: ${iflow.status}`);
      contextParts.push(`- Last Deployed: ${iflow.lastDeployedAt ? new Date(iflow.lastDeployedAt).toISOString() : "N/A"}`);
      contextParts.push("");

      if (executions.length > 0) {
        const completedCount = executions.filter((e: any) => e.status === "COMPLETED").length;
        const failedCount = executions.filter((e: any) => e.status === "FAILED").length;
        const avgDuration =
          executions.reduce((sum: number, e: any) => sum + (e.duration || 0), 0) /
          executions.length;

        contextParts.push(`**Recent Execution History:**`);
        contextParts.push(`- Total: ${executions.length} executions`);
        contextParts.push(`- Completed: ${completedCount}`);
        contextParts.push(`- Failed: ${failedCount}`);
        contextParts.push(`- Avg Duration: ${avgDuration.toFixed(0)}ms`);
        contextParts.push("");

        if (
          (agentType === "ERROR_DIAGNOSTICIAN" || agentType === "PERFORMANCE_OPTIMIZER") &&
          failedCount > 0
        ) {
          const recentErrors = executions.filter((e: any) => e.status === "FAILED").slice(0, 5);
          contextParts.push(`**Recent Errors:**`);
          recentErrors.forEach((error: any, idx: number) => {
            contextParts.push(`${idx + 1}. ${error.errorCategory || "UNKNOWN"}: ${error.errorMessage?.substring(0, 200) || "No error message"}`);
          });
          contextParts.push("");
        }
      }
    }
  }

  return contextParts.join("\n");
}

/**
 * Execute an AI agent with the given parameters
 */
export async function executeAgent(
  params: ExecuteAgentParams
): Promise<ActionResult<AgentExecutionResult>> {
  const startTime = Date.now();

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const { agentType, prompt, tenantId, iflowId, context } = params;

    // Validate tenant access if tenantId is provided
    if (tenantId) {
      const membership = await prisma.tenantMember.findUnique({
        where: { userId_tenantId: { userId: currentUser.id, tenantId } },
      });

      if (!membership) {
        return { success: false, error: "You don't have access to this tenant" };
      }
    }

    // Build context for the agent
    const agentContext = await buildAgentContext(agentType, currentUser.id, tenantId, iflowId);

    // Get system prompt
    const systemPrompt = getSystemPrompt(agentType);

    // Combine system prompt, context, and user prompt
    const fullPrompt = `${systemPrompt}

${agentContext ? `---\n\n${agentContext}\n\n---\n\n` : ""}

User Request:
${prompt}`;

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
      // Generate response using AI
      const result = await runText({
        prompt: fullPrompt,
        temperature: 0.7,
        maxTokens: 4000,
      });

      const response = result.text;
      const duration = Date.now() - startTime;

      // Estimate tokens used (rough approximation: 1 token ≈ 4 characters)
      const tokensUsed =
        result.usage.totalTokens ||
        Math.ceil((fullPrompt.length + response.length) / 4);

      // Update execution record
      await prisma.aIAgentExecution.update({
        where: { id: executionId },
        data: {
          status: "COMPLETED",
          output: response,
          tokensUsed,
          duration,
          success: true,
        },
      });

      revalidatePath("/dashboard/ai-agents");

      return {
        success: true,
        data: {
          executionId,
          response: response,
          tokensUsed: tokensUsed,
          duration: duration,
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
    console.error("Error executing agent:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to execute agent",
    };
  }
}

/**
 * Get agent execution history for a user
 */
export async function getAgentHistory(
  agentType?: AIAgentType,
  limit: number = 20
): Promise<ActionResult<any[]>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const executions = await prisma.aIAgentExecution.findMany({
      where: {
        userId: currentUser.id,
        ...(agentType ? { agentType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return { success: true, data: executions };
  } catch (error) {
    console.error("Error fetching agent history:", error);
    return { success: false, error: "Failed to fetch agent history" };
  }
}

/**
 * Get agent usage analytics
 */
export async function getAgentAnalytics(): Promise<
  ActionResult<{
    totalExecutions: number;
    totalTokens: number;
    byAgentType: Record<string, { executions: number; tokens: number }>;
    recentActivity: any[];
  }>
> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const allExecutions = await prisma.aIAgentExecution.findMany({
      where: { userId: currentUser.id },
      orderBy: { createdAt: "desc" },
    });

    const totalExecutions = allExecutions.length;
    const totalTokens = allExecutions.reduce((sum, e) => sum + e.tokensUsed, 0);

    const byAgentType: Record<string, { executions: number; tokens: number }> = {};
    for (const exec of allExecutions) {
      if (!byAgentType[exec.agentType]) {
        byAgentType[exec.agentType] = { executions: 0, tokens: 0 };
      }
      byAgentType[exec.agentType].executions++;
      byAgentType[exec.agentType].tokens += exec.tokensUsed;
    }

    const recentActivity = allExecutions.slice(0, 10);

    return {
      success: true,
      data: {
        totalExecutions,
        totalTokens,
        byAgentType,
        recentActivity,
      },
    };
  } catch (error) {
    console.error("Error fetching agent analytics:", error);
    return { success: false, error: "Failed to fetch agent analytics" };
  }
}

/**
 * Get a specific conversation by execution ID
 */
export async function getConversationById(
  executionId: string
): Promise<ActionResult<{ inputPrompt: string; outputData: string }>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const execution = await prisma.aIAgentExecution.findFirst({
      where: {
        id: executionId,
        userId: currentUser.id,
      },
    });

    if (!execution) {
      return { success: false, error: "Conversation not found" };
    }

    return {
      success: true,
      data: {
        inputPrompt: execution.input || "",
        outputData: execution.output || "",
      }
    };
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return { success: false, error: "Failed to fetch conversation" };
  }
}
