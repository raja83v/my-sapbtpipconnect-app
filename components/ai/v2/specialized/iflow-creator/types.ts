/**
 * Type definitions for iFlow Creator AI Agent
 * Comprehensive SAP CPI integration flow components
 */

// ============================================================================
// ADAPTER TYPES - Complete SAP CPI Adapter Support (50+ adapters)
// ============================================================================

// Cloud Connectors
export type CloudAdapterType =
    | 'HTTP' | 'HTTPS' | 'SOAP' | 'SOAP_SAP_RM' | 'REST'
    | 'OData' | 'OData_V2' | 'OData_V4'
    | 'SFTP' | 'FTP' | 'FTPS'
    | 'Mail' | 'IMAP' | 'POP3' | 'SMTP'
    | 'JDBC'
    | 'IDoc' | 'XI' | 'RFC'
    | 'AS2' | 'AS4';

// Message Queuing Adapters
export type MessagingAdapterType =
    | 'JMS' | 'AMQP' | 'Kafka' | 'SAP_Event_Mesh' | 'AzureServiceBus';

// Cloud Application Adapters
export type CloudAppAdapterType =
    | 'Salesforce' | 'SuccessFactors' | 'SuccessFactors_SOAP' | 'SuccessFactors_REST' | 'SuccessFactors_OData'
    | 'Ariba' | 'Ariba_Network'
    | 'Workday' | 'ServiceNow'
    | 'MicrosoftDynamics' | 'MicrosoftDynamics365'
    | 'Twitter' | 'Facebook' | 'Slack'
    | 'Dropbox' | 'GoogleDrive' | 'Box'
    | 'SAP_Concur' | 'SAP_FieldGlass' | 'SAP_IBP' | 'SAP_C4C';

// Infrastructure Adapters
export type InfraAdapterType =
    | 'ProcessDirect' | 'DataStore' | 'DataStoreSelect'
    | 'AmazonS3' | 'AmazonSQS' | 'AmazonSNS' | 'AmazonDynamoDB'
    | 'AzureBlob' | 'AzureCosmosDB'
    | 'OpenConnectors' | 'ELSTER' | 'MDI';

// Combined adapter type
export type AdapterType = CloudAdapterType | MessagingAdapterType | CloudAppAdapterType | InfraAdapterType;

// Protocol types
export type ProtocolType = 'HTTP' | 'HTTPS' | 'TCP' | 'SFTP' | 'FTP' | 'FTPS' | 'AMQP' | 'AMQPS' | 'KAFKA' | 'MQTT' | 'MQTTS';

// Authentication types
export type AuthenticationType =
    | 'None' | 'Basic' | 'OAuth' | 'OAuth2' | 'OAuth2_ClientCredentials' | 'OAuth2_SAML'
    | 'Certificate' | 'ClientCertificate' | 'PrincipalPropagation'
    | 'SAML' | 'APIKey' | 'AWS_Signature' | 'Azure_AD';

// ============================================================================
// STEP 1: Package Selection
// ============================================================================

export interface PackageSelection {
    mode: 'new' | 'existing';
    packageId?: string;
    packageName?: string;
    packageDescription?: string;
    iflowId?: string;
    iflowName?: string;
    createNewIFlow?: boolean;
}

// ============================================================================
// STEP 2: User Input
// ============================================================================

export interface IFlowDescription {
    description: string;
    sourceSystem?: string;
    targetSystem?: string;
    dataFormat?: string;
    requirements?: string[];
    triggerType?: 'message' | 'timer' | 'event';
    schedulingConfig?: SchedulerConfig;
}

// Scheduler Configuration
export interface SchedulerConfig {
    type: 'simple' | 'cron';
    simpleSchedule?: {
        runOnce?: boolean;
        repeatInterval?: number; // seconds
        repeatCount?: number; // -1 for indefinite
    };
    cronExpression?: string; // e.g., "0 0 */2 * * ?"
    timezone?: string;
}

// ============================================================================
// ADAPTER CONFIGURATION
// ============================================================================

