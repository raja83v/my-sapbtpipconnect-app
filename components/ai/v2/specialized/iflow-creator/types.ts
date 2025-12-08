/**
 * Type definitions for iFlow Creator AI Agent
 */

// Step 1: Package Selection
export interface PackageSelection {
    mode: 'new' | 'existing';
    packageId?: string;
    packageName?: string;
    packageDescription?: string;
    iflowId?: string; // For existing mode - the iFlow to update (optional - if not set, create new)
    iflowName?: string; // For existing mode - the iFlow name
    createNewIFlow?: boolean; // If true, create new iFlow in existing package instead of updating
}

// Step 2: User Input
export interface IFlowDescription {
    description: string;
    sourceSystem?: string;
    targetSystem?: string;
    dataFormat?: string;
    requirements?: string[];
}

// Adapter Configuration
export interface AdapterConfig {
    id: string;
    name: string;
    type: 'SOAP' | 'REST' | 'SFTP' | 'HTTPS' | 'XI' | 'AS2' | 'IDOC' | 'JDBC' | 'OData';
    direction: 'Sender' | 'Receiver';
    protocol: 'HTTP' | 'HTTPS' | 'TCP' | 'SFTP' | 'FTP';
    messageProtocol?: string;
    address?: string;
    timeout?: number;
    connectionTimeout?: number;
    poolSize?: number;
    authentication?: {
        type: 'Basic' | 'OAuth' | 'Certificate' | 'None';
        credentials?: string;
    };
    properties?: Record<string, string>;
}

// Script Configuration
export interface ScriptConfig {
    id: string;
    name: string;
    type: 'groovy' | 'javascript' | 'xslt';
    purpose: string;
    scriptPath: string;
    scriptContent?: string;
    complexity: 'low' | 'medium' | 'high';
    estimatedLines?: number;
}

// Mapping Configuration
export interface MappingConfig {
    id: string;
    name: string;
    type: 'MessageMapping' | 'XSLTMapping' | 'Enricher' | 'Splitter' | 'Aggregator';
    sourceFields?: string[];
    targetFields?: string[];
    transformations?: string[];
    complexity: 'low' | 'medium' | 'high';
}

// Error Handler Configuration
export interface ErrorHandlerConfig {
    id: string;
    name: string;
    errorType: 'Exception' | 'Timeout' | 'ValidationError';
    retryCount?: number;
    retryInterval?: number;
    alertOnFailure?: boolean;
    fallbackAction?: string;
}

// Flow Node (for visual diagram)
export interface FlowNode {
    id: string;
    type: 'start' | 'end' | 'adapter' | 'script' | 'mapping' | 'error';
    name: string;
    position: { x: number; y: number };
    connections: string[]; // IDs of connected nodes
}

// Step 3: AI-Generated Design
export interface IFlowDesign {
    metadata: {
        name: string;
        id: string;
        description: string;
        version: string;
    };
    adapters: AdapterConfig[];
    scripts: ScriptConfig[];
    mappings: MappingConfig[];
    errorHandlers: ErrorHandlerConfig[];
    flowDiagram: FlowNode[];
    estimatedComplexity: 'low' | 'medium' | 'high';
    performanceNotes: string[];
    securityNotes?: string[];
}

// Step 4: User Modifications
export interface UserModifications {
    adapters?: Partial<AdapterConfig>[];
    scripts?: Partial<ScriptConfig>[];
    mappings?: Partial<MappingConfig>[];
    errorHandlers?: Partial<ErrorHandlerConfig>[];
    additionalNotes?: string;
}

// Step 5: Creation Result
export interface CreationResult {
    success: boolean;
    iflowId: string;
    packageId: string;
    deploymentUrl?: string;
    errors?: string[];
    warnings?: string[];
}

// Wizard State
export interface WizardState {
    currentStep: number;
    packageSelection?: PackageSelection;
    description?: IFlowDescription;
    design?: IFlowDesign;
    modifications?: UserModifications;
    result?: CreationResult;
}

// SAP CPI Package (from API)
export interface SAPCPIPackage {
    Id: string;
    Name: string;
    Description: string;
    Version: string;
    Vendor?: string;
    CreatedBy?: string;
    CreatedAt?: string;
    ModifiedBy?: string;
    ModifiedAt?: string;
}

// SAP CPI iFlow (from API)
export interface SAPCPIIFlow {
    Id: string;
    Name: string;
    Description?: string;
    Version: string;
    PackageId: string;
    CreatedBy?: string;
    CreatedAt?: string;
    ModifiedBy?: string;
    ModifiedAt?: string;
}

// Template for common patterns
export interface IFlowTemplate {
    id: string;
    name: string;
    description: string;
    category: 'integration' | 'transformation' | 'orchestration' | 'migration';
    template: string; // Pre-filled description
    tags: string[];
}