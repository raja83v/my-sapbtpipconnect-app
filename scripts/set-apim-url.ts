/**
 * One-time script to set the APIM URL for an existing tenant.
 *
 * Usage:
 *   pnpm tsx scripts/set-apim-url.ts
 *
 * Or with custom values:
 *   APIM_URL=https://your-tenant.integrationsuite.cfapps.ap10.hana.ondemand.com \
 *   TENANT_URL_PATTERN=it-cpi002 \
 *   pnpm tsx scripts/set-apim-url.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { cpiTenants } from "../lib/db/schema";
import { like, isNull } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
}

const APIM_URL = process.env.APIM_URL || "https://baudev.integrationsuite.cfapps.ap10.hana.ondemand.com";
const TENANT_URL_PATTERN = process.env.TENANT_URL_PATTERN || "it-cpi002";

async function main() {
    const client = postgres(DATABASE_URL!);
    const db = drizzle(client);

    console.log(`\n🔍 Looking for tenants with URL containing: ${TENANT_URL_PATTERN}`);
    console.log(`📡 Will set APIM URL to: ${APIM_URL}\n`);

    // Find tenants that match the pattern and don't have apimUrl set
    const tenants = await db.select({
        id: cpiTenants.id,
        name: cpiTenants.name,
        tenantUrl: cpiTenants.tenantUrl,
        apimUrl: cpiTenants.apimUrl,
    }).from(cpiTenants);

    const matchingTenants = tenants.filter(t =>
        t.tenantUrl.includes(TENANT_URL_PATTERN) && !t.apimUrl
    );

    if (matchingTenants.length === 0) {
        console.log("ℹ️  No matching tenants found (or all already have apimUrl set).");
        console.log("\nAll tenants:");
        tenants.forEach(t => {
            console.log(`  - ${t.name}: ${t.tenantUrl} | apimUrl: ${t.apimUrl || "(not set)"}`);
        });
        await client.end();
        return;
    }

    console.log(`Found ${matchingTenants.length} tenant(s) to update:`);
    matchingTenants.forEach(t => {
        console.log(`  - ${t.name} (${t.tenantUrl})`);
    });

    for (const tenant of matchingTenants) {
        await db.update(cpiTenants)
            .set({ apimUrl: APIM_URL })
            .where(like(cpiTenants.id, tenant.id));

        console.log(`✅ Updated tenant "${tenant.name}" with APIM URL: ${APIM_URL}`);
    }

    console.log("\n✅ Done! Restart the dev server for changes to take effect.");
    await client.end();
}

main().catch((err) => {
    console.error("❌ Script failed:", err);
    process.exit(1);
});
