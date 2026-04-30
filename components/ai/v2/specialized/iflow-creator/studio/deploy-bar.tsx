"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  Rocket,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioPipelineSnapshot } from "./types";

interface DeployBarProps {
  pipelineId: string;
  snapshot: StudioPipelineSnapshot | null;
  /**
   * Called after a successful POST to one of the action endpoints (save-draft
   * | deploy | retry). The parent uses this to restart polling — otherwise
   * the snapshot stays frozen on a terminal phase like FAILED and the user
   * can click Retry a second time, getting "Can only retry from FAILED
   * state" because the server has already moved on.
   */
  onActionSuccess?: (action: "save-draft" | "deploy" | "retry") => void;
}

/**
 * Bottom action bar. The actual server actions (`saveDraftToCPI`,
 * `deployDraft`, `retryIFlowPipeline`) are wired up via fetch to the existing
 * action-style API routes; if a route doesn't exist yet, the button surfaces
 * the error inline rather than blowing up the page.
 */
export function DeployBar({ pipelineId, snapshot, onActionSuccess }: DeployBarProps) {
  const phase = snapshot?.phase ?? "INIT";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const call = (action: "save-draft" | "deploy" | "retry") => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/pipelines/${pipelineId}/${action}`, { method: "POST" });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `HTTP ${res.status}`);
        }
        onActionSuccess?.(action);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  };

  const status = phaseToStatus(phase);
  const tenant = snapshot?.deploymentResult ? safeParse<{ deploymentUrl?: string }>(snapshot.deploymentResult) : null;
  const deployUrl = tenant?.deploymentUrl;

  return (
    <div className="sticky bottom-0 z-10 flex flex-col gap-1 border-t bg-background/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <StatusDot tone={status.tone} />
          <span className="font-medium">{status.label}</span>
          {snapshot?.draftArtifactId && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {snapshot.draftArtifactId}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {phase === "FAILED" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 gap-1"
              disabled={pending}
              onClick={() => call("retry")}
            >
              <RotateCcw className="size-4" aria-hidden />
              Retry
            </Button>
          )}
          {(phase === "AWAITING_APPROVAL" || phase === "DRAFTED") && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 gap-1"
              disabled={pending}
              onClick={() => call("save-draft")}
            >
              {pending ? <Spinner className="size-4" /> : <Save className="size-4" aria-hidden />}
              {phase === "DRAFTED" ? "Update draft" : "Save draft"}
            </Button>
          )}
          {(phase === "AWAITING_APPROVAL" || phase === "DRAFTED") && (
            <Button
              type="button"
              size="sm"
              className="min-h-11 gap-1"
              disabled={pending}
              onClick={() => call("deploy")}
            >
              {pending ? <Spinner className="size-4" /> : <Rocket className="size-4" aria-hidden />}
              Deploy to CPI
            </Button>
          )}
          {phase === "COMPLETED" && deployUrl && (
            <Button asChild size="sm" variant="outline" className="min-h-11 gap-1">
              <a href={deployUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden /> Open in CPI
              </a>
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="size-3.5" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

function StatusDot({ tone }: { tone: "neutral" | "blue" | "amber" | "emerald" | "red" }) {
  const map: Record<string, string> = {
    neutral: "bg-muted-foreground/40",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    red: "bg-red-500",
  };
  return <span aria-hidden className={cn("size-2 rounded-full", map[tone])} />;
}

function phaseToStatus(phase: string): { label: string; tone: "neutral" | "blue" | "amber" | "emerald" | "red" } {
  switch (phase) {
    case "AWAITING_APPROVAL":
      return { label: "Ready to save or deploy", tone: "amber" };
    case "DRAFTED":
      return { label: "Draft saved in CPI", tone: "amber" };
    case "DEPLOYING":
      return { label: "Deploying…", tone: "blue" };
    case "COMPLETED":
      return { label: "Deployed", tone: "emerald" };
    case "FAILED":
      return { label: "Failed", tone: "red" };
    case "CANCELLED":
      return { label: "Cancelled", tone: "neutral" };
    default:
      return { label: "Working…", tone: "blue" };
  }
}

function safeParse<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
