"use server";

import { getCurrentUser } from "./user";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/types/actions";
import { runText } from "@/lib/ai/runtime/text";
import * as prompts from "@/lib/ai/prompts";
import { revalidatePath } from "next/cache";
import type { AIAgentTypeV2 } from "@/lib/ai/agent-types-v2";
import { createSAPCPIClient, type SAPCPICredentials } from "@/lib/sap-cpi/client";

/**
 * Diagnose an error with AI-powered analysis
 */
export async function diagnoseError(params: {
    executionId: string;
    tenantId: string;
    iflowId: string;
}): Promise<ActionResult<any>> {
    const startTime = Date.now();

    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const { executionId, tenantId, iflowId } = params;

        // Validate tenant access
        const membership = await prisma.tenantMember.findUnique({
            where: { userId_tenantId: { userId: currentUser.id, tenantId } },
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Build context for error diagnosis
        // TODO: Fetch actual execution details from database
        const errorContext = `
**Error Details:**
- Execution ID: ${executionId}
- iFlow: ${iflowId}
- Tenant: ${tenantId}

**Error Message:**
Connection timeout: Database connection pool exhausted

**Recent Pattern:**
- 15 occurrences in the last 2 hours
- Average duration before timeout: 8.2 seconds
- Concurrent requests: 45/second
- Connection pool size: 10 (max)

**Environment:**
- Database: PostgreSQL 14
- Connection pooling: Enabled
- Max connections: 10
- Idle timeout: 30s
`;

        // Generate AI diagnosis
        const result = await runText({
            prompt: `${prompts.ERROR_DIAGNOSIS_SYSTEM_PROMPT}

${errorContext}

Provide a comprehensive diagnosis in the following JSON format:
{
  "rootCause": "Brief summary of the root cause",
  "detailedAnalysis": "Detailed technical explanation",
  "solutions": [
    {
      "id": "sol-1",
      "title": "Solution title",
      "description": "Brief description",
      "effort": "low|medium|high",
      "impact": "low|medium|high",
      "priority": 100,
      "steps": ["Step 1", "Step 2"],
      "codeExample": "Optional code example"
    }
  ],
  "relatedIssues": [
    {
      "id": "issue-1",
      "title": "Related issue title",
      "type": "similar_error|team_discussion|documentation",
      "url": "Optional URL"
    }
  ],
  "confidence": 0.87
}`,
            temperature: 0.3,
        });

        const response = result.text;
        const duration = Date.now() - startTime;

        // Parse the JSON response
        let diagnosis;
        try {
            // Extract JSON from markdown code blocks if present
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/```\n([\s\S]*?)\n```/);
            const jsonStr = jsonMatch ? jsonMatch[1] : response;
            diagnosis = JSON.parse(jsonStr);
        } catch (parseError) {
            // If parsing fails, create a structured response from the text
            diagnosis = {
                rootCause: "Database connection pool exhausted",
                detailedAnalysis: response,
                solutions: [
                    {
                        id: "sol-1",
                        title: "Increase connection pool size",
                        description: "Expand the database connection pool to handle higher concurrent load",
                        effort: "low",
                        impact: "high",
                        priority: 100,
                        steps: [
                            "Update database configuration to increase max_connections",
                            "Adjust connection pool size in application settings",
                            "Monitor connection usage after changes",
                            "Test under load to verify improvement"
                        ],
                        codeExample: `// Update connection pool configuration
const pool = new Pool({
  max: 20, // Increased from 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});`
                    },
                    {
                        id: "sol-2",
                        title: "Optimize slow queries",
                        description: "Reduce query execution time to free up connections faster",
                        effort: "medium",
                        impact: "high",
                        priority: 90,
                        steps: [
                            "Identify slow queries using database logs",
                            "Add appropriate indexes",
                            "Optimize query structure",
                            "Implement query result caching"
                        ]
                    },
                    {
                        id: "sol-3",
                        title: "Implement request throttling",
                        description: "Limit concurrent requests to prevent pool exhaustion",
                        effort: "medium",
                        impact: "medium",
                        priority: 70,
                        steps: [
                            "Add rate limiting middleware",
                            "Configure max concurrent requests",
                            "Implement request queuing",
                            "Add backpressure handling"
                        ]
                    }
                ],
                relatedIssues: [
                    {
                        id: "issue-1",
                        title: "Similar error in Order-Sync (resolved)",
                        type: "similar_error"
                    },
                    {
                        id: "issue-2",
                        title: "Team discussion: Connection pooling best practices",
                        type: "team_discussion"
                    },
                    {
                        id: "issue-3",
                        title: "Documentation: Database optimization guide",
                        type: "documentation"
                    }
                ],
                confidence: 0.87
            };
        }

        // Track execution in database
        // TODO: Create execution record in database

        revalidatePath("/dashboard/ai-agents-v2");

        return {
            success: true,
            data: {
                executionId,
                ...diagnosis,
                duration,
            },
        };
    } catch (error) {
        console.error("Error diagnosing error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to diagnose error",
        };
    }
}

