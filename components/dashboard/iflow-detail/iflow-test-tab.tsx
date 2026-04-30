"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  IconRefresh,
  IconPlayerPlay,
  IconSparkles,
  IconAlertTriangle,
  IconHistory,
  IconClock,
  IconCopy,
  IconArrowsExchange,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  generateSampleRequest,
  getEndpointSchema,
  getIFlowEndpoints,
  listIFlowTestRuns,
  runIFlowTest,
  type EndpointSchema,
  type IFlowEndpointSummary,
  type IFlowTestRunRecord,
  type RunIFlowTestOutput,
} from "@/app/actions/iflow-testing";
import type { IFlowDetailData } from "@/app/actions/iflows";

interface IFlowTestTabProps {
  iflow: IFlowDetailData;
  initialEndpoint?: IFlowEndpointSummary | null;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export function IFlowTestTab({ iflow, initialEndpoint = null }: IFlowTestTabProps) {
  const [endpoints, setEndpoints] = useState<IFlowEndpointSummary[]>([]);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(
    initialEndpoint?.id ?? null,
  );
  const [method, setMethod] = useState<string>(initialEndpoint?.defaultMethod ?? "POST");
  const [headersText, setHeadersText] = useState<string>("");
  const [queryText, setQueryText] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [contentType, setContentType] = useState<string>("application/json");

  const [endpointSchema, setEndpointSchema] = useState<EndpointSchema | null>(null);
  const [schemaSelection, setSchemaSelection] = useState<string>("");

  const [response, setResponse] = useState<RunIFlowTestOutput | null>(null);
  const [history, setHistory] = useState<IFlowTestRunRecord[]>([]);
  const [detailRun, setDetailRun] = useState<IFlowTestRunRecord | null>(null);

  const [isLoadingEndpoints, startEndpointsT] = useTransition();
  const [isLoadingSchema, startSchemaT] = useTransition();
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingHistory, startHistoryT] = useTransition();

  const selectedEndpoint = useMemo(
    () => endpoints.find((e) => e.id === selectedEndpointId) ?? null,
    [endpoints, selectedEndpointId],
  );

  const loadEndpoints = () => {
    startEndpointsT(async () => {
      const r = await getIFlowEndpoints(iflow.id);
      if (r.success && r.data) {
        const data = r.data;
        setEndpoints(data);
        if (!selectedEndpointId && data.length > 0) {
          const first = initialEndpoint?.id
            ? data.find((e) => e.id === initialEndpoint.id) ?? data.find((e) => e.callable)
            : data.find((e) => e.callable);
          if (first) {
            setSelectedEndpointId(first.id);
            setMethod(first.defaultMethod);
          }
        }
      } else if (!r.success) {
        toast.error(r.error);
      }
    });
  };

  const loadHistory = () => {
    startHistoryT(async () => {
      const r = await listIFlowTestRuns(iflow.id, 25);
      if (r.success && r.data) setHistory(r.data);
    });
  };

  const loadSchema = (endpoint: IFlowEndpointSummary) => {
    startSchemaT(async () => {
      const r = await getEndpointSchema(iflow.id, endpoint.url);
      if (r.success) {
        setEndpointSchema(r.data ?? null);
      } else {
        setEndpointSchema(null);
      }
    });
  };

