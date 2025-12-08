/**
 * SAP CPI MCP Server - Action Tool Handlers
 * 
 * Implements handlers for action tools (require confirmation):
 * - deploy_iflow
 * - restart_iflow
 * - create_iflow
 * - undeploy_iflow
 * - create_package
 */

import { z } from "zod";
import {
  TenantContext,
  ToolExecutionResult,
  DeployIFlowInputSchema,
  RestartIFlowInputSchema,
  CreateIFlowInputSchema,
  UndeployIFlowInputSchema,
  CreatePackageInputSchema,
} from "../types";
import { createConfirmation, validateConfirmation } from "../utils/confirmation";

// Type for the SAP CPI client (will be injected)
export interface SAPCPIClientInterface {
  deployIntegrationDesigntimeArtifact(id: string, version?: string): Promise<any>;
  
  undeployIntegrationRuntimeArtifact(id: string): Promise<any>;
  
  createIntegrationDesigntimeArtifact(params: {
    packageId: string;
    id: string;
    name: string;
    description?: string;
    content?: Buffer;
  }): Promise<any>;
  
  createIntegrationPackage(params: {
    id: string;
    name: string;
    description?: string;
    shortText?: string;
    version?: string;
    vendor?: string;
  }): Promise<any>;
  
  getIntegrationRuntimeArtifactByName(name: string): Promise<any>;
}

/**
 * Determine severity for action tools
 */
function getActionSeverity(toolName: string): "low" | "medium" | "high" | "critical" {
  switch (toolName) {
    case "undeploy_iflow":
      return "critical";
    case "deploy_iflow":
    case "restart_iflow":
      return "high";
    case "create_iflow":
    case "create_package":
      return "medium";
    default:
      return "medium";
  }
}

/**
 * Handle deploy_iflow tool
 */
export async function handleDeployIFlow(
  client: SAPCPIClientInterface,
  args: z.infer<typeof DeployIFlowInputSchema>,
  context: TenantContext,
  confirmationToken?: string
): Promise<ToolExecutionResult> {
  // Check if this requires confirmation
  if (!confirmationToken) {
    const confirmation = createConfirmation(
      context.userId,
      context.tenantId,
      "deploy_iflow",
      args as Record<string, unknown>,
      getActionSeverity("deploy_iflow")
    );

    return {
      success: true,
      requiresConfirmation: true,
      confirmationDetails: confirmation,
    };
  }

  // Validate confirmation token
  const validation = validateConfirmation(confirmationToken, context.userId, context.tenantId);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  // Execute deployment
  try {
    const result = await client.deployIntegrationDesigntimeArtifact(
      args.iFlowId,
      args.version
    );

    return {
      success: true,
      data: {
        action: "deploy",
        iFlowId: args.iFlowId,
        version: args.version || "latest",
        status: "deployed",
        message: `Successfully deployed iFlow ${args.iFlowId}`,
        details: result,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to deploy iFlow: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Handle restart_iflow tool
 */
export async function handleRestartIFlow(
  client: SAPCPIClientInterface,
  args: z.infer<typeof RestartIFlowInputSchema>,
  context: TenantContext,
  confirmationToken?: string
): Promise<ToolExecutionResult> {
  // Check if this requires confirmation
  if (!confirmationToken) {
    const confirmation = createConfirmation(
      context.userId,
      context.tenantId,
      "restart_iflow",
      args as Record<string, unknown>,
      getActionSeverity("restart_iflow")
    );

    return {
      success: true,
      requiresConfirmation: true,
      confirmationDetails: confirmation,
    };
  }

  // Validate confirmation token
  const validation = validateConfirmation(confirmationToken, context.userId, context.tenantId);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  // Execute restart (undeploy then deploy)
  try {
    // First undeploy
    await client.undeployIntegrationRuntimeArtifact(args.iFlowId);
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Then redeploy
    const result = await client.deployIntegrationDesigntimeArtifact(args.iFlowId);

    return {
      success: true,
      data: {
        action: "restart",
        iFlowId: args.iFlowId,
        status: "restarted",
        message: `Successfully restarted iFlow ${args.iFlowId}`,
        details: result,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to restart iFlow: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Handle undeploy_iflow tool
 */
export async function handleUndeployIFlow(
  client: SAPCPIClientInterface,
  args: z.infer<typeof UndeployIFlowInputSchema>,
  context: TenantContext,
  confirmationToken?: string
): Promise<ToolExecutionResult> {
  // Check if this requires confirmation
  if (!confirmationToken) {
    const confirmation = createConfirmation(
      context.userId,
      context.tenantId,
      "undeploy_iflow",
      args as Record<string, unknown>,
      getActionSeverity("undeploy_iflow")
    );

    return {
      success: true,
      requiresConfirmation: true,
      confirmationDetails: confirmation,
    };
  }

  // Validate confirmation token
  const validation = validateConfirmation(confirmationToken, context.userId, context.tenantId);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  // Execute undeploy
  try {
    await client.undeployIntegrationRuntimeArtifact(args.iFlowId);

    return {
      success: true,
      data: {
        action: "undeploy",
        iFlowId: args.iFlowId,
        status: "undeployed",
        message: `Successfully undeployed iFlow ${args.iFlowId}. The iFlow is now stopped.`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to undeploy iFlow: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Handle create_iflow tool
 */
export async function handleCreateIFlow(
  client: SAPCPIClientInterface,
  args: z.infer<typeof CreateIFlowInputSchema>,
  context: TenantContext,
  confirmationToken?: string,
  iflowContent?: Buffer
): Promise<ToolExecutionResult> {
  // Check if this requires confirmation
  if (!confirmationToken) {
    const confirmation = createConfirmation(
      context.userId,
      context.tenantId,
      "create_iflow",
      args as Record<string, unknown>,
      getActionSeverity("create_iflow")
    );

    return {
      success: true,
      requiresConfirmation: true,
      confirmationDetails: confirmation,
    };
  }

  // Validate confirmation token
  const validation = validateConfirmation(confirmationToken, context.userId, context.tenantId);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  // Execute creation
  try {
    const result = await client.createIntegrationDesigntimeArtifact({
      packageId: args.packageId,
      id: args.id,
      name: args.name,
      description: args.description,
      content: iflowContent,
    });

    return {
      success: true,
      data: {
        action: "create",
        iFlowId: args.id,
        name: args.name,
        packageId: args.packageId,
        status: "created",
        message: `Successfully created iFlow ${args.name} in package ${args.packageId}`,
        details: result,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create iFlow: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Handle create_package tool
 */
export async function handleCreatePackage(
  client: SAPCPIClientInterface,
  args: z.infer<typeof CreatePackageInputSchema>,
  context: TenantContext,
  confirmationToken?: string
): Promise<ToolExecutionResult> {
  // Check if this requires confirmation
  if (!confirmationToken) {
    const confirmation = createConfirmation(
      context.userId,
      context.tenantId,
      "create_package",
      args as Record<string, unknown>,
      getActionSeverity("create_package")
    );

    return {
      success: true,
      requiresConfirmation: true,
      confirmationDetails: confirmation,
    };
  }

  // Validate confirmation token
  const validation = validateConfirmation(confirmationToken, context.userId, context.tenantId);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  // Execute creation
  try {
    const result = await client.createIntegrationPackage({
      id: args.id,
      name: args.name,
      description: args.description,
      shortText: args.shortText,
      version: args.version,
      vendor: args.vendor,
    });

    return {
      success: true,
      data: {
        action: "create",
        packageId: args.id,
        name: args.name,
        status: "created",
        message: `Successfully created integration package ${args.name}`,
        details: result,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create package: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
