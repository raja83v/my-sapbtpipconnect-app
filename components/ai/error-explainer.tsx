"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  X,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ErrorExplainerProps {
  messageId: string;
  iflowId: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  litellm: "LiteLLM",
  openai: "OpenAI",
  claude: "Claude",
  gemini: "Google Gemini",
  google: "Google Gemini",
};

export function ErrorExplainer({ messageId, iflowId }: ErrorExplainerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [diagnosis, setDiagnosis] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState("AI");
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/ai/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.config) {
          const provider =
            PROVIDER_LABELS[data.config.provider] || data.config.provider;
          const model = data.config.defaultModel || "";
          setModelLabel(model ? `${provider} · ${model}` : provider);
        }
      })
      .catch(() => {
        /* keep default */
      });
  }, []);

  const stopStreaming = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  };

  const startStreaming = async () => {
    setIsOpen(true);
    setIsStreaming(true);
    setDiagnosis("");
    setError(null);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/ai/diagnose-execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, iflowId }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        let parsed: { error?: string } | null = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          /* ignore */
        }
        throw new Error(
          parsed?.error || `Failed to analyze error (HTTP ${res.status})`,
        );
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream available");
      const decoder = new TextDecoder();

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          setDiagnosis((prev) => prev + chunk);
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to analyze error");
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const close = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsOpen(false);
  };

  const copy = async () => {
    if (!diagnosis) return;
    try {
      await navigator.clipboard.writeText(diagnosis);
      setCopied(true);
      toast.success("Diagnosis copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <>
      <Button
        onClick={startStreaming}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Sparkles className="h-4 w-4 text-violet-500" />
        Explain Error with AI
      </Button>

      {isOpen && (
        <Card className="mt-4 overflow-hidden border-violet-200/60 bg-linear-to-br from-violet-50/80 via-white to-blue-50/60 p-0 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:via-background dark:to-blue-950/20">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-violet-200/50 bg-white/40 px-5 py-4 backdrop-blur dark:border-violet-900/40 dark:bg-background/30">
            <div className="flex min-w-0 items-start gap-3">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-blue-500 shadow-md shadow-violet-500/30">
                <Sparkles className="h-4 w-4 text-white" />
                {isStreaming && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-background" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold leading-5">
                  AI Error Diagnosis
                </h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {isStreaming ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        Streaming response
                      </span>
                      <span className="text-muted-foreground/70">·</span>
                      <span>{modelLabel}</span>
                    </span>
                  ) : diagnosis ? (
                    <span>Analysis complete · {modelLabel}</span>
                  ) : (
                    <span>{modelLabel}</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {diagnosis && !isStreaming && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-xs"
                    onClick={copy}
                    aria-label="Copy diagnosis"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      {copied ? "Copied" : "Copy"}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-xs"
                    onClick={startStreaming}
                    aria-label="Regenerate"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Regenerate</span>
                  </Button>
                </>
              )}
              {isStreaming && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs"
                  onClick={stopStreaming}
                >
                  Stop
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={close}
                className="h-8 w-8"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Body */}
          <CardContent className="min-w-0 overflow-hidden px-5 py-5">
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-2">
                  <p className="font-medium">Couldn&apos;t analyze this error</p>
                  <p className="text-destructive/80">{error}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1 h-7"
                    onClick={startStreaming}
                  >
                    <RefreshCw className="mr-1.5 h-3 w-3" />
                    Try again
                  </Button>
                </div>
              </div>
            )}

            {!error && !diagnosis && isStreaming && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Gathering context from SAP CPI…</span>
                </div>
                <SkeletonLines />
              </div>
            )}

            {diagnosis && (
              <article
                className={cn(
                  "prose prose-sm max-w-none dark:prose-invert",
                  // Force long tokens (URLs, stack traces, base64) to wrap
                  "wrap-anywhere",
                  "prose-headings:scroll-mt-20 prose-headings:font-semibold",
                  "prose-h1:mb-3 prose-h1:mt-1 prose-h1:text-base",
                  "prose-h2:mb-2 prose-h2:mt-5 prose-h2:text-[15px] prose-h2:tracking-tight",
                  "prose-h3:mb-1.5 prose-h3:mt-4 prose-h3:text-sm",
                  "prose-p:my-2 prose-p:leading-relaxed",
                  "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-li:marker:text-muted-foreground",
                  // Inline code – allow break inside long tokens
                  "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-mono prose-code:wrap-break-word prose-code:before:content-[''] prose-code:after:content-['']",
                  // Pre/code blocks – wrap instead of horizontal scroll
                  "prose-pre:rounded-lg prose-pre:border prose-pre:bg-muted/60 prose-pre:p-3 prose-pre:text-xs prose-pre:leading-relaxed prose-pre:whitespace-pre-wrap prose-pre:wrap-break-word",
                  "prose-strong:font-semibold prose-strong:text-foreground",
                  "prose-table:my-3 prose-th:bg-muted/50 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2",
                  "prose-blockquote:border-l-violet-400 prose-blockquote:bg-violet-50/40 prose-blockquote:py-1 prose-blockquote:not-italic dark:prose-blockquote:bg-violet-950/20",
                )}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {diagnosis}
                </ReactMarkdown>
                {isStreaming && (
                  <span
                    className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-violet-500 align-[-2px]"
                    aria-hidden
                  />
                )}
              </article>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function SkeletonLines() {
  return (
    <div className="space-y-2.5" aria-hidden>
      <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
      <div className="h-3 w-full animate-pulse rounded bg-muted" />
      <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
      <div className="h-3 w-4/6 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-3.5 w-1/4 animate-pulse rounded bg-muted" />
      <div className="h-3 w-full animate-pulse rounded bg-muted" />
      <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
    </div>
  );
}
