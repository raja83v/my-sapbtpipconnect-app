/**
 * POST /api/pipelines/[id]/save-draft — upload the iFlow as a draft to SAP
 * CPI without deploying it. Thin wrapper around `saveIFlowDraft`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { saveIFlowDraft } from "@/app/actions/iflow-orchestrator";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await saveIFlowDraft(id);
  if (!result.success) {
    const status = result.error === "Not authenticated" ? 401 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result.data);
}
