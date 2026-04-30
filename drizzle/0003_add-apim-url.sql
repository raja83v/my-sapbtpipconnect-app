-- Migration: Add apimUrl field to cpi_tenant table
-- SAP API Management (APIM) uses a different host than the CPI runtime.
-- e.g. CPI:  https://{tenant}.it-cpi002.cfapps.ap10.hana.ondemand.com
--      APIM: https://{tenant}.integrationsuite.cfapps.ap10.hana.ondemand.com

ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "apimUrl" text;
