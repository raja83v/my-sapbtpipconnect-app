/**
 * Endpoint invoker — server-side proxy that calls deployed iFlow endpoints
 * with runtime credentials, CSRF handling, and response capture.
 *
 * Designed to be called from the iFlow Test runner server actions.
 */

import { decrypt } from "@/lib/encryption";
import https from "node:https";
import { URL } from "node:url";

/** Maximum bytes of response body persisted to the test-run history. */
export const MAX_RESPONSE_BYTES = 1024 * 1024; // 1 MB

/** Headers we never persist verbatim. */
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-csrf-token",
  "proxy-authorization",
]);

export type RuntimeAuthType = "OAUTH" | "BASIC_AUTH" | "CERTIFICATE";

export interface RuntimeCredentialsInput {
  authType: RuntimeAuthType;
  // OAUTH
  tokenUrl?: string | null;
  clientId?: string | null;
  /** Already-decrypted secret. */
  clientSecret?: string | null;
  // BASIC_AUTH
  username?: string | null;
  /** Already-decrypted password. */
  password?: string | null;
  // CERTIFICATE (mTLS)
  /** Already-decrypted PEM client certificate (chain). */
  clientCertPem?: string | null;
  /** Already-decrypted PEM private key. */
  clientKeyPem?: string | null;
  /** Already-decrypted optional key passphrase. */
  clientKeyPassphrase?: string | null;
}

export interface InvokeOptions {
  runtimeCredentials: RuntimeCredentialsInput;
  url: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: string | null;
  contentType?: string | null;
  /** Total request timeout (default 60s). */
  timeoutMs?: number;
  /** Send `X-CSRF-Token: Fetch` first for non-GET (default true). */
  fetchCsrf?: boolean;
}

export interface InvokeResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bodyTruncated: boolean;
  contentType: string;
  durationMs: number;
  /** Resolved from response headers if the receiver echoed it. */
  responseMessageGuid: string | null;
}

/**
 * Resolve runtime credentials from the persisted (encrypted) tenant fields.
 * Falls back to management credentials when none configured.
 */
export async function resolveRuntimeCredentials(tenant: {
  runtimeAuthType: string | null;
  runtimeTokenUrl: string | null;
  runtimeClientId: string | null;
  runtimeClientSecret: string | null;
  runtimeUsername: string | null;
  runtimePassword: string | null;
  runtimeClientCertPem: string | null;
  runtimeClientKeyPem: string | null;
  runtimeClientKeyPassphrase: string | null;
  authType: string;
  tokenUrl: string | null;
  clientId: string | null;
  clientSecret: string | null;
  username: string | null;
  password: string | null;
}): Promise<RuntimeCredentialsInput> {
  const useRuntime =
    tenant.runtimeAuthType &&
    (tenant.runtimeAuthType === "OAUTH" ||
      tenant.runtimeAuthType === "BASIC_AUTH" ||
      tenant.runtimeAuthType === "CERTIFICATE");

  if (useRuntime) {
    const authType = tenant.runtimeAuthType as RuntimeAuthType;
    return {
      authType,
      tokenUrl: tenant.runtimeTokenUrl,
      clientId: tenant.runtimeClientId,
      clientSecret: await tryDecrypt(tenant.runtimeClientSecret),
      username: tenant.runtimeUsername,
      password: await tryDecrypt(tenant.runtimePassword),
      clientCertPem: await tryDecrypt(tenant.runtimeClientCertPem),
      clientKeyPem: await tryDecrypt(tenant.runtimeClientKeyPem),
      clientKeyPassphrase: await tryDecrypt(tenant.runtimeClientKeyPassphrase),
    };
  }

  // Fall back to management credentials.
  if (tenant.authType === "OAUTH") {
    return {
      authType: "OAUTH",
      tokenUrl: tenant.tokenUrl,
      clientId: tenant.clientId,
      clientSecret: await tryDecrypt(tenant.clientSecret),
    };
  }
  return {
    authType: "BASIC_AUTH",
    username: tenant.username,
    password: await tryDecrypt(tenant.password),
  };
}

async function tryDecrypt(value: string | null): Promise<string | null> {
  if (!value) return null;
  try {
    return await decrypt(value);
  } catch {
    return value; // fall back to plain text (legacy rows)
  }
}

async function buildAuthHeader(
  creds: RuntimeCredentialsInput,
): Promise<string | null> {
  if (creds.authType === "CERTIFICATE") {
    // mTLS — no Authorization header needed; identity is established by the client cert.
    return null;
  }
  if (creds.authType === "OAUTH") {
    if (!creds.tokenUrl || !creds.clientId || !creds.clientSecret) {
      throw new Error(
        "Runtime OAuth credentials incomplete (tokenUrl/clientId/clientSecret).",
      );
    }
    const response = await fetch(creds.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }).toString(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `OAuth token request failed (${response.status}): ${text.slice(0, 200)}`,
      );
    }
    const json = (await response.json()) as { access_token?: string };
    if (!json.access_token) throw new Error("OAuth token response missing access_token");
    return `Bearer ${json.access_token}`;
  }
  if (!creds.username || !creds.password) {
    throw new Error("Runtime basic-auth credentials incomplete.");
  }
  return `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString("base64")}`;
}

