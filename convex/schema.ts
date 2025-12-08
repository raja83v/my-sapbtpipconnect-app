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
});