  useEffect(() => {
    if (iflow.status === "STARTED") {
      loadEndpoints();
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iflow.id, iflow.status]);

  useEffect(() => {
    if (selectedEndpoint) {
      loadSchema(selectedEndpoint);
      setMethod(selectedEndpoint.defaultMethod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEndpointId]);

  const handleGenerateSample = async () => {
    if (!selectedEndpoint) return;
    const selection: Parameters<typeof generateSampleRequest>[2] = {};
    if (endpointSchema?.schemaKind === "WSDL") selection.operationName = schemaSelection;
    else if (endpointSchema?.schemaKind === "EDMX") selection.entitySetName = schemaSelection;
    else if (endpointSchema?.schemaKind === "OPENAPI") {
      const idx = endpointSchema.meta.openapi?.findIndex(
        (o) => `${o.method}|${o.path}` === schemaSelection,
      );
      if (idx !== undefined && idx >= 0) selection.openapiIndex = idx;
    }
    const r = await generateSampleRequest(iflow.id, selectedEndpoint.url, selection);
    if (r.success && r.data) {
      const data = r.data;
      setBody(data.body);
      setContentType(data.contentType);
      setMethod(data.method);
      if (data.hints?.length) toast.info(data.hints[0]);
    } else if (!r.success) {
      toast.error(r.error);
    }
  };

  const handleRun = async () => {
    if (!selectedEndpoint) return;
    setIsRunning(true);
    setResponse(null);
    try {
      const headers = parseKeyValueLines(headersText);
      const query = parseKeyValueLines(queryText);
      const r = await runIFlowTest({
        iFlowDbId: iflow.id,
        endpointUrl: selectedEndpoint.url,
        method,
        headers,
        query,
        body: body || undefined,
        contentType,
      });
      if (r.success && r.data) {
        const data = r.data;
        setResponse(data);
        loadHistory();
        if (data.errorMessage) toast.error(data.errorMessage);
        else toast.success(`Status ${data.status} in ${data.durationMs} ms`);
      } else if (!r.success) {
        toast.error(r.error);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const loadFromHistory = (run: IFlowTestRunRecord) => {
    const ep = endpoints.find((e) => e.url === run.endpointUrl);
    if (ep) setSelectedEndpointId(ep.id);
    setMethod(run.httpMethod);
    setBody(run.requestBody ?? "");
    setContentType(run.requestContentType ?? "application/json");
    setHeadersText(serializeKeyValueLines(run.requestHeaders));
    setQueryText(serializeKeyValueLines(run.requestQuery));
  };

  if (iflow.status !== "STARTED") {
    return (
      <Card>
        <CardContent className="py-12">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Test runner is only available when deployed</EmptyTitle>
              <EmptyDescription>
                Deploy the iFlow first, then return to this tab to invoke its endpoints.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      {/* Request panel */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Send request</CardTitle>
            <CardDescription>
              Invoke the deployed iFlow endpoint via the server-side proxy.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadEndpoints} disabled={isLoadingEndpoints}>
            <IconRefresh className={`h-4 w-4 ${isLoadingEndpoints ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Endpoint + method */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="endpoint-select">Endpoint</Label>
              <Select
                value={selectedEndpointId ?? undefined}
                onValueChange={(v) => setSelectedEndpointId(v)}
              >
                <SelectTrigger id="endpoint-select">
                  <SelectValue placeholder="Select an endpoint" />
                </SelectTrigger>
                <SelectContent>
                  {endpoints.map((e) => (
                    <SelectItem key={e.id} value={e.id} disabled={!e.callable}>
                      <span className="font-mono text-xs mr-2">[{e.protocol}]</span>
                      <span className="truncate">{e.url}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="method-select">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="method-select" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Schema picker + generate */}
          {selectedEndpoint && (
            <div className="rounded-md border p-3 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{endpointSchema?.schemaKind ?? "—"}</Badge>
                  {isLoadingSchema && <Spinner className="size-3" />}
                </div>
                <Button size="sm" variant="secondary" onClick={handleGenerateSample}>
                  <IconSparkles className="h-3.5 w-3.5 mr-1.5" />
                  Generate sample
                </Button>
              </div>
              {endpointSchema?.schemaKind === "WSDL" && endpointSchema.meta.soap && (
                <Select value={schemaSelection} onValueChange={setSchemaSelection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose operation…" />
                  </SelectTrigger>
                  <SelectContent>
                    {endpointSchema.meta.soap.operations.map((o) => (
                      <SelectItem key={o.name} value={o.name}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {endpointSchema?.schemaKind === "EDMX" && endpointSchema.meta.odata && (
                <Select value={schemaSelection} onValueChange={setSchemaSelection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose entity set…" />
                  </SelectTrigger>
                  <SelectContent>
                    {endpointSchema.meta.odata.entitySets.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {endpointSchema?.schemaKind === "OPENAPI" && endpointSchema.meta.openapi && (
                <Select value={schemaSelection} onValueChange={setSchemaSelection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose operation…" />
                  </SelectTrigger>
                  <SelectContent>
                    {endpointSchema.meta.openapi.map((o) => (
                      <SelectItem key={`${o.method}|${o.path}`} value={`${o.method}|${o.path}`}>
                        <span className="font-mono text-xs mr-2">{o.method}</span>
                        {o.path}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <Tabs defaultValue="body">
            <TabsList>
              <TabsTrigger value="body">Body</TabsTrigger>
              <TabsTrigger value="headers">Headers</TabsTrigger>
              <TabsTrigger value="query">Query</TabsTrigger>
            </TabsList>
            <TabsContent value="body" className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="content-type" className="shrink-0">
                  Content-Type
                </Label>
                <Input
                  id="content-type"
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="max-w-xs"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Request body…"
                className="min-h-[260px] font-mono text-xs"
                spellCheck={false}
              />
            </TabsContent>
            <TabsContent value="headers">
              <Textarea
                value={headersText}
                onChange={(e) => setHeadersText(e.target.value)}
                placeholder={"One per line, e.g.\nX-My-Header: value"}
                className="min-h-[260px] font-mono text-xs"
                spellCheck={false}
              />
            </TabsContent>
            <TabsContent value="query">
              <Textarea
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder={"One per line, e.g.\n$top: 10"}
                className="min-h-[260px] font-mono text-xs"
                spellCheck={false}
              />
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              onClick={handleRun}
              disabled={!selectedEndpoint || !selectedEndpoint.callable || isRunning}
            >
              {isRunning ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  Sending…
                </>
              ) : (
                <>
                  <IconPlayerPlay className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Response + history */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Response</CardTitle>
            <CardDescription>
              {response
                ? `${response.status ?? "—"} • ${response.durationMs} ms`
                : "No request sent yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {response?.errorMessage && (
              <div
                className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive"
                role="alert"
                aria-live="polite"
              >
                <div className="flex items-center gap-2 font-medium">
                  <IconAlertTriangle className="h-4 w-4" />
                  Error
                </div>
                <p className="mt-1 whitespace-pre-wrap">{response.errorMessage}</p>
              </div>
            )}
            {response && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {response.status !== null && (
                    <Badge variant={response.status < 400 ? "default" : "destructive"}>
                      HTTP {response.status}
                    </Badge>
                  )}
                  {response.bodyTruncated && <Badge variant="outline">Truncated</Badge>}
                  {response.messageGuid && (
                    <Badge variant="secondary" className="font-mono">
                      MPL: {response.messageGuid.slice(0, 8)}…
                    </Badge>
                  )}
                </div>
                <Tabs defaultValue="body">
                  <TabsList>
                    <TabsTrigger value="body">Body</TabsTrigger>
                    <TabsTrigger value="headers">Headers</TabsTrigger>
                  </TabsList>
                  <TabsContent value="body">
                    <pre className="rounded-md border bg-muted p-3 font-mono text-xs overflow-auto max-h-[260px] whitespace-pre">
                      {formatPayload(
                        response.responseBody,
                        response.responseHeaders?.["content-type"] ??
                          response.responseHeaders?.["Content-Type"],
                      ) || "(empty)"}
                    </pre>
                  </TabsContent>
                  <TabsContent value="headers">
                    <pre className="rounded-md border bg-muted p-3 text-xs overflow-auto max-h-[260px]">
                      {Object.entries(response.responseHeaders)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join("\n")}
                    </pre>
                  </TabsContent>
                </Tabs>
              </>
            )}
            {!response && !isRunning && (
              <p className="text-sm text-muted-foreground">
                Configure a request and press Send.
              </p>
            )}
            {isRunning && <Skeleton className="h-32 w-full" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconHistory className="h-4 w-4" />
                History
              </CardTitle>
              <CardDescription>Last 25 runs for this iFlow.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={loadHistory} disabled={isLoadingHistory}>
              <IconRefresh className={`h-4 w-4 ${isLoadingHistory ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No runs yet.</p>
            ) : (
              <ul className="divide-y" role="list">
                {history.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-accent focus-visible:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setDetailRun(r)}
                      aria-label={`View details for ${r.httpMethod} ${r.endpointUrl}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge
                            variant={
                              r.responseStatus && r.responseStatus < 400
                                ? "default"
                                : "destructive"
                            }
                            className="font-mono text-xs"
                          >
                            {r.httpMethod} {r.responseStatus ?? "ERR"}
                          </Badge>
                          <span className="truncate text-xs">{r.endpointUrl}</span>
                        </div>
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1 shrink-0">
                          <IconClock className="h-3 w-3" />
                          {formatDistanceToNow(r.executedAt, { addSuffix: true })}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <RunDetailDialog
        run={detailRun}
        onOpenChange={(open) => !open && setDetailRun(null)}
        onLoadIntoEditor={(r) => {
          loadFromHistory(r);
          setDetailRun(null);
          toast.success("Loaded into editor");
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run detail dialog
// ---------------------------------------------------------------------------

interface RunDetailDialogProps {
  run: IFlowTestRunRecord | null;
  onOpenChange: (open: boolean) => void;
  onLoadIntoEditor: (run: IFlowTestRunRecord) => void;
}

function RunDetailDialog({ run, onOpenChange, onLoadIntoEditor }: RunDetailDialogProps) {
  const open = Boolean(run);
  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {run && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Badge
                  variant={
                    run.responseStatus && run.responseStatus < 400
                      ? "default"
                      : "destructive"
                  }
                  className="font-mono"
                >
                  {run.httpMethod} {run.responseStatus ?? "ERR"}
                </Badge>
                <span className="text-sm font-normal text-muted-foreground">
                  {run.durationMs != null ? `${run.durationMs} ms` : "—"}
                </span>
              </DialogTitle>
              <DialogDescription className="break-all font-mono text-xs">
                {run.endpointUrl}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <DetailGrid
                items={[
                  { label: "Executed at", value: format(run.executedAt, "PPpp") },
                  { label: "Protocol", value: run.protocol },
                  { label: "Content-Type", value: run.requestContentType ?? "—" },
                  {
                    label: "Trace",
                    value: run.traceWasEnabled ? "Enabled" : "Off",
                  },
                  {
                    label: "Message GUID",
                    value: run.messageGuid ?? "—",
                    copyable: run.messageGuid ?? null,
                    mono: true,
                  },
                  {
                    label: "Correlation ID",
                    value: run.correlationId ?? "—",
                    copyable: run.correlationId ?? null,
                    mono: true,
                  },
                  {
                    label: "SAP Message ID",
                    value: run.applicationMessageId ?? "—",
                    copyable: run.applicationMessageId ?? null,
                    mono: true,
                  },
                ]}
                onCopy={copy}
              />

              {run.errorMessage && (
                <div
                  className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive"
                  role="alert"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <IconAlertTriangle className="h-4 w-4" />
                    Error
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{run.errorMessage}</p>
                </div>
              )}

              <Tabs defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">Request</TabsTrigger>
                  <TabsTrigger value="response">Response</TabsTrigger>
                </TabsList>
                <TabsContent value="request" className="space-y-3">
                  <PayloadBlock
                    title="Body"
                    text={run.requestBody}
                    contentType={run.requestContentType}
                    onCopy={(t) => copy("Request body", t)}
                  />
                  <KvBlock
                    title="Headers"
                    data={run.requestHeaders}
                    onCopy={(t) => copy("Request headers", t)}
                  />
                  <KvBlock
                    title="Query"
                    data={run.requestQuery}
                    onCopy={(t) => copy("Query", t)}
                  />
                </TabsContent>
                <TabsContent value="response" className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {run.responseStatus !== null && (
                      <Badge
                        variant={run.responseStatus < 400 ? "default" : "destructive"}
                      >
                        HTTP {run.responseStatus}
                      </Badge>
                    )}
                    {run.responseTruncated && <Badge variant="outline">Truncated</Badge>}
                    {run.responseContentType && (
                      <Badge variant="secondary" className="font-mono">
                        {run.responseContentType}
                      </Badge>
                    )}
                  </div>
                  <PayloadBlock
                    title="Body"
                    text={run.responseBody}
                    contentType={run.responseContentType}
                    onCopy={(t) => copy("Response body", t)}
                  />
                  <KvBlock
                    title="Headers"
                    data={run.responseHeaders}
                    onCopy={(t) => copy("Response headers", t)}
                  />
                </TabsContent>
              </Tabs>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => onLoadIntoEditor(run)}>
                <IconArrowsExchange className="mr-2 h-4 w-4" />
                Load into editor
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DetailGridItem {
  label: string;
  value: string;
  copyable?: string | null;
  mono?: boolean;
}

function DetailGrid({
  items,
  onCopy,
}: {
  items: DetailGridItem[];
  onCopy: (label: string, text: string) => void;
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline gap-2">
          <dt className="w-28 shrink-0 text-muted-foreground">{it.label}</dt>
          <dd
            className={`min-w-0 flex-1 truncate ${it.mono ? "font-mono" : ""}`}
            title={it.value}
          >
            {it.value}
          </dd>
          {it.copyable && (
            <button
              type="button"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onCopy(it.label, it.copyable!)}
              aria-label={`Copy ${it.label}`}
            >
              <IconCopy className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </dl>
  );
}

function PayloadBlock({
  title,
  text,
  contentType,
  onCopy,
}: {
  title: string;
  text: string | null;
  contentType?: string | null;
  onCopy: (text: string) => void;
}) {
  const formatted = formatPayload(text, contentType);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{title}</Label>
        {formatted && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onCopy(formatted)}
          >
            <IconCopy className="h-3.5 w-3.5" />
            Copy
          </Button>
        )}
      </div>
      <pre className="max-h-72 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs whitespace-pre">
        {formatted || "(empty)"}
      </pre>
    </div>
  );
}

function KvBlock({
  title,
  data,
  onCopy,
}: {
  title: string;
  data: Record<string, string> | null;
  onCopy: (text: string) => void;
}) {
  const text =
    data && Object.keys(data).length > 0
      ? Object.entries(data)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")
      : "";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{title}</Label>
        {text && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onCopy(text)}
          >
            <IconCopy className="h-3.5 w-3.5" />
            Copy
          </Button>
        )}
      </div>
      <pre className="max-h-48 overflow-auto rounded-md border bg-muted p-3 text-xs">
        {text || "(none)"}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseKeyValueLines(text: string): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf(":");
      if (idx > 0) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k) out[k] = v;
      }
    });
  return Object.keys(out).length > 0 ? out : undefined;
}

function serializeKeyValueLines(obj: Record<string, string> | null): string {
  if (!obj) return "";
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

/**
 * Pretty-print a payload for display. Detects XML/JSON either from the
 * Content-Type header or from the body itself, and falls back to the
 * original text if parsing fails.
 */
function formatPayload(text: string | null, contentType?: string | null): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (!trimmed) return text;
  const ct = (contentType ?? "").toLowerCase();
  const looksJson = /json/.test(ct) || /^[[{]/.test(trimmed);
  const looksXml = /xml|html|soap/.test(ct) || /^<\?xml|^<[a-zA-Z]/.test(trimmed);
  if (looksJson) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      // fall through
    }
  }
  if (looksXml) {
    try {
      return formatXml(trimmed);
    } catch {
      // fall through
    }
  }
  return text;
}

/**
 * Indent an XML/SOAP string. Pure-string formatter — no DOM dependency so it
 * works in both server and client components. Preserves CDATA blocks.
 */
function formatXml(xml: string): string {
  // Protect CDATA sections so we don't mangle their contents.
  const cdataChunks: string[] = [];
  let work = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (m) => {
    cdataChunks.push(m);
    return `\u0000CDATA${cdataChunks.length - 1}\u0000`;
  });

  // Strip whitespace between tags so we control indentation.
  work = work.replace(/>\s+</g, "><").trim();
  // Ensure a newline before every tag.
  work = work.replace(/></g, ">\n<");

  const lines = work.split("\n");
  const out: string[] = [];
  let depth = 0;
  const INDENT = "  ";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const isClosing = /^<\//.test(line);
    const isDeclaration = /^<\?|^<!/.test(line);
    const isSelfClosing = /\/>$/.test(line) || isDeclaration;
    const isOpenAndClose = /^<([^!?\s>/]+)(\s[^>]*)?>.*<\/\1>$/.test(line);

    if (isClosing) depth = Math.max(0, depth - 1);
    out.push(INDENT.repeat(depth) + line);
    if (!isClosing && !isSelfClosing && !isOpenAndClose) depth += 1;
  }

  let result = out.join("\n");
  // Restore CDATA placeholders.
  result = result.replace(/\u0000CDATA(\d+)\u0000/g, (_m, i) => cdataChunks[Number(i)]);
  return result;
}
