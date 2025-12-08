"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Wrench,
  Database,
  FileSearch,
  Activity,
  AlertTriangle,
  Clock,
  Zap,
  Eye,
} from "lucide-react";

export interface ToolCall {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  status: "pending" | "executing" | "completed" | "failed" | "requires_confirmation";
  result?: any;
  error?: string;
  duration?: number;
  cached?: boolean;
  timestamp: Date;
}

interface ToolExecutionDisplayProps {
  toolCalls: ToolCall[];
  onConfirm?: (toolId: string) => void;
  onCancel?: (toolId: string) => void;
  className?: string;
}

const TOOL_ICONS: Record<string, typeof Database> = {
  get_message_logs: FileSearch,
  get_message_details: Eye,
  get_error_info: AlertTriangle,
  get_run_steps: Activity,
  list_iflows: Database,
  get_iflow_config: FileSearch,
  get_iflow_performance: Activity,
  get_execution_stats: Activity,
  get_error_trends: AlertTriangle,
  get_tenant_overview: Database,
  get_top_executed_iflows: Activity,
  deploy_iflow: Zap,
  restart_iflow: Zap,
  create_iflow: Zap,
  undeploy_iflow: AlertTriangle,
};

const TOOL_CATEGORIES: Record<string, string> = {
  get_message_logs: "Monitoring",
  get_message_details: "Monitoring",
  get_error_info: "Monitoring",
  get_run_steps: "Monitoring",
  list_iflows: "iFlow",
  get_iflow_config: "iFlow",
  get_iflow_performance: "iFlow",
  get_execution_stats: "Analytics",
  get_error_trends: "Analytics",
  get_tenant_overview: "Analytics",
  get_top_executed_iflows: "Analytics",
  deploy_iflow: "Action",
  restart_iflow: "Action",
  create_iflow: "Action",
  undeploy_iflow: "Action",
};

/**
 * Display component for tool execution status and results
 */
export function ToolExecutionDisplay({
  toolCalls,
  onConfirm,
  onCancel,
  className
}: ToolExecutionDisplayProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Wrench className="h-4 w-4" />
        <span>Tools used ({toolCalls.length})</span>
      </div>
      <div className="space-y-2">
        {toolCalls.map((toolCall) => (
          <ToolCallCard
            key={toolCall.id}
            toolCall={toolCall}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        ))}
      </div>
    </div>
  );
}

interface ToolCallCardProps {
  toolCall: ToolCall;
  onConfirm?: (toolId: string) => void;
  onCancel?: (toolId: string) => void;
}

function ToolCallCard({ toolCall, onConfirm, onCancel }: ToolCallCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = TOOL_ICONS[toolCall.toolName] || Wrench;
  const category = TOOL_CATEGORIES[toolCall.toolName] || "Other";

  const getStatusBadge = () => {
    switch (toolCall.status) {
      case "pending":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 bg-yellow-500/10">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case "executing":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-500/30 bg-blue-500/10">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Executing
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="text-green-600 border-green-500/30 bg-green-500/10">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {toolCall.cached ? "Cached" : "Completed"}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="text-red-600 border-red-500/30 bg-red-500/10">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      case "requires_confirmation":
        return (
          <Badge variant="outline" className="text-orange-600 border-orange-500/30 bg-orange-500/10">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Needs Confirmation
          </Badge>
        );
    }
  };

  const formatToolName = (name: string) => {
    return name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatParameters = (params: Record<string, any>) => {
    return Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => (
        <div key={key} className="flex items-start gap-2 text-xs">
          <span className="text-muted-foreground font-mono">{key}:</span>
          <span className="text-foreground font-mono truncate max-w-[200px]">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ));
  };

  const formatResult = (result: any) => {
    if (!result) return null;

    // Format common result patterns
    if (result.data) {
      if (Array.isArray(result.data)) {
        return `${result.data.length} items returned`;
      }
      return "Data retrieved successfully";
    }

    if (typeof result === "object") {
      try {
        return (
          <ScrollArea className="h-[200px] w-full">
            <pre className="text-xs font-mono p-2 bg-muted rounded">
              {JSON.stringify(result, null, 2)}
            </pre>
          </ScrollArea>
        );
      } catch {
        return "Result available";
      }
    }

    return String(result);
  };

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-1.5 rounded-md",
                category === "Action" ? "bg-orange-500/10 text-orange-600" :
                  category === "Monitoring" ? "bg-blue-500/10 text-blue-600" :
                    category === "iFlow" ? "bg-purple-500/10 text-purple-600" :
                      "bg-green-500/10 text-green-600"
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">
                  {formatToolName(toolCall.toolName)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {category}
                  {toolCall.duration && ` • ${toolCall.duration}ms`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator />
          <div className="p-3 space-y-3 bg-muted/30">
            {/* Parameters */}
            {Object.keys(toolCall.parameters).length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">Parameters</div>
                <div className="space-y-1 bg-background rounded-md p-2">
                  {formatParameters(toolCall.parameters)}
                </div>
              </div>
            )}

            {/* Confirmation Actions */}
            {toolCall.status === "requires_confirmation" && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => onConfirm?.(toolCall.id)}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Confirm Action
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCancel?.(toolCall.id)}
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* Error */}
            {toolCall.error && (
              <div>
                <div className="text-xs font-medium text-red-600 mb-1.5">Error</div>
                <div className="text-xs text-red-600 bg-red-500/10 rounded-md p-2">
                  {toolCall.error}
                </div>
              </div>
            )}

            {/* Result */}
            {toolCall.status === "completed" && toolCall.result && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">Result</div>
                <div className="bg-background rounded-md p-2 text-sm">
                  {formatResult(toolCall.result)}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/**
 * Inline tool call indicator for showing tool activity during streaming
 */
export function ToolCallIndicator({
  toolName,
  status
}: {
  toolName: string;
  status: "executing" | "completed" | "failed"
}) {
  const Icon = TOOL_ICONS[toolName] || Wrench;
  const formatToolName = (name: string) => {
    return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-sm my-1">
      {status === "executing" ? (
        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
      ) : status === "completed" ? (
        <CheckCircle2 className="h-3 w-3 text-green-500" />
      ) : (
        <XCircle className="h-3 w-3 text-red-500" />
      )}
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground">{formatToolName(toolName)}</span>
    </div>
  );
}

/**
 * Summary of tool calls for compact display
 */
export function ToolCallSummary({ toolCalls }: { toolCalls: ToolCall[] }) {
  const completed = toolCalls.filter(t => t.status === "completed").length;
  const failed = toolCalls.filter(t => t.status === "failed").length;
  const totalDuration = toolCalls.reduce((sum, t) => sum + (t.duration || 0), 0);
  const cachedCount = toolCalls.filter(t => t.cached).length;

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <Wrench className="h-3 w-3" />
        {toolCalls.length} tools
      </div>
      {completed > 0 && (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-3 w-3" />
          {completed}
        </div>
      )}
      {failed > 0 && (
        <div className="flex items-center gap-1 text-red-600">
          <XCircle className="h-3 w-3" />
          {failed}
        </div>
      )}
      {cachedCount > 0 && (
        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {cachedCount} cached
        </div>
      )}
      {totalDuration > 0 && (
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {totalDuration}ms
        </div>
      )}
    </div>
  );
}
