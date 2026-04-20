"use server";

import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import { users, tenantMembers, cpiTenants, iFlows, iFlowExecutions } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import type { ActionResult } from "@/types/actions";
import { getCachedToken, cacheToken } from "@/lib/token-cache";
import { decrypt } from "@/lib/encryption";
import { runText } from "@/lib/ai/runtime/text";
import {
    createSAPCPIClient,
    type MessageProcessingLog,
    type MessageRunStep,
    type MessageAttachment,
    type MessageErrorInfo
} from "@/lib/sap-cpi/client";

// ============================================================================
// Types
// ============================================================================

export interface GlobalMessageLog {
    id: string;
    messageGuid: string;
    correlationId: string | null;
    applicationMessageId: string | null;
    applicationMessageType: string | null;
    status: string;
    logStart: string;
    logEnd: string | null;
    sender: string | null;
    receiver: string | null;
    integrationFlowName: string;
    iFlowId: string | null;
    customStatus: string | null;
    logLevel: string | null;
    transactionId: string | null;
    alternateWebLink: string | null;
    // Duration in ms
    duration: number | null;
    // Tenant info
    tenantId: string;
    tenantName: string;
}

export interface GetAllMessageLogsParams {
    tenantId?: string; // Optional - will use user's default tenant if not provided
    page?: number;
    pageSize?: number;
    status?: string;
    iFlowId?: string;
    fromDate?: string; // ISO string
    toDate?: string; // ISO string
    searchQuery?: string;
}

export interface GetAllMessageLogsResult {
    logs: GlobalMessageLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    fetchedAt: string;
}

export interface MessageLogDetailResult {
    log: GlobalMessageLog;
    runSteps: MessageRunStep[];
    attachments: MessageAttachment[];
    errorInfo: MessageErrorInfo | null;
    errorText: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get OAuth token from SAP CPI
 */
async function getSAPToken(
    authenticationUrl: string,
    clientId: string,
    clientSecret: string
): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        // Use form parameters method (same as client.ts)
        const params = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
        });

        const response = await fetch(authenticationUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get OAuth token: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('OAuth token request timed out after 30 seconds');
        }
        throw error;
    }
}

/**
 * Parse SAP OData date format: /Date(1733580000000)/
 */
function parseSAPDate(dateValue: string | null): number | null {
    if (!dateValue) return null;
    // Handle OData format: /Date(timestamp)/
    const odataMatch = dateValue.match(/\/Date\((\d+)\)\//);
    if (odataMatch) return parseInt(odataMatch[1], 10);
    // Try parsing as regular date
    const parsed = new Date(dateValue).getTime();
    if (!isNaN(parsed)) return parsed;
    return null;
}

/**
 * Calculate duration in milliseconds
 */
function calculateDuration(logStart: string, logEnd: string | null): number | null {
    if (!logEnd) return null;
    const start = parseSAPDate(logStart);
    const end = parseSAPDate(logEnd);
    if (start === null || end === null) return null;
    return end - start;
}

/**
 * Transform SAP CPI log to our format
 */
function transformLog(
    log: MessageProcessingLog,
    tenantId: string,
    tenantName: string
): GlobalMessageLog {
    return {
        id: log.MessageGuid,
        messageGuid: log.MessageGuid,
        correlationId: log.CorrelationId || null,
        applicationMessageId: log.ApplicationMessageId || null,
        applicationMessageType: log.ApplicationMessageType || null,
        status: log.Status,
        logStart: log.LogStart,
        logEnd: log.LogEnd || null,
        sender: log.Sender || null,
        receiver: log.Receiver || null,
        integrationFlowName: log.IntegrationFlowName,
        iFlowId: log.IntegrationArtifact?.Id || null,
        customStatus: log.CustomStatus || null,
        logLevel: log.LogLevel || null,
        transactionId: log.TransactionId || null,
        alternateWebLink: log.AlternateWebLink || null,
        duration: calculateDuration(log.LogStart, log.LogEnd || null),
        tenantId,
        tenantName,
    };
}

/**
 * Resolve the tenant ID - use provided, fallback to default, then first accessible
 */
async function resolveTenantId(userId: string, providedTenantId?: string): Promise<string | undefined> {
    if (providedTenantId) return providedTenantId;

    // Use user's default tenant
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { defaultTenantId: true },
    });
    if (user?.defaultTenantId) return user.defaultTenantId;

    // Fallback to first accessible tenant
    const firstMembership = await db.query.tenantMembers.findFirst({
        where: eq(tenantMembers.userId, userId),
        columns: { tenantId: true },
        orderBy: (tenantMembers, { asc }) => [asc(tenantMembers.joinedAt)],
    });
    return firstMembership?.tenantId;
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Get all message logs for the selected tenant with filtering
 */
