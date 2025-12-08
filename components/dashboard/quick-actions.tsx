"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Plus, 
  Workflow, 
  Sparkles, 
  RefreshCw,
  ArrowRight,
  Zap,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

interface QuickActionsProps {
  tenantIds?: string[];
}

const quickActions = [
  {
    title: "Add Tenant",
    description: "Connect a new SAP CPI tenant",
    icon: Plus,
    href: "/dashboard/settings/tenants",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "View iFlows",
    description: "Monitor integration flows",
    icon: Workflow,
    href: "/dashboard/iflows",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    title: "AI Agents",
    description: "Intelligent automation",
    icon: Sparkles,
    href: "/dashboard/ai-agents",
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
  },
  {
    title: "Analytics",
    description: "View detailed reports",
    icon: BarChart3,
    href: "/dashboard/analytics",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
];

export function QuickActions({ tenantIds = [] }: QuickActionsProps) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncAll = async () => {
    if (tenantIds.length === 0) {
      toast.info("No tenants to sync", {
        description: "Add a tenant first to sync execution data",
      });
      return;
    }

    setIsSyncing(true);
    
    try {
      // Dynamically import to avoid circular dependencies
      const { syncTenantIFlows } = await import("@/app/actions/tenant");
      
      let successCount = 0;
      let totalExecutions = 0;
      
      for (const tenantId of tenantIds) {
        const result = await syncTenantIFlows(tenantId, { syncExecutions: true });
        if (result.success && result.data) {
          successCount++;
          totalExecutions += result.data.executionsSynced || 0;
        }
      }

      if (successCount > 0) {
        toast.success("Sync completed", {
          description: `Synced ${successCount} tenant(s), ${totalExecutions} new executions`,
        });
        // Refresh server components without full page reload
        router.refresh();
      } else {
        toast.error("Sync failed", {
          description: "Could not sync any tenants. Check your connections.",
        });
      }
    } catch (error) {
      toast.error("Sync error", {
        description: error instanceof Error ? error.message : "Failed to sync",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          Quick Actions
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSyncAll}
          disabled={isSyncing || tenantIds.length === 0}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing..." : "Sync Data"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="group flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/50 transition-all"
            >
              <div className={cn("p-2 rounded-lg", action.bgColor)}>
                <action.icon className={cn("h-4 w-4", action.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {action.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {action.description}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
