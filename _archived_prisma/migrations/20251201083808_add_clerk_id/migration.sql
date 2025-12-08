-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('OAUTH', 'BASIC_AUTH', 'SERVICE_KEY');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('ENTERPRISE', 'MID_MARKET', 'STARTUP', 'CONSULTING', 'EDUCATION', 'OTHER');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TESTING', 'ERROR');

-- CreateEnum
CREATE TYPE "IFlowStatus" AS ENUM ('STARTED', 'STOPPED', 'STARTING', 'STOPPING', 'ERROR');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('COMPLETED', 'FAILED', 'PROCESSING', 'SKIPPED', 'RETRY');

-- CreateEnum
CREATE TYPE "ErrorCategory" AS ENUM ('SYSTEM', 'NETWORK', 'MAPPING', 'SECURITY', 'TIMEOUT', 'BUSINESS_LOGIC', 'UNKNOWN');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "phone" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingData" JSONB,
    "banned" BOOLEAN,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "defaultTenantId" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeTenantId" TEXT,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpi_tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "tenantUrl" TEXT NOT NULL,
    "authType" "AuthType" NOT NULL DEFAULT 'OAUTH',
    "authenticationUrl" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "tokenUrl" TEXT,
    "username" TEXT,
    "password" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "connectionTestAt" TIMESTAMP(3),
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpi_tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iflow" (
    "id" TEXT NOT NULL,
    "iFlowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "packageName" TEXT,
    "version" TEXT,
    "status" "IFlowStatus" NOT NULL DEFAULT 'STOPPED',
    "lastDeployedAt" TIMESTAMP(3),
    "lastExecutedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iflow_execution" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "requestPayload" TEXT,
    "responsePayload" TEXT,
    "errorMessage" TEXT,
    "errorCategory" "ErrorCategory",
    "sender" TEXT,
    "receiver" TEXT,
    "interfaceType" TEXT,
    "iFlowId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iflow_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_member" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "tenant_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,

    CONSTRAINT "tenant_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_clerkId_key" ON "user"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "cpi_tenant_slug_key" ON "cpi_tenant"("slug");

-- CreateIndex
CREATE INDEX "iflow_tenantId_idx" ON "iflow"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "iflow_tenantId_iFlowId_key" ON "iflow"("tenantId", "iFlowId");

-- CreateIndex
CREATE UNIQUE INDEX "iflow_execution_messageId_key" ON "iflow_execution"("messageId");

-- CreateIndex
CREATE INDEX "iflow_execution_iFlowId_idx" ON "iflow_execution"("iFlowId");

-- CreateIndex
CREATE INDEX "iflow_execution_status_idx" ON "iflow_execution"("status");

-- CreateIndex
CREATE INDEX "iflow_execution_startTime_idx" ON "iflow_execution"("startTime");

-- CreateIndex
CREATE INDEX "tenant_member_tenantId_idx" ON "tenant_member"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_member_userId_idx" ON "tenant_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_member_userId_tenantId_key" ON "tenant_member"("userId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invitation_token_key" ON "tenant_invitation"("token");

-- CreateIndex
CREATE INDEX "tenant_invitation_email_idx" ON "tenant_invitation"("email");

-- CreateIndex
CREATE INDEX "tenant_invitation_tenantId_idx" ON "tenant_invitation"("tenantId");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_defaultTenantId_fkey" FOREIGN KEY ("defaultTenantId") REFERENCES "cpi_tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_activeTenantId_fkey" FOREIGN KEY ("activeTenantId") REFERENCES "cpi_tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iflow" ADD CONSTRAINT "iflow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "cpi_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iflow_execution" ADD CONSTRAINT "iflow_execution_iFlowId_fkey" FOREIGN KEY ("iFlowId") REFERENCES "iflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member" ADD CONSTRAINT "tenant_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_member" ADD CONSTRAINT "tenant_member_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "cpi_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invitation" ADD CONSTRAINT "tenant_invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "cpi_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invitation" ADD CONSTRAINT "tenant_invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
