"use client";

import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { stopImpersonating } from "@/app/actions/admin/impersonate";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ImpersonationStatus } from "@/types/admin";

interface ImpersonationBannerProps {
  impersonationStatus: ImpersonationStatus;
}

export function ImpersonationBanner({
  impersonationStatus,
}: ImpersonationBannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isVisible, setIsVisible] = useState(true);

  if (!impersonationStatus.isImpersonating || !isVisible) {
    return null;
  }

  const handleStopImpersonating = async () => {
    startTransition(async () => {
      try {
        const result = await stopImpersonating();

        if (result.success) {
          toast.success("Stopped impersonating user");
          setIsVisible(false);
          router.push("/admin/impersonate");
          router.refresh();
        } else {
          toast.error(result.error || "Failed to stop impersonating");
        }
      } catch (error) {
        console.error("Error stopping impersonation:", error);
        toast.error("An unexpected error occurred");
      }
    });
  };

  const user = impersonationStatus.impersonatedUser;

  return (
    <div className="sticky top-0 z-50 border-b bg-yellow-50 dark:bg-yellow-950/20">
      <Alert className="rounded-none border-0 border-b border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-200">
        <IconAlertTriangle className="!text-yellow-600 dark:!text-yellow-400" />
        <AlertTitle className="flex items-center justify-between">
          <span>Impersonating User</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStopImpersonating}
            disabled={isPending}
            className="ml-auto h-8 text-yellow-900 hover:bg-yellow-100 hover:text-yellow-900 dark:text-yellow-200 dark:hover:bg-yellow-900/40 dark:hover:text-yellow-100"
          >
            {isPending ? (
              "Stopping..."
            ) : (
              <>
                <IconX className="mr-1 size-4" />
                Stop Impersonating
              </>
            )}
          </Button>
        </AlertTitle>
        <AlertDescription className="text-yellow-800 dark:text-yellow-300">
          You are currently viewing the application as{" "}
          <strong className="font-semibold">
            {user?.name || "Unknown User"}
          </strong>{" "}
          ({user?.email}). All actions will be performed on behalf of this user.
        </AlertDescription>
      </Alert>
    </div>
  );
}
