import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { cpiTenants } from "@/lib/db/schema";
import { syncTenantInternal } from "@/app/actions/tenant";

/**
 * Cron Job endpoint to sync all tenants
 * Runs periodically via node-cron scheduler or manual trigger
 *
 * Security: Protected by CRON_SECRET environment variable using timing-safe
 * comparison to prevent timing attacks.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === "production" || cronSecret) {
      const provided = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : "";
      const expected = cronSecret || "";

      // Use timing-safe comparison to prevent timing attacks
      const maxLen = Math.max(
        Buffer.byteLength(provided),
        Buffer.byteLength(expected),
      );
      const a = Buffer.alloc(maxLen);
      const b = Buffer.alloc(maxLen);
      Buffer.from(provided).copy(a);
      Buffer.from(expected).copy(b);

      const isAuthorized = !!cronSecret && timingSafeEqual(a, b);
      if (!isAuthorized) {
        console.error("[Cron] Unauthorized request");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Get all tenants
    const tenants = await db.select().from(cpiTenants).limit(100);

    if (!tenants || tenants.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No tenants to sync",
        synced: 0,
        errors: 0,
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const results: Array<{
      tenant: string;
      success: boolean;
      error?: string;
      data?: unknown;
    }> = [];

    // Sync each connected tenant
    for (const tenant of tenants) {
      if (!tenant.isConnected) continue;

      try {
        const result = await syncTenantInternal(tenant.id);

        if (result.success && result.data) {
          successCount++;
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
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`[Cron] ✗ Error syncing ${tenant.name}:`, errorMessage);
        results.push({
          tenant: tenant.name,
          success: false,
          error: errorMessage,
        });
      }
    }

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
      { status: 500 },
    );
  }
}

// Also support POST for manual testing
export async function POST(request: NextRequest) {
  return GET(request);
}
