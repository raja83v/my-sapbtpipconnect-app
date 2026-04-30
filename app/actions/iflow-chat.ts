/**
 * iFlow Studio chat actions.
 *
 * These power the left-side chat panel. Two phases of conversation are
 * handled:
 *
 *   • CLARIFYING — user is answering open clarifier questions (kind =
 *     CLARIFIER_ANSWER). The Clarifier agent re-runs with the merged chat
 *     history; if no open questions remain, the pipeline transitions to
 *     PLANNING.
 *
 *   • AWAITING_APPROVAL / DRAFTED / COMPLETED — user is requesting a change
 *     (kind = MODIFY_REQUEST). For now we persist the request and surface a
 *     placeholder assistant reply; the PatchAgent will be wired up in the
 *     next task.
 *
 * All actions verify ownership and return ActionResult.
 */

"use server";

import { and, asc, eq } from "drizzle-orm";
import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import {
  iFlowPipelines,
  iFlowPipelineMessages,
  type IFlowPipelineMessage,
} from "@/lib/db/schema";
import type { ActionResult } from "@/types/actions";
import type {
  ChatMessageKind,
  ChatMessageRole,
  PipelineContext,
  RequirementsBrief,
  TenantCapabilities,
} from "@/lib/ai/orchestrator/pipeline-state";
import { ClarifierAgent } from "@/lib/ai/orchestrator/agents/clarifier-agent";
import { PatchAgent } from "@/lib/ai/orchestrator/agents/patch-agent";
import { PipelineOrchestrator } from "@/lib/ai/orchestrator/pipeline-orchestrator";
import { getDefaultCapabilities } from "@/lib/sap-cpi/tenant-capabilities";
import { continueIFlowPipelineAfterClarify } from "./iflow-orchestrator";
import type { IFlowDesign } from "@/components/ai/v2/specialized/iflow-creator/types";

// ---------------------------------------------------------------------------
// Types

export interface StudioChatMessageRow {
  id: string;
  role: ChatMessageRole;
  kind: ChatMessageKind;
  content: string;
  metadata?: unknown;
  createdAt: string;
}

export interface ListMessagesResult {
  messages: StudioChatMessageRow[];
}

export interface SendMessageInput {
  content: string;
  kind?: ChatMessageKind;
}

// ---------------------------------------------------------------------------
// List

export async function listPipelineMessages(
  pipelineId: string,
): Promise<ActionResult<ListMessagesResult>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const owned = await db.query.iFlowPipelines.findFirst({
    where: and(eq(iFlowPipelines.id, pipelineId), eq(iFlowPipelines.userId, user.id)),
    columns: { id: true },
  });
  if (!owned) return { success: false, error: "Pipeline not found" };

  const rows = await db
    .select()
    .from(iFlowPipelineMessages)
    .where(eq(iFlowPipelineMessages.pipelineId, pipelineId))
    .orderBy(asc(iFlowPipelineMessages.createdAt));

  return {
    success: true,
    data: { messages: rows.map(rowToWire) },
  };
}

// ---------------------------------------------------------------------------
// Send

export async function sendChatMessage(
  pipelineId: string,
  input: SendMessageInput,
): Promise<ActionResult<{ message: StudioChatMessageRow }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const content = input.content?.trim();
  if (!content) return { success: false, error: "Message is empty" };
  if (content.length > 8000)
    return { success: false, error: "Message is too long (max 8000 chars)" };

  const pipeline = await db.query.iFlowPipelines.findFirst({
    where: and(eq(iFlowPipelines.id, pipelineId), eq(iFlowPipelines.userId, user.id)),
  });
  if (!pipeline) return { success: false, error: "Pipeline not found" };

  const inferredKind = input.kind ?? inferKindFromPhase(pipeline.phase);

  // Persist the user message
  const [inserted] = await db
    .insert(iFlowPipelineMessages)
    .values({
      pipelineId,
      role: "user",
      kind: inferredKind,
      content,
    })
    .returning();

  // Fire-and-forget downstream handling so the UI gets an immediate ack.
  void handleIncomingMessage(pipelineId, inferredKind, content).catch((err) => {
    console.error(`[iflow-chat:${pipelineId}] handler failed:`, err);
  });

  return {
    success: true,
    data: { message: rowToWire(inserted) },
  };
}

// ---------------------------------------------------------------------------
// Internals

function inferKindFromPhase(phase: string): ChatMessageKind {
  switch (phase) {
    case "CLARIFYING":
    case "INIT":
      return "CLARIFIER_ANSWER";
    case "AWAITING_APPROVAL":
    case "DRAFTED":
    case "COMPLETED":
    case "FAILED":
      return "MODIFY_REQUEST";
    default:
      return "TEXT";
  }
}