export async function getAllMessageLogs(
    params: GetAllMessageLogsParams
): Promise<ActionResult<GetAllMessageLogsResult>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const {
            tenantId: providedTenantId,
            page = 1,
            pageSize = 50,
            status,
            iFlowId,
            fromDate,
            toDate,
            searchQuery
        } = params;

        // Determine which tenant to use
        const tenantId = await resolveTenantId(currentUser.id, providedTenantId);

        if (!tenantId) {
            return { success: false, error: "No tenant available" };
        }

        // Get tenant details
        const tenant = await db.query.cpiTenants.findFirst({
            where: eq(cpiTenants.id, tenantId),
        });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        // Check access
        const membership = await db.query.tenantMembers.findFirst({
            where: and(
                eq(tenantMembers.userId, currentUser.id),
                eq(tenantMembers.tenantId, tenantId),
            ),
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Check OAuth credentials
        if (tenant.authType !== "OAUTH" || !tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
            return { success: false, error: "OAuth credentials not configured for this tenant" };
        }

        // Get or refresh token
        let accessToken = getCachedToken(tenant.id);

        if (!accessToken) {
            const decryptedClientSecret = await decrypt(tenant.clientSecret);
            accessToken = await getSAPToken(
                tenant.authenticationUrl,
                tenant.clientId,
                decryptedClientSecret
            );
            cacheToken(tenant.id, accessToken);
        }

        // Create SAP CPI client
        const client = createSAPCPIClient({
            tenantUrl: tenant.tenantUrl,
            authType: "OAUTH",
            clientId: tenant.clientId,
            clientSecret: tenant.clientSecret, // Will be decrypted by client
            tokenUrl: tenant.authenticationUrl,
        });

        // Override the token since we already have it
        (client as any).accessToken = accessToken;
        (client as any).tokenExpiry = Date.now() + 3600000; // 1 hour

        // Build filter params
        const filterParams: any = {
            top: pageSize,
            skip: (page - 1) * pageSize,
        };

        if (status && status !== 'all') {
            filterParams.status = status;
        }

        if (fromDate) {
            filterParams.fromDate = new Date(fromDate);
        }

        if (toDate) {
            filterParams.toDate = new Date(toDate);
        }

        if (searchQuery) {
            filterParams.searchQuery = searchQuery;
        }

        // If filtering by specific iFlow
        if (iFlowId) {
            const logs = await client.getMessageProcessingLogs({
                iFlowId,
                status: filterParams.status,
                fromDate: filterParams.fromDate,
                toDate: filterParams.toDate,
                top: pageSize,
            });

            const transformedLogs = logs.map(log => transformLog(log, tenant.id, tenant.name));

            // Client-side pagination for iFlow filter (SAP API doesn't support skip with specific iFlow filter well)
            const startIndex = (page - 1) * pageSize;
            const paginatedLogs = transformedLogs.slice(startIndex, startIndex + pageSize);

            return {
                success: true,
                data: {
                    logs: paginatedLogs,
                    total: logs.length,
                    page,
                    pageSize,
                    totalPages: Math.ceil(logs.length / pageSize),
                    fetchedAt: new Date().toISOString(),
                },
            };
        }

        // Get all message logs
        const response = await client.getAllMessageProcessingLogs(filterParams);

        const transformedLogs = response.results.map(log =>
            transformLog(log, tenant.id, tenant.name)
        );

        const total = response.count || transformedLogs.length;

        // Cache failed messages for AI analysis (in database)
        const failedLogs = transformedLogs.filter(log => log.status === 'FAILED');
        if (failedLogs.length > 0) {
            // Fire and forget - don't await this
            cacheFailedMessages(failedLogs, tenant.id).catch(err =>
                console.warn('Failed to cache failed messages:', err)
            );
        }

        return {
            success: true,
            data: {
                logs: transformedLogs,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
                fetchedAt: new Date().toISOString(),
            },
        };
    } catch (error) {
        console.error("Error fetching message logs:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch message logs",
        };
    }
}

