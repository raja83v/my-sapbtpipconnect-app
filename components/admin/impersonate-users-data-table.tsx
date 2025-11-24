"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { useDataTable } from "@/hooks/use-data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconUserCog } from "@tabler/icons-react";
import { Shield, UserCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { impersonateUser } from "@/app/actions/admin/impersonate";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdminUser } from "@/types/admin";

interface ImpersonateUsersDataTableProps {
  data: AdminUser[];
  pageCount: number;
  total: number;
}

export function ImpersonateUsersDataTable({
  data,
  pageCount,
  total,
}: ImpersonateUsersDataTableProps) {
  const router = useRouter();
  const [impersonatingUserId, setImpersonatingUserId] = React.useState<string | null>(null);

  const handleImpersonate = async (userId: string) => {
    setImpersonatingUserId(userId);

    try {
      const result = await impersonateUser(userId);

      if (result.success) {
        toast.success("Successfully impersonating user");
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to impersonate user");
        setImpersonatingUserId(null);
      }
    } catch (error) {
      console.error("Error impersonating user:", error);
      toast.error("An unexpected error occurred");
      setImpersonatingUserId(null);
    }
  };

  const columns = React.useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="User" />
        ),
        cell: ({ row }) => {
          const user = row.original;
          const initials = user.name
            ? user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
            : user.email[0].toUpperCase();

          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={user.image || undefined}
                  alt={user.name || user.email}
                />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">{user.name || "No name"}</span>
                <span className="text-sm text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>
          );
        },
        enableColumnFilter: true,
        meta: {
          label: "User",
          placeholder: "Search users...",
          variant: "text",
        },
      },
      {
        id: "role",
        accessorKey: "role",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Role" />
        ),
        cell: ({ row }) => {
          const role = row.getValue("role") as string;
          return (
            <Badge
              variant={
                role === "admin"
                  ? "destructive"
                  : "secondary"
              }
            >
              {role === "admin" && <Shield className="mr-1 h-3 w-3" />}
              {role === "user" && <UserCheck className="mr-1 h-3 w-3" />}
              {role}
            </Badge>
          );
        },
        enableColumnFilter: true,
        enableSorting: true,
        meta: {
          label: "Role",
          variant: "select",
          options: [
            { label: "User", value: "user" },
            { label: "Admin", value: "admin" },
          ],
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Status" />
        ),
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          return (
            <Badge
              variant={
                status === "ACTIVE"
                  ? "default"
                  : status === "SUSPENDED"
                    ? "outline"
                    : "secondary"
              }
            >
              {status}
            </Badge>
          );
        },
        enableColumnFilter: true,
        enableSorting: true,
        meta: {
          label: "Status",
          variant: "select",
          options: [
            { label: "Active", value: "ACTIVE" },
            { label: "Suspended", value: "SUSPENDED" },
            { label: "Deleted", value: "DELETED" },
          ],
        },
      },
      {
        id: "lastLoginAt",
        accessorKey: "lastLoginAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Last Login" />
        ),
        cell: ({ row }) => {
          const date = row.getValue("lastLoginAt") as Date | null;
          return date ? (
            <span className="text-sm">
              {formatDistanceToNow(new Date(date), { addSuffix: true })}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Never</span>
          );
        },
        enableSorting: true,
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const user = row.original;
          const isImpersonating = impersonatingUserId === user.id;
          const isDisabled = user.status !== "ACTIVE" || isImpersonating;

          return (
            <Button
              variant="default"
              size="sm"
              onClick={() => handleImpersonate(user.id)}
              disabled={isDisabled}
              className="gap-2"
            >
              <IconUserCog className="h-4 w-4" />
              {isImpersonating ? "Impersonating..." : "Impersonate"}
            </Button>
          );
        },
      },
    ],
    [impersonatingUserId]
  );

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    initialState: {
      sorting: [{ id: "lastLoginAt", desc: true }],
      pagination: { pageIndex: 0, pageSize: 10 },
    },
    getRowId: (row) => row.id,
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
