"use server";

import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import { tenantMembers, cpiTenants, aiAgentExecutions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { ActionResult } from "@/types/actions";
import { runText } from "@/lib/ai/runtime/text";
import { DOCUMENTATION_GENERATOR_PROMPT } from "@/lib/ai/prompts";
import { createSAPCPIClient, type SAPCPICredentials } from "@/lib/sap-cpi/client";
import type { BPMN2ParseResult } from "@/lib/sap-cpi/bpmn2-parser";
import { cleanAIJson, fixUnescapedQuotesStateMachine, tryFixAtPosition } from "@/lib/ai/orchestrator/utils/json-cleaner";
import type {
    IFlowForDocGenerator,
    DocumentationType,
    IFlowDocMetadata,
    GeneratedDocument,
    DocumentSectionContent,
    MermaidDiagram,
} from "@/types/documentation-generator";
import { getDocumentTypeTitle, AVAILABLE_SECTIONS } from "@/types/documentation-generator";
import {
    getGeneratedDocumentById,
    listGeneratedDocumentsForUser,
} from "@/lib/ai/doc-generator/persist";

// Re-export types for consumers
export type {
    IFlowForDocGenerator,
    DocumentationType,
    IFlowDocMetadata,
    GeneratedDocument,
    DocumentSectionContent,
    MermaidDiagram,
};

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Get a persisted generated document by id (must belong to current user).
 */
export async function getGeneratedDocument(
    id: string,
): Promise<ActionResult<GeneratedDocument & { id: string; durationMs: number }>> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Not authenticated" };
    const doc = await getGeneratedDocumentById(id, currentUser.id);
    if (!doc) return { success: false, error: "Document not found" };
    return { success: true, data: doc };
}

/**
 * List recent generated documents for the current user.
 */
export async function listGeneratedDocuments(params: {
    tenantId?: string;
    iflowId?: string;
    limit?: number;
}): Promise<ActionResult<Array<{
    id: string;
    title: string;
    iFlowName: string | null;
    documentationType: string;
    tokensUsed: number;
    durationMs: number;
    createdAt: Date;
}>>> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "Not authenticated" };
    const rows = await listGeneratedDocumentsForUser({
        userId: currentUser.id,
        tenantId: params.tenantId,
        iFlowId: params.iflowId,
        limit: params.limit,
    });
    return { success: true, data: rows };
}

/**
 * Get iFlows for Documentation Generator - fetches directly from SAP CPI API
 */
export async function getIFlowsForDocGenerator(params: {
    tenantId: string;
}): Promise<ActionResult<IFlowForDocGenerator[]>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const { tenantId } = params;

        // Validate tenant access
        const membership = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, currentUser.id), eq(tenantMembers.tenantId, tenantId)),
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Get tenant details for SAP CPI connection
        const tenant = await db.query.cpiTenants.findFirst({
            where: eq(cpiTenants.id, tenantId),
        });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        // Build OAuth token URL
        let effectiveTokenUrl = tenant.tokenUrl;
        if (tenant.authType === "OAUTH" && !effectiveTokenUrl) {
            if (tenant.authenticationUrl) {
                effectiveTokenUrl = `${tenant.authenticationUrl}/oauth/token`;
            } else if (tenant.tenantUrl) {
                const url = new URL(tenant.tenantUrl);
                effectiveTokenUrl = `${url.protocol}//${url.host}/oauth/token`;
            }
        }

        // Check credentials
        const hasOAuthCredentials = tenant.authType === "OAUTH" &&
            tenant.clientId &&
            tenant.clientSecret &&
            effectiveTokenUrl;

        const hasBasicAuthCredentials = tenant.authType === "BASIC_AUTH" &&
            tenant.username &&
            tenant.password;

        if (!hasOAuthCredentials && !hasBasicAuthCredentials) {
            return { success: false, error: "SAP CPI credentials not configured for this tenant" };
        }

        // Create SAP CPI client
        const cpiCredentials: SAPCPICredentials = {
            tenantUrl: tenant.tenantUrl,
            authType: tenant.authType as any,
            clientId: tenant.clientId || undefined,
            clientSecret: tenant.clientSecret || undefined,
            username: tenant.username || undefined,
            password: tenant.password || undefined,
            tokenUrl: effectiveTokenUrl || undefined,
        };

        const cpiClient = createSAPCPIClient(cpiCredentials);

        // Fetch deployed iFlows from SAP CPI API (already sorted by name ascending)
        const deployedIFlows = await cpiClient.listDeployedIFlows();

        // Transform to the format needed
        const simplifiedIFlows: IFlowForDocGenerator[] = deployedIFlows.map((iflow) => ({
            id: iflow.Id,
            name: iflow.Name,
            status: iflow.Status || 'STARTED',
            iFlowId: iflow.Id,
        }));

        return { success: true, data: simplifiedIFlows };
    } catch (error) {
        console.error("Error fetching iFlows from SAP CPI:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch iFlows from SAP CPI" };
    }
}

/**
 * Get iFlow metadata for documentation - fetches and parses BPMN2 from SAP CPI
 */
