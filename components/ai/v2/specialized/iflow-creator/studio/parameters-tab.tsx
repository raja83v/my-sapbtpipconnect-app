"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal } from "lucide-react";
import type { StudioPipelineSnapshot } from "./types";

interface ParametersTabProps {
  snapshot: StudioPipelineSnapshot;
}

interface ParamRow {
  name: string;
  defaultValue: string;
  description?: string;
}

export function ParametersTab({ snapshot }: ParametersTabProps) {
  const params = parseParams(snapshot.parametersFile);

  if (params.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        <div className="space-y-2">
          <SlidersHorizontal className="mx-auto size-8 opacity-50" aria-hidden />
          <p>No externalized parameters yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Externalized parameters</h2>
        <Badge variant="secondary" className="tabular-nums">{params.length}</Badge>
      </div>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Name</th>
              <th scope="col" className="px-3 py-2 font-medium">Default</th>
              <th scope="col" className="px-3 py-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {params.map((p) => (
              <tr key={p.name}>
                <td className="px-3 py-2 font-mono text-xs">{p.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {p.defaultValue || <span className="italic">—</span>}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {p.description ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function parseParams(content?: string | null): ParamRow[] {
  if (!content) return [];
  const out: ParamRow[] = [];
  let pendingComment: string | null = null;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      pendingComment = null;
      continue;
    }
    if (line.startsWith("#")) {
      pendingComment = (pendingComment ? pendingComment + " " : "") + line.slice(1).trim();
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    out.push({
      name: line.slice(0, eq).trim(),
      defaultValue: line.slice(eq + 1).trim(),
      description: pendingComment ?? undefined,
    });
    pendingComment = null;
  }
  return out;
}
