"use server";

import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import { users, tenantMembers, cpiTenants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { ActionResult } from "@/types/actions";
import { getCachedToken, cacheToken } from "@/lib/token-cache";
import { decrypt } from "@/lib/encryption";
import {
    createSAPAPIMClient,
    type APIProduct,
    type APIProxy,
} from "@/lib/sap-cpi/apim-client";
import { APIM_NOT_CONFIGURED } from "./api-products-errors";

// ============================================================================
// Types
// ============================================================================

export interface APIProductListItem {
    name: string;
    title: string;
    description?: string;
    status: string;
    scope?: string;
    quota?: number;
    quotaInterval?: number;
    quotaTimeUnit?: string;
    modifiedAt?: string;
    createdAt?: string;
    tenantId: string;
    tenantName: string;
}

export interface GetAPIProductsParams {
    tenantId?: string;
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string; // "all" | "PUBLISHED" | "DEPRECATED" | "RETIRED" etc.
}

export interface GetAPIProductsResult {
    products: APIProductListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    fetchedAt: string;
}

export interface APIProxyInfo {
    name: string;
    title: string;
    description?: string;
    basePath: string;
    state: string; // DEPLOYED, UNDEPLOYED
    serviceEndPoint?: string;
    version?: string;
    modifiedAt?: string;
}

export interface APIProductDetailResult {
    product: APIProductListItem;
    proxies: APIProxyInfo[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get OAuth token for APIM (same credentials as CPI)
 */
async function getAPIMToken(
    authenticationUrl: string,
    clientId: string,
    clientSecret: string
): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const params = new URLSearchParams({
            grant_type: "client_credentials",
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
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error("OAuth token request timed out after 30 seconds");
        }
        throw error;
    }
}

/**
 * Resolve the tenant ID — use provided, fallback to default, then first accessible
 */
async function resolveTenantId(
    userId: string,
    providedTenantId?: string
): Promise<string | undefined> {
    if (providedTenantId) return providedTenantId;

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { defaultTenantId: true },
    });
    if (user?.defaultTenantId) return user.defaultTenantId;

    const firstMembership = await db.query.tenantMembers.findFirst({
        where: eq(tenantMembers.userId, userId),
        columns: { tenantId: true },
        orderBy: (tenantMembers, { asc }) => [asc(tenantMembers.joinedAt)],
    });
    return firstMembership?.tenantId;
}

/**
 * Get tenant and validate access. Validates APIM-specific credentials when configured
 * separately; falls back to validating CPI credentials otherwise.
 */
async function getTenantWithAccess(tenantId: string, userId: string) {
    const tenant = await db.query.cpiTenants.findFirst({
        where: eq(cpiTenants.id, tenantId),
    });

    if (!tenant) {
        return { error: "Tenant not found", tenant: null };
    }

    const membership = await db.query.tenantMembers.findFirst({
        where: and(
            eq(tenantMembers.userId, userId),
            eq(tenantMembers.tenantId, tenantId)
        ),
    });

    if (!membership) {
        return { error: "You don't have access to this tenant", tenant: null };
    }

    if (tenant.apimAuthType === "OAUTH") {
        if (!tenant.apimClientId || !tenant.apimClientSecret) {
            return { error: "APIM OAuth credentials not fully configured for this tenant", tenant: null };
        }
        if (!tenant.tokenUrl && !tenant.authenticationUrl) {
            return { error: "APIM Token URL not configured for this tenant", tenant: null };
        }
    } else if (tenant.apimAuthType === "BASIC_AUTH") {
        if (!tenant.apimUsername || !tenant.apimPassword) {
            return { error: "APIM Basic Auth credentials not configured for this tenant", tenant: null };
        }
    } else {
        // No separate APIM creds — fall back to CPI credentials
        if (tenant.authType === "OAUTH" && (!tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret)) {
            return { error: "OAuth credentials not configured for this tenant", tenant: null };
        }
        if (tenant.authType === "BASIC_AUTH" && (!tenant.username || !tenant.password)) {
            return { error: "Basic Auth credentials not configured for this tenant", tenant: null };
        }
        if (tenant.authType !== "OAUTH" && tenant.authType !== "BASIC_AUTH") {
            return { error: "Unsupported authentication type", tenant: null };
        }
    }

    return { error: null, tenant };
}

type TenantRow = NonNullable<Awaited<ReturnType<typeof db.query.cpiTenants.findFirst>>>;

/**
 * Returns a structured error result if APIM is not configured for this
 * tenant, otherwise null. APIM is considered configured when an APIM URL
 * has been provided (the dedicated SAP API Management runtime URL — without
 * it, every call falls through to the CPI URL and returns 404).
 */
function assertAPIMConfigured(
    tenant: TenantRow,
): { success: false; error: string; code: string } | null {
    if (!tenant.apimUrl || tenant.apimUrl.trim() === "") {
        return {
            success: false,
            error:
                "SAP API Management is not configured for this tenant. Add the APIM runtime URL and credentials in Settings to view APIs.",
            code: APIM_NOT_CONFIGURED,
        };
    }
    return null;
}

