import { prisma } from "@/lib/db";
import type { Prisma, ExecutionStatus, IFlowStatus } from "@prisma/client";

// ============================================================================
// iFlow CRUD
// ============================================================================

export async function getIFlowById(id: string) {
  return prisma.iFlow.findUnique({ where: { id } });
}

export async function getIFlowByTenantAndIFlowId(
  tenantId: string,
  iFlowId: string
) {
  return prisma.iFlow.findUnique({
    where: { tenantId_iFlowId: { tenantId, iFlowId } },
  });
}

export async function listByTenant(
  tenantId: string,
  options?: {
    page?: number;
    pageSize?: number;
    status?: IFlowStatus;
    search?: string;
  }
) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const skip = (page - 1) * pageSize;

  const where: Prisma.IFlowWhereInput = { tenantId };

  if (options?.status) where.status = options.status;
  if (options?.search) {
    where.OR = [
      { name: { contains: options.search, mode: "insensitive" } },
      { iFlowId: { contains: options.search, mode: "insensitive" } },
      { packageName: { contains: options.search, mode: "insensitive" } },
    ];
  }

  const [iflows, total] = await Promise.all([
    prisma.iFlow.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.iFlow.count({ where }),
  ]);

  return { iflows, total, page, pageSize };
}

export async function updateIFlow(id: string, data: Prisma.IFlowUpdateInput) {
  return prisma.iFlow.update({ where: { id }, data });
}

/**
 * Batch upsert iFlows for a tenant (used during sync)
 */
export async function batchUpsert(
  tenantId: string,
  iflows: Array<{
    iFlowId: string;
    name: string;
    packageName?: string;
    version?: string;
    status: IFlowStatus;
    lastDeployedAt?: Date;
  }>
) {
  const operations = iflows.map((iflow) =>
    prisma.iFlow.upsert({
      where: { tenantId_iFlowId: { tenantId, iFlowId: iflow.iFlowId } },
      update: {
        name: iflow.name,
        packageName: iflow.packageName,
        version: iflow.version,
        status: iflow.status,
        lastDeployedAt: iflow.lastDeployedAt,
      },
      create: {
        tenantId,
        iFlowId: iflow.iFlowId,
        name: iflow.name,
        packageName: iflow.packageName,
        version: iflow.version,
        status: iflow.status,
        lastDeployedAt: iflow.lastDeployedAt,
      },
    })
  );

  return prisma.$transaction(operations);
}

export async function getIFlowCount(tenantId: string) {
  return prisma.iFlow.count({ where: { tenantId } });
}

export async function getIFlowCountByStatus(tenantId: string) {
  const results = await prisma.iFlow.groupBy({
    by: ["status"],
    where: { tenantId },
    _count: { status: true },
  });

  return results.reduce(
    (acc, r) => {
      acc[r.status] = r._count.status;
      return acc;
    },
    {} as Record<string, number>
  );
}

// ============================================================================
// iFlow Executions
// ============================================================================

export async function getExecutions(
  iFlowId: string,
  options?: {
    page?: number;
    pageSize?: number;
    status?: ExecutionStatus;
  }
) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const skip = (page - 1) * pageSize;

  const where: Prisma.IFlowExecutionWhereInput = { iFlowId };
  if (options?.status) where.status = options.status;

  const [executions, total] = await Promise.all([
    prisma.iFlowExecution.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { startTime: "desc" },
    }),
    prisma.iFlowExecution.count({ where }),
  ]);

  return { executions, total, page, pageSize };
}

export async function getExecutionByMessageId(
  messageId: string
) {
  return prisma.iFlowExecution.findUnique({ where: { messageId } });
}

/**
 * Batch create executions (used during sync)
 */
export async function batchCreateExecutions(
  executions: Array<{
    messageId: string;
    status: ExecutionStatus;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    errorMessage?: string;
    errorCategory?: string;
    sender?: string;
    receiver?: string;
    interfaceType?: string;
    iFlowId: string;
  }>
) {
  // Use skipDuplicates to handle existing messageIds
  return prisma.iFlowExecution.createMany({
    data: executions.map((e) => ({
      ...e,
      errorCategory: e.errorCategory as Prisma.IFlowExecutionCreateManyInput["errorCategory"],
    })),
    skipDuplicates: true,
  });
}

export async function getExecutionStats(
  iFlowId: string,
  options?: { since?: Date }
) {
  const where: Prisma.IFlowExecutionWhereInput = { iFlowId };
  if (options?.since) where.startTime = { gte: options.since };

  const [total, completed, failed] = await Promise.all([
    prisma.iFlowExecution.count({ where }),
    prisma.iFlowExecution.count({ where: { ...where, status: "COMPLETED" } }),
    prisma.iFlowExecution.count({ where: { ...where, status: "FAILED" } }),
  ]);

  return { total, completed, failed, successRate: total > 0 ? completed / total : 0 };
}
