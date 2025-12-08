"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Zap,
  RefreshCw,
  Trash2,
  Plus,
  Loader2,
  ShieldAlert,
} from "lucide-react";

export interface ConfirmationRequest {
  toolName: string;
  parameters: Record<string, any>;
  message: string;
  confirmationToken: string;
  expiresAt: number;
}

interface ActionConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ConfirmationRequest | null;
  onConfirm: (token: string) => Promise<void>;
  onCancel: () => void;
}

const ACTION_CONFIG: Record<string, {
  icon: typeof Zap;
  title: string;
  variant: "default" | "destructive" | "warning";
  description: string;
}> = {
  deploy_iflow: {
    icon: Zap,
    title: "Deploy iFlow",
    variant: "default",
    description: "This will deploy the iFlow to the SAP CPI runtime. The integration will become active.",
  },
  restart_iflow: {
    icon: RefreshCw,
    title: "Restart iFlow",
    variant: "warning",
    description: "This will restart the deployed iFlow. Active message processing may be interrupted.",
  },
  undeploy_iflow: {
    icon: Trash2,
    title: "Undeploy iFlow",
    variant: "destructive",
    description: "This will stop and remove the iFlow from the runtime. The integration will no longer process messages.",
  },
  create_iflow: {
    icon: Plus,
    title: "Create iFlow",
    variant: "default",
    description: "This will create a new integration flow in the specified package.",
  },
  create_package: {
    icon: Plus,
    title: "Create Package",
    variant: "default",
    description: "This will create a new integration package in SAP CPI.",
  },
};

export function ActionConfirmationDialog({
  open,
  onOpenChange,
  request,
  onConfirm,
  onCancel,
}: ActionConfirmationDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!request) return null;

  const config = ACTION_CONFIG[request.toolName] || {
    icon: AlertTriangle,
    title: formatToolName(request.toolName),
    variant: "warning" as const,
    description: "This action will modify your SAP CPI environment.",
  };

  const Icon = config.icon;

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm(request.confirmationToken);
    } finally {
      setIsConfirming(false);
    }
  };

  const formatParameters = (params: Record<string, any>) => {
    return Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => ({
        key: formatParameterKey(key),
        value: typeof value === "object" ? JSON.stringify(value) : String(value),
      }));
  };

  const expiresIn = Math.max(0, Math.floor((request.expiresAt - Date.now()) / 1000));

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={cn(
              "p-2.5 rounded-xl",
              config.variant === "destructive" 
                ? "bg-red-500/10 text-red-600" 
                : config.variant === "warning"
                ? "bg-orange-500/10 text-orange-600"
                : "bg-blue-500/10 text-blue-600"
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg">
                Confirm {config.title}
              </AlertDialogTitle>
              <Badge 
                variant="outline" 
                className={cn(
                  "mt-1",
                  config.variant === "destructive" 
                    ? "text-red-600 border-red-500/30" 
                    : config.variant === "warning"
                    ? "text-orange-600 border-orange-500/30"
                    : "text-blue-600 border-blue-500/30"
                )}
              >
                <ShieldAlert className="mr-1 h-3 w-3" />
                {config.variant === "destructive" ? "Destructive Action" : "Requires Confirmation"}
              </Badge>
            </div>
          </div>
          <AlertDialogDescription className="text-sm">
            {config.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Separator className="my-2" />

        {/* Parameters */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Action Details</div>
          <div className="bg-muted rounded-lg p-3 space-y-2">
            {formatParameters(request.parameters).map(({ key, value }) => (
              <div key={key} className="flex items-start justify-between gap-4">
                <span className="text-sm text-muted-foreground">{key}</span>
                <span className="text-sm font-mono text-right truncate max-w-[200px]">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Expiration Warning */}
        {expiresIn < 60 && (
          <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-500/10 rounded-md p-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>This confirmation expires in {expiresIn} seconds</span>
          </div>
        )}

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel onClick={onCancel} disabled={isConfirming}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isConfirming}
            className={cn(
              config.variant === "destructive" 
                ? "bg-red-600 hover:bg-red-700 focus:ring-red-600" 
                : config.variant === "warning"
                ? "bg-orange-600 hover:bg-orange-700 focus:ring-orange-600"
                : ""
            )}
          >
            {isConfirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <Icon className="mr-2 h-4 w-4" />
                Confirm {config.title}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatParameterKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Hook for managing confirmation dialogs
 */
export function useConfirmationDialog() {
  const [confirmationRequest, setConfirmationRequest] = useState<ConfirmationRequest | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const requestConfirmation = (request: ConfirmationRequest) => {
    setConfirmationRequest(request);
    setIsOpen(true);
  };

  const clearConfirmation = () => {
    setConfirmationRequest(null);
    setIsOpen(false);
  };

  return {
    confirmationRequest,
    isOpen,
    setIsOpen,
    requestConfirmation,
    clearConfirmation,
  };
}