export async function getIFlowDocMetadata(params: {
    tenantId: string;
    iflowId: string;
}): Promise<ActionResult<IFlowDocMetadata>> {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const { tenantId, iflowId } = params;

        // Validate tenant access
        const membership = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, currentUser.id), eq(tenantMembers.tenantId, tenantId)),
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Get tenant details for SAP CPI connection
        const tenant = await db.query.cpiTenants.findFirst({
            where: eq(cpiTenants.id, tenantId),
        });

        if (!tenant) {
            return { success: false, error: "Tenant not found" };
        }

        // Build OAuth token URL
        let effectiveTokenUrl = tenant.tokenUrl;
        if (tenant.authType === "OAUTH" && !effectiveTokenUrl) {
            if (tenant.authenticationUrl) {
                effectiveTokenUrl = `${tenant.authenticationUrl}/oauth/token`;
            } else if (tenant.tenantUrl) {
                const url = new URL(tenant.tenantUrl);
                effectiveTokenUrl = `${url.protocol}//${url.host}/oauth/token`;
            }
        }

        // Check credentials
        const hasOAuthCredentials = tenant.authType === "OAUTH" &&
            tenant.clientId &&
            tenant.clientSecret &&
            effectiveTokenUrl;

        const hasBasicAuthCredentials = tenant.authType === "BASIC_AUTH" &&
            tenant.username &&
            tenant.password;

        if (!hasOAuthCredentials && !hasBasicAuthCredentials) {
            return { success: false, error: "SAP CPI credentials not configured for this tenant" };
        }

        // Create SAP CPI client
        const cpiCredentials: SAPCPICredentials = {
            tenantUrl: tenant.tenantUrl,
            authType: tenant.authType as any,
            clientId: tenant.clientId || undefined,
            clientSecret: tenant.clientSecret || undefined,
            username: tenant.username || undefined,
            password: tenant.password || undefined,
            tokenUrl: effectiveTokenUrl || undefined,
        };

        const cpiClient = createSAPCPIClient(cpiCredentials);

        // Download and parse BPMN2 XML
        let bpmn2ParseResult: BPMN2ParseResult | null = null;
        try {
            bpmn2ParseResult = await cpiClient.downloadAndParseIFlow(iflowId);
        } catch (error) {
            console.error("Error downloading/parsing BPMN2:", error);
            return { success: false, error: "Failed to download iFlow from SAP CPI. Please check your credentials." };
        }

        if (!bpmn2ParseResult) {
            return { success: false, error: "Failed to parse iFlow BPMN2 content" };
        }

        // Transform to our metadata format
        const metadata: IFlowDocMetadata = {
            name: bpmn2ParseResult.metadata.name || iflowId,
            description: bpmn2ParseResult.metadata.description,
            version: bpmn2ParseResult.metadata.version,
            adapters: bpmn2ParseResult.adapters.map(a => ({
                id: a.id,
                name: a.name,
                type: a.type,
                direction: a.direction,
                address: a.address,
                properties: a.properties,
            })),
            scripts: bpmn2ParseResult.scripts.map(s => ({
                id: s.id,
                name: s.name,
                type: s.type,
                content: s.content,
                linesOfCode: s.linesOfCode,
                complexity: s.complexity,
            })),
            mappings: bpmn2ParseResult.mappings.map(m => ({
                id: m.id,
                name: m.name,
                type: m.type,
                complexity: m.complexity,
            })),
            errorHandlers: bpmn2ParseResult.errorHandlers.map(e => ({
                id: e.id,
                type: e.type,
                retryEnabled: e.retryEnabled,
                maxRetries: e.maxRetries,
            })),
            routes: bpmn2ParseResult.routes.map(r => ({
                id: r.id,
                condition: r.condition,
                target: r.target,
            })),
            totalSteps: bpmn2ParseResult.metadata.totalSteps,
            hasParallelProcessing: bpmn2ParseResult.metadata.hasParallelProcessing,
            hasLoops: bpmn2ParseResult.metadata.hasLoops,
        };

        return { success: true, data: metadata };
    } catch (error) {
        console.error("Error fetching iFlow metadata:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to fetch iFlow metadata" };
    }
}

/**
 * Generate documentation using AI
 */
