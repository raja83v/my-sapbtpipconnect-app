"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check,
  ChevronDown,
  Copy,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

export type SectionCardStatus = "queued" | "running" | "done" | "failed";

interface DocGeneratorSectionCardProps {
  sectionId: string;
  title: string;
  status: SectionCardStatus;
  content: string;
  /** Optional duration when completed (ms). */
  durationMs?: number;
  /** Whether the card is initially expanded. Defaults to true while running. */
  defaultOpen?: boolean;
}

export function DocGeneratorSectionCard({
  sectionId,
  title,
  status,
  content,
  durationMs,
  defaultOpen,
}: DocGeneratorSectionCardProps) {
  const [open, setOpen] = useState<boolean>(
    defaultOpen ?? (status === "running" || status === "done"),
  );
  const [copied, setCopied] = useState(false);

  const charCount = content.length;
  const wordCount =
    content.trim().length > 0 ? content.trim().split(/\s+/).length : 0;

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success(`Copied "${title}"`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <section
      id={`section-${sectionId}`}
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-xl border bg-card transition-shadow",
        status === "running" && "ring-1 ring-emerald-500/30 shadow-sm",
        status === "failed" && "ring-1 ring-red-500/40",
      )}
    >
      <header
        className={cn(
          "flex items-center gap-3 px-4 py-3",
          status === "queued" && "bg-muted/30",
          status === "running" &&
            "bg-linear-to-r from-emerald-500/5 to-transparent",
          status === "done" && "bg-card",
          status === "failed" && "bg-red-500/5",
        )}
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-1",
            status === "queued" &&
              "bg-muted text-muted-foreground ring-border",
            status === "running" &&
              "bg-emerald-500/15 text-emerald-700 ring-emerald-500/40 dark:text-emerald-300",
            status === "done" &&
              "bg-emerald-500/20 text-emerald-700 ring-emerald-500/40 dark:text-emerald-300",
            status === "failed" && "bg-red-500/15 text-red-600 ring-red-500/40",
          )}
        >
          {status === "running" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : status === "done" ? (
            <Check className="size-3" />
          ) : status === "failed" ? (
            "!"
          ) : (
            "•"
          )}
        </span>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 min-w-0 text-left"
        >
          <h3 className="truncate text-sm font-semibold tracking-tight">
            {title}
          </h3>
          {status === "running" && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              streaming…
            </span>
          )}
          {status === "done" && wordCount > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {wordCount} words
              {durationMs ? ` · ${(durationMs / 1000).toFixed(1)}s` : ""}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1">
          {content.length > 0 && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={handleCopy}
              aria-label="Copy section markdown"
              title="Copy section markdown"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-600" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Collapse section" : "Expand section"}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                open && "rotate-180",
              )}
            />
          </Button>
        </div>
      </header>

      {open && (
        <div className="border-t bg-card px-4 py-4">
          {status === "queued" ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert min-w-0 max-w-none wrap-anywhere prose-pre:my-2 prose-pre:overflow-x-auto prose-table:my-2 prose-table:text-xs prose-headings:scroll-mt-24">
              {content.length === 0 && status === "running" ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Waiting for tokens…
                </div>
              ) : (
                <>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content || "_(empty)_"}
                  </ReactMarkdown>
                  {status === "running" && (
                    <span
                      aria-hidden
                      className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-sm bg-emerald-500"
                    />
                  )}
                </>
              )}
              {status === "done" && (
                <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">
                  {charCount.toLocaleString()} characters
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
