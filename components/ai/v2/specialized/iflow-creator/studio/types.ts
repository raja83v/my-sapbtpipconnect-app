/**
 * Shared types for the iFlow Studio.
 *
 * `StudioPipelineSnapshot` is the shape returned by GET /api/pipelines/[id].
 * Most fields are stored as JSON-encoded text in the DB; the studio parses
 * them lazily where needed.
 */

import type {
  ChatMessageKind,
  ChatMessageRole,
  IntegrationBlueprint,
  PipelinePhase,
  RequirementsBrief,
  SpecialistResult,
  SampleDataOutput,
} from "@/lib/ai/orchestrator/pipeline-state";

export interface StudioPipelineSnapshot {
  id: string;
  phase: PipelinePhase;
  startedAt: string;
  updatedAt: string;
  tenantId: string;
  userId: string;

  // Inputs
  packageSelection?: string;
  description?: string;

  // Studio (multi-agent v2)
  requirementsBrief?: RequirementsBrief | null;
  blueprint?: IntegrationBlueprint | null;
  specialistResults?: SpecialistResult[] | null;
  samplePayloads?: SampleDataOutput | null;
  parametersFile?: string | null;
  draftArtifactId?: string | null;
  studioMode?: boolean;

  // Final design + BPMN
  finalDesign?: string | null; // JSON-encoded IFlowDesign
  bpmn2Xml?: string | null;
  bpmn2ScriptFiles?: string | null;

  // Agent outputs (legacy)
  architectResult?: string | null;
  reviewerResult?: string | null;
  validatorResult?: string | null;
  fixAttempts?: string | null;
  summarizerResult?: string | null;
  deploymentResult?: string | null;

  agentLogs?: AgentLogRow[];
}

export interface AgentLogRow {
  id: string;
  pipelineId: string;
  agentName: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED" | string;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  tokensUsed?: number | null;
  error?: string | null;
  outputSummary?: string | null;
}

export interface StudioChatMessage {
  id: string;
  role: ChatMessageRole;
  kind: ChatMessageKind;
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}