function rowToWire(r: IFlowPipelineMessage): StudioChatMessageRow {
  return {
    id: r.id,
    role: r.role as ChatMessageRole,
    kind: r.kind as ChatMessageKind,
    content: r.content,
    metadata: r.metadata ?? undefined,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  };
}

/**
 * Routes a message to the right downstream agent based on phase + kind.
 * This runs asynchronously after the user message is persisted.
 */
async function handleIncomingMessage(
  pipelineId: string,
  kind: ChatMessageKind,
  content: string,
): Promise<void> {
  if (kind === "CLARIFIER_ANSWER") {
    await runClarifierFollowup(pipelineId, content);
    return;
  }
  if (kind === "MODIFY_REQUEST") {
    await runPatchOnRequest(pipelineId, content);
    return;
  }
  // Plain TEXT — no-op downstream action.
}

async function runClarifierFollowup(pipelineId: string, _latestAnswer: string): Promise<void> {
  // Reload the pipeline + chat history fresh so we see the just-inserted answer.
  const pipeline = await db.query.iFlowPipelines.findFirst({
    where: eq(iFlowPipelines.id, pipelineId),
  });
  if (!pipeline) return;

  // Only re-run during CLARIFYING / INIT.
  if (pipeline.phase !== "CLARIFYING" && pipeline.phase !== "INIT") return;

  const history = await db
    .select()
    .from(iFlowPipelineMessages)
    .where(eq(iFlowPipelineMessages.pipelineId, pipelineId))
    .orderBy(asc(iFlowPipelineMessages.createdAt));

  const previousBrief = (pipeline.requirementsBrief as RequirementsBrief | null) ?? undefined;
  const description = safeParseJson<{ description?: string }>(pipeline.description)?.description
    ?? pipeline.description
    ?? "";

  // Build the agent context. Capabilities aren't used by the clarifier itself,
  // so defaults are sufficient and avoid an extra round-trip to the tenant.
  const capabilities: TenantCapabilities = getDefaultCapabilities();
  const context: PipelineContext = {
    pipelineId,
    tenantId: pipeline.tenantId,
    userId: pipeline.userId,
    tenantCapabilities: capabilities,
    packageSelection: safeParseJson(pipeline.packageSelection) ?? ({} as PipelineContext["packageSelection"]),
    description: safeParseJson(pipeline.description) ?? ({} as PipelineContext["description"]),
  };

  const orchestrator = new PipelineOrchestrator(pipelineId, pipeline.phase);
  if (pipeline.phase === "INIT") {
    await orchestrator.transition("CLARIFYING").catch(() => {
      /* may already have transitioned */
    });
  }

  // Map persisted history → clarifier-shape (user/assistant only).
  const chatHistory: { role: "user" | "assistant"; content: string }[] = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const clarifier = new ClarifierAgent();
  let updatedBrief: RequirementsBrief | null = null;
  try {
    const res = await clarifier.execute(
      {
        description,
        previousBrief,
        chatHistory,
      },
      context,
    );
    if (res.success && res.output) updatedBrief = res.output;
  } catch (err) {
    console.error(`[iflow-chat:${pipelineId}] clarifier failed:`, err);
    await postAssistantMessage(
      pipelineId,
      "Sorry — I couldn't refine the requirements just now. Please try rephrasing.",
      "TEXT",
    );
    return;
  }

  if (!updatedBrief) return;

  // Persist the brief
  await db
    .update(iFlowPipelines)
    .set({ requirementsBrief: updatedBrief })
    .where(eq(iFlowPipelines.id, pipelineId));

  const open = updatedBrief.openQuestions ?? [];
  if (open.length > 0) {
    // Surface the next question as a CLARIFIER_QUESTION assistant message.
    const next = open[0];
    await db.insert(iFlowPipelineMessages).values({
      pipelineId,
      role: "assistant",
      kind: "CLARIFIER_QUESTION",
      content: next.question,
      metadata: { id: next.id, options: next.options ?? null, required: !!next.required },
    });
    return;
  }

  // No open questions left → ack and hand off to the architect path.
  await postAssistantMessage(
    pipelineId,
    "Thanks — I have everything I need. Building the design now…",
    "TEXT",
  );
  await continueIFlowPipelineAfterClarify(pipelineId).catch((err) => {
    console.warn(`[iflow-chat:${pipelineId}] could not continue pipeline:`, err);
  });
}

