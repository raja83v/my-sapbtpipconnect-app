"use client";

import { parseAsStringEnum, useQueryState } from "nuqs";
import { IconBuilding, IconUsers } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ProfileTab } from "./profile-tab";
import { WorkspaceTab } from "./workspace-tab";
import { MembersTab } from "./members-tab";
import { AccountTab } from "./account-tab";
import { UserWorkspaceCreateDialog } from "./user-workspace-create-dialog";
import type { WorkspaceWithRole } from "@/types/workspace";

const SECTION_VALUES = ["profile", "workspace", "members", "account"];

interface SettingsContentProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    image: string | null;
  };
  workspace: WorkspaceWithRole | null;
  isAdmin: boolean;
}

export function SettingsContent({ user, workspace, isAdmin }: SettingsContentProps) {
  const [activeSection] = useQueryState(
    "section",
    parseAsStringEnum(SECTION_VALUES as string[])
      .withDefault("profile")
      .withOptions({
        history: "replace",
        shallow: true,
        clearOnDefault: true,
      })
  );

  return (
    <div>
      {activeSection === "profile" && (
        <ProfileTab
          user={{
            name: user.name,
            email: user.email,
            phone: user.phone,
            image: user.image,
          }}
        />
      )}

      {activeSection === "workspace" && isAdmin && (
        workspace ? (
          <WorkspaceTab workspace={workspace} />
        ) : (
          <Card>
            <CardContent className="p-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconBuilding />
                  </EmptyMedia>
                  <EmptyTitle>No Workspace</EmptyTitle>
                  <EmptyDescription>
                    Create a workspace to manage your team and settings.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <UserWorkspaceCreateDialog>
                    <Button>Create Workspace</Button>
                  </UserWorkspaceCreateDialog>
                </EmptyContent>
              </Empty>
            </CardContent>
          </Card>
        )
      )}

      {activeSection === "members" && isAdmin && (
        workspace ? (
          <MembersTab workspaceId={workspace.id} currentUserId={user.id} />
        ) : (
          <Card>
            <CardContent className="p-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconUsers />
                  </EmptyMedia>
                  <EmptyTitle>No Workspace</EmptyTitle>
                  <EmptyDescription>
                    You need a workspace before you can invite team members.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        )
      )}

      {activeSection === "account" && <AccountTab />}
    </div>
  );
}
