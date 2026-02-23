import { NextRequest, NextResponse } from "next/server";
import { syncTenantInternal } from "@/app/actions/tenant";

/**
 * API route for cron job to sync a specific tenant
 * This is called by the cron scheduler
 */
export async function POST(request: NextRequest) {
    try {
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