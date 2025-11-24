"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateWorkspaceSchema, type UpdateWorkspaceInput } from "@/lib/validations/workspace";
import { updateWorkspace } from "@/app/actions/admin/workspaces";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { WorkspaceEditFields } from "@/types/admin";

interface WorkspaceEditDialogProps {
  workspace: WorkspaceEditFields;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceEditDialog({ workspace, open, onOpenChange }: WorkspaceEditDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();

  const form = useForm<UpdateWorkspaceInput>({
    resolver: zodResolver(updateWorkspaceSchema),
    defaultValues: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      image: workspace.image || "",
    },
  });

  // Reset form when workspace changes
  React.useEffect(() => {
    form.reset({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      image: workspace.image || "",
    });
  }, [workspace, form]);

  async function onSubmit(data: UpdateWorkspaceInput) {
    setIsLoading(true);
    try {
      const result = await updateWorkspace(data);

      if (result.success) {
        toast.success("Workspace updated successfully");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update workspace");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Error updating workspace:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Workspace</DialogTitle>
          <DialogDescription>
            Update workspace information
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Workspace" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="my-workspace" {...field} />
                  </FormControl>
                  <FormDescription>
                    Unique identifier for the workspace. Lowercase letters, numbers, and hyphens
                    only.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/workspace.jpg" {...field} />
                  </FormControl>
                  <FormDescription>
                    Provide a URL to the workspace's logo or image
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
