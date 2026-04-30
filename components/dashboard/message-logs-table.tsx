"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "@tabler/icons-react";
import { getMessageLogs, type MessageLog } from "@/app/actions/iflows";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { ErrorExplainer } from "@/components/ai/error-explainer";
import { cn } from "@/lib/utils";

interface MessageLogsTableProps {
  iflowId: string;
  iflowName: string;
}

export function MessageLogsTable({
  iflowId,
  iflowName,
}: MessageLogsTableProps) {
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Changed to false for instant render
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10); // Reduced from 20 for faster initial load
  const [totalPages, setTotalPages] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const loadLogs = async () => {
    setIsLoading(true);

    // Add timeout for the entire operation
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      toast.error(
        "Loading logs is taking longer than expected. Please check your connection.",
      );
    }, 45000); // 45 second timeout

    try {
      const result = await getMessageLogs({
        iflowId,
        page,
        pageSize,
        status: selectedStatus === "all" ? undefined : selectedStatus,
      });

      clearTimeout(timeoutId);

      if (result.success && result.data) {
        setLogs(result.data.logs);
        setTotal(result.data.total);
        setTotalPages(result.data.totalPages);
      } else {
        toast.error(result.error || "Failed to load message logs");
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Error loading logs:", error);
      toast.error("An error occurred while loading message logs");
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, selectedStatus]);

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "COMPLETED":
        return (
          <Badge variant="default" className="bg-green-500">
            Completed
          </Badge>
        );
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      case "PROCESSING":
        return (
          <Badge variant="default" className="bg-blue-500">
            Processing
          </Badge>
        );
      case "RETRY":
        return (
          <Badge variant="default" className="bg-yellow-500">
            Retry
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const calculateDuration = (start: Date, end: Date | null) => {
    if (!end) return "N/A";
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (diff < 1000) return `${diff}ms`;
    return `${(diff / 1000).toFixed(2)}s`;
  };

  const toggleRow = (logId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Messages</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Message processing logs for {iflowName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Status Filter */}
            <Select
              value={selectedStatus}
              onValueChange={(value) => {
                setSelectedStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
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

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={loadLogs}
              disabled={isLoading}
              aria-label="Refresh message logs"
            >
              <IconRefresh
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Results Count */}
        <div className="text-sm text-muted-foreground mb-4">
          {isInitialLoad ? (
            <div className="h-5 w-48 bg-muted animate-pulse rounded" />
          ) : (
            <>
              Showing {logs.length} of {total} messages
            </>
          )}
        </div>

        {/* Table */}
        {isInitialLoad ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-16 w-full bg-muted animate-pulse rounded-md"
              />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <IconMessages className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No messages found</h3>
            <p className="text-sm text-muted-foreground">
              {selectedStatus !== "all"
                ? "Try adjusting your filter"
                : "No messages have been processed for this iFlow yet"}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Message ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Receiver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const isExpanded = expandedRows.has(log.id);
                    const hasFailed = log.status.toUpperCase() === "FAILED";

                    return (
                      <React.Fragment key={log.id}>
                        <TableRow
                          className={cn(
                            "cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                            hasFailed && "bg-destructive/5",
                          )}
                          onClick={() => toggleRow(log.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleRow(log.id);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-expanded={expandedRows.has(log.id)}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} details for message ${log.messageId.substring(0, 12)}`}
                        >
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={
                                isExpanded
                                  ? "Collapse row details"
                                  : "Expand row details"
                              }
                            >
                              {isExpanded ? (
                                <IconChevronUp className="h-4 w-4" />
                              ) : (
                                <IconChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-secondary px-2 py-1 rounded">
                              {log.messageId.substring(0, 16)}...
                            </code>
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>
                                {formatDistanceToNow(new Date(log.logStart), {
                                  addSuffix: true,
                                })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(
                                  new Date(log.logStart),
                                  "MMM dd, HH:mm:ss",
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.logEnd ? (
                              <div className="text-sm">
                                <div>
                                  {formatDistanceToNow(new Date(log.logEnd), {
                                    addSuffix: true,
                                  })}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {format(
                                    new Date(log.logEnd),
                                    "MMM dd, HH:mm:ss",
                                  )}
                                </div>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-mono">
                              {calculateDuration(log.logStart, log.logEnd)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.sender || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.receiver || "-"}
                          </TableCell>
                        </TableRow>

                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <TableRow key={`${log.id}-details`}>
                            <TableCell colSpan={8} className="bg-muted/20 p-6">
                              <div className="space-y-4">
                                {/* Error Information */}
                                {hasFailed && log.errorMessage && (
                                  <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-destructive">
                                      Error Details
                                    </h4>
                                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                                      <p className="text-sm font-mono text-destructive">
                                        {log.errorMessage}
                                      </p>
                                      {log.errorCategory && (
                                        <p className="text-xs text-muted-foreground mt-2">
                                          Category: {log.errorCategory}
                                        </p>
                                      )}
                                    </div>

                                    {/* AI Error Explainer */}
                                    <ErrorExplainer
                                      messageId={log.messageId}
                                      iflowId={iflowId}
                                    />
                                  </div>
                                )}

                                {/* Additional Details */}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium">
                                      Interface Type:
                                    </span>{" "}
                                    {log.interfaceType || "N/A"}
                                  </div>
                                  <div>
                                    <span className="font-medium">
                                      Full Message ID:
                                    </span>{" "}
                                    <code className="text-xs bg-secondary px-2 py-1 rounded">
                                      {log.messageId}
                                    </code>
                                  </div>
                                </div>

                                {/* Payloads */}
                                {(log.requestPayload ||
                                  log.responsePayload) && (
                                  <div className="space-y-3">
                                    {log.requestPayload && (
                                      <div>
                                        <h4 className="text-sm font-semibold mb-2">
                                          Request Payload
                                        </h4>
                                        <pre className="text-xs bg-secondary p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                                          {log.requestPayload}
                                        </pre>
                                      </div>
                                    )}
                                    {log.responsePayload && (
                                      <div>
                                        <h4 className="text-sm font-semibold mb-2">
                                          Response Payload
                                        </h4>
                                        <pre className="text-xs bg-secondary p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                                          {log.responsePayload}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
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
