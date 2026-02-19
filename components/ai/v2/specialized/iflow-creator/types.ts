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
export type ProtocolType = 'HTTP' | 'HTTPS' | 'TCP' | 'SFTP' | 'FTP' | 'FTPS' | 'AMQP' | 'AMQPS' | 'KAFKA' | 'MQTT' | 'MQTTS' | 'MAIL' | 'IMAP' | 'POP3' | 'SMTP';

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
    // OAuth2 Common
    tokenEndpoint?: string;
    clientId?: string;
    clientSecret?: string;
    scope?: string;
    grantType?: 'client_credentials' | 'authorization_code' | 'password' | 'jwt_bearer';

    // OAuth2 Client Credentials specific
    clientCredentialKeystore?: string;
    clientCredentialKeyAlias?: string;

    // OAuth2 SAML Bearer specific
    issuer?: string;
    audience?: string;
    subject?: string;
    samlAssertion?: string;
    keystoreName?: string;
    keystoreAlias?: string;

    // Token refresh
    refreshToken?: string;
    refreshEndpoint?: string;
    tokenRefreshThreshold?: number; // seconds before expiry to refresh

    // Advanced
    additionalParams?: Record<string, string>;
    headerAuth?: boolean; // Use Authorization header instead of body
}

export interface SAMLConfig {
    // SAML 2.0 Configuration
    issuer: string;
    assertionConsumerServiceUrl?: string;
    keystoreName?: string;
    keystoreAlias?: string;
    keystorePassword?: string;
    privateKeyPassword?: string;

    // SAML Assertion
    subjectNameId?: string;
    subjectFormat?: string;
    authenticationContext?: string;

    // Claims/Attributes
    attributes?: {
        name: string;
        nameFormat?: string;
        value: string;
    }[];
}

export interface CertificateConfig {
    keystoreName: string;
    keystorePassword?: string;
    keyAlias: string;
    keyPassword?: string;
    certificateName?: string;
    certificateChain?: boolean;
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

/**
 * Mail Adapter Configuration
 * Used for email-based integrations
 * - IMAP/POP3: Sender adapter for polling mailboxes
 * - SMTP: Receiver adapter for sending emails
 */
export interface MailAdapterConfig extends Omit<AdapterConfig, 'type'> {
    type: 'Mail' | 'IMAP' | 'POP3' | 'SMTP';
    
    // Connection Settings
    mailServer?: string; // Mail server hostname
    mailPort?: number; // Port (993 IMAP SSL, 995 POP3 SSL, 587 SMTP TLS)
    
    // For Sender adapters (IMAP/POP3) - Polling configuration
    schedulerPeriod?: number; // Polling interval in milliseconds
    schedulerPeriodUnit?: 'millisecond' | 'second' | 'minute' | 'hour';
    mailFolder?: string; // Folder to poll (default: INBOX)
    maxMessages?: number; // Max messages per poll
    filterUnseen?: boolean; // Only unread messages
    filterSubject?: string; // Subject filter pattern
    filterFrom?: string; // Sender filter
    postProcessing?: 'Mark as Read' | 'Delete' | 'Move';
    bodyType?: 'Text' | 'HTML' | 'Both';
    includeAttachments?: boolean;
    
    // For Receiver adapter (SMTP) - Email sending
    mailFrom?: string; // Sender email address
    mailTo?: string; // Recipient(s) - can use expressions
    mailCc?: string; // CC recipients
    mailBcc?: string; // BCC recipients
    mailSubject?: string; // Subject - can use expressions
    contentType?: 'text/plain' | 'text/html';
    addAttachment?: boolean;
    
    // Security
    connectionSecurity?: 'StartTLS' | 'SSL/TLS' | 'Off';
}

/**
 * JDBC Adapter Configuration
 * Used for database integrations with SAP CPI
 */
export interface JDBCAdapterConfig extends Omit<AdapterConfig, 'type'> {
    type: 'JDBC';

    // Connection Settings
    jdbcUrl?: string; // JDBC connection URL
    driverClassName?: string; // JDBC driver class
    username?: string;
    password?: string;
    credentialName?: string; // For credential lookup

    // Connection Pool Settings
    poolSize?: number; // Number of connections in pool
    maxPoolSize?: number; // Maximum pool size
    minIdle?: number; // Minimum idle connections
    connectionTimeout?: number; // Connection timeout in ms
    idleTimeout?: number; // Idle timeout in ms
    maxLifetime?: number; // Max lifetime in ms

    // Transaction Settings
    transactionIsolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
    autoCommit?: boolean;

    // SQL Operation Settings
    sqlOperation?: 'SELECT' | 'UPDATE' | 'INSERT' | 'DELETE' | 'CALL' | 'BATCH';
    sqlStatement?: string; // SQL statement or stored procedure
    preparedStatement?: boolean; // Use prepared statement
    batchSize?: number; // For batch operations

    // Query Settings
    resultXsd?: string; // Result structure (for SELECT)
    updateColumnList?: string; // Columns to update (for UPDATE)
    keyColumn?: string; // Key column for updates
    useUploadedKeyValues?: boolean; // Use uploaded keys
    uploadedKeyColumn?: string; // Uploaded key column

