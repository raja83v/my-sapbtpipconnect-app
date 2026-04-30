/**
 * Persistence helpers for the Documentation Generator.
 */
import "server-only";
import { db } from "@/lib/db";
import { generatedDocuments } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type {
  GeneratedDocument,
  DocumentationType,
  DocumentSectionContent,
  MermaidDiagram,
} from "@/types/documentation-generator";

export interface PersistDocInput {
  userId: string;
  tenantId: string | null;
  iFlowId: string | null;
  iFlowName: string;
  documentationType: DocumentationType;
  title: string;
  version: string;
  sections: DocumentSectionContent[];
  diagrams: MermaidDiagram[];
  tokensUsed: number;
  durationMs: number;
}

export async function persistGeneratedDocument(
  input: PersistDocInput,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(generatedDocuments)
    .values({
      userId: input.userId,
      tenantId: input.tenantId,
      iFlowId: input.iFlowId,
      iFlowName: input.iFlowName,
      documentationType: input.documentationType,
      title: input.title,
      version: input.version,
      sections: input.sections,
      diagrams: input.diagrams,
      tokensUsed: input.tokensUsed,
      durationMs: input.durationMs,
    })
    .returning({ id: generatedDocuments.id });
  return { id: row.id };
}

export async function getGeneratedDocumentById(
  id: string,
  userId: string,
): Promise<(GeneratedDocument & { id: string; durationMs: number }) | null> {
  const row = await db.query.generatedDocuments.findFirst({
    where: and(
      eq(generatedDocuments.id, id),
      eq(generatedDocuments.userId, userId),
    ),
  });
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    type: row.documentationType as DocumentationType,
    iflowName: row.iFlowName ?? "",
    version: row.version ?? "1.0.0",
    sections: (row.sections as DocumentSectionContent[]) ?? [],
    diagrams: (row.diagrams as MermaidDiagram[]) ?? [],
    generatedAt: row.createdAt.toISOString(),
    tokensUsed: row.tokensUsed,
    durationMs: row.durationMs,
  };
}

export async function listGeneratedDocumentsForUser(params: {
  userId: string;
  tenantId?: string;
  iFlowId?: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    title: string;
    iFlowName: string | null;
    documentationType: string;
    tokensUsed: number;
    durationMs: number;
    createdAt: Date;
  }>
> {
  const conditions = [eq(generatedDocuments.userId, params.userId)];
  if (params.tenantId)
    conditions.push(eq(generatedDocuments.tenantId, params.tenantId));
  if (params.iFlowId)
    conditions.push(eq(generatedDocuments.iFlowId, params.iFlowId));

  const rows = await db
    .select({
      id: generatedDocuments.id,
      title: generatedDocuments.title,
      iFlowName: generatedDocuments.iFlowName,
      documentationType: generatedDocuments.documentationType,
      tokensUsed: generatedDocuments.tokensUsed,
      durationMs: generatedDocuments.durationMs,
      createdAt: generatedDocuments.createdAt,
    })
    .from(generatedDocuments)
    .where(and(...conditions))
    .orderBy(desc(generatedDocuments.createdAt))
    .limit(params.limit ?? 25);
  return rows;
}
