import { prisma } from "@/lib/db";
import type { Prisma, AIAgentType, AIAgentStatus } from "@prisma/client";

export async function createExecution(data: {
  agentType: AIAgentType;
  input: string;
  userId: string;
  tenantId?: string;
  iFlowId?: string;
}) {
  return prisma.aIAgentExecution.create({
    data: {
      agentType: data.agentType,
      status: "RUNNING",
      input: data.input,
      output: "",
      tokensUsed: 0,
      success: false,
      userId: data.userId,
      tenantId: data.tenantId,
      iFlowId: data.iFlowId,
    },
  });
}

export async function updateExecution(
  id: string,
  data: {
    status?: AIAgentStatus;
    output?: string;
    errorMessage?: string;
    tokensUsed?: number;
    duration?: number;
    success?: boolean;
  }
) {
  return prisma.aIAgentExecution.update({ where: { id }, data });
}

export async function getExecutionById(id: string) {
  return prisma.aIAgentExecution.findUnique({ where: { id } });
}

export async function getExecutionsByUser(
  userId: string,
  options?: {
    page?: number;
    pageSize?: number;
    agentType?: AIAgentType;
    status?: AIAgentStatus;
  }
) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.AIAgentExecutionWhereInput = { userId };
  if (options?.agentType) where.agentType = options.agentType;
  if (options?.status) where.status = options.status;

  const [executions, total] = await Promise.all([
    prisma.aIAgentExecution.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.aIAgentExecution.count({ where }),
  ]);

  return { executions, total, page, pageSize };
}

export async function getExecutionsByType(
  agentType: AIAgentType,
  options?: { page?: number; pageSize?: number }
) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const [executions, total] = await Promise.all([
    prisma.aIAgentExecution.findMany({
      where: { agentType },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.aIAgentExecution.count({ where: { agentType } }),
  ]);

  return { executions, total };
}

export async function getAgentStats(userId?: string) {
  const where: Prisma.AIAgentExecutionWhereInput = userId ? { userId } : {};

  const [totalExecutions, successCount, failCount, byType] = await Promise.all([
    prisma.aIAgentExecution.count({ where }),
    prisma.aIAgentExecution.count({ where: { ...where, success: true } }),
    prisma.aIAgentExecution.count({ where: { ...where, status: "FAILED" } }),
    prisma.aIAgentExecution.groupBy({
      by: ["agentType"],
      where,
      _count: { agentType: true },
      _sum: { tokensUsed: true },
    }),
  ]);

  return {
    totalExecutions,
    successCount,
    failCount,
    successRate: totalExecutions > 0 ? successCount / totalExecutions : 0,
    byType: byType.map((t) => ({
      type: t.agentType,
      count: t._count.agentType,
      totalTokens: t._sum.tokensUsed ?? 0,
    })),
  };
}
