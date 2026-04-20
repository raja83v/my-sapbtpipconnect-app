import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
  index,
  json,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// ============================================================================
// Enums
// ============================================================================

export const userRoleEnum = pgEnum("UserRole", ["user", "admin"]);
export const userStatusEnum = pgEnum("UserStatus", ["ACTIVE", "SUSPENDED", "DELETED"]);
export const roleEnum = pgEnum("Role", ["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
export const authTypeEnum = pgEnum("AuthType", ["OAUTH", "BASIC_AUTH", "SERVICE_KEY"]);
export const tenantStatusEnum = pgEnum("TenantStatus", ["ACTIVE", "INACTIVE", "TESTING", "ERROR"]);
export const iFlowStatusEnum = pgEnum("IFlowStatus", ["STARTED", "STOPPED", "STARTING", "STOPPING", "ERROR"]);
export const executionStatusEnum = pgEnum("ExecutionStatus", ["COMPLETED", "FAILED", "PROCESSING", "SKIPPED", "RETRY"]);
export const errorCategoryEnum = pgEnum("ErrorCategory", ["SYSTEM", "NETWORK", "MAPPING", "SECURITY", "TIMEOUT", "BUSINESS_LOGIC", "UNKNOWN"]);
export const aiAgentTypeEnum = pgEnum("AIAgentType", [
  "GENERAL_ASSISTANT", "IFLOW_CREATOR", "SMART_MONITOR", "PERFORMANCE_OPTIMIZER",
  "ERROR_DIAGNOSTICIAN", "SECURITY_AUDITOR", "DOCUMENTATION_GENERATOR",
  "TEST_CASE_GENERATOR", "COST_ANALYZER", "PREDICTIVE_INSIGHTS",
]);
export const aiAgentStatusEnum = pgEnum("AIAgentStatus", ["RUNNING", "COMPLETED", "FAILED", "CANCELLED"]);
export const pipelinePhaseEnum = pgEnum("PipelinePhase", [
  "INIT", "ARCHITECTURE", "DESIGN_REVIEW", "BPMN_GENERATION", "VALIDATION",
  "FIX_ATTEMPT", "SUMMARIZATION", "AWAITING_APPROVAL", "DEPLOYING",
  "COMPLETED", "FAILED", "CANCELLED",
]);
export const pipelineAgentLogStatusEnum = pgEnum("PipelineAgentLogStatus", ["RUNNING", "COMPLETED", "FAILED", "SKIPPED"]);
export const organizationTypeEnum = pgEnum("OrganizationType", ["ENTERPRISE", "MID_MARKET", "STARTUP", "CONSULTING", "EDUCATION", "OTHER"]);
export const aiProviderEnum = pgEnum("AIProvider", ["litellm", "openai", "claude", "gemini"]);

// ============================================================================
// User & Auth Models
// ============================================================================

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("passwordHash"),
  supabaseId: text("supabaseId").unique(),
  role: userRoleEnum("role").default("user").notNull(),
  status: userStatusEnum("status").default("ACTIVE").notNull(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  image: text("image"),
  phone: text("phone"),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdateFn(() => new Date()),

  // Onboarding fields
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
  onboardingData: json("onboardingData"),

  // Admin plugin fields
  banned: boolean("banned"),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires"),

  // Default tenant
  defaultTenantId: text("defaultTenantId"),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").notNull().$onUpdateFn(() => new Date()),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull(),
  activeTenantId: text("activeTenantId"),
  impersonatedBy: text("impersonatedBy"),
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").notNull().$onUpdateFn(() => new Date()),
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (table) => [
  index("verification_identifier_idx").on(table.identifier),
]);

// ============================================================================
// SAP CPI Tenant Models
// ============================================================================

export const cpiTenants = pgTable("cpi_tenant", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  image: text("image"),

  // SAP CPI Connection Details
  tenantUrl: text("tenantUrl").notNull(),
  authType: authTypeEnum("authType").default("OAUTH").notNull(),
  authenticationUrl: text("authenticationUrl"),
  clientId: text("clientId"),
  clientSecret: text("clientSecret"),
  tokenUrl: text("tokenUrl"),
  username: text("username"),
  password: text("password"),

  // Tenant Status
  status: tenantStatusEnum("status").default("ACTIVE").notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  connectionTestAt: timestamp("connectionTestAt"),
  isConnected: boolean("isConnected").default(false).notNull(),

  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").notNull().$onUpdateFn(() => new Date()),
}, (table) => [
  index("cpi_tenant_status_idx").on(table.status),
]);

// ============================================================================
// iFlow Models
// ============================================================================

export const iFlows = pgTable("iflow", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  iFlowId: text("iFlowId").notNull(),
  name: text("name").notNull(),
  packageName: text("packageName"),
  version: text("version"),
  status: iFlowStatusEnum("status").default("STOPPED").notNull(),
  lastDeployedAt: timestamp("lastDeployedAt"),
  lastExecutedAt: timestamp("lastExecutedAt"),

  tenantId: text("tenantId").notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").notNull().$onUpdateFn(() => new Date()),
}, (table) => [
  uniqueIndex("iflow_tenantId_iFlowId_key").on(table.tenantId, table.iFlowId),
  index("iflow_tenantId_idx").on(table.tenantId),
  index("iflow_status_idx").on(table.status),
  index("iflow_updatedAt_idx").on(table.updatedAt),
  index("iflow_tenantId_status_idx").on(table.tenantId, table.status),
  index("iflow_tenantId_updatedAt_idx").on(table.tenantId, table.updatedAt),
]);

