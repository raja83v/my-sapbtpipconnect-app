import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { syncTenantInternal } from "@/app/actions/tenant";

/**
 * API route for cron job to sync a specific tenant
 * Security: Protected by CRON_SECRET environment variable using timing-safe
 * comparison to prevent timing attacks.
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        if (process.env.NODE_ENV === "production" || cronSecret) {
            const provided = authHeader?.startsWith("Bearer ")
                ? authHeader.slice(7)
                : "";
            const expected = cronSecret || "";

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
                console.error("[Cron] Unauthorized sync-tenant request");
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const body = await request.json();
        const { tenantId } = body;

        if (!tenantId) {
            return NextResponse.json(
                { error: "tenantId is required" },
                { status: 400 }
            );
        }

        // Call the existing sync function
        const result = await syncTenantInternal(tenantId);

        if (result.success) {
            return NextResponse.json({
                success: true,
                data: result.data,
            });
        } else {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("Error in sync-tenant API:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}