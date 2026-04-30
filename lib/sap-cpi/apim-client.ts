/**
 * SAP API Management (APIM) Client
 *
 * Supports SAP Integration Suite (Cloud Foundry) APIM.
 *
 * The APIM instance shares the same BTP subaccount credentials as the CPI tenant.
 * The APIM URL is derived from the CPI tenant URL (same host, different API path).
 *
 * CF Integration Suite APIM API paths:
 *   Management: {tenantUrl}/apiportal/api/1.0/Management.svc
 *   Analytics:  {tenantUrl}/apiportal/api/1.0/Analytics.svc  (some versions)
 *               {tenantUrl}/apim-devportal/api/1.0/Analytics.svc (alternative)
 *
 * Note: SAP APIM on CF does not expose raw per-call logs via OData.
 * It exposes aggregated analytics metrics. Per-call logs require the
 * API Analytics microservice or the Kibana/Elasticsearch backend.
 * We use the available Management.svc entities to list proxies and
 * derive analytics from the MessageProcessingLogs of the underlying iFlows.
 */

import { decrypt } from "@/lib/encryption";

/**
 * Parse an SAP OData date value to an ISO 8601 string.
 * SAP APIM returns dates as "/Date(1696544962620)/" (Unix ms since epoch).
 * Returns undefined for null/undefined/invalid values.
 */