export const iFlowExecutions = pgTable("iflow_execution", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  messageId: text("messageId").notNull().unique(),
  status: executionStatusEnum("status").notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  duration: integer("duration"),

  // Payload data
  requestPayload: text("requestPayload"),
  responsePayload: text("responsePayload"),
  errorMessage: text("errorMessage"),
  errorCategory: errorCategoryEnum("errorCategory"),

  // Metadata
  sender: text("sender"),
  receiver: text("receiver"),
  interfaceType: text("interfaceType"),

  iFlowId: text("iFlowId").notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("iflow_execution_iFlowId_idx").on(table.iFlowId),
  index("iflow_execution_status_idx").on(table.status),
  index("iflow_execution_startTime_idx").on(table.startTime),
]);

// ============================================================================
// Team & Membership Models
// ============================================================================

export const tenantMembers = pgTable("tenant_member", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  role: roleEnum("role").default("MEMBER").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),

  userId: text("userId").notNull(),
  tenantId: text("tenantId").notNull(),
}, (table) => [
  uniqueIndex("tenant_member_userId_tenantId_key").on(table.userId, table.tenantId),
  index("tenant_member_tenantId_idx").on(table.tenantId),
  index("tenant_member_userId_idx").on(table.userId),
]);

export const tenantInvitations = pgTable("tenant_invitation", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  email: text("email").notNull(),
  role: roleEnum("role").default("MEMBER").notNull(),
  token: text("token").notNull().unique().$defaultFn(() => createId()),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),

  tenantId: text("tenantId").notNull(),
  invitedById: text("invitedById").notNull(),
}, (table) => [
  index("tenant_invitation_email_idx").on(table.email),
  index("tenant_invitation_tenantId_idx").on(table.tenantId),
]);

// ============================================================================
// AI Agent Models
// ============================================================================

export const aiChatConversations = pgTable("ai_chat_conversation", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  title: text("title").notNull().default("New Chat"),
  userId: text("userId").notNull(),
  tenantId: text("tenantId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdateFn(() => new Date()),
}, (table) => [
  index("ai_chat_conversation_userId_idx").on(table.userId),
  index("ai_chat_conversation_userId_tenantId_idx").on(table.userId, table.tenantId),
  index("ai_chat_conversation_updatedAt_idx").on(table.updatedAt),
]);

