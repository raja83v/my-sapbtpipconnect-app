import { streamText, type StreamTextResult } from "ai";
import { aiModel } from "@/lib/ai/client";
import { getCurrentUser } from "@/app/actions/user";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { decrypt } from "@/lib/encryption";
import { getCachedToken, cacheToken } from "@/lib/token-cache";
import { createSAPCPIClient } from "@/lib/sap-cpi/client";
import { checkSubscriptionLimit, incrementUsage } from "@/app/actions/billing";

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
        const { tenantId, messageGuid, iFlowArtifactId, iFlowName, errorMessage } = body;

        if (!tenantId || !messageGuid) {
            return new Response(JSON.stringify({ error: "Missing required parameters" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Get tenant
        const tenant = await convex.query(api.tenants.getById, { id: tenantId as any });

        if (!tenant) {
            return new Response(JSON.stringify({ error: "Tenant not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Check access
        const membership = await convex.query(api.tenants.getMembership, {
            userId: currentUser.id as any,
            tenantId: tenantId as any,
        });

        if (!membership) {
            return new Response(JSON.stringify({ error: "Access denied" }), {
                status: 403,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Check subscription limit for AI agent calls
        const limitCheck = await checkSubscriptionLimit("aiAgentCalls");
        if (!limitCheck.success) {
            return new Response(JSON.stringify({ error: limitCheck.error }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (!limitCheck.data?.allowed) {
            const { current, max } = limitCheck.data || { current: 0, max: 0 };
            return new Response(
                JSON.stringify({
                    error: `Monthly AI agent call limit reached (${current}/${max}). Please upgrade your plan to continue using AI agents.`
                }),
                {
                    status: 403,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        // Try to find the iFlow in Convex by artifact ID (optional)
        let iflow = null;
        if (iFlowArtifactId) {
            iflow = await convex.query(api.iflows.getByTenantAndIFlowId, {
                tenantId: tenantId as any,
                iFlowId: iFlowArtifactId,
            });
        }

        // Fetch message details from SAP CPI
        if (tenant.authType !== "OAUTH" || !tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
            return new Response(JSON.stringify({ error: "OAuth credentials not configured" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const decryptedClientSecret = await decrypt(tenant.clientSecret);

        // Get or refresh token
        let accessToken = getCachedToken(tenant._id);
        if (!accessToken) {
            accessToken = await getSAPToken(
                tenant.authenticationUrl,
                tenant.clientId,
                decryptedClientSecret
            );
            cacheToken(tenant._id, accessToken);
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
            return new Response(JSON.stringify({ error: "No error details found for this message" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Generate diagnosis using AI SDK with streaming
        const prompt = `You are an SAP CPI (Cloud Platform Integration) expert. Analyze the following error from an integration flow and provide:
1. A brief explanation of what went wrong
2. The likely root cause
3. Suggested solutions or next steps

Integration Flow: ${iFlowName}
${iflow?.description ? `Description: ${iflow.description}` : ""}

Error Details:
${errorDetails}
${runStepsContext}

Provide a clear, actionable response formatted in markdown.`;

        // Generate diagnosis using AI SDK with streaming
        const result = streamText({
            model: aiModel,
            prompt,
            temperature: 0.3,
            maxTokens: 1024,
        });

        // Increment AI agent usage after successful execution
        await incrementUsage("aiAgentCalls");

        // Create a readable stream for the response
        const stream = new ReadableStream({
            async start(controller) {
                const textStream = result.textStream;
                for await (const chunk of textStream) {
                    // Format as SSE data for useCompletion
                    controller.enqueue(new TextEncoder().encode(chunk));
                }
                controller.close();
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
            JSON.stringify({ error: error instanceof Error ? error.message : "Failed to analyze error" }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}