function parseODataDate(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    const match = value.match(/\/Date\((-?\d+)\)\//);
    if (match) {
        return new Date(parseInt(match[1], 10)).toISOString();
    }
    // Already an ISO string or other parseable format
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export interface SAPAPIMCredentials {
    tenantUrl: string;
    authType: "OAUTH" | "BASIC_AUTH";
    clientId?: string;
    clientSecret?: string;
    username?: string;
    password?: string;
    tokenUrl?: string;
}

// ============================================================================
// API Proxy Types
// ============================================================================

export interface APIProxy {
    name: string;
    title: string;
    description?: string;
    basePath: string;
    virtualHost?: string;
    state: string; // DEPLOYED, UNDEPLOYED, etc.
    version?: string;
    createdAt?: string;
    modifiedAt?: string;
    createdBy?: string;
    modifiedBy?: string;
    serviceEndPoint?: string;
    isDefaultVersion?: boolean;
}

export interface APIProduct {
    name: string;
    title: string;
    description?: string;
    status: string;           // PUBLISHED, DEPRECATED, RETIRED, etc.
    scope?: string;
    quota?: number;
    quotaInterval?: number;
    quotaTimeUnit?: string;   // MINUTE, HOUR, DAY, MONTH
    createdAt?: string;
    modifiedAt?: string;
    // Navigation properties (populated when $expand=APIProxies is used)
    apiProxies?: APIProxy[];
}

// ============================================================================
// Analytics / Call Log Types
// ============================================================================

export interface APIMCallLog {
    id: string;
    apiProxyName: string;
    apiProxyPath?: string;
    method: string;
    statusCode: number;
    responseTime: number; // ms
    requestSize?: number; // bytes
    responseSize?: number; // bytes
    clientIP?: string;
    timestamp: string;
    targetHost?: string;
    errorMessage?: string | null;
    isError: boolean;
    developerApp?: string | null;
    apiProduct?: string | null;
    proxyRevision?: string;
    region?: string;
    faultCode?: string;
    faultSource?: string;
}

export interface APIMProxyPerformance {
    apiProxyName: string;
    totalCalls: number;
    successCount: number;
    errorCount: number;
    avgResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    totalTraffic?: number; // bytes
    errorRate: number; // percentage
    timeRange?: string;
}

// ============================================================================
// SAP APIM Client
// ============================================================================

export class SAPAPIMClient {
    private credentials: SAPAPIMCredentials;
    private accessToken?: string;
    private tokenExpiry?: number;
    /**
     * Silent mode — when true, demotes per-request logs to debug level and
     * suppresses 404 "feature not available" warnings. Used by capability
     * probes (e.g. tryDetectAPIM) where the endpoint may legitimately not
     * exist on the tenant.
     */
    public silent = false;

    // Derived base URLs
    private managementBaseUrl: string;

    // Analytics endpoint candidates (tried in order)
    private analyticsEndpointCandidates: string[];

    constructor(credentials: SAPAPIMCredentials) {
        this.credentials = credentials;
        const baseUrl = credentials.tenantUrl.replace(/\/$/, "");
        this.managementBaseUrl = `${baseUrl}/apiportal/api/1.0/Management.svc`;

        // CF Integration Suite analytics endpoint candidates (tried in order)
        this.analyticsEndpointCandidates = [
            `${baseUrl}/apiportal/api/1.0/Analytics.svc`,
            `${baseUrl}/apim-devportal/api/1.0/Analytics.svc`,
            `${baseUrl}/apiportal/api/1.0/Management.svc`, // fallback: use management for proxy list only
        ];
    }

    /**
     * Get OAuth access token (same credentials as CPI)
     */
    private async getAccessToken(): Promise<string> {
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        if (this.credentials.authType === "OAUTH") {
            if (!this.credentials.clientId || !this.credentials.clientSecret || !this.credentials.tokenUrl) {
                throw new Error("OAuth credentials incomplete for APIM client");
            }

            let clientSecret: string;
            const looksEncrypted = this.credentials.clientSecret.includes(":");

            if (looksEncrypted) {
                try {
                    clientSecret = await decrypt(this.credentials.clientSecret);
                } catch {
                    clientSecret = this.credentials.clientSecret;
                }
            } else {
                clientSecret = this.credentials.clientSecret;
            }

            const params = new URLSearchParams({
                grant_type: "client_credentials",
                client_id: this.credentials.clientId,
                client_secret: clientSecret,
            });

            const response = await fetch(this.credentials.tokenUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString(),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to get OAuth token for APIM (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
            return this.accessToken!;
        }

        if (this.credentials.authType === "BASIC_AUTH") {
            return "basic_auth";
        }

        throw new Error("Unsupported auth type for APIM client");
    }

    /**
     * Get authorization header
     */
    private async getAuthHeader(): Promise<string> {
        if (this.credentials.authType === "OAUTH") {
            const token = await this.getAccessToken();
            return `Bearer ${token}`;
        } else if (this.credentials.authType === "BASIC_AUTH") {
            if (!this.credentials.username || !this.credentials.password) {
                throw new Error("Basic auth credentials incomplete");
            }
            let password: string;
            try {
                password = await decrypt(this.credentials.password);
            } catch {
                password = this.credentials.password;
            }
            return `Basic ${Buffer.from(`${this.credentials.username}:${password}`).toString("base64")}`;
        }
        throw new Error("Unsupported auth type");
    }

    /**
     * Make API request to a specific URL
     */
    private async fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
        const authHeader = await this.getAuthHeader();

        // Debug logging — shows exact URL being called
        if (!this.silent) {
            console.log(`[APIMClient] → ${options.method || "GET"} ${url}`);
        }

        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: authHeader,
                // Explicitly request JSON — required for SAP APIM OData
                Accept: "application/json",
            },
        });

        const contentType = response.headers.get("content-type") || "";
        if (!this.silent) {
            console.log(`[APIMClient] ← ${response.status} ${response.statusText} | Content-Type: ${contentType}`);
        }

        // Detect HTML response (login redirect) — means auth token doesn't have APIM scope
        if (contentType.includes("text/html")) {
            const html = await response.text();
            if (!this.silent) {
                console.error(`[APIMClient] ⚠️  Received HTML response — OAuth token may not have APIM scope.`);
                console.error(`[APIMClient] HTML preview: ${html.substring(0, 200)}`);
            }
            throw new Error(
                "SAP APIM returned an HTML page instead of JSON. " +
                "The OAuth client credentials may not have access to the API Portal. " +
                "Ensure the service instance has the 'APIPortal.Administrator' or 'APIPortal.Read' role collection assigned."
            );
        }

        if (!response.ok) {
            const errorText = await response.text();
            // 404 from a probe is normal — APIM not enabled on this tenant. Demote silently.
            if (!this.silent) {
                if (response.status === 404) {
                    console.warn(`[APIMClient] ${response.status} ${response.statusText} for ${url} — APIM may not be enabled on this tenant.`);
                } else {
                    console.error(`[APIMClient] Error body (first 500 chars): ${errorText.substring(0, 500)}`);
                }
            }
            throw new Error(`SAP APIM API error (${response.status}): ${errorText}`);
        }

        // Handle XML/Atom responses
        if (contentType.includes("xml") || contentType.includes("atom")) {
            const text = await response.text();
            if (!this.silent) {
                console.log(`[APIMClient] XML response (first 300 chars): ${text.substring(0, 300)}`);
            }
            return this.parseAtomXml<T>(text);
        }

        const json = await response.json();
        if (!this.silent) {
            console.log(`[APIMClient] JSON keys: ${Object.keys(json).join(", ")}`);
        }
        return json;
    }

    /**
     * Basic Atom/XML to JSON converter for SAP OData responses
     * Handles the case where SAP APIM returns Atom XML instead of JSON
     */
    private parseAtomXml<T>(xml: string): T {
        // If it looks like JSON wrapped in XML error, throw
        if (xml.includes("<error>") || xml.includes("<m:error>")) {
            const msgMatch = xml.match(/<m:message[^>]*>([^<]+)<\/m:message>/);
            throw new Error(`SAP APIM OData error: ${msgMatch?.[1] || xml.substring(0, 200)}`);
        }

        // Extract entries from Atom feed
        const entries: Record<string, unknown>[] = [];
        const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
        let entryMatch;

        while ((entryMatch = entryRegex.exec(xml)) !== null) {
            const entryXml = entryMatch[1];
            const props: Record<string, unknown> = {};

            // Extract d:PropertyName values
            const propRegex = /<d:(\w+)(?:\s[^>]*)?>([^<]*)<\/d:\1>/g;
            let propMatch;
            while ((propMatch = propRegex.exec(entryXml)) !== null) {
                props[propMatch[1]] = propMatch[2];
            }

            // Extract nested life_cycle properties
            const lifeCycleMatch = entryXml.match(/<d:life_cycle[^>]*>([\s\S]*?)<\/d:life_cycle>/);
            if (lifeCycleMatch) {
                const lcProps: Record<string, string> = {};
                const lcPropRegex = /<d:(\w+)(?:\s[^>]*)?>([^<]*)<\/d:\1>/g;
                let lcMatch;
                while ((lcMatch = lcPropRegex.exec(lifeCycleMatch[1])) !== null) {
                    lcProps[lcMatch[1]] = lcMatch[2];
                }
                props["life_cycle"] = lcProps;
            }

            if (Object.keys(props).length > 0) {
                entries.push(props);
            }
        }

        // Return in OData d.results format
        return { d: { results: entries } } as T;
    }

    /**
     * Make request to Management API
     */
    private async managementRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.managementBaseUrl}${endpoint}`;
        return this.fetchWithAuth<T>(url, options);
    }

    // ============================================================================
    // API Proxy Methods (Management API — works on CF Integration Suite)
    // ============================================================================

    /**
     * List all API proxies in the tenant
     */
    async getAPIProxies(params: {
        search?: string;
        state?: string;
        top?: number;
        skip?: number;
    } = {}): Promise<{ results: APIProxy[]; count?: number }> {
        const filters: string[] = [];

        if (params.state) {
            filters.push(`state eq '${params.state}'`);
        }

        if (params.search) {
            const escaped = params.search.replace(/'/g, "''");
            filters.push(`(substringof('${escaped}', name) or substringof('${escaped}', title))`);
        }

        // Build query manually (no URLSearchParams to avoid encoding issues)
        const queryParts: string[] = [
            `$skip=${params.skip ?? 0}`,
            `$top=${params.top ?? 50}`,
            `$orderby=name asc`,
        ];

        if (filters.length > 0) {
            queryParts.push(`$filter=${filters.join(" and ")}`);
        }

        const endpoint = `/APIProxies?${queryParts.join("&")}`;

        try {
            const response = await this.managementRequest<{
                d: {
                    results: Array<{
                        name: string;
                        title?: string;
                        description?: string;
                        basePath?: string;
                        virtualHost?: string;
                        state?: string;
                        version?: string;
                        createdAt?: string;
                        modifiedAt?: string;
                        createdBy?: string;
                        modifiedBy?: string;
                        serviceEndPoint?: string;
                        isDefaultVersion?: boolean;
                    }>;
                    __count?: string;
                };
            }>(endpoint);

            const results: APIProxy[] = (response.d?.results || []).map((proxy) => ({
                name: proxy.name,
                title: proxy.title || proxy.name,
                description: proxy.description,
                basePath: proxy.basePath || "",
                virtualHost: proxy.virtualHost,
                state: proxy.state || "UNKNOWN",
                version: proxy.version,
                createdAt: parseODataDate(proxy.createdAt),
                modifiedAt: parseODataDate(proxy.modifiedAt),
                createdBy: proxy.createdBy,
                modifiedBy: proxy.modifiedBy,
                serviceEndPoint: proxy.serviceEndPoint,
                isDefaultVersion: proxy.isDefaultVersion,
            }));

            return {
                results,
                count: response.d?.__count ? parseInt(response.d.__count, 10) : results.length,
            };
        } catch (error) {
            if (!this.silent) {
                console.error("Failed to fetch API proxies:", error);
            }
            throw error;
        }
    }

    /**
     * Get details of a specific API proxy
     */
    async getAPIProxyDetails(proxyName: string): Promise<APIProxy | null> {
        try {
            const endpoint = `/APIProxies('${encodeURIComponent(proxyName)}')`;
            const response = await this.managementRequest<{
                d: {
                    name: string;
                    title?: string;
                    description?: string;
                    basePath?: string;
                    virtualHost?: string;
                    state?: string;
                    version?: string;
                    createdAt?: string;
                    modifiedAt?: string;
                    createdBy?: string;
                    modifiedBy?: string;
                    serviceEndPoint?: string;
                };
            }>(endpoint);

            if (!response.d) return null;

            return {
                name: response.d.name,
                title: response.d.title || response.d.name,
                description: response.d.description,
                basePath: response.d.basePath || "",
                virtualHost: response.d.virtualHost,
                state: response.d.state || "UNKNOWN",
                version: response.d.version,
                createdAt: parseODataDate(response.d.createdAt),
                modifiedAt: parseODataDate(response.d.modifiedAt),
                createdBy: response.d.createdBy,
                modifiedBy: response.d.modifiedBy,
                serviceEndPoint: response.d.serviceEndPoint,
            };
        } catch (error) {
            console.warn(`Failed to fetch API proxy details for ${proxyName}:`, error);
            return null;
        }
    }

    /**
     * List all API products with optional filtering and search.
     * Uses life_cycle/changed_at for ordering (confirmed working endpoint).
     */
    async getAPIProducts(params: {
        search?: string;
        status?: string;
        top?: number;
        skip?: number;
        orderBy?: string;
    } = {}): Promise<{ results: APIProduct[]; count?: number }> {
        const filters: string[] = [];

        if (params.status) {
            filters.push(`status eq '${params.status}'`);
        }

        if (params.search) {
            const escaped = params.search.replace(/'/g, "''");
            filters.push(`(substringof('${escaped}', name) or substringof('${escaped}', title))`);
        }

        // Build query manually to avoid URLSearchParams encoding '/' in orderby
        // Confirmed working URL: /APIProducts?$skip=0&$top=52&$orderby=life_cycle/changed_at%20desc
        const orderBy = params.orderBy || "life_cycle/changed_at desc";
        const skip = params.skip ?? 0;
        const top = params.top ?? 50;

        const queryParts: string[] = [
            `$skip=${skip}`,
            `$top=${top}`,
            `$orderby=${encodeURIComponent(orderBy).replace(/%2F/gi, "/")}`,
        ];

        if (filters.length > 0) {
            queryParts.push(`$filter=${filters.join(" and ")}`);
        }

        const endpoint = `/APIProducts?${queryParts.join("&")}`;

        try {
            const response = await this.managementRequest<{
                d: {
                    results: Array<{
                        name: string;
                        title?: string;
                        description?: string;
                        status?: string;
                        scope?: string;
                        quota?: number | string;
                        quotaInterval?: number | string;
                        quotaTimeUnit?: string;
                        life_cycle?: {
                            changed_at?: string;
                            created_at?: string;
                            changed_by?: string;
                            created_by?: string;
                        };
                        // Fallback flat fields (some APIM versions)
                        createdAt?: string;
                        modifiedAt?: string;
                    }>;
                    __count?: string;
                };
            }>(endpoint);

            const results: APIProduct[] = (response.d?.results || []).map((product) => ({
                name: product.name,
                title: product.title || product.name,
                description: product.description,
                status: product.status || "UNKNOWN",
                scope: product.scope,
                quota: product.quota !== undefined ? Number(product.quota) : undefined,
                quotaInterval: product.quotaInterval !== undefined ? Number(product.quotaInterval) : undefined,
                quotaTimeUnit: product.quotaTimeUnit,
                // Prefer life_cycle nested object, fall back to flat fields; parse OData /Date(ms)/ format
                createdAt: parseODataDate(product.life_cycle?.created_at || product.createdAt),
                modifiedAt: parseODataDate(product.life_cycle?.changed_at || product.modifiedAt),
            }));

            return {
                results,
                count: response.d?.__count ? parseInt(response.d.__count, 10) : results.length,
            };
        } catch (error) {
            console.error("Failed to fetch API products:", error);
            throw error;
        }
    }

    /**
     * Get details of a specific API product by name.
     */
    async getAPIProductDetail(productName: string): Promise<APIProduct | null> {
        try {
            const endpoint = `/APIProducts('${encodeURIComponent(productName)}')`;
            const response = await this.managementRequest<{
                d: {
                    name: string;
                    title?: string;
                    description?: string;
                    status?: string;
                    scope?: string;
                    quota?: number | string;
                    quotaInterval?: number | string;
                    quotaTimeUnit?: string;
                    life_cycle?: {
                        changed_at?: string;
                        created_at?: string;
                        changed_by?: string;
                        created_by?: string;
                    };
                    createdAt?: string;
                    modifiedAt?: string;
                };
            }>(endpoint);

            if (!response.d) return null;

            const p = response.d;
            return {
                name: p.name,
                title: p.title || p.name,
                description: p.description,
                status: p.status || "UNKNOWN",
                scope: p.scope,
                quota: p.quota !== undefined ? Number(p.quota) : undefined,
                quotaInterval: p.quotaInterval !== undefined ? Number(p.quotaInterval) : undefined,
                quotaTimeUnit: p.quotaTimeUnit,
                createdAt: parseODataDate(p.life_cycle?.created_at || p.createdAt),
                modifiedAt: parseODataDate(p.life_cycle?.changed_at || p.modifiedAt),
            };
        } catch (error) {
            console.warn(`Failed to fetch API product detail for ${productName}:`, error);
            return null;
        }
    }

    /**
     * Get a specific API product with its associated API Proxies expanded.
     * Uses OData $expand=APIProxies navigation property.
     */
    async getAPIProductWithProxies(productName: string): Promise<APIProduct | null> {
        try {
            const endpoint = `/APIProducts('${encodeURIComponent(productName)}')?$expand=APIProxies`;
            const response = await this.managementRequest<{
                d: {
                    name: string;
                    title?: string;
                    description?: string;
                    status?: string;
                    scope?: string;
                    quota?: number | string;
                    quotaInterval?: number | string;
                    quotaTimeUnit?: string;
                    life_cycle?: {
                        changed_at?: string;
                        created_at?: string;
                    };
                    createdAt?: string;
                    modifiedAt?: string;
                    APIProxies?: {
                        results?: Array<{
                            name: string;
                            title?: string;
                            description?: string;
                            basePath?: string;
                            virtualHost?: string;
                            state?: string;
                            version?: string;
                            createdAt?: string;
                            modifiedAt?: string;
                            serviceEndPoint?: string;
                            isDefaultVersion?: boolean;
                        }>;
                    };
                };
            }>(endpoint);

            if (!response.d) return null;

            const p = response.d;
            const proxies: APIProxy[] = (p.APIProxies?.results || []).map((proxy) => ({
                name: proxy.name,
                title: proxy.title || proxy.name,
                description: proxy.description,
                basePath: proxy.basePath || "",
                virtualHost: proxy.virtualHost,
                state: proxy.state || "UNKNOWN",
                version: proxy.version,
                createdAt: parseODataDate(proxy.createdAt),
                modifiedAt: parseODataDate(proxy.modifiedAt),
                serviceEndPoint: proxy.serviceEndPoint,
                isDefaultVersion: proxy.isDefaultVersion,
            }));

            return {
                name: p.name,
                title: p.title || p.name,
                description: p.description,
                status: p.status || "UNKNOWN",
                scope: p.scope,
                quota: p.quota !== undefined ? Number(p.quota) : undefined,
                quotaInterval: p.quotaInterval !== undefined ? Number(p.quotaInterval) : undefined,
                quotaTimeUnit: p.quotaTimeUnit,
                createdAt: parseODataDate(p.life_cycle?.created_at || p.createdAt),
                modifiedAt: parseODataDate(p.life_cycle?.changed_at || p.modifiedAt),
                apiProxies: proxies,
            };
        } catch (error) {
            console.warn(`Failed to fetch API product with proxies for ${productName}:`, error);
            // Fall back to detail without proxies
            return this.getAPIProductDetail(productName);
        }
    }

    /**
     * Get API Proxies associated with a specific API Product.
     * Uses the OData navigation property link as a fallback when $expand is not supported.
     */
    async getAPIProductProxies(productName: string): Promise<APIProxy[]> {
        try {
            const endpoint = `/APIProducts('${encodeURIComponent(productName)}')/APIProxies`;
            const response = await this.managementRequest<{
                d: {
                    results?: Array<{
                        name: string;
                        title?: string;
                        description?: string;
                        basePath?: string;
                        virtualHost?: string;
                        state?: string;
                        version?: string;
                        createdAt?: string;
                        modifiedAt?: string;
                        serviceEndPoint?: string;
                        isDefaultVersion?: boolean;
                    }>;
                };
            }>(endpoint);

            return (response.d?.results || []).map((proxy) => ({
                name: proxy.name,
                title: proxy.title || proxy.name,
                description: proxy.description,
                basePath: proxy.basePath || "",
                virtualHost: proxy.virtualHost,
                state: proxy.state || "UNKNOWN",
                version: proxy.version,
                createdAt: parseODataDate(proxy.createdAt),
                modifiedAt: parseODataDate(proxy.modifiedAt),
                serviceEndPoint: proxy.serviceEndPoint,
                isDefaultVersion: proxy.isDefaultVersion,
            }));
        } catch (error) {
            console.warn(`Failed to fetch proxies for API product ${productName}:`, error);
            return [];
        }
    }

    // ============================================================================
    // Analytics Methods
    //
    // SAP Integration Suite CF APIM does NOT expose per-call logs via OData.
    // The analytics data is available via:
    //   1. The Analytics.svc OData service (if enabled)
    //   2. The API Analytics microservice (separate service binding)
    //   3. Kibana/Elasticsearch (internal, not accessible via API)
    //
    // We try multiple endpoint patterns and fall back to proxy-level summaries
    // derived from the Management API when analytics is not available.
    // ============================================================================

    /**
     * Get API proxy call logs / analytics data.
     *
     * Tries multiple endpoint patterns for CF Integration Suite compatibility.
     * Falls back to generating synthetic entries from proxy metadata when
     * the analytics API is not accessible.
     */
    async getAPIProxyCallLogs(params: {
        proxyName?: string;
        fromDate?: Date;
        toDate?: Date;
        statusCode?: number;
        isError?: boolean;
        top?: number;
        skip?: number;
    } = {}): Promise<{ results: APIMCallLog[]; count?: number; analyticsAvailable: boolean; warning?: string }> {
        const top = params.top || 50;

        // Try analytics endpoints in order. SAP APIM CF aggregated analytics uses
        // "requestTime" (not "requestTimestamp") as the datetime dimension field.
        const analyticsEndpoints = [
            this.buildAnalyticsEndpoint("APIProxyTrafficData", params, top),
            this.buildAnalyticsEndpoint("APIProxyPerformance", params, top),
            this.buildAnalyticsEndpoint("APIProxyErrorDetails", params, top),
        ];

        const endpointErrors: string[] = [];

        for (const { url, entityType } of analyticsEndpoints) {
            try {
                const authHeader = await this.getAuthHeader();
                const response = await fetch(url, {
                    headers: { Authorization: authHeader, Accept: "application/json" },
                });

                console.log(`[APIMClient] Analytics ${entityType}: HTTP ${response.status}`);

                if (response.ok) {
                    const data = await response.json();
                    const results = this.transformAnalyticsResponse(data, entityType, params);
                    if (results.length > 0 || data.d?.results !== undefined) {
                        return {
                            results,
                            count: data.d?.__count ? parseInt(data.d.__count, 10) : results.length,
                            analyticsAvailable: true,
                        };
                    }
                    // 200 but empty — analytics enabled, no data in range
                    return { results: [], count: 0, analyticsAvailable: true };
                } else {
                    const body = await response.text().catch(() => "");
                    endpointErrors.push(`${entityType}: HTTP ${response.status} — ${body.slice(0, 120)}`);
                }
            } catch (err) {
                endpointErrors.push(`${entityType}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        // All analytics endpoints failed
        console.warn(
            "[APIMClient] Analytics endpoints unavailable. Errors:\n" +
            endpointErrors.map((e) => `  • ${e}`).join("\n") +
            "\nAPIM Analytics.svc may not be enabled on this Integration Suite tenant."
        );

        return {
            results: [],
            count: 0,
            analyticsAvailable: false,
            warning:
                "SAP APIM Analytics service is not accessible on this tenant. " +
                "Per-call logs require the API Analytics capability to be enabled in SAP Integration Suite.",
        };
    }

    /**
     * Build analytics endpoint URL for a given entity type
     */
    private buildAnalyticsEndpoint(
        entityType: string,
        params: {
            proxyName?: string;
            fromDate?: Date;
            toDate?: Date;
            statusCode?: number;
            isError?: boolean;
        },
        top: number
    ): { url: string; entityType: string } {
        const filters: string[] = [];
        const baseUrl = this.credentials.tenantUrl.replace(/\/$/, "");

        if (params.proxyName) {
            const escaped = params.proxyName.replace(/'/g, "''");
            filters.push(`apiProxy eq '${escaped}'`);
        }

        if (params.fromDate) {
            const fromStr = params.fromDate.toISOString().split(".")[0];
            filters.push(`requestTime ge datetime'${fromStr}'`);
        }

        if (params.toDate) {
            const toStr = params.toDate.toISOString().split(".")[0];
            filters.push(`requestTime le datetime'${toStr}'`);
        }

        if (params.isError !== undefined) {
            filters.push(`isError eq ${params.isError}`);
        }

        // "requestTime" is the correct SAP APIM aggregated analytics datetime dimension field.
        // "requestTimestamp" is incorrect and causes 400 errors.
        const queryParts = [`$top=${top}`, "$orderby=requestTime desc", "$format=json"];
        if (filters.length > 0) queryParts.push(`$filter=${filters.join(" and ")}`);

        const url = `${baseUrl}/apiportal/api/1.0/Analytics.svc/${entityType}?${queryParts.join("&")}`;
        return { url, entityType };
    }

    /**
     * Transform analytics OData response to APIMCallLog[]
     */
    private transformAnalyticsResponse(
        data: any,
        entityType: string,
        params: { isError?: boolean }
    ): APIMCallLog[] {
        const results = data.d?.results || [];

        return results.map((entry: any, index: number) => {
            const statusCode = entry.responseStatusCode || entry.statusCode || 0;
            const isError = entry.isError !== undefined
                ? Boolean(entry.isError)
                : statusCode >= 400 || Boolean(params.isError);

            return {
                id: `${entry.apiProxy || "unknown"}-${entry.requestTimestamp || entry.clientReceivedStartTimestamp || index}`,
                apiProxyName: entry.apiProxy || entry.apiProxyName || "Unknown",
                method: entry.requestVerb || entry.method || "UNKNOWN",
                statusCode,
                responseTime: entry.totalResponseTime || entry.responseTime || 0,
                requestSize: entry.requestSize,
                responseSize: entry.responseSize,
                clientIP: entry.clientIP,
                timestamp: entry.requestTimestamp || entry.clientReceivedStartTimestamp || new Date().toISOString(),
                errorMessage: entry.faultCode ? `${entry.faultCode}: ${entry.faultSubCode || ""}` : null,
                isError,
                developerApp: entry.developerApp || entry.applicationName,
                apiProduct: entry.apiProduct || entry.productName,
                region: entry.environment,
                faultCode: entry.faultCode,
                faultSource: entry.faultSource,
            };
        });
    }

    /**
     * Get performance metrics aggregated per API proxy
     */
    async getAPIProxyPerformance(params: {
        proxyName?: string;
        fromDate?: Date;
        toDate?: Date;
    } = {}): Promise<APIMProxyPerformance[]> {
        const filters: string[] = [];
        const baseUrl = this.credentials.tenantUrl.replace(/\/$/, "");

        if (params.proxyName) {
            const escaped = params.proxyName.replace(/'/g, "''");
            filters.push(`apiProxy eq '${escaped}'`);
        }

        if (params.fromDate) {
            const fromStr = params.fromDate.toISOString().split(".")[0];
            filters.push(`requestTimestamp ge datetime'${fromStr}'`);
        }

        if (params.toDate) {
            const toStr = params.toDate.toISOString().split(".")[0];
            filters.push(`requestTimestamp le datetime'${toStr}'`);
        }

        const queryParts = ["$top=100"];
        if (filters.length > 0) queryParts.push(`$filter=${filters.join(" and ")}`);

        const url = `${baseUrl}/apiportal/api/1.0/Analytics.svc/APIProxyPerformance?${queryParts.join("&")}`;

        try {
            const authHeader = await this.getAuthHeader();
            const response = await fetch(url, {
                headers: { Authorization: authHeader, Accept: "application/json" },
            });

            if (!response.ok) {
                console.warn(`[APIMClient] Analytics performance endpoint returned ${response.status}`);
                return [];
            }

            const data = await response.json();

            return (data.d?.results || []).map((entry: any) => ({
                apiProxyName: entry.apiProxy || "Unknown",
                totalCalls: entry.totalCalls || 0,
                successCount: entry.successCount || 0,
                errorCount: entry.errorCount || 0,
                avgResponseTime: entry.avgResponseTime || 0,
                maxResponseTime: entry.maxResponseTime || 0,
                minResponseTime: entry.minResponseTime || 0,
                totalTraffic: entry.totalTraffic,
                errorRate: entry.errorRate || 0,
            }));
        } catch (error) {
            console.warn("[APIMClient] Failed to fetch APIM proxy performance:", error);
            return [];
        }
    }

    /**
     * Get error details for API proxy calls
     */
    async getAPIProxyErrors(params: {
        proxyName?: string;
        fromDate?: Date;
        toDate?: Date;
        top?: number;
    } = {}): Promise<APIMCallLog[]> {
        const result = await this.getAPIProxyCallLogs({
            ...params,
            isError: true,
        });
        return result.results;
    }

    /**
     * Check if APIM is available on this tenant.
     * Uses the Management API (proxy list) which is always available if APIM is configured.
     */
    async isAPIMAvailable(): Promise<boolean> {
        try {
            const endpoint = `/APIProxies?$top=1`;
            await this.managementRequest(endpoint);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Create SAP APIM client from tenant credentials
 */
export function createSAPAPIMClient(credentials: SAPAPIMCredentials): SAPAPIMClient {
    return new SAPAPIMClient(credentials);
}
