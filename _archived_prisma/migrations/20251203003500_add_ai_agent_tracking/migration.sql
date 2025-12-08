-- CreateEnum
CREATE TYPE "AIAgentType" AS ENUM ('IFLOW_CREATOR', 'SMART_MONITOR', 'PERFORMANCE_OPTIMIZER', 'ERROR_DIAGNOSTICIAN', 'SECURITY_AUDITOR', 'DOCUMENTATION_GENERATOR', 'TEST_CASE_GENERATOR', 'COST_ANALYZER', 'PREDICTIVE_INSIGHTS');

-- CreateEnum
CREATE TYPE "AIAgentStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ai_agent_execution" (
    "id" TEXT NOT NULL,
    "agentType" "AIAgentType" NOT NULL,
    "status" "AIAgentStatus" NOT NULL DEFAULT 'RUNNING',
    "inputPrompt" TEXT NOT NULL,
    "outputData" TEXT,
    "errorMessage" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "tenantId" TEXT,
    "iFlowId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_agent_execution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_agent_execution_userId_idx" ON "ai_agent_execution"("userId");

-- CreateIndex
CREATE INDEX "ai_agent_execution_tenantId_idx" ON "ai_agent_execution"("tenantId");

-- CreateIndex
CREATE INDEX "ai_agent_execution_agentType_idx" ON "ai_agent_execution"("agentType");

-- CreateIndex
CREATE INDEX "ai_agent_execution_status_idx" ON "ai_agent_execution"("status");

-- CreateIndex
CREATE INDEX "ai_agent_execution_createdAt_idx" ON "ai_agent_execution"("createdAt");

-- AddForeignKey
ALTER TABLE "ai_agent_execution" ADD CONSTRAINT "ai_agent_execution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
