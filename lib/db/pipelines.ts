import { prisma } from "@/lib/db";
import type {
  Prisma,
  PipelinePhase,
  PipelineAgentLogStatus,
} from "@prisma/client";

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
  return prisma.iFlowPipeline.create({
    data: {
      userId: data.userId,
      tenantId: data.tenantId,
      phase: "INIT",
      packageSelection: data.packageSelection,
      description: data.description,
      tenantCapabilities: data.tenantCapabilities,
      totalTokensUsed: 0,
    },
  });
}

export async function updatePipeline(
  id: string,
  data: Prisma.IFlowPipelineUpdateInput
) {
  return prisma.iFlowPipeline.update({ where: { id }, data });
}

export async function getPipelineById(id: string) {
  return prisma.iFlowPipeline.findUnique({
    where: { id },
    include: {
      agentLogs: {
        orderBy: { startedAt: "asc" },
      },
    },
  });
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
  const skip = (page - 1) * pageSize;

  const where: Prisma.IFlowPipelineWhereInput = { userId };
  if (options?.phase) where.phase = options.phase;
  if (options?.tenantId) where.tenantId = options.tenantId;

  const [pipelines, total] = await Promise.all([
    prisma.iFlowPipeline.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { startedAt: "desc" },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.iFlowPipeline.count({ where }),
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
  return prisma.iFlowPipelineAgentLog.create({
    data: {
      pipelineId: data.pipelineId,
      agentName: data.agentName,
      status: "RUNNING",
      tokensUsed: data.tokensUsed ?? 0,
      duration: data.duration ?? 0,
      input: data.input,
    },
  });
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
  return prisma.iFlowPipelineAgentLog.update({ where: { id }, data });
}

export async function getAgentLogs(pipelineId: string) {
  return prisma.iFlowPipelineAgentLog.findMany({
    where: { pipelineId },
    orderBy: { startedAt: "asc" },
  });
}
