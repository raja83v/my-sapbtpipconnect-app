"use client";

import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCode2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioPipelineSnapshot } from "./types";

interface ArtifactsTabProps {
  pipelineId: string;
  snapshot: StudioPipelineSnapshot;
}

interface ArtifactEntry {
  path: string;
  language: string;
  content: string;
}

export function ArtifactsTab({ snapshot }: ArtifactsTabProps) {
  const artifacts = useMemo<ArtifactEntry[]>(() => collect(snapshot), [snapshot]);
  const [active, setActive] = useState<string | null>(artifacts[0]?.path ?? null);
  const current = artifacts.find((a) => a.path === active) ?? artifacts[0];

  if (artifacts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        <div className="space-y-2">
          <FileCode2 className="mx-auto size-8 opacity-50" aria-hidden />
          <p>Artifacts will appear here as the agents finish.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* file tree */}
      <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30">
        <p className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Files
        </p>
        <ScrollArea className="min-h-0 flex-1">
          <ul role="tree" aria-label="iFlow artifacts" className="p-1">
            {artifacts.map((a) => (
              <li key={a.path} role="treeitem" aria-selected={current?.path === a.path}>
                <button
                  type="button"
                  onClick={() => setActive(a.path)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs",
                    current?.path === a.path
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  <FileCode2 className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate" title={a.path}>
                    {basename(a.path)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </aside>

      {/* preview */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">
              {current?.language ?? "text"}
            </Badge>
            <p className="truncate text-xs text-muted-foreground" title={current?.path}>
              {current?.path}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => current && downloadFile(current.path, current.content)}
            className="gap-1 text-xs"
          >
            <Download className="size-3.5" aria-hidden />
            Download
          </Button>
        </header>
        <pre className="flex-1 overflow-auto bg-muted/20 p-3 font-mono text-xs leading-relaxed">
          <code>{current?.content ?? ""}</code>
        </pre>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------------

function collect(snapshot: StudioPipelineSnapshot): ArtifactEntry[] {
  const out: ArtifactEntry[] = [];

  if (snapshot.bpmn2Xml) {
    out.push({
      path: "src/main/resources/scenarioflows/integrationflow/iflow.iflw",
      language: "xml",
      content: snapshot.bpmn2Xml,
    });
  }
  if (snapshot.parametersFile) {
    out.push({
      path: "src/main/resources/parameters.prop",
      language: "properties",
      content: snapshot.parametersFile,
    });
  }
  // Scripts (stored as JSON-encoded array)
  if (snapshot.bpmn2ScriptFiles) {
    try {
      const arr = JSON.parse(snapshot.bpmn2ScriptFiles) as { path: string; content: string }[];
      for (const s of arr) {
        if (!s?.path) continue;
        out.push({
          path: s.path,
          language: detectLanguage(s.path),
          content: s.content,
        });
      }
    } catch {
      /* ignore */
    }
  }
  // Specialist results may carry mapping/script files too
  if (snapshot.specialistResults) {
    for (const r of snapshot.specialistResults) {
      const payload = (r as { payload?: { files?: { path: string; content: string }[] } }).payload;
      const files = payload?.files;
      if (Array.isArray(files)) {
        for (const f of files) {
          if (!f?.path) continue;
          out.push({
            path: f.path,
            language: detectLanguage(f.path),
            content: f.content,
          });
        }
      }
    }
  }

  // De-dupe by path keeping last
  const map = new Map<string, ArtifactEntry>();
  for (const e of out) map.set(e.path, e);
  return Array.from(map.values());
}

function detectLanguage(p: string): string {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "xml":
    case "iflw":
    case "mmap":
    case "xsd":
      return "xml";
    case "xsl":
    case "xslt":
      return "xslt";
    case "groovy":
      return "groovy";
    case "js":
      return "javascript";
    case "json":
      return "json";
    case "prop":
    case "properties":
    case "propdef":
      return "properties";
    default:
      return ext || "text";
  }
}

function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}

function downloadFile(path: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = basename(path);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
