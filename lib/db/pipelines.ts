import { db } from "@/lib/db";
import { eq, and, count, desc, asc } from "drizzle-orm";
import {
  iFlowPipelines,
  iFlowPipelineAgentLogs,
  type PipelinePhase,
  type PipelineAgentLogStatus,
} from "@/lib/db/schema";

// ============================================================================
// Pipeline CRUD
// ============================================================================

export async function createPipeline(data: {
  userId: string;
  tenantId: string;
  packageSelection: string;
  description: string;
  tenantCapabilities?: string;
}) {
  const [pipeline] = await db
    .insert(iFlowPipelines)
    .values({
      userId: data.userId,
      tenantId: data.tenantId,
      phase: "INIT",
      packageSelection: data.packageSelection,
      description: data.description,
      tenantCapabilities: data.tenantCapabilities,
      totalTokensUsed: 0,
    })
    .returning();
  return pipeline;
}

export async function updatePipeline(
  id: string,
  data: Partial<typeof iFlowPipelines.$inferInsert>
) {
  const [pipeline] = await db
    .update(iFlowPipelines)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(iFlowPipelines.id, id))
    .returning();
  return pipeline;
}

export async function getPipelineById(id: string) {
  return db.query.iFlowPipelines.findFirst({
    where: eq(iFlowPipelines.id, id),
    with: {
      agentLogs: {
        orderBy: asc(iFlowPipelineAgentLogs.startedAt),
      },
    },
  }) ?? null;
}

export async function listPipelinesForUser(
  userId: string,
  options?: {
    page?: number;
    pageSize?: number;
    phase?: PipelinePhase;
    tenantId?: string;
  }
) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(iFlowPipelines.userId, userId)];
  if (options?.phase) conditions.push(eq(iFlowPipelines.phase, options.phase));
  if (options?.tenantId) conditions.push(eq(iFlowPipelines.tenantId, options.tenantId));
  const where = and(...conditions);

  const [pipelines, [{ total }]] = await Promise.all([
    db.query.iFlowPipelines.findMany({
      where,
      with: {
        tenant: { columns: { id: true, name: true, slug: true } },
      },
      orderBy: desc(iFlowPipelines.startedAt),
      limit: pageSize,
      offset,
    }),
    db.select({ total: count() }).from(iFlowPipelines).where(where),
  ]);

  return { pipelines, total, page, pageSize };
}

// ============================================================================
// Pipeline Agent Logs
// ============================================================================

export async function createAgentLog(data: {
  pipelineId: string;
  agentName: string;
  input?: string;
  tokensUsed?: number;
  duration?: number;
}) {
  const [log] = await db
    .insert(iFlowPipelineAgentLogs)
    .values({
      pipelineId: data.pipelineId,
      agentName: data.agentName,
      status: "RUNNING",
      tokensUsed: data.tokensUsed ?? 0,
      duration: data.duration ?? 0,
      input: data.input,
    })
    .returning();
  return log;
}

export async function updateAgentLog(
  id: string,
  data: {
    status?: PipelineAgentLogStatus;
    output?: string;
    errorMessage?: string;
    tokensUsed?: number;
    duration?: number;
    completedAt?: Date;
    attemptNumber?: number;
  }
) {
  const [log] = await db
    .update(iFlowPipelineAgentLogs)
    .set(data)
    .where(eq(iFlowPipelineAgentLogs.id, id))
    .returning();
  return log;
}

export async function getAgentLogs(pipelineId: string) {
  return db
    .select()
    .from(iFlowPipelineAgentLogs)
    .where(eq(iFlowPipelineAgentLogs.pipelineId, pipelineId))
    .orderBy(asc(iFlowPipelineAgentLogs.startedAt));
}
