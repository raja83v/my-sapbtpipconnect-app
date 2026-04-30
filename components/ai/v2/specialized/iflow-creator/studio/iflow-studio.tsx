"use client";

/**
 * iFlow Studio — chat-first multi-agent design surface.
 *
 * Layout:
 *   ┌─────────────────────┬──────────────────────────────────┐
 *   │                     │  Tabs: Diagram | Components |    │
 *   │  AgentChatPanel     │   Artifacts | Parameters |       │
 *   │  (clarifier Q&A,    │   Validation | Tests             │
 *   │   agent activity,   │                                  │
 *   │   modify input)     │   <active tab content>           │
 *   │                     │                                  │
 *   ├─────────────────────┴──────────────────────────────────┤
 *   │                  DeployBar (Save Draft / Deploy)        │
 *   └─────────────────────────────────────────────────────────┘
 */

import { useEffect, useState } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  Layers,
  FileCode2,
  SlidersHorizontal,
  ShieldCheck,
  Beaker,
  PlusCircle,
} from "lucide-react";

import { AgentChatPanel } from "./agent-chat-panel";
import { BpmnCanvas } from "./bpmn-canvas";
import { ComponentsTab } from "./components-tab";
import { ArtifactsTab } from "./artifacts-tab";
import { ParametersTab } from "./parameters-tab";
import { ValidationTab } from "./validation-tab";
import { TestsTab } from "./tests-tab";
import { DeployBar } from "./deploy-bar";
import { PackagePicker } from "./package-picker";
import type { StudioPipelineSnapshot } from "./types";
import type { IFlowDesign } from "../types";

interface IFlowStudioProps {
  tenantId: string;
}

/** Poll interval (ms) while pipeline is in non-terminal phase. */
const POLL_INTERVAL_MS = 3000;
/** Phases that are terminal — stop polling. */
const TERMINAL_PHASES = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "DRAFTED",
  "AWAITING_APPROVAL",
]);

/** localStorage key for the active pipeline id (per-tenant). */
const LS_PIPELINE_KEY = (tenantId: string) => `iflow-studio:pipeline:${tenantId}`;

