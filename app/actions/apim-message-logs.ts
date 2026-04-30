"use server";

import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import { users, tenantMembers, cpiTenants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { ActionResult } from "@/types/actions";
import { getCachedToken, cacheToken } from "@/lib/token-cache";
import { decrypt } from "@/lib/encryption";
import { runText } from "@/lib/ai/runtime/text";
import {
  createSAPAPIMClient,
  type APIMCallLog,
  type APIProxy,
  type APIMProxyPerformance,
} from "@/lib/sap-cpi/apim-client";

// ============================================================================
// Types
// ============================================================================

export interface GlobalAPIMLog {
  id: string;
  apiProxyName: string;
  apiProxyPath?: string;
  method: string;
  statusCode: number;
  statusCategory: "2xx" | "3xx" | "4xx" | "5xx" | "unknown";
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
  // Tenant info
  tenantId: string;
  tenantName: string;
}

export interface GetAPIMMessageLogsParams {
  tenantId?: string;
  page?: number;
  pageSize?: number;
  proxyName?: string;
  statusCategory?: string; // "all" | "2xx" | "3xx" | "4xx" | "5xx" | "error"
  method?: string; // "all" | "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  fromDate?: string; // ISO string
  toDate?: string; // ISO string
  searchQuery?: string;
}

export interface GetAPIMMessageLogsResult {
  logs: GlobalAPIMLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  fetchedAt: string;
  /** Whether the Analytics.svc is accessible and returned data */
  analyticsAvailable: boolean;
  /** Human-readable reason when analyticsAvailable is false */
  analyticsWarning?: string;
}

export interface APIMLogDetailResult {
  log: GlobalAPIMLog;
  proxyDetails: APIProxy | null;
  performanceContext: APIMProxyPerformance | null;
}

export interface APIProxyInfo {
  name: string;
  title: string;
  state: string;
  basePath: string;
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
  clientSecret: string,
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
      throw new Error(
        `Failed to get OAuth token: ${response.status} - ${errorText}`,
      );
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
 * Determine status category from HTTP status code
 */
function getStatusCategory(
  statusCode: number,
): GlobalAPIMLog["statusCategory"] {
  if (statusCode >= 200 && statusCode < 300) return "2xx";
  if (statusCode >= 300 && statusCode < 400) return "3xx";
  if (statusCode >= 400 && statusCode < 500) return "4xx";
  if (statusCode >= 500) return "5xx";
  return "unknown";
}

/**
 * Transform APIM call log to our format
 */
function transformAPIMLog(
  log: APIMCallLog,
  tenantId: string,
  tenantName: string,
): GlobalAPIMLog {
  return {
    id: log.id,
    apiProxyName: log.apiProxyName,
    apiProxyPath: log.apiProxyPath,
    method: log.method,
    statusCode: log.statusCode,
    statusCategory: getStatusCategory(log.statusCode),
    responseTime: log.responseTime,
    requestSize: log.requestSize,
    responseSize: log.responseSize,
    clientIP: log.clientIP,
    timestamp: log.timestamp,
    targetHost: log.targetHost,
    errorMessage: log.errorMessage,
    isError: log.isError,
    developerApp: log.developerApp,
    apiProduct: log.apiProduct,
    proxyRevision: log.proxyRevision,
    region: log.region,
    faultCode: log.faultCode,
    faultSource: log.faultSource,
    tenantId,
    tenantName,
  };
}

/**
 * Resolve the tenant ID - use provided, fallback to default, then first accessible
 */
async function resolveTenantId(
  userId: string,
  providedTenantId?: string,
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
 * Get tenant and validate access, returning the tenant record.
 * Validates APIM-specific credentials when configured separately;
 * falls back to validating CPI credentials otherwise.
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
      eq(tenantMembers.tenantId, tenantId),
    ),
  });

  if (!membership) {
    return { error: "You don't have access to this tenant", tenant: null };
  }

  if (tenant.apimAuthType === "OAUTH") {
    if (!tenant.apimClientId || !tenant.apimClientSecret) {
      return {
        error: "APIM OAuth credentials not fully configured for this tenant",
        tenant: null,
      };
    }
    if (!tenant.tokenUrl && !tenant.authenticationUrl) {
      return {
        error: "APIM Token URL not configured for this tenant",
        tenant: null,
      };
    }
  } else if (tenant.apimAuthType === "BASIC_AUTH") {
    if (!tenant.apimUsername || !tenant.apimPassword) {
      return {
        error: "APIM Basic Auth credentials not configured for this tenant",
        tenant: null,
      };
    }
  } else {
    // No separate APIM creds — fall back to CPI credentials
    if (
      tenant.authType === "OAUTH" &&
      (!tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret)
    ) {
      return {
        error: "OAuth credentials not configured for this tenant",
        tenant: null,
      };
    }
    if (
      tenant.authType === "BASIC_AUTH" &&
      (!tenant.username || !tenant.password)
    ) {
      return {
        error: "Basic Auth credentials not configured for this tenant",
        tenant: null,
      };
    }
    if (tenant.authType !== "OAUTH" && tenant.authType !== "BASIC_AUTH") {
      return { error: "Unsupported authentication type", tenant: null };
    }
  }

  return { error: null, tenant };
}

