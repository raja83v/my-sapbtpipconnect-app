// ============================================================================
// Documentation Generator Types
// ============================================================================

export interface IFlowForDocGenerator {
    id: string;
    name: string;
    status: string;
    iFlowId: string;
}

export type DocumentationType = 
    | "technical-spec"      // Technical specification
    | "user-guide"          // End-user documentation
    | "ops-runbook"         // Operational runbook
    | "api-docs"            // API documentation
    | "deployment-guide";   // Deployment/config guide

export interface DocumentSection {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
}

export const AVAILABLE_SECTIONS: DocumentSection[] = [
    { id: "overview", name: "Overview & Purpose", description: "High-level description of the integration", enabled: true },
    { id: "architecture", name: "Architecture Diagram", description: "Visual representation of the flow", enabled: true },
    { id: "data-flow", name: "Data Flow Description", description: "Step-by-step data transformation", enabled: true },
    { id: "adapters", name: "Adapter Configuration", description: "Connection and protocol details", enabled: true },
    { id: "mappings", name: "Message Mappings", description: "Field mapping and transformations", enabled: true },
    { id: "scripts", name: "Scripts & Logic", description: "Custom script documentation", enabled: true },
    { id: "error-handling", name: "Error Handling", description: "Exception handling and retry logic", enabled: true },
    { id: "endpoints", name: "API Endpoints", description: "REST/SOAP endpoint specifications", enabled: false },
    { id: "security", name: "Security Configuration", description: "Authentication and authorization", enabled: false },
    { id: "testing", name: "Testing Guidelines", description: "Test scenarios and validation", enabled: false },
    { id: "troubleshooting", name: "Troubleshooting Guide", description: "Common issues and solutions", enabled: false },
    { id: "configuration", name: "Configuration Parameters", description: "Externalized parameters", enabled: false },
    { id: "deployment", name: "Deployment Steps", description: "Installation and setup guide", enabled: false },
];

export interface IFlowDocMetadata {
    name: string;
    description?: string;
    version?: string;
    adapters: Array<{
        id: string;
        name: string;
        type: string;
        direction: 'sender' | 'receiver';
        address?: string;
        properties: Record<string, any>;
    }>;
    scripts: Array<{
        id: string;
        name: string;
        type: string;
        content: string;
        linesOfCode: number;
        complexity: string;
    }>;
    mappings: Array<{
        id: string;
        name: string;
        type: string;
        complexity: string;
    }>;
    errorHandlers: Array<{
        id: string;
        type: string;
        retryEnabled: boolean;
        maxRetries?: number;
    }>;
    routes: Array<{
        id: string;
        condition?: string;
        target: string;
    }>;
    totalSteps: number;
    hasParallelProcessing: boolean;
    hasLoops: boolean;
}

export interface DocumentSectionContent {
    id: string;
    title: string;
    content: string;  // Markdown content
}

export interface MermaidDiagram {
    id: string;
    title: string;
    type: 'flowchart' | 'sequence' | 'class' | 'state';
    mermaidCode: string;
}

export interface GeneratedDocument {
    title: string;
    type: DocumentationType;
    iflowName: string;
    version: string;
    sections: DocumentSectionContent[];
    diagrams: MermaidDiagram[];
    generatedAt: string;
    tokensUsed: number;
}

// Helper function to get document type title
export function getDocumentTypeTitle(type: DocumentationType): string {
    const titles: Record<DocumentationType, string> = {
        "technical-spec": "Technical Specification",
        "user-guide": "User Guide",
        "ops-runbook": "Operational Runbook",
        "api-docs": "API Documentation",
        "deployment-guide": "Deployment Guide",
    };
    return titles[type] || type;
}

// Helper function to generate markdown export
export function generateMarkdownExportSync(document: GeneratedDocument): string {
    let markdown = `# ${document.title}\n\n`;
    markdown += `> Generated on ${new Date(document.generatedAt).toLocaleString()}\n\n`;
    markdown += `**iFlow:** ${document.iflowName} (v${document.version})\n\n`;
    markdown += `**Document Type:** ${getDocumentTypeTitle(document.type)}\n\n`;
    markdown += `---\n\n`;

    // Table of Contents
    markdown += `## Table of Contents\n\n`;
    document.sections.forEach((section, idx) => {
        const anchor = section.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        markdown += `${idx + 1}. [${section.title}](#${anchor})\n`;
    });
    if (document.diagrams.length > 0) {
        markdown += `${document.sections.length + 1}. [Diagrams](#diagrams)\n`;
    }
    markdown += `\n---\n\n`;

    // Sections
    document.sections.forEach(section => {
        markdown += `## ${section.title}\n\n`;
        markdown += `${section.content}\n\n`;
    });

    // Diagrams
    if (document.diagrams.length > 0) {
        markdown += `## Diagrams\n\n`;
        document.diagrams.forEach(diagram => {
            markdown += `### ${diagram.title}\n\n`;
            markdown += '```mermaid\n';
            markdown += diagram.mermaidCode;
            markdown += '\n```\n\n';
        });
    }

    return markdown;
}
