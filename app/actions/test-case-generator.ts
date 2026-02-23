"use server";

import { getCurrentUser } from "./user";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/types/actions";
import { runText } from "@/lib/ai/runtime/text";
import { createSAPCPIClient, type SAPCPICredentials } from "@/lib/sap-cpi/client";
import type { BPMN2ParseResult } from "@/lib/sap-cpi/bpmn2-parser";

// ============================================================================
// Types
// ============================================================================

export interface IFlowForTestGenerator {
    id: string;
    name: string;
    status: string;
    iFlowId: string;
}

export interface IFlowMetadata {
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

export interface TestCase {
    id: string;
    name: string;
    category: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    preconditions: string[];
    steps: Array<{
        step: number;
        action: string;
        expectedResult: string;
    }>;
    testData?: {
        input: Record<string, any>;
        expectedOutput: Record<string, any>;
    };
    automationHints?: string[];
}

export interface TestCaseGenerationResult {
    iflowName: string;
    totalTestCases: number;
    categories: {
        functional: number;
        integration: number;
        error: number;
        performance: number;
        security: number;
    };
    testCases: TestCase[];
    coverage: {
        adaptersTotal: number;
        adaptersCovered: number;
        scriptsTotal: number;
        scriptsCovered: number;
        mappingsTotal: number;
        mappingsCovered: number;
        errorHandlersTotal: number;
        errorHandlersCovered: number;
    };
    generatedAt: string;
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Get iFlows for Test Case Generator - fetches directly from SAP CPI API
 */
export async function getIFlowsForTestGenerator(params: {
    tenantId: string;
}): Promise<ActionResult<IFlowForTestGenerator[]>> {
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
        const simplifiedIFlows: IFlowForTestGenerator[] = deployedIFlows.map((iflow) => ({
            id: iflow.Id, // Use SAP CPI ID as the ID
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
 * Get iFlow metadata by fetching and parsing BPMN2 from SAP CPI
 * iflowId is now the SAP CPI artifact ID directly (not database ID)
 */
export async function getIFlowMetadata(params: {
    tenantId: string;
    iflowId: string; // This is now the SAP CPI artifact ID
}): Promise<ActionResult<IFlowMetadata>> {
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

        // Download and parse BPMN2 XML using the SAP CPI artifact ID directly
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
        const metadata: IFlowMetadata = {
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
 * Generate test cases using AI
 */
export async function generateTestCases(params: {
    tenantId: string;
    iflowId: string;
    metadata: IFlowMetadata;
    categories: string[];
}): Promise<ActionResult<TestCaseGenerationResult>> {
    const startTime = Date.now();

    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return { success: false, error: "Not authenticated" };
        }

        const { tenantId, iflowId, metadata, categories } = params;

        // Validate tenant access
        const membership = await prisma.tenantMember.findUnique({
            where: { userId_tenantId: { userId: currentUser.id, tenantId } },
        });

        if (!membership) {
            return { success: false, error: "You don't have access to this tenant" };
        }

        // Build the context prompt for AI
        const contextPrompt = buildTestCasePrompt(metadata, categories);

        // Generate test cases using AI
        const result = await runText({
            prompt: contextPrompt,
            temperature: 0.4,
        });
        const fullText = result.text;
        const totalTokens = result.usage.totalTokens || 0;

        // Parse the AI response
        const testCases = parseTestCasesResponse(fullText, metadata);

        // Track execution in database
        const durationMs = Date.now() - startTime;
        await prisma.aIAgentExecution.create({
            data: {
                agentType: "TEST_CASE_GENERATOR",
                tenantId: tenantId,
                iflowId: iflowId,
                userId: currentUser.id,
                tokensUsed: totalTokens,
                duration: durationMs,
                success: true,
                input: JSON.stringify({ categories, iflowId, iflowName: metadata.name }),
                output: JSON.stringify({ testCasesGenerated: testCases.length }),
            },
        });

        // Calculate coverage
        const coverage = calculateCoverage(testCases, metadata);

        const generationResult: TestCaseGenerationResult = {
            iflowName: metadata.name,
            totalTestCases: testCases.length,
            categories: {
                functional: testCases.filter(t => t.category === 'functional').length,
                integration: testCases.filter(t => t.category === 'integration').length,
                error: testCases.filter(t => t.category === 'error').length,
                performance: testCases.filter(t => t.category === 'performance').length,
                security: testCases.filter(t => t.category === 'security').length,
            },
            testCases,
            coverage,
            generatedAt: new Date().toISOString(),
        };

        return { success: true, data: generationResult };
    } catch (error) {
        console.error("Error generating test cases:", error);

        // Track failed execution
        try {
            const currentUser = await getCurrentUser();
            if (currentUser) {
                await prisma.aIAgentExecution.create({
                    data: {
                        agentType: "TEST_CASE_GENERATOR",
                        tenantId: params.tenantId,
                        iflowId: params.iflowId,
                        userId: currentUser.id,
                        tokensUsed: 0,
                        duration: Date.now() - startTime,
                        success: false,
                        input: JSON.stringify({ categories: params.categories, iflowId: params.iflowId }),
                        output: error instanceof Error ? error.message : "Unknown error",
                    },
                });
            }
        } catch (trackError) {
            console.error("Error tracking failed execution:", trackError);
        }

        return { success: false, error: error instanceof Error ? error.message : "Failed to generate test cases" };
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildTestCasePrompt(metadata: IFlowMetadata, categories: string[]): string {
    const selectedCategories = categories.length > 0 ? categories : ['functional', 'integration', 'error', 'performance', 'security'];

    // Build adapter summary
    const adapterSummary = metadata.adapters.map(a => 
        `- ${a.name} (${a.type}, ${a.direction}): ${a.address || 'N/A'}`
    ).join('\n');

    // Build script summary
    const scriptSummary = metadata.scripts.map(s => 
        `- ${s.name} (${s.type}, ${s.complexity} complexity, ${s.linesOfCode} lines)`
    ).join('\n');

    // Build mapping summary
    const mappingSummary = metadata.mappings.map(m => 
        `- ${m.name} (${m.type}, ${m.complexity} complexity)`
    ).join('\n');

    // Build error handler summary
    const errorHandlerSummary = metadata.errorHandlers.map(e => 
        `- ${e.type}: Retry ${e.retryEnabled ? `enabled (max ${e.maxRetries || 'N/A'} retries)` : 'disabled'}`
    ).join('\n');

    // Build routing summary
    const routingSummary = metadata.routes.map(r => 
        `- Route to ${r.target}${r.condition ? `: ${r.condition}` : ''}`
    ).join('\n');

    return `You are an expert SAP CPI integration test engineer. Generate comprehensive test cases for the following iFlow.

## iFlow Information
**Name:** ${metadata.name}
**Description:** ${metadata.description || 'N/A'}
**Version:** ${metadata.version || 'N/A'}
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

## Test Categories to Generate
${selectedCategories.map(c => `- ${c}`).join('\n')}

---

Generate test cases for the selected categories. For each test case, provide:
1. A unique ID (format: TC-XXX-NNN where XXX is category abbreviation)
2. Clear, descriptive name
3. Priority (critical, high, medium, low)
4. Detailed description
5. Preconditions
6. Step-by-step test steps with expected results
7. Test data (if applicable)
8. Automation hints (if applicable)

**Category Guidelines:**
- **Functional**: Test happy path scenarios, data transformations, business logic
- **Integration**: Test adapter connectivity, endpoint availability, message exchange
- **Error**: Test error handling, retry mechanisms, exception scenarios
- **Performance**: Test response times, throughput, resource utilization
- **Security**: Test authentication, authorization, data encryption

Respond ONLY with a valid JSON array of test case objects. No markdown, no explanations, just the JSON array.

Example format:
[
  {
    "id": "TC-FUN-001",
    "name": "Verify successful message processing",
    "category": "functional",
    "priority": "critical",
    "description": "Test that the iFlow correctly processes a valid input message and produces the expected output",
    "preconditions": ["iFlow is deployed and active", "Source system is available"],
    "steps": [
      {"step": 1, "action": "Send a valid test message to the sender endpoint", "expectedResult": "Message is received without errors"},
      {"step": 2, "action": "Verify message transformation", "expectedResult": "Message is transformed according to mapping rules"}
    ],
    "testData": {
      "input": {"field1": "value1"},
      "expectedOutput": {"transformedField": "transformedValue"}
    },
    "automationHints": ["Can be automated using Postman", "Use correlation ID for tracking"]
  }
]`;
}

function parseTestCasesResponse(response: string, metadata: IFlowMetadata): TestCase[] {
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

        // Try to find JSON array in the response
        const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            cleanedResponse = jsonMatch[0];
        }

        const parsed = JSON.parse(cleanedResponse);
        
        if (!Array.isArray(parsed)) {
            console.error("AI response is not an array");
            return generateFallbackTestCases(metadata);
        }

        // Validate and transform each test case
        return parsed.map((tc: any, index: number) => ({
            id: tc.id || `TC-GEN-${String(index + 1).padStart(3, '0')}`,
            name: tc.name || `Test Case ${index + 1}`,
            category: validateCategory(tc.category),
            priority: validatePriority(tc.priority),
            description: tc.description || '',
            preconditions: Array.isArray(tc.preconditions) ? tc.preconditions : [],
            steps: Array.isArray(tc.steps) ? tc.steps.map((s: any, i: number) => ({
                step: s.step || i + 1,
                action: s.action || '',
                expectedResult: s.expectedResult || '',
            })) : [],
            testData: tc.testData || undefined,
            automationHints: Array.isArray(tc.automationHints) ? tc.automationHints : undefined,
        }));
    } catch (error) {
        console.error("Error parsing AI response:", error);
        return generateFallbackTestCases(metadata);
    }
}

function validateCategory(category: string): string {
    const validCategories = ['functional', 'integration', 'error', 'performance', 'security'];
    return validCategories.includes(category?.toLowerCase()) ? category.toLowerCase() : 'functional';
}

function validatePriority(priority: string): 'critical' | 'high' | 'medium' | 'low' {
    const validPriorities = ['critical', 'high', 'medium', 'low'];
    return validPriorities.includes(priority?.toLowerCase()) 
        ? priority.toLowerCase() as 'critical' | 'high' | 'medium' | 'low'
        : 'medium';
}

function generateFallbackTestCases(metadata: IFlowMetadata): TestCase[] {
    const testCases: TestCase[] = [];

    // Generate basic functional test
    testCases.push({
        id: 'TC-FUN-001',
        name: `Verify ${metadata.name} happy path`,
        category: 'functional',
        priority: 'critical',
        description: `Test the standard successful execution path of the ${metadata.name} iFlow`,
        preconditions: ['iFlow is deployed and active', 'All connected systems are available'],
        steps: [
            { step: 1, action: 'Prepare valid test message', expectedResult: 'Test message created' },
            { step: 2, action: 'Send message to iFlow endpoint', expectedResult: 'Message received successfully' },
            { step: 3, action: 'Verify processing completes', expectedResult: 'Message processed without errors' },
            { step: 4, action: 'Validate output', expectedResult: 'Output matches expected format' },
        ],
    });

    // Generate integration tests for each adapter
    metadata.adapters.forEach((adapter, index) => {
        testCases.push({
            id: `TC-INT-${String(index + 1).padStart(3, '0')}`,
            name: `Test ${adapter.name} connectivity`,
            category: 'integration',
            priority: adapter.direction === 'sender' ? 'critical' : 'high',
            description: `Verify the ${adapter.type} adapter ${adapter.name} can connect and exchange messages`,
            preconditions: [`${adapter.type} endpoint is available`, 'Network connectivity is established'],
            steps: [
                { step: 1, action: `Test connection to ${adapter.address || 'endpoint'}`, expectedResult: 'Connection established' },
                { step: 2, action: 'Send test message', expectedResult: 'Message transmitted successfully' },
                { step: 3, action: 'Verify response received', expectedResult: 'Valid response returned' },
            ],
        });
    });

    // Generate error test for error handlers
    metadata.errorHandlers.forEach((handler, index) => {
        testCases.push({
            id: `TC-ERR-${String(index + 1).padStart(3, '0')}`,
            name: `Test ${handler.type} error handling`,
            category: 'error',
            priority: 'high',
            description: `Verify ${handler.type} error handler works correctly${handler.retryEnabled ? ' with retry mechanism' : ''}`,
            preconditions: ['iFlow is deployed', 'Error scenario can be simulated'],
            steps: [
                { step: 1, action: 'Trigger error condition', expectedResult: 'Error is detected' },
                { step: 2, action: 'Verify error handler activates', expectedResult: 'Error handler processes the exception' },
                { step: 3, action: handler.retryEnabled ? 'Verify retry mechanism' : 'Verify error is logged', 
                  expectedResult: handler.retryEnabled ? `Retry attempted (max ${handler.maxRetries || 'N/A'})` : 'Error logged correctly' },
            ],
        });
    });

    return testCases;
}

function calculateCoverage(testCases: TestCase[], metadata: IFlowMetadata): {
    adaptersTotal: number;
    adaptersCovered: number;
    scriptsTotal: number;
    scriptsCovered: number;
    mappingsTotal: number;
    mappingsCovered: number;
    errorHandlersTotal: number;
    errorHandlersCovered: number;
} {
    // Simple coverage calculation based on test case presence
    const hasIntegrationTests = testCases.some(t => t.category === 'integration');
    const hasFunctionalTests = testCases.some(t => t.category === 'functional');
    const hasErrorTests = testCases.some(t => t.category === 'error');

    return {
        adaptersTotal: metadata.adapters.length,
        adaptersCovered: hasIntegrationTests ? Math.min(testCases.filter(t => t.category === 'integration').length, metadata.adapters.length) : 0,
        scriptsTotal: metadata.scripts.length,
        scriptsCovered: hasFunctionalTests ? Math.min(Math.ceil(testCases.filter(t => t.category === 'functional').length * 0.5), metadata.scripts.length) : 0,
        mappingsTotal: metadata.mappings.length,
        mappingsCovered: hasFunctionalTests ? Math.min(testCases.filter(t => t.category === 'functional').length, metadata.mappings.length) : 0,
        errorHandlersTotal: metadata.errorHandlers.length,
        errorHandlersCovered: hasErrorTests ? Math.min(testCases.filter(t => t.category === 'error').length, metadata.errorHandlers.length) : 0,
    };
}
