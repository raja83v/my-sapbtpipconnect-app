"use client";

import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, FileText, Layers, Clock, AlertTriangle } from "lucide-react";

export type TimelinePhaseStatus =
  | "queued"
  | "running"
  | "done"
  | "failed";

export interface TimelinePhase {
  id: string;
  label: string;
  status: TimelinePhaseStatus;
  detail?: string;
  durationMs?: number;
  icon?: "metadata" | "outline" | "section" | "diagrams" | "done";
}

interface DocGeneratorTimelineProps {
  phases: TimelinePhase[];
  onPhaseClick?: (id: string) => void;
}

function iconFor(name: TimelinePhase["icon"]) {
  switch (name) {
    case "metadata":
      return Sparkles;
    case "outline":
      return Layers;
    case "section":
      return FileText;
    case "diagrams":
      return Sparkles;
    case "done":
      return Check;
    default:
      return Clock;
  }
}

function formatDuration(ms?: number) {
  if (!ms || ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function DocGeneratorTimeline({
  phases,
  onPhaseClick,
}: DocGeneratorTimelineProps) {
  return (
    <ol className="relative space-y-1">
      {phases.map((p, idx) => {
        const Icon = iconFor(p.icon);
        const isLast = idx === phases.length - 1;
        const dur = formatDuration(p.durationMs);

        return (
          <li key={p.id} className="relative">
            {/* Connector line */}
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-7 left-3.5 h-[calc(100%-12px)] w-px",
                  p.status === "done"
                    ? "bg-emerald-500/40"
                    : p.status === "failed"
                      ? "bg-red-500/40"
                      : "bg-border",
                )}
              />
            )}
            <button
              type="button"
              onClick={onPhaseClick ? () => onPhaseClick(p.id) : undefined}
              className={cn(
                "group relative flex w-full items-start gap-3 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors",
                onPhaseClick && "hover:bg-muted/60 cursor-pointer",
                !onPhaseClick && "cursor-default",
              )}
            >
              {/* Status badge */}
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-1 transition-all",
                  p.status === "queued" &&
                    "bg-muted text-muted-foreground ring-border",
                  p.status === "running" &&
                    "bg-emerald-500/15 text-emerald-600 ring-emerald-500/40 dark:text-emerald-400",
                  p.status === "done" &&
                    "bg-emerald-500/20 text-emerald-700 ring-emerald-500/50 dark:text-emerald-300",
                  p.status === "failed" &&
                    "bg-red-500/15 text-red-600 ring-red-500/40 dark:text-red-400",
                )}
              >
                {p.status === "running" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : p.status === "done" ? (
                  <Check className="size-3.5" />
                ) : p.status === "failed" ? (
                  <AlertTriangle className="size-3.5" />
                ) : (
                  <Icon className="size-3.5" />
                )}
              </span>

              {/* Content */}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "truncate text-sm font-medium",
                      p.status === "queued" && "text-muted-foreground",
                      p.status === "running" && "text-foreground",
                      p.status === "done" && "text-foreground",
                      p.status === "failed" && "text-red-600 dark:text-red-400",
                    )}
                  >
                    {p.label}
                  </span>
                  {p.status === "running" && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      streaming…
                    </span>
                  )}
                  {dur && p.status === "done" && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {dur}
                    </span>
                  )}
                </span>
                {p.detail && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {p.detail}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
