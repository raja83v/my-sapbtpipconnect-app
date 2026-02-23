"use server";

import { getCurrentUser } from "./user";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/types/actions";
import { runText } from "@/lib/ai/runtime/text";
import { createSAPCPIClient, type SAPCPICredentials } from "@/lib/sap-cpi/client";
import type { BPMN2ParseResult } from "@/lib/sap-cpi/bpmn2-parser";
import type {
    IFlowForDocGenerator,
    DocumentationType,
    IFlowDocMetadata,
    GeneratedDocument,
    DocumentSectionContent,
    MermaidDiagram,
} from "@/types/documentation-generator";
import { getDocumentTypeTitle, AVAILABLE_SECTIONS } from "@/types/documentation-generator";

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
        const membership = await prisma.tenantMember.findUnique({
            where: { userId_tenantId: { userId: currentUser.id, tenantId } },
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Get tenant details for SAP CPI connection
        const tenant = await prisma.cpiTenant.findUnique({
            where: { id: tenantId },
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
            clientId: tenant.clientId,
            clientSecret: tenant.clientSecret,
            username: tenant.username,
            password: tenant.password,
            tokenUrl: effectiveTokenUrl,
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
        const membership = await prisma.tenantMember.findUnique({
            where: { userId_tenantId: { userId: currentUser.id, tenantId } },
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Get tenant details for SAP CPI connection
        const tenant = await prisma.cpiTenant.findUnique({
            where: { id: tenantId },
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
            clientId: tenant.clientId,
            clientSecret: tenant.clientSecret,
            username: tenant.username,
            password: tenant.password,
            tokenUrl: effectiveTokenUrl,
        };

        const cpiClient = createSAPCPIClient(cpiCredentials);

        // Download and parse BPMN2 XML
        let bpmn2ParseResult: BPMN2ParseResult | null = null;
        try {
            console.log("Downloading and parsing BPMN2 for iFlow:", iflowId);
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
        const membership = await prisma.tenantMember.findUnique({
            where: { userId_tenantId: { userId: currentUser.id, tenantId } },
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Build the documentation prompt
        const contextPrompt = buildDocumentationPrompt(metadata, documentationType, sections);

        // Generate documentation using AI
        const result = await runText({
            prompt: contextPrompt,
            temperature: 0.3,
        });
        const fullText = result.text;
        const totalTokens = result.usage.totalTokens || 0;

        // Parse the AI response
        const document = parseDocumentationResponse(fullText, metadata, documentationType);

        // Track execution in database
        const durationMs = Date.now() - startTime;
        await prisma.aIAgentExecution.create({
            data: {
                agentType: "DOCUMENTATION_GENERATOR",
                tenantId: tenantId,
                iflowId: iflowId,
                userId: currentUser.id,
                tokensUsed: totalTokens,
                duration: durationMs,
                success: true,
                input: JSON.stringify({ documentationType, sections, iflowName: metadata.name }),
                output: JSON.stringify({ sectionsGenerated: document.sections.length }),
            },
        });

        return { success: true, data: { ...document, tokensUsed: totalTokens } };
    } catch (error) {
        console.error("Error generating documentation:", error);

        // Track failed execution
        try {
            const currentUser = await getCurrentUser();
            if (currentUser) {
                await prisma.aIAgentExecution.create({
                    data: {
                        agentType: "DOCUMENTATION_GENERATOR",
                        tenantId: params.tenantId,
                        iflowId: params.iflowId,
                        userId: currentUser.id,
                        tokensUsed: 0,
                        duration: Date.now() - startTime,
                        success: false,
                        input: JSON.stringify({ documentationType: params.documentationType, sections: params.sections }),
                        output: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
                    },
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
    // Build adapter summary
    const adapterSummary = metadata.adapters.map(a => 
        `- **${a.name}** (${a.type}, ${a.direction}): ${a.address || 'N/A'}`
    ).join('\n');

    // Build script summary
    const scriptSummary = metadata.scripts.map(s => 
        `- **${s.name}** (${s.type}, ${s.complexity} complexity, ${s.linesOfCode} lines)`
    ).join('\n');

    // Build mapping summary
    const mappingSummary = metadata.mappings.map(m => 
        `- **${m.name}** (${m.type}, ${m.complexity} complexity)`
    ).join('\n');

    // Build error handler summary
    const errorHandlerSummary = metadata.errorHandlers.map(e => 
        `- **${e.type}**: Retry ${e.retryEnabled ? `enabled (max ${e.maxRetries || 'N/A'} retries)` : 'disabled'}`
    ).join('\n');

    // Build routing summary
    const routingSummary = metadata.routes.map(r => 
        `- Route to **${r.target}**${r.condition ? `: ${r.condition}` : ''}`
    ).join('\n');

    // Get section definitions
    const sectionDetails = sections.map(sectionId => {
        const section = AVAILABLE_SECTIONS.find(s => s.id === sectionId);
        return section ? `- **${section.name}**: ${section.description}` : `- ${sectionId}`;
    }).join('\n');

    return `You are a technical documentation specialist for SAP Cloud Platform Integration (CPI).

Generate professional ${getDocumentTypeTitle(documentationType)} documentation for the following iFlow.

## iFlow Information
**Name:** ${metadata.name}
**Description:** ${metadata.description || 'N/A'}
**Version:** ${metadata.version || '1.0.0'}
**Total Steps:** ${metadata.totalSteps}
**Has Parallel Processing:** ${metadata.hasParallelProcessing ? 'Yes' : 'No'}
**Has Loops:** ${metadata.hasLoops ? 'Yes' : 'No'}

## Adapters (${metadata.adapters.length})
${adapterSummary || 'No adapters configured'}

## Scripts (${metadata.scripts.length})
${scriptSummary || 'No scripts configured'}

## Message Mappings (${metadata.mappings.length})
${mappingSummary || 'No mappings configured'}

## Error Handlers (${metadata.errorHandlers.length})
${errorHandlerSummary || 'No error handlers configured'}

## Routes (${metadata.routes.length})
${routingSummary || 'No routes configured'}

---

## Documentation Requirements

**Document Type:** ${getDocumentTypeTitle(documentationType)}
**Sections to Include:**
${sectionDetails}

---

## Output Format

Generate documentation in Markdown format. For each section, provide comprehensive content appropriate for a ${getDocumentTypeTitle(documentationType)}.

Include Mermaid diagrams where appropriate using this syntax:
\`\`\`mermaid
graph LR
    A[Node A] --> B[Node B]
\`\`\`

IMPORTANT MERMAID RULES:
1. Keep node labels SHORT (2-4 words max)
2. NO special characters except spaces, hyphens, underscores
3. Use square brackets [ ] for all nodes
4. Keep edge labels SHORT (3-4 words max)

Respond with a JSON object in this exact format:
{
  "sections": [
    {
      "id": "section-id",
      "title": "Section Title",
      "content": "Markdown content with proper formatting..."
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

CRITICAL: Return ONLY the JSON object, no additional text or markdown code blocks around it.`;
}

function parseDocumentationResponse(
    response: string,
    metadata: IFlowDocMetadata,
    documentationType: DocumentationType
): GeneratedDocument {
    try {
        // Clean up the response - remove markdown code blocks if present
        let cleanedResponse = response.trim();
        
        // Remove markdown code blocks
        if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.slice(7);
        } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.slice(3);
        }
        if (cleanedResponse.endsWith('```')) {
            cleanedResponse = cleanedResponse.slice(0, -3);
        }
        cleanedResponse = cleanedResponse.trim();

        // Try to find JSON object in the response
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanedResponse = jsonMatch[0];
        }

        const parsed = JSON.parse(cleanedResponse);
        
        // Validate sections
        const sections: DocumentSectionContent[] = Array.isArray(parsed.sections) 
            ? parsed.sections.map((s: any, idx: number) => ({
                id: s.id || `section-${idx + 1}`,
                title: s.title || `Section ${idx + 1}`,
                content: s.content || '',
            }))
            : [];

        // Validate diagrams
        const diagrams: MermaidDiagram[] = Array.isArray(parsed.diagrams)
            ? parsed.diagrams.map((d: any, idx: number) => ({
                id: d.id || `diagram-${idx + 1}`,
                title: d.title || `Diagram ${idx + 1}`,
                type: validateDiagramType(d.type),
                mermaidCode: d.mermaidCode || '',
            }))
            : [];

        return {
            title: `${getDocumentTypeTitle(documentationType)} - ${metadata.name}`,
            type: documentationType,
            iflowName: metadata.name,
            version: metadata.version || '1.0.0',
            sections,
            diagrams,
            generatedAt: new Date().toISOString(),
            tokensUsed: 0, // Will be set by caller
        };
    } catch (error) {
        console.error("Error parsing AI response:", error);
        return generateFallbackDocument(metadata, documentationType);
    }
}

function validateDiagramType(type: string): 'flowchart' | 'sequence' | 'class' | 'state' {
    const validTypes = ['flowchart', 'sequence', 'class', 'state'];
    return validTypes.includes(type?.toLowerCase()) 
        ? type.toLowerCase() as 'flowchart' | 'sequence' | 'class' | 'state'
        : 'flowchart';
}

function generateFallbackDocument(
    metadata: IFlowDocMetadata,
    documentationType: DocumentationType
): GeneratedDocument {
    const sections: DocumentSectionContent[] = [];

    // Overview section
    sections.push({
        id: 'overview',
        title: 'Overview',
        content: `# ${metadata.name}

${metadata.description || 'This integration flow handles data transformation and routing between connected systems.'}

## Key Characteristics

- **Total Steps:** ${metadata.totalSteps}
- **Parallel Processing:** ${metadata.hasParallelProcessing ? 'Enabled' : 'Disabled'}
- **Loop Processing:** ${metadata.hasLoops ? 'Yes' : 'No'}
- **Adapters:** ${metadata.adapters.length}
- **Scripts:** ${metadata.scripts.length}
- **Mappings:** ${metadata.mappings.length}
- **Error Handlers:** ${metadata.errorHandlers.length}
`,
    });

    // Adapters section
    if (metadata.adapters.length > 0) {
        const adapterContent = metadata.adapters.map(adapter => 
            `### ${adapter.name}

- **Type:** ${adapter.type}
- **Direction:** ${adapter.direction}
- **Address:** ${adapter.address || 'N/A'}
`
        ).join('\n');

        sections.push({
            id: 'adapters',
            title: 'Adapter Configuration',
            content: `# Adapter Configuration\n\n${adapterContent}`,
        });
    }

    // Error handling section
    if (metadata.errorHandlers.length > 0) {
        const errorContent = metadata.errorHandlers.map(handler =>
            `### ${handler.type}

- **Retry Enabled:** ${handler.retryEnabled ? 'Yes' : 'No'}
${handler.retryEnabled && handler.maxRetries ? `- **Max Retries:** ${handler.maxRetries}` : ''}
`
        ).join('\n');

        sections.push({
            id: 'error-handling',
            title: 'Error Handling',
            content: `# Error Handling\n\n${errorContent}`,
        });
    }

    // Generate basic flow diagram
    const diagrams: MermaidDiagram[] = [{
        id: 'flow-diagram',
        title: 'Integration Flow Diagram',
        type: 'flowchart',
        mermaidCode: generateBasicFlowDiagram(metadata),
    }];

    return {
        title: `${getDocumentTypeTitle(documentationType)} - ${metadata.name}`,
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
