import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Enum validators
export const userRoleValidator = v.union(v.literal("user"), v.literal("admin"));
export const userStatusValidator = v.union(
  v.literal("ACTIVE"),
  v.literal("SUSPENDED"),
  v.literal("DELETED")
);
export const roleValidator = v.union(
  v.literal("OWNER"),
  v.literal("ADMIN"),
  v.literal("MEMBER"),
  v.literal("VIEWER")
);
export const authTypeValidator = v.union(
  v.literal("OAUTH"),
  v.literal("BASIC_AUTH"),
  v.literal("SERVICE_KEY")
);
export const tenantStatusValidator = v.union(
  v.literal("ACTIVE"),
  v.literal("INACTIVE"),
  v.literal("TESTING"),
  v.literal("ERROR")
);
export const iFlowStatusValidator = v.union(
  v.literal("STARTED"),
  v.literal("STOPPED"),
  v.literal("STARTING"),
  v.literal("STOPPING"),
  v.literal("ERROR")
);
export const executionStatusValidator = v.union(
  v.literal("COMPLETED"),
  v.literal("FAILED"),
  v.literal("PROCESSING"),
  v.literal("SKIPPED"),
  v.literal("RETRY")
);
export const errorCategoryValidator = v.union(
  v.literal("SYSTEM"),
  v.literal("NETWORK"),
  v.literal("MAPPING"),
  v.literal("SECURITY"),
  v.literal("TIMEOUT"),
  v.literal("BUSINESS_LOGIC"),
  v.literal("UNKNOWN")
);
export const aiAgentTypeValidator = v.union(
  v.literal("GENERAL_ASSISTANT"),
  v.literal("IFLOW_CREATOR"),
  v.literal("SMART_MONITOR"),
  v.literal("PERFORMANCE_OPTIMIZER"),
  v.literal("ERROR_DIAGNOSTICIAN"),
  v.literal("SECURITY_AUDITOR"),
  v.literal("DOCUMENTATION_GENERATOR"),
  v.literal("TEST_CASE_GENERATOR"),
  v.literal("COST_ANALYZER"),
  v.literal("PREDICTIVE_INSIGHTS")
);
export const aiAgentStatusValidator = v.union(
  v.literal("RUNNING"),
  v.literal("COMPLETED"),
  v.literal("FAILED"),
  v.literal("CANCELLED")
);
export const subscriptionPlanValidator = v.union(
  v.literal("FREE"),
  v.literal("STARTER"),
  v.literal("PROFESSIONAL"),
  v.literal("ENTERPRISE")
);
export const subscriptionStatusValidator = v.union(
  v.literal("ACTIVE"),
  v.literal("CANCELED"),
  v.literal("INCOMPLETE"),
  v.literal("INCOMPLETE_EXPIRED"),
  v.literal("PAST_DUE"),
  v.literal("TRIALING"),
  v.literal("UNPAID"),
  v.literal("PAUSED")
);
export const invoiceStatusValidator = v.union(
  v.literal("DRAFT"),
  v.literal("OPEN"),
  v.literal("PAID"),
  v.literal("VOID"),
  v.literal("UNCOLLECTIBLE")
);
export const organizationTypeValidator = v.union(
  v.literal("ENTERPRISE"),
  v.literal("MID_MARKET"),
  v.literal("STARTUP"),
  v.literal("CONSULTING"),
  v.literal("EDUCATION"),
  v.literal("OTHER")
);

// Pipeline phase validator (iFlow Creator multi-agent orchestration)
export const pipelinePhaseValidator = v.union(
  v.literal("INIT"),
  v.literal("ARCHITECTURE"),
  v.literal("DESIGN_REVIEW"),
  v.literal("BPMN_GENERATION"),
  v.literal("VALIDATION"),
  v.literal("FIX_ATTEMPT"),
  v.literal("SUMMARIZATION"),
  v.literal("AWAITING_APPROVAL"),
  v.literal("DEPLOYING"),
  v.literal("COMPLETED"),
  v.literal("FAILED"),
  v.literal("CANCELLED")
);

export const pipelineAgentLogStatusValidator = v.union(
  v.literal("RUNNING"),
  v.literal("COMPLETED"),
  v.literal("FAILED"),
  v.literal("SKIPPED")
);

// ============================================================================
// iFlow Creator Component Validators
// ============================================================================