export async function generateDocumentation(params: {
    tenantId: string;
    iflowId: string;
    metadata: IFlowDocMetadata;
    documentationType: DocumentationType;
    sections: string[];
}): Promise<ActionResult<GeneratedDocument>> {
    const startTime = Date.now();

    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const { tenantId, iflowId, metadata, documentationType, sections } = params;

        // Validate tenant access
        const membership = await db.query.tenantMembers.findFirst({
            where: and(eq(tenantMembers.userId, currentUser.id), eq(tenantMembers.tenantId, tenantId)),
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Build the documentation prompt
        const contextPrompt = buildDocumentationPrompt(metadata, documentationType, sections);

        // Generate documentation using AI with specialist system prompt
        const result = await runText({
            system: DOCUMENTATION_GENERATOR_PROMPT,
            prompt: contextPrompt,
            temperature: 0.3,
            maxTokens: 16000,
        });
        const fullText = result.text;
        const totalTokens = result.usage.totalTokens || 0;

        console.log(`[DocGenerator] AI response: ${fullText.length} chars, ${totalTokens} tokens`);
        console.log(`[DocGenerator] Response preview: ${fullText.substring(0, 300)}...`);

        // Parse the AI response
        const document = parseDocumentationResponse(fullText, metadata, documentationType, sections);

        // Track execution in database
        const durationMs = Date.now() - startTime;
        await db.insert(aiAgentExecutions).values({
            agentType: "DOCUMENTATION_GENERATOR",
            tenantId: tenantId,
            iFlowId: iflowId,
            userId: currentUser.id,
            tokensUsed: totalTokens,
            duration: durationMs,
            success: true,
            input: JSON.stringify({ documentationType, sections, iflowName: metadata.name }),
            output: JSON.stringify({ sectionsGenerated: document.sections.length }),
        });

        return { success: true, data: { ...document, tokensUsed: totalTokens } };
    } catch (error) {
        console.error("Error generating documentation:", error);

        // Track failed execution
        try {
            const currentUser = await getCurrentUser();
            if (currentUser) {
                await db.insert(aiAgentExecutions).values({
                    agentType: "DOCUMENTATION_GENERATOR",
                    tenantId: params.tenantId,
                    iFlowId: params.iflowId,
                    userId: currentUser.id,
                    tokensUsed: 0,
                    duration: Date.now() - startTime,
                    success: false,
                    input: JSON.stringify({ documentationType: params.documentationType, sections: params.sections }),
                    output: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
                });
            }
        } catch (trackError) {
            console.error("Error tracking failed execution:", trackError);
        }

        return { success: false, error: error instanceof Error ? error.message : "Failed to generate documentation" };
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildDocumentationPrompt(
    metadata: IFlowDocMetadata,
    documentationType: DocumentationType,
    sections: string[]
): string {
    // Build detailed adapter information including ALL properties
    const adapterDetails = metadata.adapters.map(a => {
        let detail = `### ${a.name}\n- **Type:** ${a.type}\n- **Direction:** ${a.direction}\n- **Address:** ${a.address || 'N/A'}`;
        if (a.properties && Object.keys(a.properties).length > 0) {
            detail += `\n- **Properties:**`;
            for (const [key, value] of Object.entries(a.properties)) {
                const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                detail += `\n  - \`${key}\`: ${displayValue}`;
            }
        }
        return detail;
    }).join('\n\n');

    // Build FULL script details including actual code content
    const scriptDetails = metadata.scripts.map(s => {
        let detail = `### ${s.name}\n- **Type:** ${s.type}\n- **Lines of Code:** ${s.linesOfCode}\n- **Complexity:** ${s.complexity}`;
        if (s.content) {
            // Include script content (truncate very long scripts to avoid token overflow)
            const maxContentLength = 2000;
            const content = s.content.length > maxContentLength
                ? s.content.slice(0, maxContentLength) + '\n// ... (truncated)'
                : s.content;
            detail += `\n- **Script Content:**\n\`\`\`groovy\n${content}\n\`\`\``;
        }
        return detail;
    }).join('\n\n');

    // Build mapping summary
    const mappingSummary = metadata.mappings.map(m => 
        `- **${m.name}** (${m.type}, ${m.complexity} complexity)`
    ).join('\n');

    // Build error handler details
    const errorHandlerDetails = metadata.errorHandlers.map(e => 
        `- **${e.type}**: Retry ${e.retryEnabled ? `enabled (max ${e.maxRetries || 'N/A'} retries)` : 'disabled'}`
    ).join('\n');

    // Build routing details with full conditions
    const routingDetails = metadata.routes.map(r => 
        `- Route to **${r.target}**${r.condition ? `\n  - Condition: \`${r.condition}\`` : ' (default route)'}`
    ).join('\n');

    // Get section definitions with explicit IDs for the AI
    const sectionDetails = sections.map(sectionId => {
        const section = AVAILABLE_SECTIONS.find(s => s.id === sectionId);
        return section ? `- id: "${section.id}", name: "${section.name}", description: "${section.description}"` : `- id: "${sectionId}"`;
    }).join('\n');

    // Build per-section content instructions so AI knows exactly what to produce
    const sectionContentGuidelines = sections.map(sectionId => {
        const section = AVAILABLE_SECTIONS.find(s => s.id === sectionId);
        if (!section) return '';
        switch (sectionId) {
            case 'overview':
                return `- **${section.name}** (id: "${sectionId}"): Business context, purpose, source/target systems, data flow summary, key metrics (steps, adapters, scripts count)`;
            case 'architecture':
                return `- **${section.name}** (id: "${sectionId}"): Component breakdown with a Mermaid flowchart showing ALL adapters, scripts, mappings, routers, and error handlers. Include a system context diagram.`;
            case 'data-flow':
                return `- **${section.name}** (id: "${sectionId}"): Step-by-step processing description from sender to receiver. Describe each processing step, transformation, and routing decision in order.`;
            case 'adapters':
                return `- **${section.name}** (id: "${sectionId}"): A Markdown TABLE for EACH adapter listing ALL its properties (columns: Property | Value | Description). Include adapter type, direction, address, authentication, and every configuration property.`;
            case 'mappings':
                return `- **${section.name}** (id: "${sectionId}"): Source-to-target field mappings in tables, transformation rules, data types, and any value mapping logic.`;
            case 'scripts':
                return `- **${section.name}** (id: "${sectionId}"): For EACH script — purpose, input/output, key operations, function-by-function logic explanation based on the actual script code provided above. Include code snippets.`;
            case 'error-handling':
                return `- **${section.name}** (id: "${sectionId}"): Each error handler's strategy, retry configuration, exception subprocess details, alerting, and escalation procedures.`;
            case 'endpoints':
                return `- **${section.name}** (id: "${sectionId}"): REST/SOAP endpoint URLs, HTTP methods, request/response formats, headers, authentication requirements, and sample payloads.`;
            case 'security':
                return `- **${section.name}** (id: "${sectionId}"): Authentication types (Basic, OAuth, Certificate), credential aliases, security materials, TLS settings, and authorization model.`;
            case 'testing':
                return `- **${section.name}** (id: "${sectionId}"): Test scenarios, expected inputs/outputs, validation criteria, edge cases, and integration test procedures.`;
            case 'troubleshooting':
                return `- **${section.name}** (id: "${sectionId}"): Common failure scenarios with resolution steps, log analysis guidance, monitoring alerts, and decision tree for diagnosis.`;
            case 'configuration':
                return `- **${section.name}** (id: "${sectionId}"): All externalized parameters in a table (Parameter | Default Value | Description | Environment-Specific), value mappings, and configuration best practices.`;
            case 'deployment':
                return `- **${section.name}** (id: "${sectionId}"): Step-by-step deployment procedures, prerequisites, transport configuration, environment setup, and post-deployment verification.`;
            default:
                return `- **${section.name}** (id: "${sectionId}"): ${section.description}`;
        }
    }).filter(Boolean).join('\n');

    return `Generate a comprehensive ${getDocumentTypeTitle(documentationType)} for the following SAP CPI iFlow. Include ALL technical details — every adapter property, script logic, and configuration must be documented thoroughly.

## iFlow Information
**Name:** ${metadata.name}
**Description:** ${metadata.description || 'N/A'}
**Version:** ${metadata.version || '1.0.0'}
**Total Processing Steps:** ${metadata.totalSteps}
**Parallel Processing:** ${metadata.hasParallelProcessing ? 'Yes' : 'No'}
**Loop Processing:** ${metadata.hasLoops ? 'Yes' : 'No'}

## Adapters (${metadata.adapters.length})
${adapterDetails || 'No adapters configured'}

## Scripts (${metadata.scripts.length})
${scriptDetails || 'No scripts configured'}

## Message Mappings (${metadata.mappings.length})
${mappingSummary || 'No mappings configured'}

## Error Handlers (${metadata.errorHandlers.length})
${errorHandlerDetails || 'No error handlers configured'}

## Routes (${metadata.routes.length})
${routingDetails || 'No routes configured'}

---

## REQUIRED SECTIONS TO GENERATE

You MUST generate EXACTLY ${sections.length} sections, one for each entry below. Use the EXACT "id" values provided:
${sectionDetails}

## Content Guidelines for Each Section

${sectionContentGuidelines}

Include Mermaid diagrams where appropriate. Use proper Markdown formatting with tables, lists, and code blocks.
Adapter configuration MUST use Markdown tables (| Property | Value | Description |).

IMPORTANT MERMAID RULES:
1. Keep node labels SHORT (2-4 words)
2. NO special characters except spaces, hyphens, underscores
3. Use square brackets [ ] for ALL nodes
4. Keep edge labels SHORT (3-4 words max)
5. Use graph LR for flow diagrams

Respond with ONLY a JSON object (no wrapping code blocks) in this format:
{
  "sections": [
    {
      "id": "the-exact-id-from-above",
      "title": "Section Title",
      "content": "Detailed Markdown content..."
    }
  ],
  "diagrams": [
    {
      "id": "diagram-id",
      "title": "Diagram Title",
      "type": "flowchart",
      "mermaidCode": "graph LR\\n    A[Start] --> B[End]"
    }
  ]
}

CRITICAL RULES:
1. Return ONLY valid JSON. No text before or after. No markdown code block wrappers.
2. The "sections" array MUST have exactly ${sections.length} entries — one per required section.
3. Each section "id" MUST match exactly one of: ${sections.map(s => `"${s}"`).join(', ')}.
4. Content must use pure Markdown — NO HTML tags.`;
}

