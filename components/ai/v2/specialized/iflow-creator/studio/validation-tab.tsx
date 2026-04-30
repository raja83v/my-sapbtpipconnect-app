"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioPipelineSnapshot } from "./types";

interface ValidationTabProps {
  snapshot: StudioPipelineSnapshot;
}

export function ValidationTab({ snapshot }: ValidationTabProps) {
  const reviewer = safeParse<{ review?: { overallScore?: number; issues?: ReviewIssue[]; strengths?: string[] } }>(
    snapshot.reviewerResult,
  );
  const validator = safeParse<{ report?: ValidationReport }>(snapshot.validatorResult);

  const score = reviewer?.review?.overallScore ?? null;
  const issues = reviewer?.review?.issues ?? [];
  const strengths = reviewer?.review?.strengths ?? [];
  const report = validator?.report ?? null;

  return (
    <div className="space-y-4 p-4">
      <Card className="p-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-medium">Reviewer score</h2>
          </div>
          <ScoreBadge score={score} />
        </header>
        {strengths.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        )}
        {issues.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs">
            {issues.map((iss, i) => (
              <IssueRow key={i} issue={iss} />
            ))}
          </ul>
        )}
        {strengths.length === 0 && issues.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">No reviewer output yet.</p>
        )}
      </Card>

      <Card className="p-4">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-medium">BPMN validator</h2>
          {report && (
            <Badge
              variant={report.isValid ? "secondary" : "destructive"}
              className="tabular-nums"
            >
              {report.isValid ? "Passed" : "Failed"}
            </Badge>
          )}
        </header>
        {!report ? (
          <p className="mt-2 text-xs text-muted-foreground">Validator hasn&rsquo;t run yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
            <Metric label="Errors" value={report.errors?.length ?? 0} tone="red" />
            <Metric label="Warnings" value={report.warnings?.length ?? 0} tone="amber" />
            <Metric label="Tenant compat" value={report.tenantCompatibility?.passed ? "OK" : "Issues"} tone={report.tenantCompatibility?.passed ? "emerald" : "red"} />
          </div>
        )}
        {report?.errors && report.errors.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs">
            {report.errors.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-red-700 dark:text-red-400">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{typeof e === "string" ? e : (e as { message?: string }).message}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

interface ReviewIssue {
  severity?: "critical" | "high" | "medium" | "low" | string;
  message?: string;
  description?: string;
}

interface ValidationReport {
  isValid: boolean;
  errors?: (string | { message?: string })[];
  warnings?: (string | { message?: string })[];
  tenantCompatibility?: { passed: boolean };
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <Badge variant="outline">No score</Badge>;
  }
  const tone =
    score >= 80
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : score >= 60
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : "border-red-300 bg-red-50 text-red-700";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums", tone)}>
      {score}/100
    </span>
  );
}

function IssueRow({ issue }: { issue: ReviewIssue }) {
  const sev = (issue.severity ?? "medium").toLowerCase();
  const Icon = sev === "critical" || sev === "high" ? AlertCircle : AlertTriangle;
  const tone =
    sev === "critical" || sev === "high"
      ? "text-red-700 dark:text-red-400"
      : sev === "medium"
        ? "text-amber-700 dark:text-amber-400"
        : "text-muted-foreground";
  return (
    <li className={cn("flex items-start gap-2", tone)}>
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{issue.message ?? issue.description ?? "(no description)"}</span>
    </li>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: "red" | "amber" | "emerald" }) {
  const map: Record<string, string> = {
    red: "text-red-700 dark:text-red-400",
    amber: "text-amber-700 dark:text-amber-400",
    emerald: "text-emerald-700 dark:text-emerald-400",
  };
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold tabular-nums", map[tone])}>{value}</p>
    </div>
  );
}

function safeParse<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