// Adapter type validators (50+ types)
export const iflowAdapterTypeValidator = v.union(
  // Cloud Connectors
  v.literal("HTTP"), v.literal("HTTPS"), v.literal("SOAP"), v.literal("SOAP_SAP_RM"), v.literal("REST"),
  v.literal("OData"), v.literal("OData_V2"), v.literal("OData_V4"),
  v.literal("SFTP"), v.literal("FTP"), v.literal("FTPS"),
  v.literal("Mail"), v.literal("IMAP"), v.literal("POP3"), v.literal("SMTP"),
  v.literal("JDBC"),
  v.literal("IDoc"), v.literal("XI"), v.literal("RFC"),
  v.literal("AS2"), v.literal("AS4"),
  // Message Queuing
  v.literal("JMS"), v.literal("AMQP"), v.literal("Kafka"), v.literal("SAP_Event_Mesh"), v.literal("AzureServiceBus"),
  // Cloud Applications
  v.literal("Salesforce"), v.literal("SuccessFactors"), v.literal("SuccessFactors_SOAP"), 
  v.literal("SuccessFactors_REST"), v.literal("SuccessFactors_OData"),
  v.literal("Ariba"), v.literal("Ariba_Network"),
  v.literal("Workday"), v.literal("ServiceNow"),
  v.literal("MicrosoftDynamics"), v.literal("MicrosoftDynamics365"),
  v.literal("Twitter"), v.literal("Facebook"), v.literal("Slack"),
  v.literal("Dropbox"), v.literal("GoogleDrive"), v.literal("Box"),
  v.literal("SAP_Concur"), v.literal("SAP_FieldGlass"), v.literal("SAP_IBP"), v.literal("SAP_C4C"),
  // Infrastructure
  v.literal("ProcessDirect"), v.literal("DataStore"), v.literal("DataStoreSelect"),
  v.literal("AmazonS3"), v.literal("AmazonSQS"), v.literal("AmazonSNS"), v.literal("AmazonDynamoDB"),
  v.literal("AzureBlob"), v.literal("AzureCosmosDB"),
  v.literal("OpenConnectors"), v.literal("ELSTER"), v.literal("MDI")
);

// Protocol type validator
export const iflowProtocolTypeValidator = v.union(
  v.literal("HTTP"), v.literal("HTTPS"), v.literal("TCP"),
  v.literal("SFTP"), v.literal("FTP"), v.literal("FTPS"),
  v.literal("AMQP"), v.literal("AMQPS"),
  v.literal("KAFKA"), v.literal("MQTT"), v.literal("MQTTS")
);

// Authentication type validator
export const iflowAuthTypeValidator = v.union(
  v.literal("None"), v.literal("Basic"), v.literal("OAuth"), v.literal("OAuth2"),
  v.literal("OAuth2_ClientCredentials"), v.literal("OAuth2_SAML"),
  v.literal("Certificate"), v.literal("ClientCertificate"), v.literal("PrincipalPropagation"),
  v.literal("SAML"), v.literal("APIKey"), v.literal("AWS_Signature"), v.literal("Azure_AD")
);

// Flow control component validators
export const iflowRouterTypeValidator = v.union(
  v.literal("ExclusiveGateway"),
  v.literal("InclusiveGateway")
);

export const iflowMulticastTypeValidator = v.union(
  v.literal("ParallelMulticast"),
  v.literal("SequentialMulticast")
);

export const iflowSplitterTypeValidator = v.union(
  v.literal("IteratingSplitter"),
  v.literal("GeneralSplitter"),
  v.literal("ParallelSplitter"),
  v.literal("TokenizerSplitter")
);

export const iflowExpressionTypeValidator = v.union(
  v.literal("XPath"),
  v.literal("NonXML"),
  v.literal("Header"),
  v.literal("Property"),
  v.literal("LineBreak"),
  v.literal("Token"),
  v.literal("PKCS7")
);

export const iflowAggregationStrategyValidator = v.union(
  v.literal("CombineXML"),
  v.literal("Concatenate"),
  v.literal("CollectInList"),
  v.literal("Custom"),
  v.literal("UseLatest"),
  v.literal("CollectAll")
);

export const iflowJoinTypeValidator = v.union(
  v.literal("AND"),
  v.literal("OR"),
  v.literal("XOR")
);

