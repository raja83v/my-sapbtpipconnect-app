/**
 * SAP APIM MCP Server - APIM Monitoring Tool Handlers
 *
 * Implements handlers for SAP API Management monitoring tools:
 * - get_apim_logs      - Fetch API proxy call logs / analytics
 * - list_api_proxies   - List all API proxies
 * - get_apim_errors    - Get error details for API proxy calls
 */

import { z } from "zod";
import {
    TenantContext,
    ToolExecutionResult,
    GetAPIMLogsInputSchema,
    GetAPIMProxyListInputSchema,
    GetAPIMErrorsInputSchema,
} from "../types";

// ============================================================================
// APIM Client Interface (injected at runtime)
// ============================================================================

export interface SAPAPIMClientInterface {
    getAPIProxies(params: {
        search?: string;
        state?: string;
        top?: number;
        skip?: number;
    }): Promise<{
        results: Array<{
            name: string;
            title: string;
            description?: string;
            basePath: string;
            virtualHost?: string;
            state: string;
            version?: string;
            createdAt?: string;
            modifiedAt?: string;
            serviceEndPoint?: string;
        }>;
        count?: number;
    }>;

    getAPIProxyCallLogs(params: {
        proxyName?: string;
        fromDate?: Date;
        toDate?: Date;
        statusCode?: number;
        isError?: boolean;
        top?: number;
        skip?: number;
    }): Promise<{
        results: Array<{
            id: string;
            apiProxyName: string;
            method: string;
            statusCode: number;
            responseTime: number;
            requestSize?: number;
            responseSize?: number;
            clientIP?: string;
            timestamp: string;
            errorMessage?: string | null;
            isError: boolean;
            developerApp?: string | null;
            apiProduct?: string | null;
            faultCode?: string;
            faultSource?: string;
        }>;
        count?: number;
    }>;

    getAPIProxyErrors(params: {
        proxyName?: string;
        fromDate?: Date;
        toDate?: Date;
        top?: number;
    }): Promise<Array<{
        id: string;
        apiProxyName: string;
        method: string;
        statusCode: number;
        responseTime: number;
        timestamp: string;
        errorMessage?: string | null;
        isError: boolean;
        faultCode?: string;
        faultSource?: string;
    }>>;

    isAPIMAvailable(): Promise<boolean>;
}

// ============================================================================
// APIM Log Summary Type
// ============================================================================

interface APIMLogSummary {
    id: string;
    apiProxyName: string;
    method: string;
    statusCode: number;
    statusCategory: string;
    responseTime: number;
    timestamp: string;
    isError: boolean;
    errorMessage?: string | null;
    developerApp?: string | null;
    apiProduct?: string | null;
    faultCode?: string;
}

interface APIProxySummary {
    name: string;
    title: string;
    basePath: string;
    state: string;
    version?: string;
    description?: string;
    serviceEndPoint?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusCategory(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) return "2xx";
    if (statusCode >= 300 && statusCode < 400) return "3xx";
    if (statusCode >= 400 && statusCode < 500) return "4xx";
    if (statusCode >= 500) return "5xx";
    return "unknown";
}

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Handle get_apim_logs tool
 * Fetches API proxy call logs from SAP APIM analytics
 */
