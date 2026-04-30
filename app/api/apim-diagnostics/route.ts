/**
 * APIM Diagnostics API Route
 *
 * Probes all known SAP APIM endpoint patterns to discover which ones
 * are available on the current CF Integration Suite tenant.
 *
 * Usage: GET /api/apim-diagnostics
 * Optional: GET /api/apim-diagnostics?tenantId=<id>
 *
 * This is a development/debugging tool. The results tell you which
 * analytics endpoint path to use for the APIM client.
 */

import { NextRequest, NextResponse } from "next/server";
import { probeAPIMEndpoints } from "@/app/actions/apim-diagnostics";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  // Require authentication before processing
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = request.nextUrl.searchParams.get("tenantId") || undefined;

  const result = await probeAPIMEndpoints(tenantId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data, { status: 200 });
}