// Converter type validator
export const iflowConverterTypeValidator = v.union(
  v.literal("XMLToJSON"), v.literal("JSONToXML"),
  v.literal("CSVToXML"), v.literal("XMLToCSV"),
  v.literal("EDIToXML"), v.literal("XMLToEDI"),
  v.literal("Base64Encoder"), v.literal("Base64Decoder"),
  v.literal("GZIPCompressor"), v.literal("GZIPDecompressor"),
  v.literal("ZIPCompressor"), v.literal("ZIPDecompressor"),
  v.literal("MIMEMultipartEncoder"), v.literal("MIMEMultipartDecoder")
);

// Security component validators
export const iflowEncryptorTypeValidator = v.union(
  v.literal("PGPEncryptor"),
  v.literal("PKCS7Encryptor"),
  v.literal("XMLEncryptor")
);

export const iflowDecryptorTypeValidator = v.union(
  v.literal("PGPDecryptor"),
  v.literal("PKCS7Decryptor"),
  v.literal("XMLDecryptor")
);

export const iflowSignerTypeValidator = v.union(
  v.literal("PKCS7Signer"),
  v.literal("XMLDigitalSigner"),
  v.literal("SimpleSigner")
);

export const iflowVerifierTypeValidator = v.union(
  v.literal("PKCS7Verifier"),
  v.literal("XMLDigitalVerifier"),
  v.literal("SimpleVerifier")
);

// Data Store operation validator
export const iflowDataStoreOperationValidator = v.union(
  v.literal("Write"),
  v.literal("Get"),
  v.literal("Delete"),
  v.literal("Select")
);

export const iflowDataStoreVisibilityValidator = v.union(
  v.literal("Global"),
  v.literal("Integration Flow")
);

// Timer/Scheduler validator
export const iflowScheduleTypeValidator = v.union(
  v.literal("RunOnce"),
  v.literal("Schedule")
);

// Error handling validators
export const iflowErrorTypeValidator = v.union(
  v.literal("Exception"),
  v.literal("Timeout"),
  v.literal("ValidationError"),
  v.literal("Escalation")
);

export const iflowTriggerTypeValidator = v.union(
  v.literal("ErrorBoundary"),
  v.literal("Escalation")
);

// Integration pattern validator
export const iflowIntegrationPatternValidator = v.union(
  v.literal("PointToPoint"),
  v.literal("PublishSubscribe"),
  v.literal("ContentBasedRouter"),
  v.literal("Splitter"),
  v.literal("Aggregator"),
  v.literal("Scatter-Gather"),
  v.literal("RecipientList"),
  v.literal("Pipeline")
);

// Flow step type validator
export const iflowStepTypeValidator = v.union(
  v.literal("adapter"), v.literal("script"), v.literal("mapping"),
  v.literal("router"), v.literal("multicast"),
  v.literal("splitter"), v.literal("aggregator"), v.literal("join"), v.literal("gather"), v.literal("filter"),
  v.literal("converter"), v.literal("contentModifier"), v.literal("xmlValidator"),
  v.literal("encryptor"), v.literal("decryptor"), v.literal("signer"), v.literal("verifier"),
  v.literal("dataStore"), v.literal("variable"), v.literal("persistMessage"),
  v.literal("requestReply"), v.literal("contentEnricher"), v.literal("loopingCall"), v.literal("idempotentCall"),
  v.literal("localProcess"), v.literal("exceptionSubprocess"), v.literal("timer"),
  v.literal("start"), v.literal("end"), v.literal("error"), v.literal("terminate"), v.literal("escalation")
);

