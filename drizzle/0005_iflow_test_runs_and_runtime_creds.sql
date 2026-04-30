-- Runtime credentials on cpi_tenant — used to invoke deployed iFlow endpoints.
-- When all null, callers fall back to the CPI management credentials.
ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "runtimeAuthType" text;
ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "runtimeTokenUrl" text;
ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "runtimeClientId" text;
ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "runtimeClientSecret" text;
ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "runtimeUsername" text;
ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "runtimePassword" text;

-- Persisted ad-hoc invocations from the iFlow Test runner UI.
CREATE TABLE IF NOT EXISTS "iflow_test_run" (
    "id" text PRIMARY KEY NOT NULL,
    "iFlowDbId" text NOT NULL,
    "tenantId" text NOT NULL,
    "userId" text,
    "endpointUrl" text NOT NULL,
    "protocol" text NOT NULL,
    "httpMethod" text NOT NULL,
    "requestHeaders" json,
    "requestQuery" json,
    "requestBody" text,
    "requestContentType" text,
    "responseStatus" integer,
    "responseHeaders" json,
    "responseBody" text,
    "responseContentType" text,
    "responseTruncated" boolean DEFAULT false NOT NULL,
    "durationMs" integer,
    "errorMessage" text,
    "messageGuid" text,
    "correlationId" text,
    "traceWasEnabled" boolean DEFAULT false NOT NULL,
    "executedAt" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "iflow_test_run_iFlowDbId_fk" FOREIGN KEY ("iFlowDbId") REFERENCES "iflow"("id") ON DELETE cascade,
    CONSTRAINT "iflow_test_run_tenantId_fk" FOREIGN KEY ("tenantId") REFERENCES "cpi_tenant"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "iflow_test_run_iFlowDbId_idx" ON "iflow_test_run" ("iFlowDbId");
CREATE INDEX IF NOT EXISTS "iflow_test_run_iFlowDbId_executedAt_idx" ON "iflow_test_run" ("iFlowDbId", "executedAt");
CREATE INDEX IF NOT EXISTS "iflow_test_run_messageGuid_idx" ON "iflow_test_run" ("messageGuid");
