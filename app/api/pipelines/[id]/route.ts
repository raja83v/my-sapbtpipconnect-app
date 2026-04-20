import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { iFlowPipelines } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const pipeline = await db.query.iFlowPipelines.findFirst({
      where: eq(iFlowPipelines.id, id),
      with: {
        agentLogs: {
          orderBy: (agentLogs, { asc }) => [asc(agentLogs.startedAt)],
        },
      },
    });

    if (!pipeline) {
      return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
    }

    // Verify user owns this pipeline
    if (pipeline.userId !== currentUser.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(pipeline);
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