type TenantRow = NonNullable<
  Awaited<ReturnType<typeof db.query.cpiTenants.findFirst>>
>;

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
    try {
      password = await decrypt(pwd!);
    } catch {
      password = pwd!;
    }
    return `Basic ${Buffer.from(`${uname}:${password}`).toString("base64")}`;
  }

  // OAUTH
  const clientId = tenant.apimAuthType ? tenant.apimClientId : tenant.clientId;
  const clientSecret = tenant.apimAuthType
    ? tenant.apimClientSecret
    : tenant.clientSecret;
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
  const effectiveAuthType = (tenant.apimAuthType || tenant.authType) as
    | "OAUTH"
    | "BASIC_AUTH";

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
    clientSecret: (tenant.apimAuthType
      ? tenant.apimClientSecret
      : tenant.clientSecret)!,
    tokenUrl: (tenant.tokenUrl || tenant.authenticationUrl)!,
  };
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Get all APIM message logs for the selected tenant with filtering
 */
export async function getApimMessageLogs(
  params: GetAPIMMessageLogsParams,
): Promise<ActionResult<GetAPIMMessageLogsResult>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const {
      tenantId: providedTenantId,
      page = 1,
      pageSize = 50,
      proxyName,
      statusCategory,
      method,
      fromDate,
      toDate,
      searchQuery,
    } = params;

    const tenantId = await resolveTenantId(currentUser.id, providedTenantId);

    if (!tenantId) {
      return { success: false, error: "No tenant available" };
    }

    const { error, tenant } = await getTenantWithAccess(
      tenantId,
      currentUser.id,
    );

    if (error || !tenant) {
      return { success: false, error: error || "Tenant not found" };
    }

    const authHeader = await getAuthHeader(tenant);
    const client = createSAPAPIMClient(buildAPIMClientConfig(tenant));
    const effectiveAuthType = tenant.apimAuthType || tenant.authType;
    if (effectiveAuthType === "OAUTH") {
      const token = authHeader.replace("Bearer ", "");
      (client as any).accessToken = token;
      (client as any).tokenExpiry = Date.now() + 3600000;
    }

    // Build filter params
    const filterParams: Parameters<typeof client.getAPIProxyCallLogs>[0] = {
      top: pageSize,
      skip: (page - 1) * pageSize,
    };

    if (proxyName && proxyName !== "all") {
      filterParams.proxyName = proxyName;
    }

    if (fromDate) {
      filterParams.fromDate = new Date(fromDate);
    }

    if (toDate) {
      filterParams.toDate = new Date(toDate);
    }

    // Map status category to isError filter
    if (
      statusCategory === "error" ||
      statusCategory === "4xx" ||
      statusCategory === "5xx"
    ) {
      filterParams.isError = true;
    }

    // Fetch logs
    const response = await client.getAPIProxyCallLogs(filterParams);

    let results = response.results;

    // Client-side filtering for method (APIM API may not support method filter)
    if (method && method !== "all") {
      results = results.filter(
        (log) => log.method.toUpperCase() === method.toUpperCase(),
      );
    }

    // Client-side filtering for status category
    if (
      statusCategory &&
      statusCategory !== "all" &&
      statusCategory !== "error"
    ) {
      results = results.filter((log) => {
        const category = getStatusCategory(log.statusCode);
        return category === statusCategory;
      });
    }

    // Client-side search filtering
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        (log) =>
          log.apiProxyName.toLowerCase().includes(query) ||
          log.clientIP?.toLowerCase().includes(query) ||
          log.errorMessage?.toLowerCase().includes(query) ||
          log.developerApp?.toLowerCase().includes(query) ||
          log.apiProduct?.toLowerCase().includes(query),
      );
    }

    const transformedLogs = results.map((log) =>
      transformAPIMLog(log, tenant.id, tenant.name),
    );

    const total = response.count || transformedLogs.length;

    return {
      success: true,
      data: {
        logs: transformedLogs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        fetchedAt: new Date().toISOString(),
        analyticsAvailable: response.analyticsAvailable,
        analyticsWarning: response.warning,
      },
    };
  } catch (error) {
    console.error("Error fetching APIM message logs:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch APIM message logs",
    };
  }
}