/**
 * Translate raw SAP APIM HTTP errors into user-friendly messages. The raw
 * error from `apim-client` looks like `SAP APIM API error (404): Not Found`
 * which is too low-level to show end users.
 */
function friendlyAPIMError(err: unknown, fallback: string): string {
    const message = err instanceof Error ? err.message : String(err);
    if (/\(404\)/.test(message)) {
        return "SAP API Management endpoint not found. Verify the APIM URL in Settings is correct.";
    }
    if (/\(401\)|\(403\)/.test(message)) {
        return "SAP API Management rejected the credentials. Verify the APIM credentials in Settings.";
    }
    if (/(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|fetch failed)/i.test(message)) {
        return "Could not reach SAP API Management. Check the APIM URL and your network connection.";
    }
    if (/\(5\d{2}\)/.test(message)) {
        return "SAP API Management is temporarily unavailable. Please try again in a moment.";
    }
    return fallback;
}

/**
 * Build APIM auth header. Uses APIM-specific credentials when configured,
 * falls back to CPI credentials. Token cache key is "{tenantId}-apim".
 */
async function getAuthHeader(tenant: TenantRow): Promise<string> {
    const effectiveAuthType = tenant.apimAuthType || tenant.authType;
    const cacheKey = `${tenant.id}-apim`;

    if (effectiveAuthType === "BASIC_AUTH") {
        const uname = tenant.apimAuthType ? tenant.apimUsername : tenant.username;
        const pwd = tenant.apimAuthType ? tenant.apimPassword : tenant.password;
        let password: string;
        try { password = await decrypt(pwd!); } catch { password = pwd!; }
        return `Basic ${Buffer.from(`${uname}:${password}`).toString("base64")}`;
    }

    // OAUTH
    const clientId = tenant.apimAuthType ? tenant.apimClientId : tenant.clientId;
    const clientSecret = tenant.apimAuthType ? tenant.apimClientSecret : tenant.clientSecret;
    const apimTokenUrl = tenant.tokenUrl || tenant.authenticationUrl;

    let accessToken = getCachedToken(cacheKey);
    if (!accessToken) {
        const decryptedSecret = await decrypt(clientSecret!);
        accessToken = await getAPIMToken(apimTokenUrl!, clientId!, decryptedSecret);
        cacheToken(cacheKey, accessToken);
    }
    return `Bearer ${accessToken}`;
}

/**
 * Build the credentials object for createSAPAPIMClient.
 * Uses APIM-specific credentials when configured, falls back to CPI credentials.
 */
function buildAPIMClientConfig(tenant: TenantRow) {
    const baseUrl = tenant.apimUrl || tenant.tenantUrl;
    const effectiveAuthType = (tenant.apimAuthType || tenant.authType) as "OAUTH" | "BASIC_AUTH";

    if (effectiveAuthType === "BASIC_AUTH") {
        return {
            tenantUrl: baseUrl,
            authType: "BASIC_AUTH" as const,
            username: (tenant.apimAuthType ? tenant.apimUsername : tenant.username)!,
            password: (tenant.apimAuthType ? tenant.apimPassword : tenant.password)!,
        };
    }
    return {
        tenantUrl: baseUrl,
        authType: "OAUTH" as const,
        clientId: (tenant.apimAuthType ? tenant.apimClientId : tenant.clientId)!,
        clientSecret: (tenant.apimAuthType ? tenant.apimClientSecret : tenant.clientSecret)!,
        tokenUrl: (tenant.tokenUrl || tenant.authenticationUrl)!,
    };
}

/**
 * Transform APIProduct from client to APIProductListItem with tenant info
 */
function transformProduct(
    product: APIProduct,
    tenantId: string,
    tenantName: string
): APIProductListItem {
    return {
        name: product.name,
        title: product.title,
        description: product.description,
        status: product.status,
        scope: product.scope,
        quota: product.quota,
        quotaInterval: product.quotaInterval,
        quotaTimeUnit: product.quotaTimeUnit,
        modifiedAt: product.modifiedAt,
        createdAt: product.createdAt,
        tenantId,
        tenantName,
    };
}

/**
 * Transform APIProxy from client to APIProxyInfo
 */
