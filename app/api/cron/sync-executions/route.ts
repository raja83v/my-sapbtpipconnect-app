import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cpiTenants } from "@/lib/db/schema";
import { eq, and, or, isNull, lt, isNotNull, asc } from "drizzle-orm";
import { syncTenantInternal } from "@/app/actions/tenant";

/**
 * Cron job endpoint to sync executions for all active tenants
 *
 * This endpoint can be called by:
 * 1. node-cron scheduler (recommended)
 * 2. External cron services
 * 3. Manual trigger via API call
 *
 * Security: Protected by CRON_SECRET environment variable
 *
 * Recommended schedule: Every 15-30 minutes
 */

// Configuration
const CONFIG = {
  // Maximum tenants to sync per cron run (prevents timeouts)
  maxTenantsPerRun: 10,
  // Only sync tenants that haven't been synced in the last N minutes
  minSyncIntervalMinutes: 10,
  // Maximum execution time before timing out individual tenant (ms)
  tenantTimeoutMs: 120000, // 2 minutes per tenant
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    const isAuthorized = cronSecret
      ? authHeader === `Bearer ${cronSecret}`
      : process.env.NODE_ENV === "development";

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const startTime = Date.now();

    // Get active tenants that need syncing
    const minSyncTime = new Date(Date.now() - CONFIG.minSyncIntervalMinutes * 60 * 1000);

    const tenantsToSync = await db.select().from(cpiTenants).where(
      and(
        eq(cpiTenants.isConnected, true),
        eq(cpiTenants.authType, "OAUTH"),
        isNotNull(cpiTenants.clientId),
        isNotNull(cpiTenants.clientSecret),
        isNotNull(cpiTenants.authenticationUrl),
        or(
          isNull(cpiTenants.lastSyncAt),
          lt(cpiTenants.lastSyncAt, minSyncTime)
        )
      )
    ).limit(CONFIG.maxTenantsPerRun).orderBy(asc(cpiTenants.lastSyncAt));


    if (tenantsToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No tenants need syncing",
        tenantsProcessed: 0,
        duration: Date.now() - startTime,
      });
    }

    // Process tenants sequentially to avoid overwhelming resources
    const results: Array<{
      tenantId: string;
      tenantName: string;
      success: boolean;
      iflows?: number;
      executions?: number;
      error?: string;
      duration: number;
    }> = [];

    for (const tenant of tenantsToSync) {
      const tenantStartTime = Date.now();

      try {

        // Use Promise.race for timeout
        const syncPromise = syncTenantInternal(tenant.id);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Tenant sync timeout")), CONFIG.tenantTimeoutMs);
        });

        const result = await Promise.race([syncPromise, timeoutPromise]);

        if (result.success && result.data) {
          results.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            success: true,
            iflows: result.data.iflows,
            executions: result.data.executions,
            duration: Date.now() - tenantStartTime,
          });
        } else {
          results.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            success: false,
            error: result.error || "Unknown error",
            duration: Date.now() - tenantStartTime,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          success: false,
          error: errorMessage,
          duration: Date.now() - tenantStartTime,
        });
        console.error(`[Cron] ✗ Tenant ${tenant.name}: ${errorMessage}`);
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const totalExecutions = results.reduce((sum, r) => sum + (r.executions || 0), 0);
    const totalIFlows = results.reduce((sum, r) => sum + (r.iflows || 0), 0);


    return NextResponse.json({
      success: true,
      message: `Synced ${successCount}/${results.length} tenants`,
      summary: {
        tenantsProcessed: results.length,
        tenantsSuccessful: successCount,
        tenantsFailed: results.length - successCount,
        totalIFlows,
        totalExecutions,
        duration: totalDuration,
      },
      results,
    });
  } catch (error) {
    console.error("[Cron] Sync job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Cron job failed"
      },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}
