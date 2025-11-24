"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateWorkspace } from "@/app/actions/workspace-settings";
import { updateWorkspaceSchema } from "@/lib/validations/workspace";
import type { WorkspaceWithRole } from "@/types/workspace";
import { z } from "zod";

// Schema for the form (subset of updateWorkspaceSchema)
const workspaceFormSchema = z.object({
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(100, "Name is too long"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50, "Slug is too long")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens"
    )
    .regex(/^[a-z0-9]/, "Slug must start with a letter or number")
    .regex(/[a-z0-9]$/, "Slug must end with a letter or number"),
});

type WorkspaceFormInput = z.infer<typeof workspaceFormSchema>;

interface WorkspaceSettingsFormProps {
  workspace: WorkspaceWithRole;
}

export function WorkspaceSettingsForm({ workspace }: WorkspaceSettingsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const form = useForm<WorkspaceFormInput>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: {
      name: workspace.name,
      slug: workspace.slug,
    },
  });

  async function onSubmit(data: WorkspaceFormInput) {
    setIsLoading(true);
    try {
      const result = await updateWorkspace({
        id: workspace.id,
        name: data.name,
        slug: data.slug,
      });

      if (result.success) {
        toast.success("Workspace updated successfully");
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
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        {/* Workspace Name Field */}
        <Field>
          <FieldLabel htmlFor="workspace-name">Workspace Name</FieldLabel>
          <Input
            id="workspace-name"
            placeholder="Enter workspace name"
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
          <FieldLabel htmlFor="workspace-slug">Workspace Slug</FieldLabel>
          <Input
            id="workspace-slug"
            placeholder="my-workspace"
            disabled={isLoading}
            {...form.register("slug")}
          />
          <FieldDescription>
            URL-friendly identifier for your workspace. Only lowercase letters,
            numbers, and hyphens allowed.
          </FieldDescription>
          <FieldError errors={[form.formState.errors.slug]} />
        </Field>

        {/* Submit Button */}
        <Field orientation="horizontal">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