export interface AdapterConfig {
    id: string;
    name: string;
    type: AdapterType;
    direction: 'Sender' | 'Receiver';
    protocol: ProtocolType;
    messageProtocol?: string;
    address?: string;
    timeout?: number;
    connectionTimeout?: number;
    poolSize?: number;
    authentication?: {
        type: AuthenticationType;
        credentials?: string;
        credentialName?: string; // Security artifact name
        oauthConfig?: OAuthConfig;
    };
    properties?: Record<string, string>;
    // JMS/Messaging specific
    queueName?: string;
    topicName?: string;
    // Mail specific
    mailServer?: string;
    mailPort?: number;
    // Kafka specific
    kafkaBrokers?: string;
    kafkaGroupId?: string;
    // AWS specific
    awsRegion?: string;
    awsBucket?: string;
    // ProcessDirect specific
    processDirect?: {
        address: string;
    };
}

export interface OAuthConfig {
    tokenEndpoint?: string;
    clientId?: string;
    clientSecret?: string;
    scope?: string;
    grantType?: 'client_credentials' | 'authorization_code' | 'password' | 'jwt_bearer';
}

// ============================================================================
// SAP-SPECIFIC ADAPTER CONFIGURATIONS (RFC, IDoc, XI)
// ============================================================================

/**
 * RFC Adapter Configuration
 * Used to call RFC function modules in SAP ABAP systems
 * Requires SAP Cloud Connector for on-premise systems
 */
export interface RFCAdapterConfig extends Omit<AdapterConfig, 'type'> {
    type: 'RFC';
    direction: 'Receiver'; // RFC is always Receiver adapter in CPI

    // Connection Settings
    rfcDestination?: string; // Cloud Connector destination name
    sapClient?: string; // SAP client number (e.g., "100")
    sapLanguage?: string; // Language code (e.g., "EN")

    // Function Module Settings
    functionModule?: string; // RFC function module name
    importParameters?: RFCParameter[];
    exportParameters?: RFCParameter[];
    tableParameters?: RFCParameter[];
    changingParameters?: RFCParameter[];

    // Transaction Settings
    transactionCommit?: boolean;
    queueName?: string; // For transactional RFC (tRFC)

    // Advanced Settings
    rfcType?: 'synchronous' | 'transactional' | 'queued' | 'background';
    trfcEnabled?: boolean;
    qrfcEnabled?: boolean;
    timeout?: number; // RFC call timeout in seconds
}

export interface RFCParameter {
    name: string;
    type: 'IMPORT' | 'EXPORT' | 'TABLE' | 'CHANGING';
    dataType?: string;
    value?: string;
    expressionType?: 'Constant' | 'Property' | 'Header' | 'XPath';
}

/**
 * IDoc Adapter Configuration
 * Used for EDI/B2B document exchange with SAP ERP systems
 * Supports sending and receiving IDoc messages
 */
export interface IDocAdapterConfig extends Omit<AdapterConfig, 'type'> {
    type: 'IDoc';

    // Connection Settings (for Receiver)
    idocDestination?: string; // Cloud Connector destination
    sapClient?: string;
    sapLanguage?: string;

    // IDoc Settings
    idocType?: string; // IDoc type (e.g., "ORDERS05", "INVOIC02")
    idocExtension?: string; // IDoc extension type
    messageType?: string; // IDoc message type
    basicType?: string; // IDoc basic type

    // Partner Settings
    senderPartnerNumber?: string;
    senderPartnerType?: 'LS' | 'KU' | 'LI' | 'US'; // Logical System, Customer, Vendor, User
    receiverPartnerNumber?: string;
    receiverPartnerType?: 'LS' | 'KU' | 'LI' | 'US';
    senderPort?: string;
    receiverPort?: string;

    // Control Record Settings
    sendrprn?: string; // Sender partner number
    sndpor?: string; // Sender port
    rcvprn?: string; // Receiver partner number
    rcvpor?: string; // Receiver port
    mestyp?: string; // Message type
    idoctyp?: string; // IDoc type
    cimtyp?: string; // Extension type

    // Processing Settings
    idocVersion?: '3' | '4'; // IDoc version
    testMode?: boolean;
    serialization?: 'Synchronous' | 'Asynchronous';
    packageSize?: number; // Number of IDocs per package

