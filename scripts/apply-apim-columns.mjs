import postgres from "postgres";
const sql = postgres("postgresql://app:app@127.0.0.1:5435/app");
await sql.unsafe(`
  ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "apimAuthType" text;
  ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "apimClientId" text;
  ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "apimClientSecret" text;
  ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "apimUsername" text;
  ALTER TABLE "cpi_tenant" ADD COLUMN IF NOT EXISTS "apimPassword" text;
`);
const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='cpi_tenant' AND column_name LIKE 'apim%' ORDER BY column_name`;
console.log("APIM columns:", cols.map((c) => c.column_name));
await sql.end();
