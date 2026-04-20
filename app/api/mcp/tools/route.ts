/**
 * SAP CPI MCP Tools API Route
 *
 * Provides tool execution endpoint for the AI assistant.
 * This acts as the bridge between Vercel AI SDK and MCP tools.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { tenantMembers, cpiTenants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createSAPCPIClient, type SAPCPIClient } from "@/lib/sap-cpi/client";
import { decrypt } from "@/lib/encryption";
import {
  getAllTools,
  getToolByName,
  requiresConfirmation,
} from "@/mcp-server/src";

export const runtime = "nodejs";

/**
 * GET /api/mcp/tools
 * Returns the list of available tools for the AI assistant
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tools = getAllTools();

    // Transform tools into Vercel AI SDK compatible format
    const aiTools = tools.map(tool => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    return NextResponse.json({ tools: aiTools });
  } catch (error) {
    console.error("[MCP Tools] Error fetching tools:", error);
    return NextResponse.json(
      { error: "Failed to fetch tools" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mcp/tools
 * Execute a tool with the given parameters
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { toolName, parameters, tenantId, confirmationToken } = body;

    if (!toolName) {
      return NextResponse.json(
        { error: "Tool name is required" },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID is required" },
        { status: 400 }
      );
    }

    // Validate tool exists
    const tool = getToolByName(toolName);
    if (!tool) {
      return NextResponse.json(
        { error: `Unknown tool: ${toolName}` },
        { status: 400 }
      );
    }

    // Verify user has access to the tenant
    const membership = await db.query.tenantMembers.findFirst({
      where: and(eq(tenantMembers.userId, currentUser.id), eq(tenantMembers.tenantId, tenantId)),
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have access to this tenant" },
        { status: 403 }
      );
    }

    // Get tenant details
    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, tenantId),
    });
    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    // Check if this is an action tool that requires confirmation
    if (requiresConfirmation(toolName)) {
      if (!confirmationToken) {
        // Create confirmation request
        const token = `confirm-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const expiresAt = Date.now() + 120000; // 2 minutes

        return NextResponse.json({
          requiresConfirmation: true,
          confirmationToken: token,
          message: `Execute ${toolName} on tenant "${tenant.name}"`,
          expiresAt,
        });
      }

      // For now, accept any confirmation token (in production, validate properly)
    }

    // Create SAP CPI client
    const sapClient = await createSAPClientForTenant(tenant);
    if (!sapClient) {
      return NextResponse.json(
        { error: "Failed to create SAP CPI client" },
        { status: 500 }
      );
    }

    // Execute the tool directly using the SAP client
    const startTime = Date.now();
    let result: { success: boolean; data?: any; error?: string };

    try {
      result = await executeToolDirectly(toolName, parameters, sapClient);
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : "Tool execution failed",
      };
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[MCP Tools] Error executing tool:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tool execution failed" },
      { status: 500 }
    );
  }
}

/**
 * Execute a tool directly using the SAP CPI client
 */
async function executeToolDirectly(
  toolName: string,
  parameters: Record<string, any>,
  sapClient: SAPCPIClient
): Promise<{ success: boolean; data?: any; error?: string }> {
  switch (toolName) {
    case "get_message_logs":
      const logs = await sapClient.getMessageProcessingLogs({
        iFlowId: parameters.iFlowId,
        status: parameters.status,
        top: parameters.limit || 50,
      });
      return { success: true, data: logs };

    case "get_message_details":
      const details = await sapClient.getMessageProcessingLogById(parameters.messageGuid);
      const runSteps = parameters.includeSteps
        ? await sapClient.getMessageRunSteps(parameters.messageGuid)
        : null;
      return { success: true, data: { ...details, runSteps } };

    case "get_error_info":
      const errorInfo = await sapClient.getMessageErrorInformation(parameters.messageGuid);
      const errorText = await sapClient.getMessageErrorInformationValue(parameters.messageGuid);
      return { success: true, data: { errorInfo, errorText } };

    case "list_iflows":
      const iflows = await sapClient.listDeployedIFlows();
      let filtered = iflows;
      if (parameters.status) {
        filtered = filtered.filter(f => f.Status === parameters.status);
      }
      if (parameters.search) {
        const query = parameters.search.toLowerCase();
        filtered = filtered.filter(f =>
          f.Name.toLowerCase().includes(query) ||
          f.Id.toLowerCase().includes(query)
        );
      }
      return { success: true, data: filtered.slice(0, parameters.limit || 50) };

    case "get_iflow_config":
      const config = await sapClient.getIFlowConfiguration(parameters.iFlowId);
      return { success: true, data: config };

    case "get_iflow_performance":
      const metrics = await sapClient.getIFlowPerformanceMetrics(
        parameters.iFlowId,
        parameters.iFlowName || parameters.iFlowId,
        parameters.daysBack || 7
      );
      return { success: true, data: metrics };

    case "get_execution_stats":
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - (parameters.daysBack || 30));
      const allLogs = await sapClient.getAllMessageProcessingLogs({
        fromDate,
        top: 500,
      });
      const stats = {
        total: allLogs.results.length,
        completed: allLogs.results.filter((l: any) => l.Status === "COMPLETED").length,
        failed: allLogs.results.filter((l: any) => l.Status === "FAILED").length,
        processing: allLogs.results.filter((l: any) => l.Status === "PROCESSING").length,
      };
      return { success: true, data: stats };

    case "get_error_trends":
      const trendFromDate = new Date();
      trendFromDate.setDate(trendFromDate.getDate() - (parameters.daysBack || 7));
      const failedLogs = await sapClient.getAllMessageProcessingLogs({
        status: "FAILED",
        fromDate: trendFromDate,
        top: 200,
      });
      const trends: Record<string, number> = {};
      for (const log of failedLogs.results) {
        const date = new Date((log as any).LogStart).toISOString().split('T')[0];
        trends[date] = (trends[date] || 0) + 1;
      }
      return {
        success: true,
        data: {
          totalErrors: failedLogs.results.length,
          trends: Object.entries(trends).map(([date, count]) => ({ date, count })),
        }
      };

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

/**
 * Helper to create SAP CPI client for a tenant
 */
async function createSAPClientForTenant(tenant: any) {
  try {
    const credentials: any = {
      tenantUrl: tenant.tenantUrl,
      authType: tenant.authType,
    };

    if (tenant.authType === "OAUTH") {
      credentials.clientId = tenant.clientId;
      credentials.clientSecret = tenant.clientSecret; // Client will decrypt
      credentials.tokenUrl = tenant.authenticationUrl;
    } else if (tenant.authType === "BASIC_AUTH") {
      credentials.username = tenant.username;
      credentials.password = tenant.password; // Client will decrypt
    }

    return createSAPCPIClient(credentials);
  } catch (error) {
    console.error("[MCP Tools] Error creating SAP client:", error);
    return null;
  }
}
