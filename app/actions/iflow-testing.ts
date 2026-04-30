"use server";

/**
 * Server actions for the iFlow Test runner, Endpoints panel, and Trace tab.
 */

import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import {
  cpiTenants,
  iFlows,
  iFlowTestRuns,
  tenantMembers,
} from "@/lib/db/schema";
import type { ActionResult } from "@/types/actions";
import { encrypt, decrypt } from "@/lib/encryption";
import {
  createSAPCPIClient,
  type LogLevel,
  type LogLevelConfiguration,
  type ServiceEndpointEntity,
  type MessageRunStep,
  type MessageProcessingLog,
} from "@/lib/sap-cpi/client";
import {
  classifyEndpoint,
  invokeIFlowEndpoint,
  redactHeaders,
  resolveRuntimeCredentials,
  InvokeError,
  type EndpointProtocol,
} from "@/lib/sap-cpi/endpoint-invoker";
import {
  detectSchemaKind,
  generateODataPayload,
  generateRestPayload,
  generateSoapEnvelope,
  generateIdocSoapEnvelope,
  parseODataMetadata,
  parseOpenApi,
  parseWsdl,
  type GeneratedPayload,
  type SchemaKind,
} from "@/lib/sap-cpi/schema-tools";

// ============================================================================
// Types exposed to the UI
// ============================================================================

export interface IFlowEndpointSummary {
  id: string; // synthetic = `${url}|${protocol}`
  url: string;
  protocol: EndpointProtocol;
  rawProtocol: string | null;
  callable: boolean;
  uncallableReason: string | null;
  defaultMethod: string;
  apiDefinitions: Array<{ url: string; type: string | null; name: string | null }>;
  /** Best-guess schema kind (UI hint). */
  schemaKind: SchemaKind;
}

export interface EndpointSchema {
  schemaKind: SchemaKind;
  contentType: string;
  body: string;
  /** Parsed metadata returned to the UI for picker dropdowns. */
  meta: {
    soap?: { operations: Array<{ name: string; soapAction: string | null }>; targetNamespace: string };
    odata?: { entitySets: Array<{ name: string; entityType: string }> };
    openapi?: Array<{ method: string; path: string; operationId: string | null }>;
  };
}

export interface IFlowTestRunRecord {
  id: string;
  endpointUrl: string;
  protocol: string;
  httpMethod: string;
  requestHeaders: Record<string, string> | null;
  requestQuery: Record<string, string> | null;
  requestBody: string | null;
  requestContentType: string | null;
  responseStatus: number | null;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  responseContentType: string | null;
  responseTruncated: boolean;
  durationMs: number | null;
  errorMessage: string | null;
  messageGuid: string | null;
  correlationId: string | null;
  applicationMessageId: string | null;
  traceWasEnabled: boolean;
  executedAt: Date;
}

export interface RunIFlowTestInput {
  iFlowDbId: string;
  endpointUrl: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: string;
  contentType?: string;
}

export interface RunIFlowTestOutput {
  runId: string;
  status: number | null;
  durationMs: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  responseContentType: string;
  bodyTruncated: boolean;
  messageGuid: string | null;
  correlationId: string | null;
  applicationMessageId: string;
  errorMessage: string | null;
}

