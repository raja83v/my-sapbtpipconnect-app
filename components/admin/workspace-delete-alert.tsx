"use client";

import * as React from "react";
import { deleteWorkspace } from "@/app/actions/admin/workspaces";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { WorkspaceDeleteFields } from "@/types/admin";

interface WorkspaceDeleteAlertProps {
  workspace: WorkspaceDeleteFields;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceDeleteAlert({ workspace, open, onOpenChange }: WorkspaceDeleteAlertProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();

  async function handleDelete() {
    setIsLoading(true);
    try {
      const result = await deleteWorkspace({ id: workspace.id });

      if (result.success) {
        toast.success("Workspace deleted successfully");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete workspace");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Error deleting workspace:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will permanently delete the workspace{" "}
              <span className="font-semibold">{workspace.name}</span> (
              <span className="font-mono text-sm">{workspace.slug}</span>) and all
              associated data.
            </p>
            <p className="text-destructive">
              This action cannot be undone. The following will also be deleted:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>All workspace members</li>
              <li>Pending invitations</li>
              <li>Workspace sessions</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Workspace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