    // For Sender adapter (inbound from SAP)
    contentType?: 'Application/x-sap.idoc' | 'Text/XML';
}

/**
 * XI Adapter Configuration
 * Used for integration with SAP PI/PO (Process Integration/Orchestration)
 * Enables communication using XI protocol
 */
export interface XIAdapterConfig extends Omit<AdapterConfig, 'type'> {
    type: 'XI';

    // XI Connection Settings
    xiUrl?: string; // PI/PO system URL
    senderService?: string; // XI sender service
    senderParty?: string; // XI sender party
    senderAgency?: string; // XI sender agency
    senderScheme?: string; // XI sender scheme

    // Receiver Settings (for Receiver adapter)
    receiverService?: string;
    receiverParty?: string;
    receiverAgency?: string;
    receiverScheme?: string;

    // Interface Settings
    interfaceNamespace?: string; // XI interface namespace
    interfaceName?: string; // XI interface name
    operationName?: string; // XI operation name

    // Quality of Service
    qualityOfService?: 'BestEffort' | 'ExactlyOnce' | 'ExactlyOnceInOrder';
    queueId?: string; // For EOIO processing

    // Message Settings
    communicationChannel?: string;
    communicationComponent?: string;

    // Advanced Settings
    deliveryAssurance?: 'AtMostOnce' | 'AtLeastOnce' | 'ExactlyOnce';
    temporaryStorage?: 'None' | 'Database' | 'JMS';
    acknowledgmentMode?: 'Synchronous' | 'Asynchronous';

    // For async XI messages
    retryInterval?: number;
    maxRetries?: number;
    exponentialBackoff?: boolean;
}

// ============================================================================
// FLOW CONTROL COMPONENTS
// ============================================================================

// Router Configuration (Content-Based Routing)
export interface RouterConfig {
    id: string;
    name: string;
    type: 'ExclusiveGateway' | 'InclusiveGateway';
    routingConditions: RoutingCondition[];
    defaultRoute?: string; // ID of default route
    throwExceptionOnNoMatch?: boolean;
}

export interface RoutingCondition {
    id: string;
    name: string;
    expressionType: 'XPath' | 'NonXML' | 'Header' | 'Property';
    expression: string;
    targetId: string; // ID of target element
    order?: number;
}

// Multicast Configuration (Parallel Processing)
export interface MulticastConfig {
    id: string;
    name: string;
    type: 'ParallelMulticast' | 'SequentialMulticast';
    branches: MulticastBranch[];
    aggregationStrategy?: 'UseLatest' | 'CollectAll' | 'Custom';
    stopOnException?: boolean;
    timeout?: number;
}

export interface MulticastBranch {
    id: string;
    name: string;
    condition?: string;
    targetId: string;
}

// Splitter Configuration
export interface SplitterConfig {
    id: string;
    name: string;
    type: 'IteratingSplitter' | 'GeneralSplitter' | 'ParallelSplitter' | 'TokenizerSplitter';
    expressionType: 'XPath' | 'LineBreak' | 'Token' | 'PKCS7';
    expression?: string;
    parallelProcessing?: boolean;
    groupSize?: number;
    stopOnException?: boolean;
    streaming?: boolean;
}

// Aggregator Configuration
export interface AggregatorConfig {
    id: string;
    name: string;
    correlationExpression: string;
    correlationExpressionType: 'XPath' | 'Header' | 'Property';
    completionCondition: {
        type: 'MessageCount' | 'Timeout' | 'Expression';
        value: string | number;
    };
    aggregationStrategy: 'CombineXML' | 'Concatenate' | 'CollectInList' | 'Custom';
    timeout?: number;
    throwExceptionOnTimeout?: boolean;
}

// Join Configuration
export interface JoinConfig {
    id: string;
    name: string;
    type: 'AND' | 'OR' | 'XOR';
    incomingBranches: string[];
}

// Gather Configuration
export interface GatherConfig {
    id: string;
    name: string;
    type: 'Synchronous' | 'Asynchronous';
}

// Filter Configuration
export interface FilterConfig {
    id: string;
    name: string;
    expressionType: 'XPath' | 'Header' | 'Property';
    expression: string;
    removeOnMismatch?: boolean;
}

