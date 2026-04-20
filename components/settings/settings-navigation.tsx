"use client";

import { parseAsStringEnum, useQueryState } from "nuqs";
import { IconUser, IconShield, IconUsers, IconServer, IconBrain } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavigationItem {
  id: string;
  label: string;
  icon: typeof IconUser;
}

const baseNavigationItems: NavigationItem[] = [
  { id: "profile", label: "Profile", icon: IconUser },
  { id: "tenants", label: "Tenants", icon: IconServer },
  { id: "members", label: "Members", icon: IconUsers },
  { id: "ai", label: "AI Provider", icon: IconBrain },
  { id: "instance", label: "Instance", icon: IconServer },
  { id: "account", label: "Account", icon: IconShield },
];

const SECTION_VALUES = ["profile", "tenants", "members", "ai", "instance", "account"];

interface SettingsNavigationProps {
  isAdmin: boolean;
}

export function SettingsNavigation({ isAdmin }: SettingsNavigationProps) {
  const pathname = usePathname();
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

  // Filter navigation items based on admin status and deployment mode
  const navigationItems = baseNavigationItems.filter((item) => {
    // Tenants and members only for admins
    if ((item.id === "tenants" || item.id === "members") && !isAdmin) return false;
    return true;
  });

  return (
    <nav className="space-y-1 rounded-lg border border-border bg-muted/30 p-2">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.id;

        return (
          <Link
            key={item.id}
            href={`/dashboard/settings?section=${item.id}`}
            onClick={(e) => {
              // If we're already on the settings page, use client-side navigation
              if (pathname === "/dashboard/settings") {
                e.preventDefault();
                setActiveSection(item.id as any);
              }
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
