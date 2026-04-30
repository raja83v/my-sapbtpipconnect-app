"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronsUpDown,
  Copy,
  Download,
  FileCode,
  FileOutput,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  Rocket,
  Server,
  Sparkles,
  StopCircle,
  Users,
  Wrench,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AVAILABLE_SECTIONS,
  generateMarkdownExportSync,
  getDocumentTypeTitle,
  type DocumentationType,
  type GeneratedDocument,
  type IFlowDocMetadata,
  type IFlowForDocGenerator,
  type MermaidDiagram,
  type DocumentSectionContent,
} from "@/types/documentation-generator";
import { getIFlowsForDocGenerator } from "@/app/actions/documentation-generator";
import { generateDocx } from "@/lib/docx-export";
import { renderMermaidToPng } from "./mermaid-render";
import {
  DocGeneratorTimeline,
  type TimelinePhase,
} from "./doc-generator-timeline";
import { DocGeneratorSectionCard } from "./doc-generator-section-card";

// ---------------------------------------------------------------------------
// Doc-type catalog
// ---------------------------------------------------------------------------

const DOC_TYPES: Array<{
  type: DocumentationType;
  name: string;
  description: string;
  icon: React.ElementType;
  accent: string;
}> = [
  {
    type: "technical-spec",
    name: "Technical Spec",
    description: "Comprehensive developer-focused documentation",
    icon: FileCode,
    accent: "from-blue-500/15 to-violet-500/15 ring-blue-500/30",
  },
  {
    type: "user-guide",
    name: "User Guide",
    description: "End-user documentation with examples",
    icon: Users,
    accent: "from-emerald-500/15 to-teal-500/15 ring-emerald-500/30",
  },
  {
    type: "ops-runbook",
    name: "Ops Runbook",
    description: "Operational procedures & monitoring",
    icon: Wrench,
    accent: "from-orange-500/15 to-amber-500/15 ring-orange-500/30",
  },
  {
    type: "api-docs",
    name: "API Docs",
    description: "REST/SOAP endpoint specifications",
    icon: Server,
    accent: "from-fuchsia-500/15 to-pink-500/15 ring-fuchsia-500/30",
  },
  {
    type: "deployment-guide",
    name: "Deployment Guide",
    description: "Installation and config guide",
    icon: Rocket,
    accent: "from-cyan-500/15 to-sky-500/15 ring-cyan-500/30",
  },
];

// ---------------------------------------------------------------------------
// SSE event types
// ---------------------------------------------------------------------------

type SSEEvent =
  | { phase: "metadata"; payload: { metadata: IFlowDocMetadata } }
  | {
      phase: "outline";
      payload: { sections: Array<{ id: string; title: string }> };
    }
  | {
      phase: "section.start";
      payload: { sectionId: string; title: string };
    }
  | {
      phase: "section.delta";
      payload: { sectionId: string; delta: string };
    }
  | {
      phase: "section.end";
      payload: { sectionId: string; title: string; content: string };
    }
  | { phase: "diagrams.start"; payload: Record<string, unknown> }
  | { phase: "diagrams"; payload: { diagrams: MermaidDiagram[] } }
  | { phase: "persisted"; payload: { documentId: string | null } }
  | {
      phase: "done";
      payload: {
        tokensUsed: number;
        durationMs: number;
        documentId: string | null;
      };
    }
  | { phase: "error"; payload: { message: string } };

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface DocumentationGeneratorProps {
  tenantId: string;
  iflowId?: string;
}