/**
 * Get detailed information for a specific APIM log entry
 */
export async function getApimLogDetail(
  providedTenantId: string | undefined,
  logId: string,
  proxyName: string,
): Promise<ActionResult<APIMLogDetailResult>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const tenantId = await resolveTenantId(currentUser.id, providedTenantId);

    if (!tenantId) {
      return { success: false, error: "No tenant available" };
    }

    const { error, tenant } = await getTenantWithAccess(
      tenantId,
      currentUser.id,
    );

    if (error || !tenant) {
      return { success: false, error: error || "Tenant not found" };
    }

    const authHeader = await getAuthHeader(tenant);
    const client = createSAPAPIMClient(buildAPIMClientConfig(tenant));
    const effectiveAuthType2 = tenant.apimAuthType || tenant.authType;
    if (effectiveAuthType2 === "OAUTH") {
      const token = authHeader.replace("Bearer ", "");
      (client as any).accessToken = token;
      (client as any).tokenExpiry = Date.now() + 3600000;
    }

    // Fetch proxy details and performance in parallel
    const [proxyDetails, performanceData] = await Promise.all([
      client.getAPIProxyDetails(proxyName).catch(() => null),
      client
        .getAPIProxyPerformance({
          proxyName,
          fromDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24h
          toDate: new Date(),
        })
        .catch(() => []),
    ]);

    // Find the specific log entry by fetching recent logs for this proxy
    const logsResult = await client.getAPIProxyCallLogs({
      proxyName,
      top: 100,
    });

    const logEntry = logsResult.results.find((l) => l.id === logId);

    if (!logEntry) {
      // If we can't find the exact log, create a minimal one from the ID
      return {
        success: false,
        error:
          "Log entry not found. It may have expired from the APIM analytics retention window.",
      };
    }

    const transformedLog = transformAPIMLog(logEntry, tenant.id, tenant.name);
    const performanceContext =
      performanceData.length > 0 ? performanceData[0] : null;

    return {
      success: true,
      data: {
        log: transformedLog,
        proxyDetails,
        performanceContext,
      },
    };
  } catch (error) {
    console.error("Error fetching APIM log detail:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch APIM log details",
    };
  }
}

/**
 * Get available API proxies for filter dropdown
 */