function parseDocumentationResponse(
    response: string,
    metadata: IFlowDocMetadata,
    documentationType: DocumentationType,
    requestedSections?: string[]
): GeneratedDocument {
    // Step 1: Use the battle-tested JSON cleaner pipeline
    let json = cleanAIJson(response);

    // Step 2: Try direct parse
    let parsed: any = null;
    try {
        parsed = JSON.parse(json);
    } catch (firstError) {
        const errorMsg = firstError instanceof Error ? firstError.message : String(firstError);
        console.warn(`[DocGenerator] Direct parse failed: ${errorMsg}`);

        // Step 3: Try state-machine repair for unescaped quotes
        try {
            const smFixed = fixUnescapedQuotesStateMachine(json);
            parsed = JSON.parse(smFixed);
        } catch {
            // continue
        }

        // Step 4: Progressive repair strategies
        if (!parsed) {
            let repaired = json;
            const repairs: { name: string; fn: (s: string) => string }[] = [
                {
                    name: 'Fix trailing commas',
                    fn: (s) => s.replace(/,(\s*[}\]])/g, '$1'),
                },
                {
                    name: 'Fix multiple commas',
                    fn: (s) => s.replace(/,(\s*,)+/g, ','),
                },
                {
                    name: 'Normalize smart quotes',
                    fn: (s) =>
                        s
                            .replace(/[\u2018\u2019]/g, "'")
                            .replace(/[\u201C\u201D]/g, '"')
                            .replace(/[\uFEFF\u200B-\u200D\u2060]/g, ''),
                },
                {
                    name: 'Escape unescaped newlines in strings',
                    fn: (s) =>
                        s.replace(/"([^"]*)"/g, (_match, content: string) => {
                            const fixed = content
                                .replace(/(?<!\\)\n/g, '\\n')
                                .replace(/(?<!\\)\r/g, '\\r')
                                .replace(/(?<!\\)\t/g, '\\t');
                            return `"${fixed}"`;
                        }),
                },
                {
                    name: 'Truncate long strings (>2000 chars)',
                    fn: (s) => {
                        let r = s.replace(/"([^"]{2000,})"/g, (_m, content: string) => {
                            return `"${content.slice(0, 1997)}..."`;
                        });
                        r = r.replace(/,(\s*[}\]])/g, '$1');
                        return r;
                    },
                },
            ];

            for (const repair of repairs) {
                repaired = repair.fn(repaired);
                try {
                    parsed = JSON.parse(repaired);
                    console.log(`[DocGenerator] Repair succeeded: ${repair.name}`);
                    break;
                } catch {
                    // Continue to next
                }
            }

            // Step 5: State-machine repair on the fully-repaired string
            if (!parsed) {
                try {
                    const smFixed = fixUnescapedQuotesStateMachine(repaired);
                    parsed = JSON.parse(smFixed);
                } catch {
                    // continue
                }
            }

            // Step 6: Iterative position-based fixing
            if (!parsed) {
                let iterJson = repaired;
                for (let attempt = 0; attempt < 10; attempt++) {
                    try {
                        parsed = JSON.parse(iterJson);
                        break;
                    } catch (iterError) {
                        const msg = iterError instanceof Error ? iterError.message : String(iterError);
                        const pMatch = msg.match(/position\s+(\d+)/i);
                        if (!pMatch) break;
                        const errPos = parseInt(pMatch[1]);
                        if (errPos >= iterJson.length) break;
                        const fixed = tryFixAtPosition(iterJson, errPos);
                        if (fixed === iterJson) break;
                        iterJson = fixed;
                    }
                }
            }

            // Step 7: Try regex-based section extraction from the original response
            if (!parsed) {
                const extractedSections = extractSectionsFromRawText(repaired);
                if (extractedSections.length > 0) {
                    parsed = { sections: extractedSections, diagrams: [] };
                    console.warn(`[DocGenerator] Extracted ${extractedSections.length} sections via regex fallback`);
                }
            }

            // Step 8: Nuclear — strip all strings > 500 chars to get structure only
            if (!parsed) {
                try {
                    let nuclear = repaired.replace(/"([^"]{500,})"/g, '"[content simplified]"');
                    nuclear = nuclear.replace(/,(\s*[}\]])/g, '$1');
                    const nuclearParsed = JSON.parse(nuclear);
                    console.warn('[DocGenerator] Used nuclear string truncation to parse');

                    // Try to recover actual content from original text for each section
                    if (Array.isArray(nuclearParsed.sections)) {
                        for (const section of nuclearParsed.sections) {
                            if (section.content === '[content simplified]' && section.id) {
                                const recovered = recoverSectionContent(repaired, section.id);
                                if (recovered) {
                                    section.content = recovered;
                                }
                            }
                        }
                    }
                    parsed = nuclearParsed;
                } catch {
                    // Fall through to fallback
                }
            }
        }
    }

    // If all parsing failed, return fallback document
    if (!parsed) {
        console.error("[DocGenerator] All parse attempts failed, using fallback document");
        return generateFallbackDocument(metadata, documentationType, requestedSections);
    }

    // Validate and build document from parsed result
    let sections: DocumentSectionContent[] = Array.isArray(parsed.sections)
        ? parsed.sections.map((s: any, idx: number) => ({
            id: s.id || `section-${idx + 1}`,
            title: stripHtmlTags(s.title || `Section ${idx + 1}`),
            content: stripHtmlTags(s.content || ''),
        }))
        : [];

    console.log(`[DocGenerator] Parsed ${sections.length} sections from AI: [${sections.map(s => s.id).join(', ')}]`);
    if (requestedSections) {
        console.log(`[DocGenerator] Requested sections: [${requestedSections.join(', ')}]`);
    }

    // Reconcile: ensure every requested section is present, in the correct order
    if (requestedSections && requestedSections.length > 0) {
        // Build a lookup that handles fuzzy ID matching
        // The AI may return "architecture-diagram" instead of "architecture",
        // or "error_handling" instead of "error-handling", etc.
        const normalizeId = (id: string) => id.toLowerCase().replace(/[-_\s]+/g, '');
        const sectionsByExactId = new Map(sections.map(s => [s.id, s]));
        const sectionsByNormalizedId = new Map(sections.map(s => [normalizeId(s.id), s]));
        // Also index by normalized title for last-resort matching
        const sectionsByNormalizedTitle = new Map(
            sections.map(s => [normalizeId(s.title), s])
        );

        const reconciled: DocumentSectionContent[] = [];
        const matchedAiIds = new Set<string>();

        for (const reqId of requestedSections) {
            const sectionDef = AVAILABLE_SECTIONS.find(s => s.id === reqId);
            const title = sectionDef?.name || reqId;
            const normalizedReqId = normalizeId(reqId);
            const normalizedTitle = normalizeId(title);

            // Try exact ID match first
            let matched = sectionsByExactId.get(reqId);
            if (!matched) {
                // Try normalized ID match (handles dashes vs underscores vs spaces)
                matched = sectionsByNormalizedId.get(normalizedReqId);
            }
            if (!matched) {
                // Try matching by normalized title (AI might use title as ID)
                matched = sectionsByNormalizedTitle.get(normalizedTitle);
            }
            if (!matched) {
                // Try partial matching — AI might prefix/suffix the ID
                for (const s of sections) {
                    const nid = normalizeId(s.id);
                    const ntitle = normalizeId(s.title);
                    if (nid.includes(normalizedReqId) || normalizedReqId.includes(nid) ||
                        ntitle.includes(normalizedTitle) || normalizedTitle.includes(ntitle)) {
                        matched = s;
                        break;
                    }
                }
            }

            if (matched && matched.content.trim().length > 0 && !matched.content.includes('[content simplified]')) {
                console.log(`[DocGenerator] Section "${reqId}" matched to AI section "${matched.id}"`);
                reconciled.push({ ...matched, id: reqId, title });
                matchedAiIds.add(matched.id);
            } else {
                console.warn(`[DocGenerator] Section "${reqId}" not found or empty in AI response, using placeholder`);
                reconciled.push({
                    id: reqId,
                    title,
                    content: generatePlaceholderContent(reqId, title, metadata),
                });
            }
        }

        // Append any extra AI sections that weren't matched to a requested section
        for (const s of sections) {
            if (!matchedAiIds.has(s.id) && s.content.trim().length > 0 && !s.content.includes('[content simplified]')) {
                reconciled.push(s);
            }
        }

        sections = reconciled;
    }

    const diagrams: MermaidDiagram[] = Array.isArray(parsed.diagrams)
        ? parsed.diagrams.map((d: any, idx: number) => ({
            id: d.id || `diagram-${idx + 1}`,
            title: d.title || `Diagram ${idx + 1}`,
            type: validateDiagramType(d.type),
            mermaidCode: normalizeMermaidCode(d.mermaidCode || ''),
        }))
        : [];

    return {
        title: `${metadata.name} - ${getDocumentTypeTitle(documentationType)}`,
        type: documentationType,
        iflowName: metadata.name,
        version: metadata.version || '1.0.0',
        sections,
        diagrams,
        generatedAt: new Date().toISOString(),
        tokensUsed: 0, // Will be set by caller
    };
}

