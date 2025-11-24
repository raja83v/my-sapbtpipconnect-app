"use client";

import { parseAsStringEnum, useQueryState } from "nuqs";
import { IconUser, IconShield, IconUsers, IconBuilding } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface NavigationItem {
  id: string;
  label: string;
  icon: typeof IconUser;
}

const allNavigationItems: NavigationItem[] = [
  { id: "profile", label: "Profile", icon: IconUser },
  { id: "workspace", label: "Workspace", icon: IconBuilding },
  { id: "members", label: "Members", icon: IconUsers },
  { id: "account", label: "Account", icon: IconShield },
];

const SECTION_VALUES = ["profile", "workspace", "members", "account"];

interface SettingsNavigationProps {
  isAdmin: boolean;
}

export function SettingsNavigation({ isAdmin }: SettingsNavigationProps) {
  const [activeSection, setActiveSection] = useQueryState(
    "section",
    parseAsStringEnum(SECTION_VALUES as string[])
      .withDefault("profile")
      .withOptions({
        history: "replace",
        shallow: true,
        clearOnDefault: true,
      })
  );

  // Filter navigation items based on admin status
  const navigationItems = isAdmin
    ? allNavigationItems
    : allNavigationItems.filter(
        (item) => item.id === "profile" || item.id === "account"
      );

  return (
    <nav className="space-y-1 rounded-lg border border-border bg-muted/30 p-2">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id as any)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              activeSection === item.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