export async function getApiProxiesForFilter(
  tenantId?: string,
): Promise<ActionResult<APIProxyInfo[]>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const resolvedTenantId = await resolveTenantId(currentUser.id, tenantId);

    if (!resolvedTenantId) {
      return { success: false, error: "No tenant available" };
    }

    const { error, tenant } = await getTenantWithAccess(
      resolvedTenantId,
      currentUser.id,
    );

    if (error || !tenant) {
      return { success: false, error: error || "Tenant not found" };
    }

    const authHeader2 = await getAuthHeader(tenant);
    const client = createSAPAPIMClient(buildAPIMClientConfig(tenant));
    const effectiveAuthType3 = tenant.apimAuthType || tenant.authType;
    if (effectiveAuthType3 === "OAUTH") {
      const token = authHeader2.replace("Bearer ", "");
      (client as any).accessToken = token;
      (client as any).tokenExpiry = Date.now() + 3600000;
    }

    const response = await client.getAPIProxies({ top: 200 });

    const result: APIProxyInfo[] = response.results.map((proxy) => ({
      name: proxy.name,
      title: proxy.title,
      state: proxy.state,
      basePath: proxy.basePath,
    }));

    return { success: true, data: result };
  } catch (error) {
    console.error("Error fetching API proxies for filter:", error);
    return { success: false, error: "Failed to fetch API proxies" };
  }
}

/**
 * Check if APIM is available for the given tenant
 */
export async function checkApimAvailability(
  tenantId?: string,
): Promise<ActionResult<{ available: boolean }>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const resolvedTenantId = await resolveTenantId(currentUser.id, tenantId);

    if (!resolvedTenantId) {
      return { success: true, data: { available: false } };
    }

    const { error, tenant } = await getTenantWithAccess(
      resolvedTenantId,
      currentUser.id,
    );

    if (error || !tenant) {
      return { success: true, data: { available: false } };
    }

    const authHeader3 = await getAuthHeader(tenant);
    const client = createSAPAPIMClient(buildAPIMClientConfig(tenant));
    const effectiveAuthType4 = tenant.apimAuthType || tenant.authType;
    if (effectiveAuthType4 === "OAUTH") {
      const token = authHeader3.replace("Bearer ", "");
      (client as any).accessToken = token;
      (client as any).tokenExpiry = Date.now() + 3600000;
    }

    const available = await client.isAPIMAvailable();

    return { success: true, data: { available } };
  } catch (error) {
    console.error("Error checking APIM availability:", error);
    return { success: true, data: { available: false } };
  }
}

/**
 * Diagnose APIM error using AI
 */
export async function diagnoseApimError(
  tenantId: string,
  logId: string,
  proxyName: string,
  statusCode: number,
  errorMessage?: string | null,
  faultCode?: string,
  faultSource?: string,
): Promise<ActionResult<{ diagnosis: string }>> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const { error, tenant } = await getTenantWithAccess(
      tenantId,
      currentUser.id,
    );

    if (error || !tenant) {
      return { success: false, error: error || "Tenant not found" };
    }

    if (!errorMessage && !faultCode) {
      return {
        success: false,
        error: "No error details found for this API call",
      };
    }

    const errorDetails = [
      `API Proxy: ${proxyName}`,
      `HTTP Status Code: ${statusCode}`,
      faultCode ? `Fault Code: ${faultCode}` : null,
      faultSource ? `Fault Source: ${faultSource}` : null,
      errorMessage ? `Error Message: ${errorMessage}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `You are an SAP API Management (APIM) expert. Analyze the following error from an API proxy call.

${errorDetails}

Respond using EXACTLY these three section headers (do not rename or reorder them):

## What Went Wrong
<brief explanation of the error>

## Root Cause
<the underlying technical root cause>

## Suggested Solutions
<numbered list of actionable steps to resolve the issue>`;

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
      const errorMsg =
        aiError instanceof Error
          ? aiError.message
          : "Failed to generate diagnosis";
      return {
        success: false,
        error: `AI Error: ${errorMsg}. Please check your API key configuration.`,
      };
    }
  } catch (error) {
    console.error("Error diagnosing APIM error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to analyze APIM error",
    };
  }
}
