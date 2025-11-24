"use client";

import * as React from "react";
import { deleteUser } from "@/app/actions/admin/users";
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
import type { UserDeleteFields } from "@/types/admin";

interface UserDeleteAlertProps {
  user: UserDeleteFields;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDeleteAlert({ user, open, onOpenChange }: UserDeleteAlertProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();

  async function handleDelete() {
    setIsLoading(true);
    try {
      const result = await deleteUser({ id: user.id });

      if (result.success) {
        toast.success("User deleted successfully");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete user");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Error deleting user:", error);
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
              This will permanently delete the user{" "}
              <span className="font-semibold">{user.name || user.email}</span> and all
              associated data.
            </p>
            <p className="text-destructive">
              This action cannot be undone. The following will also be deleted:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>All user sessions</li>
              <li>Workspace memberships</li>
              <li>Account connections</li>
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
            Delete User
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
