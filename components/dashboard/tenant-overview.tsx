import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Server,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { TenantSummary } from "@/app/actions/dashboard";
import { formatDistanceToNow } from "date-fns";

interface TenantOverviewProps {
  tenants: TenantSummary[];
}

const statusConfig: Record<
  string,
  { icon: any; color: string; label: string }
> = {
  ACTIVE: { icon: CheckCircle2, color: "text-green-500", label: "Active" },
  INACTIVE: { icon: XCircle, color: "text-gray-500", label: "Inactive" },
  TESTING: { icon: RefreshCw, color: "text-blue-500", label: "Testing" },
  ERROR: { icon: AlertCircle, color: "text-red-500", label: "Error" },
};

export function TenantOverview({ tenants }: TenantOverviewProps) {
  if (tenants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connected Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No tenants connected</p>
            <p className="text-sm text-muted-foreground/70 mb-4">
              Connect your SAP CPI tenant to get started
            </p>
            <Button asChild>
              <Link href="/dashboard/settings/tenants">
                <Plus className="h-4 w-4 mr-2" />
                Add Tenant
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Connected Tenants</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/settings/tenants" className="gap-1">
            Manage <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px] pr-4">
          <div className="space-y-3">
            {tenants.map((tenant) => {
              const config =
                statusConfig[tenant.status] || statusConfig.INACTIVE;
              const StatusIcon = config.icon;

              return (
                <Link
                  key={tenant.id}
                  href={`/dashboard/settings/tenants/${tenant.slug}`}
                  className="block p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-lg shrink-0",
                        tenant.isConnected
                          ? "bg-green-500/10"
                          : "bg-gray-500/10",
                      )}
                      aria-label={
                        tenant.isConnected ? "Connected" : "Not connected"
                      }
                    >
                      <Server
                        className={cn(
                          "h-4 w-4",
                          tenant.isConnected
                            ? "text-green-500"
                            : "text-gray-500",
                        )}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">
                          {tenant.name}
                        </p>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-xs gap-1"
                        >
                          <StatusIcon className={cn("h-3 w-3", config.color)} />
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{tenant.iFlowCount} iFlows</span>
                        {tenant.lastSyncAt && (
                          <span>
                            Synced{" "}
                            {formatDistanceToNow(new Date(tenant.lastSyncAt), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
