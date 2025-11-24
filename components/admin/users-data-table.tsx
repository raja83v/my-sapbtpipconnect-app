"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { useDataTable } from "@/hooks/use-data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash2, Shield, UserCheck, Phone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { UserEditDialog } from "@/components/admin/user-edit-dialog";
import { UserDeleteAlert } from "@/components/admin/user-delete-alert";
import { format } from "date-fns";
import type { AdminUser } from "@/types/admin";

interface UsersDataTableProps {
  data: AdminUser[];
  pageCount: number;
  total: number;
}

export function UsersDataTable({ data, pageCount, total }: UsersDataTableProps) {
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null);

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
                <AvatarImage src={user.image || undefined} alt={user.name || user.email} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">{user.name || "No name"}</span>
                <span className="text-sm text-muted-foreground">{user.email}</span>
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
                role === "admin" ? "destructive" :
                "secondary"
              }
            >
              {role === "admin" && <Shield className="h-3 w-3 mr-1" />}
              {role === "user" && <UserCheck className="h-3 w-3 mr-1" />}
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
                status === "ACTIVE" ? "default" :
                status === "SUSPENDED" ? "outline" :
                "secondary"
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
        id: "phone",
        accessorKey: "phone",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Phone" />
        ),
        cell: ({ row }) => {
          const phone = row.getValue("phone") as string | null;
          return phone ? (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm">{phone}</span>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          );
        },
        enableSorting: true,
      },
      {
        id: "workspaces",
        accessorFn: (row) => row._count?.workspaces ?? 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Workspaces" />
        ),
        cell: ({ row }) => {
          const count = row.original._count?.workspaces ?? 0;
          return <span className="text-sm">{count}</span>;
        },
        enableSorting: true,
      },
      {
        id: "emailVerified",
        accessorKey: "emailVerified",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Verified" />
        ),
        cell: ({ row }) => {
          const isVerified = row.getValue("emailVerified") as boolean;
          return (
            <Badge variant={isVerified ? "default" : "outline"}>
              {isVerified ? "Verified" : "Unverified"}
            </Badge>
          );
        },
        enableSorting: true,
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
            <span className="text-sm">{formatDistanceToNow(new Date(date), { addSuffix: true })}</span>
          ) : (
            <span className="text-muted-foreground text-sm">Never</span>
          );
        },
        enableSorting: true,
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Created" />
        ),
        cell: ({ row }) => {
          const date = row.getValue("createdAt") as Date;
          return <span className="text-sm">{format(new Date(date), "MMM d, yyyy")}</span>;
        },
        enableSorting: true,
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const user = row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedUser(user);
                    setEditDialogOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit user
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedUser(user);
                    setDeleteAlertOpen(true);
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete user
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    []
  );

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
      pagination: { pageIndex: 0, pageSize: 10 },
    },
    getRowId: (row) => row.id,
  });

  return (
    <>
      <DataTable table={table}>
        <DataTableToolbar table={table} />
      </DataTable>

      {selectedUser && (
        <>
          <UserEditDialog
            user={selectedUser}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
          />
          <UserDeleteAlert
            user={selectedUser}
            open={deleteAlertOpen}
            onOpenChange={setDeleteAlertOpen}
          />
        </>
      )}
    </>
  );
}
