"use server";

/**
 * APIM Diagnostics Action
 *
 * Probes the SAP APIM endpoints to discover which analytics paths
 * are available on this specific CF Integration Suite tenant.
 *
 * Use this during development to find the correct endpoint paths.
 * Access via: POST /api/apim-diagnostics (or call directly from a test page)
 */

import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import { users, tenantMembers, cpiTenants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { ActionResult } from "@/types/actions";
import { getCachedToken, cacheToken } from "@/lib/token-cache";
import { decrypt } from "@/lib/encryption";

interface EndpointProbeResult {
    url: string;
    status: number;
    ok: boolean;
    contentType?: string;
    bodyPreview?: string;
    error?: string;
}

interface APIMDiagnosticsResult {
    tenantUrl: string;
    probeResults: EndpointProbeResult[];
    recommendation: string;
}

/**
 * Probe all known APIM endpoint patterns to find which ones work
 * on this specific SAP Integration Suite CF tenant.
 */
export async function probeAPIMEndpoints(
    tenantId?: string
): Promise<ActionResult<APIMDiagnosticsResult>> {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        // Resolve tenant
        let resolvedTenantId = tenantId;
        if (!resolvedTenantId) {
            const user = await db.query.users.findFirst({
                where: eq(users.id, currentUser.id),
                columns: { defaultTenantId: true },
            });
            resolvedTenantId = user?.defaultTenantId || undefined;
        }

        if (!resolvedTenantId) {
            return { success: false, error: "No tenant available" };
        }

        const tenant = await db.query.cpiTenants.findFirst({
            where: eq(cpiTenants.id, resolvedTenantId),
        });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        const membership = await db.query.tenantMembers.findFirst({
            where: and(
                eq(tenantMembers.userId, currentUser.id),
                eq(tenantMembers.tenantId, resolvedTenantId)
            ),
        });

        if (!membership) {
            return { success: false, error: "Access denied" };
        }

        // Build auth header based on authType (APIM-specific credentials take precedence)
        let authHeader: string;
        const effectiveAuthType = tenant.apimAuthType || tenant.authType;

        if (tenant.apimAuthType === "OAUTH") {
            const apimTokenUrl = tenant.tokenUrl || tenant.authenticationUrl;
            if (!apimTokenUrl || !tenant.apimClientId || !tenant.apimClientSecret) {
                return { success: false, error: "APIM OAuth credentials not configured" };
            }
            let accessToken = getCachedToken(`${tenant.id}-apim`);
            if (!accessToken) {
                const decryptedSecret = await decrypt(tenant.apimClientSecret);
                const params = new URLSearchParams({
                    grant_type: "client_credentials",
                    client_id: tenant.apimClientId,
                    client_secret: decryptedSecret,
                });
                const tokenResponse = await fetch(apimTokenUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: params.toString(),
                });
                if (!tokenResponse.ok) {
                    return { success: false, error: "Failed to get APIM OAuth token" };
                }
                const tokenData = await tokenResponse.json();
                accessToken = tokenData.access_token as string;
                cacheToken(`${tenant.id}-apim`, accessToken);
            }
            authHeader = `Bearer ${accessToken}`;
        } else if (tenant.apimAuthType === "BASIC_AUTH") {
            if (!tenant.apimUsername || !tenant.apimPassword) {
                return { success: false, error: "APIM Basic Auth credentials not configured" };
            }
            let password: string;
            try { password = await decrypt(tenant.apimPassword); } catch { password = tenant.apimPassword; }
            authHeader = `Basic ${Buffer.from(`${tenant.apimUsername}:${password}`).toString("base64")}`;
        } else if (effectiveAuthType === "OAUTH") {
            // Fall back to CPI credentials
            const apimTokenUrl = tenant.tokenUrl || tenant.authenticationUrl;
            if (!apimTokenUrl || !tenant.clientId || !tenant.clientSecret) {
                return { success: false, error: "OAuth credentials not configured" };
            }
            let accessToken = getCachedToken(`${tenant.id}-apim`);
            if (!accessToken) {
                const decryptedSecret = await decrypt(tenant.clientSecret);
                const params = new URLSearchParams({
                    grant_type: "client_credentials",
                    client_id: tenant.clientId,
                    client_secret: decryptedSecret,
                });
                const tokenResponse = await fetch(apimTokenUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: params.toString(),
                });
                if (!tokenResponse.ok) {
                    return { success: false, error: "Failed to get OAuth token" };
                }
                const tokenData = await tokenResponse.json();
                accessToken = tokenData.access_token as string;
                cacheToken(`${tenant.id}-apim`, accessToken);
            }
            authHeader = `Bearer ${accessToken}`;
        } else if (effectiveAuthType === "BASIC_AUTH") {
            if (!tenant.username || !tenant.password) {
                return { success: false, error: "Basic Auth credentials not configured" };
            }
            let password: string;
            try { password = await decrypt(tenant.password); } catch { password = tenant.password; }
            authHeader = `Basic ${Buffer.from(`${tenant.username}:${password}`).toString("base64")}`;
        } else {
            return { success: false, error: "Unsupported authentication type" };
        }

        const baseUrl = (tenant.apimUrl || tenant.tenantUrl).replace(/\/$/, "");

        // All known APIM endpoint patterns for CF Integration Suite
        const endpointsToProbe = [
            // Management API (should work)
            `${baseUrl}/apiportal/api/1.0/Management.svc/APIProxies?$top=1&$format=json`,
            `${baseUrl}/apiportal/api/1.0/Management.svc/APIProducts?$top=1&$format=json`,

            // Analytics API variants
            `${baseUrl}/apiportal/api/1.0/Analytics.svc/`,
            `${baseUrl}/apiportal/api/1.0/Analytics.svc/APIProxyTrafficData?$top=1&$format=json`,
            `${baseUrl}/apiportal/api/1.0/Analytics.svc/APIProxyPerformance?$top=1&$format=json`,
            `${baseUrl}/apiportal/api/1.0/Analytics.svc/APIProxyErrorDetails?$top=1&$format=json`,

            // Alternative paths used in some CF tenants
            `${baseUrl}/apim-devportal/api/1.0/Analytics.svc/`,
            `${baseUrl}/apim-devportal/api/1.0/Analytics.svc/APIProxyTrafficData?$top=1&$format=json`,

            // Integration Suite specific paths
            `${baseUrl}/api/1.0/Analytics.svc/`,
            `${baseUrl}/apiportal/api/1.0/`,

            // Message processing logs via APIM (some tenants expose this)
            `${baseUrl}/apiportal/api/1.0/Management.svc/APIProxyEndPoints?$top=1&$format=json`,
            `${baseUrl}/apiportal/api/1.0/Management.svc/Applications?$top=1&$format=json`,
        ];

        const probeResults: EndpointProbeResult[] = [];

        for (const url of endpointsToProbe) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(url, {
                    headers: { Authorization: authHeader, Accept: "application/json" },
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                let bodyPreview: string | undefined;
                try {
                    const text = await response.text();
                    bodyPreview = text.substring(0, 300);
                } catch {
                    bodyPreview = "(could not read body)";
                }

                probeResults.push({
                    url,
                    status: response.status,
                    ok: response.ok,
                    contentType: response.headers.get("content-type") || undefined,
                    bodyPreview,
                });
            } catch (err) {
                probeResults.push({
                    url,
                    status: 0,
                    ok: false,
                    error: err instanceof Error ? err.message : "Unknown error",
                });
            }
        }

        // Generate recommendation based on results
        const workingEndpoints = probeResults.filter((r) => r.ok);
        const analyticsWorking = workingEndpoints.filter((r) =>
            r.url.includes("Analytics")
        );

        let recommendation: string;
        if (analyticsWorking.length > 0) {
            recommendation = `Analytics API is available at: ${analyticsWorking[0].url.split("?")[0]}`;
        } else if (workingEndpoints.some((r) => r.url.includes("Management.svc/APIProxies"))) {
            recommendation =
                "Management API works (proxy list available) but Analytics API is NOT accessible. " +
                "This is common on CF Integration Suite — the Analytics service requires a separate " +
                "service binding or is only accessible via the Integration Suite UI. " +
                "The APIM tab will show proxy metadata but not call-level logs.";
        } else {
            recommendation =
                "No APIM endpoints are accessible. Check that: " +
                "1) APIM is enabled on this Integration Suite tenant, " +
                "2) The OAuth client has the APIPortal.Administrator or APIPortal.Read scope, " +
                "3) The tenant URL is correct.";
        }

        return {
            success: true,
            data: {
                tenantUrl: baseUrl,
                probeResults,
                recommendation,
            },
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Diagnostics failed",
        };
    }
}
