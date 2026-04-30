import { runStreamText } from "@/lib/ai/runtime/stream";
import { getCurrentUser } from "@/app/actions/user";
import { db } from "@/lib/db";
import {
  cpiTenants,
  tenantMembers,
  iFlows,
  aiAgentExecutions,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { getCachedToken, cacheToken } from "@/lib/token-cache";
import { createSAPCPIClient } from "@/lib/sap-cpi/client";

/**
 * Get OAuth token from SAP CPI
 */
async function getSAPToken(
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

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { tenantId, messageGuid, iFlowArtifactId, iFlowName, errorMessage } =
      body;

    if (!tenantId || !messageGuid) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Get tenant
    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, tenantId),
    });

    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check access
    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, currentUser.id),
        eq(tenantMembers.tenantId, tenantId),
      ),
    });

    if (!membership) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
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
    if (tenant.authType === "OAUTH") {
      if (
        !tenant.authenticationUrl ||
        !tenant.clientId ||
        !tenant.clientSecret
      ) {
        return new Response(
          JSON.stringify({ error: "OAuth credentials not configured" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    } else if (tenant.authType === "BASIC_AUTH") {
      if (!tenant.username || !tenant.password) {
        return new Response(
          JSON.stringify({ error: "Basic Auth credentials not configured" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Unsupported authentication type" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    let client: ReturnType<typeof createSAPCPIClient>;

    if (tenant.authType === "OAUTH") {
      const decryptedClientSecret = await decrypt(tenant.clientSecret!);

      // Get or refresh token
      let accessToken = getCachedToken(tenant.id);
      if (!accessToken) {
        accessToken = await getSAPToken(
          tenant.authenticationUrl!,
          tenant.clientId!,
          decryptedClientSecret,
        );
        cacheToken(tenant.id, accessToken);
      }

      client = createSAPCPIClient({
        tenantUrl: tenant.tenantUrl,
        authType: "OAUTH",
        clientId: tenant.clientId!,
        clientSecret: tenant.clientSecret!,
        tokenUrl: tenant.authenticationUrl!,
      });

      (client as any).accessToken = accessToken;
      (client as any).tokenExpiry = Date.now() + 3600000;
    } else {
      client = createSAPCPIClient({
        tenantUrl: tenant.tenantUrl,
        authType: "BASIC_AUTH",
        username: tenant.username!,
        password: tenant.password!,
      });
    }

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
        const failedSteps = runSteps.filter(
          (s) => s.Status === "FAILED" || s.Error,
        );
        if (failedSteps.length > 0) {
          runStepsContext =
            "\n\nFailed Steps:\n" +
            failedSteps
              .map((s) => `- ${s.Activity || s.StepId}: ${s.Error || s.Status}`)
              .join("\n");
        }
      }
    } catch {
      // Continue without run steps
    }

    if (!errorDetails && !runStepsContext) {
      return new Response(
        JSON.stringify({ error: "No error details found for this message" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Generate diagnosis using AI SDK with streaming
    const prompt = `You are an SAP CPI (Cloud Platform Integration) expert. Analyze the following error from an integration flow.

Integration Flow: ${iFlowName}
${(iflow as { description?: string } | null)?.description ? `Description: ${(iflow as { description?: string }).description}` : ""}

Error Details:
${errorDetails}
${runStepsContext}

Respond using EXACTLY these three section headers (do not rename or reorder them):

## What Went Wrong
<brief explanation of the error>

## Root Cause
<the underlying technical root cause>

## Suggested Solutions
<numbered list of actionable steps to resolve the issue>`;

    // Generate diagnosis using AI SDK with streaming
    const result = await runStreamText({
      prompt,
      temperature: 0.3,
      maxTokens: 1024,
    });

    // Track start time for duration measurement
    const startTime = Date.now();

    // Collect output chunks for analytics tracking
    const outputChunks: string[] = [];

    // Create a readable stream for the response
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.textStream) {
          outputChunks.push(chunk);
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();

        // Track execution in database after streaming completes
        const duration = Date.now() - startTime;
        const output = outputChunks.join("");
        const inputTokens = Math.ceil(prompt.length / 4);
        const outputTokens = Math.ceil(output.length / 4);

        try {
          await db.insert(aiAgentExecutions).values({
            userId: currentUser.id,
            agentType: "ERROR_DIAGNOSTICIAN",
            tenantId,
            iFlowId: iFlowArtifactId || undefined,
            input:
              `Diagnose error for iFlow: ${iFlowName}\n${errorDetails}`.slice(
                0,
                5000,
              ),
            output: output.slice(0, 10000),
            tokensUsed: inputTokens + outputTokens,
            duration,
            success: true,
          });
        } catch (trackError) {
          console.error("Failed to track AI execution:", trackError);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Error in diagnose-error API:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to analyze error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
