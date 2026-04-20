DO $$ BEGIN CREATE TYPE "public"."AIAgentStatus" AS ENUM('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."AIAgentType" AS ENUM('GENERAL_ASSISTANT', 'IFLOW_CREATOR', 'SMART_MONITOR', 'PERFORMANCE_OPTIMIZER', 'ERROR_DIAGNOSTICIAN', 'SECURITY_AUDITOR', 'DOCUMENTATION_GENERATOR', 'TEST_CASE_GENERATOR', 'COST_ANALYZER', 'PREDICTIVE_INSIGHTS'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."AIProvider" AS ENUM('litellm', 'openai', 'claude', 'gemini'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."AuthType" AS ENUM('OAUTH', 'BASIC_AUTH', 'SERVICE_KEY'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."ErrorCategory" AS ENUM('SYSTEM', 'NETWORK', 'MAPPING', 'SECURITY', 'TIMEOUT', 'BUSINESS_LOGIC', 'UNKNOWN'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."ExecutionStatus" AS ENUM('COMPLETED', 'FAILED', 'PROCESSING', 'SKIPPED', 'RETRY'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."IFlowStatus" AS ENUM('STARTED', 'STOPPED', 'STARTING', 'STOPPING', 'ERROR'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."OrganizationType" AS ENUM('ENTERPRISE', 'MID_MARKET', 'STARTUP', 'CONSULTING', 'EDUCATION', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."PipelineAgentLogStatus" AS ENUM('RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."PipelinePhase" AS ENUM('INIT', 'ARCHITECTURE', 'DESIGN_REVIEW', 'BPMN_GENERATION', 'VALIDATION', 'FIX_ATTEMPT', 'SUMMARIZATION', 'AWAITING_APPROVAL', 'DEPLOYING', 'COMPLETED', 'FAILED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."Role" AS ENUM('OWNER', 'ADMIN', 'MEMBER', 'VIEWER'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."TenantStatus" AS ENUM('ACTIVE', 'INACTIVE', 'TESTING', 'ERROR'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."UserRole" AS ENUM('user', 'admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."UserStatus" AS ENUM('ACTIVE', 'SUSPENDED', 'DELETED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_agent_execution" (
	"id" text PRIMARY KEY NOT NULL,
	"agentType" "AIAgentType" NOT NULL,
	"status" "AIAgentStatus" DEFAULT 'RUNNING' NOT NULL,
	"input" text NOT NULL,
	"output" text,
	"errorMessage" text,
	"tokensUsed" integer DEFAULT 0 NOT NULL,
	"duration" integer,
	"success" boolean DEFAULT false NOT NULL,
	"tenantId" text,
	"iFlowId" text,
	"userId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_configuration" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" "AIProvider" NOT NULL,
	"apiKey" text NOT NULL,
	"baseUrl" text,
	"defaultModel" text NOT NULL,
	"fastModel" text,
	"orchestratorModel" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cpi_tenant" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image" text,
	"tenantUrl" text NOT NULL,
	"authType" "AuthType" DEFAULT 'OAUTH' NOT NULL,
	"authenticationUrl" text,
	"clientId" text,
	"clientSecret" text,
	"tokenUrl" text,
	"username" text,
	"password" text,
	"status" "TenantStatus" DEFAULT 'ACTIVE' NOT NULL,
	"lastSyncAt" timestamp,
	"connectionTestAt" timestamp,
	"isConnected" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "cpi_tenant_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "iflow_execution" (
	"id" text PRIMARY KEY NOT NULL,
	"messageId" text NOT NULL,
	"status" "ExecutionStatus" NOT NULL,
	"startTime" timestamp NOT NULL,
	"endTime" timestamp,
	"duration" integer,
	"requestPayload" text,
	"responsePayload" text,
	"errorMessage" text,
	"errorCategory" "ErrorCategory",
	"sender" text,
	"receiver" text,
	"interfaceType" text,
	"iFlowId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "iflow_execution_messageId_unique" UNIQUE("messageId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "iflow_pipeline_agent_log" (
	"id" text PRIMARY KEY NOT NULL,
	"pipelineId" text NOT NULL,
	"agentName" text NOT NULL,
	"status" "PipelineAgentLogStatus" DEFAULT 'RUNNING' NOT NULL,
	"input" text,
	"output" text,
	"errorMessage" text,
	"tokensUsed" integer DEFAULT 0 NOT NULL,
	"duration" integer DEFAULT 0 NOT NULL,
	"attemptNumber" integer,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "iflow_pipeline" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"tenantId" text NOT NULL,
	"phase" "PipelinePhase" DEFAULT 'INIT' NOT NULL,
	"packageSelection" text NOT NULL,
	"description" text NOT NULL,
	"tenantCapabilities" text,
	"architectResult" text,
	"reviewerResult" text,
	"bpmn2Xml" text,
	"bpmn2ScriptFiles" text,
	"validatorResult" text,
	"fixAttempts" text,
	"summarizerResult" text,
	"deploymentResult" text,
	"finalDesign" text,
	"errorPhase" text,
	"errorMessage" text,
	"errorRecoverable" boolean,
	"totalTokensUsed" integer DEFAULT 0 NOT NULL,
	"totalDuration" integer,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "iflow" (
	"id" text PRIMARY KEY NOT NULL,
	"iFlowId" text NOT NULL,
	"name" text NOT NULL,
	"packageName" text,
	"version" text,
	"status" "IFlowStatus" DEFAULT 'STOPPED' NOT NULL,
	"lastDeployedAt" timestamp,
	"lastExecutedAt" timestamp,
	"tenantId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"activeTenantId" text,
	"impersonatedBy" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" "Role" DEFAULT 'MEMBER' NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"acceptedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"tenantId" text NOT NULL,
	"invitedById" text NOT NULL,
	CONSTRAINT "tenant_invitation_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_member" (
	"id" text PRIMARY KEY NOT NULL,
	"role" "Role" DEFAULT 'MEMBER' NOT NULL,
	"joinedAt" timestamp DEFAULT now() NOT NULL,
	"userId" text NOT NULL,
	"tenantId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"passwordHash" text,
	"supabaseId" text,
	"role" "UserRole" DEFAULT 'user' NOT NULL,
	"status" "UserStatus" DEFAULT 'ACTIVE' NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"phone" text,
	"lastLoginAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"onboardingCompleted" boolean DEFAULT false NOT NULL,
	"onboardingData" json,
	"banned" boolean,
	"banReason" text,
	"banExpires" timestamp,
	"defaultTenantId" text,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_supabaseId_unique" UNIQUE("supabaseId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_agent_execution_userId_idx" ON "ai_agent_execution" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_agent_execution_tenantId_idx" ON "ai_agent_execution" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_agent_execution_agentType_idx" ON "ai_agent_execution" USING btree ("agentType");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_agent_execution_status_idx" ON "ai_agent_execution" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_agent_execution_createdAt_idx" ON "ai_agent_execution" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cpi_tenant_status_idx" ON "cpi_tenant" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_execution_iFlowId_idx" ON "iflow_execution" USING btree ("iFlowId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_execution_status_idx" ON "iflow_execution" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_execution_startTime_idx" ON "iflow_execution" USING btree ("startTime");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_pipeline_agent_log_pipelineId_idx" ON "iflow_pipeline_agent_log" USING btree ("pipelineId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_pipeline_agent_log_pipelineId_agentName_idx" ON "iflow_pipeline_agent_log" USING btree ("pipelineId","agentName");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_pipeline_userId_idx" ON "iflow_pipeline" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_pipeline_tenantId_idx" ON "iflow_pipeline" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_pipeline_phase_idx" ON "iflow_pipeline" USING btree ("phase");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_pipeline_userId_tenantId_idx" ON "iflow_pipeline" USING btree ("userId","tenantId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "iflow_tenantId_iFlowId_key" ON "iflow" USING btree ("tenantId","iFlowId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_tenantId_idx" ON "iflow" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_status_idx" ON "iflow" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_updatedAt_idx" ON "iflow" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_tenantId_status_idx" ON "iflow" USING btree ("tenantId","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_tenantId_updatedAt_idx" ON "iflow" USING btree ("tenantId","updatedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_invitation_email_idx" ON "tenant_invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_invitation_tenantId_idx" ON "tenant_invitation" USING btree ("tenantId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_member_userId_tenantId_key" ON "tenant_member" USING btree ("userId","tenantId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_member_tenantId_idx" ON "tenant_member" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_member_userId_idx" ON "tenant_member" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" USING btree ("identifier");