/**
 * Get detailed information for a specific message
 */
export async function getMessageLogDetail(
    providedTenantId: string | undefined,
    messageGuid: string
): Promise<ActionResult<MessageLogDetailResult>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        // Determine which tenant to use
        const tenantId = await resolveTenantId(currentUser.id, providedTenantId);

        if (!tenantId) {
            return { success: false, error: "No tenant available" };
        }

        // Get tenant
        const tenant = await db.query.cpiTenants.findFirst({
            where: eq(cpiTenants.id, tenantId),
        });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        // Check access
        const membership = await db.query.tenantMembers.findFirst({
            where: and(
                eq(tenantMembers.userId, currentUser.id),
                eq(tenantMembers.tenantId, tenantId),
            ),
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Check OAuth credentials
        if (tenant.authType !== "OAUTH" || !tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
            return { success: false, error: "OAuth credentials not configured" };
        }

        // Get token
        let accessToken = getCachedToken(tenant.id);

        if (!accessToken) {
            const decryptedClientSecret = await decrypt(tenant.clientSecret);
            accessToken = await getSAPToken(
                tenant.authenticationUrl,
                tenant.clientId,
                decryptedClientSecret
            );
            cacheToken(tenant.id, accessToken);
        }

        // Create client
        const client = createSAPCPIClient({
            tenantUrl: tenant.tenantUrl,
            authType: "OAUTH",
            clientId: tenant.clientId,
            clientSecret: tenant.clientSecret,
            tokenUrl: tenant.authenticationUrl,
        });

        (client as any).accessToken = accessToken;
        (client as any).tokenExpiry = Date.now() + 3600000;

        // Fetch all details in parallel
        const [logDetails, runSteps, attachments, errorInfo, errorText] = await Promise.all([
            client.getMessageProcessingLogDetails(messageGuid),
            client.getMessageRunSteps(messageGuid),
            client.getMessageAttachments(messageGuid),
            client.getMessageErrorInformation(messageGuid),
            client.getMessageErrorText(messageGuid),
        ]);

        const transformedLog = transformLog(logDetails, tenant.id, tenant.name);

        return {
            success: true,
            data: {
                log: transformedLog,
                runSteps,
                attachments,
                errorInfo,
                errorText,
            },
        };
    } catch (error) {
        console.error("Error fetching message log detail:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch message details",
        };
    }
}

/**
 * Package info type for filter dropdown
 */
export interface PackageInfo {
    id: string;
    name: string;
    description?: string;
}

/**
 * Get available iFlows for filter dropdown
 * Optionally filter by package
 */