/**
 * Get failed executions (errors) for Error Diagnostician
 */
export async function getFailedExecutions(params: {
    tenantId: string;
    limit?: number;
}): Promise<ActionResult<any[]>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const { tenantId, limit = 100 } = params;

        // Validate tenant access
        const membership = await prisma.tenantMember.findUnique({
            where: { userId_tenantId: { userId: currentUser.id, tenantId } },
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Get all iFlows for this tenant
        const iFlows = await prisma.iFlow.findMany({
            where: { tenantId },
        });

        if (iFlows.length === 0) {
            return { success: true, data: [] };
        }

        // Get failed executions for each iFlow
        const failedExecutionsPromises = iFlows.map(async (iflow) => {
            const executions = await prisma.iFlowExecution.findMany({
                where: { iFlowId: iflow.id, status: "FAILED" },
                orderBy: { startTime: "desc" },
                take: 20,
            });

            return executions.map((exec: any) => ({
                id: exec.id,
                messageId: exec.messageId,
                iflowId: iflow.id,
                iflowName: iflow.name,
                errorMessage: exec.errorMessage || "Unknown error",
                errorCategory: exec.errorCategory || null,
                status: exec.status,
                startTime: exec.startTime,
                endTime: exec.endTime,
                duration: exec.duration,
            }));
        });

        const allFailedExecutions = (await Promise.all(failedExecutionsPromises)).flat();

        // Sort by most recent first
        allFailedExecutions.sort((a, b) => b.startTime - a.startTime);

        // Group by error message to get occurrence counts
        const errorGroups = new Map<string, any>();

        for (const exec of allFailedExecutions) {
            const key = `${exec.iflowName}-${exec.errorMessage}`;

            if (errorGroups.has(key)) {
                const existing = errorGroups.get(key)!;
                existing.occurrences++;
                if (exec.startTime > existing.lastOccurrence) {
                    existing.lastOccurrence = exec.startTime;
                    existing.id = exec.id; // Use most recent execution ID
                    existing.messageId = exec.messageId;
                }
            } else {
                errorGroups.set(key, {
                    id: exec.id,
                    messageId: exec.messageId,
                    iflowId: exec.iflowId,
                    iflowName: exec.iflowName,
                    errorMessage: exec.errorMessage,
                    errorCategory: exec.errorCategory,
                    status: exec.status,
                    occurrences: 1,
                    lastOccurrence: exec.startTime,
                    severity: categorizeErrorSeverity(exec.errorMessage, exec.errorCategory),
                });
            }
        }

        // Convert to array and limit
        const errors = Array.from(errorGroups.values())
            .sort((a, b) => b.lastOccurrence - a.lastOccurrence)
            .slice(0, limit);

        return { success: true, data: errors };
    } catch (error) {
        console.error("Error fetching failed executions:", error);
        return { success: false, error: "Failed to fetch errors" };
    }
}

/**
 * Categorize error severity based on error message and category
 */
