-- Add new phase values for the multi-agent studio orchestration.
-- ALTER TYPE ... ADD VALUE cannot run inside an explicit transaction; drizzle's
-- migrator wraps each statement breakpoint chunk in its own statement which
-- is fine for ADD VALUE as long as the values don't already exist.

ALTER TYPE "PipelinePhase" ADD VALUE IF NOT EXISTS 'CLARIFYING';--> statement-breakpoint
ALTER TYPE "PipelinePhase" ADD VALUE IF NOT EXISTS 'PLANNING';--> statement-breakpoint
ALTER TYPE "PipelinePhase" ADD VALUE IF NOT EXISTS 'SPECIALISTS';--> statement-breakpoint
ALTER TYPE "PipelinePhase" ADD VALUE IF NOT EXISTS 'INTEGRATING';--> statement-breakpoint
ALTER TYPE "PipelinePhase" ADD VALUE IF NOT EXISTS 'SAMPLE_GEN';--> statement-breakpoint
ALTER TYPE "PipelinePhase" ADD VALUE IF NOT EXISTS 'MODIFYING';--> statement-breakpoint
ALTER TYPE "PipelinePhase" ADD VALUE IF NOT EXISTS 'DRAFTED';--> statement-breakpoint

-- Studio columns on iflow_pipeline
ALTER TABLE "iflow_pipeline" ADD COLUMN IF NOT EXISTS "requirementsBrief" jsonb;--> statement-breakpoint
ALTER TABLE "iflow_pipeline" ADD COLUMN IF NOT EXISTS "blueprint" jsonb;--> statement-breakpoint
ALTER TABLE "iflow_pipeline" ADD COLUMN IF NOT EXISTS "specialistResults" jsonb;--> statement-breakpoint
ALTER TABLE "iflow_pipeline" ADD COLUMN IF NOT EXISTS "samplePayloads" jsonb;--> statement-breakpoint
ALTER TABLE "iflow_pipeline" ADD COLUMN IF NOT EXISTS "previousDesign" jsonb;--> statement-breakpoint
ALTER TABLE "iflow_pipeline" ADD COLUMN IF NOT EXISTS "draftArtifactId" text;--> statement-breakpoint
ALTER TABLE "iflow_pipeline" ADD COLUMN IF NOT EXISTS "parametersFile" text;--> statement-breakpoint
ALTER TABLE "iflow_pipeline" ADD COLUMN IF NOT EXISTS "studioMode" boolean DEFAULT true NOT NULL;--> statement-breakpoint

-- Chat thread for the studio (clarifier Q&A + modify instructions)
CREATE TABLE IF NOT EXISTS "iflow_pipeline_message" (
    "id" text PRIMARY KEY NOT NULL,
    "pipelineId" text NOT NULL REFERENCES "iflow_pipeline"("id") ON DELETE CASCADE,
    "role" text NOT NULL,
    "kind" text NOT NULL DEFAULT 'TEXT',
    "content" text NOT NULL,
    "metadata" jsonb,
    "createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "iflow_pipeline_message_pipelineId_idx" ON "iflow_pipeline_message" ("pipelineId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "iflow_pipeline_message_pipelineId_createdAt_idx" ON "iflow_pipeline_message" ("pipelineId", "createdAt");--> statement-breakpoint

-- Catalog pattern index for tenant-scoped RAG
CREATE TABLE IF NOT EXISTS "iflow_pattern_index" (
    "id" text PRIMARY KEY NOT NULL,
    "tenantId" text NOT NULL REFERENCES "cpi_tenant"("id") ON DELETE CASCADE,
    "iflowSapId" text NOT NULL,
    "iflowName" text NOT NULL,
    "summary" text NOT NULL,
    "keywords" text,
    "componentTypes" jsonb,
    "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "iflow_pattern_index_tenantId_idx" ON "iflow_pattern_index" ("tenantId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "iflow_pattern_index_tenantId_iflowSapId_uq" ON "iflow_pattern_index" ("tenantId", "iflowSapId");--> statement-breakpoint
