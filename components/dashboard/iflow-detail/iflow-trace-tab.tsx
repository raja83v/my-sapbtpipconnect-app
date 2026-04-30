"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  IconRefresh,
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconX,
  IconActivity,
  IconArrowRight,
  IconPaperclip,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

import {
  getIFlowLogLevel,
  getMessageTraceDetails,
  setIFlowLogLevel,
  type MessageTraceDetails,
} from "@/app/actions/iflow-testing";
import type { IFlowDetailData } from "@/app/actions/iflows";
import type { LogLevel, LogLevelConfiguration } from "@/lib/sap-cpi/client";

interface IFlowTraceTabProps {
  iflow: IFlowDetailData;
}

const LOG_LEVELS: LogLevel[] = ["NONE", "INFO", "DEBUG", "TRACE"];

export function IFlowTraceTab({ iflow }: IFlowTraceTabProps) {
  const [config, setConfig] = useState<LogLevelConfiguration | null>(null);
  const [isLoadingConfig, startConfigT] = useTransition();
  const [isUpdating, setIsUpdating] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [messageGuid, setMessageGuid] = useState("");
  const [trace, setTrace] = useState<MessageTraceDetails | null>(null);
  const [isLoadingTrace, startTraceT] = useTransition();

  const loadConfig = () => {
    startConfigT(async () => {
      const r = await getIFlowLogLevel(iflow.id);
      if (r.success) setConfig(r.data ?? null);
      else toast.error(r.error);
    });
  };

  useEffect(() => {
    if (iflow.status === "STARTED") loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iflow.id, iflow.status]);

  // Live countdown ticker.
  useEffect(() => {
    if (config?.logLevel !== "TRACE" || !config?.expiryDateTime) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [config?.logLevel, config?.expiryDateTime]);

  const remainingMs = useMemo(() => {
    if (!config?.expiryDateTime) return null;
    return Math.max(0, config.expiryDateTime.getTime() - now);
  }, [config?.expiryDateTime, now]);

  const handleSetLevel = async (level: LogLevel) => {
    if (level === config?.logLevel) return;
    setIsUpdating(true);
    try {
      const r = await setIFlowLogLevel(iflow.id, level);
      if (r.success) {
        setConfig(r.data ?? null);
        toast.success(`Trace level set to ${level}`);
      } else {
        toast.error("Couldn't change trace level", {
          description: r.error,
          duration: 8000,
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const loadTrace = () => {
    if (!messageGuid.trim()) return;
    startTraceT(async () => {
      const r = await getMessageTraceDetails(iflow.id, messageGuid.trim());
      if (r.success) {
        setTrace(r.data ?? null);
      } else {
        setTrace(null);
        toast.error(r.error);
      }
    });
  };

  if (iflow.status !== "STARTED") {
    return (
      <Card>
        <CardContent className="py-12">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Tracing requires a deployed iFlow</EmptyTitle>
              <EmptyDescription>
                Deploy the iFlow to enable trace capture and viewer.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Log level controls */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Trace level</CardTitle>
            <CardDescription>
              SAP CPI auto-expires TRACE after 10 minutes. Use sparingly.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadConfig} disabled={isLoadingConfig}>
            <IconRefresh className={`h-4 w-4 ${isLoadingConfig ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingConfig && !config ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <ToggleGroup
                type="single"
                value={config?.logLevel ?? "INFO"}
                onValueChange={(v) => v && handleSetLevel(v as LogLevel)}
                disabled={isUpdating}
                aria-label="Trace level"
              >
                {LOG_LEVELS.map((level) => (
                  <ToggleGroupItem key={level} value={level} className="px-3">
                    {level}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {config?.logLevel === "TRACE" && remainingMs !== null && (
                <Badge variant="secondary" className="font-mono" aria-live="polite">
                  <IconClock className="h-3 w-3 mr-1" />
                  Expires in {formatRemaining(remainingMs)}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trace lookup */}
      <Card>
        <CardHeader>
          <CardTitle>Inspect a message</CardTitle>
          <CardDescription>
            Paste a Message GUID (from the test runner or message logs) to view its run steps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col sm:flex-row gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              loadTrace();
            }}
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="mpl-guid">Message GUID</Label>
              <Input
                id="mpl-guid"
                value={messageGuid}
                onChange={(e) => setMessageGuid(e.target.value)}
                placeholder="e.g. AGqv7…"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <div className="self-end">
              <Button type="submit" disabled={isLoadingTrace || !messageGuid.trim()}>
                Load trace
                <IconArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </form>

          {isLoadingTrace ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : trace ? (
            <TraceDetails trace={trace} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function TraceDetails({ trace }: { trace: MessageTraceDetails }) {
  const { message, runSteps, errorText, attachments } = trace;
  const start = parseSapDate(message.LogStart);
  const end = parseSapDate(message.LogEnd);
  const totalMs = start && end ? end.getTime() - start.getTime() : null;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-md border p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Status</div>
          <div className="font-medium flex items-center gap-1">
            {message.Status === "COMPLETED" ? (
              <IconCheck className="h-4 w-4 text-emerald-500" />
            ) : message.Status === "FAILED" ? (
              <IconX className="h-4 w-4 text-destructive" />
            ) : (
              <IconActivity className="h-4 w-4 text-muted-foreground" />
            )}
            {message.Status}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Start</div>
          <div className="font-medium">{start ? format(start, "PPp") : "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Duration</div>
          <div className="font-medium">{totalMs !== null ? `${totalMs} ms` : "—"}</div>
        </div>
      </div>

      {errorText && (
        <div
          className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          <div className="flex items-center gap-2 font-medium">
            <IconAlertTriangle className="h-4 w-4" /> Error
          </div>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">{errorText}</pre>
        </div>
      )}

      {/* Run steps */}
      <div>
        <div className="mb-2 text-sm font-medium">Run steps ({runSteps.length})</div>
        {runSteps.length === 0 ? (
          <p className="text-xs text-muted-foreground">No run steps available.</p>
        ) : (
          <ol className="space-y-1.5" role="list">
            {runSteps.map((step, idx) => {
              const stepStart = parseSapDate(step.StepStart);
              const stepStop = parseSapDate(step.StepStop);
              const dur =
                stepStart && stepStop ? stepStop.getTime() - stepStart.getTime() : null;
              return (
                <li
                  key={`${idx}-${step.ModelStepId ?? step.StepId ?? idx}`}
                  className="rounded-md border bg-card p-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground tabular-nums w-8">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <Badge
                        variant={
                          step.Status === "COMPLETED"
                            ? "default"
                            : step.Status === "FAILED"
                              ? "destructive"
                              : "outline"
                        }
                        className="shrink-0"
                      >
                        {step.Status ?? "—"}
                      </Badge>
                      <span className="truncate font-medium">
                        {step.ModelStepId ?? step.StepId ?? "(unnamed)"}
                      </span>
                      {step.Activity && (
                        <span className="text-muted-foreground truncate hidden sm:inline">
                          · {step.Activity}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground tabular-nums shrink-0">
                      {dur !== null ? `${dur} ms` : ""}
                    </div>
                  </div>
                  {step.Error && (
                    <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-destructive">
                      {step.Error}
                    </pre>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-medium flex items-center gap-1.5">
            <IconPaperclip className="h-4 w-4" />
            Attachments ({attachments.length})
          </div>
          <ul className="text-xs space-y-1" role="list">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 border rounded-md px-2 py-1">
                <span className="truncate">{a.name}</span>
                <span className="text-muted-foreground tabular-nums">
                  {a.contentType} • {a.size ?? "?"} B
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function parseSapDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const m = /\/Date\((\d+)\)\//.exec(value);
    if (m) return new Date(Number(m[1]));
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
