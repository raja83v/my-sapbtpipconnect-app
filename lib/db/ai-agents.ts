import { db } from "@/lib/db";
import { eq, and, count, sum, sql, desc } from "drizzle-orm";
import {
  aiAgentExecutions,
  type AIAgentType,
  type AIAgentStatus,
} from "@/lib/db/schema";

export async function createExecution(data: {
  agentType: AIAgentType;
  input: string;
  userId: string;
  tenantId?: string;
  iFlowId?: string;
}) {
  const [execution] = await db
    .insert(aiAgentExecutions)
    .values({
      agentType: data.agentType,
      status: "RUNNING",
      input: data.input,
      output: "",
      tokensUsed: 0,
      success: false,
      userId: data.userId,
      tenantId: data.tenantId,
      iFlowId: data.iFlowId,
      updatedAt: new Date(),
    })
    .returning();
  return execution;
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
  const [execution] = await db
    .update(aiAgentExecutions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(aiAgentExecutions.id, id))
    .returning();
  return execution;
}

export async function getExecutionById(id: string) {
  return db.query.aiAgentExecutions.findFirst({
    where: eq(aiAgentExecutions.id, id),
  }) ?? null;
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
  const offset = (page - 1) * pageSize;

  const conditions = [eq(aiAgentExecutions.userId, userId)];
  if (options?.agentType) conditions.push(eq(aiAgentExecutions.agentType, options.agentType));
  if (options?.status) conditions.push(eq(aiAgentExecutions.status, options.status));
  const where = and(...conditions);

  const [executions, [{ total }]] = await Promise.all([
    db
      .select()
      .from(aiAgentExecutions)
      .where(where)
      .orderBy(desc(aiAgentExecutions.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(aiAgentExecutions).where(where),
  ]);

  return { executions, total, page, pageSize };
}

export async function getExecutionsByType(
  agentType: AIAgentType,
  options?: { page?: number; pageSize?: number }
) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const [executions, [{ total }]] = await Promise.all([
    db
      .select()
      .from(aiAgentExecutions)
      .where(eq(aiAgentExecutions.agentType, agentType))
      .orderBy(desc(aiAgentExecutions.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(aiAgentExecutions)
      .where(eq(aiAgentExecutions.agentType, agentType)),
  ]);

  return { executions, total };
}

export async function getAgentStats(userId?: string) {
  const baseWhere = userId ? eq(aiAgentExecutions.userId, userId) : undefined;

  const [totalExecutions, successCount, failCount, byType] = await Promise.all([
    db
      .select({ c: count() })
      .from(aiAgentExecutions)
      .where(baseWhere)
      .then((r) => r[0].c),
    db
      .select({ c: count() })
      .from(aiAgentExecutions)
      .where(baseWhere ? and(baseWhere, eq(aiAgentExecutions.success, true)) : eq(aiAgentExecutions.success, true))
      .then((r) => r[0].c),
    db
      .select({ c: count() })
      .from(aiAgentExecutions)
      .where(
        baseWhere
          ? and(baseWhere, eq(aiAgentExecutions.status, "FAILED"))
          : eq(aiAgentExecutions.status, "FAILED")
      )
      .then((r) => r[0].c),
    db
      .select({
        agentType: aiAgentExecutions.agentType,
        count: count(),
        totalTokens: sum(aiAgentExecutions.tokensUsed),
      })
      .from(aiAgentExecutions)
      .where(baseWhere)
      .groupBy(aiAgentExecutions.agentType),
  ]);

  return {
    totalExecutions,
    successCount,
    failCount,
    successRate: totalExecutions > 0 ? successCount / totalExecutions : 0,
    byType: byType.map((t) => ({
      type: t.agentType,
      count: t.count,
      totalTokens: Number(t.totalTokens ?? 0),
    })),
  };
}