/**
 * Try to extract section objects from raw AI text using regex when JSON parsing fails.
 * This handles cases where the JSON is valid except for unescaped content in strings.
 */
function extractSectionsFromRawText(rawText: string): Array<{ id: string; title: string; content: string }> {
    const sections: Array<{ id: string; title: string; content: string }> = [];

    // Pattern: find each section object by looking for "id": "...", "title": "...", "content": "..."
    // Use a non-greedy approach to find section boundaries
    const sectionPattern = /"id"\s*:\s*"([^"]+)"\s*,\s*"title"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"/g;
    let match;

    while ((match = sectionPattern.exec(rawText)) !== null) {
        const id = match[1];
        const title = match[2];
        const contentStart = match.index + match[0].length;

        // Find the end of content string — look for the closing quote that's followed by } or ,
        // We need to handle escaped quotes within the content
        let depth = 0;
        let pos = contentStart;
        let content = '';

        while (pos < rawText.length) {
            const ch = rawText[pos];
            if (ch === '\\' && pos + 1 < rawText.length) {
                // Escaped character — skip both
                content += ch + rawText[pos + 1];
                pos += 2;
                continue;
            }
            if (ch === '"') {
                // End of content string
                break;
            }
            content += ch;
            pos++;
        }

        if (content.length > 0) {
            // Unescape the content
            const unescaped = content
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\');
            sections.push({ id, title, content: unescaped });
        }
    }

    return sections;
}

