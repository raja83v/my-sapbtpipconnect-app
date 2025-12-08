"use client";

import { parseAsStringEnum, useQueryState } from "nuqs";
import { IconUser, IconShield, IconUsers, IconServer, IconCreditCard } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavigationItem {
  id: string;
  label: string;
  icon: typeof IconUser;
  href?: string;
}

const allNavigationItems: NavigationItem[] = [
  { id: "profile", label: "Profile", icon: IconUser },
  { id: "tenants", label: "Tenants", icon: IconServer },
  { id: "members", label: "Members", icon: IconUsers },
  { id: "account", label: "Account", icon: IconShield },
  { id: "billing", label: "Billing", icon: IconCreditCard, href: "/dashboard/settings/billing" },
];

const SECTION_VALUES = ["profile", "tenants", "members", "account", "billing"];

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

  // Check if we're on the billing page
  const isBillingPage = pathname === "/dashboard/settings/billing";

  // Filter navigation items based on admin status
  const navigationItems = isAdmin
    ? allNavigationItems
    : allNavigationItems.filter(
        (item) => item.id === "profile" || item.id === "account" || item.id === "billing"
      );

  return (
    <nav className="space-y-1 rounded-lg border border-border bg-muted/30 p-2">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.href 
          ? pathname === item.href 
          : !isBillingPage && activeSection === item.id;

        if (item.href) {
          return (
            <Link
              key={item.id}
              href={item.href}
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
        }

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