export function IFlowStudio({ tenantId }: IFlowStudioProps) {
  // Restore from URL (?pipeline=...) or localStorage on first render so the
  // user can return to a previous run — every chat message is already
  // persisted to iFlowPipelineMessages, this just makes the thread reachable
  // again.
  const [pipelineId, setPipelineId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("pipeline");
    if (fromUrl) return fromUrl;
    try {
      return window.localStorage.getItem(LS_PIPELINE_KEY(tenantId));
    } catch {
      return null;
    }
  });
  const [snapshot, setSnapshot] = useState<StudioPipelineSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<string>("diagram");
  /**
   * Bumped after a successful action (save-draft / deploy / retry) so the
   * polling effect re-runs even if the previous snapshot was on a terminal
   * phase (e.g. FAILED). Without this the snapshot stays frozen and the
   * Retry button reappears, double-firing the retry endpoint.
   */
  const [refreshTick, setRefreshTick] = useState(0);

  // Mirror pipelineId into localStorage + URL so it survives reloads and is
  // shareable. Clear both when starting a new run.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (pipelineId) {
        window.localStorage.setItem(LS_PIPELINE_KEY(tenantId), pipelineId);
      } else {
        window.localStorage.removeItem(LS_PIPELINE_KEY(tenantId));
      }
    } catch {
      /* ignore quota / disabled storage */
    }
    const url = new URL(window.location.href);
    if (pipelineId) {
      if (url.searchParams.get("pipeline") !== pipelineId) {
        url.searchParams.set("pipeline", pipelineId);
        window.history.replaceState(null, "", url.toString());
      }
    } else if (url.searchParams.has("pipeline")) {
      url.searchParams.delete("pipeline");
      window.history.replaceState(null, "", url.toString());
    }
  }, [pipelineId, tenantId]);

  // Poll the pipeline endpoint while it's running.
  useEffect(() => {
    if (!pipelineId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/pipelines/${pipelineId}`, {
          cache: "no-store",
        });
        if (res.status === 404) {
          // Stored pipeline id no longer exists (deleted, owned by another
          // user, etc) — reset so the user lands back on the package picker.
          if (!cancelled) {
            console.warn("[Studio] stored pipeline not found, resetting");
            setPipelineId(null);
            setSnapshot(null);
          }
          return;
        }
        if (!res.ok) throw new Error(`pipeline fetch ${res.status}`);
        const data = (await res.json()) as StudioPipelineSnapshot;
        if (cancelled) return;
        setSnapshot(data);
        if (!TERMINAL_PHASES.has(data.phase)) {
          timer = setTimeout(fetchOnce, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("[Studio] pipeline poll failed", err);
        timer = setTimeout(fetchOnce, POLL_INTERVAL_MS * 2);
      }
    };

    void fetchOnce();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pipelineId, refreshTick]);

  // Derived data.
  const finalDesign = snapshot?.finalDesign
    ? safeParse<IFlowDesign>(snapshot.finalDesign)
    : null;
  const phase = snapshot?.phase ?? "INIT";

  if (!pipelineId) {
    return (
      <PackagePicker
        tenantId={tenantId}
        onStarted={(id) => setPipelineId(id)}
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-0 flex-1 rounded-lg border bg-background"
      >
        {/* LEFT: chat */}
        <ResizablePanel defaultSize={38} minSize={28} maxSize={55}>
          <AgentChatPanel
            pipelineId={pipelineId}
            snapshot={snapshot}
          />
        </ResizablePanel>

        <ResizableHandle withHandle aria-label="Resize chat panel" />

        {/* RIGHT: tabs */}
        <ResizablePanel defaultSize={62} minSize={45}>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex h-full flex-col"
          >
            <div className="flex items-center justify-between border-b px-3 py-2">
              <TabsList className="bg-muted/40">
                <TabsTrigger value="diagram" className="gap-1.5">
                  <GitBranch className="size-4" aria-hidden />
                  Diagram
                </TabsTrigger>
                <TabsTrigger value="components" className="gap-1.5">
                  <Layers className="size-4" aria-hidden />
                  Components
                </TabsTrigger>
                <TabsTrigger value="artifacts" className="gap-1.5">
                  <FileCode2 className="size-4" aria-hidden />
                  Artifacts
                </TabsTrigger>
                <TabsTrigger value="parameters" className="gap-1.5">
                  <SlidersHorizontal className="size-4" aria-hidden />
                  Parameters
                </TabsTrigger>
                <TabsTrigger value="validation" className="gap-1.5">
                  <ShieldCheck className="size-4" aria-hidden />
                  Validation
                </TabsTrigger>
                <TabsTrigger value="tests" className="gap-1.5">
                  <Beaker className="size-4" aria-hidden />
                  Tests
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <PhaseBadge phase={phase} />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-9 gap-1"
                  onClick={() => {
                    setSnapshot(null);
                    setPipelineId(null);
                  }}
                  aria-label="Start a new pipeline"
                >
                  <PlusCircle className="size-4" aria-hidden />
                  New pipeline
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {!snapshot ? (
                <SnapshotSkeleton />
              ) : (
                <>
                  <TabsContent value="diagram" className="h-full m-0">
                    <BpmnCanvas design={finalDesign} bpmn2Xml={snapshot.bpmn2Xml ?? null} />
                  </TabsContent>
                  <TabsContent value="components" className="h-full m-0 overflow-auto">
                    <ComponentsTab design={finalDesign} />
                  </TabsContent>
                  <TabsContent value="artifacts" className="h-full m-0">
                    <ArtifactsTab pipelineId={pipelineId} snapshot={snapshot} />
                  </TabsContent>
                  <TabsContent value="parameters" className="h-full m-0 overflow-auto">
                    <ParametersTab snapshot={snapshot} />
                  </TabsContent>
                  <TabsContent value="validation" className="h-full m-0 overflow-auto">
                    <ValidationTab snapshot={snapshot} />
                  </TabsContent>
                  <TabsContent value="tests" className="h-full m-0 overflow-auto">
                    <TestsTab snapshot={snapshot} />
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>

      <DeployBar
        pipelineId={pipelineId}
        snapshot={snapshot}
        onActionSuccess={(action) => {
          // Optimistically clear FAILED so the Retry button hides instantly
          // and the user doesn't double-click.
          if (action === "retry") {
            setSnapshot((prev) =>
              prev ? { ...prev, phase: "ARCHITECTURE" } : prev,
            );
          }
          setRefreshTick((n) => n + 1);
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function safeParse<T = unknown>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function PhaseBadge({ phase }: { phase: string }) {
  const tone = phaseTone(phase);
  return (
    <span
      role="status"
      aria-live="polite"
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tabular-nums " +
        tone
      }
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-current" />
      </span>
      {humanizePhase(phase)}
    </span>
  );
}

function phaseTone(phase: string): string {
  if (phase === "FAILED") return "border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300";
  if (phase === "COMPLETED") return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (phase === "AWAITING_APPROVAL" || phase === "DRAFTED") return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300";
  if (phase === "CANCELLED") return "border-muted bg-muted text-muted-foreground";
  return "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300";
}

function humanizePhase(phase: string): string {
  const map: Record<string, string> = {
    INIT: "Starting",
    CLARIFYING: "Gathering requirements",
    PLANNING: "Planning",
    SPECIALISTS: "Specialists working",
    INTEGRATING: "Assembling",
    SAMPLE_GEN: "Generating samples",
    MODIFYING: "Applying changes",
    DRAFTED: "Saved as draft",
    ARCHITECTURE: "Designing",
    DESIGN_REVIEW: "Reviewing",
    BPMN_GENERATION: "Generating BPMN",
    VALIDATION: "Validating",
    FIX_ATTEMPT: "Fixing",
    SUMMARIZATION: "Summarizing",
    AWAITING_APPROVAL: "Awaiting approval",
    DEPLOYING: "Deploying",
    COMPLETED: "Deployed",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
  };
  return map[phase] ?? phase;
}

function SnapshotSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Card className="p-4">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-3 h-32 w-full" />
      </Card>
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  );
}