/**
 * Try to recover the actual content for a section from the raw JSON text
 * when nuclear parsing stripped it.
 */
function recoverSectionContent(rawText: string, sectionId: string): string | null {
    // Find the section by ID and extract its content
    const idPattern = new RegExp(`"id"\\s*:\\s*"${sectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*?"content"\\s*:\\s*"`);
    const match = idPattern.exec(rawText);
    if (!match) return null;

    const contentStart = match.index + match[0].length;
    let pos = contentStart;
    let content = '';

    while (pos < rawText.length) {
        const ch = rawText[pos];
        if (ch === '\\' && pos + 1 < rawText.length) {
            content += ch + rawText[pos + 1];
            pos += 2;
            continue;
        }
        if (ch === '"') break;
        content += ch;
        pos++;
    }

    if (content.length > 10) {
        return content
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
    }
    return null;
}

/**
 * Generate meaningful placeholder content for a section the AI missed.
 */
function generatePlaceholderContent(sectionId: string, title: string, metadata: IFlowDocMetadata): string {
    const senderAdapters = metadata.adapters.filter(a => a.direction === 'sender');
    const receiverAdapters = metadata.adapters.filter(a => a.direction === 'receiver');

    switch (sectionId) {
        case 'overview':
            return `## ${title}\n\nThis integration flow (**${metadata.name}**) processes data through ${metadata.totalSteps} steps using ${metadata.adapters.length} adapter(s), ${metadata.scripts.length} script(s), and ${metadata.mappings.length} mapping(s).\n\n${metadata.description ? `**Description:** ${metadata.description}` : '*No description available.*'}\n\n### Key Characteristics\n\n| Attribute | Value |\n|-----------|-------|\n| Total Steps | ${metadata.totalSteps} |\n| Adapters | ${metadata.adapters.length} |\n| Scripts | ${metadata.scripts.length} |\n| Mappings | ${metadata.mappings.length} |\n| Error Handlers | ${metadata.errorHandlers.length} |\n| Parallel Processing | ${metadata.hasParallelProcessing ? 'Yes' : 'No'} |\n| Loop Processing | ${metadata.hasLoops ? 'Yes' : 'No'} |`;

        case 'architecture': {
            let content = `## ${title}\n\nThe integration flow consists of the following components:\n\n`;
            if (senderAdapters.length > 0) content += `### Sender Adapters\n${senderAdapters.map(a => `- **${a.name}** (${a.type}) — ${a.address || 'N/A'}`).join('\n')}\n\n`;
            if (receiverAdapters.length > 0) content += `### Receiver Adapters\n${receiverAdapters.map(a => `- **${a.name}** (${a.type}) — ${a.address || 'N/A'}`).join('\n')}\n\n`;
            if (metadata.scripts.length > 0) content += `### Processing Scripts\n${metadata.scripts.map(s => `- **${s.name}** (${s.type}, ${s.complexity})`).join('\n')}\n\n`;
            if (metadata.mappings.length > 0) content += `### Message Mappings\n${metadata.mappings.map(m => `- **${m.name}** (${m.type})`).join('\n')}\n\n`;
            if (metadata.routes.length > 0) content += `### Routes\n${metadata.routes.map(r => `- To **${r.target}**${r.condition ? ` when \`${r.condition}\`` : ' (default)'}`).join('\n')}\n\n`;
            if (metadata.errorHandlers.length > 0) content += `### Error Handlers\n${metadata.errorHandlers.map(e => `- **${e.type}** — Retry ${e.retryEnabled ? 'enabled' : 'disabled'}`).join('\n')}\n\n`;
            return content;
        }

        case 'data-flow': {
            let content = `## ${title}\n\nThe data flows through the integration in the following sequence:\n\n`;
            let step = 1;
            for (const a of senderAdapters) {
                content += `${step}. **Receive** message via ${a.type} adapter (${a.name})${a.address ? ` from \`${a.address}\`` : ''}\n`;
                step++;
            }
            for (const s of metadata.scripts) {
                content += `${step}. **Process** with ${s.type} script "${s.name}" (${s.complexity} complexity, ${s.linesOfCode} lines)\n`;
                step++;
            }
            for (const m of metadata.mappings) {
                content += `${step}. **Transform** via ${m.type} mapping "${m.name}" (${m.complexity} complexity)\n`;
                step++;
            }
            for (const r of metadata.routes) {
                content += `${step}. **Route** to ${r.target}${r.condition ? ` (condition: \`${r.condition}\`)` : ''}\n`;
                step++;
            }
            for (const a of receiverAdapters) {
                content += `${step}. **Send** message via ${a.type} adapter (${a.name})${a.address ? ` to \`${a.address}\`` : ''}\n`;
                step++;
            }
            return content;
        }

        case 'adapters':
            if (metadata.adapters.length === 0) return `## ${title}\n\nNo adapters are configured in this iFlow.`;
            return `## ${title}\n\n${metadata.adapters.map(a => {
                let detail = `### ${a.name}\n- **Type:** ${a.type}\n- **Direction:** ${a.direction}\n- **Address:** ${a.address || 'N/A'}`;
                if (a.properties && Object.keys(a.properties).length > 0) {
                    detail += '\n\n| Property | Value |\n|----------|-------|\n';
                    for (const [key, value] of Object.entries(a.properties)) {
                        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                        detail += `| \`${key}\` | ${displayValue} |\n`;
                    }
                }
                return detail;
            }).join('\n\n')}`;
        case 'scripts':
            if (metadata.scripts.length === 0) return `## ${title}\n\nNo scripts are configured in this iFlow.`;
            return `## ${title}\n\n${metadata.scripts.map(s => {
                let detail = `### ${s.name}\n- **Type:** ${s.type}\n- **Complexity:** ${s.complexity}\n- **Lines of Code:** ${s.linesOfCode}`;
                if (s.content) {
                    detail += `\n\n\`\`\`groovy\n${s.content.slice(0, 2000)}\n\`\`\``;
                }
                return detail;
            }).join('\n\n')}`;
        case 'error-handling':
            if (metadata.errorHandlers.length === 0) return `## ${title}\n\nNo error handlers are configured in this iFlow.`;
            return `## ${title}\n\n${metadata.errorHandlers.map(e => `- **${e.type}**: Retry ${e.retryEnabled ? `enabled (max ${e.maxRetries || 'N/A'})` : 'disabled'}`).join('\n')}`;
        case 'mappings':
            if (metadata.mappings.length === 0) return `## ${title}\n\nNo message mappings are configured in this iFlow.`;
            return `## ${title}\n\n${metadata.mappings.map(m => `- **${m.name}** (${m.type}, ${m.complexity} complexity)`).join('\n')}`;
        case 'endpoints': {
            const httpAdapters = metadata.adapters.filter(a => ['HTTP', 'HTTPS', 'REST', 'SOAP', 'OData'].some(t => a.type.toUpperCase().includes(t)));
            if (httpAdapters.length === 0) return `## ${title}\n\nNo API endpoints are exposed by this iFlow.`;
            return `## ${title}\n\n${httpAdapters.map(a => `### ${a.name}\n- **Type:** ${a.type}\n- **Direction:** ${a.direction}\n- **Address:** ${a.address || 'N/A'}`).join('\n\n')}`;
        }
        case 'security': {
            const securityProps = metadata.adapters.flatMap(a => {
                const props = Object.entries(a.properties || {}).filter(([k]) =>
                    /auth|credential|certificate|security|token|oauth|ssl|tls|key/i.test(k)
                );
                return props.length > 0 ? [{ adapter: a.name, props }] : [];
            });
            if (securityProps.length === 0) return `## ${title}\n\nNo explicit security configuration found. Review adapter properties for authentication settings.`;
            return `## ${title}\n\n${securityProps.map(s => `### ${s.adapter}\n${s.props.map(([k, v]) => `- **${k}:** ${v}`).join('\n')}`).join('\n\n')}`;
        }
        case 'configuration': {
            const allProps = metadata.adapters.flatMap(a =>
                Object.entries(a.properties || {}).map(([k, v]) => ({ adapter: a.name, key: k, value: v }))
            );
            if (allProps.length === 0) return `## ${title}\n\nNo externalized parameters found.`;
            return `## ${title}\n\n| Adapter | Parameter | Value |\n|---------|-----------|-------|\n${allProps.map(p => `| ${p.adapter} | \`${p.key}\` | ${typeof p.value === 'object' ? JSON.stringify(p.value) : String(p.value)} |`).join('\n')}`;
        }
        case 'testing':
            return `## ${title}\n\n### Recommended Test Scenarios\n\n1. **Happy Path**: Send a valid message through the flow and verify end-to-end processing\n2. **Error Handling**: Test with invalid input to verify error handlers trigger correctly\n3. **Timeout**: Test with delayed responses to verify retry logic\n${metadata.adapters.map((a, i) => `${i + 4}. **${a.name}**: Verify ${a.type} ${a.direction} adapter connectivity`).join('\n')}`;
        case 'troubleshooting':
            return `## ${title}\n\n### Common Issues\n\n| Issue | Possible Cause | Resolution |\n|-------|---------------|------------|\n| Connection timeout | Network/firewall | Check connectivity to adapter endpoints |\n| Authentication failure | Expired credentials | Refresh security materials |\n| Mapping error | Schema mismatch | Validate source/target schemas |\n| Script error | Runtime exception | Check script logs and input data |`;
        case 'deployment':
            return `## ${title}\n\n### Deployment Checklist\n\n1. Verify all externalized parameters are configured for the target environment\n2. Ensure security materials (certificates, credentials) are deployed\n3. Validate adapter endpoint connectivity\n4. Deploy the iFlow package\n5. Activate the iFlow and verify in monitoring`;
        default:
            return `## ${title}\n\n*Detailed content for this section could not be generated. Please regenerate the document.*`;
    }
}

