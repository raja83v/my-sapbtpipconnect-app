/**
 * iFlow Pipeline Orchestrator — Server Actions
 *
 * Server actions that wire up the multi-agent pipeline:
 * 1. startIFlowPipeline() — Kicks off the full pipeline
 * 2. approveIFlowPipeline() — User approves → deploy to SAP CPI
 * 3. cancelIFlowPipeline() — User cancels the pipeline
 * 4. retryIFlowPipeline() — Retry from ARCHITECTURE after failure
 *
 * These run on the server and persist all state to the database in real-time
 * so the frontend can track progress via polling.
 */

"use server";

import { getCurrentUser } from "./user";
import { db } from "@/lib/db";
import { cpiTenants, tenantMembers, iFlowPipelines } from "@/lib/db/schema";
import { eq, and, notInArray } from "drizzle-orm";
import type { ActionResult } from "@/types/actions";
import { decrypt } from "@/lib/encryption";
import { createSAPCPIClient } from "@/lib/sap-cpi/client";
import { BPMN2Generator } from "@/lib/sap-cpi/bpmn2-generator";
import { fetchTenantCapabilities, getDefaultCapabilities } from "@/lib/sap-cpi/tenant-capabilities";

import type {
  IFlowDescription,
  IFlowDesign,
  PackageSelection,
  CreationResult,
} from "@/components/ai/v2/specialized/iflow-creator/types";

import type {
  PipelineContext,
  PipelineSummary,
  TenantCapabilities,
  ValidationReport,
} from "@/lib/ai/orchestrator/pipeline-state";

import { PipelineOrchestrator } from "@/lib/ai/orchestrator/pipeline-orchestrator";
import { ArchitectAgent } from "@/lib/ai/orchestrator/agents/architect-agent";
import { DesignReviewerAgent } from "@/lib/ai/orchestrator/agents/design-reviewer-agent";
import { Bpmn2ValidatorAgent } from "@/lib/ai/orchestrator/agents/bpmn2-validator-agent";
import { FixAgent, MAX_FIX_ATTEMPTS } from "@/lib/ai/orchestrator/agents/fix-agent";
import { SummarizerAgent } from "@/lib/ai/orchestrator/agents/summarizer-agent";
import { ClarifierAgent } from "@/lib/ai/orchestrator/agents/clarifier-agent";
import { PlannerAgent } from "@/lib/ai/orchestrator/agents/planner-agent";
import { dispatchSpecialists } from "@/lib/ai/orchestrator/agents/specialist-dispatcher";
import { iFlowPipelineMessages } from "@/lib/db/schema";
import type {
  IntegrationBlueprint,
  RequirementsBrief,
  SpecialistResultEnvelope,
} from "@/lib/ai/orchestrator/pipeline-state";

// ============================================================================
// Pipeline Result Types
// ============================================================================

export interface PipelineStartResult {
  pipelineId: string;
}

export interface PipelineApproveResult extends CreationResult {
  generatedXML?: string;
}

// ============================================================================
// ACTION: Start Pipeline
// ============================================================================

export async function startIFlowPipeline(
  tenantId: string,
  packageSelection: PackageSelection,
  description: IFlowDescription
): Promise<ActionResult<PipelineStartResult>> {
  try {
    // 1. Auth check
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // 2. Verify tenant access
    const tenant = await db.query.cpiTenants.findFirst({ where: eq(cpiTenants.id, tenantId) });
    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    const membership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, user.id),
        eq(tenantMembers.tenantId, tenantId)
      ),
    });
    if (!membership) {
      return { success: false, error: "You don't have access to this tenant" };
    }

    // 3. Check for existing active pipeline — auto-cancel stale ones
    const active = await db.query.iFlowPipelines.findFirst({
      where: and(
        eq(iFlowPipelines.userId, user.id),
        eq(iFlowPipelines.tenantId, tenantId),
        notInArray(iFlowPipelines.phase, ["COMPLETED", "CANCELLED", "FAILED"])
      ),
    }).catch(() => null);
    if (active) {
      // Auto-cancel the stale pipeline so the user can start fresh
      await db.update(iFlowPipelines)
        .set({ phase: "CANCELLED" })
        .where(eq(iFlowPipelines.id, active.id))
        .catch((err: unknown) => {
          console.error(`[Pipeline] Failed to auto-cancel stale pipeline:`, err);
        });
    }

    // 4. Create pipeline record
    const [pipeline] = await db.insert(iFlowPipelines).values({
      userId: user.id,
      tenantId,
      packageSelection: JSON.stringify(packageSelection),
      description: JSON.stringify(description),
    }).returning();
    const pipelineId = pipeline.id;

    // 5. Run the pipeline in the background (don't await)
    // Studio mode: kick off the conversational clarifier first; the rest of
    // the pipeline is triggered from the chat handler once requirements are
    // captured. Legacy mode jumps straight into the architect flow.
    if (pipeline.studioMode) {
      runStudioClarifyPhase(pipelineId, description).catch((err) => {
        console.error(`[Pipeline:${pipelineId}] Clarify-phase error:`, err);
      });
    } else {
      runPipelineAsync(
        pipelineId,
        tenantId,
        user.id,
        packageSelection,
        description,
        tenant
      ).catch((err) => {
        console.error(`[Pipeline:${pipelineId}] Unhandled error:`, err);
      });
    }

    return {
      success: true,
      data: { pipelineId },
    };
  } catch (error) {
    console.error("Error starting pipeline:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start pipeline",
    };
  }
}

