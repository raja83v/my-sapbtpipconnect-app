-- Add APIM-specific credential columns to cpi_tenant
-- These allow users to configure separate credentials for SAP API Management,
-- independent of the CPI credentials. When null, APIM calls fall back to CPI credentials.
ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "apimAuthType" text;
ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "apimClientId" text;
ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "apimClientSecret" text;
ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "apimUsername" text;
ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "apimPassword" text;