async function postAssistantMessage(
  pipelineId: string,
  content: string,
  kind: ChatMessageKind,
): Promise<void> {
  await db.insert(iFlowPipelineMessages).values({
    pipelineId,
    role: "assistant",
    kind,
    content,
  });
}

function safeParseJson<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

async function runPatchOnRequest(
  pipelineId: string,
  instruction: string,
): Promise<void> {
  const pipeline = await db.query.iFlowPipelines.findFirst({
    where: eq(iFlowPipelines.id, pipelineId),
  });
  if (!pipeline) return;

  // Patch loop is only meaningful once a design exists. Bail with a polite
  // ack if the user is sending modify requests too early.
  const allowed = ["AWAITING_APPROVAL", "DRAFTED", "COMPLETED", "FAILED"];
  if (!allowed.includes(pipeline.phase)) {
    await postAssistantMessage(
      pipelineId,
      "I'll apply changes once the initial design is ready.",
      "TEXT",
    );
    return;
  }

  // Source of truth for the current design: finalDesign (post-reviewer/fix)
  // falls back to architectResult.design.
  const currentDesign = resolveCurrentDesign(pipeline);
  if (!currentDesign) {
    await postAssistantMessage(
      pipelineId,
      "I couldn't locate the current design to modify. Please retry the build first.",
      "TEXT",
    );
    return;
  }

  const capabilities: TenantCapabilities =
    safeParseJson<TenantCapabilities>(pipeline.tenantCapabilities) ??
    getDefaultCapabilities();

  const recentMessages = await db
    .select()
    .from(iFlowPipelineMessages)
    .where(eq(iFlowPipelineMessages.pipelineId, pipelineId))
    .orderBy(asc(iFlowPipelineMessages.createdAt));

  const recentChat = recentMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-8)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const context: PipelineContext = {
    pipelineId,
    tenantId: pipeline.tenantId,
    userId: pipeline.userId,
    tenantCapabilities: capabilities,
    packageSelection:
      safeParseJson(pipeline.packageSelection) ??
      ({} as PipelineContext["packageSelection"]),
    description:
      safeParseJson(pipeline.description) ??
      ({} as PipelineContext["description"]),
  };

  const agent = new PatchAgent();
  const res = await agent.execute(
    {
      design: currentDesign,
      instruction,
      tenantCapabilities: capabilities,
      recentChat,
    },
    context,
  );

  if (!res.success || !res.output) {
    await postAssistantMessage(
      pipelineId,
      `I couldn't apply that change: ${res.error ?? "unknown error"}.`,
      "TEXT",
    );
    return;
  }

  const { patch, updatedDesign } = res.output;

  if (patch.diffs.length === 0) {
    await db.insert(iFlowPipelineMessages).values({
      pipelineId,
      role: "assistant",
      kind: "PATCH_RESULT",
      content:
        patch.rationale ||
        "I didn't apply any changes — the request was ambiguous or unsafe. Could you clarify?",
      metadata: { patchId: patch.id, diffCount: 0 },
    });
    return;
  }

  // Persist the new design + remember the previous one for undo/diff display.
  await db
    .update(iFlowPipelines)
    .set({
      previousDesign: currentDesign,
      finalDesign: JSON.stringify(updatedDesign),
    })
    .where(eq(iFlowPipelines.id, pipelineId));

  await db.insert(iFlowPipelineMessages).values({
    pipelineId,
    role: "assistant",
    kind: "PATCH_RESULT",
    content: formatPatchSummary(patch),
    metadata: {
      patchId: patch.id,
      diffCount: patch.diffs.length,
      diffs: patch.diffs,
    },
  });
}

function resolveCurrentDesign(pipeline: {
  finalDesign: string | null;
  architectResult: string | null;
}): IFlowDesign | null {
  const fromFinal = safeParseJson<IFlowDesign>(pipeline.finalDesign);
  if (fromFinal) return fromFinal;
  const arch = safeParseJson<{ design?: IFlowDesign }>(pipeline.architectResult);
  return arch?.design ?? null;
}

function formatPatchSummary(patch: {
  diffs: { path: string; reason: string }[];
  rationale: string;
}): string {
  const lines: string[] = [];
  if (patch.rationale) lines.push(patch.rationale);
  lines.push("");
  lines.push(
    `Applied ${patch.diffs.length} change${patch.diffs.length === 1 ? "" : "s"}:`,
  );
  for (const d of patch.diffs.slice(0, 8)) {
    lines.push(`• \`${d.path}\` — ${d.reason}`);
  }
  if (patch.diffs.length > 8) {
    lines.push(`• …and ${patch.diffs.length - 8} more.`);
  }
  return lines.join("\n");
}