    // Error Handling
    noDataFoundBehavior?: 'Continue' | 'Exception';
    sqlExceptionBehavior?: 'Continue' | 'Exception';

    // Advanced
    fetchSize?: number; // JDBC fetch size
    queryTimeout?: number; // Query timeout in seconds
    fetchDirection?: 'FORWARD' | 'REVERSE' | 'UNKNOWN';
}

/**
 * Salesforce Adapter Configuration
 * Used for Salesforce integrations
 */
export interface SalesforceAdapterConfig extends Omit<AdapterConfig, 'type'> {
    type: 'Salesforce';

    // Connection
    connectionType?: 'Production' | 'Sandbox' | 'Custom';
    loginUrl?: string; // Custom login URL
    apiVersion?: string; // Salesforce API version (e.g., v57.0)
    proxyType?: 'Internet' | 'OnPremise' | 'NoProxy';

    // Authentication
    useBulkApi?: boolean; // Enable Bulk API for large data operations
    bulkApiBatchSize?: number; // Batch size for Bulk API

    // Operation
    operation?: 'create' | 'upsert' | 'update' | 'delete' | 'query' | 'getDeleted' | 'getUpdated';
    objectName?: string; // Salesforce object (Account, Contact, etc.)
    externalIdField?: string; // For upsert operations

    // Query
    sobjectQuery?: string; // SOQL query
    batchSize?: number; // Query batch size

    // Error Handling
    errorHandling?: 'Throw Exception' | 'Continue';
    faultColumn?: string; // Error column in output
}

/**
 * SuccessFactors Adapter Configuration
 * Used for SAP SuccessFactors integrations
 */
export interface SuccessFactorsAdapterConfig extends Omit<AdapterConfig, 'type'> {
    type: 'SuccessFactors' | 'SuccessFactors_SOAP' | 'SuccessFactors_REST' | 'SuccessFactors_OData';

    // Connection
    companyId?: string; // SuccessFactors Company ID
    userId?: string; // User ID for authentication
    odataServiceUrl?: string; // OData service endpoint
    entityType?: string; // Entity to query (Employee, etc.)

    // Authentication (OAuth2)
    tokenEndpoint?: string;
    clientId?: string;
    clientSecret?: string;

    // Operation
    operation?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

    // Query
    queryOptions?: string; // OData query options ($filter, $expand, etc.)
    pageSize?: number;
    top?: number;

    // Format
    dataFormat?: 'JSON' | 'XML';
}

/**
 * Ariba Adapter Configuration
 * Used for SAP Ariba integrations
 */
export interface AribaAdapterConfig extends Omit<AdapterConfig, 'type'> {
    type: 'Ariba' | 'Ariba_Network';

    // Connection
    realm?: string; // Ariba realm
    applicationId?: string; // Ariba application ID
    receiverNode?: string; // Receiver node name
    aribaUrl?: string; // Ariba API URL

    // Authentication
    aribaUserId?: string;
    aribaUserPassword?: string;

    // Operation
    operation?: 'PurchaseOrder' | 'Invoice' | 'Catalog' | 'Sourcing';
    direction?: 'Inbound' | 'Outbound';

    // Document
    documentId?: string;
    documentType?: string;
}

/**
 * Workday Adapter Configuration
 * Used for Workday integrations
 */
export interface WorkdayAdapterConfig extends Omit<AdapterConfig, 'type'> {
    type: 'Workday';

    // Connection
    tenantUrl?: string; // Workday tenant URL
    workdayUserId?: string;

    // Operation
    businessObject?: string; // Workday business object
    operation?: 'Get' | 'Put' | 'Post' | 'Delete';

    // Integration
    integrationName?: string;
    workdayNamespace?: string;

    // SOAP/REST
    webService?: string;
}

/**
 * ServiceNow Adapter Configuration
 * Used for ServiceNow integrations
 */
export interface ServiceNowAdapterConfig extends Omit<AdapterConfig, 'type'> {
    type: 'ServiceNow';

    // Connection
    instanceUrl?: string; // ServiceNow instance URL
    instanceName?: string;

    // Authentication
    username?: string;
    password?: string;
    tableApiKey?: string; // Table API key

    // Operation
    tableName?: string; // ServiceNow table
    operation?: 'get' | 'post' | 'patch' | 'delete' | 'insert' | 'update' | 'deleteMultiple' | 'aggregate';

    // Query
    sysparmQuery?: string; // Encoded query
    sysparmDisplayValue?: boolean; // Display values
    sysparmFields?: string; // Fields to return
    apiVersion?: string; // Table API version

    // Pagination
    pageSize?: number;
}

/**
 * Amazon S3 Adapter Configuration
 */
export interface AmazonS3AdapterConfig extends Omit<AdapterConfig, 'type'> {
    type: 'AmazonS3';

    // Connection
    awsRegion?: string;
    bucketName?: string;
    endpointUrl?: string; // For custom endpoints

    // Authentication
    accessKeyId?: string;
    secretAccessKey?: string;
    credentialName?: string; // For credential lookup

