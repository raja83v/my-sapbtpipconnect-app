/**
 * BPMN2 XML Parser for SAP Cloud Platform Integration
 * 
 * Parses BPMN2 XML files from SAP CPI iFlow packages to extract:
 * - Adapter configurations from messageFlow elements
 * - Script content from callActivity elements
 * - Message mappings and transformations
 * - Error handling configurations
 * - Performance-critical settings
 */

import { XMLParser } from 'fast-xml-parser';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const log = (..._args: any[]) => {};

// ============================================================================
// Type Definitions
// ============================================================================

export interface BPMN2ParseResult {
    adapters: AdapterInfo[];
    scripts: ScriptInfo[];
    mappings: MappingInfo[];
    errorHandlers: ErrorHandlerInfo[];
    routes: RouteInfo[];
    metadata: IFlowMetadata;
}

export interface AdapterInfo {
    id: string;
    name: string;
    type: string;
    direction: 'sender' | 'receiver';
    address?: string;

    // Connection settings
    connectionTimeout?: number;
    responseTimeout?: number;
    poolSize?: number;
    maxConnections?: number;

    // Adapter-specific properties
    properties: Record<string, any>;

    // Performance indicators
    performanceIssues: string[];
}

export interface ScriptInfo {
    id: string;
    name: string;
    type: 'Groovy' | 'JavaScript' | 'XSLT';
    content: string;
    linesOfCode: number;
    complexity: 'simple' | 'medium' | 'complex';
    issues: string[];
}

export interface MappingInfo {
    id: string;
    name: string;
    type: 'MessageMapping' | 'XSLT' | 'OperationMapping' | 'Enricher';
    source?: string;
    target?: string;
    complexity: 'simple' | 'medium' | 'complex';
}

export interface ErrorHandlerInfo {
    id: string;
    type: string;
    retryEnabled: boolean;
    maxRetries?: number;
    retryInterval?: number;
}

export interface RouteInfo {
    id: string;
    condition?: string;
    target: string;
}

export interface IFlowMetadata {
    name: string;
    description?: string;
    version?: string;
    totalSteps: number;
    hasParallelProcessing: boolean;
    hasLoops: boolean;
}

// ============================================================================
// BPMN2 Parser Class
// ============================================================================

