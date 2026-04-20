"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  IconInfoCircle, 
  IconSettings, 
  IconChartBar, 
  IconMessages,
  IconExternalLink,
  IconRefresh,
  IconPlayerPlay,
  IconPlayerStop,
  IconArrowLeft,
  IconFolder,
} from "@tabler/icons-react";
import { IFlowDetailData, getIFlowFullDetails } from "@/app/actions/iflows";
import { IFlowOverviewTab } from "./iflow-overview-tab";
import { IFlowConfigurationTab } from "./iflow-configuration-tab";
import { IFlowAnalyticsTab } from "./iflow-analytics-tab";
import { IFlowMessageLogsTab } from "./iflow-message-logs-tab";
import { IFlowResourcesTab } from "./iflow-resources-tab";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { toggleIFlowDeployment } from "@/app/actions/iflows";

interface IFlowDetailTabsProps {
  iflow: IFlowDetailData;
}

export function IFlowDetailTabs({ iflow: initialIflow }: IFlowDetailTabsProps) {
  const [iflow, setIFlow] = useState<IFlowDetailData>(initialIflow);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const loadData = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const result = await getIFlowFullDetails(iflow.id);
      if (result.success && result.data) {
        setIFlow(result.data);
      } else {
        toast.error(result.error || "Failed to refresh iFlow details");
      }
    } catch (error) {
      toast.error("Failed to refresh iFlow details");
    } finally {
      setIsRefreshing(false);
    }
  }, [iflow.id]);

  const handleRefresh = () => {
    loadData();
  };

  const handleDeployToggle = async (action: "deploy" | "undeploy") => {
    if (!iflow) return;
    
    setIsDeploying(true);
    try {
      const result = await toggleIFlowDeployment(iflow.id, action);
      if (result.success) {
        toast.success(`iFlow ${action === "deploy" ? "deployment" : "undeployment"} initiated`);
        // Refresh data to get new status
        await loadData();
      } else {
        toast.error(result.error || `Failed to ${action} iFlow`);
      }
    } catch (error) {
      toast.error(`An error occurred while ${action}ing iFlow`);
    } finally {
      setIsDeploying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "STARTED":
        return <Badge className="bg-green-500 hover:bg-green-600">Started</Badge>;
      case "STOPPED":
        return <Badge variant="secondary">Stopped</Badge>;
      case "STARTING":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Starting...</Badge>;
      case "STOPPING":
        return <Badge variant="secondary">Stopping...</Badge>;
      case "ERROR":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const canDeploy = iflow.status === "STOPPED";
  const canUndeploy = iflow.status === "STARTED";
  const isTransitioning = iflow.status === "STARTING" || iflow.status === "STOPPING";

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div>
        <Link href="/dashboard/iflows">
          <Button variant="ghost" size="sm">
            <IconArrowLeft className="h-4 w-4 mr-2" />
            Back to iFlows
          </Button>
        </Link>
      </div>

      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            {/* iFlow Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-2xl font-bold truncate">{iflow.name}</h1>
                {getStatusBadge(iflow.status)}
              </div>
              
              {iflow.description && (
                <p className="text-muted-foreground mb-3 line-clamp-2">
                  {iflow.description}
                </p>
              )}
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span>
                  <span className="font-medium">Tenant:</span> {iflow.tenantName}
                </span>
                <span>
                  <span className="font-medium">ID:</span>{" "}
                  <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">
                    {iflow.iFlowId}
                  </code>
                </span>
                {iflow.packageName && (
                  <span>
                    <span className="font-medium">Package:</span> {iflow.packageName}
                  </span>
                )}
                {iflow.version && (
                  <span>
                    <span className="font-medium">Version:</span> {iflow.version}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {/* SAP CPI Link */}
              {iflow.sapCpiWebLink && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a href={iflow.sapCpiWebLink} target="_blank" rel="noopener noreferrer">
                    <IconExternalLink className="h-4 w-4 mr-2" />
                    Open in SAP CPI
                  </a>
                </Button>
              )}

              {/* Refresh */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isDeploying}
              >
                <IconRefresh className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>

              {/* Deploy/Undeploy */}
              {canDeploy && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleDeployToggle("deploy")}
                  disabled={isDeploying || isTransitioning}
                >
                  <IconPlayerPlay className="h-4 w-4 mr-2" />
                  Deploy
                </Button>
              )}
              {canUndeploy && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeployToggle("undeploy")}
                  disabled={isDeploying || isTransitioning}
                >
                  <IconPlayerStop className="h-4 w-4 mr-2" />
                  Undeploy
                </Button>
              )}
              {isTransitioning && (
                <Button variant="secondary" size="sm" disabled>
                  <IconRefresh className="h-4 w-4 mr-2 animate-spin" />
                  {iflow.status}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <IconInfoCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="configuration" className="gap-2">
            <IconSettings className="h-4 w-4" />
            <span className="hidden sm:inline">Configuration</span>
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-2">
            <IconFolder className="h-4 w-4" />
            <span className="hidden sm:inline">Resources</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <IconChartBar className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <IconMessages className="h-4 w-4" />
            <span className="hidden sm:inline">Message Logs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <IFlowOverviewTab iflow={iflow} />
        </TabsContent>

        <TabsContent value="configuration">
          <IFlowConfigurationTab iflow={iflow} onRefresh={handleRefresh} />
        </TabsContent>

        <TabsContent value="resources">
          <IFlowResourcesTab iflow={iflow} onRefresh={handleRefresh} />
        </TabsContent>

        <TabsContent value="analytics">
          <IFlowAnalyticsTab iflow={iflow} />
        </TabsContent>

        <TabsContent value="logs">
          <IFlowMessageLogsTab iflow={iflow} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
