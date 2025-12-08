"use node";

/**
 * SAP CPI Sync Actions (Node.js version)
 * 
 * Uses "use node" directive to access Node.js modules like crypto for encryption
 */

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { decryptClientSecret } from "./lib/encryption";

/**
 * OAuth token response from SAP
 */
interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
}

/**
 * Get OAuth access token from SAP using client credentials
 */
async function getAccessToken(
    authUrl: string,
    clientId: string,
    encryptedClientSecret: string
): Promise<{ accessToken: string; expiresAt: number }> {
    console.log('[SAP Sync] Decrypting client secret...');
    const clientSecret = await decryptClientSecret(encryptedClientSecret);
    console.log('[SAP Sync] ✅ Client secret decrypted');

    // Use client credentials grant
    console.log(`[SAP Sync] Calling OAuth endpoint: ${authUrl}/oauth/token`);
    const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
    });

    const response = await fetch(`${authUrl}/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
    });

    console.log(`[SAP Sync] OAuth response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
        const error = await response.text();
        console.error('[SAP Sync] OAuth error response:', error);
        throw new Error(`Failed to get access token (${response.status}): ${error}`);
    }

    const data: TokenResponse = await response.json();
    console.log('[SAP Sync] ✅ Access token obtained');

    return {
        accessToken: data.access_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
    };
}

/**
 * Map SAP CPI status to our status format
 */
function mapSAPStatus(sapStatus: string): "STARTED" | "STOPPED" | "STARTING" | "STOPPING" | "ERROR" {
    const status = sapStatus?.toUpperCase();
    if (status === 'STARTED' || status === 'DEPLOYED') {
        return 'STARTED';
    } else if (status === 'ERROR' || status === 'FAILED') {
        return 'ERROR';
    } else if (status === 'STARTING') {
        return 'STARTING';
    } else if (status === 'STOPPING') {
        return 'STOPPING';
    } else {
        return 'STOPPED';
    }
}

/**
 * Fetch iFlows from SAP CPI for a specific tenant
 */