export default defineSchema({
  // User model
  users: defineTable({
    clerkId: v.optional(v.string()),
    email: v.string(),
    name: v.optional(v.string()),
    role: userRoleValidator,
    status: userStatusValidator,
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    phone: v.optional(v.string()),
    lastLoginAt: v.optional(v.number()), // timestamp

    // Onboarding fields
    onboardingCompleted: v.boolean(),
    onboardingData: v.optional(v.any()),

    // Stripe billing fields
    stripeCustomerId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripeCurrentPeriodEnd: v.optional(v.number()), // timestamp

    // Admin plugin fields
    banned: v.optional(v.boolean()),
    banReason: v.optional(v.string()),
    banExpires: v.optional(v.number()), // timestamp

    // Default tenant reference
    defaultTenantId: v.optional(v.id("cpiTenants")),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_stripeCustomerId", ["stripeCustomerId"])
    .index("by_stripeSubscriptionId", ["stripeSubscriptionId"]),

  // Session model
  sessions: defineTable({
    expiresAt: v.number(), // timestamp
    token: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    userId: v.id("users"),
    activeTenantId: v.optional(v.id("cpiTenants")),
    impersonatedBy: v.optional(v.string()),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  // Account model (OAuth/linked accounts)
  accounts: defineTable({
    accountId: v.string(),
    providerId: v.string(),
    userId: v.id("users"),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    idToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()), // timestamp
    refreshTokenExpiresAt: v.optional(v.number()), // timestamp
    scope: v.optional(v.string()),
    password: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  // Verification model
  verifications: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(), // timestamp
  }).index("by_identifier", ["identifier"]),

  // CPI Tenant model
  cpiTenants: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    image: v.optional(v.string()),

    // SAP CPI Connection Details
    tenantUrl: v.string(),
    authType: authTypeValidator,
    authenticationUrl: v.optional(v.string()),
    clientId: v.optional(v.string()),
    clientSecret: v.optional(v.string()), // Encrypted
    tokenUrl: v.optional(v.string()), // Deprecated
    username: v.optional(v.string()),
    password: v.optional(v.string()), // Encrypted

    // Tenant Status
    status: tenantStatusValidator,
    lastSyncAt: v.optional(v.number()), // timestamp
    connectionTestAt: v.optional(v.number()), // timestamp
    isConnected: v.boolean(),

    // Timestamps
    createdAt: v.number(), // timestamp
    updatedAt: v.number(), // timestamp
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  // iFlow model
  iFlows: defineTable({
    iFlowId: v.string(), // SAP CPI iFlow ID
    name: v.string(),
    packageName: v.optional(v.string()),
    version: v.optional(v.string()),
    status: iFlowStatusValidator,
    lastDeployedAt: v.optional(v.number()), // timestamp
    lastExecutedAt: v.optional(v.number()), // timestamp
    tenantId: v.id("cpiTenants"),
  })
    .index("by_tenantId", ["tenantId"])
    .index("by_status", ["status"])
    .index("by_tenantId_iFlowId", ["tenantId", "iFlowId"])
    .index("by_tenantId_status", ["tenantId", "status"]),

  // iFlow Execution model
  iFlowExecutions: defineTable({
    messageId: v.string(), // SAP CPI Message ID
    status: executionStatusValidator,
    startTime: v.number(), // timestamp
    endTime: v.optional(v.number()), // timestamp
    duration: v.optional(v.number()), // milliseconds

    // Payload data
    requestPayload: v.optional(v.string()),
    responsePayload: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    errorCategory: v.optional(errorCategoryValidator),

    // Metadata
    sender: v.optional(v.string()),
    receiver: v.optional(v.string()),
    interfaceType: v.optional(v.string()),

    // Relations
    iFlowId: v.id("iFlows"),
  })
    .index("by_messageId", ["messageId"])
    .index("by_iFlowId", ["iFlowId"])
    .index("by_status", ["status"])
    .index("by_startTime", ["startTime"]),

  // Tenant Member junction table
  tenantMembers: defineTable({
    role: roleValidator,
    joinedAt: v.number(), // timestamp
    userId: v.id("users"),
    tenantId: v.id("cpiTenants"),
  })
    .index("by_userId", ["userId"])
    .index("by_tenantId", ["tenantId"])
    .index("by_userId_tenantId", ["userId", "tenantId"]),

  // Tenant Invitation model
  tenantInvitations: defineTable({
    email: v.string(),
    role: roleValidator,
    token: v.string(),
    expiresAt: v.number(), // timestamp
    acceptedAt: v.optional(v.number()), // timestamp
    tenantId: v.id("cpiTenants"),
    invitedById: v.id("users"),
  })
    .index("by_token", ["token"])
    .index("by_email", ["email"])
    .index("by_tenantId", ["tenantId"]),

  // AI Agent Execution model
  aiAgentExecutions: defineTable({
    agentType: aiAgentTypeValidator,
    status: aiAgentStatusValidator,

    // Input/Output
    input: v.string(), // User input/prompt
    output: v.string(), // AI response
    inputPrompt: v.optional(v.string()), // Legacy field
    outputData: v.optional(v.string()), // Legacy field
    errorMessage: v.optional(v.string()),

    // Performance metrics
    tokensUsed: v.number(),
    duration: v.optional(v.number()), // milliseconds
    success: v.boolean(),

    // Context
    tenantId: v.optional(v.string()),
    iFlowId: v.optional(v.string()),

    // Relations
    userId: v.id("users"),
  })
    .index("by_userId", ["userId"])
    .index("by_tenantId", ["tenantId"])
    .index("by_agentType", ["agentType"])
    .index("by_status", ["status"])
    .index("by_userId_agentType", ["userId", "agentType"]),

  // Subscription model
  subscriptions: defineTable({
    userId: v.id("users"),
    plan: subscriptionPlanValidator,
    status: subscriptionStatusValidator,

    // Stripe fields
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    stripeCurrentPeriodStart: v.optional(v.number()), // timestamp
    stripeCurrentPeriodEnd: v.optional(v.number()), // timestamp

    // Usage limits based on plan
    maxTenants: v.number(),
    maxIFlows: v.number(),
    maxTeamMembers: v.number(),
    maxAIAgentCalls: v.number(),

    // Usage tracking
    currentTenantCount: v.number(),
    currentIFlowCount: v.number(),
    currentTeamMemberCount: v.number(),
    currentAIAgentCalls: v.number(),

    // Trial info
    trialStart: v.optional(v.number()), // timestamp
    trialEnd: v.optional(v.number()), // timestamp

    cancelAtPeriodEnd: v.boolean(),
    canceledAt: v.optional(v.number()), // timestamp
  })
    .index("by_userId", ["userId"])
    .index("by_stripeCustomerId", ["stripeCustomerId"])
    .index("by_stripeSubscriptionId", ["stripeSubscriptionId"]),

  // Invoice model
  invoices: defineTable({
    userId: v.id("users"),
    stripeInvoiceId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),

    amountPaid: v.number(), // in cents
    amountDue: v.number(), // in cents
    currency: v.string(),
    status: invoiceStatusValidator,

    invoiceUrl: v.optional(v.string()),
    invoicePdf: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),

    periodStart: v.optional(v.number()), // timestamp
    periodEnd: v.optional(v.number()), // timestamp
    paidAt: v.optional(v.number()), // timestamp
  })
    .index("by_userId", ["userId"])
    .index("by_stripeInvoiceId", ["stripeInvoiceId"]),

  // ============================================================================
  // iFlow Creator Multi-Agent Pipeline
  // ============================================================================

  // Pipeline execution state (one per iFlow creation attempt)
  iflowPipelines: defineTable({
    userId: v.id("users"),
    tenantId: v.id("cpiTenants"),

    // Current pipeline phase
    phase: pipelinePhaseValidator,

    // Inputs (stored as JSON strings for flexibility)
    packageSelection: v.string(),
    description: v.string(),
    tenantCapabilities: v.optional(v.string()),

    // Agent outputs (populated progressively)
    architectResult: v.optional(v.string()),
    reviewerResult: v.optional(v.string()),
    bpmn2Xml: v.optional(v.string()),
    bpmn2ScriptFiles: v.optional(v.string()),
    validatorResult: v.optional(v.string()),
    fixAttempts: v.optional(v.string()),
    summarizerResult: v.optional(v.string()),
    deploymentResult: v.optional(v.string()),

    // The final approved design (after review + fixes)
    finalDesign: v.optional(v.string()),

    // Error state
    errorPhase: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    errorRecoverable: v.optional(v.boolean()),

    // Metrics
    totalTokensUsed: v.number(),
    totalDuration: v.optional(v.number()),

    // Timestamps
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_tenantId", ["tenantId"])
    .index("by_phase", ["phase"])
    .index("by_userId_tenantId", ["userId", "tenantId"]),

  // Individual agent execution logs within a pipeline (audit trail)
  iflowPipelineAgentLogs: defineTable({
    pipelineId: v.id("iflowPipelines"),
    agentName: v.string(), // ARCHITECT | REVIEWER | VALIDATOR | FIX | SUMMARIZER

    status: v.union(
      v.literal("RUNNING"),
      v.literal("COMPLETED"),
      v.literal("FAILED"),
      v.literal("SKIPPED")
    ),

    // Input/Output (JSON, truncated for large payloads)
    input: v.optional(v.string()),
    output: v.optional(v.string()),
    errorMessage: v.optional(v.string()),

    // Metrics
    tokensUsed: v.number(),
    duration: v.number(), // ms

    // For Fix Agent retry tracking
    attemptNumber: v.optional(v.number()),

    // Timestamps
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_pipelineId", ["pipelineId"])
    .index("by_pipelineId_agentName", ["pipelineId", "agentName"]),
});