export async function handleGetAPIMlogs(
    client: SAPAPIMClientInterface,
    args: z.infer<typeof GetAPIMLogsInputSchema>,
    context: TenantContext
): Promise<ToolExecutionResult> {
    try {
        // Check APIM availability first
        const available = await client.isAPIMAvailable();
        if (!available) {
            return {
                success: false,
                error: "SAP API Management (APIM) is not available on this tenant. Please ensure APIM is configured and the credentials have access to the API Portal.",
            };
        }

        const filterParams: Parameters<typeof client.getAPIProxyCallLogs>[0] = {
            top: args.limit,
        };

        if (args.proxyName) {
            filterParams.proxyName = args.proxyName;
        }

        if (args.fromDate) {
            filterParams.fromDate = new Date(args.fromDate);
        }

        if (args.toDate) {
            filterParams.toDate = new Date(args.toDate);
        }

        // Map status filter to isError
        if (args.statusFilter === "error" || args.statusFilter === "4xx" || args.statusFilter === "5xx") {
            filterParams.isError = true;
        }

        const result = await client.getAPIProxyCallLogs(filterParams);

        let logs = result.results;

        // Client-side status category filtering
        if (args.statusFilter && args.statusFilter !== "all" && args.statusFilter !== "error") {
            logs = logs.filter((log) => getStatusCategory(log.statusCode) === args.statusFilter);
        }

        // Client-side method filtering
        if (args.method && args.method !== "all") {
            logs = logs.filter(
                (log) => log.method.toUpperCase() === args.method!.toUpperCase()
            );
        }

        const summaries: APIMLogSummary[] = logs.map((log) => ({
            id: log.id,
            apiProxyName: log.apiProxyName,
            method: log.method,
            statusCode: log.statusCode,
            statusCategory: getStatusCategory(log.statusCode),
            responseTime: log.responseTime,
            timestamp: log.timestamp,
            isError: log.isError,
            errorMessage: log.errorMessage,
            developerApp: log.developerApp,
            apiProduct: log.apiProduct,
            faultCode: log.faultCode,
        }));

        return {
            success: true,
            data: {
                logs: summaries,
                total: result.count ?? summaries.length,
                hasMore: summaries.length === args.limit,
                filters: {
                    proxyName: args.proxyName,
                    statusFilter: args.statusFilter,
                    method: args.method,
                    fromDate: args.fromDate,
                    toDate: args.toDate,
                },
                tenantId: context.tenantId,
            },
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to fetch APIM logs: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
    }
}

/**
 * Handle list_api_proxies tool
 * Lists all API proxies deployed in SAP APIM
 */
export async function handleListAPIProxies(
    client: SAPAPIMClientInterface,
    args: z.infer<typeof GetAPIMProxyListInputSchema>,
    context: TenantContext
): Promise<ToolExecutionResult> {
    try {
        // Check APIM availability first
        const available = await client.isAPIMAvailable();
        if (!available) {
            return {
                success: false,
                error: "SAP API Management (APIM) is not available on this tenant.",
            };
        }

        const result = await client.getAPIProxies({
            search: args.search,
            state: args.state,
            top: args.limit,
        });

        const proxies: APIProxySummary[] = result.results.map((proxy) => ({
            name: proxy.name,
            title: proxy.title,
            basePath: proxy.basePath,
            state: proxy.state,
            version: proxy.version,
            description: proxy.description,
            serviceEndPoint: proxy.serviceEndPoint,
        }));

        return {
            success: true,
            data: {
                proxies,
                total: result.count ?? proxies.length,
                hasMore: proxies.length === args.limit,
                filters: {
                    search: args.search,
                    state: args.state,
                },
            },
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to list API proxies: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
    }
}

/**
 * Handle get_apim_errors tool
 * Fetches error details for API proxy calls from SAP APIM
 */
export async function handleGetAPIMErrors(
    client: SAPAPIMClientInterface,
    args: z.infer<typeof GetAPIMErrorsInputSchema>,
    context: TenantContext
): Promise<ToolExecutionResult> {
    try {
        // Check APIM availability first
        const available = await client.isAPIMAvailable();
        if (!available) {
            return {
                success: false,
                error: "SAP API Management (APIM) is not available on this tenant.",
            };
        }

        const errorParams: Parameters<typeof client.getAPIProxyErrors>[0] = {
            top: args.limit,
        };

        if (args.proxyName) {
            errorParams.proxyName = args.proxyName;
        }

        if (args.fromDate) {
            errorParams.fromDate = new Date(args.fromDate);
        }

        if (args.toDate) {
            errorParams.toDate = new Date(args.toDate);
        }

        const errors = await client.getAPIProxyErrors(errorParams);

        const errorSummaries = errors.map((err) => ({
            id: err.id,
            apiProxyName: err.apiProxyName,
            method: err.method,
            statusCode: err.statusCode,
            statusCategory: getStatusCategory(err.statusCode),
            responseTime: err.responseTime,
            timestamp: err.timestamp,
            errorMessage: err.errorMessage,
            faultCode: err.faultCode,
            faultSource: err.faultSource,
        }));

        // Group errors by fault code for summary
        const errorsByFaultCode: Record<string, number> = {};
        for (const err of errorSummaries) {
            const key = err.faultCode || `HTTP_${err.statusCode}`;
            errorsByFaultCode[key] = (errorsByFaultCode[key] || 0) + 1;
        }

        const topErrors = Object.entries(errorsByFaultCode)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([faultCode, count]) => ({ faultCode, count }));

        return {
            success: true,
            data: {
                errors: errorSummaries,
                total: errorSummaries.length,
                topErrors,
                filters: {
                    proxyName: args.proxyName,
                    fromDate: args.fromDate,
                    toDate: args.toDate,
                },
            },
        };
    } catch (error) {
        return {
            success: false,
            error: `Failed to fetch APIM errors: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
    }
}
