// One-time script to add apimUrl column and set it for existing tenants
// Run with: node scripts/set-apim-url.mjs

import postgres from "postgres";

const DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54342/postgres";
const APIM_URL = "https://baudev.integrationsuite.cfapps.ap10.hana.ondemand.com";
const TENANT_PATTERN = "it-cpi002";

const sql = postgres(DATABASE_URL);

try {
    // Add column if not exists
    await sql`ALTER TABLE cpi_tenant ADD COLUMN IF NOT EXISTS "apimUrl" text`;
    console.log("✅ Column apimUrl added (or already exists)");

    // Update matching tenants
    const result = await sql`
        UPDATE cpi_tenant 
        SET "apimUrl" = ${APIM_URL}
        WHERE "tenantUrl" LIKE ${"%" + TENANT_PATTERN + "%"}
        AND "apimUrl" IS NULL
        RETURNING name, "tenantUrl", "apimUrl"
    `;

    if (result.length === 0) {
        console.log("ℹ️  No tenants updated (already set or no match)");
        
        // Show all tenants
        const all = await sql`SELECT name, "tenantUrl", "apimUrl" FROM cpi_tenant`;
        console.log("\nAll tenants:");
        all.forEach(t => {
            console.log(`  - ${t.name}: ${t.tenantUrl} | apimUrl: ${t.apimUrl || "(not set)"}`);
        });
    } else {
        result.forEach(t => {
            console.log(`✅ Updated "${t.name}": apimUrl = ${t.apimUrl}`);
        });
    }
} catch (err) {
    console.error("❌ Error:", err.message);
} finally {
    await sql.end();
}