// ============================================================================
// ACTION: Approve Pipeline (triggers deployment)
// ============================================================================

export async function approveIFlowPipeline(
  pipelineId: string
): Promise<ActionResult<PipelineApproveResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Fetch pipeline details
    const pipeline = await db.query.iFlowPipelines.findFirst({
      where: and(
        eq(iFlowPipelines.id, pipelineId),
        eq(iFlowPipelines.userId, user.id)
      ),
    });

    if (!pipeline) {
      return { success: false, error: "Pipeline not found or access denied" };
    }

    if (pipeline.phase !== "AWAITING_APPROVAL" && pipeline.phase !== "DRAFTED") {
      return {
        success: false,
        error: `Pipeline is in "${pipeline.phase}" phase — can only deploy from AWAITING_APPROVAL or DRAFTED`,
      };
    }

    // Parse stored data
    const finalDesign: IFlowDesign = pipeline.finalDesign
      ? JSON.parse(pipeline.finalDesign)
      : pipeline.architectResult
        ? JSON.parse(pipeline.architectResult).design
        : null;

    if (!finalDesign) {
      return { success: false, error: "No design found in pipeline" };
    }

    const packageSelection: PackageSelection = JSON.parse(pipeline.packageSelection);
    const bpmn2Data = pipeline.bpmn2Xml
      ? { xml: pipeline.bpmn2Xml, scriptFiles: pipeline.bpmn2ScriptFiles ? JSON.parse(pipeline.bpmn2ScriptFiles) : [] }
      : null;

    if (!bpmn2Data) {
      return { success: false, error: "No BPMN2 XML found in pipeline" };
    }

    // Get tenant for deployment
    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, pipeline.tenantId),
    });
    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Update phase — accept either AWAITING_APPROVAL or DRAFTED as the entry.
    const orchestrator = new PipelineOrchestrator(pipelineId, pipeline.phase);
    await orchestrator.transition("DEPLOYING");

    // Deploy
    try {
      const result = await deployToSAPCPI(
        tenant,
        packageSelection,
        finalDesign,
        bpmn2Data.xml,
        bpmn2Data.scriptFiles
      );

      await orchestrator.setDeploymentResult(result);

      if (result.success) {
        await orchestrator.transition("COMPLETED");
      } else {
        await orchestrator.fail("DEPLOYING", result.errors?.join(", ") || "Deployment failed");
      }

      return { success: true, data: { ...result, generatedXML: bpmn2Data.xml } };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Deployment failed";
      await orchestrator.fail("DEPLOYING", msg);
      return { success: false, error: msg };
    }
  } catch (error) {
    console.error("Error approving pipeline:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve pipeline",
    };
  }
}

// ============================================================================
// ACTION: Save iFlow Draft (upload to CPI without deploying)
// ============================================================================