/**
 * Strip HTML tags from AI-generated content while preserving the text.
 * The AI sometimes returns <br>, <table>, <p>, etc. mixed into markdown.
 */
function stripHtmlTags(text: string): string {
    return text
        // Replace <br>, <br/>, <br /> with newlines
        .replace(/<br\s*\/?>/gi, '\n')
        // Replace </p>, </div>, </li>, </tr> with newlines (block-level closing tags)
        .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, '\n')
        // Replace <hr> / <hr/> with markdown horizontal rule
        .replace(/<hr\s*\/?>/gi, '\n---\n')
        // Strip all remaining HTML tags
        .replace(/<[^>]+>/g, '')
        // Decode common HTML entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        // Clean up excessive blank lines
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function validateDiagramType(type: string): 'flowchart' | 'sequence' | 'class' | 'state' {
    const validTypes = ['flowchart', 'sequence', 'class', 'state'];
    return validTypes.includes(type?.toLowerCase()) 
        ? type.toLowerCase() as 'flowchart' | 'sequence' | 'class' | 'state'
        : 'flowchart';
}

/**
 * Normalize Mermaid code from AI response:
 * - Convert literal \n strings to actual newlines
 * - Remove markdown code block wrappers
 * - Sanitize special characters in node labels
 * - Fix common Mermaid syntax issues
 */