export async function getIFlowsForFilter(
    tenantId?: string,
    packageId?: string
): Promise<ActionResult<Array<{ id: string; iFlowId: string; name: string; packageName: string | null }>>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        // Determine which tenant to use
        const resolvedTenantId = await resolveTenantId(currentUser.id, tenantId);

        if (!resolvedTenantId) {
            return { success: false, error: "No tenant available" };
        }

        // If a package is specified, fetch iFlows from SAP CPI for that package
        if (packageId) {
            // Get tenant details
            const tenant = await db.query.cpiTenants.findFirst({
                where: eq(cpiTenants.id, resolvedTenantId),
            });

            if (!tenant) {
                return { success: false, error: "Tenant not found" };
            }

            // Check access
            const membership = await db.query.tenantMembers.findFirst({
                where: and(
                    eq(tenantMembers.userId, currentUser.id),
                    eq(tenantMembers.tenantId, resolvedTenantId),
                ),
            });

            if (!membership) {
                return { success: false, error: "Access denied" };
            }

            if (tenant.authType !== "OAUTH" || !tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
                return { success: false, error: "OAuth credentials not configured" };
            }

            const decryptedClientSecret = await decrypt(tenant.clientSecret);

            // Get or refresh token
            let accessToken = getCachedToken(tenant.id);
            if (!accessToken) {
                accessToken = await getSAPToken(
                    tenant.authenticationUrl,
                    tenant.clientId,
                    decryptedClientSecret
                );
                cacheToken(tenant.id, accessToken);
            }

            // Fetch iFlows for specific package from SAP CPI
            const endpoint = `/api/v1/IntegrationPackages('${packageId}')/IntegrationDesigntimeArtifacts?$format=json`;
            const response = await fetch(`${tenant.tenantUrl}${endpoint}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/json",
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("SAP CPI API error:", errorText);
                return { success: false, error: `Failed to fetch iFlows for package` };
            }

            const data = await response.json();
            const artifacts = data.d?.results || [];

            const result = artifacts.map((artifact: any) => ({
                id: artifact.Id,
                iFlowId: artifact.Id,
                name: artifact.Name || artifact.Id,
                packageName: packageId,
            }));

            return { success: true, data: result };
        }

        // Otherwise, get all iFlows from database
        const iflowsList = await db.query.iFlows.findMany({
            where: eq(iFlows.tenantId, resolvedTenantId),
            columns: {
                id: true,
                iFlowId: true,
                name: true,
                packageName: true,
            },
            orderBy: (iFlows, { asc }) => [asc(iFlows.name)],
        });

        const result = iflowsList.map((iflow) => ({
            id: iflow.id,
            iFlowId: iflow.iFlowId,
            name: iflow.name,
            packageName: iflow.packageName || null,
        }));

        return { success: true, data: result };
    } catch (error) {
        console.error("Error fetching iFlows for filter:", error);
        return { success: false, error: "Failed to fetch iFlows" };
    }
}

/**
 * Get available packages from SAP CPI for filter dropdown
 */
export async function getPackagesForFilter(
    tenantId: string
): Promise<ActionResult<PackageInfo[]>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        // Get tenant details
        const tenant = await db.query.cpiTenants.findFirst({
            where: eq(cpiTenants.id, tenantId),
        });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        // Check access
        const membership = await db.query.tenantMembers.findFirst({
            where: and(
                eq(tenantMembers.userId, currentUser.id),
                eq(tenantMembers.tenantId, tenantId),
            ),
        });

        if (!membership) {
            return { success: false, error: "Access denied" };
        }

        if (tenant.authType !== "OAUTH" || !tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
            return { success: false, error: "OAuth credentials not configured" };
        }

        const decryptedClientSecret = await decrypt(tenant.clientSecret);

        // Get or refresh token
        let accessToken = getCachedToken(tenant.id);
        if (!accessToken) {
            accessToken = await getSAPToken(
                tenant.authenticationUrl,
                tenant.clientId,
                decryptedClientSecret
            );
            cacheToken(tenant.id, accessToken);
        }

        // Fetch packages from SAP CPI
        const endpoint = `/api/v1/IntegrationPackages?$format=json`;
        const response = await fetch(`${tenant.tenantUrl}${endpoint}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("SAP CPI API error:", errorText);
            return { success: false, error: "Failed to fetch packages from SAP CPI" };
        }

        const data = await response.json();
        const packages = data.d?.results || [];

        const result: PackageInfo[] = packages.map((pkg: any) => ({
            id: pkg.Id,
            name: pkg.Name || pkg.Id,
            description: pkg.Description || undefined,
        })).sort((a: PackageInfo, b: PackageInfo) => a.name.localeCompare(b.name));

        return { success: true, data: result };
    } catch (error) {
        console.error("Error fetching packages for filter:", error);
        return { success: false, error: "Failed to fetch packages" };
    }
}

/**
 * Cache failed messages in database for AI analysis
 * This allows the AI Error Diagnostician to access historical failed messages
 */
