"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IFlowDesign } from "@/components/ai/v2/specialized/iflow-creator/types";

interface ComponentsTabProps {
  design: IFlowDesign | null;
}

interface Group {
  key: string;
  label: string;
  items: { id: string; name: string; type?: string; details?: Record<string, unknown> }[];
}

export function ComponentsTab({ design }: ComponentsTabProps) {
  const groups = useMemo<Group[]>(() => buildGroups(design), [design]);

  if (!design) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        <div className="space-y-2">
          <Layers className="mx-auto size-8 opacity-50" aria-hidden />
          <p>Components will appear once the design is ready.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {groups.map((g) => (
        <ComponentGroup key={g.key} group={g} />
      ))}
    </div>
  );
}

function ComponentGroup({ group }: { group: Group }) {
  const [open, setOpen] = useState(true);
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <Card className="overflow-hidden p-0">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="flex h-auto w-full items-center justify-between gap-2 rounded-none border-b px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4" aria-hidden />
          {group.label}
        </span>
        <Badge variant="secondary" className="tabular-nums">
          {group.items.length}
        </Badge>
      </Button>
      {open && (
        <ul className={cn("divide-y", group.items.length === 0 && "p-3 text-xs text-muted-foreground")}>
          {group.items.length === 0 && <li>No items.</li>}
          {group.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                {item.type && (
                  <p className="text-xs text-muted-foreground">{item.type}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function buildGroups(d: IFlowDesign | null): Group[] {
  if (!d) return [];
  const groups: Group[] = [];
  const push = (key: string, label: string, arr?: unknown[]) => {
    const a = Array.isArray(arr) ? arr : [];
    groups.push({
      key,
      label,
      items: a.map((x, i) => {
        const obj = x as Record<string, unknown>;
        return {
          id: String(obj.id ?? `${key}-${i}`),
          name: String(obj.name ?? obj.id ?? `${label} #${i + 1}`),
          type: obj.type ? String(obj.type) : undefined,
        };
      }),
    });
  };

  push("adapters", "Adapters", d.adapters);
  push("mappings", "Mappings", d.mappings);
  push("scripts", "Scripts", d.scripts);
  push("contentModifiers", "Content modifiers", d.contentModifiers);
  push("routers", "Routers", d.routers);
  push("splitters", "Splitters", d.splitters);
  push("gathers", "Gathers", d.gathers);
  push("multicasts", "Multicasts", d.multicasts);
  push("aggregators", "Aggregators", d.aggregators);
  push("requestReplies", "External calls", d.requestReplies);
  push("localProcesses", "Local processes", d.localProcesses);
  push("exceptionSubprocesses", "Exception subprocesses", d.exceptionSubprocesses);

  return groups.filter((g) => g.items.length > 0);
}
