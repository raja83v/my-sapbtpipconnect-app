"use client";

import * as React from "react";
import {
  IconChartBar,
  IconCloud,
  IconDashboard,
  IconFileText,
  IconRobot,
  IconRoute,
} from "@tabler/icons-react";
import type { SidebarUser } from "@/types/user";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TenantSelector, type TenantOption } from "@/components/tenant-selector";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
      match: "exact" as const,
    },
    {
      title: "iFlows",
      url: "/dashboard/iflows",
      icon: IconRoute,
    },
    {
      title: "Message Logs",
      url: "/dashboard/message-logs",
      icon: IconFileText,
    },
    {
      title: "Analytics",
      url: "/dashboard/analytics",
      icon: IconChartBar,
    },
    {
      title: "AI Agents",
      url: "/dashboard/ai-agents",
      icon: IconRobot,
    },
  ],
};

export function AppSidebar({
  user,
  tenants = [],
  currentTenantId = null,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: SidebarUser;
  tenants?: TenantOption[];
  currentTenantId?: string | null;
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
              <a href="/" aria-label="CPI Connect home">
                <IconCloud className="size-5!" />
                <span className="text-base font-semibold">CPI Connect</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <TenantSelector tenants={tenants} currentTenantId={currentTenantId} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>{user && <NavUser user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
