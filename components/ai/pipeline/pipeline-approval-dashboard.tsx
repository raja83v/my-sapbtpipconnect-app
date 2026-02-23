"use client";

/**
 * Pipeline Approval Dashboard
 *
 * Displays the full pipeline summary and lets the user approve or reject deployment.
 * Shows: headline, confidence, components, design score, risks, timeline, agent metrics.
 */

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Loader2,
  Rocket,
  ShieldAlert,
  XCircle,
  Zap,
  BarChart3,
  FileCode,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { approveIFlowPipeline, cancelIFlowPipeline } from "@/app/actions/iflow-orchestrator";
import type { PipelineSummary, Risk, AgentMetrics } from "@/lib/ai/orchestrator/pipeline-state";

interface PipelineApprovalDashboardProps {
  pipelineId: string;
  onComplete?: (result: { success: boolean }) => void;
}

export function PipelineApprovalDashboard({
  pipelineId,
  onComplete,
}: PipelineApprovalDashboardProps) {
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

  const [isApproving, startApproving] = useTransition();
  const [isCancelling, startCancelling] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!pipeline) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-muted-foreground">Loading summary…</span>
        </CardContent>
      </Card>
    );
  }

  const summary: PipelineSummary | null = pipeline.summarizerResult
    ? JSON.parse(pipeline.summarizerResult)
    : null;

  const isAwaitingApproval = pipeline.phase === "AWAITING_APPROVAL";

  function handleApprove() {
    setError(null);
    startApproving(async () => {
      const result = await approveIFlowPipeline(pipelineId);
      if (!result.success) {
        setError(result.error || "Approval failed");
      }
      onComplete?.({ success: result.success });
    });
  }

  function handleCancel() {
    setError(null);
    startCancelling(async () => {
      const result = await cancelIFlowPipeline(pipelineId);
      if (!result.success) {
        setError(result.error || "Cancellation failed");
      }
      onComplete?.({ success: false });
    });
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Summary not yet available. Pipeline may still be processing.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{summary.headline}</CardTitle>
              <CardDescription className="mt-1">
                {summary.flowDescription}
              </CardDescription>
            </div>
            <ConfidenceBadge confidence={summary.confidence} />
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              icon={<BarChart3 className="h-4 w-4" />}
              label="Design Score"
              value={`${summary.designScore}/10`}
              variant={summary.designScore >= 7 ? "success" : summary.designScore >= 5 ? "warning" : "destructive"}
            />
            <StatCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Validation"
              value={summary.validationPassed ? "Passed" : "Failed"}
              variant={summary.validationPassed ? "success" : "destructive"}
            />
            <StatCard
              icon={<Zap className="h-4 w-4" />}
              label="Tokens Used"
              value={summary.totalTokensUsed.toLocaleString()}
              variant="default"
            />
            <StatCard
              icon={<Clock className="h-4 w-4" />}
              label="Duration"
              value={formatDuration(summary.totalDuration)}
              variant="default"
            />
          </div>
        </CardContent>
      </Card>

      {/* Components Card */}
      {summary.components.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCode className="h-4 w-4" />
              Components ({summary.components.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {summary.components.map((comp, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{comp.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {comp.description}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {comp.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Risks Card */}
      {summary.risks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4" />
              Risks ({summary.risks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.risks.map((risk, i) => (
                <RiskItem key={i} risk={risk} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Metrics Card */}
      {summary.agentBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4" />
              Agent Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.agentBreakdown.map((agent, i) => (
                <AgentMetricsRow key={i} metrics={agent} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Design Changes */}
      {summary.designChanges.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Design Changes ({summary.designChanges.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-40">
              <div className="space-y-1">
                {summary.designChanges.map((change, i) => (
                  <div key={i} className="rounded-md bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {change.agent}
                      </Badge>
                      <span className="text-xs font-medium">
                        {change.component}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {change.change} — {change.reason}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Approval Actions */}
      {isAwaitingApproval && (
        <Card>
          <CardFooter className="flex items-center justify-between pt-6">
            <div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              {!summary.readyToDeploy && (
                <p className="text-xs text-amber-600">
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  This flow has unresolved risks. Deploy with caution.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isApproving || isCancelling}
              >
                {isCancelling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Cancel
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isApproving || isCancelling}
              >
                {isApproving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="mr-2 h-4 w-4" />
                )}
                Approve &amp; Deploy
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function ConfidenceBadge({
  confidence,
}: {
  confidence: PipelineSummary["confidence"];
}) {
  const variants = {
    HIGH: "border-green-600/30 text-green-600",
    MEDIUM: "border-amber-500/30 text-amber-600",
    LOW: "border-destructive/30 text-destructive",
  };
  return (
    <Badge variant="outline" className={variants[confidence]}>
      {confidence === "HIGH" && <CheckCircle2 className="mr-1 h-3 w-3" />}
      {confidence === "MEDIUM" && <AlertTriangle className="mr-1 h-3 w-3" />}
      {confidence === "LOW" && <XCircle className="mr-1 h-3 w-3" />}
      {confidence} Confidence
    </Badge>
  );
}

function StatCard({
  icon,
  label,
  value,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  variant?: "success" | "warning" | "destructive" | "default";
}) {
  const colors = {
    success: "text-green-600",
    warning: "text-amber-600",
    destructive: "text-destructive",
    default: "text-foreground",
  };

  return (
    <div className="rounded-md border px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn("mt-1 text-sm font-semibold tabular-nums", colors[variant])}>
        {value}
      </p>
    </div>
  );
}

function RiskItem({ risk }: { risk: Risk }) {
  const colors = {
    HIGH: "border-destructive/30 bg-destructive/5",
    MEDIUM: "border-amber-500/30 bg-amber-50 dark:bg-amber-950/20",
    LOW: "border-border",
  };
  const icons = {
    HIGH: <XCircle className="h-4 w-4 text-destructive" />,
    MEDIUM: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    LOW: <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
  };

  return (
    <div className={cn("rounded-md border px-3 py-2", colors[risk.level])}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{icons[risk.level]}</div>
        <div>
          <p className="text-sm">{risk.description}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {risk.mitigation}
          </p>
        </div>
      </div>
    </div>
  );
}

function AgentMetricsRow({ metrics }: { metrics: AgentMetrics }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {metrics.agent}
        </Badge>
        <span
          className={cn(
            "text-xs",
            metrics.status === "COMPLETED" && "text-green-600",
            metrics.status === "FAILED" && "text-destructive"
          )}
        >
          {metrics.status}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
        {metrics.tokensUsed > 0 && (
          <span>{metrics.tokensUsed.toLocaleString()} tokens</span>
        )}
        {metrics.duration > 0 && (
          <span>{formatDuration(metrics.duration)}</span>
        )}
        {metrics.attempts > 1 && (
          <span>{metrics.attempts} attempts</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
