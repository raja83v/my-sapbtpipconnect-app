"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { toast } from "sonner";
import { useTenant } from "@/components/tenant-context";

export interface TenantOption {
  id: string;
  name: string;
  slug: string;
  isConnected: boolean;
}

interface TenantSelectorProps {
  tenants: TenantOption[];
  currentTenantId: string | null;
}

export function TenantSelector({
  tenants,
  currentTenantId,
}: TenantSelectorProps) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const { setCurrentTenantId } = useTenant();
  const [selectedTenantId, setSelectedTenantId] = React.useState<string | null>(
    currentTenantId || (tenants.length > 0 ? tenants[0].id : null),
  );
  const [isUpdating, setIsUpdating] = React.useState(false);

  const selectedTenant =
    tenants.find((t) => t.id === selectedTenantId) || tenants[0];

  const handleTenantChange = async (tenantId: string) => {
    if (tenantId === selectedTenantId) return;

    setIsUpdating(true);
    try {
      const { setDefaultTenant } = await import("@/app/actions/tenant");
      const result = await setDefaultTenant(tenantId);

      if (result.success) {
        setSelectedTenantId(tenantId);
        // Update context to trigger refresh in all subscribed components
        setCurrentTenantId(tenantId);
        const tenant = tenants.find((t) => t.id === tenantId);
        toast.success("Tenant switched", {
          description: `Now viewing ${tenant?.name || "tenant"}`,
        });
        // Refresh server components without full page reload
        router.refresh();
      } else {
        toast.error("Failed to switch tenant", {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error("Error switching tenant");
    } finally {
      setIsUpdating(false);
    }
  };

  if (tenants.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            disabled
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Building2 className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold text-muted-foreground">
                No Tenants
              </span>
              <span className="truncate text-xs text-muted-foreground">
                Add a tenant to get started
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              disabled={isUpdating}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {selectedTenant?.name || "Select Tenant"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {selectedTenant?.isConnected ? "Connected" : "Not connected"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Tenants
            </DropdownMenuLabel>
            {tenants.map((tenant) => (
              <DropdownMenuItem
                key={tenant.id}
                onClick={() => handleTenantChange(tenant.id)}
                className="gap-2 p-2 cursor-pointer"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <Building2 className="size-4 shrink-0" />
                </div>
                <div className="flex-1 truncate">
                  <span className="font-medium">{tenant.name}</span>
                </div>
                {tenant.id === selectedTenantId && (
                  <Check className="size-4 text-primary" />
                )}
                <span
                  className={cn(
                    "size-2 rounded-full",
                    tenant.isConnected ? "bg-green-500" : "bg-muted",
                  )}
                  aria-hidden="true"
                />
                <span className="sr-only">
                  {tenant.isConnected ? "Connected" : "Not connected"}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2 cursor-pointer"
              onClick={() => {
                router.push("/dashboard/settings?section=tenants");
              }}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <span className="text-sm font-medium">+</span>
              </div>
              <div className="font-medium text-muted-foreground">
                Add tenant
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
