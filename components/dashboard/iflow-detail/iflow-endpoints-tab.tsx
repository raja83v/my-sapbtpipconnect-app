"use client";

import { useEffect, useState, useTransition } from "react";
import {
  IconRefresh,
  IconExternalLink,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconClipboard,
  IconArrowRight,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  getIFlowEndpoints,
  type IFlowEndpointSummary,
} from "@/app/actions/iflow-testing";
import type { IFlowDetailData } from "@/app/actions/iflows";

interface IFlowEndpointsTabProps {
  iflow: IFlowDetailData;
  onTestEndpoint?: (endpoint: IFlowEndpointSummary) => void;
}

export function IFlowEndpointsTab({ iflow, onTestEndpoint }: IFlowEndpointsTabProps) {
  const [endpoints, setEndpoints] = useState<IFlowEndpointSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const result = await getIFlowEndpoints(iflow.id);
      if (result.success) {
        setEndpoints(result.data ?? []);
        setError(null);
      } else {
        setError(result.error ?? "Failed to load endpoints");
        setEndpoints([]);
      }
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iflow.id]);

  if (iflow.status !== "STARTED") {
    return (
      <Card>
        <CardContent className="py-12">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Endpoints are only available when the iFlow is deployed</EmptyTitle>
              <EmptyDescription>
                Deploy the iFlow to load its callable endpoints from SAP Cloud Integration.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Callable Endpoints</CardTitle>
            <CardDescription>
              Discovered from the deployed integration flow’s service endpoints.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={isPending}>
            <IconRefresh className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            <span className="ml-2 hidden sm:inline">Refresh</span>
          </Button>
        </CardHeader>
        <CardContent>
          {isPending && endpoints === null ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <div
              className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive"
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-center gap-2 font-medium">
                <IconAlertTriangle className="h-4 w-4" /> Failed to load endpoints
              </div>
              <p className="mt-1">{error}</p>
            </div>
          ) : endpoints && endpoints.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Protocol</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>API Definition</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpoints.map((ep) => (
                    <TableRow key={ep.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {ep.protocol}
                          </Badge>
                          {ep.callable ? (
                            <span
                              className="inline-flex items-center text-emerald-600"
                              title="Callable from this UI"
                              aria-label="Callable"
                            >
                              <IconCheck className="h-4 w-4" />
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center text-muted-foreground"
                              title={ep.uncallableReason ?? "Not callable"}
                              aria-label={`Not callable: ${ep.uncallableReason ?? "n/a"}`}
                            >
                              <IconX className="h-4 w-4" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="break-all text-xs bg-secondary px-1.5 py-0.5 rounded">
                            {ep.url}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              navigator.clipboard.writeText(ep.url);
                              toast.success("URL copied to clipboard");
                            }}
                            aria-label="Copy URL"
                          >
                            <IconClipboard className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {ep.uncallableReason && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {ep.uncallableReason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {ep.apiDefinitions.length > 0 ? (
                          <div className="space-y-1">
                            {ep.apiDefinitions.map((d) => (
                              <a
                                key={d.url}
                                href={d.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                              >
                                <IconExternalLink className="h-3 w-3" />
                                {d.type ?? "Definition"}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!ep.callable || !onTestEndpoint}
                          onClick={() => onTestEndpoint?.(ep)}
                        >
                          Test
                          <IconArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No endpoints found</EmptyTitle>
                <EmptyDescription>
                  The deployed iFlow does not expose any service endpoints.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