function categorizeErrorSeverity(
    errorMessage: string,
    errorCategory: string | null
): "critical" | "high" | "medium" | "low" {
    const lowerMessage = errorMessage.toLowerCase();

    // Critical errors
    if (
        lowerMessage.includes("connection") && lowerMessage.includes("timeout") ||
        lowerMessage.includes("database") && lowerMessage.includes("down") ||
        lowerMessage.includes("service unavailable") ||
        lowerMessage.includes("out of memory") ||
        errorCategory === "SYSTEM"
    ) {
        return "critical";
    }

    // High severity
    if (
        lowerMessage.includes("authentication") ||
        lowerMessage.includes("authorization") ||
        lowerMessage.includes("permission denied") ||
        lowerMessage.includes("certificate") ||
        errorCategory === "SECURITY" ||
        errorCategory === "TIMEOUT"
    ) {
        return "high";
    }

    // Medium severity
    if (
        lowerMessage.includes("mapping") ||
        lowerMessage.includes("transformation") ||
        lowerMessage.includes("validation") ||
        errorCategory === "MAPPING" ||
        errorCategory === "BUSINESS_LOGIC"
    ) {
        return "medium";
    }

    // Low severity (default)
    return "low";
}

/**
 * Get agent execution history
 */
export async function getAgentHistoryV2(
    agentType?: AIAgentTypeV2,
    limit: number = 20
): Promise<ActionResult<any[]>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        // TODO: Implement actual query to fetch agent history
        // For now, return empty array
        return { success: true, data: [] };
    } catch (error) {
        console.error("Error fetching agent history:", error);
        return { success: false, error: "Failed to fetch agent history" };
    }
}

/**
 * Send a chat message to the General AI Assistant
 */
export async function sendChatMessage(params: {
    message: string;
    tenantId?: string;
    iflowId?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
}): Promise<ActionResult<{ response: string; messageId: string; tokensUsed: number }>> {
    const startTime = Date.now();

    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const { message, tenantId, iflowId, conversationHistory = [] } = params;

        // Build context for the AI
        let contextInfo = "";

        if (tenantId) {
            // Validate tenant access
            const membership = await prisma.tenantMember.findUnique({
                where: { userId_tenantId: { userId: currentUser.id, tenantId } },
            });

            if (!membership) {
                return { success: false, error: "You don't have access to this tenant" };
            }

            contextInfo += `\n**Tenant Context:** User is working with tenant ${tenantId}`;
        }

        if (iflowId) {
            contextInfo += `\n**iFlow Context:** User is asking about iFlow ${iflowId}`;
        }

        // Build conversation context
        const conversationContext = conversationHistory
            .slice(-10) // Keep last 10 messages for context
            .map(msg => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
            .join("\n");

        // Generate AI response
        const result = await runText({
            prompt: `${prompts.GENERAL_ASSISTANT_SYSTEM_PROMPT}

${contextInfo}

${conversationContext ? `**Conversation History:**\n${conversationContext}\n` : ""}

**User Question:**
${message}

Provide a helpful, accurate, and concise response. If the question is about SAP CPI, provide specific technical guidance. If it's a general question, answer it clearly and offer to help with SAP CPI-related tasks.`,
            temperature: 0.7,
            maxTokens: 2000,
        });

        const response = result.text;
        const duration = Date.now() - startTime;
        const messageId = `msg-${Date.now()}`;

        // Estimate token usage (rough approximation: 1 token ≈ 4 characters)
        const inputTokens = Math.ceil(message.length / 4);
        const outputTokens = Math.ceil(response.length / 4);
        const tokensUsed = result.usage.totalTokens || inputTokens + outputTokens;

        // Track execution in database
        try {
            await prisma.aIAgentExecution.create({
                data: {
                    userId: currentUser.id,
                    agentType: "GENERAL_ASSISTANT",
                    tenantId: tenantId || undefined,
                    iflowId: iflowId || undefined,
                    input: message,
                    output: response,
                    tokensUsed,
                    duration,
                    success: true,
                },
            });
        } catch (trackError) {
            console.error("Failed to track execution:", trackError);
            // Don't fail the request if tracking fails
        }

        revalidatePath("/dashboard/ai-agents");

        return {
            success: true,
            data: {
                response,
                messageId,
                tokensUsed,
            },
        };
    } catch (error) {
        console.error("Error in chat:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to get response",
        };
    }
}

/**
 * Get chat history for the General AI Assistant
 */
