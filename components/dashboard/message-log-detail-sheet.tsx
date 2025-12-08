"use client";

import React, { useState, useEffect } from "react";
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
} from "@tabler/icons-react";
import { 
    getMessageLogDetail, 
    downloadMessageAttachment,
    diagnoseMessageLogError,
    type GlobalMessageLog,
} from "@/app/actions/message-logs";
import type { MessageRunStep, MessageAttachment, MessageErrorInfo } from "@/lib/sap-cpi/client";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

// Helper to parse SAP OData date format: /Date(1733580000000)/
function parseSAPDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    if (typeof dateValue === 'string') {
        // Handle OData format: /Date(timestamp)/
        const odataMatch = dateValue.match(/\/Date\((\d+)\)\//);
        if (odataMatch) return new Date(parseInt(odataMatch[1], 10));
        // Try parsing as ISO string
        const parsed = new Date(dateValue);
        if (!isNaN(parsed.getTime())) return parsed;
    }
    if (typeof dateValue === 'number') return new Date(dateValue);
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
    
    // AI diagnosis state
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [diagnosis, setDiagnosis] = useState<string | null>(null);
    const [diagnosisError, setDiagnosisError] = useState<string | null>(null);

    useEffect(() => {
        if (open && messageGuid) {
            loadDetails();
        }
    }, [open, messageGuid, tenantId]);

    const loadDetails = async () => {
        if (!messageGuid) return;

        setIsLoading(true);
        // Reset AI diagnosis state when loading new message
        setDiagnosis(null);
        setDiagnosisError(null);
        setIsAnalyzing(false);
        
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
            const result = await downloadMessageAttachment(tenantId, messageGuid, attachment.Id);

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
            <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
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
                                    className="h-6 w-6"
                                    onClick={() => copyToClipboard(log.messageGuid, "Message ID")}
                                >
                                    <IconCopy className="h-3 w-3" />
                                </Button>
                                {log.alternateWebLink && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => window.open(log.alternateWebLink!, "_blank")}
                                    >
                                        <IconExternalLink className="h-3 w-3" />
                                    </Button>
                                )}
                            </SheetDescription>
                        </SheetHeader>

                        <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden mt-4">
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
                                                            : "In progress"
                                                        }
                                                    </span>
                                                </div>
                                                <Separator />
                                                <div className="flex justify-between text-sm font-medium">
                                                    <span>Duration</span>
                                                    <span>{formatDuration(log.logStart, log.logEnd)}</span>
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
                                                        <p className="text-xs text-muted-foreground mb-1">Sender</p>
                                                        <Badge variant="outline">
                                                            {log.sender || "Unknown"}
                                                        </Badge>
                                                    </div>
                                                    <IconArrowRight className="h-4 w-4 text-muted-foreground" />
                                                    <div className="text-center">
                                                        <p className="text-xs text-muted-foreground mb-1">Receiver</p>
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
                                                        <DetailRow 
                                                            label="Log Level" 
                                                            value={log.logLevel}
                                                        />
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
                                                        index < runSteps.length - 1 && "border-l border-border ml-2"
                                                    )}
                                                >
                                                    <div className="absolute left-0 top-0 -translate-x-1/2 bg-background p-1">
                                                        {getStepStatusIcon(step.Status)}
                                                    </div>
                                                    <div className="bg-muted/50 rounded-lg p-3">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-medium text-sm">
                                                                {step.Activity || step.StepId || `Step ${index + 1}`}
                                                            </span>
                                                            <Badge variant="outline" className="text-xs">
                                                                {step.Status}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground space-y-1">
                                                            <p>
                                                                Started: {formatSAPDate(step.StepStart, "HH:mm:ss.SSS")}
                                                            </p>
                                                            {step.StepStop && (
                                                                <p>
                                                                    Duration: {formatDuration(step.StepStart, step.StepStop)}
                                                                </p>
                                                            )}
                                                            {step.Error && (
                                                                <p className="text-red-500 mt-2">{step.Error}</p>
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
                                                        onClick={async () => {
                                                            if (!log) return;
                                                            setIsAnalyzing(true);
                                                            setDiagnosis(null);
                                                            setDiagnosisError(null);
                                                            try {
                                                                const result = await diagnoseMessageLogError(
                                                                    tenantId,
                                                                    log.messageGuid,
                                                                    log.iFlowId,
                                                                    log.integrationFlowName,
                                                                    errorInfo?.Message || errorText
                                                                );
                                                                if (result.success && result.data) {
                                                                    setDiagnosis(result.data.diagnosis);
                                                                } else {
                                                                    setDiagnosisError(result.error || "Failed to analyze error");
                                                                }
                                                            } catch (err) {
                                                                setDiagnosisError(err instanceof Error ? err.message : "Failed to analyze error");
                                                            } finally {
                                                                setIsAnalyzing(false);
                                                            }
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
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <IconLoader2 className="h-4 w-4 animate-spin" />
                                                        <span>Analyzing error details...</span>
                                                    </div>
                                                )}
                                                {diagnosisError && (
                                                    <div className="text-sm text-red-500">
                                                        {diagnosisError}
                                                        <Button
                                                            variant="link"
                                                            size="sm"
                                                            className="ml-2 p-0 h-auto"
                                                            onClick={() => setDiagnosisError(null)}
                                                        >
                                                            Try again
                                                        </Button>
                                                    </div>
                                                )}
                                                {diagnosis && (
                                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                                        <ReactMarkdown>{diagnosis}</ReactMarkdown>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        {/* Error Details */}
                                        {errorInfo && (
                                            <Card className="border-red-200 dark:border-red-900">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm font-medium text-red-500">
                                                        Error Information
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-3">
                                                    <DetailRow 
                                                        label="Error Type" 
                                                        value={errorInfo.Type}
                                                    />
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground">Message</p>
                                                        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                                                            {errorInfo.Message}
                                                        </p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}

                                        {/* Error Stack Trace */}
                                        {errorText && (
                                            <Card>
                                                <CardHeader className="pb-2">
                                                    <div className="flex items-center justify-between">
                                                        <CardTitle className="text-sm font-medium">
                                                            Stack Trace
                                                        </CardTitle>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyToClipboard(errorText, "Stack trace")}
                                                        >
                                                            <IconCopy className="h-3 w-3 mr-1" />
                                                            Copy
                                                        </Button>
                                                    </div>
                                                </CardHeader>
                                                <CardContent>
                                                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap max-h-96">
                                                        {errorText}
                                                    </pre>
                                                </CardContent>
                                            </Card>
                                        )}

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
                                                                            <> · {(attachment.PayloadSize / 1024).toFixed(1)} KB</>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleDownloadAttachment(attachment)}
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

// Helper component for detail rows
function DetailRow({ 
    label, 
    value, 
    copyable = false 
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
                        className="h-5 w-5"
                        onClick={() => copyToClipboard(value)}
                    >
                        <IconCopy className="h-3 w-3" />
                    </Button>
                )}
            </div>
        </div>
    );
}
