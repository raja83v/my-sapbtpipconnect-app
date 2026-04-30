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
  IconExternalLink,
  IconCopy,
  IconDownload,
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconArrowRight,
  IconLoader2,
  IconFile,
  IconBrain,
  IconPlayerStop,
  IconBulb,
  IconTarget,
  IconListCheck,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getMessageLogDetail,
  downloadMessageAttachment,
  type GlobalMessageLog,
} from "@/app/actions/message-logs";
import type {
  MessageRunStep,
  MessageAttachment,
  MessageErrorInfo,
} from "@/lib/sap-cpi/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Helper to parse SAP OData date format: /Date(1733580000000)/
function parseSAPDate(dateValue: any): Date | null {
  if (!dateValue) return null;
  if (typeof dateValue === "string") {
    // Handle OData format: /Date(timestamp)/
    const odataMatch = dateValue.match(/\/Date\((\d+)\)\//);
    if (odataMatch) return new Date(parseInt(odataMatch[1], 10));
    // Try parsing as ISO string
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (typeof dateValue === "number") return new Date(dateValue);
  return null;
}

// Format SAP date for display
function formatSAPDate(dateValue: any, formatStr: string): string {
  const date = parseSAPDate(dateValue);
  if (!date) return "—";
  try {
    return format(date, formatStr);
  } catch {
    return "—";
  }
}

interface MessageLogDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageGuid: string | null;
  tenantId?: string;
}

export function MessageLogDetailSheet({
  open,
  onOpenChange,
  messageGuid,
  tenantId,
}: MessageLogDetailSheetProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [log, setLog] = useState<GlobalMessageLog | null>(null);
  const [runSteps, setRunSteps] = useState<MessageRunStep[]>([]);
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [errorInfo, setErrorInfo] = useState<MessageErrorInfo | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // AI diagnosis state with streaming
  const [diagnosis, setDiagnosis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Function to stop streaming
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAnalyzing(false);
  }, []);

  // Function to start streaming AI diagnosis
  const startDiagnosis = useCallback(
    async (
      effectiveTenantId: string,
      messageGuid: string,
      iFlowId: string | null,
      integrationFlowName: string,
      errorMessage: string | null,
    ) => {
      // Reset state
      setDiagnosis("");
      setDiagnosisError(null);
      setIsAnalyzing(true);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/ai/diagnose-error", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tenantId: effectiveTenantId,
            messageGuid,
            iFlowArtifactId: iFlowId,
            iFlowName: integrationFlowName,
            errorMessage,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Read the stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          setDiagnosis((prev) => prev + chunk);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // User cancelled - don't show error
          return;
        }
        setDiagnosisError(
          error instanceof Error ? error.message : "Failed to analyze error",
        );
      } finally {
        setIsAnalyzing(false);
        abortControllerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (open && messageGuid) {
      loadDetails();
    }
  }, [open, messageGuid, tenantId]);

  const loadDetails = async () => {
    if (!messageGuid) return;

    setIsLoading(true);
    // Reset AI diagnosis state when loading new message
    setDiagnosis("");
    setDiagnosisError(null);
    stopStreaming(); // Stop any ongoing streaming

    try {
      const result = await getMessageLogDetail(tenantId, messageGuid);

      if (result.success && result.data) {
        setLog(result.data.log);
        setRunSteps(result.data.runSteps);
        setAttachments(result.data.attachments);
        setErrorInfo(result.data.errorInfo);
        setErrorText(result.data.errorText);
      } else {
        toast.error(result.error || "Failed to load message details");
      }
    } catch (error) {
      console.error("Error loading message details:", error);
      toast.error("Failed to load message details");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleDownloadAttachment = async (attachment: MessageAttachment) => {
    if (!messageGuid) return;

    try {
      const result = await downloadMessageAttachment(
        tenantId,
        messageGuid,
        attachment.Id,
      );

      if (result.success && result.data) {
        // Decode base64 and download
        const byteCharacters = atob(result.data.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.data.contentType });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = attachment.Name;
        link.click();

        toast.success(`Downloaded ${attachment.Name}`);
      } else {
        toast.error(result.error || "Failed to download attachment");
      }
    } catch (error) {
      console.error("Error downloading attachment:", error);
      toast.error("Failed to download attachment");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "COMPLETED":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      case "PROCESSING":
        return <Badge className="bg-blue-500">Processing</Badge>;
      case "RETRY":
        return <Badge className="bg-yellow-500 text-black">Retry</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (startTime: string, endTime: string | null) => {
    if (!endTime) return "In progress";
    const startDate = parseSAPDate(startTime);
    const endDate = parseSAPDate(endTime);
    if (!startDate || !endDate) return "—";
    const duration = endDate.getTime() - startDate.getTime();
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(2)}s`;
    return `${(duration / 60000).toFixed(2)}m`;
  };

  const getStepStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case "COMPLETED":
        return <IconCheck className="h-4 w-4 text-green-500" />;
      case "FAILED":
        return <IconAlertCircle className="h-4 w-4 text-red-500" />;
      case "PROCESSING":
        return <IconLoader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <IconClock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-hidden flex flex-col"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <SheetHeader className="sr-only">
              <SheetTitle>Loading Message Details</SheetTitle>
            </SheetHeader>
            <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : log ? (
          <>
            <SheetHeader className="pr-8">
              <div className="flex items-center gap-3">
                {getStatusBadge(log.status)}
                <SheetTitle className="text-lg truncate">
                  {log.integrationFlowName}
                </SheetTitle>
              </div>
              <SheetDescription className="flex items-center gap-2">
                <span className="font-mono text-xs">{log.messageGuid}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(log.messageGuid, "Message ID")}
                  aria-label="Copy message ID"
                >
                  <IconCopy className="h-4 w-4" />
                </Button>
                {log.alternateWebLink && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => window.open(log.alternateWebLink!, "_blank")}
                    aria-label="Open in SAP CPI"
                  >
                    <IconExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </SheetDescription>
            </SheetHeader>

            <Tabs
              defaultValue="details"
              className="flex-1 flex flex-col overflow-hidden mt-4"
            >
              <TabsList className="w-full justify-start">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="timeline">
                  Timeline
                  {runSteps.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {runSteps.length}
                    </Badge>
                  )}
                </TabsTrigger>
                {(log.status === "FAILED" || errorInfo || errorText) && (
                  <TabsTrigger value="error" className="text-red-500">
                    Error
                  </TabsTrigger>
                )}
                {attachments.length > 0 && (
                  <TabsTrigger value="attachments">
                    Attachments
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {attachments.length}
                    </Badge>
                  </TabsTrigger>
                )}
              </TabsList>

              <ScrollArea className="flex-1 mt-4">
                {/* Details Tab */}
                <TabsContent value="details" className="m-0">
                  <div className="space-y-6">
                    {/* Time Info */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">
                          Execution Time
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Start</span>
                          <span>{formatSAPDate(log.logStart, "PPpp")}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">End</span>
                          <span>
                            {log.logEnd
                              ? formatSAPDate(log.logEnd, "PPpp")
                              : "In progress"}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-medium">
                          <span>Duration</span>
                          <span>
                            {formatDuration(log.logStart, log.logEnd)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Message Info */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">
                          Message Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <DetailRow
                          label="Message GUID"
                          value={log.messageGuid}
                          copyable
                        />
                        {log.correlationId && (
                          <DetailRow
                            label="Correlation ID"
                            value={log.correlationId}
                            copyable
                          />
                        )}
                        {log.transactionId && (
                          <DetailRow
                            label="Transaction ID"
                            value={log.transactionId}
                            copyable
                          />
                        )}
                        {log.applicationMessageId && (
                          <DetailRow
                            label="Application Message ID"
                            value={log.applicationMessageId}
                          />
                        )}
                        {log.applicationMessageType && (
                          <DetailRow
                            label="Message Type"
                            value={log.applicationMessageType}
                          />
                        )}
                      </CardContent>
                    </Card>

                    {/* Routing Info */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">
                          Routing
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">
                              Sender
                            </p>
                            <Badge variant="outline">
                              {log.sender || "Unknown"}
                            </Badge>
                          </div>
                          <IconArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground mb-1">
                              Receiver
                            </p>
                            <Badge variant="outline">
                              {log.receiver || "Unknown"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Additional Info */}
                    {(log.customStatus || log.logLevel) && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">
                            Additional Info
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {log.customStatus && (
                            <DetailRow
                              label="Custom Status"
                              value={log.customStatus}
                            />
                          )}
                          {log.logLevel && (
                            <DetailRow label="Log Level" value={log.logLevel} />
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                {/* Timeline Tab */}
                <TabsContent value="timeline" className="m-0">
                  {runSteps.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <IconClock className="h-8 w-8 mx-auto mb-2" />
                      <p>No run steps available</p>
                      <p className="text-xs mt-1">
                        Run steps may not be available for all messages
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {runSteps.map((step, index) => (
                        <div
                          key={step.RunId}
                          className={cn(
                            "relative pl-6 pb-4",
                            index < runSteps.length - 1 &&
                              "border-l border-border ml-2",
                          )}
                        >
                          <div className="absolute left-0 top-0 -translate-x-1/2 bg-background p-1">
                            {getStepStatusIcon(step.Status)}
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">
                                {step.Activity ||
                                  step.StepId ||
                                  `Step ${index + 1}`}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {step.Status}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p>
                                Started:{" "}
                                {formatSAPDate(step.StepStart, "HH:mm:ss.SSS")}
                              </p>
                              {step.StepStop && (
                                <p>
                                  Duration:{" "}
                                  {formatDuration(
                                    step.StepStart,
                                    step.StepStop,
                                  )}
                                </p>
                              )}
                              {step.Error && (
                                <p className="text-red-500 mt-2">
                                  {step.Error}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Error Tab */}
                <TabsContent value="error" className="m-0">
                  <div className="space-y-4">
                    {/* AI Error Explainer */}
                    <Card className="border-primary/20 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <IconBrain className="h-4 w-4" />
                          AI Error Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {!diagnosis && !isAnalyzing && !diagnosisError && (
                          <Button
                            onClick={() => {
                              if (!log) return;
                              // Use log.tenantId as fallback if tenantId prop is not provided
                              const effectiveTenantId =
                                tenantId || log.tenantId;
                              if (!effectiveTenantId) {
                                setDiagnosisError(
                                  "No tenant ID available. Please select a tenant.",
                                );
                                return;
                              }

                              // Start streaming diagnosis
                              startDiagnosis(
                                effectiveTenantId,
                                log.messageGuid,
                                log.iFlowId,
                                log.integrationFlowName,
                                errorInfo?.Message || errorText,
                              );
                            }}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                          >
                            <IconBrain className="h-4 w-4" />
                            Explain Error with AI
                          </Button>
                        )}
                        {isAnalyzing && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <IconLoader2 className="h-4 w-4 animate-spin" />
                                <span>Analyzing error details...</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={stopStreaming}
                                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                              >
                                <IconPlayerStop className="h-3 w-3 mr-1" />
                                Stop
                              </Button>
                            </div>
                            {/* Show streaming content while loading */}
                            {diagnosis && (
                              <AIAnalysisContent diagnosis={diagnosis} />
                            )}
                          </div>
                        )}
                        {diagnosisError && (
                          <div className="text-sm text-red-500">
                            {diagnosisError}
                            <Button
                              variant="link"
                              size="sm"
                              className="ml-2 p-0 h-auto"
                              onClick={() => {
                                setDiagnosisError(null);
                                setDiagnosis("");
                              }}
                            >
                              Try again
                            </Button>
                          </div>
                        )}
                        {diagnosis && !isAnalyzing && (
                          <div className="space-y-3">
                            <AIAnalysisContent diagnosis={diagnosis} />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDiagnosis("");
                                setDiagnosisError(null);
                              }}
                              className="text-muted-foreground"
                            >
                              Clear analysis
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Error Details - Parse and display error information */}
                    {(() => {
                      // Parse error text to extract structured information
                      const parseErrorText = (text: string | null) => {
                        if (!text) return { message: null, stackTrace: null };

                        // Check if it contains a Java stack trace pattern
                        const stackTracePattern = /\s+at\s+[\w.$]+\([\w.:]+\)/;
                        const hasStackTrace = stackTracePattern.test(text);

                        if (hasStackTrace) {
                          // Split at the first "at " that looks like a stack trace
                          const lines = text.split("\n");
                          const messageLines: string[] = [];
                          const stackLines: string[] = [];
                          let inStackTrace = false;

                          for (const line of lines) {
                            if (!inStackTrace && /^\s+at\s+/.test(line)) {
                              inStackTrace = true;
                            }
                            if (inStackTrace) {
                              stackLines.push(line);
                            } else {
                              messageLines.push(line);
                            }
                          }

                          return {
                            message: messageLines.join("\n").trim() || null,
                            stackTrace: stackLines.join("\n").trim() || null,
                          };
                        }

                        // No stack trace, treat entire text as error message
                        return { message: text.trim(), stackTrace: null };
                      };

                      const parsed = parseErrorText(errorText);

                      // Determine if errorInfo has meaningful data
                      // SAP CPI often returns Type: "text/plain" with empty Message
                      const hasValidErrorInfo =
                        errorInfo &&
                        errorInfo.Message &&
                        errorInfo.Message.trim().length > 0;

                      // Get the best error message to display
                      const errorMessage = hasValidErrorInfo
                        ? errorInfo.Message
                        : parsed.message;

                      // Get error type - prefer meaningful type over "text/plain"
                      const errorType =
                        hasValidErrorInfo && errorInfo.Type !== "text/plain"
                          ? errorInfo.Type
                          : null;

                      return (
                        <>
                          {/* Error Message Card */}
                          {errorMessage && (
                            <Card className="border-red-200 dark:border-red-900">
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium text-red-500">
                                    Error Information
                                  </CardTitle>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      copyToClipboard(
                                        errorMessage,
                                        "Error message",
                                      )
                                    }
                                  >
                                    <IconCopy className="h-3 w-3 mr-1" />
                                    Copy
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {errorType && (
                                  <DetailRow
                                    label="Error Type"
                                    value={errorType}
                                  />
                                )}
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground">
                                    Message
                                  </p>
                                  <pre className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 p-3 rounded whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                                    {errorMessage}
                                  </pre>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Stack Trace Card - Only show if there's an actual Java stack trace */}
                          {parsed.stackTrace && (
                            <Card>
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium">
                                    Stack Trace
                                  </CardTitle>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      copyToClipboard(
                                        parsed.stackTrace!,
                                        "Stack trace",
                                      )
                                    }
                                  >
                                    <IconCopy className="h-3 w-3 mr-1" />
                                    Copy
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <pre className="text-xs bg-muted p-3 rounded whitespace-pre-wrap break-all max-h-96 overflow-y-auto font-mono">
                                  {parsed.stackTrace}
                                </pre>
                              </CardContent>
                            </Card>
                          )}
                        </>
                      );
                    })()}

                    {!errorInfo && !errorText && (
                      <div className="text-center py-8 text-muted-foreground">
                        <IconAlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                        <p>Error details not available</p>
                        <p className="text-xs mt-1">
                          Try using AI Analysis for insights
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Attachments Tab */}
                <TabsContent value="attachments" className="m-0">
                  {attachments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <IconFile className="h-8 w-8 mx-auto mb-2" />
                      <p>No attachments available</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((attachment) => (
                        <Card key={attachment.Id}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <IconFile className="h-8 w-8 text-muted-foreground" />
                                <div>
                                  <p className="font-medium text-sm">
                                    {attachment.Name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {attachment.ContentType}
                                    {attachment.PayloadSize && (
                                      <>
                                        {" "}
                                        ·{" "}
                                        {(
                                          attachment.PayloadSize / 1024
                                        ).toFixed(1)}{" "}
                                        KB
                                      </>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleDownloadAttachment(attachment)
                                }
                              >
                                <IconDownload className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <SheetHeader className="sr-only">
              <SheetTitle>Message Details</SheetTitle>
            </SheetHeader>
            No message selected
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Shared markdown renderer with consistent, well-aligned styling
function MarkdownBody({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // paragraphs — no margin on last one, never inside list items (handled via li)
        p: ({ children }) => (
          <p className="text-sm leading-relaxed text-foreground/80 mb-2 last:mb-0 break-words">
            {children}
          </p>
        ),
        // unordered list
        ul: ({ children }) => (
          <ul className="my-2 space-y-1 pl-0 list-none">{children}</ul>
        ),
        // ordered list — use native decimal counter via padding-left
        ol: ({ children }) => (
          <ol className="my-2 space-y-1 pl-4 list-decimal marker:text-muted-foreground/60 marker:text-xs">
            {children}
          </ol>
        ),
        // list items — flex layout for unordered; inherit for ordered (which gets the ::marker)
        li: ({ children, ...props }) => {
          // detect if we're inside an ol by checking parent node type
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

// Section card used within AIAnalysisContent
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
              <IconChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
            ) : (
              <IconChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
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

// Component to display AI analysis in a structured format
function AIAnalysisContent({ diagnosis }: { diagnosis: string }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    explanation: true,
    rootCause: true,
    solutions: true,
  });

  // Parse the diagnosis into sections — handles multiple AI output styles
  const parseAnalysis = (text: string) => {
    const sections: {
      explanation: string;
      rootCause: string;
      solutions: string;
      other: string;
    } = { explanation: "", rootCause: "", solutions: "", other: "" };

    // Patterns that signal the start of each section (heading or bold label)
    const EXPLANATION_RE =
      /^(#{1,3}\s*)?((\d+[.)]\s*)?(brief\s+)?explanation(\s+of\s+what\s+went\s+wrong)?|what\s+went\s+wrong)\s*:?\s*$/i;
    const ROOT_CAUSE_RE =
      /^(#{1,3}\s*)?(\d+[.)]\s*)?(likely\s+)?root\s+cause(\s+analysis)?\s*:?\s*$/i;
    const SOLUTIONS_RE =
      /^(#{1,3}\s*)?(\d+[.)]\s*)?(suggested\s+)?(solutions?|fix(es)?|next\s+steps?|recommendations?)\s*:?\s*$/i;

    // Also handle bold inline labels like "**Root Cause:**" at start of a line
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
        // If there's inline content after a bold label, keep it
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
  const hasStructuredContent =
    sections.explanation || sections.rootCause || sections.solutions;

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Fallback: plain markdown when no structured sections found
  if (!hasStructuredContent) {
    return (
      <div className="rounded-lg border bg-muted/30 px-4 py-3 w-full min-w-0">
        <MarkdownBody>{diagnosis}</MarkdownBody>
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full min-w-0">
      {sections.explanation && (
        <AnalysisSection
          open={openSections.explanation}
          onOpenChange={(v) => toggle("explanation")}
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
          onOpenChange={(v) => toggle("rootCause")}
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
          onOpenChange={(v) => toggle("solutions")}
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

// Helper component for detail rows
function DetailRow({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="flex justify-between items-start text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="font-mono text-xs text-right max-w-[200px] truncate">
          {value}
        </span>
        {copyable && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => copyToClipboard(value)}
            aria-label={`Copy ${label}`}
          >
            <IconCopy className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
