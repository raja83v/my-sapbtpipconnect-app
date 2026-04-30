"use client";

/**
 * BpmnCanvas — read-only BPMN diagram via bpmn-js NavigatedViewer.
 *
 * bpmn-js is dynamic-imported so the studio still loads if the package isn't
 * installed yet. When BPMN2 XML is unavailable, we fall back to a textual
 * step list extracted from the design.
 */

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Layers, AlertCircle } from "lucide-react";
import type { IFlowDesign } from "@/components/ai/v2/specialized/iflow-creator/types";

interface BpmnCanvasProps {
  design: IFlowDesign | null;
  bpmn2Xml: string | null;
}

export function BpmnCanvas({ design, bpmn2Xml }: BpmnCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<{ destroy?: () => void; importXML?: (xml: string) => Promise<unknown>; get?: (svc: string) => { zoom?: (v: string | number) => void } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bpmnAvailable, setBpmnAvailable] = useState<boolean | null>(null);

  // Lazy-init bpmn-js
  useEffect(() => {
    if (!bpmn2Xml || !containerRef.current) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const init = async () => {
      try {
        const mod = await import("bpmn-js/lib/NavigatedViewer");
        if (cancelled) return;
        const Viewer = (mod as { default: new (opts: unknown) => unknown }).default;

        // Re-create on every XML change to keep things simple.
        if (viewerRef.current?.destroy) {
          try {
            viewerRef.current.destroy();
          } catch {
            /* ignore */
          }
        }

        const v = new Viewer({ container: containerRef.current }) as typeof viewerRef.current;
        viewerRef.current = v;

        // bpmn-js logs structural complaints ("not yet drawn",
        // "targetRef not specified", etc.) via console.error, which the
        // Next.js dev overlay surfaces as page errors. They're warnings,
        // not failures — temporarily filter them so the diagram still
        // renders without spamming the dev overlay.
        const origError = console.error;
        const swallow = /not yet drawn|targetRef not specified|sourceRef not specified|unparsable content/i;
        console.error = (...args: unknown[]) => {
          const msg = args.map(a => (a instanceof Error ? a.message : String(a))).join(" ");
          if (swallow.test(msg)) {
            console.warn("[bpmn-js]", ...args);
            return;
          }
          origError.apply(console, args as []);
        };
        try {
          await v?.importXML?.(bpmn2Xml);
        } catch (importErr) {
          // bpmn-js rejects importXML when it encounters unresolvable
          // refs (dangling sequence/message flows from LLM-generated
          // designs). The viewer still rendered everything it *could*
          // parse, so log a warning and keep going instead of failing
          // the whole canvas.
          const msg = importErr instanceof Error ? importErr.message : String(importErr);
          console.warn("[bpmn-js] importXML completed with warnings:", msg);
        } finally {
          console.error = origError;
        }
        try {
          v?.get?.("canvas").zoom?.("fit-viewport");
        } catch {
          /* ignore */
        }
        setBpmnAvailable(true);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (/Cannot find|Failed to fetch dynamically/i.test(msg)) {
          // Package not installed yet → graceful fallback
          setBpmnAvailable(false);
        } else {
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
      if (viewerRef.current?.destroy) {
        try {
          viewerRef.current.destroy();
        } catch {
          /* ignore */
        }
        viewerRef.current = null;
      }
    };
  }, [bpmn2Xml]);

  // No BPMN yet → textual fallback
  if (!bpmn2Xml) {
    return <DesignFallback design={design} />;
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] bg-size-[18px_18px]"
        aria-label="BPMN diagram"
        role="img"
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          <Spinner className="size-5" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <Card className="max-w-md p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-red-600 dark:text-red-400">
              <AlertCircle className="size-4" /> Diagram failed to load
            </p>
            <pre className="mt-2 whitespace-pre-wrap wrap-break-word text-xs text-muted-foreground">
              {error}
            </pre>
          </Card>
        </div>
      )}
      {bpmnAvailable === false && <DesignFallback design={design} note="Install bpmn-js to enable interactive diagram" />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function DesignFallback({ design, note }: { design: IFlowDesign | null; note?: string }) {
  if (!design) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        <div className="max-w-md space-y-2">
          <Layers className="mx-auto size-8 opacity-50" aria-hidden />
          <p>The diagram will appear here once the design is ready.</p>
        </div>
      </div>
    );
  }

  const steps = design.flowDiagram ?? design.flowSteps ?? design.steps ?? [];
  return (
    <div className="h-full overflow-auto p-6">
      {note && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          {note}
        </div>
      )}
      <h2 className="text-sm font-semibold">{design.metadata?.name ?? "iFlow"}</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        {design.metadata?.description}
      </p>
      <ol className="space-y-1.5">
        {steps.map((s, idx) => (
          <li
            key={(s as { id?: string }).id ?? idx}
            className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary tabular-nums">
              {idx + 1}
            </span>
            <span className="font-medium">{(s as { name?: string }).name ?? "Step"}</span>
            <span className="text-xs text-muted-foreground">
              {(s as { type?: string }).type}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