function normalizeMermaidCode(code: string): string {
    let normalized = code;

    // Strip markdown code block wrappers if present
    normalized = normalized.replace(/^```(?:mermaid)?\s*\n?/i, '').replace(/\n?```\s*$/, '');

    // Convert literal \n to actual newlines (AI often escapes them in JSON strings)
    normalized = normalized.replace(/\\n/g, '\n');

    // Convert literal \t to spaces
    normalized = normalized.replace(/\\t/g, '    ');

    // Fix common issues: TD → TB (Mermaid deprecated TD)
    normalized = normalized.replace(/^(\s*graph\s+)TD/m, '$1TB');

    // Convert round-bracket node labels to square brackets ONLY for node definitions
    // Pattern: starts with whitespace + alphanumeric ID + ( label )
    // Avoid matching keywords like "subgraph", "end", "participant", "Note"
    const mermaidKeywords = /^(graph|subgraph|end|participant|note|loop|alt|opt|par|rect|classDef|class|click|style|linkStyle|sequenceDiagram|gantt|pie|flowchart|stateDiagram|erDiagram|journey|gitGraph|mindmap)/i;
    normalized = normalized.split('\n').map(line => {
        const trimmed = line.trim();
        // Skip keyword lines and edge-only lines
        if (mermaidKeywords.test(trimmed) || trimmed.startsWith('-->') || trimmed.startsWith('---') || trimmed.startsWith('->>')) {
            return line;
        }
        // Replace node(label) with node[label] only when preceded by a node ID
        return line.replace(/\b([A-Za-z_]\w*)\(([^)]+)\)/g, '$1[$2]');
    }).join('\n');

    // Sanitize node labels: remove problematic chars inside square brackets
    normalized = normalized.replace(/\[([^\]]+)\]/g, (_match, label: string) => {
        const sanitized = label
            .replace(/[;:|\\@#$%&*]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        return `[${sanitized}]`;
    });

    // Sanitize edge labels inside |...|
    normalized = normalized.replace(/\|([^|]+)\|/g, (_match, label: string) => {
        const sanitized = label
            .replace(/[;:\\@#$%&*{}[\]()]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        return `|${sanitized}|`;
    });

    // Remove empty lines between graph declaration and first node (can confuse parser)
    normalized = normalized.replace(/(graph\s+(?:LR|TB|RL|BT))\n(\s*\n)+/m, '$1\n');

    // Trim trailing whitespace on each line and remove excessive blank lines
    normalized = normalized
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return normalized;
}

function generateFallbackDocument(
    metadata: IFlowDocMetadata,
    documentationType: DocumentationType,
    requestedSections?: string[]
): GeneratedDocument {
    // Determine which sections to generate
    const sectionIds = requestedSections && requestedSections.length > 0
        ? requestedSections
        : ['overview', 'adapters', 'scripts', 'error-handling'];

    const sections: DocumentSectionContent[] = sectionIds.map(sectionId => {
        const sectionDef = AVAILABLE_SECTIONS.find(s => s.id === sectionId);
        const title = sectionDef?.name || sectionId;
        return {
            id: sectionId,
            title,
            content: generatePlaceholderContent(sectionId, title, metadata),
        };
    });

    // Generate basic flow diagram
    const diagrams: MermaidDiagram[] = [{
        id: 'flow-diagram',
        title: 'Integration Flow Diagram',
        type: 'flowchart',
        mermaidCode: generateBasicFlowDiagram(metadata),
    }];

    return {
        title: `${metadata.name} - ${getDocumentTypeTitle(documentationType)}`,
        type: documentationType,
        iflowName: metadata.name,
        version: metadata.version || '1.0.0',
        sections,
        diagrams,
        generatedAt: new Date().toISOString(),
        tokensUsed: 0,
    };
}

function generateBasicFlowDiagram(metadata: IFlowDocMetadata): string {
    const senderAdapters = metadata.adapters.filter(a => a.direction === 'sender');
    const receiverAdapters = metadata.adapters.filter(a => a.direction === 'receiver');

    let diagram = 'graph LR\n';
    
    // Add sender
    if (senderAdapters.length > 0) {
        const sender = senderAdapters[0];
        diagram += `    A[${sanitizeNodeLabel(sender.name)}] -->|${sender.type}| B[Integration Flow]\n`;
    } else {
        diagram += `    A[Source] --> B[Integration Flow]\n`;
    }

    // Add processing steps
    if (metadata.scripts.length > 0) {
        diagram += `    B --> C[Processing]\n`;
        diagram += `    C --> D[Transform]\n`;
    } else if (metadata.mappings.length > 0) {
        diagram += `    B --> D[Transform]\n`;
    } else {
        diagram += `    B --> D[Process]\n`;
    }

    // Add receiver
    if (receiverAdapters.length > 0) {
        const receiver = receiverAdapters[0];
        diagram += `    D -->|${receiver.type}| E[${sanitizeNodeLabel(receiver.name)}]\n`;
    } else {
        diagram += `    D --> E[Target]\n`;
    }

    return diagram;
}

function sanitizeNodeLabel(label: string): string {
    // Remove special characters and truncate for Mermaid compatibility
    return label
        .replace(/[(),.;:|/\\@#$%&*]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 20);
}
