import { runStreamText } from "@/lib/ai/runtime/stream";
import { getCurrentUser } from "@/app/actions/user";
import { db } from "@/lib/db";
import {
  cpiTenants,
  tenantMembers,
  iFlows,
  iFlowExecutions,
  aiAgentExecutions,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { getCachedToken, cacheToken } from "@/lib/token-cache";
import { ERROR_DIAGNOSIS_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { parseSAPDate } from "@/lib/sap-date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSAPToken(
  authenticationUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(authenticationUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok)
    throw new Error(`OAuth token failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}

async function findIFlow(idOrTechnical: string, userId: string) {
  // try by db id first
  let row = await db.query.iFlows.findFirst({
    where: eq(iFlows.id, idOrTechnical),
  });
  if (!row) {
    row = await db.query.iFlows.findFirst({
      where: eq(iFlows.iFlowId, idOrTechnical),
    });
  }
  if (!row) return null;
  const membership = await db.query.tenantMembers.findFirst({
    where: and(
      eq(tenantMembers.userId, userId),
      eq(tenantMembers.tenantId, row.tenantId),
    ),
  });
  if (!membership) return null;
  return row;
}

function jsonError(error: string, status = 400) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return jsonError("Not authenticated", 401);

  let body: { messageId?: string; iflowId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const { messageId, iflowId } = body;
  if (!messageId || !iflowId) return jsonError("messageId and iflowId required");

  const iflow = await findIFlow(iflowId, currentUser.id);
  if (!iflow) return jsonError("iFlow not found or access denied", 404);

  const tenant = await db.query.cpiTenants.findFirst({
    where: eq(cpiTenants.id, iflow.tenantId),
  });
  if (!tenant) return jsonError("Tenant not found", 404);

  // Build execution data — prefer DB record, fall back to SAP CPI API
  let execution: typeof iFlowExecutions.$inferSelect | undefined;
  try {
    execution = await db.query.iFlowExecutions.findFirst({
      where: eq(iFlowExecutions.messageId, messageId),
    });
  } catch {
    execution = undefined;
  }

  type ExecData = {
    messageId: string;
    status: string;
    startTime: Date | null;
    endTime: Date | null;
    duration: number | null;
    errorMessage: string | null;
    errorCategory: string | null;
    sender: string | null;
    receiver: string | null;
    interfaceType: string | null;
    requestPayload: string | null;
    responsePayload: string | null;
  };

  let data: ExecData;

  if (execution) {
    data = {
      messageId: execution.messageId,
      status: execution.status as string,
      startTime: execution.startTime,
      endTime: execution.endTime,
      duration: execution.duration,
      errorMessage: execution.errorMessage,
      errorCategory: execution.errorCategory,
      sender: execution.sender,
      receiver: execution.receiver,
      interfaceType: execution.interfaceType,
      requestPayload: null,
      responsePayload: null,
    };
  } else {
    // Fetch from SAP CPI
    let authHeader: string;
    if (tenant.authType === "OAUTH") {
      if (!tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret)
        return jsonError("OAuth credentials not configured");
      const decryptedSecret = await decrypt(tenant.clientSecret);
      let accessToken = getCachedToken(tenant.id);
      if (!accessToken) {
        accessToken = await getSAPToken(
          tenant.authenticationUrl,
          tenant.clientId,
          decryptedSecret,
        );
        cacheToken(tenant.id, accessToken);
      }
      authHeader = `Bearer ${accessToken}`;
    } else if (tenant.authType === "BASIC_AUTH") {
      if (!tenant.username || !tenant.password)
        return jsonError("Basic Auth credentials not configured");
      let pwd = tenant.password;
      try {
        pwd = await decrypt(tenant.password);
      } catch {
        /* keep raw */
      }
      authHeader = `Basic ${Buffer.from(`${tenant.username}:${pwd}`).toString("base64")}`;
    } else {
      return jsonError("Unsupported authentication type");
    }

    const messageUrl = `${tenant.tenantUrl}/api/v1/MessageProcessingLogs('${messageId}')?$format=json`;
    const messageRes = await fetch(messageUrl, {
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    if (!messageRes.ok) return jsonError("Failed to fetch message details from SAP CPI", 502);
    const msgJson = await messageRes.json();
    const log = msgJson.d || msgJson;
    const logStart = parseSAPDate(log.LogStart);
    const logEnd = parseSAPDate(log.LogEnd);

    let actualErrorMessage: string | null = null;
    if (log.Status?.toUpperCase() === "FAILED") {
      try {
        const errorRes = await fetch(
          `${tenant.tenantUrl}/api/v1/MessageProcessingLogs('${messageId}')/ErrorInformation/$value`,
          { headers: { Authorization: authHeader, Accept: "text/plain" } },
        );
        if (errorRes.ok) actualErrorMessage = await errorRes.text();
      } catch {
        /* swallow */
      }
    }

    data = {
      messageId: log.MessageGuid || messageId,
      status: log.Status || "UNKNOWN",
      startTime: logStart,
      endTime: logEnd,
      duration: logStart && logEnd ? logEnd.getTime() - logStart.getTime() : null,
      errorMessage: actualErrorMessage,
      errorCategory: null,
      sender: log.Sender || null,
      receiver: log.Receiver || null,
      interfaceType: log.IntegrationArtifact?.Type || null,
      requestPayload: null,
      responsePayload: null,
    };
  }

  const truncate = (p: string | null, max = 10000) =>
    p && p.length > max ? p.slice(0, max) + "\n\n[Truncated...]" : p;
  const fmt = (d: Date | null) => {
    if (!d) return "N/A";
    try {
      return d.toISOString();
    } catch {
      return "Invalid date";
    }
  };

  const context = `
**Execution Details:**
- Message ID: ${data.messageId}
- iFlow: ${iflow.name} (${iflow.iFlowId})
- Status: ${data.status}
- Error Category: ${data.errorCategory || "UNKNOWN"}
- Duration: ${data.duration ? `${data.duration}ms` : "N/A"}
- Start Time: ${fmt(data.startTime)}
- End Time: ${fmt(data.endTime)}
- Sender: ${data.sender || "N/A"}
- Receiver: ${data.receiver || "N/A"}
- Interface Type: ${data.interfaceType || "N/A"}

**Error Message:**
${data.errorMessage || "No error message available"}

**Request Payload:**
${truncate(data.requestPayload) || "No request payload available"}

**Response Payload:**
${truncate(data.responsePayload) || "No response payload available"}

Analyze this error and provide a comprehensive diagnosis with root cause, detailed analysis, recommended fix, and prevention strategy.
`;

  const prompt = `${ERROR_DIAGNOSIS_SYSTEM_PROMPT}\n\n---\n\n${context}`;

  const startedAt = Date.now();
  const result = await runStreamText({
    prompt,
    temperature: 0.5,
    maxTokens: 2048,
  });

  const collected: string[] = [];
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const chunk of result.textStream) {
          collected.push(chunk);
          controller.enqueue(enc.encode(chunk));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
        return;
      }

      // Best-effort analytics
      const output = collected.join("");
      try {
        await db.insert(aiAgentExecutions).values({
          userId: currentUser.id,
          agentType: "ERROR_DIAGNOSTICIAN",
          status: "COMPLETED",
          tenantId: iflow.tenantId,
          iFlowId: iflow.iFlowId,
          input:
            `Diagnose error for iFlow: ${iflow.name}\n${data.errorMessage ?? ""}`.slice(
              0,
              5000,
            ),
          output: output.slice(0, 10000),
          tokensUsed: Math.ceil((prompt.length + output.length) / 4),
          duration: Date.now() - startedAt,
          success: true,
        });
      } catch (e) {
        console.error("Failed to track AI execution:", e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
