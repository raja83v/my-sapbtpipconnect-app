"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IconRoute,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  IconArrowLeft,
} from "@tabler/icons-react";
import { IFlowData, toggleIFlowDeployment } from "@/app/actions/iflows";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface IFlowDetailsHeaderProps {
  iflow: IFlowData;
}

export function IFlowDetailsHeader({ iflow: initialIFlow }: IFlowDetailsHeaderProps) {
  const [iflow, setIFlow] = useState(initialIFlow);
  const [isDeploying, setIsDeploying] = useState(false);
  const router = useRouter();

  const handleDeployToggle = async (action: "deploy" | "undeploy") => {
    setIsDeploying(true);
    try {
      const result = await toggleIFlowDeployment(iflow.id, action);
      if (result.success) {
        toast.success(`iFlow ${action === "deploy" ? "deployment" : "undeployment"} initiated`);
        setIFlow({ ...iflow, status: result.data?.status || iflow.status });
        router.refresh();
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
        return (
          <Badge variant="default" className="bg-green-500 text-sm">
            Started
          </Badge>
        );
      case "STOPPED":
        return (
          <Badge variant="secondary" className="text-sm">
            Stopped
          </Badge>
        );
      case "STARTING":
        return (
          <Badge variant="default" className="bg-blue-500 text-sm">
            Starting...
          </Badge>
        );
      case "STOPPING":
        return (
          <Badge variant="secondary" className="text-sm">
            Stopping...
          </Badge>
        );
      case "ERROR":
        return (
          <Badge variant="destructive" className="text-sm">
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-sm">
            {status}
          </Badge>
        );
    }
  };

  const canDeploy = iflow.status === "STOPPED";
  const canUndeploy = iflow.status === "STARTED";
  const isTransitioning = iflow.status === "STARTING" || iflow.status === "STOPPING";

  return (
    <>
      {/* Back Button */}
      <div>
        <Link href="/dashboard/iflows">
          <Button variant="ghost" size="sm">
            <IconArrowLeft className="h-4 w-4 mr-2" />
            Back to iFlows
          </Button>
        </Link>
      </div>

      {/* Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6">
            {/* Top Section */}
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <IconRoute className="h-8 w-8 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h1 className="text-2xl font-bold">{iflow.name}</h1>
                    {getStatusBadge(iflow.status)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <span className="font-medium">Tenant:</span>
                    <span>{iflow.tenantName}</span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">iFlow ID</p>
                      <code className="text-xs bg-secondary px-2 py-1 rounded block overflow-hidden text-ellipsis">
                        {iflow.iFlowId}
                      </code>
                    </div>
                    {iflow.packageName && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Package</p>
                        <p className="text-sm font-medium">{iflow.packageName}</p>
                      </div>
                    )}
                    {iflow.version && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Version</p>
                        <p className="text-sm font-medium">{iflow.version}</p>
                      </div>
                    )}
                    {iflow.lastDeployedAt && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Last Deployed</p>
                        <p className="text-sm font-medium">
                          {formatDistanceToNow(new Date(iflow.lastDeployedAt), {
                            addSuffix: true,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(iflow.lastDeployedAt), "MMM dd, yyyy HH:mm")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.refresh()}
                  disabled={isDeploying}
                >
                  <IconRefresh className={`h-4 w-4 ${isDeploying ? "animate-spin" : ""}`} />
                </Button>
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
          </div>
        </CardContent>
      </Card>
    </>
  );
}
