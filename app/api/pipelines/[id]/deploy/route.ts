/**
 * POST /api/pipelines/[id]/deploy — approve + deploy the pipeline.
 * Thin wrapper around `approveIFlowPipeline` so the studio deploy bar can
 * trigger deployment with a simple fetch.
 */

import { NextResponse, type NextRequest } from "next/server";
import { approveIFlowPipeline } from "@/app/actions/iflow-orchestrator";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await approveIFlowPipeline(id);
  if (!result.success) {
    const status = result.error === "Not authenticated" ? 401 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result.data);
}
