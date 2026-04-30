import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Play,
  Pause,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type {
  RecentExecution,
  IFlowStatusSummary,
} from "@/app/actions/dashboard";
import { formatDistanceToNow } from "date-fns";

interface RecentExecutionsProps {
  executions: RecentExecution[];
  activeIFlows?: IFlowStatusSummary[];
}

const statusConfig: Record<
  string,
  { icon: any; color: string; bgColor: string }
> = {
  COMPLETED: {
    icon: CheckCircle2,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  FAILED: { icon: XCircle, color: "text-red-500", bgColor: "bg-red-500/10" },
  PROCESSING: {
    icon: Clock,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  RETRY: {
    icon: AlertCircle,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  SKIPPED: {
    icon: AlertCircle,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
  },
};

const iFlowStatusConfig: Record<
  string,
  { icon: any; color: string; bgColor: string; label: string }
> = {
  STARTED: {
    icon: Play,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    label: "Active",
  },
  STOPPED: {
    icon: Pause,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    label: "Stopped",
  },
  STARTING: {
    icon: Clock,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Starting",
  },
  STOPPING: {
    icon: Clock,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    label: "Stopping",
  },
  ERROR: {
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    label: "Error",
  },
};

export function RecentExecutions({
  executions,
  activeIFlows = [],
}: RecentExecutionsProps) {
  // Show active iFlows when no executions exist
  if (executions.length === 0) {
    // Filter to show only deployed/active iFlows (STARTED status)
    const deployedIFlows = activeIFlows
      .filter((iflow) => iflow.status === "STARTED")
      .slice(0, 10);

    if (deployedIFlows.length === 0) {
      return (
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Recent Executions</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No executions yet</p>
              <p className="text-sm text-muted-foreground/70">
                Deploy and run iFlows to see execution history
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Active iFlows</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Top {deployedIFlows.length} deployed integrations ready to run
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/iflows" className="gap-1">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px] pr-4">
            <div className="space-y-3">
              {deployedIFlows.map((iflow, index) => {
                const config =
                  iFlowStatusConfig[iflow.status] || iFlowStatusConfig.STOPPED;
                const StatusIcon = config.icon;

                return (
                  <div
                    key={`${iflow.name}-${index}`}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={cn("p-2 rounded-lg shrink-0", config.bgColor)}
                    >
                      <StatusIcon className={cn("h-4 w-4", config.color)} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {iflow.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {iflow.tenantName}
                          </p>
                        </div>
                        <Badge
                          variant={
                            iflow.status === "STARTED"
                              ? "default"
                              : iflow.status === "ERROR"
                                ? "destructive"
                                : "secondary"
                          }
                          className="shrink-0 text-xs"
                        >
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Workflow className="h-3 w-3" />
                          Integration Flow
                        </span>
                        {iflow.lastExecutedAt && (
                          <span className="shrink-0">
                            Last run:{" "}
                            {formatDistanceToNow(
                              new Date(iflow.lastExecutedAt),
                              { addSuffix: true },
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Recent Executions</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/iflows" className="gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[420px] pr-4">
          <div className="space-y-3">
            {executions.map((execution) => {
              const config =
                statusConfig[execution.status] || statusConfig.SKIPPED;
              const StatusIcon = config.icon;

              return (
                <div
                  key={execution.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div
                    className={cn("p-2 rounded-lg shrink-0", config.bgColor)}
                  >
                    <StatusIcon className={cn("h-4 w-4", config.color)} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {execution.iFlowName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {execution.tenantName}
                        </p>
                      </div>
                      <Badge
                        variant={
                          execution.status === "COMPLETED"
                            ? "default"
                            : execution.status === "FAILED"
                              ? "destructive"
                              : "secondary"
                        }
                        className="shrink-0 text-xs"
                      >
                        {execution.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="font-mono truncate max-w-[120px]">
                        {execution.messageId.substring(0, 12)}...
                      </span>
                      {execution.duration && (
                        <span className="shrink-0">{execution.duration}ms</span>
                      )}
                      <span className="shrink-0">
                        {formatDistanceToNow(new Date(execution.startTime), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {execution.status === "FAILED" &&
                      execution.errorCategory && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          {execution.errorCategory}
                        </Badge>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
