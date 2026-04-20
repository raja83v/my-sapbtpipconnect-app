"use client";

import { parseAsStringEnum, useQueryState } from "nuqs";
import { IconServer, IconUsers } from "@tabler/icons-react";
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
import { TenantsTab } from "./tenants-tab";
import { MembersTab } from "./members-tab";
import { AccountTab } from "./account-tab";
import { AddTenantDialog } from "./add-tenant-dialog";
import { SelfHostedSettings } from "@/components/settings/self-hosted-settings";
import { AIConfigurationTab } from "@/components/settings/ai-configuration-tab";
import type { TenantWithRole } from "@/app/actions/tenant";

const SECTION_VALUES = ["profile", "tenants", "members", "ai", "instance", "account"];

interface SettingsContentProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    image: string | null;
  };
  tenants: TenantWithRole[];
  isAdmin: boolean;
}

export function SettingsContent({ user, tenants, isAdmin }: SettingsContentProps) {
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

      {activeSection === "tenants" && isAdmin && (
        <TenantsTab tenants={tenants} />
      )}

      {activeSection === "members" && isAdmin && (
        tenants.length > 0 ? (
          <MembersTab tenantId={tenants[0].id} currentUserId={user.id} />
        ) : (
          <Card>
            <CardContent className="p-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconUsers />
                  </EmptyMedia>
                  <EmptyTitle>No Tenants</EmptyTitle>
                  <EmptyDescription>
                    You need to add a tenant before you can invite team members.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        )
      )}

      {activeSection === "ai" && (
        <AIConfigurationTab />
      )}

      {activeSection === "instance" && (
        <SelfHostedSettings />
      )}

      {activeSection === "account" && <AccountTab />}
    </div>
  );
}