export async function getChatHistory(params: {
    tenantId?: string;
    limit?: number;
}): Promise<ActionResult<any[]>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const { tenantId, limit = 50 } = params;

        // Get agent execution history
        const history = await prisma.aIAgentExecution.findMany({
            where: { userId: currentUser.id, agentType: "GENERAL_ASSISTANT" },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        // Filter by tenantId if provided
        const filteredHistory = tenantId
            ? history.filter((exec: any) => exec.tenantId === tenantId)
            : history;

        // Transform to chat message format
        const messages = filteredHistory.flatMap((exec: any) => [
            {
                id: `${exec.id}-user`,
                role: "user",
                content: exec.input || exec.inputPrompt || "",
                timestamp: exec.createdAt,
            },
            {
                id: `${exec.id}-assistant`,
                role: "assistant",
                content: exec.output || exec.outputData || "",
                timestamp: new Date(new Date(exec.createdAt).getTime() + 1000), // Slightly after user message
            },
        ]);

        return { success: true, data: messages };
    } catch (error) {
        console.error("Error fetching chat history:", error);
        return { success: false, error: "Failed to fetch chat history" };
    }
}

/**
 * Clear chat history for the General AI Assistant
 */
export async function clearChatHistory(params: {
    tenantId?: string;
}): Promise<ActionResult<void>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        // TODO: Implement actual deletion
        // For now, just return success
        // await prisma.aIAgentExecution.deleteMany({
        //     where: {
        //         userId: currentUser.id,
        //         agentType: "GENERAL_ASSISTANT",
        //         tenantId: params.tenantId || undefined,
        //     },
        // });

        revalidatePath("/dashboard/ai-agents");

        return { success: true, data: undefined };
    } catch (error) {
        console.error("Error clearing chat history:", error);
        return { success: false, error: "Failed to clear chat history" };
    }
}

/**
 * Get iFlows for Performance Optimizer
 */
export async function getIFlowsForOptimizer(params: {
    tenantId: string;
}): Promise<ActionResult<Array<{ id: string; name: string; status: string }>>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const { tenantId } = params;

        // Validate tenant access
        const membership = await prisma.tenantMember.findUnique({
            where: { userId_tenantId: { userId: currentUser.id, tenantId } },
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Get all iFlows for this tenant
        const iFlows = await prisma.iFlow.findMany({
            where: { tenantId },
        });

        // Transform to simple format
        const simplifiedIFlows = iFlows.map((iflow: any) => ({
            id: iflow.id,
            name: iflow.name,
            status: iflow.status,
        }));

        return { success: true, data: simplifiedIFlows };
    } catch (error) {
        console.error("Error fetching iFlows:", error);
        return { success: false, error: "Failed to fetch iFlows" };
    }
}

/**
 * Analyze iFlow performance with AI
 */