export const aiAgentExecutions = pgTable("ai_agent_execution", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  agentType: aiAgentTypeEnum("agentType").notNull(),
  status: aiAgentStatusEnum("status").default("RUNNING").notNull(),

  input: text("input").notNull(),
  output: text("output"),
  errorMessage: text("errorMessage"),

  tokensUsed: integer("tokensUsed").default(0).notNull(),
  duration: integer("duration"),
  success: boolean("success").default(false).notNull(),

  tenantId: text("tenantId"),
  iFlowId: text("iFlowId"),
  conversationId: text("conversationId"),

  userId: text("userId").notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").notNull().$onUpdateFn(() => new Date()),
}, (table) => [
  index("ai_agent_execution_userId_idx").on(table.userId),
  index("ai_agent_execution_tenantId_idx").on(table.tenantId),
  index("ai_agent_execution_agentType_idx").on(table.agentType),
  index("ai_agent_execution_status_idx").on(table.status),
  index("ai_agent_execution_createdAt_idx").on(table.createdAt),
  index("ai_agent_execution_conversationId_idx").on(table.conversationId),
]);

// ============================================================================
// iFlow Creator Multi-Agent Pipeline
// ============================================================================

export const iFlowPipelines = pgTable("iflow_pipeline", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("userId").notNull(),
  tenantId: text("tenantId").notNull(),

  phase: pipelinePhaseEnum("phase").default("INIT").notNull(),

  packageSelection: text("packageSelection").notNull(),
  description: text("description").notNull(),
  tenantCapabilities: text("tenantCapabilities"),

  architectResult: text("architectResult"),
  reviewerResult: text("reviewerResult"),
  bpmn2Xml: text("bpmn2Xml"),
  bpmn2ScriptFiles: text("bpmn2ScriptFiles"),
  validatorResult: text("validatorResult"),
  fixAttempts: text("fixAttempts"),
  summarizerResult: text("summarizerResult"),
  deploymentResult: text("deploymentResult"),

  finalDesign: text("finalDesign"),

  errorPhase: text("errorPhase"),
  errorMessage: text("errorMessage"),
  errorRecoverable: boolean("errorRecoverable"),

  totalTokensUsed: integer("totalTokensUsed").default(0).notNull(),
  totalDuration: integer("totalDuration"),

  startedAt: timestamp("startedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").notNull().$onUpdateFn(() => new Date()),
  completedAt: timestamp("completedAt"),
}, (table) => [
  index("iflow_pipeline_userId_idx").on(table.userId),
  index("iflow_pipeline_tenantId_idx").on(table.tenantId),
  index("iflow_pipeline_phase_idx").on(table.phase),
  index("iflow_pipeline_userId_tenantId_idx").on(table.userId, table.tenantId),
]);

export const iFlowPipelineAgentLogs = pgTable("iflow_pipeline_agent_log", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  pipelineId: text("pipelineId").notNull(),

  agentName: text("agentName").notNull(),
  status: pipelineAgentLogStatusEnum("status").default("RUNNING").notNull(),

  input: text("input"),
  output: text("output"),
  errorMessage: text("errorMessage"),

  tokensUsed: integer("tokensUsed").default(0).notNull(),
  duration: integer("duration").default(0).notNull(),

  attemptNumber: integer("attemptNumber"),

  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => [
  index("iflow_pipeline_agent_log_pipelineId_idx").on(table.pipelineId),
  index("iflow_pipeline_agent_log_pipelineId_agentName_idx").on(table.pipelineId, table.agentName),
]);

// ============================================================================
// AI Configuration (instance-level)
// ============================================================================

export const aiConfigurations = pgTable("ai_configuration", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  provider: aiProviderEnum("provider").notNull(),
  apiKey: text("apiKey").notNull(),
  baseUrl: text("baseUrl"),
  defaultModel: text("defaultModel").notNull(),
  fastModel: text("fastModel"),
  orchestratorModel: text("orchestratorModel"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").notNull().$onUpdateFn(() => new Date()),
});

