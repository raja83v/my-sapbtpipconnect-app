"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  IconCopy,
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconLoader2,
  IconBrain,
  IconPlayerStop,
  IconBulb,
  IconTarget,
  IconListCheck,
  IconApi,
  IconServer,
  IconUser,
  IconArrowRight,
  IconExternalLink,
  IconShieldCheck,
  IconActivity,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getApimLogDetail,
  diagnoseApimError,
  type GlobalAPIMLog,
  type APIMLogDetailResult,
} from "@/app/actions/apim-message-logs";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusBadge(statusCode: number, isError: boolean) {
  if (statusCode >= 200 && statusCode < 300) {
    return (
      <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20 font-mono">
        {statusCode} OK
      </Badge>
    );
  }
  if (statusCode >= 300 && statusCode < 400) {
    return (
      <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20 font-mono">
        {statusCode} Redirect
      </Badge>
    );
  }
  if (statusCode >= 400 && statusCode < 500) {
    return (
      <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20 font-mono">
        {statusCode} Client Error
      </Badge>
    );
  }
  if (statusCode >= 500) {
    return (
      <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20 font-mono">
        {statusCode} Server Error
      </Badge>
    );
  }
  if (isError) {
    return <Badge variant="destructive">Error</Badge>;
  }
  return <Badge variant="outline">{statusCode || "Unknown"}</Badge>;
}

function getMethodBadge(method: string) {
  const colors: Record<string, string> = {
    GET: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
    POST: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
    PUT: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    PATCH:
      "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20",
    DELETE: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
  };
  const colorClass =
    colors[method?.toUpperCase()] || "bg-muted text-muted-foreground";
  return <Badge className={cn("font-mono", colorClass)}>{method || "—"}</Badge>;
}

