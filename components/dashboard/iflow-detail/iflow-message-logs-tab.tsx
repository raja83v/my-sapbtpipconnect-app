"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
  IconMessages,
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconClock,
} from "@tabler/icons-react";
import { getMessageLogs, type MessageLog } from "@/app/actions/iflows";
import { IFlowDetailData } from "@/app/actions/iflows";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { ErrorExplainer } from "@/components/ai/error-explainer";
import { cn } from "@/lib/utils";

interface IFlowMessageLogsTabProps {
  iflow: IFlowDetailData;
}

export function IFlowMessageLogsTab({ iflow }: IFlowMessageLogsTabProps) {
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState(30);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const loadLogs = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    
    const timeoutId = setTimeout(() => {
      if (!silent) {
        setIsLoading(false);
        toast.error("Loading logs is taking longer than expected.");
      }
    }, 45000);
    
    try {
      const result = await getMessageLogs({
        iflowId: iflow.id,
        page,
        pageSize,
        status: selectedStatus === "all" ? undefined : selectedStatus,
      });

      clearTimeout(timeoutId);

      if (result.success && result.data) {
        setLogs(result.data.logs);
        setTotal(result.data.total);
        setTotalPages(result.data.totalPages);
        setLastRefresh(new Date());
      } else if (!silent) {
        toast.error(result.error || "Failed to load message logs");
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (!silent) {
        toast.error("An error occurred while loading message logs");
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    }
  }, [iflow.id, page, pageSize, selectedStatus]);

  // Initial load and filter/page changes
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh) {
      // Start countdown
      setNextRefreshIn(30);
      
      countdownRef.current = setInterval(() => {
        setNextRefreshIn((prev) => {
          if (prev <= 1) return 30;
          return prev - 1;
        });
      }, 1000);

      // Start refresh interval
      intervalRef.current = setInterval(() => {
        loadLogs(true); // Silent refresh
      }, 30000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [autoRefresh, loadLogs]);

  const toggleRow = (messageId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "COMPLETED":
        return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      case "PROCESSING":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Processing</Badge>;
      case "RETRY":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Retry</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconMessages className="h-5 w-5" />
              Message Logs
            </CardTitle>
            <CardDescription>
              {lastRefresh && (
                <span>Last updated: {format(lastRefresh, "HH:mm:ss")}</span>
              )}
            </CardDescription>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* Auto-refresh toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
              <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
                Auto-refresh
              </Label>
              {autoRefresh && (
                <Badge variant="outline" className="text-xs">
                  <IconClock className="h-3 w-3 mr-1" />
                  {nextRefreshIn}s
                </Badge>
              )}
            </div>

            {/* Status filter */}
            <Select
              value={selectedStatus}
              onValueChange={(value) => {
                setSelectedStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="RETRY">Retry</SelectItem>
              </SelectContent>
            </Select>

            {/* Manual refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadLogs()}
              disabled={isLoading}
            >
              <IconRefresh className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isInitialLoad ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <IconMessages className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Message Logs</h3>
            <p className="text-muted-foreground">
              {selectedStatus !== "all"
                ? `No ${selectedStatus.toLowerCase()} messages found. Try changing the filter.`
                : "No message logs available for this iFlow yet."}
            </p>
          </div>
        ) : (
          <>
            {/* Stats summary */}
            <div className="flex flex-wrap gap-4 mb-4 text-sm">
              <span className="text-muted-foreground">
                Showing {logs.length} of {total} messages
              </span>
            </div>

            {/* Table */}
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Message ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Receiver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <React.Fragment key={log.messageId}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRow(log.messageId)}
                      >
                        <TableCell>
                          {expandedRows.has(log.messageId) ? (
                            <IconChevronUp className="h-4 w-4" />
                          ) : (
                            <IconChevronDown className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-secondary px-2 py-1 rounded">
                            {log.messageId.substring(0, 16)}...
                          </code>
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm">
                              {formatDistanceToNow(new Date(log.logStart), { addSuffix: true })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(log.logStart), "MMM dd, HH:mm:ss")}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.logEnd
                            ? formatDuration(
                                new Date(log.logEnd).getTime() - new Date(log.logStart).getTime()
                              )
                            : "-"}
                        </TableCell>
                        <TableCell className="truncate max-w-[100px]" title={log.sender || "-"}>
                          {log.sender || "-"}
                        </TableCell>
                        <TableCell className="truncate max-w-[100px]" title={log.receiver || "-"}>
                          {log.receiver || "-"}
                        </TableCell>
                      </TableRow>

                      {/* Expanded row */}
                      {expandedRows.has(log.messageId) && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30 p-4">
                            <div className="space-y-4">
                              {/* Error details for failed messages */}
                              {log.status === "FAILED" && (
                                <div className="space-y-2">
                                  <h4 className="font-medium text-red-600 dark:text-red-400">
                                    Error Details
                                  </h4>
                                  {log.errorMessage && (
                                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                                      <p className="text-sm">{log.errorMessage}</p>
                                      {log.errorCategory && (
                                        <Badge variant="outline" className="mt-2">
                                          {log.errorCategory}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* AI Error Explainer */}
                                  <ErrorExplainer
                                    iflowId={iflow.id}
                                    messageId={log.id}
                                  />
                                </div>
                              )}

                              {/* Additional details */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Full Message ID</p>
                                  <code className="text-xs break-all">{log.messageId}</code>
                                </div>
                                {log.correlationId && (
                                  <div>
                                    <p className="text-muted-foreground">Correlation ID</p>
                                    <code className="text-xs break-all">{log.correlationId}</code>
                                  </div>
                                )}
                                {log.interfaceType && (
                                  <div>
                                    <p className="text-muted-foreground">Interface Type</p>
                                    <p className="font-medium">{log.interfaceType}</p>
                                  </div>
                                )}
                                {log.customStatus && (
                                  <div>
                                    <p className="text-muted-foreground">Custom Status</p>
                                    <p className="font-medium">{log.customStatus}</p>
                                  </div>
                                )}
                              </div>

                              {/* Payloads */}
                              {(log.requestPayload || log.responsePayload) && (
                                <div className="space-y-2">
                                  <h4 className="font-medium">Payloads</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {log.requestPayload && (
                                      <div>
                                        <p className="text-sm text-muted-foreground mb-1">Request</p>
                                        <pre className="text-xs bg-secondary p-2 rounded overflow-auto max-h-32">
                                          {log.requestPayload}
                                        </pre>
                                      </div>
                                    )}
                                    {log.responsePayload && (
                                      <div>
                                        <p className="text-sm text-muted-foreground mb-1">Response</p>
                                        <pre className="text-xs bg-secondary p-2 rounded overflow-auto max-h-32">
                                          {log.responsePayload}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1 || isLoading}
                  >
                    <IconChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages || isLoading}
                  >
                    Next
                    <IconChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
