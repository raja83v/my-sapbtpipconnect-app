"use client";

/**
 * Pipeline View
 *
 * Combined view that shows the pipeline progress tracker alongside
 * the approval dashboard when the pipeline reaches AWAITING_APPROVAL.
 * This is the main entry point component for the pipeline UI.
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, RotateCcw } from "lucide-react";

import { PipelineProgressTracker } from "./pipeline-progress-tracker";
import { PipelineApprovalDashboard } from "./pipeline-approval-dashboard";
import { retryIFlowPipeline } from "@/app/actions/iflow-orchestrator";
import type { PipelinePhase } from "@/lib/ai/orchestrator/pipeline-state";
import { useState, useTransition } from "react";

interface PipelineViewProps {
  pipelineId: string;
  onComplete?: (result: { success: boolean }) => void;
  onCancel?: () => void;
}

export function PipelineView({
  pipelineId,
  onComplete,
  onCancel,
}: PipelineViewProps) {
  const pipeline = useQuery((api as any).iflowPipeline.getById, {
    pipelineId: pipelineId as any,
  });

  const [isRetrying, startRetry] = useTransition();

  const phase = (pipeline?.phase ?? "INIT") as PipelinePhase;
  const showApproval =
    phase === "AWAITING_APPROVAL" ||
    phase === "DEPLOYING" ||
    phase === "COMPLETED";
  const canRetry = phase === "FAILED" && pipeline?.errorRecoverable;

  function handleRetry() {
    startRetry(async () => {
      await retryIFlowPipeline(pipelineId);
    });
  }

  if (!pipeline) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-muted-foreground">Connecting to pipeline…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Tracker — always visible */}
      <PipelineProgressTracker pipelineId={pipelineId} />

      {/* Approval Dashboard — shown when ready */}
      {showApproval && (
        <PipelineApprovalDashboard
          pipelineId={pipelineId}
          onComplete={onComplete}
        />
      )}

      {/* Retry button for failed pipelines */}
      {canRetry && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-muted-foreground">
              Pipeline failed but can be retried from the design phase.
            </p>
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Retry Pipeline
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
