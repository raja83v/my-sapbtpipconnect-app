"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkspaceSettingsForm } from "./workspace-settings-form";
import type { WorkspaceWithRole } from "@/types/workspace";

interface WorkspaceTabProps {
  workspace: WorkspaceWithRole;
}

export function WorkspaceTab({ workspace }: WorkspaceTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace Settings</CardTitle>
        <CardDescription>
          Manage your workspace name and URL identifier
        </CardDescription>
      </CardHeader>
      <CardContent>
        <WorkspaceSettingsForm workspace={workspace} />
      </CardContent>
    </Card>
  );
}
