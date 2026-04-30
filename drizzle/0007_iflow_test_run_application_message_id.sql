-- Track the SAP-Message-Id (ApplicationMessageId) we sent on the request
-- separately from the SAP-assigned CorrelationId returned in the MPL.
ALTER TABLE "iflow_test_run" ADD COLUMN IF NOT EXISTS "applicationMessageId" text;
CREATE INDEX IF NOT EXISTS "iflow_test_run_applicationMessageId_idx"
  ON "iflow_test_run" ("applicationMessageId");
