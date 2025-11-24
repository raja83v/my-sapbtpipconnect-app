"use client";

import * as React from "react";
import {
  IconArrowLeft,
  IconBook,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileDescription,
  IconHelp,
  IconInnerShadowTop,
  IconKey,
  IconSettings,
  IconUserCog,
  IconUsers,
} from "@tabler/icons-react";
import type { SidebarUser } from "@/types/user";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = {
  navMain: [
    {
      title: "Admin Dashboard",
      url: "/admin",
      icon: IconDashboard,
    },
    {
      title: "User Management",
      url: "/admin/users",
      icon: IconUsers,
    },
    {
      title: "Impersonate User",
      url: "/admin/impersonate",
      icon: IconUserCog,
    },
    {
      title: "Workspace Management",
      url: "/admin/workspaces",
      icon: IconInnerShadowTop,
    },
    {
      title: "System Settings",
      url: "/admin/settings",
      icon: IconSettings,
    },
    {
      title: "Analytics",
      url: "/admin/analytics",
      icon: IconChartBar,
    },
    {
      title: "Audit Logs",
      url: "/admin/audit-logs",
      icon: IconFileDescription,
    },
    {
      title: "Database",
      url: "/admin/database",
      icon: IconDatabase,
    },
  ],
  navSecondary: [
    {
      title: "Back to Dashboard",
      url: "/dashboard",
      icon: IconArrowLeft,
    },
    {
      title: "API Keys",
      url: "/admin/api-keys",
      icon: IconKey,
    },
    {
      title: "Documentation",
      url: "/admin/documentation",
      icon: IconBook,
    },
    {
      title: "Support",
      url: "/admin/support",
      icon: IconHelp,
    },
  ],
};

export function AdminSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: SidebarUser;
}) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/dashboard">
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">HagenKit Admin</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>{user && <NavUser user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
