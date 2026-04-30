-- Client-certificate (mTLS) runtime credentials for the iFlow Test runner.
-- All three columns are encrypted at rest.
ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "runtimeClientCertPem" text;
ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "runtimeClientKeyPem" text;
ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "runtimeClientKeyPassphrase" text;