interface SectionState {
  id: string;
  title: string;
  status: "queued" | "running" | "done" | "failed";
  content: string;
  startedAt?: number;
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DocumentationGenerator({
  tenantId,
  iflowId: initialIflowId,
}: DocumentationGeneratorProps) {
  // -------------------- iFlow selection ----------------------------------
  const [iflows, setIflows] = useState<IFlowForDocGenerator[]>([]);
  const [iflowsLoading, setIflowsLoading] = useState(true);
  const [selectedIflowId, setSelectedIflowId] = useState<string>(
    initialIflowId ?? "",
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  // -------------------- Configuration ------------------------------------
  const [docType, setDocType] = useState<DocumentationType>("technical-spec");
  const [selectedSections, setSelectedSections] = useState<string[]>(
    AVAILABLE_SECTIONS.filter((s) => s.enabled).map((s) => s.id),
  );

  // -------------------- Streaming runtime --------------------------------
  const [tab, setTab] = useState("configure");
  const [running, setRunning] = useState(false);
  const [streamMetadata, setStreamMetadata] =
    useState<IFlowDocMetadata | null>(null);
  const [phases, setPhases] = useState<TimelinePhase[]>([]);
  const [sectionsState, setSectionsState] = useState<SectionState[]>([]);
  const [diagrams, setDiagrams] = useState<MermaidDiagram[]>([]);
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [exportingDocx, setExportingDocx] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  // -------------------- Effects ------------------------------------------
  useEffect(() => {
    void loadIflows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 200);
    return () => clearInterval(t);
  }, [running]);

  // -------------------- Helpers ------------------------------------------
  const loadIflows = async () => {
    setIflowsLoading(true);
    try {
      const result = await getIFlowsForDocGenerator({ tenantId });
      if (result.success && result.data) {
        setIflows(result.data);
      } else {
        toast.error(result.error || "Failed to load iFlows");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load iFlows");
    } finally {
      setIflowsLoading(false);
    }
  };

  const filteredIflows = useMemo(
    () =>
      iflows
        .filter((i) =>
          i.name.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [iflows, search],
  );

  const selectedIflow = useMemo(
    () => iflows.find((i) => i.id === selectedIflowId),
    [iflows, selectedIflowId],
  );

  const toggleSection = (id: string) =>
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );

  // -------------------- SSE parsing & streaming --------------------------
  const handleEvent = useCallback((evt: SSEEvent) => {
    switch (evt.phase) {
      case "metadata": {
        setStreamMetadata(evt.payload.metadata);
        setPhases((p) =>
          completeAndAdd(p, "metadata", "Inspect iFlow", "metadata", "done"),
        );
        break;
      }
      case "outline": {
        const next: SectionState[] = evt.payload.sections.map((s) => ({
          id: s.id,
          title: s.title,
          status: "queued",
          content: "",
        }));
        setSectionsState(next);
        setPhases((p) =>
          completeAndAdd(
            p,
            "outline",
            "Plan sections",
            "outline",
            "done",
            `${evt.payload.sections.length} section${evt.payload.sections.length === 1 ? "" : "s"}`,
          ),
        );
        break;
      }
      case "section.start": {
        const { sectionId, title } = evt.payload;
        setSectionsState((prev) =>
          prev.map((s) =>
            s.id === sectionId
              ? { ...s, status: "running", startedAt: Date.now() }
              : s,
          ),
        );
        setPhases((p) =>
          completeAndAdd(
            p,
            `section:${sectionId}`,
            title,
            "section",
            "running",
          ),
        );
        break;
      }
      case "section.delta": {
        const { sectionId, delta } = evt.payload;
        setSectionsState((prev) =>
          prev.map((s) =>
            s.id === sectionId ? { ...s, content: s.content + delta } : s,
          ),
        );
        break;
      }
      case "section.end": {
        const { sectionId, content } = evt.payload;
        setSectionsState((prev) =>
          prev.map((s) =>
            s.id === sectionId
              ? {
                  ...s,
                  status: "done",
                  content,
                  durationMs: s.startedAt
                    ? Date.now() - s.startedAt
                    : undefined,
                }
              : s,
          ),
        );
        setPhases((p) =>
          markDone(p, `section:${sectionId}`, p.find((x) => x.id === `section:${sectionId}`)?.label),
        );
        break;
      }
      case "diagrams.start": {
        setPhases((p) =>
          completeAndAdd(
            p,
            "diagrams",
            "Generate diagrams",
            "diagrams",
            "running",
          ),
        );
        break;
      }
      case "diagrams": {
        setDiagrams(evt.payload.diagrams ?? []);
        setPhases((p) =>
          markDone(
            p,
            "diagrams",
            `Generate diagrams · ${evt.payload.diagrams?.length ?? 0}`,
          ),
        );
        break;
      }
      case "persisted": {
        // no-op visually for now
        break;
      }
      case "done": {
        setPhases((p) =>
          completeAndAdd(p, "done", "Document ready", "done", "done", undefined),
        );
        break;
      }
      case "error": {
        setErrorMessage(evt.payload.message);
        setPhases((p) =>
          p.length > 0
            ? p.map((x, i) =>
                i === p.length - 1 ? { ...x, status: "failed" } : x,
              )
            : [
                {
                  id: "error",
                  label: "Generation failed",
                  status: "failed",
                  detail: evt.payload.message,
                },
              ],
        );
        break;
      }
    }
  }, []);

  const startGeneration = async () => {
    if (!selectedIflowId) {
      toast.error("Please select an iFlow");
      return;
    }
    if (selectedSections.length === 0) {
      toast.error("Please select at least one section");
      return;
    }
    // Reset state
    setRunning(true);
    setErrorMessage(null);
    setStreamMetadata(null);
    setSectionsState([]);
    setDiagrams([]);
    setGeneratedDoc(null);
    setPhases([
      {
        id: "metadata",
        label: "Inspect iFlow",
        status: "running",
        icon: "metadata",
      },
    ]);
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    setTab("generate");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/ai/doc-generator/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          iflowId: selectedIflowId,
          documentationType: docType,
          sections: selectedSections,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "Unknown error");
        throw new Error(txt || `Request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE messages separated by blank line
        let sepIdx;
        while ((sepIdx = buf.indexOf("\n\n")) !== -1) {
          const raw = buf.slice(0, sepIdx);
          buf = buf.slice(sepIdx + 2);
          for (const line of raw.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trimStart();
            if (!data) continue;
            try {
              const parsed = JSON.parse(data) as SSEEvent;
              handleEvent(parsed);
            } catch (err) {
              console.warn("Bad SSE chunk", err, data);
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        toast.info("Generation cancelled");
      } else {
        const msg = err instanceof Error ? err.message : "Generation failed";
        setErrorMessage(msg);
        toast.error(msg);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const cancelGeneration = () => {
    abortRef.current?.abort();
  };

  // -------------------- Build final GeneratedDocument --------------------
  useEffect(() => {
    if (running) return;
    if (sectionsState.length === 0) return;
    if (!sectionsState.every((s) => s.status === "done" || s.status === "failed"))
      return;

    const sections: DocumentSectionContent[] = sectionsState.map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content,
    }));
    const doc: GeneratedDocument = {
      title: streamMetadata
        ? `${streamMetadata.name} - ${getDocumentTypeTitle(docType)}`
        : `${selectedIflow?.name ?? "iFlow"} - ${getDocumentTypeTitle(docType)}`,
      type: docType,
      iflowName: streamMetadata?.name ?? selectedIflow?.name ?? "",
      version: streamMetadata?.version ?? "1.0.0",
      sections,
      diagrams,
      generatedAt: new Date().toISOString(),
      tokensUsed: 0,
    };
    setGeneratedDoc(doc);
  }, [running, sectionsState, diagrams, streamMetadata, docType, selectedIflow]);

  // -------------------- Export handlers ----------------------------------
  const handleCopyMarkdown = async () => {
    if (!generatedDoc) return;
    await navigator.clipboard.writeText(generateMarkdownExportSync(generatedDoc));
    toast.success("Markdown copied");
  };

  const handleDownloadMarkdown = () => {
    if (!generatedDoc) return;
    const md = generateMarkdownExportSync(generatedDoc);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${generatedDoc.iflowName}-${generatedDoc.type}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Markdown downloaded");
  };

  const handleDownloadDocx = async () => {
    if (!generatedDoc) return;
    setExportingDocx(true);
    try {
      // 1. Collect every mermaid source we need to rasterize:
      //    - the standalone diagrams array
      //    - any ```mermaid code blocks embedded in section markdown
      const mermaidSources = new Set<string>();
      for (const d of generatedDoc.diagrams) {
        if (d.mermaidCode?.trim()) {
          mermaidSources.add(normalizeMermaid(d.mermaidCode));
        }
      }
      for (const s of generatedDoc.sections) {
        for (const code of extractMermaidBlocks(s.content)) {
          mermaidSources.add(normalizeMermaid(code));
        }
      }

      // 2. Rasterize each unique source once.
      const diagramImages = new Map<
        string,
        { data: Uint8Array; widthPx: number; heightPx: number }
      >();
      for (const src of mermaidSources) {
        const png = await renderMermaidToPng(src);
        if (png) {
          diagramImages.set(src, {
            data: png.data,
            widthPx: png.widthPx,
            heightPx: png.heightPx,
          });
        }
      }

      // 3. Pick a cover diagram (prefer flowchart / architecture).
      const cover =
        generatedDoc.diagrams.find(
          (d) => d.type === "flowchart" || d.id.includes("architecture"),
        ) ?? generatedDoc.diagrams[0];
      const coverPng = cover
        ? diagramImages.get(normalizeMermaid(cover.mermaidCode))
        : null;

      const blob = await generateDocx(generatedDoc, {
        coverDiagram: coverPng ?? undefined,
        diagramImages,
      });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${generatedDoc.iflowName} - ${getDocumentTypeTitle(generatedDoc.type)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("DOCX exported");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export DOCX");
    } finally {
      setExportingDocx(false);
    }
  };

  // -------------------- Computed UI --------------------------------------
  const isReady = generatedDoc != null && !running;

  // -------------------- Render -------------------------------------------
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="mt-0.5 size-9"
            aria-label="Back"
          >
            <Link href="/dashboard/ai-agents">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-blue-500 text-white shadow-sm">
                <Sparkles className="size-4" />
              </span>
              Documentation Generator
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Stream a complete technical specification with live progress and export to Markdown or .docx.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList>
          <TabsTrigger value="configure">
            <Workflow className="mr-1.5 size-3.5" />
            Configure
          </TabsTrigger>
          <TabsTrigger value="generate" disabled={!running && phases.length === 0}>
            <Sparkles className="mr-1.5 size-3.5" />
            Generate
            {running && (
              <span className="ml-1.5 size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="export" disabled={!isReady}>
            <FileOutput className="mr-1.5 size-3.5" />
            Export
          </TabsTrigger>
        </TabsList>

        {/* ============ Configure ============ */}
        <TabsContent value="configure" className="space-y-5">
          {/* iFlow selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select iFlow</CardTitle>
              <CardDescription>
                Choose the integration flow to document.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    disabled={iflowsLoading}
                  >
                    <span className="truncate">
                      {iflowsLoading
                        ? "Loading iFlows…"
                        : selectedIflow
                          ? selectedIflow.name
                          : "Select an iFlow…"}
                    </span>
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-(--radix-popover-trigger-width) p-0"
                  align="start"
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search iFlows…"
                      value={search}
                      onValueChange={setSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No iFlows found.</CommandEmpty>
                      <CommandGroup>
                        {filteredIflows.map((i) => (
                          <CommandItem
                            key={i.id}
                            value={i.id}
                            onSelect={() => {
                              setSelectedIflowId(i.id);
                              setPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 size-4",
                                selectedIflowId === i.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <span className="truncate">{i.name}</span>
                            <Badge
                              variant="outline"
                              className="ml-auto text-[10px]"
                            >
                              {i.status}
                            </Badge>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          {/* Document type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Document Type</CardTitle>
              <CardDescription>
                Pick the documentation flavour.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {DOC_TYPES.map((dt) => {
                  const active = docType === dt.type;
                  const Icon = dt.icon;
                  return (
                    <button
                      type="button"
                      key={dt.type}
                      onClick={() => setDocType(dt.type)}
                      className={cn(
                        "group relative flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                        "hover:shadow-md hover:-translate-y-0.5",
                        active
                          ? `bg-linear-to-br ${dt.accent} ring-1 border-transparent shadow-sm`
                          : "border-border bg-card",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg",
                          active
                            ? "bg-background/80 text-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm">
                            {dt.name}
                          </span>
                          {active && (
                            <Check className="size-3.5 text-emerald-600" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {dt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">Sections</CardTitle>
                <CardDescription>
                  Choose which sections to generate. Each is streamed separately.
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelectedSections(AVAILABLE_SECTIONS.map((s) => s.id))
                  }
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSections([])}
                >
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {AVAILABLE_SECTIONS.map((s) => {
                  const checked = selectedSections.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors",
                        checked
                          ? "border-blue-500/40 bg-blue-500/5"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleSection(s.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{s.name}</div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {s.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ Generate ============ */}
        <TabsContent value="generate" className="space-y-5">
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm">
              <AlertCircle className="size-4 mt-0.5 shrink-0 text-red-600" />
              <div className="min-w-0">
                <div className="font-medium text-red-700 dark:text-red-300">
                  Generation failed
                </div>
                <div className="text-red-700/80 dark:text-red-300/80 wrap-anywhere">
                  {errorMessage}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            {/* Timeline rail */}
            <Card className="lg:sticky lg:top-20 h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Pipeline</CardTitle>
                <CardDescription className="text-xs tabular-nums">
                  {running
                    ? `Running · ${(elapsedMs / 1000).toFixed(1)}s`
                    : phases.length > 0
                      ? `Completed · ${(elapsedMs / 1000).toFixed(1)}s`
                      : "Idle"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[60vh] pr-2">
                  {phases.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Press Generate to start.
                    </p>
                  ) : (
                    <DocGeneratorTimeline
                      phases={phases}
                      onPhaseClick={(id) => {
                        const sectionId = id.startsWith("section:")
                          ? id.slice("section:".length)
                          : null;
                        if (!sectionId) return;
                        const el = window.document.getElementById(
                          `section-${sectionId}`,
                        );
                        el?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                    />
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Sections stream */}
            <div className="space-y-3 min-w-0">
              {streamMetadata && (
                <Card>
                  <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                    <Stat label="Steps" value={streamMetadata.totalSteps} />
                    <Stat
                      label="Adapters"
                      value={streamMetadata.adapters.length}
                    />
                    <Stat
                      label="Scripts"
                      value={streamMetadata.scripts.length}
                    />
                    <Stat
                      label="Mappings"
                      value={streamMetadata.mappings.length}
                    />
                  </CardContent>
                </Card>
              )}

              {sectionsState.length === 0 && !running && (
                <Card>
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    No sections yet. Configure and press{" "}
                    <span className="font-medium">Generate</span>.
                  </CardContent>
                </Card>
              )}

              {sectionsState.map((s) => (
                <DocGeneratorSectionCard
                  key={s.id}
                  sectionId={s.id}
                  title={s.title}
                  status={s.status}
                  content={s.content}
                  durationMs={s.durationMs}
                />
              ))}

              {diagrams.length > 0 && !running && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Layers className="size-4 text-violet-500" />
                      Diagrams ({diagrams.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {diagrams.map((d) => (
                      <details
                        key={d.id}
                        className="group rounded-md border p-2"
                      >
                        <summary className="cursor-pointer text-sm font-medium">
                          {d.title}{" "}
                          <span className="text-xs text-muted-foreground font-normal">
                            ({d.type})
                          </span>
                        </summary>
                        <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 text-xs">
                          <code>{d.mermaidCode}</code>
                        </pre>
                      </details>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ============ Export ============ */}
        <TabsContent value="export" className="space-y-5">
          {generatedDoc ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{generatedDoc.title}</CardTitle>
                  <CardDescription>
                    {generatedDoc.sections.length} sections ·{" "}
                    {generatedDoc.diagrams.length} diagrams · generated{" "}
                    {new Date(generatedDoc.generatedAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleDownloadDocx}
                    disabled={exportingDocx}
                  >
                    {exportingDocx ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <Download className="mr-1.5 size-4" />
                    )}
                    Download .docx
                  </Button>
                  <Button variant="outline" onClick={handleDownloadMarkdown}>
                    <FileText className="mr-1.5 size-4" />
                    Download .md
                  </Button>
                  <Button variant="ghost" onClick={handleCopyMarkdown}>
                    <Copy className="mr-1.5 size-4" />
                    Copy markdown
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setTab("configure");
                    }}
                  >
                    <RefreshCw className="mr-1.5 size-4" />
                    New document
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <article className="prose prose-sm dark:prose-invert max-w-none min-w-0 wrap-anywhere prose-pre:my-2 prose-pre:overflow-x-auto prose-table:my-2 prose-table:text-xs">
                    {generatedDoc.sections.map((s) => (
                      <section key={s.id} className="mb-6">
                        <h2 className="mt-0!">{s.title}</h2>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {s.content}
                        </ReactMarkdown>
                      </section>
                    ))}
                  </article>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Generate a document first.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 backdrop-blur-md">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 text-sm min-w-0">
            {running ? (
              <>
                <Loader2 className="size-4 animate-spin text-emerald-500" />
                <span className="font-medium">
                  {phases[phases.length - 1]?.label ?? "Working"}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {(elapsedMs / 1000).toFixed(1)}s
                </span>
              </>
            ) : isReady ? (
              <>
                <Check className="size-4 text-emerald-600" />
                <span className="font-medium">Ready</span>
                <span className="text-muted-foreground">
                  {generatedDoc?.sections.length} sections ·{" "}
                  {generatedDoc?.diagrams.length} diagrams
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {selectedIflow
                  ? `${selectedIflow.name} · ${selectedSections.length} section${selectedSections.length === 1 ? "" : "s"}`
                  : "Select an iFlow to begin"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {running ? (
              <Button
                type="button"
                variant="destructive"
                onClick={cancelGeneration}
              >
                <StopCircle className="mr-1.5 size-4" />
                Cancel
              </Button>
            ) : (
              <>
                {isReady && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadDocx}
                    disabled={exportingDocx}
                  >
                    {exportingDocx ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <Download className="mr-1.5 size-4" />
                    )}
                    .docx
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={startGeneration}
                  disabled={
                    !selectedIflowId || selectedSections.length === 0 || running
                  }
                  className="bg-linear-to-br from-violet-500 to-blue-500 hover:opacity-95"
                >
                  <Sparkles className="mr-1.5 size-4" />
                  {isReady ? "Regenerate" : "Generate"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function normalizeMermaid(code: string): string {
  return code.trim().replace(/\r\n/g, "\n");
}

/** Extract every ```mermaid ... ``` block from a markdown string. */
function extractMermaidBlocks(markdown: string): string[] {
  const out: string[] = [];
  const re = /```mermaid\s*\n([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    if (m[1]?.trim()) out.push(m[1]);
  }
  return out;
}

function completeAndAdd(
  existing: TimelinePhase[],
  id: string,
  label: string,
  icon: TimelinePhase["icon"],
  status: TimelinePhase["status"],
  detail?: string,
): TimelinePhase[] {
  // If the id already exists, update in place; otherwise append.
  // Mark the previously-running phase as done.
  const startedAt = Date.now();
  const updated = existing.map((p) =>
    p.status === "running" && p.id !== id
      ? {
          ...p,
          status: "done" as const,
          durationMs: p.durationMs ?? undefined,
        }
      : p,
  );
  const idx = updated.findIndex((p) => p.id === id);
  if (idx >= 0) {
    updated[idx] = { ...updated[idx], label, status, detail, icon };
    return updated;
  }
  return [
    ...updated,
    {
      id,
      label,
      status,
      icon,
      detail,
      durationMs: undefined,
      // store start in detail when needed via a local map; UI computes elapsed at top
      // For per-phase duration tracking we record via markDone below.
      ...({ _startedAt: startedAt } as object),
    } as TimelinePhase,
  ];
}

function markDone(
  existing: TimelinePhase[],
  id: string,
  label?: string,
): TimelinePhase[] {
  return existing.map((p) =>
    p.id === id
      ? {
          ...p,
          status: "done" as const,
          label: label ?? p.label,
          durationMs:
            (p as TimelinePhase & { _startedAt?: number })._startedAt
              ? Date.now() -
                ((p as TimelinePhase & { _startedAt?: number })._startedAt ?? Date.now())
              : p.durationMs,
        }
      : p,
  );
}
