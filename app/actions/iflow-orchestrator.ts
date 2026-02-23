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
import { prisma } from "@/lib/db";
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
    const tenant = await prisma.cpiTenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    const membership = await prisma.tenantMember.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    });
    if (!membership) {
      return { success: false, error: "You don't have access to this tenant" };
    }

    // 3. Check for existing active pipeline — auto-cancel stale ones
    const active = await prisma.iFlowPipeline.findFirst({
      where: {
        userId: user.id,
        tenantId,
        phase: { notIn: ["COMPLETED", "CANCELLED", "FAILED"] },
      },
    }).catch(() => null);
    if (active) {
      // Auto-cancel the stale pipeline so the user can start fresh
      console.log(`[Pipeline] Auto-cancelling stale pipeline ${active.id} (phase: ${active.phase})`);
      await prisma.iFlowPipeline.update({
        where: { id: active.id },
        data: { phase: "CANCELLED" },
      }).catch((err: unknown) => {
        console.error(`[Pipeline] Failed to auto-cancel stale pipeline:`, err);
      });
    }

    // 4. Create pipeline record
    const pipeline = await prisma.iFlowPipeline.create({
      data: {
        userId: user.id,
        tenantId,
        packageSelection: JSON.stringify(packageSelection),
        description: JSON.stringify(description),
      },
    });
    const pipelineId = pipeline.id;

    // 5. Run the pipeline in the background (don't await)
    // We fire-and-forget so the client gets the pipelineId immediately
    // and can track progress via polling
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
    const pipeline = await prisma.iFlowPipeline.findFirst({
      where: { id: pipelineId, userId: user.id },
    });

    if (!pipeline) {
      return { success: false, error: "Pipeline not found or access denied" };
    }

    if (pipeline.phase !== "AWAITING_APPROVAL") {
      return {
        success: false,
        error: `Pipeline is in "${pipeline.phase}" phase — can only approve from AWAITING_APPROVAL`,
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
    const tenant = await prisma.cpiTenant.findUnique({
      where: { id: pipeline.tenantId },
    });
    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    // Update phase
    const orchestrator = new PipelineOrchestrator(
      pipelineId,
      "AWAITING_APPROVAL" // Pipeline is already in AWAITING_APPROVAL phase
    );
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
// ACTION: Cancel Pipeline
// ============================================================================

export async function cancelIFlowPipeline(
  pipelineId: string
): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const pipeline = await prisma.iFlowPipeline.findFirst({
      where: { id: pipelineId, userId: user.id },
    });

    if (!pipeline) {
      return { success: false, error: "Pipeline not found or access denied" };
    }

    await prisma.iFlowPipeline.update({
      where: { id: pipelineId },
      data: { phase: "CANCELLED" },
    });

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

    const pipeline = await prisma.iFlowPipeline.findFirst({
      where: { id: pipelineId, userId: user.id },
    });

    if (!pipeline) {
      return { success: false, error: "Pipeline not found or access denied" };
    }

    if (pipeline.phase !== "FAILED") {
      return { success: false, error: "Can only retry from FAILED state" };
    }

    const tenant = await prisma.cpiTenant.findUnique({
      where: { id: pipeline.tenantId },
    });
    if (!tenant) {
      return { success: false, error: "Tenant not found" };
    }

    const packageSelection: PackageSelection = JSON.parse(pipeline.packageSelection);
    const description: IFlowDescription = JSON.parse(pipeline.description);

    // Reset to ARCHITECTURE and re-run
    await prisma.iFlowPipeline.update({
      where: { id: pipelineId },
      data: { phase: "ARCHITECTURE" },
    });

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
    await orchestrator.transition("ARCHITECTURE");

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
    // Phase 2: Architect Agent — Generate Design
    // ──────────────────────────────────────────────────────────────────────
    const architectResult = await orchestrator.runAgent(architectAgent, {
      description,
      tenantCapabilities,
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

      console.log(`[Pipeline:${pipelineId}] Fix attempt ${fixAttemptCount}: ${fixableErrors.length} fixable errors (${fixableErrors.map(e => e.id).join(', ')})`);

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
    console.log(`[Pipeline:${pipelineId}] Completed all agents — awaiting user approval`);
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