export interface RuntimeCredentialsForm {
  authType: "OAUTH" | "BASIC_AUTH" | "CERTIFICATE" | null;
  tokenUrl?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  username?: string | null;
  password?: string | null;
  /** PEM client certificate (chain). Pass `undefined` to leave existing value. */
  clientCertPem?: string | null;
  /** PEM client private key. Pass `undefined` to leave existing value. */
  clientKeyPem?: string | null;
  /** Optional passphrase for the client key. Pass `undefined` to leave existing value. */
  clientKeyPassphrase?: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

async function loadIFlowAndTenant(iFlowDbId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const iflow = await db.query.iFlows.findFirst({
    where: eq(iFlows.id, iFlowDbId),
  });
  if (!iflow) throw new Error("iFlow not found");

  // Verify the user has access to this tenant.
  const membership = await db.query.tenantMembers.findFirst({
    where: and(
      eq(tenantMembers.tenantId, iflow.tenantId),
      eq(tenantMembers.userId, user.id),
    ),
  });
  if (!membership) throw new Error("You do not have access to this iFlow");

  const tenant = await db.query.cpiTenants.findFirst({
    where: eq(cpiTenants.id, iflow.tenantId),
  });
  if (!tenant) throw new Error("Tenant not found");

  return { user, iflow, tenant, membership };
}

function buildManagementClient(tenant: typeof cpiTenants.$inferSelect) {
  return createSAPCPIClient({
    tenantUrl: tenant.tenantUrl,
    authType: tenant.authType,
    clientId: tenant.clientId ?? undefined,
    clientSecret: tenant.clientSecret ?? undefined,
    tokenUrl: tenant.authenticationUrl ?? undefined,
    username: tenant.username ?? undefined,
    password: tenant.password ?? undefined,
  });
}

function entryPointsToSummaries(
  entities: ServiceEndpointEntity[],
): IFlowEndpointSummary[] {
  const out: IFlowEndpointSummary[] = [];
  for (const entity of entities) {
    const apiDefs = entity.ApiDefinitions?.results ?? [];
    const apiDefinitions = apiDefs.map((d) => ({
      url: d.Url,
      type: d.Type ?? null,
      name: d.Name ?? null,
    }));
    const eps = entity.EntryPoints?.results ?? [];
    if (eps.length === 0) continue;
    for (const ep of eps) {
      const classified = classifyEndpoint({
        protocol: ep.Protocol ?? ep.Type ?? null,
        url: ep.Url,
      });
      const inferredKind: SchemaKind =
        apiDefinitions.find((d) => d.type?.toUpperCase() === "WSDL")
          ? "WSDL"
          : apiDefinitions.find((d) => d.type?.toUpperCase() === "EDMX")
            ? "EDMX"
            : apiDefinitions.find((d) => d.type?.toUpperCase()?.startsWith("OPEN"))
              ? "OPENAPI"
              : "NONE";
      out.push({
        id: `${ep.Url}|${classified.protocol}`,
        url: ep.Url,
        protocol: classified.protocol,
        rawProtocol: ep.Protocol ?? ep.Type ?? null,
        callable: classified.callable,
        uncallableReason: classified.uncallableReason ?? null,
        defaultMethod: classified.defaultMethod,
        apiDefinitions,
        schemaKind: inferredKind,
      });
    }
  }
  return out;
}

// ============================================================================
// Public actions
// ============================================================================

export async function getIFlowEndpoints(
  iFlowDbId: string,
): Promise<ActionResult<IFlowEndpointSummary[]>> {
  try {
    const { iflow, tenant } = await loadIFlowAndTenant(iFlowDbId);
    const client = buildManagementClient(tenant);
    const entities = await client.getServiceEndpoints(iflow.iFlowId);
    return { success: true, data: entryPointsToSummaries(entities) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list endpoints",
    };
  }
}

export async function getEndpointSchema(
  iFlowDbId: string,
  endpointUrl: string,
  apiDefinitionUrl?: string,
): Promise<ActionResult<EndpointSchema | null>> {
  try {
    const { iflow, tenant } = await loadIFlowAndTenant(iFlowDbId);
    const client = buildManagementClient(tenant);

    // Locate api definition for this endpoint
    let defUrl = apiDefinitionUrl ?? null;
    if (!defUrl) {
      const entities = await client.getServiceEndpoints(iflow.iFlowId);
      for (const e of entities) {
        const eps = e.EntryPoints?.results ?? [];
        if (eps.find((ep) => ep.Url === endpointUrl)) {
          defUrl = e.ApiDefinitions?.results?.[0]?.Url ?? null;
          break;
        }
      }
    }
    if (!defUrl) return { success: true, data: null };

    const fetched = await client.fetchEndpointApiDefinition(defUrl);
    if (!fetched) return { success: true, data: null };

    const schemaKind = detectSchemaKind(fetched.contentType, fetched.body);
    const meta: EndpointSchema["meta"] = {};
    if (schemaKind === "WSDL") {
      const w = parseWsdl(fetched.body);
      if (w) {
        meta.soap = {
          operations: w.operations.map((o) => ({
            name: o.name,
            soapAction: o.soapAction,
          })),
          targetNamespace: w.targetNamespace,
        };
      }
    } else if (schemaKind === "EDMX") {
      const m = parseODataMetadata(fetched.body);
      if (m) meta.odata = { entitySets: m.entitySets };
    } else if (schemaKind === "OPENAPI") {
      meta.openapi = parseOpenApi(fetched.body).map((o) => ({
        method: o.method,
        path: o.path,
        operationId: o.operationId,
      }));
    }

    return {
      success: true,
      data: {
        schemaKind,
        contentType: fetched.contentType,
        body: fetched.body,
        meta,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load schema",
    };
  }
}

export async function generateSampleRequest(
  iFlowDbId: string,
  endpointUrl: string,
  selection?: { operationName?: string; entitySetName?: string; openapiIndex?: number },
): Promise<ActionResult<GeneratedPayload>> {
  try {
    const schemaRes = await getEndpointSchema(iFlowDbId, endpointUrl);
    if (!schemaRes.success || !schemaRes.data) {
      return {
        success: true,
        data: {
          method: "POST",
          contentType: "application/json",
          body: "{}",
          hints: ["No API definition available — sending empty JSON."],
        },
      };
    }
    const schema = schemaRes.data;
    if (schema.schemaKind === "WSDL") {
      const wsdl = parseWsdl(schema.body);
      if (!wsdl) throw new Error("Failed to parse WSDL");
      // IDoc detection — naive: targetNamespace contains "idoc" or operations include IDOC
      const isIdoc =
        /idoc/i.test(wsdl.targetNamespace) ||
        wsdl.operations.some((o) => /idoc/i.test(o.name));
      const payload = isIdoc
        ? generateIdocSoapEnvelope(wsdl)
        : generateSoapEnvelope(wsdl, selection?.operationName);
      return { success: true, data: payload };
    }
    if (schema.schemaKind === "EDMX") {
      const meta = parseODataMetadata(schema.body);
      if (!meta) throw new Error("Failed to parse $metadata");
      return {
        success: true,
        data: generateODataPayload(meta, selection?.entitySetName),
      };
    }
    if (schema.schemaKind === "OPENAPI") {
      const ops = parseOpenApi(schema.body);
      const op = ops[selection?.openapiIndex ?? 0] || null;
      return { success: true, data: generateRestPayload(op) };
    }
    return {
      success: true,
      data: {
        method: "POST",
        contentType: "application/json",
        body: "{}",
        hints: ["No structured schema detected — sending empty JSON."],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate sample",
    };
  }
}

/**
 * Run an iFlow test invocation. SSRF guard: the endpoint URL must belong to
 * the iFlow's discovered ServiceEndpoints set.
 */
export async function runIFlowTest(
  input: RunIFlowTestInput,
): Promise<ActionResult<RunIFlowTestOutput>> {
  try {
    const { user, iflow, tenant } = await loadIFlowAndTenant(input.iFlowDbId);
    const client = buildManagementClient(tenant);

    // Anti-SSRF: confirm endpoint belongs to this iFlow.
    const entities = await client.getServiceEndpoints(iflow.iFlowId);
    const knownUrls = new Set<string>();
    for (const e of entities) {
      for (const ep of e.EntryPoints?.results ?? []) knownUrls.add(ep.Url);
    }
    if (!knownUrls.has(input.endpointUrl)) {
      return {
        success: false,
        error: "Endpoint URL is not part of this iFlow's discovered endpoints.",
      };
    }

    // Resolve runtime creds.
    const runtimeCredentials = await resolveRuntimeCredentials(tenant);

    // Generate / propagate an ApplicationMessageId so we can find the MPL
    // after the invocation. SAP CPI maps the inbound `SAP-Message-Id` HTTP
    // header to the MPL `ApplicationMessageId` field. The MPL `MessageGuid`
    // and `CorrelationId` are assigned by SAP CPI itself.
    const applicationMessageId =
      input.headers?.["SAP-Message-Id"] ||
      input.headers?.["sap-message-id"] ||
      `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const headers = {
      ...(input.headers || {}),
      "SAP-Message-Id": applicationMessageId,
    };

    const sinceIso = new Date(Date.now() - 5_000).toISOString();
    const traceConfig = await client
      .getMessageProcessingLogConfiguration(iflow.iFlowId)
      .catch(() => null);
    const traceWasEnabled = traceConfig?.logLevel === "TRACE";

    let invokeOutput;
    let errorMessage: string | null = null;
    try {
      invokeOutput = await invokeIFlowEndpoint({
        runtimeCredentials,
        url: input.endpointUrl,
        method: input.method,
        headers,
        query: input.query,
        body: input.body,
        contentType: input.contentType,
      });
    } catch (err) {
      const isInvokeError = err instanceof InvokeError;
      errorMessage = err instanceof Error ? err.message : String(err);
      invokeOutput = {
        status: 0,
        statusText: "",
        headers: {},
        body: "",
        bodyTruncated: false,
        contentType: "",
        durationMs: isInvokeError ? err.durationMs : 0,
        responseMessageGuid: null as string | null,
      };
    }

    // Persist the run (with redacted headers).
    const [row] = await db
      .insert(iFlowTestRuns)
      .values({
        iFlowDbId: input.iFlowDbId,
        tenantId: tenant.id,
        userId: user.id,
        endpointUrl: input.endpointUrl,
        protocol:
          classifyEndpoint({ url: input.endpointUrl }).protocol || "HTTPS",
        httpMethod: input.method.toUpperCase(),
        requestHeaders: redactHeaders(headers),
        requestQuery: input.query ?? null,
        requestBody: input.body ?? null,
        requestContentType: input.contentType ?? null,
        responseStatus: invokeOutput.status || null,
        responseHeaders: redactHeaders(invokeOutput.headers),
        responseBody: invokeOutput.body || null,
        responseContentType: invokeOutput.contentType || null,
        responseTruncated: invokeOutput.bodyTruncated,
        durationMs: invokeOutput.durationMs,
        errorMessage,
        messageGuid: invokeOutput.responseMessageGuid,
        correlationId: null,
        applicationMessageId,
        traceWasEnabled,
      })
      .returning({ id: iFlowTestRuns.id });

    // Try to correlate with the MPL synchronously (best-effort, short window).
    // Even if we already got a MessageGuid from the response headers we still
    // poll, because the SAP-assigned CorrelationId is only available via MPL.
    let resolvedCorrelationId: string | null = null;
    if (!errorMessage) {
      try {
        const correlated = await pollForMessageGuid(client, {
          iFlowId: iflow.iFlowId,
          applicationMessageId,
          sinceIso,
        });
        if (correlated) {
          resolvedCorrelationId = correlated.CorrelationId ?? null;
          await db
            .update(iFlowTestRuns)
            .set({
              messageGuid:
                invokeOutput.responseMessageGuid ?? correlated.MessageGuid,
              correlationId: resolvedCorrelationId,
            })
            .where(eq(iFlowTestRuns.id, row.id));
          invokeOutput.responseMessageGuid =
            invokeOutput.responseMessageGuid ?? correlated.MessageGuid;
        }
      } catch {
        // ignore correlation failures
      }
    }

    revalidatePath(`/dashboard/iflows/${input.iFlowDbId}`);

    return {
      success: true,
      data: {
        runId: row.id,
        status: invokeOutput.status || null,
        durationMs: invokeOutput.durationMs,
        responseHeaders: invokeOutput.headers,
        responseBody: invokeOutput.body,
        responseContentType: invokeOutput.contentType,
        bodyTruncated: invokeOutput.bodyTruncated,
        messageGuid: invokeOutput.responseMessageGuid,
        correlationId: resolvedCorrelationId,
        applicationMessageId,
        errorMessage,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to run test",
    };
  }
}

async function pollForMessageGuid(
  client: ReturnType<typeof buildManagementClient>,
  params: {
    iFlowId: string;
    applicationMessageId: string;
    sinceIso: string;
  },
): Promise<MessageProcessingLog | null> {
  const attempts = [800, 1200, 1500, 2000, 2500, 3000];
  for (const wait of attempts) {
    await new Promise((r) => setTimeout(r, wait));
    const found = await client.findMessageGuidByCorrelation({
      iFlowId: params.iFlowId,
      applicationMessageId: params.applicationMessageId,
      sinceIso: params.sinceIso,
    });
    if (found) return found;
  }
  return null;
}

export async function listIFlowTestRuns(
  iFlowDbId: string,
  limit = 20,
): Promise<ActionResult<IFlowTestRunRecord[]>> {
  try {
    await loadIFlowAndTenant(iFlowDbId); // permissions
    const rows = await db
      .select()
      .from(iFlowTestRuns)
      .where(eq(iFlowTestRuns.iFlowDbId, iFlowDbId))
      .orderBy(desc(iFlowTestRuns.executedAt))
      .limit(limit);
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        endpointUrl: r.endpointUrl,
        protocol: r.protocol,
        httpMethod: r.httpMethod,
        requestHeaders: (r.requestHeaders as Record<string, string> | null) ?? null,
        requestQuery: (r.requestQuery as Record<string, string> | null) ?? null,
        requestBody: r.requestBody,
        requestContentType: r.requestContentType,
        responseStatus: r.responseStatus,
        responseHeaders: (r.responseHeaders as Record<string, string> | null) ?? null,
        responseBody: r.responseBody,
        responseContentType: r.responseContentType,
        responseTruncated: r.responseTruncated,
        durationMs: r.durationMs,
        errorMessage: r.errorMessage,
        messageGuid: r.messageGuid,
        correlationId: r.correlationId,
        applicationMessageId: r.applicationMessageId,
        traceWasEnabled: r.traceWasEnabled,
        executedAt: r.executedAt,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list test runs",
    };
  }
}

export async function replayIFlowTestRun(
  runId: string,
): Promise<ActionResult<RunIFlowTestOutput>> {
  const row = await db.query.iFlowTestRuns.findFirst({
    where: eq(iFlowTestRuns.id, runId),
  });
  if (!row) return { success: false, error: "Test run not found" };
  return runIFlowTest({
    iFlowDbId: row.iFlowDbId,
    endpointUrl: row.endpointUrl,
    method: row.httpMethod,
    headers: (row.requestHeaders as Record<string, string> | null) ?? undefined,
    query: (row.requestQuery as Record<string, string> | null) ?? undefined,
    body: row.requestBody ?? undefined,
    contentType: row.requestContentType ?? undefined,
  });
}

// ============================================================================
// Trace / log level
// ============================================================================

export async function getIFlowLogLevel(
  iFlowDbId: string,
): Promise<ActionResult<LogLevelConfiguration | null>> {
  try {
    const { iflow, tenant } = await loadIFlowAndTenant(iFlowDbId);
    const client = buildManagementClient(tenant);
    const config = await client.getMessageProcessingLogConfiguration(iflow.iFlowId);
    return { success: true, data: config };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to read log level",
    };
  }
}

export async function setIFlowLogLevel(
  iFlowDbId: string,
  logLevel: LogLevel,
): Promise<ActionResult<LogLevelConfiguration | null>> {
  try {
    const { iflow, tenant, membership } = await loadIFlowAndTenant(iFlowDbId);
    if (!["OWNER", "ADMIN", "MEMBER"].includes(membership.role)) {
      return { success: false, error: "Insufficient permissions to change log level" };
    }
    const client = buildManagementClient(tenant);
    const config = await client.setMessageProcessingLogConfiguration(
      iflow.iFlowId,
      logLevel,
    );
    revalidatePath(`/dashboard/iflows/${iFlowDbId}`);
    return { success: true, data: config };
  } catch (error) {
    console.error("[setIFlowLogLevel] failed:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Couldn't update the trace level. Please try again.",
    };
  }
}

export interface MessageTraceDetails {
  message: MessageProcessingLog;
  runSteps: MessageRunStep[];
  errorText: string | null;
  attachments: Array<{ id: string; name: string; contentType: string; size: number | null }>;
}

export async function getMessageTraceDetails(
  iFlowDbId: string,
  messageGuid: string,
): Promise<ActionResult<MessageTraceDetails>> {
  try {
    const { tenant } = await loadIFlowAndTenant(iFlowDbId);
    const client = buildManagementClient(tenant);
    const [message, runSteps, errorText, attachments] = await Promise.all([
      client.getMessageProcessingLogById(messageGuid),
      client.getMessageRunSteps(messageGuid),
      client.getMessageErrorText(messageGuid).catch(() => null),
      client.getMessageAttachments(messageGuid),
    ]);
    return {
      success: true,
      data: {
        message,
        runSteps,
        errorText,
        attachments: attachments.map((a) => ({
          id: a.Id,
          name: a.Name,
          contentType: a.ContentType,
          size: a.PayloadSize ?? null,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load trace",
    };
  }
}

// ============================================================================
// Runtime credentials (per-tenant)
// ============================================================================

export async function saveRuntimeCredentials(
  tenantId: string,
  payload: RuntimeCredentialsForm,
): Promise<ActionResult<{ updated: true }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, user.id),
      ),
    });
    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return { success: false, error: "Only tenant admins can edit runtime credentials" };
    }

    const update: Partial<typeof cpiTenants.$inferInsert> = {
      runtimeAuthType: payload.authType,
      runtimeTokenUrl: payload.tokenUrl ?? null,
      runtimeClientId: payload.clientId ?? null,
      runtimeUsername: payload.username ?? null,
    };
    // Secret fields: undefined = leave unchanged, empty string = clear, value = encrypt.
    if (payload.clientSecret !== undefined) {
      update.runtimeClientSecret = payload.clientSecret
        ? await encrypt(payload.clientSecret)
        : null;
    }
    if (payload.password !== undefined) {
      update.runtimePassword = payload.password
        ? await encrypt(payload.password)
        : null;
    }
    if (payload.clientCertPem !== undefined) {
      update.runtimeClientCertPem = payload.clientCertPem
        ? await encrypt(payload.clientCertPem)
        : null;
    }
    if (payload.clientKeyPem !== undefined) {
      update.runtimeClientKeyPem = payload.clientKeyPem
        ? await encrypt(payload.clientKeyPem)
        : null;
    }
    if (payload.clientKeyPassphrase !== undefined) {
      update.runtimeClientKeyPassphrase = payload.clientKeyPassphrase
        ? await encrypt(payload.clientKeyPassphrase)
        : null;
    }
    // If the auth type is exclusive, null out the other auth fields to avoid stale values.
    if (payload.authType === "OAUTH") {
      update.runtimeUsername = null;
      update.runtimePassword = null;
      update.runtimeClientCertPem = null;
      update.runtimeClientKeyPem = null;
      update.runtimeClientKeyPassphrase = null;
    } else if (payload.authType === "BASIC_AUTH") {
      update.runtimeTokenUrl = null;
      update.runtimeClientId = null;
      update.runtimeClientSecret = null;
      update.runtimeClientCertPem = null;
      update.runtimeClientKeyPem = null;
      update.runtimeClientKeyPassphrase = null;
    } else if (payload.authType === "CERTIFICATE") {
      update.runtimeTokenUrl = null;
      update.runtimeClientId = null;
      update.runtimeClientSecret = null;
      update.runtimeUsername = null;
      update.runtimePassword = null;
    } else if (payload.authType === null) {
      update.runtimeTokenUrl = null;
      update.runtimeClientId = null;
      update.runtimeClientSecret = null;
      update.runtimeUsername = null;
      update.runtimePassword = null;
      update.runtimeClientCertPem = null;
      update.runtimeClientKeyPem = null;
      update.runtimeClientKeyPassphrase = null;
    }

    await db.update(cpiTenants).set(update).where(eq(cpiTenants.id, tenantId));
    return { success: true, data: { updated: true } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save credentials",
    };
  }
}

export async function getRuntimeCredentialsStatus(
  tenantId: string,
): Promise<
  ActionResult<{
    configured: boolean;
    authType: string | null;
    hasClientCert: boolean;
    hasClientKey: boolean;
  }>
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Not authenticated" };
    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, tenantId),
    });
    if (!tenant) return { success: false, error: "Tenant not found" };
    return {
      success: true,
      data: {
        configured: Boolean(tenant.runtimeAuthType),
        authType: tenant.runtimeAuthType,
        hasClientCert: Boolean(tenant.runtimeClientCertPem),
        hasClientKey: Boolean(tenant.runtimeClientKeyPem),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to read status",
    };
  }
}