// ============================================================================
// MESSAGE TRANSFORMERS
// ============================================================================

// Converter Configuration
export interface ConverterConfig {
    id: string;
    name: string;
    type: ConverterType;
    sourceFormat?: string;
    targetFormat?: string;
    options?: ConverterOptions;
}

export type ConverterType =
    | 'XMLToJSON' | 'JSONToXML'
    | 'CSVToXML' | 'XMLToCSV'
    | 'EDIToXML' | 'XMLToEDI'
    | 'Base64Encoder' | 'Base64Decoder'
    | 'GZIPCompressor' | 'GZIPDecompressor'
    | 'ZIPCompressor' | 'ZIPDecompressor'
    | 'MIMEMultipartEncoder' | 'MIMEMultipartDecoder';

export interface ConverterOptions {
    // XML/JSON conversion
    jsonPrefix?: string;
    jsonArrayElements?: string[];
    suppressEmptyElements?: boolean;
    // CSV conversion
    delimiter?: string;
    headerLine?: boolean;
    fieldNames?: string[];
    // EDI conversion
    ediStandard?: 'EDIFACT' | 'X12' | 'ODETTE';
    ediVersion?: string;
}

// Content Modifier Configuration
export interface ContentModifierConfig {
    id: string;
    name: string;
    headerActions?: HeaderAction[];
    propertyActions?: PropertyAction[];
    bodyAction?: BodyAction;
}

export interface HeaderAction {
    action: 'Create' | 'Delete';
    name: string;
    type?: 'Constant' | 'Expression' | 'XPath' | 'Header' | 'Property';
    value?: string;
    dataType?: 'String' | 'Integer' | 'Boolean' | 'Date';
}

export interface PropertyAction {
    action: 'Create' | 'Delete';
    name: string;
    type?: 'Constant' | 'Expression' | 'XPath' | 'Header' | 'Property';
    value?: string;
    dataType?: 'String' | 'Integer' | 'Boolean' | 'Date';
}

export interface BodyAction {
    type: 'Constant' | 'Expression' | 'XPath';
    value?: string;
}

// XML Validator Configuration
export interface XMLValidatorConfig {
    id: string;
    name: string;
    schemaSource: 'XSD' | 'WSDL';
    schemaPath?: string;
    schemaContent?: string;
    throwExceptionOnFailure?: boolean;
}

// ============================================================================
// SECURITY COMPONENTS
// ============================================================================

// Encryptor Configuration
export interface EncryptorConfig {
    id: string;
    name: string;
    type: 'PGPEncryptor' | 'PKCS7Encryptor' | 'XMLEncryptor';
    keyAlias?: string;
    algorithm?: string;
    signMessage?: boolean;
    asciiArmor?: boolean;
}

// Decryptor Configuration
export interface DecryptorConfig {
    id: string;
    name: string;
    type: 'PGPDecryptor' | 'PKCS7Decryptor' | 'XMLDecryptor';
    keyAlias?: string;
    verifySignature?: boolean;
}

// Signer Configuration
export interface SignerConfig {
    id: string;
    name: string;
    type: 'PKCS7Signer' | 'XMLDigitalSigner' | 'SimpleSigner';
    keyAlias?: string;
    signatureAlgorithm?: string;
    digestAlgorithm?: string;
    includeSignerCert?: boolean;
}

// Verifier Configuration
export interface VerifierConfig {
    id: string;
    name: string;
    type: 'PKCS7Verifier' | 'XMLDigitalVerifier' | 'SimpleVerifier';
    publicKeyAlias?: string;
    throwExceptionOnFailure?: boolean;
}

// ============================================================================
// PERSISTENCE COMPONENTS
// ============================================================================

// Data Store Operations Configuration
export interface DataStoreConfig {
    id: string;
    name: string;
    operation: 'Write' | 'Get' | 'Delete' | 'Select';
    dataStoreName: string;
    entryId?: string;
    visibility: 'Global' | 'Integration Flow';
    retentionPeriod?: number; // days
    overwriteExisting?: boolean;
    // Select operation specific
    selectCondition?: string;
    numberOfPolledMessages?: number;
    deleteOnCompletion?: boolean;
}