export class BPMN2Parser {
    private parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseAttributeValue: false, // Keep as strings to avoid type issues
            trimValues: true,
        });
    }

    /**
     * Parse BPMN2 XML content
     */
    parse(xmlContent: string): BPMN2ParseResult {
        log('🔍 Starting BPMN2 parse...');
        log('📄 XML length:', xmlContent.length, 'bytes');

        try {
            const parsed = this.parser.parse(xmlContent);
            log('✅ XML parsed successfully');
            log('📊 Parsed structure keys:', Object.keys(parsed));

            // Navigate to BPMN definitions
            const definitions = parsed['bpmn2:definitions'] || parsed.definitions;
            if (!definitions) {
                log('❌ No definitions found!');
                throw new Error('Invalid BPMN2 XML: No definitions found');
            }
            log('✅ Found definitions');

            // Get collaboration (contains messageFlows for adapters)
            const collaboration = definitions['bpmn2:collaboration'];
            log('🔍 Collaboration:', collaboration ? 'Found' : 'Not found');

            // Get all processes (may be array or single object)
            const processes = this.ensureArray(definitions['bpmn2:process'] || definitions.process);
            log(`✅ Found ${processes.length} process(es)`);

            // Extract from all processes
            let allScripts: ScriptInfo[] = [];
            let allMappings: MappingInfo[] = [];
            let allErrorHandlers: ErrorHandlerInfo[] = [];
            let allRoutes: RouteInfo[] = [];

            for (const process of processes) {
                allScripts.push(...this.extractScripts(process));
                allMappings.push(...this.extractMappings(process));
                allErrorHandlers.push(...this.extractErrorHandlers(process));
                allRoutes.push(...this.extractRoutes(process));
            }

            // Extract adapters from collaboration messageFlows
            const adapters = this.extractAdapters(collaboration);
            log(`✅ Extracted ${adapters.length} adapters`);
            log(`✅ Extracted ${allScripts.length} scripts`);
            log(`✅ Extracted ${allMappings.length} mappings`);

            return {
                adapters,
                scripts: allScripts,
                mappings: allMappings,
                errorHandlers: allErrorHandlers,
                routes: allRoutes,
                metadata: this.extractMetadata(processes[0], definitions),
            };
        } catch (error) {
            log('❌ Error parsing BPMN2 XML:', error);
            throw error;
        }
    }

    /**
     * Extract adapter configurations from messageFlow elements
     */
    private extractAdapters(collaboration: any): AdapterInfo[] {
        const adapters: AdapterInfo[] = [];

        if (!collaboration) {
            log('⚠️ No collaboration element found');
            return adapters;
        }

        // Get all messageFlow elements
        const messageFlows = this.ensureArray(collaboration['bpmn2:messageFlow']);
        log(`🔍 Found ${messageFlows.length} messageFlow elements`);

        for (const flow of messageFlows) {
            const adapter = this.parseMessageFlowAdapter(flow);
            if (adapter) {
                adapters.push(adapter);
            }
        }

        return adapters;
    }

    /**
     * Parse adapter from messageFlow element
     */
    private parseMessageFlowAdapter(flow: any): AdapterInfo | null {
        const id = flow['@_id'] || '';
        const name = flow['@_name'] || id;

        // Get extension elements for adapter configuration
        const extensionElements = flow['bpmn2:extensionElements'];
        if (!extensionElements) {
            return null;
        }

        // Parse ifl:property elements
        const properties = this.parseIflProperties(extensionElements['ifl:property']);

        // Determine adapter type and direction
        const componentType = properties.ComponentType || properties.componentType || 'Unknown';
        const direction = (properties.direction || 'receiver').toLowerCase() as 'sender' | 'receiver';
        const transportProtocol = properties.TransportProtocol || properties.transportProtocol || '';
        const messageProtocol = properties.MessageProtocol || properties.messageProtocol || '';

        // Build adapter type string
        let adapterType = componentType;
        if (messageProtocol) {
            adapterType = `${componentType} (${messageProtocol})`;
        }

        // Extract performance-critical settings
        const requestTimeout = this.parseNumber(properties.requestTimeout);
        const connectionTimeout = this.parseNumber(properties.connectionTimeout);
        const poolSize = this.parseNumber(properties.NumberConcurrentProcesses_outbound);

        // Detect performance issues
        const performanceIssues = this.detectAdapterIssues({
            type: componentType,
            connectionTimeout,
            responseTimeout: requestTimeout,
            poolSize,
            properties,
        });

        return {
            id,
            name,
            type: adapterType,
            direction,
            address: properties.Address || properties.address,
            connectionTimeout,
            responseTimeout: requestTimeout,
            poolSize,
            properties,
            performanceIssues,
        };
    }

    /**
     * Extract scripts from callActivity elements
     */
    private extractScripts(process: any): ScriptInfo[] {
        const scripts: ScriptInfo[] = [];

        // Get all callActivity elements
        const callActivities = this.ensureArray(process['bpmn2:callActivity']);
        log(`🔍 Found ${callActivities.length} callActivity elements in process`);

        for (const activity of callActivities) {
            const script = this.parseCallActivityScript(activity);
            if (script) {
                scripts.push(script);
            }
        }

        return scripts;
    }

    /**
     * Parse script from callActivity element
     */
    private parseCallActivityScript(activity: any): ScriptInfo | null {
        const id = activity['@_id'] || '';
        const name = activity['@_name'] || id;

        // Get extension elements
        const extensionElements = activity['bpmn2:extensionElements'];
        if (!extensionElements) {
            return null;
        }

        // Parse properties
        const properties = this.parseIflProperties(extensionElements['ifl:property']);

        // Check if this is a script activity
        const activityType = properties.activityType;
        const subActivityType = properties.subActivityType;

        if (activityType !== 'Script') {
            return null;
        }

        // Determine script type
        let type: 'Groovy' | 'JavaScript' | 'XSLT' = 'Groovy';
        if (subActivityType === 'JavaScriptScript') {
            type = 'JavaScript';
        } else if (subActivityType === 'XSLTScript') {
            type = 'XSLT';
        }

        // Get script content (would need to read from separate file in real implementation)
        const scriptFile = properties.script || '';
        const content = `// Script file: ${scriptFile}\n// Type: ${type}\n// (Content would be loaded from ${scriptFile})`;

        // Estimate complexity based on name and type
        const linesOfCode = 50; // Placeholder
        const complexity: 'simple' | 'medium' | 'complex' = 'medium';
        const issues: string[] = [];

        return {
            id,
            name,
            type,
            content,
            linesOfCode,
            complexity,
            issues,
        };
    }

    /**
     * Extract message mappings
     */
    private extractMappings(process: any): MappingInfo[] {
        const mappings: MappingInfo[] = [];

        const callActivities = this.ensureArray(process['bpmn2:callActivity']);

        for (const activity of callActivities) {
            const mapping = this.parseMapping(activity);
            if (mapping) {
                mappings.push(mapping);
            }
        }

        return mappings;
    }

    /**
     * Parse individual mapping
     */
    private parseMapping(activity: any): MappingInfo | null {
        const id = activity['@_id'] || '';
        const name = activity['@_name'] || id;

        const extensionElements = activity['bpmn2:extensionElements'];
        if (!extensionElements) {
            return null;
        }

        const properties = this.parseIflProperties(extensionElements['ifl:property']);
        const activityType = properties.activityType;

        // Check if this is a mapping/enricher activity
        if (activityType === 'Enricher') {
            return {
                id,
                name,
                type: 'Enricher',
                complexity: 'simple',
            };
        }

        return null;
    }

    /**
     * Extract error handlers
     */
    private extractErrorHandlers(process: any): ErrorHandlerInfo[] {
        const handlers: ErrorHandlerInfo[] = [];

        // Look for subProcess with error handling
        const subProcesses = this.ensureArray(process['bpmn2:subProcess']);

        for (const subProcess of subProcesses) {
            const startEvents = this.ensureArray(subProcess['bpmn2:startEvent']);

            for (const startEvent of startEvents) {
                const errorEventDef = startEvent['bpmn2:errorEventDefinition'];
                if (errorEventDef) {
                    handlers.push({
                        id: subProcess['@_id'] || '',
                        type: 'ErrorEventSubProcess',
                        retryEnabled: false,
                    });
                }
            }
        }

        return handlers;
    }

    /**
     * Extract routing conditions
     */
    private extractRoutes(process: any): RouteInfo[] {
        const routes: RouteInfo[] = [];

        const exclusiveGateways = this.ensureArray(process['bpmn2:exclusiveGateway']);

        for (const gateway of exclusiveGateways) {
            const outgoing = this.ensureArray(gateway['bpmn2:outgoing']);

            for (const flow of outgoing) {
                routes.push({
                    id: gateway['@_id'] || '',
                    target: typeof flow === 'string' ? flow : flow['#text'] || '',
                });
            }
        }

        return routes;
    }

    /**
     * Extract metadata
     */
    private extractMetadata(process: any, definitions: any): IFlowMetadata {
        const name = process['@_name'] || definitions['@_name'] || 'Unknown';

        // Count total steps
        const callActivities = this.ensureArray(process['bpmn2:callActivity']);
        const serviceTasks = this.ensureArray(process['bpmn2:serviceTask']);
        const totalSteps = callActivities.length + serviceTasks.length;

        // Check for parallel processing
        const parallelGateways = this.ensureArray(process['bpmn2:parallelGateway']);
        const hasParallelProcessing = parallelGateways.length > 0;

        // Check for loops
        const hasLoops = false; // Simplified for now

        return {
            name,
            totalSteps,
            hasParallelProcessing,
            hasLoops,
        };
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private ensureArray<T>(value: T | T[] | undefined): T[] {
        if (!value) return [];
        return Array.isArray(value) ? value : [value];
    }

    /**
     * Parse ifl:property elements (SAP CPI specific format)
     */
    private parseIflProperties(properties: any): Record<string, any> {
        const result: Record<string, any> = {};
        const props = this.ensureArray(properties);

        for (const prop of props) {
            // SAP CPI uses <key> and <value> child elements
            const key = prop.key || prop['#text'];
            const value = prop.value;

            if (key) {
                result[key] = value || '';
            }
        }

        return result;
    }

    private parseNumber(value: any): number | undefined {
        if (!value) return undefined;
        const num = parseInt(String(value), 10);
        return isNaN(num) ? undefined : num;
    }

    private detectAdapterIssues(config: {
        type: string;
        connectionTimeout?: number;
        responseTimeout?: number;
        poolSize?: number;
        properties: Record<string, any>;
    }): string[] {
        const issues: string[] = [];

        // Check for missing timeouts
        if (!config.connectionTimeout && !config.responseTimeout) {
            issues.push('No timeout configured - may cause hanging connections');
        } else if (config.responseTimeout && config.responseTimeout > 60000) {
            issues.push(`Response timeout too high (${config.responseTimeout}ms) - consider reducing`);
        }

        // Check pool size
        if (config.poolSize && config.poolSize < 2) {
            issues.push(`Small concurrent process limit (${config.poolSize}) - may cause bottlenecks under load`);
        }

        return issues;
    }
}

/**
 * Create a new BPMN2 parser instance
 */
export function createBPMN2Parser(): BPMN2Parser {
    return new BPMN2Parser();
}