export async function saveIFlowDraft(
  pipelineId: string,
): Promise<ActionResult<{ iflowId: string; packageId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const pipeline = await db.query.iFlowPipelines.findFirst({
      where: and(
        eq(iFlowPipelines.id, pipelineId),
        eq(iFlowPipelines.userId, user.id),
      ),
    });
    if (!pipeline) return { success: false, error: "Pipeline not found" };

    if (pipeline.phase !== "AWAITING_APPROVAL" && pipeline.phase !== "DRAFTED") {
      return {
        success: false,
        error: `Cannot save draft from "${pipeline.phase}" phase`,
      };
    }

    const finalDesign: IFlowDesign | null = pipeline.finalDesign
      ? JSON.parse(pipeline.finalDesign)
      : pipeline.architectResult
        ? JSON.parse(pipeline.architectResult).design
        : null;
    if (!finalDesign) return { success: false, error: "No design in pipeline" };
    if (!pipeline.bpmn2Xml) return { success: false, error: "No BPMN2 XML" };

    const packageSelection: PackageSelection = JSON.parse(pipeline.packageSelection);
    const scriptFiles: { path: string; content: string }[] = pipeline.bpmn2ScriptFiles
      ? JSON.parse(pipeline.bpmn2ScriptFiles)
      : [];

    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, pipeline.tenantId),
    });
    if (!tenant) return { success: false, error: "Tenant not found" };

    const sapClient = createSAPCPIClient({
      tenantUrl: tenant.tenantUrl,
      authType: tenant.authType as "OAUTH" | "BASIC_AUTH",
      clientId: tenant.clientId ?? undefined,
      clientSecret: tenant.clientSecret ? await decrypt(tenant.clientSecret) : undefined,
      username: tenant.username ?? undefined,
      password: tenant.password ? await decrypt(tenant.password) : undefined,
      tokenUrl: tenant.authenticationUrl ?? undefined,
    });

    const packageId = packageSelection.packageId || "";
    const shouldCreateNew =
      packageSelection.createNewIFlow ||
      packageSelection.mode === "new" ||
      !packageSelection.iflowId;
    const iflowId = shouldCreateNew ? finalDesign.metadata.id : packageSelection.iflowId!;
    const iflowName = shouldCreateNew
      ? finalDesign.metadata.name
      : packageSelection.iflowName!;

    if (packageSelection.mode === "new") {
      try {
        await sapClient.createIntegrationPackage(
          packageId,
          packageSelection.packageName || "New Package",
          packageSelection.packageDescription,
        );
      } catch (err) {
        if (!(err instanceof Error && err.message.includes("already exists"))) {
          return {
            success: false,
            error: `Failed to create package: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
    }

    try {
      await sapClient.uploadIFlow(
        packageId,
        iflowId,
        iflowName,
        pipeline.bpmn2Xml,
        scriptFiles.length > 0 ? scriptFiles : undefined,
        shouldCreateNew,
        pipeline.parametersFile
          ? { parametersFile: pipeline.parametersFile }
          : undefined,
      );
    } catch (err) {
      return {
        success: false,
        error: `Failed to upload iFlow: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    await db
      .update(iFlowPipelines)
      .set({ phase: "DRAFTED", draftArtifactId: iflowId })
      .where(eq(iFlowPipelines.id, pipelineId));

    return { success: true, data: { iflowId, packageId } };
  } catch (error) {
    console.error("Error saving draft:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save draft",
    };
  }
}


export async function cancelIFlowPipeline(
  pipelineId: string
): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const pipeline = await db.query.iFlowPipelines.findFirst({
      where: and(
        eq(iFlowPipelines.id, pipelineId),
        eq(iFlowPipelines.userId, user.id)
      ),
    });

    if (!pipeline) {
      return { success: false, error: "Pipeline not found or access denied" };
    }

    await db.update(iFlowPipelines)
      .set({ phase: "CANCELLED" })
      .where(eq(iFlowPipelines.id, pipelineId));

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel pipeline",
    };
  }
}

// ============================================================================
// ACTION: Retry Pipeline (from failed state)
// ============================================================================

export async function retryIFlowPipeline(
  pipelineId: string
): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const pipeline = await db.query.iFlowPipelines.findFirst({
      where: and(
        eq(iFlowPipelines.id, pipelineId),
        eq(iFlowPipelines.userId, user.id)
      ),
    });

    if (!pipeline) {
      return { success: false, error: "Pipeline not found or access denied" };
    }

    if (pipeline.phase !== "FAILED") {
      return { success: false, error: "Can only retry from FAILED state" };
    }

    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, pipeline.tenantId),
    });
    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    const packageSelection: PackageSelection = JSON.parse(pipeline.packageSelection);
    const description: IFlowDescription = JSON.parse(pipeline.description);

    // Reset to ARCHITECTURE and re-run
    await db.update(iFlowPipelines)
      .set({ phase: "ARCHITECTURE" })
      .where(eq(iFlowPipelines.id, pipelineId));

    runPipelineAsync(
      pipelineId,
      pipeline.tenantId,
      user.id,
      packageSelection,
      description,
      tenant as any
    ).catch((err) => {
      console.error(`[Pipeline:${pipelineId}] Retry error:`, err);
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to retry pipeline",
    };
  }
}

// ============================================================================
// INTERNAL: Studio Clarify Phase
// ============================================================================

/**
 * Studio entry point: transitions the pipeline to CLARIFYING and runs the
 * Clarifier agent once to seed `requirementsBrief` and surface the first
 * follow-up question (if any) into the chat thread. The chat handler in
 * `app/actions/iflow-chat.ts` takes over from there: each user reply
 * re-runs the agent until `openQuestions` is empty, at which point it
 * calls `continueIFlowPipelineAfterClarify()` to kick off the architect.
 */