async function cacheFailedMessages(
    logs: GlobalMessageLog[],
    tenantId: string
): Promise<void> {
    for (const log of logs) {
        if (!log.iFlowId) continue;

        try {
            // Find the iFlow in database
            const iflow = await db.query.iFlows.findFirst({
                where: and(
                    eq(iFlows.tenantId, tenantId),
                    eq(iFlows.iFlowId, log.iFlowId),
                ),
            });

            if (!iflow) continue;

            // Check if already cached (upsert by messageId)
            const existing = await db.query.iFlowExecutions.findFirst({
                where: eq(iFlowExecutions.messageId, log.messageGuid),
            });

            if (existing) continue;

            // Cache the failed execution
            await db.insert(iFlowExecutions).values({
                messageId: log.messageGuid,
                status: "FAILED",
                startTime: new Date(log.logStart),
                endTime: log.logEnd ? new Date(log.logEnd) : undefined,
                duration: log.duration || undefined,
                sender: log.sender || undefined,
                receiver: log.receiver || undefined,
                errorMessage: `Status: ${log.status}. Use AI Error Explainer for detailed analysis.`,
                iFlowId: iflow.id,
            });
        } catch (err) {
            // Silently fail - this is a best-effort cache
            console.warn(`Failed to cache message ${log.messageGuid}:`, err);
        }
    }
}

/**
 * Download attachment content
 */
export async function downloadMessageAttachment(
    providedTenantId: string | undefined,
    messageGuid: string,
    attachmentId: string
): Promise<ActionResult<{ content: string; contentType: string }>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        // Get tenant ID - use provided one or fall back to user's default
        const tenantId = await resolveTenantId(currentUser.id, providedTenantId);

        if (!tenantId) {
            return { success: false, error: "No tenant selected. Please select a tenant first." };
        }

        // Get tenant
        const tenant = await db.query.cpiTenants.findFirst({
            where: eq(cpiTenants.id, tenantId),
        });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        // Check access
        const membership = await db.query.tenantMembers.findFirst({
            where: and(
                eq(tenantMembers.userId, currentUser.id),
                eq(tenantMembers.tenantId, tenantId),
            ),
        });

        if (!membership) {
            return { success: false, error: "Access denied" };
        }

        // Get token
        let accessToken = getCachedToken(tenant.id);

        if (!accessToken) {
            if (!tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
                return { success: false, error: "OAuth credentials not configured" };
            }
            const decryptedClientSecret = await decrypt(tenant.clientSecret);
            accessToken = await getSAPToken(
                tenant.authenticationUrl,
                tenant.clientId,
                decryptedClientSecret
            );
            cacheToken(tenant.id, accessToken);
        }

        // Create client and download
        const client = createSAPCPIClient({
            tenantUrl: tenant.tenantUrl,
            authType: "OAUTH",
            clientId: tenant.clientId!,
            clientSecret: tenant.clientSecret!,
            tokenUrl: tenant.authenticationUrl!,
        });

        (client as any).accessToken = accessToken;
        (client as any).tokenExpiry = Date.now() + 3600000;

        const buffer = await client.downloadAttachment(messageGuid, attachmentId);

        if (!buffer) {
            return { success: false, error: "Failed to download attachment" };
        }

        // Return as base64 for client-side handling
        return {
            success: true,
            data: {
                content: buffer.toString('base64'),
                contentType: 'application/octet-stream',
            },
        };
    } catch (error) {
        console.error("Error downloading attachment:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to download attachment",
        };
    }
}

/**
 * Diagnose execution error using AI - works with SAP artifact ID
 * This is used from the Message Logs page where we have SAP IDs, not DB IDs
 */
