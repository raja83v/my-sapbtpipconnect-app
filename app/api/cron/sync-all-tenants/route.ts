import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncTenantInternal } from "@/app/actions/tenant";

/**
 * Cron Job endpoint to sync all tenants
 * Runs periodically via node-cron scheduler or manual trigger
 *
 * Security: Protected by CRON_SECRET environment variable
 */
export async function GET(request: NextRequest) {
    try {
        // Verify this is a legitimate cron request
        const authHeader = request.headers.get("authorization");

        if (process.env.NODE_ENV === "production") {
            if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
                console.error("[Cron] Unauthorized request");
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                );
            }
        }

        console.log("[Cron] Starting sync for all tenants...");

        // Get all tenants
        const tenants = await prisma.cpiTenant.findMany({
            take: 100,
        });

        if (!tenants || tenants.length === 0) {
            console.log("[Cron] No tenants found");
            return NextResponse.json({
                success: true,
                message: "No tenants to sync",
                synced: 0,
                errors: 0,
            });
        }

        console.log(`[Cron] Found ${tenants.length} tenants`);

        let successCount = 0;
        let errorCount = 0;
        const results: Array<{ tenant: string; success: boolean; error?: string; data?: any }> = [];

        // Sync each OAuth tenant
        for (const tenant of tenants) {
            // Skip if not connected or not OAuth
            if (!tenant.isConnected || tenant.authType !== "OAUTH") {
                console.log(`[Cron] Skipping ${tenant.name} - not connected or not OAuth`);
                continue;
            }

            // Skip if missing credentials
            if (!tenant.clientId || !tenant.clientSecret || !tenant.authenticationUrl) {
                console.log(`[Cron] Skipping ${tenant.name} - missing credentials`);
                continue;
            }

            try {
                console.log(`[Cron] Syncing ${tenant.name}...`);

                const result = await syncTenantInternal(tenant.id);

                if (result.success && result.data) {
                    successCount++;
                    console.log(`[Cron] ✓ Synced ${tenant.name}: ${result.data.iflows} iFlows, ${result.data.executions} executions`);
                    results.push({
                        tenant: tenant.name,
                        success: true,
                        data: result.data,
                    });
                } else {
                    errorCount++;
                    console.error(`[Cron] ✗ Failed ${tenant.name}: ${result.error}`);
                    results.push({
                        tenant: tenant.name,
                        success: false,
                        error: result.error,
                    });
                }
            } catch (error) {
                errorCount++;
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                console.error(`[Cron] ✗ Error syncing ${tenant.name}:`, errorMessage);
                results.push({
                    tenant: tenant.name,
                    success: false,
                    error: errorMessage,
                });
            }
        }

        console.log(`[Cron] Sync complete: ${successCount} succeeded, ${errorCount} failed`);

        return NextResponse.json({
            success: true,
            synced: successCount,
            errors: errorCount,
            totalTenants: tenants.length,
            results,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("[Cron] Fatal error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Internal server error",
            },
            { status: 500 }
        );
    }
}

// Also support POST for manual testing
export async function POST(request: NextRequest) {
    return GET(request);
}