async function runStudioClarifyPhase(
  pipelineId: string,
  description: IFlowDescription,
): Promise<void> {
  const orchestrator = new PipelineOrchestrator(pipelineId);
  await orchestrator.transition("CLARIFYING").catch(() => {
    /* may already be in CLARIFYING after retry */
  });
  // Welcome message so the chat doesn't open empty.
  await db.insert(iFlowPipelineMessages).values({
    pipelineId,
    role: "assistant",
    kind: "TEXT",
    content:
      "Hi — I'll help you build this iFlow. Let me check the requirements first; I'll ask follow-up questions in chat if anything's unclear.",
  });

  const pipeline = await db.query.iFlowPipelines.findFirst({
    where: eq(iFlowPipelines.id, pipelineId),
  });
  if (!pipeline) return;

  const context: PipelineContext = {
    pipelineId,
    tenantId: pipeline.tenantId,
    userId: pipeline.userId,
    tenantCapabilities: getDefaultCapabilities(),
    packageSelection: JSON.parse(pipeline.packageSelection),
    description,
  };

  const clarifier = new ClarifierAgent();
  const descriptionText =
    typeof description === "string"
      ? description
      : (description as { summary?: string; goal?: string })?.summary ??
        (description as { goal?: string })?.goal ??
        JSON.stringify(description);

  let brief: RequirementsBrief | null = null;
  try {
    const res = await clarifier.execute(
      { description: descriptionText },
      context,
    );
    if (res.success && res.output) brief = res.output;
  } catch (err) {
    console.error(`[Pipeline:${pipelineId}] Clarifier failed:`, err);
  }

  if (!brief) {
    // Couldn't clarify — fall back to legacy direct-to-architect path so the
    // user isn't stuck staring at an empty chat.
    await db.insert(iFlowPipelineMessages).values({
      pipelineId,
      role: "assistant",
      kind: "TEXT",
      content:
        "I couldn't run the clarifier just now — proceeding straight to the design step.",
    });
    await continueIFlowPipelineAfterClarify(pipelineId);
    return;
  }

  await db
    .update(iFlowPipelines)
    .set({ requirementsBrief: brief })
    .where(eq(iFlowPipelines.id, pipelineId));

  const open = brief.openQuestions ?? [];
  if (open.length === 0) {
    // Already complete — skip straight to architect.
    await db.insert(iFlowPipelineMessages).values({
      pipelineId,
      role: "assistant",
      kind: "TEXT",
      content: "Got it — I have everything I need. Building the design now…",
    });
    await continueIFlowPipelineAfterClarify(pipelineId);
    return;
  }

  // Surface only the first open question (we'll iterate per answer).
  const next = open[0];
  await db.insert(iFlowPipelineMessages).values({
    pipelineId,
    role: "assistant",
    kind: "CLARIFIER_QUESTION",
    content: next.question,
    metadata: {
      id: next.id,
      options: next.options ?? null,
      required: !!next.required,
    },
  });
}

// ============================================================================
// ACTION: Continue Pipeline After Clarify (called from chat handler)
// ============================================================================

/**
 * Resumes the pipeline from the architect phase once the clarifier has
 * captured the requirements. Safe to call multiple times — only kicks off
 * work if the pipeline is in CLARIFYING / PLANNING / INIT.
 */
