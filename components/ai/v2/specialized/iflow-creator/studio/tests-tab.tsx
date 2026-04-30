"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Beaker, Copy, Check } from "lucide-react";
import type { StudioPipelineSnapshot } from "./types";

interface TestsTabProps {
  snapshot: StudioPipelineSnapshot;
}

export function TestsTab({ snapshot }: TestsTabProps) {
  const samples = snapshot.samplePayloads;
  const [copied, setCopied] = useState<string | null>(null);

  if (!samples || (!samples.inputPayloads?.length && !samples.curlSnippet)) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        <div className="space-y-2">
          <Beaker className="mx-auto size-8 opacity-50" aria-hidden />
          <p>Test payloads will appear here once the SampleData agent finishes.</p>
        </div>
      </div>
    );
  }

  const copy = (key: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="space-y-4 p-4">
      {samples.curlSnippet && (
        <Card className="p-3">
          <header className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">Invoke from cURL</h3>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-xs"
              onClick={() => copy("curl", samples.curlSnippet!)}
            >
              {copied === "curl" ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              Copy
            </Button>
          </header>
          <pre className="overflow-auto rounded-md bg-muted/30 p-3 font-mono text-xs">
            <code>{samples.curlSnippet}</code>
          </pre>
        </Card>
      )}

      <section>
        <h3 className="mb-2 text-sm font-medium">Sample inputs</h3>
        <div className="space-y-2">
          {(samples.inputPayloads ?? []).map((p, i) => (
            <Card key={i} className="p-3">
              <header className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{p.contentType}</Badge>
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-xs"
                  onClick={() => copy(`in-${i}`, p.content)}
                >
                  {copied === `in-${i}` ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                  Copy
                </Button>
              </header>
              <pre className="max-h-64 overflow-auto rounded-md bg-muted/30 p-3 font-mono text-xs">
                <code>{p.content}</code>
              </pre>
            </Card>
          ))}
        </div>
      </section>

      {samples.expectedOutputs && samples.expectedOutputs.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Expected outputs</h3>
          <div className="space-y-2">
            {samples.expectedOutputs.map((p, i) => (
              <Card key={i} className="p-3">
                <header className="mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{p.contentType}</Badge>
                  <span className="text-sm font-medium">{p.name}</span>
                </header>
                <pre className="max-h-64 overflow-auto rounded-md bg-muted/30 p-3 font-mono text-xs">
                  <code>{p.content}</code>
                </pre>
              </Card>
            ))}
          </div>
        </section>
      )}

      {samples.notes && samples.notes.length > 0 && (
        <Card className="p-3">
          <h3 className="mb-2 text-sm font-medium">Notes</h3>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {samples.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}
