"use server";

import { getCurrentUser } from "./user";
import { checkSubscriptionLimit, incrementUsage } from "./billing";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { ActionResult } from "@/types/actions";
import { streamText } from "ai";
import { aiModel } from "@/lib/ai/client";
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
  tenantId?: string,
  iflowId?: string
): Promise<string> {
  let contextParts: string[] = [];

  // Get tenant information if provided
  if (tenantId) {
    const tenant = await convex.query(api.tenants.getById, { id: tenantId as any });

    if (tenant) {
      // Get iFlow stats
      const iflowStats = await convex.query(api.iflows.getStatsByTenant, {
        tenantId: tenantId as any
      });
      const execStats = await convex.query(api.iflows.getExecutionStatsByTenant, {
        tenantId: tenantId as any,
        daysBack: 30,
      });

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
    const iflow = await convex.query(api.iflows.getById, { id: iflowId as any });

    if (iflow) {
      const tenant = await convex.query(api.tenants.getById, { id: iflow.tenantId });
      const executions = await convex.query(api.iflows.getExecutions, {
        iFlowId: iflowId as any,
        limit: 50,
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

    // Check subscription limit for AI agent calls
    const limitCheck = await checkSubscriptionLimit("aiAgentCalls");
    if (!limitCheck.success) {
      return { success: false, error: limitCheck.error };
    }

    if (!limitCheck.data?.allowed) {
      const { current, max } = limitCheck.data || { current: 0, max: 0 };
      return {
        success: false,
        error: `Monthly AI agent call limit reached (${current}/${max}). Please upgrade your plan to continue using AI agents.`,
      };
    }

    // Validate tenant access if tenantId is provided
    if (tenantId) {
      const membership = await convex.query(api.tenants.getMembership, {
        tenantId: tenantId as any,
        userId: currentUser.id as any,
      });

      if (!membership) {
        return { success: false, error: "You don't have access to this tenant" };
      }
    }

    // Build context for the agent
    const agentContext = await buildAgentContext(agentType, tenantId, iflowId);

    // Get system prompt
    const systemPrompt = getSystemPrompt(agentType);

    // Combine system prompt, context, and user prompt
    const fullPrompt = `${systemPrompt}

${agentContext ? `---\n\n${agentContext}\n\n---\n\n` : ""}

User Request:
${prompt}`;

    // Create execution record
    const executionId = await convex.mutation(api.aiAgentMutations.create, {
      userId: currentUser.id as any,
      agentType: agentType,
      inputPrompt: prompt,
      tenantId: tenantId as any,
      iFlowId: iflowId as any,
      status: "RUNNING",
    });

    try {
      // Generate response using AI
      const result = await streamText({
        model: aiModel,
        prompt: fullPrompt,
        temperature: 0.7,
        maxTokens: 4000,
      });

      const response = await result.text;
      const duration = Date.now() - startTime;

      // Estimate tokens used (rough approximation: 1 token ≈ 4 characters)
      const tokensUsed = Math.ceil((fullPrompt.length + response.length) / 4);

      // Update execution record
      await convex.mutation(api.aiAgentMutations.complete, {
        executionId,
        response,
        tokensUsed,
        duration,
      });

      // Increment AI agent usage count after successful execution
      await incrementUsage("aiAgentCalls");

      revalidatePath("/dashboard/ai-agents");
      revalidatePath("/dashboard/settings/billing");

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
      await convex.mutation(api.aiAgentMutations.fail, {
        executionId,
        errorMessage: aiError instanceof Error ? aiError.message : "AI generation failed",
        duration: Date.now() - startTime,
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

    const executions = await convex.query(api.aiAgents.listByUser, {
      userId: currentUser.id as any,
      agentType,
      limit,
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

    const stats = await convex.query(api.aiAgents.getStats, {
      userId: currentUser.id as any,
    });

    return {
      success: true,
      data: stats,
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

    const execution = await convex.query(api.aiAgents.getById, {
      executionId: executionId as any,
      userId: currentUser.id as any,
    });

    if (!execution) {
      return { success: false, error: "Conversation not found" };
    }

    return {
      success: true,
      data: {
        inputPrompt: execution.inputPrompt,
        outputData: execution.outputData || "",
      }
    };
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return { success: false, error: "Failed to fetch conversation" };
  }
}
