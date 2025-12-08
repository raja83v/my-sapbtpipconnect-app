/**
 * SAP CPI MCP Server - Confirmation Manager
 * 
 * Handles confirmation tokens for destructive/action operations.
 * Implements modal-based confirmation flow with token expiration.
 */

import { ConfirmationDetails } from "../types";
import { randomBytes } from "crypto";

// In-memory pending confirmations store
const pendingConfirmations = new Map<string, PendingConfirmation>();

interface PendingConfirmation {
  token: string;
  details: ConfirmationDetails;
  userId: string;
  tenantId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  createdAt: Date;
}

// Token expiration time (5 minutes)
const TOKEN_EXPIRATION_MS = 5 * 60 * 1000;

/**
 * Create a confirmation request for an action
 */
export function createConfirmation(
  userId: string,
  tenantId: string,
  toolName: string,
  args: Record<string, unknown>,
  severity: ConfirmationDetails["severity"] = "medium"
): ConfirmationDetails {
  // Generate secure token
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MS);

  // Build description based on tool
  const { action, description, affectedResources } = buildConfirmationDetails(
    toolName,
    args
  );

  const details: ConfirmationDetails = {
    action,
    description,
    affectedResources,
    confirmationToken: token,
    expiresAt,
    severity,
  };

  // Store pending confirmation
  pendingConfirmations.set(token, {
    token,
    details,
    userId,
    tenantId,
    toolName,
    arguments: args,
    createdAt: new Date(),
  });

  return details;
}

/**
 * Validate and consume a confirmation token
 */
export function validateConfirmation(
  token: string,
  userId: string,
  tenantId: string
): { valid: boolean; pending?: PendingConfirmation; error?: string } {
  const pending = pendingConfirmations.get(token);

  if (!pending) {
    return { valid: false, error: "Confirmation token not found or already used" };
  }

  // Check expiration
  if (new Date() > pending.details.expiresAt) {
    pendingConfirmations.delete(token);
    return { valid: false, error: "Confirmation token has expired" };
  }

  // Check user and tenant match
  if (pending.userId !== userId) {
    return { valid: false, error: "Confirmation token belongs to a different user" };
  }

  if (pending.tenantId !== tenantId) {
    return { valid: false, error: "Confirmation token belongs to a different tenant" };
  }

  // Consume the token (one-time use)
  pendingConfirmations.delete(token);

  return { valid: true, pending };
}

/**
 * Cancel a pending confirmation
 */
export function cancelConfirmation(token: string): boolean {
  return pendingConfirmations.delete(token);
}

/**
 * Get pending confirmation by token
 */
export function getPendingConfirmation(token: string): PendingConfirmation | undefined {
  const pending = pendingConfirmations.get(token);
  
  if (pending && new Date() > pending.details.expiresAt) {
    pendingConfirmations.delete(token);
    return undefined;
  }
  
  return pending;
}

/**
 * Get all pending confirmations for a user
 */
export function getUserPendingConfirmations(userId: string): PendingConfirmation[] {
  const now = new Date();
  const results: PendingConfirmation[] = [];

  for (const [token, pending] of pendingConfirmations.entries()) {
    if (pending.userId === userId) {
      if (now > pending.details.expiresAt) {
        pendingConfirmations.delete(token);
      } else {
        results.push(pending);
      }
    }
  }

  return results;
}

/**
 * Build confirmation details based on tool and arguments
 */
function buildConfirmationDetails(
  toolName: string,
  args: Record<string, unknown>
): { action: string; description: string; affectedResources: string[] } {
  switch (toolName) {
    case "deploy_iflow":
      return {
        action: "Deploy iFlow",
        description: `Deploy iFlow "${args.iFlowId}" to production runtime. This will activate the integration and start processing messages.`,
        affectedResources: [
          `iFlow: ${args.iFlowId}`,
          args.version ? `Version: ${args.version}` : "Version: Latest",
        ],
      };

    case "restart_iflow":
      return {
        action: "Restart iFlow",
        description: `Restart iFlow "${args.iFlowId}". This will briefly interrupt message processing while the iFlow restarts.`,
        affectedResources: [`iFlow: ${args.iFlowId}`],
      };

    case "undeploy_iflow":
      return {
        action: "Undeploy iFlow",
        description: `Undeploy iFlow "${args.iFlowId}" from runtime. This will STOP the integration and reject any incoming messages.`,
        affectedResources: [`iFlow: ${args.iFlowId}`],
      };

    case "create_iflow":
      return {
        action: "Create iFlow",
        description: `Create a new iFlow "${args.name}" (${args.id}) in package "${args.packageId}".`,
        affectedResources: [
          `Package: ${args.packageId}`,
          `iFlow ID: ${args.id}`,
          `iFlow Name: ${args.name}`,
        ],
      };

    case "create_package":
      return {
        action: "Create Package",
        description: `Create a new integration package "${args.name}" (${args.id}).`,
        affectedResources: [
          `Package ID: ${args.id}`,
          `Package Name: ${args.name}`,
        ],
      };

    default:
      return {
        action: toolName.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        description: `Execute ${toolName} with the provided parameters.`,
        affectedResources: Object.entries(args).map(
          ([key, value]) => `${key}: ${String(value)}`
        ),
      };
  }
}

/**
 * Clean up expired confirmations
 */
export function cleanupExpiredConfirmations(): number {
  const now = new Date();
  let cleaned = 0;

  for (const [token, pending] of pendingConfirmations.entries()) {
    if (now > pending.details.expiresAt) {
      pendingConfirmations.delete(token);
      cleaned++;
    }
  }

  return cleaned;
}

// Cleanup expired confirmations every minute
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    cleanupExpiredConfirmations();
  }, 60000);
}