export const fetchIFlows = internalAction({
    args: {
        tenantId: v.id("cpiTenants"),
        tenantUrl: v.string(),
        authUrl: v.string(),
        clientId: v.string(),
        clientSecret: v.string(), // Encrypted
    },
    handler: async (ctx, args): Promise<{ success: boolean; count: number }> => {
        try {
            console.log(`[SAP Sync] Fetching iFlows for tenant ${args.tenantId}`);

            // Get OAuth access token
            const { accessToken } = await getAccessToken(
                args.authUrl,
                args.clientId,
                args.clientSecret
            );

            // Fetch integration runtime artifacts (iFlows)
            const response = await fetch(
                `${args.tenantUrl}/api/v1/IntegrationRuntimeArtifacts?$format=json`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json',
                    },
                }
            );

            console.log(`[SAP Sync] API Response: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch iFlows (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            const iflows = data.d?.results || [];
            console.log(`[SAP Sync] Received ${iflows.length} iFlows from SAP`);

            // Transform SAP CPI response to our format
            const iflowsToSync = iflows.map((item: any) => ({
                iFlowId: item.Id,
                name: item.Name || item.Id,
                packageName: item.PackageId,
                version: item.Version,
                status: mapSAPStatus(item.Status),
                lastDeployedAt: item.DeployedOn ? new Date(item.DeployedOn).getTime() : undefined,
            }));

            // Batch upsert iFlows
            const result = await ctx.runMutation(internal.iflowMutations.batchUpsertInternal, {
                tenantId: args.tenantId,
                iFlows: iflowsToSync,
            });

            // Update tenant last sync time
            await ctx.runMutation(internal.tenantMutations.updateInternal, {
                id: args.tenantId,
                lastSyncAt: Date.now(),
                isConnected: true,
            });

            console.log(`[SAP Sync] ✓ Synced ${result.created + result.updated} iFlows`);
            return { success: true, count: iflows.length };
        } catch (error) {
            console.error(`[SAP Sync] ✗ Error:`, error);

            // Mark tenant as disconnected on error
            await ctx.runMutation(internal.tenantMutations.updateInternal, {
                id: args.tenantId,
                isConnected: false,
            });

            throw error;
        }
    },
});

/**
 * Map SAP message status to our status format
 */
function mapMessageStatus(sapStatus: string): "COMPLETED" | "FAILED" | "PROCESSING" | "RETRY" | "SKIPPED" {
    const status = sapStatus?.toUpperCase();
    if (status === 'COMPLETED' || status === 'SUCCESS') {
        return 'COMPLETED';
    } else if (status === 'FAILED' || status === 'ERROR') {
        return 'FAILED';
    } else if (status === 'PROCESSING' || status === 'RUNNING') {
        return 'PROCESSING';
    } else if (status === 'RETRY') {
        return 'RETRY';
    } else if (status === 'DISCARDED') {
        return 'SKIPPED';
    } else {
        return 'PROCESSING';
    }
}

/**
 * Categorize errors
 */
function categorizeError(errorMessage: string | null): string | null {
    if (!errorMessage) return null;
    const lower = errorMessage.toLowerCase();
    if (lower.includes("timeout")) return "TIMEOUT";
    if (lower.includes("connection") || lower.includes("network")) return "NETWORK";
    if (lower.includes("mapping") || lower.includes("transform")) return "MAPPING";
    if (lower.includes("auth") || lower.includes("certificate")) return "SECURITY";
    if (lower.includes("business") || lower.includes("validation")) return "BUSINESS_LOGIC";
    if (lower.includes("system") || lower.includes("internal")) return "SYSTEM";
    return "UNKNOWN";
}

/**
 * Parse SAP date format
 */
function parseSAPDate(dateValue: any): number | null {
    if (!dateValue) return null;
    if (typeof dateValue === 'string') {
        const match = dateValue.match(/\/Date\((\d+)\)\//);
        if (match) return parseInt(match[1], 10);
        const parsed = new Date(dateValue);
        if (!isNaN(parsed.getTime())) return parsed.getTime();
    }
    if (typeof dateValue === 'number') return dateValue;
    return null;
}

/**
 * Fetch message logs (executions) from SAP CPI for a specific tenant
 */
export const fetchMessages = internalAction({
    args: {
        tenantId: v.id("cpiTenants"),
        tenantUrl: v.string(),
        authUrl: v.string(),
        clientId: v.string(),
        clientSecret: v.string(), // Encrypted
        maxLogs: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<{ success: boolean; count: number }> => {
        try {
            console.log(`[SAP Sync] Fetching messages for tenant ${args.tenantId}`);

            // Get OAuth access token
            const { accessToken } = await getAccessToken(
                args.authUrl,
                args.clientId,
                args.clientSecret
            );

            // Get all iFlows for this tenant
            const iFlows = await ctx.runQuery(internal.iflows.listByTenantInternal, {
                tenantId: args.tenantId,
            });

            if (iFlows.length === 0) {
                console.log(`[SAP Sync] No iFlows found for tenant`);
                return { success: true, count: 0 };
            }

            // Fetch message logs
            const maxLogs = args.maxLogs || 500;
            const logsUrl = `${args.tenantUrl}/api/v1/MessageProcessingLogs?$format=json&$orderby=LogEnd desc&$top=${maxLogs}`;

            const logsResponse = await fetch(logsUrl, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/json",
                },
            });

            if (!logsResponse.ok) {
                throw new Error(`Logs fetch failed: ${logsResponse.status}`);
            }

            const logsData = await logsResponse.json();
            const allLogs = logsData.d?.results || [];
            console.log(`[SAP Sync] Found ${allLogs.length} message logs`);

            // Build iFlow map for matching
            const iFlowMap = new Map();
            for (const iflow of iFlows) {
                iFlowMap.set(iflow.iFlowId, iflow._id);
                iFlowMap.set(iflow.iFlowId.toLowerCase(), iflow._id);
                iFlowMap.set(iflow.name, iflow._id);
                iFlowMap.set(iflow.name.toLowerCase(), iflow._id);
            }

            // Process logs
            const logsToInsert: any[] = [];

            for (const log of allLogs) {
                const artifactId = log.IntegrationArtifact?.Id || log.IntegrationFlowName || '';
                const iflowId = iFlowMap.get(artifactId) || iFlowMap.get(artifactId.toLowerCase());

                if (!iflowId) continue;

                const messageId = log.MessageGuid || log.MessageId;
                if (!messageId) continue;

                const startTime = parseSAPDate(log.LogStart) || Date.now();
                const endTime = parseSAPDate(log.LogEnd);
                const duration = startTime && endTime ? endTime - startTime : null;

                const isFailed = log.Status?.toUpperCase() === "FAILED";
                const execution: any = {
                    messageId,
                    status: mapMessageStatus(log.Status),
                    startTime,
                    endTime,
                    duration,
                    sender: log.Sender || undefined,
                    receiver: log.Receiver || undefined,
                    interfaceType: log.IntegrationArtifact?.Type || undefined,
                    iFlowId: iflowId,
                };

                // Only add error fields for failed executions
                if (isFailed) {
                    execution.errorMessage = log.ErrorMessage || "Error occurred";
                    const category = categorizeError(log.ErrorMessage);
                    if (category) {
                        execution.errorCategory = category;
                    }
                }

                logsToInsert.push(execution);
            }

            console.log(`[SAP Sync] ${logsToInsert.length} logs matched to iFlows`);

            if (logsToInsert.length > 0) {
                // Batch insert executions
                const result: { created: number } = await ctx.runMutation(internal.iflowMutations.batchCreateExecutionsInternal, {
                    executions: logsToInsert,
                });

                console.log(`[SAP Sync] ✓ Synced ${result.created} executions`);
                return { success: true, count: result.created };
            }

            return { success: true, count: 0 };
        } catch (error) {
            console.error(`[SAP Sync] ✗ Error:`, error);
            throw error;
        }
    },
});