// Variables Configuration
export interface VariableConfig {
    id: string;
    name: string;
    operation: 'Write' | 'Read';
    variableName: string;
    type?: 'Header' | 'Property' | 'Body';
    value?: string;
    expirationPeriod?: number;
}

// Persist Message Configuration
export interface PersistMessageConfig {
    id: string;
    name: string;
    stepId: string;
    encryptPayload?: boolean;
}

// ============================================================================
// SCRIPT CONFIGURATION
// ============================================================================

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

// ============================================================================
// MAPPING CONFIGURATION
// ============================================================================

export interface MappingConfig {
    id: string;
    name: string;
    type: 'MessageMapping' | 'XSLTMapping' | 'Enricher' | 'ContentModifier';
    sourceFields?: string[];
    targetFields?: string[];
    transformations?: string[];
    complexity: 'low' | 'medium' | 'high';
    mappingPath?: string;
    mappingContent?: string;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Error Handler Configuration
export interface ErrorHandlerConfig {
    id: string;
    name: string;
    errorType: 'Exception' | 'Timeout' | 'ValidationError' | 'Escalation';
    retryCount?: number;
    retryInterval?: number;
    alertOnFailure?: boolean;
    fallbackAction?: string;
    deadLetterChannel?: DeadLetterConfig;
}

// Exception Subprocess Configuration
export interface ExceptionSubprocessConfig {
    id: string;
    name: string;
    triggerType: 'ErrorBoundary' | 'Escalation';
    steps: FlowStep[];
    sendToDeadLetter?: boolean;
}

// Dead Letter Channel Configuration
export interface DeadLetterConfig {
    enabled: boolean;
    jmsQueue?: string;
    retainPayload?: boolean;
    maxRedeliveries?: number;
}

// ============================================================================
// CALL COMPONENTS
// ============================================================================

// Request-Reply Configuration
export interface RequestReplyConfig {
    id: string;
    name: string;
    adapterId: string;
    timeout?: number;
    externalCallType?: 'RequestReply' | 'Send' | 'Request';
}

// Content Enricher (External Call)
export interface ContentEnricherConfig {
    id: string;
    name: string;
    type: 'ContentEnricher' | 'PollEnrich';
    adapterId: string;
    pathToNode?: string;
    aggregationStrategy?: 'Combine' | 'Enrich' | 'Replace';
}

// Looping Process Call
export interface LoopingProcessCallConfig {
    id: string;
    name: string;
    loopType: 'While' | 'Until' | 'For';
    condition: string;
    maxIterations?: number;
    localProcessId: string;
}

// Idempotent Process Call
export interface IdempotentProcessCallConfig {
    id: string;
    name: string;
    messageId: string;
    skipProcessedMessages?: boolean;
    expirationPeriod?: number;
}

// ============================================================================
// LOCAL INTEGRATION PROCESS
// ============================================================================

export interface LocalIntegrationProcessConfig {
    id: string;
    name: string;
    steps: FlowStep[];
    isReusable?: boolean;
}

// ============================================================================
// TIMER / SCHEDULER
// ============================================================================

export interface TimerStartEventConfig {
    id: string;
    name: string;
    scheduleType: 'RunOnce' | 'Schedule';
    cronExpression?: string;
    runOnDeployment?: boolean;
    timezone?: string;
}

// ============================================================================
// FLOW STEP (Generic container for any step)
// ============================================================================

export type FlowStepType =
    | 'adapter' | 'script' | 'mapping' | 'router' | 'multicast'
    | 'splitter' | 'aggregator' | 'join' | 'gather' | 'filter'
    | 'converter' | 'contentModifier' | 'xmlValidator'
    | 'encryptor' | 'decryptor' | 'signer' | 'verifier'
    | 'dataStore' | 'variable' | 'persistMessage'
    | 'requestReply' | 'contentEnricher' | 'loopingCall' | 'idempotentCall'
    | 'localProcess' | 'exceptionSubprocess' | 'timer'
    | 'start' | 'end' | 'error' | 'terminate' | 'escalation';

export interface FlowStep {
    id: string;
    type: FlowStepType;
    name: string;
    config:
    | AdapterConfig
    | ScriptConfig
    | MappingConfig
    | RouterConfig
    | MulticastConfig
    | SplitterConfig
    | AggregatorConfig
    | JoinConfig
    | GatherConfig
    | FilterConfig
    | ConverterConfig
    | ContentModifierConfig
    | XMLValidatorConfig
    | EncryptorConfig
    | DecryptorConfig
    | SignerConfig
    | VerifierConfig
    | DataStoreConfig
    | VariableConfig
    | PersistMessageConfig
    | RequestReplyConfig
    | ContentEnricherConfig
    | LoopingProcessCallConfig
    | IdempotentProcessCallConfig
    | LocalIntegrationProcessConfig
    | ExceptionSubprocessConfig
    | TimerStartEventConfig
    | ErrorHandlerConfig
    | Record<string, unknown>;
    position?: { x: number; y: number };
    connections?: string[];
}

// ============================================================================
// FLOW NODE (for visual diagram)
// ============================================================================

export interface FlowNode {
    id: string;
    type: FlowStepType;
    name: string;
    position: { x: number; y: number };
    connections: string[];
    branchId?: string; // For parallel/router branches
    parentId?: string; // For subprocess elements
}

// ============================================================================
// STEP 3: AI-Generated Design (Enhanced)
// ============================================================================

export interface IFlowDesign {
    metadata: {
        name: string;
        id: string;
        description: string;
        version: string;
    };

