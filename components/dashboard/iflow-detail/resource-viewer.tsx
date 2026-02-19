"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconCopy,
  IconCheck,
  IconDownload,
  IconFileCode,
  IconFileText,
  IconFile,
  IconSchema,
  IconTransform,
  IconApi,
  IconBrandJavascript,
  IconBraces,
  IconSettings,
  IconX,
  IconMaximize,
  IconMinimize,
} from "@tabler/icons-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { getIFlowResourceContent } from "@/app/actions/iflows";
import type { IFlowResource } from "@/lib/sap-cpi/client";

interface ResourceViewerProps {
  resource: IFlowResource | null;
  iflowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const resourceTypeConfig: Record<
  string,
  { icon: React.ReactNode; label: string; color: string }
> = {
  script: {
    icon: <IconFileCode className="h-4 w-4" />,
    label: "Groovy Script",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  xslt: {
    icon: <IconTransform className="h-4 w-4" />,
    label: "XSLT Transform",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  schema: {
    icon: <IconSchema className="h-4 w-4" />,
    label: "XML Schema",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  wsdl: {
    icon: <IconApi className="h-4 w-4" />,
    label: "WSDL",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  edmx: {
    icon: <IconApi className="h-4 w-4" />,
    label: "OData Metadata",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  },
  mapping: {
    icon: <IconTransform className="h-4 w-4" />,
    label: "Message Mapping",
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  },
  manifest: {
    icon: <IconSettings className="h-4 w-4" />,
    label: "Manifest",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  },
  bpmn: {
    icon: <IconFileText className="h-4 w-4" />,
    label: "BPMN Flow",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
  jar: {
    icon: <IconFile className="h-4 w-4" />,
    label: "Java Archive",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  properties: {
    icon: <IconBraces className="h-4 w-4" />,
    label: "Properties",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  },
  json: {
    icon: <IconBrandJavascript className="h-4 w-4" />,
    label: "JSON",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  xml: {
    icon: <IconFileText className="h-4 w-4" />,
    label: "XML",
    color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  },
  other: {
    icon: <IconFile className="h-4 w-4" />,
    label: "File",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  },
};

/** Map resource content type to Prism language */
function getLanguage(type: string): string {
  switch (type) {
    case "groovy":
      return "groovy";
    case "javascript":
      return "javascript";
    case "xml":
      return "xml";
    case "json":
      return "json";
    case "properties":
      return "properties";
    default:
      return "text";
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function ResourceViewer({
  resource,
  iflowId,
  open,
  onOpenChange,
}: ResourceViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string>("text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [lineCount, setLineCount] = useState(0);

  const fetchContent = useCallback(
    async (res: IFlowResource) => {
      setLoading(true);
      setError(null);
      setContent(null);
      setLineCount(0);

      try {
        const result = await getIFlowResourceContent(iflowId, res.path);
        if (result.success && result.data) {
          setContent(result.data.content);
          setContentType(result.data.type);
          setLineCount(result.data.content.split("\n").length);
        } else {
          setError(result.error || "Failed to load resource");
        }
      } catch (err) {
        setError("An unexpected error occurred while loading the resource");
      } finally {
        setLoading(false);
      }
    },
    [iflowId]
  );

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setContent(null);
        setError(null);
        setExpanded(false);
        setLineCount(0);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange]
  );

  // Track what we've fetched to avoid re-fetching
  const lastFetchedPath = useRef<string | null>(null);

  // Fetch content when resource changes and sheet opens
  useEffect(() => {
    if (open && resource && resource.path !== lastFetchedPath.current) {
      lastFetchedPath.current = resource.path;
      fetchContent(resource);
    }
    if (!open) {
      lastFetchedPath.current = null;
    }
  }, [open, resource, fetchContent]);

  const handleCopy = useCallback(() => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  const handleDownload = useCallback(() => {
    if (content && resource) {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = resource.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [content, resource]);

  const typeConfig = resource
    ? resourceTypeConfig[resource.type] || resourceTypeConfig.other
    : resourceTypeConfig.other;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className={`flex flex-col p-0 transition-all duration-300 ${
          expanded ? "sm:max-w-[90vw] w-[90vw]" : "sm:max-w-[680px] w-[680px]"
        }`}
      >
        {/* Header */}
        <SheetHeader className="border-b px-6 py-4 space-y-0">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="min-w-0 flex-1">
              <SheetTitle className="flex items-center gap-2 text-base">
                {typeConfig.icon}
                <span className="truncate" title={resource?.name}>
                  {resource?.name || "Resource"}
                </span>
              </SheetTitle>
              <SheetDescription className="mt-1">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {resource?.path}
                </code>
              </SheetDescription>
            </div>
          </div>

          {/* Meta bar */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge
              variant="secondary"
              className={`text-xs ${typeConfig.color}`}
            >
              {typeConfig.label}
            </Badge>
            {resource && (
              <Badge variant="outline" className="text-xs font-mono">
                {formatFileSize(resource.size)}
              </Badge>
            )}
            {lineCount > 0 && (
              <Badge variant="outline" className="text-xs font-mono">
                {lineCount} lines
              </Badge>
            )}

            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded(!expanded)}
                title={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? (
                  <IconMinimize className="h-3.5 w-3.5" />
                ) : (
                  <IconMaximize className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopy}
                disabled={!content}
                title="Copy to clipboard"
              >
                {copied ? (
                  <IconCheck className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <IconCopy className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleDownload}
                disabled={!content}
                title="Download file"
              >
                <IconDownload className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {loading && <ResourceViewerSkeleton />}
          {error && <ResourceViewerError message={error} />}
          {content && !loading && !error && (
            <ScrollArea className="h-full">
              <div className="p-0">
                <SyntaxHighlighter
                  language={getLanguage(contentType)}
                  style={vscDarkPlus}
                  showLineNumbers
                  wrapLines
                  wrapLongLines
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: "0.8125rem",
                    lineHeight: "1.6",
                    minHeight: "100%",
                    background: "hsl(var(--muted) / 0.3)",
                  }}
                  lineNumberStyle={{
                    minWidth: "3em",
                    paddingRight: "1em",
                    color: "hsl(var(--muted-foreground) / 0.4)",
                    userSelect: "none",
                  }}
                >
                  {content}
                </SyntaxHighlighter>
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ResourceViewerSkeleton() {
  return (
    <div className="p-6 space-y-3">
      <div className="flex items-center gap-2 mb-6">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32" />
      </div>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-8 shrink-0" />
          <Skeleton
            className="h-4"
            style={{ width: `${Math.random() * 60 + 20}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function ResourceViewerError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
      <div className="rounded-full bg-destructive/10 p-3 mb-4">
        <IconX className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="text-sm font-semibold mb-1">Unable to Load Resource</h3>
      <p className="text-sm text-muted-foreground max-w-[300px]">{message}</p>
    </div>
  );
}