    // Operation
    operation?: 'put' | 'get' | 'delete' | 'list' | 'copy';
    objectKey?: string; // S3 object key
    prefix?: string; // For list operations

    // Advanced
    storageClass?: 'STANDARD' | 'REDUCED_REDUNDANCY' | 'GLACIER';
    contentType?: string;
    multipartThreshold?: number;
}

/**
 * Azure Blob Storage Adapter Configuration
 */
export interface AzureBlobAdapterConfig extends Omit<AdapterConfig, 'type'> {
    type: 'AzureBlob';

    // Connection
    storageAccountName?: string;
    containerName?: string;
    endpointSuffix?: string; // e.g., core.windows.net

    // Authentication
    sasToken?: string;
    sharedKey?: string;

    // Operation
    operation?: 'upload' | 'download' | 'delete' | 'list';
    blobName?: string;
    prefix?: string;

    // Advanced
    blockSize?: number;
    maxConcurrentRequests?: number;
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
// MONITORING & ALERTING
// ============================================================================

// Alert Rule Configuration
export interface AlertRuleConfig {
    id: string;
    name: string;
    enabled: boolean;

    // Trigger Conditions
    triggerType: 'error' | 'timeout' | 'custom' | 'messageCount' | 'processingTime';
    threshold?: number; // For message count or processing time
    timeWindow?: number; // In seconds

    // Alert Properties
    alertType?: 'EMAIL' | 'HTTP' | 'JMS' | 'SNMP' | 'SPLUNK';
    alertSeverity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

    // Notification Targets
    recipients?: string[]; // Email addresses or endpoints
    httpEndpoint?: string; // For webhook alerts
    jmsDestination?: string;

    // Custom Message
    subject?: string;
    messageTemplate?: string; // Template with placeholders
}

// Custom Log Endpoint Configuration
export interface CustomLogEndpointConfig {
    id: string;
    name: string;
    enabled: boolean;

    // Endpoint Type
    endpointType: 'HTTP' | 'DATABASE' | 'FILE' | 'KAFKA' | 'SPLUNK' | 'ELK';

    // Connection
    connectionUrl?: string;
    credentialName?: string;

    // Format
    logFormat?: 'JSON' | 'XML' | 'CSV' | 'CUSTOM';
    includeHeaders?: boolean;
    includeProperties?: boolean;
    includeAttachments?: boolean;

    // Filtering
    logLevel?: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    filterExpression?: string; // Simple filter expression
}

// Metrics Endpoint Configuration
export interface MetricsEndpointConfig {
    id: string;
    name: string;
    enabled: boolean;

    // Endpoint
    path?: string; // Metrics endpoint path (default: /metrics)
    port?: number;

    // Metrics to Expose
    exposeMetrics?: {
        messageCount?: boolean;
        processingTime?: boolean;
        errorRate?: boolean;
        customMetrics?: string[];
    };

    // Format
    format?: 'PROMETHEUS' | 'JSON' | 'GRAPHITE';
}

// Integration Flow Monitoring Configuration
export interface MonitoringConfig {
    // Alert Rules
    alertRules?: AlertRuleConfig[];

    // Custom Logging
    customLogEndpoints?: CustomLogEndpointConfig[];

    // Metrics
    metricsEndpoint?: MetricsEndpointConfig;

    // Dashboards
    dashboardEnabled?: boolean;
    customDashboardId?: string;

    // Trace
    traceEnabled?: boolean;
    traceSampleRate?: number; // 0-100 percentage

    // Message Store
    storeMessages?: boolean;
    messageRetentionDays?: number;
}

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

/**
 * Environment Parameter Configuration
 * Define parameters that can have different values per environment
 */
export interface EnvironmentParameter {
    name: string;
    description?: string;
    type: 'string' | 'number' | 'boolean' | 'password' | 'url';
    defaultValue?: string;
    required?: boolean;
}

/**
 * Deployment Profile Configuration
 * Define different configurations for dev/test/prod environments
 */
export interface DeploymentProfile {
    name: string; // 'development' | 'test' | 'production' | custom name
    description?: string;

    // Parameter overrides for this environment
    parameterOverrides?: Record<string, string>;

    // Adapter-specific configurations
    adapterConfigs?: Record<string, Record<string, string>>;

    // Resource limits
    maxMemoryMB?: number;
    maxExecutionTime?: number; // seconds

    // Monitoring settings for this profile
    monitoringConfig?: Partial<MonitoringConfig>;
}

/**
 * Environment Configuration
 * Main configuration for environment-specific parameters
 */
export interface EnvironmentConfig {
    // Default values (used if not overridden)
    parameters: EnvironmentParameter[];

    // Deployment profiles
    profiles: DeploymentProfile[];

    // Current active profile
    activeProfile?: string;

    // Environment variables (system-level)
    environmentVariables?: Record<string, string>;
}

/**
 * Parameterized Value
 * Represents a value that can be substituted at runtime
 */
export interface ParameterizedValue {
    type: 'parameter' | 'expression' | 'constant';
    value: string;
    parameterName?: string; // For type='parameter'
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