import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Sync iFlows for all connected tenants
 * Called by cron job every 5 minutes
 */
export const syncAllTenantIFlows = internalAction({
    args: {},
    handler: async (ctx) => {
        console.log('🔄 Starting automatic iFlow sync for all tenants...');

        // Get all connected OAuth tenants
        const tenants = await ctx.runQuery(internal.cronJobs.getConnectedTenants);

        let successCount = 0;
        let errorCount = 0;

        // Sync each tenant
        for (const tenant of tenants) {
            try {
                console.log(`Syncing iFlows for tenant: ${tenant.name}`);

                // Type guard: ensure OAuth credentials exist
                if (!tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
                    console.error(`Missing OAuth credentials for tenant ${tenant.name}`);
                    errorCount++;
                    continue;
                }

                await ctx.runAction(internal.sapSync.fetchIFlows, {
                    tenantId: tenant._id,
                    tenantUrl: tenant.tenantUrl,
                    authUrl: tenant.authenticationUrl,
                    clientId: tenant.clientId,
                    clientSecret: tenant.clientSecret,
                });

                successCount++;
            } catch (error) {
                console.error(`Error syncing tenant ${tenant.name}:`, error);
                errorCount++;
            }
        }

        console.log(`✅ iFlow sync completed: ${successCount} successful, ${errorCount} errors`);
        return { successCount, errorCount };
    },
});

/**
 * Sync messages for all connected tenants
 * Called by cron job every 2 minutes
 */
export const syncAllTenantMessages = internalAction({
    args: {},
    handler: async (ctx) => {
        console.log('📨 Starting automatic message sync for all tenants...');

        // Get all connected OAuth tenants
        const tenants = await ctx.runQuery(internal.cronJobs.getConnectedTenants);

        let successCount = 0;
        let errorCount = 0;

        // Sync each tenant
        for (const tenant of tenants) {
            try {
                console.log(`Syncing messages for tenant: ${tenant.name}`);

                // Type guard: ensure OAuth credentials exist
                if (!tenant.authenticationUrl || !tenant.clientId || !tenant.clientSecret) {
                    console.error(`Missing OAuth credentials for tenant ${tenant.name}`);
                    errorCount++;
                    continue;
                }

                await ctx.runAction(internal.sapSync.fetchMessages, {
                    tenantId: tenant._id,
                    tenantUrl: tenant.tenantUrl,
                    authUrl: tenant.authenticationUrl,
                    clientId: tenant.clientId,
                    clientSecret: tenant.clientSecret,
                    maxLogs: 500,
                });

                successCount++;
            } catch (error) {
                console.error(`Error syncing messages for tenant ${tenant.name}:`, error);
                errorCount++;
            }
        }

        console.log(`✅ Message sync completed: ${successCount} successful, ${errorCount} errors`);
        return { successCount, errorCount };
    },
});

/**
 * Internal query to get all connected OAuth tenants
 */
export const getConnectedTenants = internalQuery({
    args: {},
    handler: async (ctx) => {
        // First, get ALL tenants to see what we have
        const allTenants = await ctx.db.query("cpiTenants").collect();
        console.log(`📊 Total tenants in database: ${allTenants.length}`);

        if (allTenants.length > 0) {
            console.log('📋 Tenant details:');
            allTenants.forEach(t => {
                console.log(`  - ${t.name}:`);
                console.log(`    authType: ${t.authType}`);
                console.log(`    isConnected: ${t.isConnected}`);
                console.log(`    has clientId: ${!!t.clientId}`);
                console.log(`    has clientSecret: ${!!t.clientSecret}`);
                console.log(`    has authenticationUrl: ${!!t.authenticationUrl}`);
            });
        }

        const tenants = await ctx.db
            .query("cpiTenants")
            .filter((q) =>
                q.and(
                    q.eq(q.field("isConnected"), true),
                    q.eq(q.field("authType"), "OAUTH"),
                    q.neq(q.field("clientId"), undefined),
                    q.neq(q.field("clientSecret"), undefined),
                    q.neq(q.field("authenticationUrl"), undefined)
                )
            )
            .collect();

        console.log(`✅ Found ${tenants.length} OAuth tenants ready for sync`);
        return tenants;
    },
});