function formatResponseTime(ms: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DetailRow({
  label,
  value,
  mono = false,
  copyable = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof value === "string") {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground shrink-0 w-36">
        {label}
      </span>
      <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
        <span
          className={cn(
            "text-sm text-right break-all",
            mono && "font-mono text-xs",
          )}
        >
          {value || "—"}
        </span>
        {copyable && typeof value === "string" && value && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={handleCopy}
            aria-label={`Copy ${label}`}
          >
            {copied ? (
              <IconCheck className="h-3 w-3 text-green-500" />
            ) : (
              <IconCopy className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// AI Analysis Components
// ============================================================================

function MarkdownBody({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="text-sm leading-relaxed text-foreground/80 mb-2 last:mb-0 break-words">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="my-2 space-y-1 pl-0 list-none">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2 space-y-1 pl-4 list-decimal marker:text-muted-foreground/60 marker:text-xs">
            {children}
          </ol>
        ),
        li: ({ children, ...props }) => {
          const isOrdered =
            (props as any).node?.parent?.type === "list" &&
            (props as any).node?.parent?.ordered;
          if (isOrdered) {
            return (
              <li className="text-sm leading-relaxed text-foreground/80 break-words pl-1 [&>p]:mb-0 [&>p]:inline">
                {children}
              </li>
            );
          }
          return (
            <li className="flex items-baseline gap-2 text-sm leading-relaxed text-foreground/80 break-words [&>p]:mb-0">
              <span className="mt-[0.4em] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40 self-start" />
              <span className="min-w-0 flex-1">{children}</span>
            </li>
          );
        },
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-foreground/70">{children}</em>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.startsWith("language-");
          if (isBlock) {
            return (
              <code className="block text-xs font-mono leading-relaxed">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground break-all">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="my-2 overflow-x-auto rounded-md border bg-muted/60 p-3 text-xs font-mono leading-relaxed">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-muted-foreground/30 pl-3 text-sm italic text-muted-foreground">
            {children}
          </blockquote>
        ),
        h1: ({ children }) => (
          <h1 className="mb-1.5 mt-3 text-sm font-semibold text-foreground first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-1.5 mt-3 text-sm font-semibold text-foreground first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
            {children}
          </h3>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

function AnalysisSection({
  open,
  onOpenChange,
  accentClass,
  bgClass,
  icon,
  label,
  content,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accentClass: string;
  bgClass: string;
  icon: React.ReactNode;
  label: string;
  content: string;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className={cn("rounded-lg border overflow-hidden", accentClass)}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              bgClass,
            )}
          >
            <span className="shrink-0">{icon}</span>
            <span className="flex-1 text-sm font-semibold">{label}</span>
            {open ? (
              <IconChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <IconChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-4 py-3">
            <MarkdownBody>{content}</MarkdownBody>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function APIMAnalysisContent({ diagnosis }: { diagnosis: string }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    explanation: true,
    rootCause: true,
    solutions: true,
  });

  const parseAnalysis = (text: string) => {
    const sections = {
      explanation: "",
      rootCause: "",
      solutions: "",
      other: "",
    };

    const EXPLANATION_RE =
      /^(#{1,3}\s*)?((\d+[.)]\s*)?(brief\s+)?explanation(\s+of\s+what\s+went\s+wrong)?|what\s+went\s+wrong)\s*:?\s*$/i;
    const ROOT_CAUSE_RE =
      /^(#{1,3}\s*)?(\d+[.)]\s*)?(likely\s+)?root\s+cause(\s+analysis)?\s*:?\s*$/i;
    const SOLUTIONS_RE =
      /^(#{1,3}\s*)?(\d+[.)]\s*)?(suggested\s+)?(solutions?|fix(es)?|next\s+steps?|recommendations?)\s*:?\s*$/i;

    const BOLD_EXPLANATION_RE =
      /^\*{1,2}(brief\s+)?explanation(\s+of\s+what\s+went\s+wrong)?\*{1,2}:?/i;
    const BOLD_ROOT_CAUSE_RE =
      /^\*{1,2}(likely\s+)?root\s+cause(\s+analysis)?\*{1,2}:?/i;
    const BOLD_SOLUTIONS_RE =
      /^\*{1,2}(suggested\s+)?(solutions?|fix(es)?|next\s+steps?|recommendations?)\*{1,2}:?/i;

    const lines = text.split("\n");
    let currentSection: keyof typeof sections = "other";
    let buffer: string[] = [];

    const flushBuffer = () => {
      if (buffer.length > 0) {
        sections[currentSection] += buffer.join("\n") + "\n";
        buffer = [];
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (EXPLANATION_RE.test(trimmed) || BOLD_EXPLANATION_RE.test(trimmed)) {
        flushBuffer();
        currentSection = "explanation";
        const inline = trimmed.replace(/^\*{1,2}[^*]+\*{1,2}:?\s*/, "").trim();
        if (inline) buffer.push(inline);
        continue;
      }

      if (ROOT_CAUSE_RE.test(trimmed) || BOLD_ROOT_CAUSE_RE.test(trimmed)) {
        flushBuffer();
        currentSection = "rootCause";
        const inline = trimmed.replace(/^\*{1,2}[^*]+\*{1,2}:?\s*/, "").trim();
        if (inline) buffer.push(inline);
        continue;
      }

      if (SOLUTIONS_RE.test(trimmed) || BOLD_SOLUTIONS_RE.test(trimmed)) {
        flushBuffer();
        currentSection = "solutions";
        const inline = trimmed.replace(/^\*{1,2}[^*]+\*{1,2}:?\s*/, "").trim();
        if (inline) buffer.push(inline);
        continue;
      }

      buffer.push(line);
    }
    flushBuffer();

    return sections;
  };

  const sections = parseAnalysis(diagnosis);
  const hasStructured =
    sections.explanation || sections.rootCause || sections.solutions;

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!hasStructured) {
    return (
      <div className="rounded-lg border bg-muted/30 px-4 py-3 w-full">
        <MarkdownBody>{diagnosis}</MarkdownBody>
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full">
      {sections.explanation && (
        <AnalysisSection
          open={openSections.explanation}
          onOpenChange={() => toggle("explanation")}
          accentClass="border-blue-200 dark:border-blue-900/60"
          bgClass="bg-blue-50/60 dark:bg-blue-950/30"
          icon={<IconAlertCircle className="h-4 w-4 text-blue-500" />}
          label="What Went Wrong"
          content={sections.explanation.trim()}
        />
      )}
      {sections.rootCause && (
        <AnalysisSection
          open={openSections.rootCause}
          onOpenChange={() => toggle("rootCause")}
          accentClass="border-amber-200 dark:border-amber-900/60"
          bgClass="bg-amber-50/60 dark:bg-amber-950/30"
          icon={<IconTarget className="h-4 w-4 text-amber-500" />}
          label="Root Cause"
          content={sections.rootCause.trim()}
        />
      )}
      {sections.solutions && (
        <AnalysisSection
          open={openSections.solutions}
          onOpenChange={() => toggle("solutions")}
          accentClass="border-green-200 dark:border-green-900/60"
          bgClass="bg-green-50/60 dark:bg-green-950/30"
          icon={<IconListCheck className="h-4 w-4 text-green-500" />}
          label="Suggested Solutions"
          content={sections.solutions.trim()}
        />
      )}
      {sections.other.trim() && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <MarkdownBody>{sections.other.trim()}</MarkdownBody>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Props
// ============================================================================

interface APIMLogDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logId: string | null;
  proxyName: string | null;
  tenantId?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function APIMLogDetailSheet({
  open,
  onOpenChange,
  logId,
  proxyName,
  tenantId,
}: APIMLogDetailSheetProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [detail, setDetail] = useState<APIMLogDetailResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AI diagnosis state
  const [diagnosis, setDiagnosis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAnalyzing(false);
  }, []);

  const startDiagnosis = useCallback(async (log: GlobalAPIMLog) => {
    setDiagnosis("");
    setDiagnosisError(null);
    setIsAnalyzing(true);

    try {
      const result = await diagnoseApimError(
        log.tenantId,
        log.id,
        log.apiProxyName,
        log.statusCode,
        log.errorMessage,
        log.faultCode,
        log.faultSource,
      );

      if (result.success && result.data) {
        setDiagnosis(result.data.diagnosis);
      } else {
        setDiagnosisError(result.error || "Failed to generate diagnosis");
      }
    } catch (err) {
      setDiagnosisError(
        err instanceof Error ? err.message : "Failed to analyze error",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const loadDetails = useCallback(async () => {
    if (!logId || !proxyName) return;

    setIsLoading(true);
    setError(null);
    setDetail(null);
    setDiagnosis("");
    setDiagnosisError(null);
    stopStreaming();

    try {
      const result = await getApimLogDetail(tenantId, logId, proxyName);

      if (result.success && result.data) {
        setDetail(result.data);
      } else {
        setError(result.error || "Failed to load log details");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load log details",
      );
    } finally {
      setIsLoading(false);
    }
  }, [logId, proxyName, tenantId, stopStreaming]);

  useEffect(() => {
    if (open && logId && proxyName) {
      loadDetails();
    }
  }, [open, logId, proxyName]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      stopStreaming();
    }
  }, [open, stopStreaming]);

  const log = detail?.log;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-2xl overflow-hidden flex flex-col"
        aria-label="APIM log details"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <IconApi className="h-5 w-5 text-primary" />
            API Call Details
          </SheetTitle>
          <SheetDescription>
            {log
              ? `${log.method} ${log.apiProxyName}`
              : "Loading API call details…"}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading details…</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center px-4">
              <IconAlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-medium">Failed to load details</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={loadDetails}>
                Try again
              </Button>
            </div>
          </div>
        ) : log ? (
          <div className="flex-1 overflow-hidden">
            {/* Status Summary Bar */}
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg mb-4 border",
                log.isError
                  ? "bg-red-500/10 border-red-500/20"
                  : "bg-green-500/10 border-green-500/20",
              )}
            >
              {getMethodBadge(log.method)}
              {getStatusBadge(log.statusCode, log.isError)}
              <span className="text-sm font-mono text-muted-foreground flex-1 truncate">
                {log.apiProxyName}
              </span>
              <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                <IconClock className="h-3.5 w-3.5" />
                {formatResponseTime(log.responseTime)}
              </div>
            </div>

            <Tabs defaultValue="overview" className="flex flex-col h-full">
              <TabsList className="shrink-0 w-full grid grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="proxy">Proxy Info</TabsTrigger>
                <TabsTrigger
                  value="ai-diagnosis"
                  disabled={!log.isError}
                  className={cn(!log.isError && "opacity-50")}
                >
                  <IconBrain className="h-3.5 w-3.5 mr-1.5" />
                  AI Diagnosis
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-4">
                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-0 space-y-4 px-1">
                  {/* Call Details */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <IconActivity className="h-4 w-4" />
                        Call Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y divide-border/50">
                      <DetailRow label="Log ID" value={log.id} mono copyable />
                      <DetailRow
                        label="Timestamp"
                        value={format(new Date(log.timestamp), "PPpp")}
                      />
                      <DetailRow
                        label="API Proxy"
                        value={log.apiProxyName}
                        copyable
                      />
                      <DetailRow
                        label="HTTP Method"
                        value={getMethodBadge(log.method)}
                      />
                      <DetailRow
                        label="Status Code"
                        value={getStatusBadge(log.statusCode, log.isError)}
                      />
                      <DetailRow
                        label="Response Time"
                        value={formatResponseTime(log.responseTime)}
                        mono
                      />
                      {log.requestSize !== undefined && (
                        <DetailRow
                          label="Request Size"
                          value={formatBytes(log.requestSize)}
                          mono
                        />
                      )}
                      {log.responseSize !== undefined && (
                        <DetailRow
                          label="Response Size"
                          value={formatBytes(log.responseSize)}
                          mono
                        />
                      )}
                    </CardContent>
                  </Card>

                  {/* Client Info */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <IconUser className="h-4 w-4" />
                        Client Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y divide-border/50">
                      {log.clientIP && (
                        <DetailRow
                          label="Client IP"
                          value={log.clientIP}
                          mono
                          copyable
                        />
                      )}
                      {log.developerApp && (
                        <DetailRow
                          label="Developer App"
                          value={log.developerApp}
                          copyable
                        />
                      )}
                      {log.apiProduct && (
                        <DetailRow label="API Product" value={log.apiProduct} />
                      )}
                      {log.region && (
                        <DetailRow label="Environment" value={log.region} />
                      )}
                      {log.proxyRevision && (
                        <DetailRow
                          label="Proxy Revision"
                          value={log.proxyRevision}
                          mono
                        />
                      )}
                    </CardContent>
                  </Card>

                  {/* Error Details (if error) */}
                  {log.isError && (
                    <Card className="border-red-500/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-red-600 dark:text-red-400">
                          <IconAlertCircle className="h-4 w-4" />
                          Error Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="divide-y divide-border/50">
                        {log.faultCode && (
                          <DetailRow
                            label="Fault Code"
                            value={log.faultCode}
                            mono
                            copyable
                          />
                        )}
                        {log.faultSource && (
                          <DetailRow
                            label="Fault Source"
                            value={log.faultSource}
                            mono
                          />
                        )}
                        {log.errorMessage && (
                          <div className="py-2">
                            <span className="text-sm text-muted-foreground block mb-1.5">
                              Error Message
                            </span>
                            <pre className="text-xs font-mono bg-muted/50 rounded p-3 whitespace-pre-wrap break-all">
                              {log.errorMessage}
                            </pre>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Performance Context */}
                  {detail?.performanceContext && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <IconActivity className="h-4 w-4" />
                          Proxy Performance (Last 24h)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="divide-y divide-border/50">
                        <DetailRow
                          label="Total Calls"
                          value={detail.performanceContext.totalCalls.toLocaleString()}
                        />
                        <DetailRow
                          label="Error Rate"
                          value={
                            <span
                              className={cn(
                                "font-mono",
                                detail.performanceContext.errorRate > 10
                                  ? "text-red-600 dark:text-red-400"
                                  : detail.performanceContext.errorRate > 5
                                    ? "text-orange-600 dark:text-orange-400"
                                    : "text-green-600 dark:text-green-400",
                              )}
                            >
                              {detail.performanceContext.errorRate.toFixed(1)}%
                            </span>
                          }
                        />
                        <DetailRow
                          label="Avg Response"
                          value={formatResponseTime(
                            detail.performanceContext.avgResponseTime,
                          )}
                          mono
                        />
                        <DetailRow
                          label="Max Response"
                          value={formatResponseTime(
                            detail.performanceContext.maxResponseTime,
                          )}
                          mono
                        />
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Proxy Info Tab */}
                <TabsContent value="proxy" className="mt-0 space-y-4 px-1">
                  {detail?.proxyDetails ? (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <IconServer className="h-4 w-4" />
                          API Proxy Configuration
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="divide-y divide-border/50">
                        <DetailRow
                          label="Name"
                          value={detail.proxyDetails.name}
                          copyable
                        />
                        <DetailRow
                          label="Title"
                          value={detail.proxyDetails.title}
                        />
                        {detail.proxyDetails.description && (
                          <div className="py-2">
                            <span className="text-sm text-muted-foreground block mb-1.5">
                              Description
                            </span>
                            <p className="text-sm">
                              {detail.proxyDetails.description}
                            </p>
                          </div>
                        )}
                        <DetailRow
                          label="Base Path"
                          value={detail.proxyDetails.basePath}
                          mono
                          copyable
                        />
                        {detail.proxyDetails.virtualHost && (
                          <DetailRow
                            label="Virtual Host"
                            value={detail.proxyDetails.virtualHost}
                            mono
                          />
                        )}
                        <DetailRow
                          label="State"
                          value={
                            <Badge
                              variant={
                                detail.proxyDetails.state === "DEPLOYED"
                                  ? "default"
                                  : "secondary"
                              }
                              className={cn(
                                detail.proxyDetails.state === "DEPLOYED" &&
                                  "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
                              )}
                            >
                              {detail.proxyDetails.state}
                            </Badge>
                          }
                        />
                        {detail.proxyDetails.version && (
                          <DetailRow
                            label="Version"
                            value={detail.proxyDetails.version}
                            mono
                          />
                        )}
                        {detail.proxyDetails.serviceEndPoint && (
                          <DetailRow
                            label="Target Endpoint"
                            value={detail.proxyDetails.serviceEndPoint}
                            mono
                            copyable
                          />
                        )}
                        {detail.proxyDetails.createdBy && (
                          <DetailRow
                            label="Created By"
                            value={detail.proxyDetails.createdBy}
                          />
                        )}
                        {detail.proxyDetails.modifiedBy && (
                          <DetailRow
                            label="Modified By"
                            value={detail.proxyDetails.modifiedBy}
                          />
                        )}
                        {detail.proxyDetails.modifiedAt && (
                          <DetailRow
                            label="Last Modified"
                            value={detail.proxyDetails.modifiedAt}
                          />
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <IconServer className="h-10 w-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Proxy details not available
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* AI Diagnosis Tab */}
                <TabsContent
                  value="ai-diagnosis"
                  className="mt-0 space-y-4 px-1"
                >
                  {log.isError ? (
                    <>
                      {/* Error Summary */}
                      <Card className="border-red-500/20 bg-red-500/5">
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <IconAlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="text-sm font-medium">
                                {log.faultCode ||
                                  `HTTP ${log.statusCode} Error`}
                              </p>
                              {log.errorMessage && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  {log.errorMessage}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* AI Analysis */}
                      {!diagnosis && !isAnalyzing && !diagnosisError && (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                          <IconBrain className="h-10 w-10 text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">
                            Get AI-powered analysis of this error
                          </p>
                          <Button
                            onClick={() => startDiagnosis(log)}
                            className="gap-2"
                          >
                            <IconBrain className="h-4 w-4" />
                            Analyze Error
                          </Button>
                        </div>
                      )}

                      {isAnalyzing && (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                          <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">
                            Analyzing error with AI…
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={stopStreaming}
                            className="gap-2"
                          >
                            <IconPlayerStop className="h-4 w-4" />
                            Stop
                          </Button>
                        </div>
                      )}

                      {diagnosisError && (
                        <Card className="border-destructive/20">
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-3">
                              <IconAlertCircle className="h-5 w-5 text-destructive shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-destructive">
                                  Analysis failed
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {diagnosisError}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-3 gap-2"
                                  onClick={() => startDiagnosis(log)}
                                >
                                  <IconBrain className="h-4 w-4" />
                                  Retry Analysis
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {diagnosis && (
                        <div className="space-y-3">
                          <APIMAnalysisContent diagnosis={diagnosis} />
                          <Separator />
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => startDiagnosis(log)}
                          >
                            <IconBrain className="h-4 w-4" />
                            Re-analyze
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <IconShieldCheck className="h-10 w-10 text-green-500/40 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">
                        No errors to analyze
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        This API call completed successfully
                      </p>
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
