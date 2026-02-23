"use client";

/**
 * Pipeline Progress Tracker
 *
 * Real-time progress display for the multi-agent iFlow pipeline.
 * Polls the pipeline API to track pipeline phase changes.
 * Shows each agent as a step with status indicators.
 */

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  AlertTriangle,
  Cpu,
  Shield,
  FileCode,
  CheckSquare,
  Wrench,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  getPhaseLabel,
  getPhaseProgress,
  isTerminalPhase,
} from "@/lib/ai/orchestrator/pipeline-state";
import type { PipelinePhase } from "@/lib/ai/orchestrator/pipeline-state";

interface PipelineProgressTrackerProps {
  pipelineId: string;
}

// Pipeline steps with their associated phases
const PIPELINE_STEPS = [
  {
    phase: "ARCHITECTURE" as PipelinePhase,
    label: "Architect",
    description: "Generating iFlow design",
    icon: Cpu,
    agentName: "ARCHITECT",
  },
  {
    phase: "DESIGN_REVIEW" as PipelinePhase,
    label: "Design Review",
    description: "Reviewing design quality",
    icon: Shield,
    agentName: "REVIEWER",
  },
  {
    phase: "BPMN_GENERATION" as PipelinePhase,
    label: "BPMN2 Generation",
    description: "Generating XML artifacts",
    icon: FileCode,
    agentName: null, // Deterministic, no agent log
  },
  {
    phase: "VALIDATION" as PipelinePhase,
    label: "Validation",
    description: "Validating BPMN2 & compatibility",
    icon: CheckSquare,
    agentName: "VALIDATOR",
  },
  {
    phase: "FIX_ATTEMPT" as PipelinePhase,
    label: "Auto-Fix",
    description: "Fixing validation errors",
    icon: Wrench,
    agentName: "FIX",
  },
  {
    phase: "SUMMARIZATION" as PipelinePhase,
    label: "Summary",
    description: "Generating pipeline summary",
    icon: FileText,
    agentName: "SUMMARIZER",
  },
];

const PHASE_ORDER: PipelinePhase[] = [
  "INIT",
  "ARCHITECTURE",
  "DESIGN_REVIEW",
  "BPMN_GENERATION",
  "VALIDATION",
  "FIX_ATTEMPT",
  "SUMMARIZATION",
  "AWAITING_APPROVAL",
  "DEPLOYING",
  "COMPLETED",
];

function getPhaseIndex(phase: PipelinePhase): number {
  const idx = PHASE_ORDER.indexOf(phase);
  return idx === -1 ? 0 : idx;
}

export function PipelineProgressTracker({
  pipelineId,
}: PipelineProgressTrackerProps) {
  const [pipeline, setPipeline] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPipeline() {
      try {
        const response = await fetch(`/api/pipelines/${pipelineId}`);
        if (response.ok && !cancelled) {
          const data = await response.json();
          setPipeline(data);
        }
      } catch (error) {
        console.error("Failed to fetch pipeline:", error);
      }
    }

    fetchPipeline();

    // Poll every 3 seconds while pipeline is active
    const interval = setInterval(fetchPipeline, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pipelineId]);

  if (!pipeline) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-muted-foreground">Loading pipeline…</span>
        </CardContent>
      </Card>
    );
  }

  const currentPhase = pipeline.phase as PipelinePhase;
  const progress = getPhaseProgress(currentPhase);
  const isTerminal = isTerminalPhase(currentPhase);
  const isFailed = currentPhase === "FAILED";
  const currentPhaseIndex = getPhaseIndex(currentPhase);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5" />
            Pipeline Progress
          </CardTitle>
          <PhaseStatusBadge phase={currentPhase} />
        </div>
        <Progress
          value={isFailed ? 0 : progress}
          className={cn("mt-2 h-2", isFailed && "bg-destructive/20")}
        />
      </CardHeader>

      <CardContent>
        <div className="space-y-1">
          {PIPELINE_STEPS.map((step, index) => {
            const stepPhaseIndex = getPhaseIndex(step.phase);
            const isActive = step.phase === currentPhase;
            const isComplete = !isFailed && currentPhaseIndex > stepPhaseIndex;
            const isSkipped =
              step.phase === "FIX_ATTEMPT" &&
              currentPhaseIndex > stepPhaseIndex &&
              !pipeline.fixAttempts;
            const isPending = currentPhaseIndex < stepPhaseIndex;

            return (
              <div key={step.phase}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                    isActive && "bg-primary/5",
                    isComplete && "opacity-80"
                  )}
                >
                  {/* Status icon */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                    {isActive && !isTerminal ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : isComplete ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : isSkipped ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : isFailed && isActive ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : (
                      <step.icon className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>

                  {/* Label & description */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isPending && "text-muted-foreground",
                        isActive && "text-primary"
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {isActive && !isTerminal
                        ? getPhaseLabel(currentPhase) + "…"
                        : isComplete
                          ? "Done"
                          : isSkipped
                            ? "Skipped"
                            : step.description}
                    </p>
                  </div>

                  {/* Duration if completed */}
                  {isComplete && step.agentName && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      <Clock className="mr-1 inline h-3 w-3" />
                    </span>
                  )}
                </div>

                {index < PIPELINE_STEPS.length - 1 && (
                  <div className="ml-6 flex">
                    <Separator
                      orientation="vertical"
                      className={cn(
                        "ml-[3px] h-4",
                        isComplete ? "bg-green-600/30" : "bg-border/50"
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Error display */}
        {isFailed && pipeline.errorMessage && (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  Pipeline Failed
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pipeline.errorMessage}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PhaseStatusBadge({ phase }: { phase: PipelinePhase }) {
  if (phase === "COMPLETED") {
    return (
      <Badge variant="outline" className="border-green-600/30 text-green-600">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Completed
      </Badge>
    );
  }
  if (phase === "FAILED") {
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" />
        Failed
      </Badge>
    );
  }
  if (phase === "CANCELLED") {
    return (
      <Badge variant="secondary">Cancelled</Badge>
    );
  }
  if (phase === "AWAITING_APPROVAL") {
    return (
      <Badge variant="outline" className="border-amber-500/30 text-amber-600">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Awaiting Approval
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      {getPhaseLabel(phase)}
    </Badge>
  );
}
