-- Generated documents (Documentation Generator output history).
CREATE TABLE IF NOT EXISTS "generated_document" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "tenantId" text,
  "iFlowId" text,
  "iFlowName" text,
  "documentationType" text NOT NULL,
  "title" text NOT NULL,
  "version" text,
  "sections" json NOT NULL,
  "diagrams" json NOT NULL,
  "tokensUsed" integer DEFAULT 0 NOT NULL,
  "durationMs" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "generated_document"
    ADD CONSTRAINT "generated_document_userId_user_id_fk"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "generated_document"
    ADD CONSTRAINT "generated_document_tenantId_cpi_tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "cpi_tenant"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "generated_document_userId_idx" ON "generated_document" ("userId");
CREATE INDEX IF NOT EXISTS "generated_document_tenantId_idx" ON "generated_document" ("tenantId");
CREATE INDEX IF NOT EXISTS "generated_document_iFlowId_idx" ON "generated_document" ("iFlowId");
