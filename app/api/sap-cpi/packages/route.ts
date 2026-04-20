import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/actions/user";
import { getTenantById } from "@/app/actions/tenant";
import { SAPCPIClient } from "@/lib/sap-cpi/client";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const tenantId = searchParams.get("tenantId");

        if (!tenantId) {
            return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
        }

        // Get tenant details
        const tenantResult = await getTenantById(tenantId);
        if (!tenantResult.success || !tenantResult.data) {
            return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
        }

        const tenant = tenantResult.data;

        // Initialize SAP CPI client
        const sapCpiClient = new SAPCPIClient({
            tenantUrl: tenant.tmUrl,
            authType: "BASIC_AUTH" as const,
            username: tenant.username || undefined,
            password: tenant.password || undefined,
        });

        // Fetch integration packages
        const packages = await sapCpiClient.getIntegrationPackages();

        return NextResponse.json({
            success: true,
            packages,
        });
    } catch (error) {
        console.error("Error fetching SAP CPI packages:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch packages",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}