/**
 * GET  /api/pipelines/[id]/messages — list chat thread for the studio.
 * POST /api/pipelines/[id]/messages — append a new user message.
 *
 * Both endpoints delegate to server actions in `app/actions/iflow-chat.ts`
 * so behavior stays consistent whether the caller is a server action or
 * the browser via fetch.
 */

import { NextResponse, type NextRequest } from "next/server";
import { listPipelineMessages, sendChatMessage } from "@/app/actions/iflow-chat";
import type { ChatMessageKind } from "@/lib/ai/orchestrator/pipeline-state";

const ALLOWED_KINDS: ChatMessageKind[] = [
  "TEXT",
  "CLARIFIER_ANSWER",
  "MODIFY_REQUEST",
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await listPipelineMessages(id);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "Not authenticated" ? 401 : 404 },
    );
  }
  return NextResponse.json(result.data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { content?: unknown; kind?: unknown };
  try {
    body = (await req.json()) as { content?: unknown; kind?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.content !== "string" || body.content.trim().length === 0) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  let kind: ChatMessageKind | undefined;
  if (body.kind !== undefined) {
    if (typeof body.kind !== "string" || !ALLOWED_KINDS.includes(body.kind as ChatMessageKind)) {
      return NextResponse.json({ error: "invalid kind" }, { status: 400 });
    }
    kind = body.kind as ChatMessageKind;
  }

  const result = await sendChatMessage(id, { content: body.content, kind });
  if (!result.success) {
    const status =
      result.error === "Not authenticated"
        ? 401
        : result.error === "Pipeline not found"
          ? 404
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result.data, { status: 201 });
}