export async function diagnoseMessageLogError(
    tenantId: string,
    messageGuid: string,
    iFlowArtifactId: string | null,
    iFlowName: string,
    errorMessage?: string | null
): Promise<ActionResult<{ diagnosis: string }>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        // Get tenant
        const tenant = await db.query.cpiTenants.findFirst({
            where: eq(cpiTenants.id, tenantId),
        });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        // Check access
        const membership = await db.query.tenantMembers.findFirst({
            where: and(
                eq(tenantMembers.userId, currentUser.id),
                eq(tenantMembers.tenantId, tenantId),
            ),
        });

        if (!membership) {
            return { success: false, error: "Access denied" };
        }

        // Try to find the iFlow in database by artifact ID (optional)
        let iflow = null;
        if (iFlowArtifactId) {
            iflow = await db.query.iFlows.findFirst({
                where: and(
                    eq(iFlows.tenantId, tenantId),
                    eq(iFlows.iFlowId, iFlowArtifactId),
                ),
            });
        }

        // Fetch message details from SAP CPI
        if (tenant.authType !== "OAUTH" || !tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
            return { success: false, error: "OAuth credentials not configured" };
        }

        const decryptedClientSecret = await decrypt(tenant.clientSecret);

        // Get or refresh token
        let accessToken = getCachedToken(tenant.id);
        if (!accessToken) {
            accessToken = await getSAPToken(
                tenant.authenticationUrl,
                tenant.clientId,
                decryptedClientSecret
            );
            cacheToken(tenant.id, accessToken);
        }

        // Fetch error details from SAP CPI
        const client = createSAPCPIClient({
            tenantUrl: tenant.tenantUrl,
            authType: "OAUTH",
            clientId: tenant.clientId!,
            clientSecret: tenant.clientSecret!,
            tokenUrl: tenant.authenticationUrl!,
        });

        (client as any).accessToken = accessToken;
        (client as any).tokenExpiry = Date.now() + 3600000;

        // Get error information
        let errorDetails = errorMessage || "";
        try {
            const errorInfo = await client.getMessageErrorInformation(messageGuid);
            if (errorInfo) {
                errorDetails = `Type: ${errorInfo.Type}\nMessage: ${errorInfo.Message}`;
            }
        } catch {
            // Continue with provided error message
        }

        // Get error text (full stack trace)
        try {
            const errorText = await client.getMessageErrorText(messageGuid);
            if (errorText) {
                errorDetails += `\n\nFull Error:\n${errorText}`;
            }
        } catch {
            // Continue without full text
        }

        // Get run steps for additional context
        let runStepsContext = "";
        try {
            const runSteps = await client.getMessageRunSteps(messageGuid);
            if (runSteps && runSteps.length > 0) {
                const failedSteps = runSteps.filter(s => s.Status === "FAILED" || s.Error);
                if (failedSteps.length > 0) {
                    runStepsContext = "\n\nFailed Steps:\n" + failedSteps.map(s =>
                        `- ${s.Activity || s.StepId}: ${s.Error || s.Status}`
                    ).join("\n");
                }
            }
        } catch {
            // Continue without run steps
        }

        if (!errorDetails && !runStepsContext) {
            return { success: false, error: "No error details found for this message" };
        }

        // Generate diagnosis using AI SDK
        const prompt = `You are an SAP CPI (Cloud Platform Integration) expert. Analyze the following error from an integration flow and provide:
1. A brief explanation of what went wrong
2. The likely root cause
3. Suggested solutions or next steps

Integration Flow: ${iFlowName}
${(iflow as { description?: string } | null)?.description ? `Description: ${(iflow as { description?: string }).description}` : ""}

Error Details:
${errorDetails}
${runStepsContext}

Provide a clear, actionable response formatted in markdown.`;

        try {
            const result = await runText({
                prompt,
                temperature: 0.3,
                maxTokens: 1024,
            });
            const diagnosis = result.text;

            if (!diagnosis || diagnosis.trim().length === 0) {
                return { success: false, error: "No diagnosis generated" };
            }

            return {
                success: true,
                data: { diagnosis },
            };
        } catch (aiError) {
            console.error("AI Generation Error:", aiError);
            const errorMessage = aiError instanceof Error ? aiError.message : "Failed to generate diagnosis";
            return {
                success: false,
                error: `AI Error: ${errorMessage}. Please check your API key configuration.`,
            };
        }
    } catch (error) {
        console.error("Error diagnosing message log error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to analyze error",
        };
    }
}
