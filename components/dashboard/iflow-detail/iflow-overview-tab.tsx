"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  IconActivity,
  IconCheck,
  IconX,
  IconClock,
  IconCalendar,
  IconUser,
  IconPackage,
  IconHash,
  IconArrowRight,
  IconArrowLeft,
  IconAlertCircle,
} from "@tabler/icons-react";
import { IFlowDetailData } from "@/app/actions/iflows";
import { format, formatDistanceToNow } from "date-fns";

interface IFlowOverviewTabProps {
  iflow: IFlowDetailData;
}

export function IFlowOverviewTab({ iflow }: IFlowOverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Executions"
          value={iflow.stats?.totalExecutions.toLocaleString() ?? "0"}
          description="Last 7 days"
          icon={<IconActivity className="h-4 w-4" />}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <StatsCard
          title="Success Rate"
          value={iflow.stats ? `${iflow.stats.successRate.toFixed(1)}%` : "N/A"}
          description={`${iflow.stats?.completedExecutions ?? 0} completed`}
          icon={<IconCheck className="h-4 w-4" />}
          iconBg="bg-green-500/10"
          iconColor="text-green-500"
          valueColor={
            iflow.stats?.successRate && iflow.stats.successRate >= 95
              ? "text-green-600"
              : iflow.stats?.successRate && iflow.stats.successRate >= 80
                ? "text-yellow-600"
                : "text-red-600"
          }
        />
        <StatsCard
          title="Failed"
          value={iflow.stats?.failedExecutions.toLocaleString() ?? "0"}
          description="Errors to investigate"
          icon={<IconX className="h-4 w-4" />}
          iconBg="bg-red-500/10"
          iconColor="text-red-500"
          valueColor={iflow.stats?.failedExecutions && iflow.stats.failedExecutions > 0 ? "text-red-600" : undefined}
        />
        <StatsCard
          title="Avg Duration"
          value={iflow.stats ? formatDuration(iflow.stats.avgDuration) : "N/A"}
          description="Per execution"
          icon={<IconClock className="h-4 w-4" />}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-500"
        />
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
            <CardDescription>Core iFlow details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow 
              label="iFlow ID" 
              value={
                <code className="bg-secondary px-2 py-1 rounded text-sm">
                  {iflow.iFlowId}
                </code>
              } 
            />
            <InfoRow 
              label="Name" 
              value={iflow.name} 
            />
            {iflow.description && (
              <InfoRow 
                label="Description" 
                value={iflow.description} 
              />
            )}
            <InfoRow 
              label="Package" 
              value={iflow.packageName || "-"}
              icon={<IconPackage className="h-4 w-4" />}
            />
            <InfoRow 
              label="Version" 
              value={iflow.version || "-"}
              icon={<IconHash className="h-4 w-4" />}
            />
            <InfoRow 
              label="Tenant" 
              value={iflow.tenantName}
            />
          </CardContent>
        </Card>

        {/* Deployment Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Deployment Information</CardTitle>
            <CardDescription>Current runtime state</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow 
              label="Status" 
              value={<StatusBadge status={iflow.status} />}
            />
            {iflow.runtimeStatus && iflow.runtimeStatus !== iflow.status && (
              <InfoRow 
                label="Runtime Status" 
                value={<StatusBadge status={iflow.runtimeStatus} />}
              />
            )}
            <InfoRow 
              label="Deployed By" 
              value={iflow.deployedBy || "-"}
              icon={<IconUser className="h-4 w-4" />}
            />
            <InfoRow 
              label="Deployed On" 
              value={
                iflow.deployedOn 
                  ? `${formatDistanceToNow(iflow.deployedOn, { addSuffix: true })} (${format(iflow.deployedOn, "PPpp")})`
                  : "-"
              }
              icon={<IconCalendar className="h-4 w-4" />}
            />
            <InfoRow 
              label="Last Executed" 
              value={
                iflow.lastExecutedAt 
                  ? formatDistanceToNow(iflow.lastExecutedAt, { addSuffix: true })
                  : "-"
              }
              icon={<IconClock className="h-4 w-4" />}
            />
            {iflow.errorInformation && (
              <div className="pt-2">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                  <IconAlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">
                      {iflow.errorInformation.type}
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                      {iflow.errorInformation.message}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Endpoints */}
        {(iflow.sender || iflow.receiver) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Endpoints</CardTitle>
              <CardDescription>Sender and receiver information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {iflow.sender && (
                <InfoRow 
                  label="Sender" 
                  value={iflow.sender}
                  icon={<IconArrowRight className="h-4 w-4" />}
                />
              )}
              {iflow.receiver && (
                <InfoRow 
                  label="Receiver" 
                  value={iflow.receiver}
                  icon={<IconArrowLeft className="h-4 w-4" />}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Audit Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Audit Information</CardTitle>
            <CardDescription>Creation and modification history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow 
              label="Created By" 
              value={iflow.createdBy || "-"}
              icon={<IconUser className="h-4 w-4" />}
            />
            <InfoRow 
              label="Created At" 
              value={format(iflow.createdAt, "PPpp")}
              icon={<IconCalendar className="h-4 w-4" />}
            />
            <InfoRow 
              label="Modified By" 
              value={iflow.modifiedBy || "-"}
              icon={<IconUser className="h-4 w-4" />}
            />
            <InfoRow 
              label="Modified At" 
              value={
                iflow.modifiedAt 
                  ? format(iflow.modifiedAt, "PPpp")
                  : "-"
              }
              icon={<IconCalendar className="h-4 w-4" />}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper Components

interface StatsCardProps {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
}

function StatsCard({ title, value, description, icon, iconBg, iconColor, valueColor }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${valueColor || ""}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <div className={`p-3 rounded-lg ${iconBg}`}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

function InfoRow({ label, value, icon }: InfoRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium text-right break-words min-w-0">
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "STARTED":
      return <Badge className="bg-green-500 hover:bg-green-600">Started</Badge>;
    case "STOPPED":
      return <Badge variant="secondary">Stopped</Badge>;
    case "STARTING":
      return <Badge className="bg-blue-500 hover:bg-blue-600">Starting</Badge>;
    case "STOPPING":
      return <Badge variant="secondary">Stopping</Badge>;
    case "ERROR":
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