export async function continueIFlowPipelineAfterClarify(
  pipelineId: string,
): Promise<ActionResult<void>> {
  try {
    const pipeline = await db.query.iFlowPipelines.findFirst({
      where: eq(iFlowPipelines.id, pipelineId),
    });
    if (!pipeline) return { success: false, error: "Pipeline not found" };

    const RESUMABLE = new Set(["CLARIFYING", "PLANNING", "INIT"]);
    if (!RESUMABLE.has(pipeline.phase)) {
      return { success: true, data: undefined }; // already past clarify
    }

    const tenant = await db.query.cpiTenants.findFirst({
      where: eq(cpiTenants.id, pipeline.tenantId),
    });
    if (!tenant) return { success: false, error: "Tenant not found" };

    const packageSelection: PackageSelection = JSON.parse(pipeline.packageSelection);
    const description: IFlowDescription = JSON.parse(pipeline.description);

    runPipelineAsync(
      pipelineId,
      pipeline.tenantId,
      pipeline.userId,
      packageSelection,
      description,
      tenant as unknown as Record<string, unknown>,
    ).catch((err) => {
      console.error(`[Pipeline:${pipelineId}] Continue error:`, err);
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to continue pipeline",
    };
  }
}

// ============================================================================
// INTERNAL: Full Pipeline Execution
// ============================================================================

async function runPipelineAsync(
  pipelineId: string,
  tenantId: string,
  userId: string,
  packageSelection: PackageSelection,
  description: IFlowDescription,
  tenant: Record<string, unknown>
): Promise<void> {
  const orchestrator = new PipelineOrchestrator(pipelineId);

  // Instantiate agents
  const architectAgent = new ArchitectAgent();
  const reviewerAgent = new DesignReviewerAgent();
  const validatorAgent = new Bpmn2ValidatorAgent();
  const fixAgent = new FixAgent();
  const summarizerAgent = new SummarizerAgent();

  try {
    // ──────────────────────────────────────────────────────────────────────
    // Phase 1: Fetch Tenant Capabilities
    // ──────────────────────────────────────────────────────────────────────
    let tenantCapabilities: TenantCapabilities;
    try {
      const sapClient = createSAPCPIClient({
        tenantUrl: tenant.tenantUrl as string,
        authType: (tenant.authType as string) as "OAUTH" | "BASIC_AUTH",
        clientId: tenant.clientId as string,
        clientSecret: tenant.clientSecret as string,
        username: tenant.username as string,
        password: tenant.password as string,
        tokenUrl: tenant.authenticationUrl as string,
      });
      tenantCapabilities = await fetchTenantCapabilities(sapClient);
    } catch {
      console.warn(`[Pipeline:${pipelineId}] Failed to fetch tenant capabilities, using defaults`);
      tenantCapabilities = getDefaultCapabilities();
    }

    await orchestrator.setTenantCapabilities(tenantCapabilities);

    const context: PipelineContext = {
      pipelineId,
      tenantId,
      userId,
      tenantCapabilities,
      packageSelection,
      description,
    };

    // ──────────────────────────────────────────────────────────────────────
    // Phase 1.5 (Studio mode only): Planner + Specialists
    // ──────────────────────────────────────────────────────────────────────
    const pipelineRow = await db.query.iFlowPipelines.findFirst({
      where: eq(iFlowPipelines.id, pipelineId),
    });
    const studioMode = pipelineRow?.studioMode === true;

    let studioBlueprint: IntegrationBlueprint | null = null;
    let studioSpecialistResults: SpecialistResultEnvelope<unknown>[] | null = null;

    if (studioMode) {
      const brief: RequirementsBrief = pipelineRow?.requirementsBrief
        ? (pipelineRow.requirementsBrief as RequirementsBrief)
        : {
            goal:
              typeof description === "string"
                ? description
                : (description as { goal?: string; summary?: string }).goal ??
                  (description as { summary?: string }).summary ??
                  "",
            trigger: "message",
            openQuestions: [],
            confidence: 0.7,
          };

      // Planner
      await orchestrator.transition("PLANNING").catch(() => {});
      const plannerResult = await orchestrator.runAgent(
        new PlannerAgent(),
        {
          requirementsBrief: brief,
          tenantCapabilitiesSummary: summarizeCapabilities(tenantCapabilities),
        },
        context,
      );

      if (plannerResult.success && plannerResult.output) {
        studioBlueprint = plannerResult.output;
        await db
          .update(iFlowPipelines)
          .set({ blueprint: studioBlueprint })
          .where(eq(iFlowPipelines.id, pipelineId));

        await postStudioMessage(
          pipelineId,
          `Plan ready — pattern **${studioBlueprint.pattern}**, dispatching ${studioBlueprint.specialists.length} specialist agent(s) in parallel…`,
        );

        // Specialists (parallel, partial-success)
        await orchestrator.transition("SPECIALISTS").catch(() => {});
        studioSpecialistResults = await dispatchSpecialists(
          orchestrator,
          context,
          brief,
          studioBlueprint,
          { tenantCapabilitiesSummary: summarizeCapabilities(tenantCapabilities) },
        );
        await db
          .update(iFlowPipelines)
          .set({ specialistResults: studioSpecialistResults })
          .where(eq(iFlowPipelines.id, pipelineId));

        const okCount = studioSpecialistResults.filter((r) => r.ok).length;
        const failed = studioSpecialistResults
          .filter((r) => !r.ok)
          .map((r) => `${r.agent}: ${r.error}`);
        await postStudioMessage(
          pipelineId,
          failed.length === 0
            ? `All ${okCount} specialists succeeded. Integrating now…`
            : `${okCount}/${studioSpecialistResults.length} specialists succeeded. Continuing with partial results — failed: ${failed.join("; ")}`,
        );

        await orchestrator.transition("INTEGRATING").catch(() => {});
      } else {
        await postStudioMessage(
          pipelineId,
          `Planner could not produce a blueprint (${plannerResult.error ?? "unknown error"}). Falling back to single-agent architect.`,
        );
      }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Phase 2: Architect Agent — Generate Design
    // ──────────────────────────────────────────────────────────────────────
    if (studioMode) {
      await orchestrator.transition("ARCHITECTURE").catch(() => {});
    } else {
      await orchestrator.transition("ARCHITECTURE");
    }
    const architectResult = await orchestrator.runAgent(architectAgent, {
      description,
      tenantCapabilities,
      blueprint: studioBlueprint ?? undefined,
      specialistResults: studioSpecialistResults ?? undefined,
    }, context);

    if (!architectResult.success || !architectResult.output) {
      await orchestrator.fail("ARCHITECTURE", architectResult.error || "Architect agent failed");
      return;
    }

    await orchestrator.setArchitectResult(
      architectResult.output,
      architectResult.tokensUsed
    );

    let currentDesign = architectResult.output.design;

    // Studio: merge specialist-emitted files (mappings/scripts) and parameters
    // into the design + pipeline state so they end up in the deployed iFlow.
    if (studioMode && studioSpecialistResults && studioSpecialistResults.length > 0) {
      const merged = mergeSpecialistArtifacts(currentDesign, studioSpecialistResults);
      currentDesign = merged.design;
      if (merged.parametersFile) {
        await db
          .update(iFlowPipelines)
          .set({ parametersFile: merged.parametersFile })
          .where(eq(iFlowPipelines.id, pipelineId));
      }
      if (merged.fileCount > 0) {
        await postStudioMessage(
          pipelineId,
          `Integrated ${merged.fileCount} specialist artifact(s) into the design.`,
        );
      }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Phase 3: Design Reviewer Agent
    // ──────────────────────────────────────────────────────────────────────
    await orchestrator.transition("DESIGN_REVIEW");

    const reviewResult = await orchestrator.runAgent(reviewerAgent, {
      design: currentDesign,
      rationale: architectResult.output.rationale,
      tenantCapabilities,
    }, context);

    if (!reviewResult.success || !reviewResult.output) {
      await orchestrator.fail("DESIGN_REVIEW", reviewResult.error || "Design review failed");
      return;
    }

    // If reviewer provided a patched design, use it
    if (reviewResult.output.patchedDesign) {
      currentDesign = reviewResult.output.patchedDesign;
    }

    await orchestrator.setReviewerResult(
      reviewResult.output,
      reviewResult.tokensUsed,
      currentDesign
    );

    // If design was REJECTED, fail the pipeline
    if (reviewResult.output.review.verdict === "REJECTED") {
      await orchestrator.fail(
        "DESIGN_REVIEW",
        `Design rejected with score ${reviewResult.output.review.overallScore}/10. ${reviewResult.output.review.issues.filter(i => i.severity === "CRITICAL").length} critical issues.`,
        true // recoverable — can retry
      );
      return;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Phase 4: BPMN2 Generation
    // ──────────────────────────────────────────────────────────────────────
    await orchestrator.transition("BPMN_GENERATION");

    let bpmn2Xml: string;
    let scriptFiles: { path: string; content: string }[];

    try {
      const generator = new BPMN2Generator();

      // Pre-sanitize the design to fix invalid references (e.g. router targets
      // pointing to non-existent elements). This avoids the validator flagging
      // issues the BPMN generator would silently fix anyway.
      currentDesign = generator.sanitizeDesignPublic(currentDesign);

      bpmn2Xml = generator.generate(currentDesign);

      scriptFiles = (currentDesign.scripts ?? [])
        .filter((s) => s.scriptContent && s.scriptPath)
        .map((s) => ({
          path: s.scriptPath || `src/main/resources/script/${s.id}.groovy`,
          content: s.scriptContent!,
        }));

      await orchestrator.setBpmn2Result(bpmn2Xml, scriptFiles);
    } catch (error) {
      await orchestrator.fail(
        "BPMN_GENERATION",
        error instanceof Error ? error.message : "BPMN2 generation failed",
        true
      );
      return;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Phase 5: Validation
    // ──────────────────────────────────────────────────────────────────────
    await orchestrator.transition("VALIDATION");

    const validationResult = await orchestrator.runAgent(validatorAgent, {
      xml: bpmn2Xml,
      design: currentDesign,
      tenantCapabilities,
      scriptFiles,
    }, context);

    if (!validationResult.success || !validationResult.output) {
      await orchestrator.fail("VALIDATION", validationResult.error || "Validation failed");
      return;
    }

    await orchestrator.setValidatorResult(validationResult.output);

    let validationReport: ValidationReport = validationResult.output;

    // ──────────────────────────────────────────────────────────────────────
    // Phase 6: Fix Loop (if validation found errors)
    // ──────────────────────────────────────────────────────────────────────
    let fixAttemptCount = 0;
    const fixAttempts: Array<{ strategy: string; result: string }> = [];
    const previousFixAttempts: import("@/lib/ai/orchestrator/pipeline-state").FixAttempt[] = [];

    while (
      !validationReport.isValid &&
      validationReport.summary.requiresFix &&
      fixAttemptCount < MAX_FIX_ATTEMPTS
    ) {
      await orchestrator.transition("FIX_ATTEMPT");
      fixAttemptCount++;

      // Collect ALL validation errors — structural, semantic, and tenant-compat
      // so the fix agent has the complete picture.
      const allErrors = [
        ...validationReport.structural.errors,
        ...validationReport.semantic.orphanedSteps.map((s) => ({
          id: `SEM-ORPHAN-${s}`,
          type: "SEMANTIC" as const,
          severity: "HIGH" as const,
          message: `Orphaned step "${s}" — not connected to any flow`,
          location: s,
          fixable: true,
        })),
        ...validationReport.semantic.unreachableSteps.map((s) => ({
          id: `SEM-UNREACH-${s}`,
          type: "SEMANTIC" as const,
          severity: "MEDIUM" as const,
          message: `Unreachable step "${s}" — no path from start event`,
          location: s,
          fixable: true,
        })),
        ...validationReport.semantic.deadEndBranches.map((s) => ({
          id: `SEM-DEAD-${s}`,
          type: "SEMANTIC" as const,
          severity: "MEDIUM" as const,
          message: `Dead-end branch at "${s}" — no path to end event`,
          location: s,
          fixable: true,
        })),
      ];

      const fixableErrors = allErrors.filter((e) => e.fixable !== false);

      if (fixableErrors.length === 0) break;


      const fixResult = await orchestrator.runAgent(fixAgent, {
        design: currentDesign,
        xml: bpmn2Xml,
        errors: fixableErrors,
        attemptNumber: fixAttemptCount,
        previousAttempts: previousFixAttempts,
        tenantCapabilities,
      }, context, fixAttemptCount);

      if (!fixResult.success || !fixResult.output) {
        console.warn(`[Pipeline:${pipelineId}] Fix attempt ${fixAttemptCount} failed`);
        break;
      }

      const fixOutput = fixResult.output;
      fixAttempts.push({
        strategy: fixOutput.fixAttempt.strategy,
        result: fixOutput.fixAttempt.result,
      });
      previousFixAttempts.push(fixOutput.fixAttempt);

      // Apply fixes
      if (fixOutput.updatedDesign) {
        currentDesign = fixOutput.updatedDesign;
      }
      if (fixOutput.updatedXml) {
        bpmn2Xml = fixOutput.updatedXml;
      }

      await orchestrator.appendFixAttempt(
        fixOutput.fixAttempt,
        fixResult.tokensUsed,
        fixOutput.updatedDesign
      );

      // If strategy is REGENERATE, signal orchestrator to restart
      if (fixOutput.fixAttempt.strategy === "REGENERATE") {
        await orchestrator.fail(
          "FIX_ATTEMPT",
          "Fix agent recommends regeneration — retry from ARCHITECTURE",
          true
        );
        return;
      }

      // Re-generate BPMN2 if design was patched
      if (fixOutput.updatedDesign && !fixOutput.updatedXml) {
        try {
          await orchestrator.transition("BPMN_GENERATION");
          const generator = new BPMN2Generator();
          // Pre-sanitize the patched design too
          currentDesign = generator.sanitizeDesignPublic(currentDesign);
          bpmn2Xml = generator.generate(currentDesign);
          scriptFiles = (currentDesign.scripts ?? [])
            .filter((s) => s.scriptContent && s.scriptPath)
            .map((s) => ({
              path: s.scriptPath || `src/main/resources/script/${s.id}.groovy`,
              content: s.scriptContent!,
            }));
          await orchestrator.setBpmn2Result(bpmn2Xml, scriptFiles);
        } catch (error) {
          console.warn(`[Pipeline:${pipelineId}] Re-generation failed:`, error);
          break;
        }
      }

      // Re-validate
      await orchestrator.transition("VALIDATION");
      const revalidation = await orchestrator.runAgent(validatorAgent, {
        xml: bpmn2Xml,
        design: currentDesign,
        tenantCapabilities,
        scriptFiles,
      }, context);

      if (revalidation.success && revalidation.output) {
        validationReport = revalidation.output;
        await orchestrator.setValidatorResult(validationReport);
      } else {
        break;
      }

      if (validationReport.isValid) break;
    }

    // If validation still fails after all attempts, continue anyway with warnings
    // (user can still approve or reject at the summary stage)

    // ──────────────────────────────────────────────────────────────────────
    // Phase 7: Summarization
    // ──────────────────────────────────────────────────────────────────────
    await orchestrator.transition("SUMMARIZATION");

    // Build a partial pipeline state for the summarizer
    const pipelineState = {
      id: pipelineId,
      phase: "SUMMARIZATION" as const,
      startedAt: Date.now() - 30000, // approximate
      updatedAt: Date.now(),
      tenantId,
      userId,
      packageSelection,
      description,
      tenantCapabilities,
      architectResult: {
        design: architectResult.output.design,
        rationale: architectResult.output.rationale,
        tokensUsed: architectResult.tokensUsed,
        duration: architectResult.duration,
      },
      reviewerResult: reviewResult.output
        ? {
            review: reviewResult.output.review,
            patchedDesign: reviewResult.output.patchedDesign,
            designDiff: reviewResult.output.designDiff,
            tokensUsed: reviewResult.tokensUsed,
            duration: reviewResult.duration,
          }
        : undefined,
      bpmn2Result: {
        xml: bpmn2Xml,
        scriptFiles,
        generationDuration: 0,
      },
      validatorResult: {
        report: validationReport,
        duration: validationResult.duration,
      },
      fixAttempts: [],
      finalDesign: currentDesign,
    };

    const summaryResult = await orchestrator.runAgent(summarizerAgent, {
      pipelineState,
      finalDesign: currentDesign,
    }, context);

    if (summaryResult.success && summaryResult.output) {
      await orchestrator.setSummarizerResult(
        summaryResult.output,
        summaryResult.tokensUsed
      );
    }

    // ──────────────────────────────────────────────────────────────────────
    // Phase 8: Await User Approval
    // ──────────────────────────────────────────────────────────────────────
    await orchestrator.transition("AWAITING_APPROVAL");

    // Pipeline is now paused — user must call approveIFlowPipeline()
    // or cancelIFlowPipeline() to proceed.
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Pipeline failed unexpectedly";
    console.error(`[Pipeline:${pipelineId}] Fatal error:`, error);
    await orchestrator.fail(orchestrator.currentPhase, msg, true);
  }
}

// ============================================================================
// INTERNAL: Deploy to SAP CPI
// ============================================================================

async function deployToSAPCPI(
  tenant: Record<string, unknown>,
  packageSelection: PackageSelection,
  design: IFlowDesign,
  bpmn2Xml: string,
  scriptFiles: { path: string; content: string }[]
): Promise<CreationResult> {
  const sapClient = createSAPCPIClient({
    tenantUrl: tenant.tenantUrl as string,
    authType: (tenant.authType as string) as "OAUTH" | "BASIC_AUTH",
    clientId: tenant.clientId as string,
    clientSecret: tenant.clientSecret as string,
    username: tenant.username as string,
    password: tenant.password as string,
    tokenUrl: tenant.authenticationUrl as string,
  });

  const warnings: string[] = [];
  const packageId = packageSelection.packageId || "";
  const shouldCreateNew =
    packageSelection.createNewIFlow ||
    packageSelection.mode === "new" ||
    !packageSelection.iflowId;

  const iflowId = shouldCreateNew ? design.metadata.id : packageSelection.iflowId!;
  const iflowName = shouldCreateNew ? design.metadata.name : packageSelection.iflowName!;

  // Create package if new
  if (packageSelection.mode === "new") {
    try {
      await sapClient.createIntegrationPackage(
        packageId,
        packageSelection.packageName || "New Package",
        packageSelection.packageDescription
      );
    } catch (error) {
      if (error instanceof Error && !error.message.includes("already exists")) {
        return {
          success: false,
          iflowId,
          packageId,
          errors: [`Failed to create package: ${error.message}`],
        };
      }
      warnings.push("Package already exists, using existing package");
    }
  }

  // Upload iFlow
  try {
    await sapClient.uploadIFlow(
      packageId,
      iflowId,
      iflowName,
      bpmn2Xml,
      scriptFiles.length > 0 ? scriptFiles : undefined,
      shouldCreateNew
    );
  } catch (error) {
    return {
      success: false,
      iflowId,
      packageId,
      errors: [
        `Failed to upload iFlow: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    };
  }

  // Deploy to runtime
  try {
    await sapClient.deployIFlow(iflowId);
  } catch (error) {
    warnings.push(
      `iFlow created but deployment failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return {
    success: true,
    iflowId,
    packageId,
    deploymentUrl: `${tenant.tenantUrl}/itspaces/shell/monitoring/Messages?iflowId=${iflowId}`,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ============================================================================
// INTERNAL: Studio helpers
// ============================================================================

async function postStudioMessage(
  pipelineId: string,
  content: string,
  kind:
    | "TEXT"
    | "AGENT_STATUS"
    | "BLUEPRINT"
    | "PATCH_RESULT"
    | "CLARIFIER_QUESTION" = "TEXT",
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(iFlowPipelineMessages).values({
    pipelineId,
    role: "assistant",
    kind,
    content,
    metadata: metadata ?? {},
  });
}

function summarizeCapabilities(caps: TenantCapabilities): string {
  const lines: string[] = [];
  lines.push(`- Runtime: ${caps.runtimeVersion}`);
  if (caps.availableAdapters?.length) {
    lines.push(`- Adapters: ${caps.availableAdapters.slice(0, 30).join(", ")}`);
  }
  if (caps.supportedFeatures?.length) {
    lines.push(`- Features: ${caps.supportedFeatures.slice(0, 20).join(", ")}`);
  }
  if (caps.securityMaterials?.length) {
    lines.push(
      `- Security materials: ${caps.securityMaterials.slice(0, 20).join(", ")}`,
    );
  }
  if (caps.apimEnabled) {
    lines.push(`- APIM enabled (${caps.apimProxyCount ?? 0} proxies)`);
  }
  return lines.join("\n");
}

/**
 * Merge specialist outputs into the architect's design.
 *
 * - Adds mapping/script files from specialists into `design.scripts` so they
 *   ride along through the existing scriptFiles persistence path. The path
 *   prefix in `uploadIFlow` already routes `src/main/resources/...` artifacts
 *   to the right zip location.
 * - Returns the externalization specialist's `parametersFile` separately so
 *   the caller can persist it to `iFlowPipelines.parametersFile`.
 */
function mergeSpecialistArtifacts(
  design: IFlowDesign,
  envelopes: SpecialistResultEnvelope<unknown>[],
): { design: IFlowDesign; parametersFile?: string; fileCount: number } {
  const out: IFlowDesign = { ...design, scripts: [...(design.scripts ?? [])] };
  let parametersFile: string | undefined;
  let fileCount = 0;

  for (const env of envelopes) {
    if (!env.ok || !env.payload) continue;
    const payload = env.payload as {
      files?: { path: string; content: string }[];
      parametersFile?: string;
    };
    if (Array.isArray(payload.files)) {
      for (const f of payload.files) {
        if (!f?.path || typeof f.content !== "string") continue;
        // Avoid duplicates if architect already emitted the same path.
        if (out.scripts!.some((s) => s.scriptPath === f.path)) continue;
        out.scripts!.push({
          id: f.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? `artifact-${fileCount}`,
          name: f.path.split("/").pop() ?? "artifact",
          scriptPath: f.path,
          scriptContent: f.content,
          type: f.path.endsWith(".groovy")
            ? "groovy"
            : f.path.endsWith(".js")
              ? "javascript"
              : "groovy",
          purpose: "specialist-generated",
          complexity: "low",
        });
        fileCount += 1;
      }
    }
    if (
      env.agent === "EXTERNALIZATION_SPECIALIST" &&
      typeof payload.parametersFile === "string" &&
      payload.parametersFile.trim().length > 0
    ) {
      parametersFile = payload.parametersFile;
    }
  }

  return { design: out, parametersFile, fileCount };
}