    // Trigger Configuration
    triggerType?: 'message' | 'timer' | 'event';
    timerConfig?: TimerStartEventConfig;

    // Adapters (Sender/Receiver)
    adapters: AdapterConfig[];

    // Scripts
    scripts: ScriptConfig[];

    // Mappings & Transformers
    mappings: MappingConfig[];
    converters?: ConverterConfig[];
    contentModifiers?: ContentModifierConfig[];
    xmlValidators?: XMLValidatorConfig[];

    // Flow Control
    routers?: RouterConfig[];
    multicasts?: MulticastConfig[];
    splitters?: SplitterConfig[];
    aggregators?: AggregatorConfig[];
    joins?: JoinConfig[];
    gathers?: GatherConfig[];
    filters?: FilterConfig[];

    // Security Components
    encryptors?: EncryptorConfig[];
    decryptors?: DecryptorConfig[];
    signers?: SignerConfig[];
    verifiers?: VerifierConfig[];

    // Persistence
    dataStores?: DataStoreConfig[];
    variables?: VariableConfig[];
    persistMessages?: PersistMessageConfig[];

    // External Calls
    requestReplies?: RequestReplyConfig[];
    contentEnrichers?: ContentEnricherConfig[];
    loopingCalls?: LoopingProcessCallConfig[];
    idempotentCalls?: IdempotentProcessCallConfig[];

    // Local Processes
    localProcesses?: LocalIntegrationProcessConfig[];

    // Error Handling
    errorHandlers: ErrorHandlerConfig[];
    exceptionSubprocesses?: ExceptionSubprocessConfig[];

    // Flow Diagram (for visualization)
    flowDiagram: FlowNode[];

    // Flow Steps (unified step list for complex flows)
    flowSteps?: FlowStep[];

    // Metadata
    estimatedComplexity: 'low' | 'medium' | 'high';
    performanceNotes: string[];
    securityNotes?: string[];

    // Integration Pattern
    integrationPattern?: 'PointToPoint' | 'PublishSubscribe' | 'ContentBasedRouter' |
    'Splitter' | 'Aggregator' | 'Scatter-Gather' | 'RecipientList' | 'Pipeline';
}

// ============================================================================
// STEP 4: User Modifications (Enhanced)
// ============================================================================

export interface UserModifications {
    adapters?: Partial<AdapterConfig>[];
    scripts?: Partial<ScriptConfig>[];
    mappings?: Partial<MappingConfig>[];
    errorHandlers?: Partial<ErrorHandlerConfig>[];
    routers?: Partial<RouterConfig>[];
    splitters?: Partial<SplitterConfig>[];
    converters?: Partial<ConverterConfig>[];
    encryptors?: Partial<EncryptorConfig>[];
    dataStores?: Partial<DataStoreConfig>[];
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