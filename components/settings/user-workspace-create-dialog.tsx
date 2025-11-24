"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createWorkspaceSchema, type CreateWorkspaceInput } from "@/lib/validations/workspace";
import { createUserWorkspace } from "@/app/actions/workspace-settings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserWorkspaceCreateDialogProps {
  children?: React.ReactNode;
}

// Helper function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function UserWorkspaceCreateDialog({ children }: UserWorkspaceCreateDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();

  const form = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: "",
      slug: "",
      image: "",
    },
  });

  // Auto-generate slug from name
  const watchName = form.watch("name");
  React.useEffect(() => {
    if (watchName && !form.formState.dirtyFields.slug) {
      const generatedSlug = generateSlug(watchName);
      form.setValue("slug", generatedSlug, { shouldValidate: false });
    }
  }, [watchName, form]);

  async function onSubmit(data: CreateWorkspaceInput) {
    setIsLoading(true);
    try {
      const result = await createUserWorkspace(data);

      if (result.success) {
        toast.success("Workspace created successfully");
        form.reset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to create workspace");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Error creating workspace:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Your Workspace</DialogTitle>
          <DialogDescription>
            Get started by creating your first workspace. You'll be the owner.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            {/* Workspace Name Field */}
            <Field>
              <FieldLabel htmlFor="workspace-name">Workspace Name</FieldLabel>
              <Input
                id="workspace-name"
                placeholder="My Workspace"
                disabled={isLoading}
                {...form.register("name")}
              />
              <FieldDescription>
                The name of your workspace as it appears to members.
              </FieldDescription>
              <FieldError errors={[form.formState.errors.name]} />
            </Field>

            {/* Workspace Slug Field */}
            <Field>
              <FieldLabel htmlFor="workspace-slug">Slug</FieldLabel>
              <Input
                id="workspace-slug"
                placeholder="my-workspace"
                disabled={isLoading}
                {...form.register("slug")}
              />
              <FieldDescription>
                Unique identifier for your workspace. Only lowercase letters, numbers, and hyphens allowed.
              </FieldDescription>
              <FieldError errors={[form.formState.errors.slug]} />
            </Field>

            {/* Action Buttons */}
            <Field orientation="horizontal">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Workspace
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