// ============================================================================
// Relations
// ============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  tenants: many(tenantMembers),
  invitationsSent: many(tenantInvitations),
  agentExecutions: many(aiAgentExecutions),
  pipelines: many(iFlowPipelines),
  defaultTenant: one(cpiTenants, {
    fields: [users.defaultTenantId],
    references: [cpiTenants.id],
    relationName: "UserDefaultTenant",
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
  activeTenant: one(cpiTenants, { fields: [sessions.activeTenantId], references: [cpiTenants.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const cpiTenantsRelations = relations(cpiTenants, ({ many }) => ({
  members: many(tenantMembers),
  invitations: many(tenantInvitations),
  sessions: many(sessions),
  defaultForUsers: many(users, { relationName: "UserDefaultTenant" }),
  iFlows: many(iFlows),
  pipelines: many(iFlowPipelines),
}));

export const iFlowsRelations = relations(iFlows, ({ one, many }) => ({
  tenant: one(cpiTenants, { fields: [iFlows.tenantId], references: [cpiTenants.id] }),
  executions: many(iFlowExecutions),
}));

export const iFlowExecutionsRelations = relations(iFlowExecutions, ({ one }) => ({
  iFlow: one(iFlows, { fields: [iFlowExecutions.iFlowId], references: [iFlows.id] }),
}));

export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  user: one(users, { fields: [tenantMembers.userId], references: [users.id] }),
  tenant: one(cpiTenants, { fields: [tenantMembers.tenantId], references: [cpiTenants.id] }),
}));

export const tenantInvitationsRelations = relations(tenantInvitations, ({ one }) => ({
  tenant: one(cpiTenants, { fields: [tenantInvitations.tenantId], references: [cpiTenants.id] }),
  invitedBy: one(users, { fields: [tenantInvitations.invitedById], references: [users.id] }),
}));

export const aiAgentExecutionsRelations = relations(aiAgentExecutions, ({ one }) => ({
  user: one(users, { fields: [aiAgentExecutions.userId], references: [users.id] }),
  conversation: one(aiChatConversations, { fields: [aiAgentExecutions.conversationId], references: [aiChatConversations.id] }),
}));

export const aiChatConversationsRelations = relations(aiChatConversations, ({ one, many }) => ({
  user: one(users, { fields: [aiChatConversations.userId], references: [users.id] }),
  executions: many(aiAgentExecutions),
}));

export const iFlowPipelinesRelations = relations(iFlowPipelines, ({ one, many }) => ({
  user: one(users, { fields: [iFlowPipelines.userId], references: [users.id] }),
  tenant: one(cpiTenants, { fields: [iFlowPipelines.tenantId], references: [cpiTenants.id] }),
  agentLogs: many(iFlowPipelineAgentLogs),
}));

export const iFlowPipelineAgentLogsRelations = relations(iFlowPipelineAgentLogs, ({ one }) => ({
  pipeline: one(iFlowPipelines, { fields: [iFlowPipelineAgentLogs.pipelineId], references: [iFlowPipelines.id] }),
}));

// ============================================================================
// Type Exports (replaces @prisma/client types)
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
export type CpiTenant = typeof cpiTenants.$inferSelect;
export type NewCpiTenant = typeof cpiTenants.$inferInsert;
export type IFlow = typeof iFlows.$inferSelect;
export type IFlowExecution = typeof iFlowExecutions.$inferSelect;
export type TenantMember = typeof tenantMembers.$inferSelect;
export type TenantInvitation = typeof tenantInvitations.$inferSelect;
export type AIAgentExecution = typeof aiAgentExecutions.$inferSelect;
export type IFlowPipeline = typeof iFlowPipelines.$inferSelect;
export type IFlowPipelineAgentLog = typeof iFlowPipelineAgentLogs.$inferSelect;
export type AIConfiguration = typeof aiConfigurations.$inferSelect;

// Enum value types (replaces Prisma enum imports)
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type UserStatus = (typeof userStatusEnum.enumValues)[number];
export type Role = (typeof roleEnum.enumValues)[number];
export type AuthType = (typeof authTypeEnum.enumValues)[number];
export type TenantStatus = (typeof tenantStatusEnum.enumValues)[number];
export type IFlowStatus = (typeof iFlowStatusEnum.enumValues)[number];
export type ExecutionStatus = (typeof executionStatusEnum.enumValues)[number];
export type ErrorCategory = (typeof errorCategoryEnum.enumValues)[number];
export type AIAgentType = (typeof aiAgentTypeEnum.enumValues)[number];
export type AIAgentStatus = (typeof aiAgentStatusEnum.enumValues)[number];
export type PipelinePhase = (typeof pipelinePhaseEnum.enumValues)[number];
export type PipelineAgentLogStatus = (typeof pipelineAgentLogStatusEnum.enumValues)[number];
export type OrganizationType = (typeof organizationTypeEnum.enumValues)[number];
export type AIProvider = (typeof aiProviderEnum.enumValues)[number];
