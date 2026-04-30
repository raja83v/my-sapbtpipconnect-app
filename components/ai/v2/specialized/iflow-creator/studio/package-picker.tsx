"use client";

/**
 * Studio entry point. The user picks a package + writes a one-liner; we
 * start a studio-mode pipeline. Subsequent clarifier Q&A happens in chat.
 *
 * We deliberately don't reuse the legacy 5-step wizard — the studio collects
 * detail conversationally instead.
 */

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
import { PackageSelectionStep } from "../steps/package-selection";
import type { PackageSelection } from "../types";
import { startIFlowPipeline } from "@/app/actions/iflow-orchestrator";

interface PackagePickerProps {
  tenantId: string;
  onStarted: (pipelineId: string) => void;
}

export function PackagePicker({ tenantId, onStarted }: PackagePickerProps) {
  const [pkg, setPkg] = useState<PackageSelection | undefined>();
  const [seed, setSeed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canStart = !!pkg && seed.trim().length >= 12;

  const handleStart = () => {
    if (!pkg) return;
    setError(null);
    startTransition(async () => {
      const res = await startIFlowPipeline(tenantId, pkg, {
        description: seed.trim(),
        triggerType: "message",
      } as never);
      if (res.success && res.data) {
        onStarted(res.data.pipelineId);
      } else {
        setError(res.success ? "Failed to start pipeline" : (res.error ?? null));
      }
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-lg font-semibold">iFlow Studio</h1>
          <p className="text-sm text-muted-foreground">
            Describe what you want, then refine with the AI team. We&rsquo;ll save a
            draft to SAP&nbsp;CPI when you&rsquo;re happy.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Choose a package</CardTitle>
          <CardDescription>
            Pick an existing integration package or create a new one. We&rsquo;ll
            ship the iFlow into it as a draft.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PackageSelectionStep
            tenantId={tenantId}
            value={pkg}
            onChange={setPkg}
            onNext={() => undefined}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Describe your iFlow</CardTitle>
          <CardDescription>
            One or two sentences are enough &mdash; the Clarifier agent will ask
            for any missing details next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="e.g. Replicate cost centers from S/4HANA to SuccessFactors EC every night, with retry on transient HTTP errors and audit log on every batch&hellip;"
            rows={5}
            className="resize-none text-sm"
            spellCheck={false}
            aria-label="iFlow description"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {seed.trim().length}/12 minimum characters
          </p>
        </CardContent>

        {error && (
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Could not start</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        )}

        <CardFooter className="justify-end gap-2">
          <Button
            onClick={handleStart}
            disabled={!canStart || pending}
            className="min-h-10 gap-1.5"
          >
            {pending ? "Starting…" : "Start studio"}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