function buildUrl(base: string, query?: Record<string, string>): string {
  if (!query || Object.keys(query).length === 0) return base;
  const url = new URL(base);
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }
  return url.toString();
}

function headersToObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/** Strip headers that should never be persisted. */
export function redactHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SENSITIVE_HEADERS.has(k.toLowerCase()) ? "***redacted***" : v;
  }
  return out;
}

/**
 * Invoke a deployed iFlow endpoint.
 * The caller must have already validated that `url` belongs to the iFlow's
 * discovered endpoint set (anti-SSRF).
 */
export async function invokeIFlowEndpoint(
  options: InvokeOptions,
): Promise<InvokeResult> {
  const method = options.method.toUpperCase();
  const timeoutMs = options.timeoutMs ?? 60_000;
  const finalUrl = buildUrl(options.url, options.query);
  const authHeader = await buildAuthHeader(options.runtimeCredentials);
  const usingCert = options.runtimeCredentials.authType === "CERTIFICATE";

  if (usingCert) {
    if (
      !options.runtimeCredentials.clientCertPem ||
      !options.runtimeCredentials.clientKeyPem
    ) {
      throw new Error(
        "Runtime certificate credentials incomplete (clientCertPem/clientKeyPem).",
      );
    }
    if (!finalUrl.startsWith("https://")) {
      throw new Error(
        "Client certificate authentication requires an HTTPS endpoint.",
      );
    }
  }

  let csrfToken = "";
  let cookies = "";
  const needsCsrf = options.fetchCsrf !== false && method !== "GET" && method !== "HEAD";
  if (needsCsrf) {
    const csrfHeaders: Record<string, string> = {
      "X-CSRF-Token": "Fetch",
      ...(authHeader ? { Authorization: authHeader } : {}),
    };
    for (const m of ["HEAD", "GET"] as const) {
      try {
        const csrf = await sendRequest(finalUrl, {
          method: m,
          headers: csrfHeaders,
          timeoutMs,
          mtls: usingCert
            ? {
                cert: options.runtimeCredentials.clientCertPem!,
                key: options.runtimeCredentials.clientKeyPem!,
                passphrase: options.runtimeCredentials.clientKeyPassphrase ?? undefined,
              }
            : undefined,
        });
        csrfToken =
          csrf.headers["x-csrf-token"] || csrf.headers["X-CSRF-Token"] || "";
        cookies = csrf.headers["set-cookie"] || "";
        if (csrfToken) break;
      } catch {
        // try next method
      }
    }
  }

  const requestHeaders: Record<string, string> = {
    ...(authHeader ? { Authorization: authHeader } : {}),
    Accept: "*/*",
    ...(options.contentType && method !== "GET" && method !== "HEAD"
      ? { "Content-Type": options.contentType }
      : {}),
    ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    ...(cookies ? { Cookie: cookies } : {}),
    ...(options.headers || {}),
  };

  const start = Date.now();
  let res: LowLevelResponse;
  try {
    res = await sendRequest(finalUrl, {
      method,
      headers: requestHeaders,
      body: method === "GET" || method === "HEAD" ? undefined : options.body ?? undefined,
      timeoutMs,
      mtls: usingCert
        ? {
            cert: options.runtimeCredentials.clientCertPem!,
            key: options.runtimeCredentials.clientKeyPem!,
            passphrase: options.runtimeCredentials.clientKeyPassphrase ?? undefined,
          }
        : undefined,
    });
  } catch (error) {
    const durationMs = Date.now() - start;
    const message =
      error instanceof Error
        ? error.name === "AbortError" || /aborted/i.test(error.message)
          ? `Request timed out after ${timeoutMs} ms`
          : error.message
        : String(error);
    throw new InvokeError(message, durationMs);
  }
  const durationMs = Date.now() - start;

  const responseHeaders = res.headers;
  const contentType = responseHeaders["content-type"] || "";
  let bodyBuffer = res.body;
  let truncated = false;
  if (bodyBuffer.length > MAX_RESPONSE_BYTES) {
    bodyBuffer = bodyBuffer.subarray(0, MAX_RESPONSE_BYTES);
    truncated = true;
  }
  const body = bodyBuffer.toString("utf8");

  const responseMessageGuid =
    responseHeaders["sap-messageprocessinglogid"] ||
    responseHeaders["sap-message-id"] ||
    null;

  return {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
    body,
    bodyTruncated: truncated,
    contentType,
    durationMs,
    responseMessageGuid,
  };
}

// ============================================================================
// Low-level request helper (supports fetch + Node `https` for client-cert mTLS)
// ============================================================================

interface LowLevelResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: Buffer;
}

interface LowLevelOptions {
  method: string;
  headers: Record<string, string>;
  body?: string | null;
  timeoutMs: number;
  mtls?: { cert: string; key: string; passphrase?: string };
}

