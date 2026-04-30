/**
 * POST /api/pipelines/[id]/retry — retry a failed pipeline from the
 * architect phase. Thin wrapper around `retryIFlowPipeline`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { retryIFlowPipeline } from "@/app/actions/iflow-orchestrator";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await retryIFlowPipeline(id);
  if (!result.success) {
    const status = result.error === "Not authenticated" ? 401 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