export async function analyzeIFlowPerformance(params: {
    tenantId: string;
    iflowId: string;
    daysBack?: number;
}): Promise<ActionResult<any>> {
    const startTime = Date.now();

    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const { tenantId, iflowId, daysBack = 7 } = params;

        // Validate tenant access
        const membership = await prisma.tenantMember.findUnique({
            where: { userId_tenantId: { userId: currentUser.id, tenantId } },
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Get tenant details for SAP CPI connection
        const tenant = await prisma.cpiTenant.findUnique({
            where: { id: tenantId },
        });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        // Get iFlow details from database
        const iflow = await prisma.iFlow.findUnique({
            where: { id: iflowId },
        });

        if (!iflow) {
            return { success: false, error: "iFlow not found" };
        }

        // Get execution statistics for the last 7 days
        const executions = await prisma.iFlowExecution.findMany({
            where: { iFlowId: iflowId },
            orderBy: { startTime: "desc" },
            take: 100,
        });

        // Calculate performance metrics
        const completedExecutions = executions.filter((e: any) => e.status === "COMPLETED");
        const failedExecutions = executions.filter((e: any) => e.status === "FAILED");

        const durations = completedExecutions
            .filter((e: any) => e.duration)
            .map((e: any) => e.duration);

        const avgResponseTime = durations.length > 0
            ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
            : 0;

        const sortedDurations = [...durations].sort((a, b) => a - b);
        const p95Index = Math.floor(sortedDurations.length * 0.95);
        const p99Index = Math.floor(sortedDurations.length * 0.99);
        const p95ResponseTime = sortedDurations[p95Index] || avgResponseTime;
        const p99ResponseTime = sortedDurations[p99Index] || avgResponseTime;

        const errorRate = executions.length > 0
            ? (failedExecutions.length / executions.length) * 100
            : 0;
        const successRate = 100 - errorRate;

        // Calculate throughput (executions per minute over last hour)
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const recentExecutions = executions.filter((e: any) => e.startTime > oneHourAgo);
        const throughput = Math.round(recentExecutions.length / 60);

        // Calculate performance score (0-100)
        let score = 100;

        // Deduct points for slow response times
        if (avgResponseTime > 10000) score -= 30;
        else if (avgResponseTime > 5000) score -= 20;
        else if (avgResponseTime > 2000) score -= 10;

        // Deduct points for high error rate
        if (errorRate > 10) score -= 30;
        else if (errorRate > 5) score -= 20;
        else if (errorRate > 2) score -= 10;

        // Deduct points for low throughput
        if (throughput < 10) score -= 10;

        score = Math.max(0, score);

        const metrics = {
            score,
            avgResponseTime,
            p95ResponseTime,
            p99ResponseTime,
            throughput,
            errorRate: parseFloat(errorRate.toFixed(1)),
            successRate: parseFloat(successRate.toFixed(1)),
        };

        // Fetch real-time iFlow configuration from SAP CPI
        let iflowConfig: any = null;
        let iflowRuntimeInfo: any = null;
        let sapCPIMetrics: any = null;
        let bpmn2ParseResult: any = null;
        let sapCPIAvailable = false;

        // For OAuth, use authenticationUrl if available, otherwise derive from tenantUrl
        let effectiveTokenUrl = tenant.tokenUrl;

        // Priority: tokenUrl > authenticationUrl/oauth/token > tenantUrl/oauth/token
        if (tenant.authType === "OAUTH" && !effectiveTokenUrl) {
            if (tenant.authenticationUrl) {
                // Use authenticationUrl as base for OAuth token endpoint
                effectiveTokenUrl = `${tenant.authenticationUrl}/oauth/token`;
                console.log("Using authenticationUrl for OAuth token:", effectiveTokenUrl);
            } else if (tenant.tenantUrl) {
                // Fallback: derive from tenantUrl
                const url = new URL(tenant.tenantUrl);
                effectiveTokenUrl = `${url.protocol}//${url.host}/oauth/token`;
                console.log("Derived OAuth token URL from tenantUrl:", effectiveTokenUrl);
            }
        }

        // Check if SAP CPI credentials are configured
        console.log("Tenant credentials check:", {
            authType: tenant.authType,
            hasClientId: !!tenant.clientId,
            hasClientSecret: !!tenant.clientSecret,
            hasTokenUrl: !!tenant.tokenUrl,
            effectiveTokenUrl: effectiveTokenUrl,
            hasUsername: !!tenant.username,
            hasPassword: !!tenant.password,
            tenantUrl: tenant.tenantUrl,
        });

        const hasOAuthCredentials = tenant.authType === "OAUTH" &&
            tenant.clientId &&
            tenant.clientSecret &&
            effectiveTokenUrl; // Use derived token URL

        const hasBasicAuthCredentials = tenant.authType === "BASIC_AUTH" &&
            tenant.username &&
            tenant.password;

        console.log("Credential validation:", {
            hasOAuthCredentials,
            hasBasicAuthCredentials,
            willConnectToSAPCPI: hasOAuthCredentials || hasBasicAuthCredentials,
        });

        if (hasOAuthCredentials || hasBasicAuthCredentials) {
            try {
                // Create SAP CPI client
                const cpiCredentials: SAPCPICredentials = {
                    tenantUrl: tenant.tenantUrl,
                    authType: tenant.authType as any,
                    clientId: tenant.clientId,
                    clientSecret: tenant.clientSecret,
                    username: tenant.username,
                    password: tenant.password,
                    tokenUrl: effectiveTokenUrl, // Use derived token URL
                };

                const cpiClient = createSAPCPIClient(cpiCredentials);
                sapCPIAvailable = true;

                // Fetch iFlow design-time artifact (configuration)
                try {
                    iflowConfig = await cpiClient.getIntegrationDesigntimeArtifact(iflow.iFlowId);
                } catch (error) {
                    console.warn("Could not fetch iFlow design-time artifact:", error);
                }

                // Fetch iFlow runtime artifact (deployment info)
                try {
                    iflowRuntimeInfo = await cpiClient.getIntegrationRuntimeArtifact(iflow.iFlowId);
                } catch (error) {
                    console.warn("Could not fetch iFlow runtime artifact:", error);
                }

                // Download and parse BPMN2 XML for deep analysis
                try {
                    console.log("Downloading and parsing BPMN2 for iFlow:", iflow.iFlowId);
                    bpmn2ParseResult = await cpiClient.downloadAndParseIFlow(iflow.iFlowId);

                    if (bpmn2ParseResult) {
                        console.log("✅ BPMN2 parsed successfully:", {
                            adapters: bpmn2ParseResult.adapters.length,
                            scripts: bpmn2ParseResult.scripts.length,
                            mappings: bpmn2ParseResult.mappings.length,
                            errorHandlers: bpmn2ParseResult.errorHandlers.length,
                        });
                    }
                } catch (error) {
                    console.warn("Could not download/parse BPMN2:", error);
                }

                // Fetch performance metrics from SAP CPI monitoring
                try {
                    console.log("Fetching SAP CPI metrics for iFlow:", {
                        iFlowId: iflow.iFlowId,
                        iFlowName: iflow.name,
                        daysBack,
                    });
                    sapCPIMetrics = await cpiClient.getIFlowPerformanceMetrics(iflow.iFlowId, iflow.name, daysBack);
                    console.log("✅ SAP CPI metrics fetched successfully:", {
                        totalMessages: sapCPIMetrics.totalMessages,
                        avgDuration: sapCPIMetrics.avgDuration,
                        errorRate: sapCPIMetrics.errorRate,
                    });
                } catch (error) {
                    console.error("❌ Could not fetch SAP CPI performance metrics:", error);
                    console.error("Error details:", {
                        iFlowId: iflow.iFlowId,
                        iFlowName: iflow.name,
                        errorMessage: error instanceof Error ? error.message : String(error),
                    });
                }
            } catch (error) {
                console.error("Error connecting to SAP CPI:", error);
                // Continue with database metrics only
            }
        } else {
            console.info("SAP CPI credentials not configured for tenant, using database metrics only");
        }

        // Build comprehensive context for AI analysis
        let performanceContext = `
**iFlow Details:**
- Name: ${iflow.name}
- iFlow ID: ${iflow.iFlowId}
- Package: ${iflow.packageName || "N/A"}
- Version: ${iflow.version || "N/A"}
- Status: ${iflow.status}
- Last Deployed: ${iflow.lastDeployedAt ? new Date(iflow.lastDeployedAt).toISOString() : "N/A"}
`;

        // Add design-time configuration if available
        if (iflowConfig) {
            performanceContext += `
- Description: ${iflowConfig.Description || "N/A"}
- Created By: ${iflowConfig.CreatedBy || "N/A"}
- Modified By: ${iflowConfig.ModifiedBy || "N/A"}
- Last Modified: ${iflowConfig.ModifiedAt || "N/A"}
`;
        }

        // Add runtime information if available
        if (iflowRuntimeInfo) {
            performanceContext += `
- Deployed On: ${iflowRuntimeInfo.DeployedOn || "N/A"}
- Deployed By: ${iflowRuntimeInfo.DeployedBy || "N/A"}
- Runtime Status: ${iflowRuntimeInfo.Status || "N/A"}
`;
            if (iflowRuntimeInfo.ErrorInformation) {
                performanceContext += `
- Runtime Error: ${iflowRuntimeInfo.ErrorInformation.Message}
`;
            }
        }

        performanceContext += `
**Performance Metrics (Database):**
- Performance Score: ${score}/100
- Average Response Time: ${(avgResponseTime / 1000).toFixed(2)}s
- P95 Response Time: ${(p95ResponseTime / 1000).toFixed(2)}s
- P99 Response Time: ${(p99ResponseTime / 1000).toFixed(2)}s
- Throughput: ${throughput} requests/minute
- Success Rate: ${successRate.toFixed(1)}%
- Error Rate: ${errorRate.toFixed(1)}%

**Execution Statistics (Database):**
- Total Executions (last 100): ${executions.length}
- Completed: ${completedExecutions.length}
- Failed: ${failedExecutions.length}
- Recent Executions (last hour): ${recentExecutions.length}
`;

        // Add SAP CPI monitoring metrics if available
        if (sapCPIMetrics) {
            performanceContext += `
**Performance Metrics (SAP CPI Monitoring - Last ${daysBack} Days):**
- Average Duration: ${(sapCPIMetrics.avgDuration / 1000).toFixed(2)}s
- P95 Duration: ${(sapCPIMetrics.p95Duration / 1000).toFixed(2)}s
- P99 Duration: ${(sapCPIMetrics.p99Duration / 1000).toFixed(2)}s
- Throughput: ${sapCPIMetrics.throughput.toFixed(2)} messages/minute
- Error Rate: ${sapCPIMetrics.errorRate.toFixed(1)}%
- Total Messages: ${sapCPIMetrics.totalMessages}
`;
        }

        // Add BPMN2 analysis if available
        if (bpmn2ParseResult) {
            performanceContext += `
**iFlow Configuration Analysis (BPMN2):**
- Total Steps: ${bpmn2ParseResult.metadata.totalSteps}
- Parallel Processing: ${bpmn2ParseResult.metadata.hasParallelProcessing ? 'Yes' : 'No'}
- Contains Loops: ${bpmn2ParseResult.metadata.hasLoops ? 'Yes' : 'No'}

**Adapters (${bpmn2ParseResult.adapters.length}):**
${bpmn2ParseResult.adapters.map((adapter: any, idx: number) => `
${idx + 1}. ${adapter.name} (${adapter.type} - ${adapter.direction})
   - Connection Timeout: ${adapter.connectionTimeout ? `${adapter.connectionTimeout}ms` : 'Not configured'}
   - Response Timeout: ${adapter.responseTimeout ? `${adapter.responseTimeout}ms` : 'Not configured'}
   - Pool Size: ${adapter.poolSize || 'Not configured'}
   ${adapter.performanceIssues.length > 0 ? `- ⚠️ Issues: ${adapter.performanceIssues.join(', ')}` : ''}
`).join('')}

**Scripts (${bpmn2ParseResult.scripts.length}):**
${bpmn2ParseResult.scripts.map((script: any, idx: number) => `
${idx + 1}. ${script.name} (${script.type})
   - Lines of Code: ${script.linesOfCode}
   - Complexity: ${script.complexity}
   ${script.issues.length > 0 ? `- ⚠️ Issues: ${script.issues.join(', ')}` : ''}
`).join('')}

**Mappings (${bpmn2ParseResult.mappings.length}):**
${bpmn2ParseResult.mappings.map((mapping: any, idx: number) => `
${idx + 1}. ${mapping.name} (${mapping.type}) - Complexity: ${mapping.complexity}
`).join('')}

**Error Handling:**
${bpmn2ParseResult.errorHandlers.length > 0
                    ? bpmn2ParseResult.errorHandlers.map((handler: any) => `
- Retry Enabled: ${handler.retryEnabled}
  ${handler.maxRetries ? `Max Retries: ${handler.maxRetries}` : ''}
  ${handler.retryInterval ? `Retry Interval: ${handler.retryInterval}ms` : ''}
`).join('')
                    : '- No error handlers configured'}
`;
        }

        // Validate we have sufficient data for AI analysis
        const hasExecutionData = executions.length > 0;
        const hasMetrics = avgResponseTime > 0 || throughput > 0;
        const hasSAPCPIMetrics = sapCPIMetrics && sapCPIMetrics.totalMessages > 0;
        const hasIFlowMetadata = iflow.name && iflow.iFlowId;

        if (!hasIFlowMetadata) {
            return {
                success: false,
                error: "Insufficient iFlow metadata. iFlow name and ID are required for analysis.",
            };
        }

        // Allow analysis if we have either database data OR SAP CPI data
        if (!hasExecutionData && !hasSAPCPIMetrics) {
            return {
                success: false,
                error: "No execution data available for this iFlow. Please run the iFlow at least once or sync execution data from SAP CPI before analyzing performance.",
            };
        }

        if (!hasMetrics && !hasSAPCPIMetrics) {
            return {
                success: false,
                error: "Insufficient performance metrics. No execution durations or throughput data available. Please ensure the iFlow has completed executions with duration data.",
            };
        }

        // Only proceed with AI analysis if we have sufficient data
        console.log("Performance analysis validation passed:", {
            hasIFlowMetadata,
            hasExecutionData,
            hasMetrics,
            hasSAPCPIMetrics,
            executionCount: executions.length,
            sapCPIAvailable,
            dataSource: hasSAPCPIMetrics ? "SAP CPI + Database" : "Database only",
        });

        // Generate AI-powered analysis
        const result = await runText({
            prompt: `${prompts.PERFORMANCE_OPTIMIZER_SYSTEM_PROMPT}

${performanceContext}

Analyze this iFlow's performance and provide a comprehensive report in the following JSON format:
{
  "bottlenecks": [
    {
      "id": "b1",
      "title": "Bottleneck title",
      "category": "database|network|cpu|memory|payload|configuration",
      "severity": "critical|high|medium|low",
      "impact": 35,
      "currentValue": "8.2s avg",
      "targetValue": "<2s",
      "description": "Detailed description of the bottleneck",
      "recommendations": [
        {
          "id": "r1",
          "title": "Recommendation title",
          "description": "Detailed description",
          "effort": "low|medium|high",
          "impact": "low|medium|high",
          "expectedImprovement": "+40% faster",
          "implementationTime": "30 minutes",
          "steps": ["Step 1", "Step 2", "Step 3"],
          "codeExample": "Optional code example"
        }
      ]
    }
  ],
  "opportunities": [
    {
      "id": "o1",
      "title": "Optimization opportunity",
      "description": "Description",
      "potentialGain": "+15% faster",
      "effort": "low|medium|high",
      "category": "Network|CPU|Memory|Database"
    }
  ]
}

Focus on actionable, specific recommendations based on the metrics provided.`,
            temperature: 0.3,
        });

        const aiResponse = result.text;
        const duration = Date.now() - startTime;

        // Parse AI response
        let analysis;
        try {
            const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) || aiResponse.match(/```\n([\s\S]*?)\n```/);
            const jsonStr = jsonMatch ? jsonMatch[1] : aiResponse;
            analysis = JSON.parse(jsonStr);
        } catch (parseError) {
            // Provide default analysis if parsing fails
            analysis = {
                bottlenecks: [],
                opportunities: [],
            };
        }

        // Estimate token usage
        const inputTokens = Math.ceil(performanceContext.length / 4);
        const outputTokens = Math.ceil(aiResponse.length / 4);
        const tokensUsed = result.usage.totalTokens || inputTokens + outputTokens;

        // Track execution in database
        try {
            await prisma.aIAgentExecution.create({
                data: {
                    userId: currentUser.id,
                    agentType: "PERFORMANCE_OPTIMIZER",
                    tenantId: tenantId || undefined,
                    iflowId: iflowId || undefined,
                    input: `Analyze performance for ${iflow.name}`,
                    output: JSON.stringify(analysis),
                    tokensUsed,
                    duration,
                    success: true,
                },
            });
        } catch (trackError) {
            console.error("Failed to track execution:", trackError);
        }

        revalidatePath("/dashboard/ai-agents");

        return {
            success: true,
            data: {
                metrics,
                bottlenecks: analysis.bottlenecks || [],
                opportunities: analysis.opportunities || [],
                iflowName: iflow.name,
                bpmn2Analysis: bpmn2ParseResult ? {
                    metadata: bpmn2ParseResult.metadata,
                    adapters: bpmn2ParseResult.adapters,
                    scripts: bpmn2ParseResult.scripts,
                    mappings: bpmn2ParseResult.mappings,
                    errorHandlers: bpmn2ParseResult.errorHandlers,
                } : null,
                dataSource: {
                    hasDatabase: hasExecutionData,
                    hasSAPCPI: hasSAPCPIMetrics,
                    hasBPMN2: !!bpmn2ParseResult,
                },
            },
        };
    } catch (error) {
        console.error("Error analyzing performance:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to analyze performance",
        };
    }
}
