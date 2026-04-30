/**
 * Streaming Documentation Generator API.
 *
 * POST /api/ai/doc-generator/stream
 *
 * Body: { tenantId, iflowId, documentationType, sections[] }
 *
 * Returns a Server-Sent-Events stream with phases:
 *   metadata        — IFlowDocMetadata payload
 *   outline         — list of { id, title }
 *   section.start   — { sectionId, title }
 *   section.delta   — { sectionId, delta }   (token chunk)
 *   section.end     — { sectionId, content }
 *   diagrams        — { diagrams: MermaidDiagram[] }
 *   persisted       — { documentId }
 *   done            — { tokensUsed, durationMs }
 *   error           — { message }
 */

import { runStreamText } from "@/lib/ai/runtime/stream";
import { runText } from "@/lib/ai/runtime/text";
import { getCurrentUser } from "@/app/actions/user";
import { db } from "@/lib/db";
import {
  cpiTenants,
  tenantMembers,
  aiAgentExecutions,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createSAPCPIClient, type SAPCPICredentials } from "@/lib/sap-cpi/client";
import type { BPMN2ParseResult } from "@/lib/sap-cpi/bpmn2-parser";
import type {
  IFlowDocMetadata,
  DocumentationType,
  MermaidDiagram,
} from "@/types/documentation-generator";
import {
  AVAILABLE_SECTIONS,
  getDocumentTypeTitle,
} from "@/types/documentation-generator";
import { buildSectionPrompt } from "@/lib/ai/doc-generator/prompts";
import {
  buildDiagramsPrompt,
  parseDiagramsResponse,
} from "@/lib/ai/doc-generator/diagrams";
import { persistGeneratedDocument } from "@/lib/ai/doc-generator/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  tenantId?: string;
  iflowId?: string;
  documentationType?: DocumentationType;
  sections?: string[];
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return jsonError("Not authenticated", 401);

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const { tenantId, iflowId, documentationType, sections } = body;
  if (!tenantId || !iflowId || !documentationType || !Array.isArray(sections) || sections.length === 0) {
    return jsonError("tenantId, iflowId, documentationType, and sections[] are required");
  }

  // Validate tenant access
  const membership = await db.query.tenantMembers.findFirst({
    where: and(
      eq(tenantMembers.userId, currentUser.id),
      eq(tenantMembers.tenantId, tenantId),
    ),
  });
  if (!membership) return jsonError("Access denied", 403);

  const tenant = await db.query.cpiTenants.findFirst({
    where: eq(cpiTenants.id, tenantId),
  });
  if (!tenant) return jsonError("Tenant not found", 404);

  // Build CPI credentials (mirrors getIFlowDocMetadata)
  let effectiveTokenUrl = tenant.tokenUrl;
  if (tenant.authType === "OAUTH" && !effectiveTokenUrl) {
    if (tenant.authenticationUrl) {
      effectiveTokenUrl = `${tenant.authenticationUrl}/oauth/token`;
    } else if (tenant.tenantUrl) {
      const url = new URL(tenant.tenantUrl);
      effectiveTokenUrl = `${url.protocol}//${url.host}/oauth/token`;
    }
  }
  const hasOAuth =
    tenant.authType === "OAUTH" &&
    tenant.clientId &&
    tenant.clientSecret &&
    effectiveTokenUrl;
  const hasBasic =
    tenant.authType === "BASIC_AUTH" && tenant.username && tenant.password;
  if (!hasOAuth && !hasBasic) {
    return jsonError("SAP CPI credentials not configured for this tenant");
  }

  const cpiCredentials: SAPCPICredentials = {
    tenantUrl: tenant.tenantUrl,
    authType: tenant.authType as SAPCPICredentials["authType"],
    clientId: tenant.clientId || undefined,
    clientSecret: tenant.clientSecret || undefined,
    username: tenant.username || undefined,
    password: tenant.password || undefined,
    tokenUrl: effectiveTokenUrl || undefined,
  };
  const cpiClient = createSAPCPIClient(cpiCredentials);

  // Download & parse BPMN2 BEFORE opening the stream so we can fail fast.
  let parsed: BPMN2ParseResult;
  try {
    const result = await cpiClient.downloadAndParseIFlow(iflowId);
    if (!result) return jsonError("Failed to parse iFlow BPMN2 content");
    parsed = result;
  } catch (err) {
    console.error("[DocGenerator] BPMN2 download/parse failed:", err);
    return jsonError(
      err instanceof Error ? err.message : "Failed to download iFlow",
      502,
    );
  }

  const metadata: IFlowDocMetadata = {
    name: parsed.metadata.name || iflowId,
    description: parsed.metadata.description,
    version: parsed.metadata.version,
    adapters: parsed.adapters.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      direction: a.direction,
      address: a.address,
      properties: a.properties,
    })),
    scripts: parsed.scripts.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      content: s.content,
      linesOfCode: s.linesOfCode,
      complexity: s.complexity,
    })),
    mappings: parsed.mappings.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      complexity: m.complexity,
    })),
    errorHandlers: parsed.errorHandlers.map((e) => ({
      id: e.id,
      type: e.type,
      retryEnabled: e.retryEnabled,
      maxRetries: e.maxRetries,
    })),
    routes: parsed.routes.map((r) => ({
      id: r.id,
      condition: r.condition,
      target: r.target,
    })),
    totalSteps: parsed.metadata.totalSteps,
    hasParallelProcessing: parsed.metadata.hasParallelProcessing,
    hasLoops: parsed.metadata.hasLoops,
  };

  const startedAt = Date.now();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (phase: string, payload: unknown) => {
        const line = `data: ${JSON.stringify({ phase, payload })}\n\n`;
        controller.enqueue(enc.encode(line));
      };

      const collectedSections: { id: string; title: string; content: string }[] = [];
      let totalTokenEstimate = 0;
      let diagrams: MermaidDiagram[] = [];

      try {
        // 1. Metadata
        send("metadata", { metadata });

        // 2. Outline
        const outline = sections.map((id) => {
          const def = AVAILABLE_SECTIONS.find((s) => s.id === id);
          return { id, title: def?.name ?? id };
        });
        send("outline", { sections: outline });

        // 3. Per-section streaming
        for (const item of outline) {
          send("section.start", { sectionId: item.id, title: item.title });
          const { system, prompt } = buildSectionPrompt(
            metadata,
            item.id,
            documentationType,
          );

          let content = "";
          try {
            const result = await runStreamText({
              system,
              prompt,
              temperature: 0.3,
              maxTokens: 1800,
            });
            for await (const delta of result.textStream) {
              if (request.signal.aborted) {
                throw new DOMException("Aborted", "AbortError");
              }
              content += delta;
              send("section.delta", { sectionId: item.id, delta });
            }
          } catch (err) {
            if ((err as Error)?.name === "AbortError") throw err;
            console.error(`[DocGenerator] Section "${item.id}" failed:`, err);
            content =
              content ||
              `> _The model failed to generate this section. Please retry._`;
          }

          // Strip a leading H1 if the model added one anyway.
          content = content.replace(/^\s*#\s+.+\n/, "");
          collectedSections.push({
            id: item.id,
            title: item.title,
            content,
          });
          totalTokenEstimate += Math.ceil((prompt.length + content.length) / 4);
          send("section.end", {
            sectionId: item.id,
            title: item.title,
            content,
          });
        }

        // 4. Diagrams (single short JSON call)
        try {
          const dPrompt = buildDiagramsPrompt(metadata, documentationType);
          send("diagrams.start", {});
          const dRes = await runText({
            system: dPrompt.system,
            prompt: dPrompt.prompt,
            temperature: 0.2,
            maxTokens: 1500,
          });
          totalTokenEstimate += dRes.usage.totalTokens || 0;
          diagrams = parseDiagramsResponse(dRes.text);
        } catch (err) {
          console.warn("[DocGenerator] Diagrams generation failed:", err);
          diagrams = [];
        }
        send("diagrams", { diagrams });

        // 5. Persist
        const durationMs = Date.now() - startedAt;
        const docTitle = `${metadata.name} - ${getDocumentTypeTitle(documentationType)}`;
        let documentId: string | null = null;
        try {
          const persisted = await persistGeneratedDocument({
            userId: currentUser.id,
            tenantId,
            iFlowId: iflowId,
            iFlowName: metadata.name,
            documentationType,
            title: docTitle,
            version: metadata.version || "1.0.0",
            sections: collectedSections,
            diagrams,
            tokensUsed: totalTokenEstimate,
            durationMs,
          });
          documentId = persisted.id;
        } catch (err) {
          console.error("[DocGenerator] Persist failed:", err);
        }
        send("persisted", { documentId });

        // 6. Analytics (best-effort)
        try {
          await db.insert(aiAgentExecutions).values({
            agentType: "DOCUMENTATION_GENERATOR",
            tenantId,
            iFlowId: iflowId,
            userId: currentUser.id,
            tokensUsed: totalTokenEstimate,
            duration: durationMs,
            success: true,
            input: JSON.stringify({
              documentationType,
              sections,
              iflowName: metadata.name,
            }),
            output: JSON.stringify({
              sectionsGenerated: collectedSections.length,
              diagramsGenerated: diagrams.length,
              documentId,
            }),
          });
        } catch (err) {
          console.error("[DocGenerator] Analytics insert failed:", err);
        }

        // 7. Done
        send("done", { tokensUsed: totalTokenEstimate, durationMs, documentId });
        controller.close();
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          send("error", { message: "Generation cancelled" });
        } else {
          console.error("[DocGenerator] Stream error:", err);
          send("error", {
            message:
              err instanceof Error ? err.message : "Unexpected error",
          });
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
