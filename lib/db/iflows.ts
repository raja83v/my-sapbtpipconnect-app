import { db } from "@/lib/db";
import { eq, and, count, ilike, or, sql, desc } from "drizzle-orm";
import {
  iFlows,
  iFlowExecutions,
  type IFlowStatus,
  type ExecutionStatus,
} from "@/lib/db/schema";

// ============================================================================
// iFlow CRUD
// ============================================================================

export async function getIFlowById(id: string) {
  return db.query.iFlows.findFirst({ where: eq(iFlows.id, id) }) ?? null;
}

export async function getIFlowByTenantAndIFlowId(
  tenantId: string,
  iFlowId: string
) {
  return db.query.iFlows.findFirst({
    where: and(eq(iFlows.tenantId, tenantId), eq(iFlows.iFlowId, iFlowId)),
  }) ?? null;
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
  const offset = (page - 1) * pageSize;

  const conditions = [eq(iFlows.tenantId, tenantId)];
  if (options?.status) conditions.push(eq(iFlows.status, options.status));
  if (options?.search) {
    conditions.push(
      or(
        ilike(iFlows.name, `%${options.search}%`),
        ilike(iFlows.iFlowId, `%${options.search}%`),
        ilike(iFlows.packageName, `%${options.search}%`)
      )!
    );
  }

  const where = and(...conditions);

  const [iflowList, [{ total }]] = await Promise.all([
    db
      .select()
      .from(iFlows)
      .where(where)
      .orderBy(desc(iFlows.updatedAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(iFlows).where(where),
  ]);

  return { iflows: iflowList, total, page, pageSize };
}

export async function updateIFlow(
  id: string,
  data: Partial<typeof iFlows.$inferInsert>
) {
  const [iflow] = await db
    .update(iFlows)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(iFlows.id, id))
    .returning();
  return iflow;
}

/**
 * Batch upsert iFlows for a tenant (used during sync).
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
  }>,
  maxIFlows?: number
) {
  let toProcess = iflows;

  if (maxIFlows !== undefined && maxIFlows > 0) {
    const existing = await db
      .select({ iFlowId: iFlows.iFlowId })
      .from(iFlows)
      .where(eq(iFlows.tenantId, tenantId));
    const existingIds = new Set(existing.map((r) => r.iFlowId));
    const currentCount = existingIds.size;
    const remaining = Math.max(0, maxIFlows - currentCount);
    let newBudget = remaining;

    toProcess = iflows.filter((iflow) => {
      if (existingIds.has(iflow.iFlowId)) return true;
      if (newBudget > 0) {
        newBudget--;
        return true;
      }
      return false;
    });
  }

  if (toProcess.length === 0) return [];

  const values = toProcess.map((iflow) => ({
    tenantId,
    iFlowId: iflow.iFlowId,
    name: iflow.name,
    packageName: iflow.packageName,
    version: iflow.version,
    status: iflow.status,
    lastDeployedAt: iflow.lastDeployedAt,
    updatedAt: new Date(),
  }));

  return db
    .insert(iFlows)
    .values(values)
    .onConflictDoUpdate({
      target: [iFlows.tenantId, iFlows.iFlowId],
      set: {
        name: sql`excluded."name"`,
        packageName: sql`excluded."packageName"`,
        version: sql`excluded."version"`,
        status: sql`excluded."status"`,
        lastDeployedAt: sql`excluded."lastDeployedAt"`,
        updatedAt: sql`excluded."updatedAt"`,
      },
    })
    .returning();
}

export async function getIFlowCount(tenantId: string) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(iFlows)
    .where(eq(iFlows.tenantId, tenantId));
  return total;
}

export async function getIFlowCountByStatus(tenantId: string) {
  const results = await db
    .select({
      status: iFlows.status,
      count: count(),
    })
    .from(iFlows)
    .where(eq(iFlows.tenantId, tenantId))
    .groupBy(iFlows.status);

  return results.reduce(
    (acc, r) => {
      acc[r.status] = r.count;
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
  const offset = (page - 1) * pageSize;

  const conditions = [eq(iFlowExecutions.iFlowId, iFlowId)];
  if (options?.status) conditions.push(eq(iFlowExecutions.status, options.status));
  const where = and(...conditions);

  const [executions, [{ total }]] = await Promise.all([
    db
      .select()
      .from(iFlowExecutions)
      .where(where)
      .orderBy(desc(iFlowExecutions.startTime))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(iFlowExecutions).where(where),
  ]);

  return { executions, total, page, pageSize };
}

export async function getExecutionByMessageId(messageId: string) {
  return db.query.iFlowExecutions.findFirst({
    where: eq(iFlowExecutions.messageId, messageId),
  }) ?? null;
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
    errorCategory?: "SYSTEM" | "NETWORK" | "MAPPING" | "SECURITY" | "TIMEOUT" | "BUSINESS_LOGIC" | "UNKNOWN";
    sender?: string;
    receiver?: string;
    interfaceType?: string;
    iFlowId: string;
  }>
) {
  if (executions.length === 0) return { count: 0 };

  const result = await db
    .insert(iFlowExecutions)
    .values(executions)
    .onConflictDoNothing({ target: iFlowExecutions.messageId })
    .returning();

  return { count: result.length };
}

export async function getExecutionStats(
  iFlowId: string,
  options?: { since?: Date }
) {
  const conditions = [eq(iFlowExecutions.iFlowId, iFlowId)];
  if (options?.since) {
    conditions.push(sql`${iFlowExecutions.startTime} >= ${options.since}`);
  }
  const where = and(...conditions);

  const [total, completed, failed] = await Promise.all([
    db.select({ c: count() }).from(iFlowExecutions).where(where).then((r) => r[0].c),
    db
      .select({ c: count() })
      .from(iFlowExecutions)
      .where(and(where, eq(iFlowExecutions.status, "COMPLETED")))
      .then((r) => r[0].c),
    db
      .select({ c: count() })
      .from(iFlowExecutions)
      .where(and(where, eq(iFlowExecutions.status, "FAILED")))
      .then((r) => r[0].c),
  ]);

  return {
    total,
    completed,
    failed,
    successRate: total > 0 ? completed / total : 0,
  };
}