function transformProxy(proxy: APIProxy): APIProxyInfo {
    return {
        name: proxy.name,
        title: proxy.title,
        description: proxy.description,
        basePath: proxy.basePath,
        state: proxy.state,
        serviceEndPoint: proxy.serviceEndPoint,
        version: proxy.version,
        modifiedAt: proxy.modifiedAt,
    };
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Get all API Products for the selected tenant with filtering and pagination
 */
export async function getAPIProducts(
    params: GetAPIProductsParams
): Promise<ActionResult<GetAPIProductsResult>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const {
            tenantId: providedTenantId,
            page = 1,
            pageSize = 52,
            search,
            status,
        } = params;

        const tenantId = await resolveTenantId(currentUser.id, providedTenantId);

        if (!tenantId) {
            return { success: false, error: "No tenant available. Please configure a tenant in Settings." };
        }

        const { error, tenant } = await getTenantWithAccess(tenantId, currentUser.id);

        if (error || !tenant) {
            return { success: false, error: error || "Tenant not found" };
        }

        const notConfigured = assertAPIMConfigured(tenant);
        if (notConfigured) return notConfigured;

        const authHeader = await getAuthHeader(tenant);
        const client = createSAPAPIMClient(buildAPIMClientConfig(tenant));
        const effectiveAuthType = tenant.apimAuthType || tenant.authType;
        if (effectiveAuthType === "OAUTH") {
            const token = authHeader.replace("Bearer ", "");
            (client as any).accessToken = token;
            (client as any).tokenExpiry = Date.now() + 3600000;
        }

        const skip = (page - 1) * pageSize;

        const result = await client.getAPIProducts({
            search: search || undefined,
            status: status && status !== "all" ? status : undefined,
            top: pageSize,
            skip,
        });

        const products = result.results.map((p) =>
            transformProduct(p, tenant.id, tenant.name)
        );

        const total = result.count ?? products.length;
        const totalPages = Math.ceil(total / pageSize);

        return {
            success: true,
            data: {
                products,
                total,
                page,
                pageSize,
                totalPages,
                fetchedAt: new Date().toISOString(),
            },
        };
    } catch (error) {
        console.error(
            `[getAPIProducts] Error: ${error instanceof Error ? error.message : String(error)}`,
        );
        return {
            success: false,
            error: friendlyAPIMError(error, "Failed to fetch API Products"),
        };
    }
}

/**
 * Get a single API Product with its associated API Proxies
 */
export async function getAPIProductDetail(
    productName: string,
    tenantId?: string
): Promise<ActionResult<APIProductDetailResult>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        if (!productName) {
            return { success: false, error: "Product name is required" };
        }

        const resolvedTenantId = await resolveTenantId(currentUser.id, tenantId);

        if (!resolvedTenantId) {
            return { success: false, error: "No tenant available. Please configure a tenant in Settings." };
        }

        const { error, tenant } = await getTenantWithAccess(resolvedTenantId, currentUser.id);

        if (error || !tenant) {
            return { success: false, error: error || "Tenant not found" };
        }

        const notConfigured = assertAPIMConfigured(tenant);
        if (notConfigured) return notConfigured;

        const authHeader2 = await getAuthHeader(tenant);
        const client = createSAPAPIMClient(buildAPIMClientConfig(tenant));
        const effectiveAuthType2 = tenant.apimAuthType || tenant.authType;
        if (effectiveAuthType2 === "OAUTH") {
            const token = authHeader2.replace("Bearer ", "");
            (client as any).accessToken = token;
            (client as any).tokenExpiry = Date.now() + 3600000;
        }

        // Try to get product with proxies expanded in one call
        const product = await client.getAPIProductWithProxies(productName);

        if (!product) {
            return { success: false, error: `API Product "${productName}" not found` };
        }

        // If $expand worked, use the embedded proxies; otherwise fetch separately
        let proxies: APIProxyInfo[];
        if (product.apiProxies && product.apiProxies.length > 0) {
            proxies = product.apiProxies.map(transformProxy);
        } else {
            // Fallback: fetch proxies via navigation property link
            const rawProxies = await client.getAPIProductProxies(productName);
            proxies = rawProxies.map(transformProxy);
        }

        return {
            success: true,
            data: {
                product: transformProduct(product, tenant.id, tenant.name),
                proxies,
            },
        };
    } catch (error) {
        console.error(
            `[getAPIProductDetail] Error: ${error instanceof Error ? error.message : String(error)}`,
        );
        return {
            success: false,
            error: friendlyAPIMError(error, "Failed to fetch API Product details"),
        };
    }
}

/**
 * Get API Proxies for a specific API Product (standalone action)
 */
export async function getAPIProductProxies(
    productName: string,
    tenantId?: string
): Promise<ActionResult<{ proxies: APIProxyInfo[] }>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const resolvedTenantId = await resolveTenantId(currentUser.id, tenantId);

        if (!resolvedTenantId) {
            return { success: false, error: "No tenant available" };
        }

        const { error, tenant } = await getTenantWithAccess(resolvedTenantId, currentUser.id);

        if (error || !tenant) {
            return { success: false, error: error || "Tenant not found" };
        }

        const notConfigured = assertAPIMConfigured(tenant);
        if (notConfigured) return notConfigured;

        const authHeader3 = await getAuthHeader(tenant);
        const client = createSAPAPIMClient(buildAPIMClientConfig(tenant));
        const effectiveAuthType3 = tenant.apimAuthType || tenant.authType;
        if (effectiveAuthType3 === "OAUTH") {
            const token = authHeader3.replace("Bearer ", "");
            (client as any).accessToken = token;
            (client as any).tokenExpiry = Date.now() + 3600000;
        }

        const rawProxies = await client.getAPIProductProxies(productName);
        const proxies = rawProxies.map(transformProxy);

        return { success: true, data: { proxies } };
    } catch (error) {
        console.error(
            `[getAPIProductProxies] Error: ${error instanceof Error ? error.message : String(error)}`,
        );
        return {
            success: false,
            error: friendlyAPIMError(error, "Failed to fetch API Product proxies"),
        };
    }
}
