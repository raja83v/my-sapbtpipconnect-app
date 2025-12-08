"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Workflow, 
  Play, 
  Square, 
  AlertCircle,
  ArrowRight,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { IFlowStatusSummary } from "@/app/actions/dashboard";
import { formatDistanceToNow } from "date-fns";

interface IFlowStatusListProps {
  iflows: IFlowStatusSummary[];
}

const statusConfig: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  STARTED: { icon: Play, color: "text-green-500", bgColor: "bg-green-500/10", label: "Running" },
  STOPPED: { icon: Square, color: "text-gray-500", bgColor: "bg-gray-500/10", label: "Stopped" },
  STARTING: { icon: Play, color: "text-blue-500", bgColor: "bg-blue-500/10", label: "Starting" },
  STOPPING: { icon: Square, color: "text-yellow-500", bgColor: "bg-yellow-500/10", label: "Stopping" },
  ERROR: { icon: AlertCircle, color: "text-red-500", bgColor: "bg-red-500/10", label: "Error" },
};

export function IFlowStatusList({ iflows }: IFlowStatusListProps) {
  if (iflows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">iFlow Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Workflow className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No iFlows found</p>
            <p className="text-sm text-muted-foreground/70 mb-4">
              Sync your tenants to discover iFlows
            </p>
            <Button variant="outline" asChild>
              <Link href="/dashboard/iflows">
                View iFlows
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group by status for summary
  const statusCounts = iflows.reduce((acc, iflow) => {
    acc[iflow.status] = (acc[iflow.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">iFlow Status</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/iflows" className="gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Summary */}
        <div className="flex gap-2 flex-wrap">
          {Object.entries(statusCounts).map(([status, count]) => {
            const config = statusConfig[status] || statusConfig.STOPPED;
            return (
              <Badge 
                key={status} 
                variant="outline" 
                className={cn("gap-1", config.bgColor)}
              >
                <config.icon className={cn("h-3 w-3", config.color)} />
                {count} {config.label}
              </Badge>
            );
          })}
        </div>

        {/* iFlow List */}
        <ScrollArea className="h-[180px] pr-4">
          <div className="space-y-2">
            {iflows.map((iflow, index) => {
              const config = statusConfig[iflow.status] || statusConfig.STOPPED;
              const StatusIcon = config.icon;

              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("p-1.5 rounded", config.bgColor)}>
                      <StatusIcon className={cn("h-3 w-3", config.color)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{iflow.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {iflow.tenantName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs text-muted-foreground">
                      {iflow.executionCount} runs
                    </p>
                    {iflow.lastExecutedAt && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(iflow.lastExecutedAt), { addSuffix: true })}
                      </p>
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