async function sendRequest(
  url: string,
  options: LowLevelOptions,
): Promise<LowLevelResponse> {
  if (options.mtls) {
    return sendHttpsWithCert(url, options);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body ?? undefined,
      signal: controller.signal,
    });
    const buf = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      statusText: response.statusText,
      headers: headersToObject(response.headers),
      body: buf,
    };
  } finally {
    clearTimeout(timer);
  }
}

function sendHttpsWithCert(
  url: string,
  options: LowLevelOptions,
): Promise<LowLevelResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        method: options.method,
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        headers: options.headers,
        cert: options.mtls!.cert,
        key: options.mtls!.key,
        passphrase: options.mtls!.passphrase,
        timeout: options.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (Array.isArray(v)) headers[k] = v.join(", ");
            else if (v != null) headers[k] = String(v);
          }
          resolve({
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? "",
            headers,
            body: Buffer.concat(chunks),
          });
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${options.timeoutMs} ms`));
    });
    if (options.body && options.method !== "GET" && options.method !== "HEAD") {
      req.write(options.body);
    }
    req.end();
  });
}

export class InvokeError extends Error {
  durationMs: number;
  constructor(message: string, durationMs: number) {
    super(message);
    this.name = "InvokeError";
    this.durationMs = durationMs;
  }
}

// ============================================================================
// Endpoint classification
// ============================================================================

export type EndpointProtocol =
  | "REST"
  | "SOAP"
  | "ODATA"
  | "IDOC_SOAP"
  | "HTTPS"
  | "AS2"
  | "MAIL"
  | "SFTP"
  | "JMS"
  | "PROCESS_DIRECT"
  | "TIMER"
  | "OTHER";

export interface ClassifiedEndpoint {
  protocol: EndpointProtocol;
  /** True when the endpoint can be invoked synchronously by the test runner. */
  callable: boolean;
  /** Best default HTTP method for the test runner. */
  defaultMethod: string;
  /** Human-readable reason if not callable. */
  uncallableReason?: string;
}

export function classifyEndpoint(input: {
  protocol?: string | null;
  url?: string | null;
  componentType?: string | null;
}): ClassifiedEndpoint {
  const proto = (input.protocol || "").toUpperCase();
  const url = (input.url || "").toLowerCase();
  const comp = (input.componentType || "").toUpperCase();

  if (proto.includes("SOAP") || comp.includes("SOAP")) {
    if (comp.includes("IDOC") || url.includes("idoc")) {
      return { protocol: "IDOC_SOAP", callable: true, defaultMethod: "POST" };
    }
    return { protocol: "SOAP", callable: true, defaultMethod: "POST" };
  }
  if (proto.includes("ODATA") || comp.includes("ODATA")) {
    return { protocol: "ODATA", callable: true, defaultMethod: "GET" };
  }
  if (proto.includes("REST") || comp.includes("REST")) {
    return { protocol: "REST", callable: true, defaultMethod: "POST" };
  }
  if (proto.includes("AS2") || comp.includes("AS2")) {
    return {
      protocol: "AS2",
      callable: false,
      defaultMethod: "POST",
      uncallableReason:
        "AS2 requires mTLS/partner certificates — not supported in v1.",
    };
  }
  if (comp.includes("MAIL") || comp.includes("IMAP") || comp.includes("POP")) {
    return {
      protocol: "MAIL",
      callable: false,
      defaultMethod: "GET",
      uncallableReason: "Mail-polling iFlows are triggered by inbox events.",
    };
  }
  if (comp.includes("SFTP") || comp.includes("FTP")) {
    return {
      protocol: "SFTP",
      callable: false,
      defaultMethod: "GET",
      uncallableReason:
        "SFTP-polling iFlows trigger when files are dropped on the server.",
    };
  }
  if (comp.includes("JMS")) {
    return {
      protocol: "JMS",
      callable: false,
      defaultMethod: "POST",
      uncallableReason: "JMS-triggered iFlows consume from a queue.",
    };
  }
  if (comp.includes("PROCESSDIRECT") || proto.includes("PROCESSDIRECT")) {
    return {
      protocol: "PROCESS_DIRECT",
      callable: false,
      defaultMethod: "POST",
      uncallableReason:
        "ProcessDirect endpoints are invoked internally by other iFlows.",
    };
  }
  if (comp.includes("TIMER") || comp.includes("SCHEDULER")) {
    return {
      protocol: "TIMER",
      callable: false,
      defaultMethod: "GET",
      uncallableReason: "Timer/scheduled iFlows are triggered by the platform.",
    };
  }
  if (proto.includes("HTTPS") || proto.includes("HTTP") || url.startsWith("https")) {
    return { protocol: "HTTPS", callable: true, defaultMethod: "POST" };
  }
  return {
    protocol: "OTHER",
    callable: false,
    defaultMethod: "POST",
    uncallableReason: `Endpoint protocol "${input.protocol || "unknown"}" is not supported by the test runner.`,
  };
}
