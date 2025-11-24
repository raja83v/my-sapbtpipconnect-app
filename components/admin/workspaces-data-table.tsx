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
import { MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import { WorkspaceEditDialog } from "@/components/admin/workspace-edit-dialog";
import { WorkspaceDeleteAlert } from "@/components/admin/workspace-delete-alert";
import { format } from "date-fns";
import type { AdminWorkspace } from "@/types/admin";

interface WorkspacesDataTableProps {
  data: AdminWorkspace[];
  pageCount: number;
  total: number;
}

export function WorkspacesDataTable({ data, pageCount, total }: WorkspacesDataTableProps) {
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = React.useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = React.useState<AdminWorkspace | null>(null);

  const columns = React.useMemo<ColumnDef<AdminWorkspace>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Workspace" />
        ),
        cell: ({ row }) => {
          const workspace = row.original;
          const initials = workspace.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .substring(0, 2);

          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={workspace.image || undefined} alt={workspace.name} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">{workspace.name}</span>
                <span className="text-sm text-muted-foreground">/{workspace.slug}</span>
              </div>
            </div>
          );
        },
        enableColumnFilter: true,
        enableSorting: true,
        meta: {
          label: "Workspace",
          placeholder: "Search workspaces...",
          variant: "text",
        },
      },
      {
        id: "slug",
        accessorKey: "slug",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Slug" />
        ),
        cell: ({ row }) => {
          const slug = row.getValue("slug") as string;
          return (
            <Badge variant="outline" className="font-mono text-xs">
              {slug}
            </Badge>
          );
        },
        enableColumnFilter: true,
        enableSorting: true,
        meta: {
          label: "Slug",
          placeholder: "Search by slug...",
          variant: "text",
        },
      },
      {
        id: "members",
        accessorFn: (row) => row._count?.members ?? 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Members" />
        ),
        cell: ({ row }) => {
          const count = row.original._count?.members ?? 0;
          return (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{count}</span>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: "invitations",
        accessorFn: (row) => row._count?.invitations ?? 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} label="Pending Invites" />
        ),
        cell: ({ row }) => {
          const count = row.original._count?.invitations ?? 0;
          return count > 0 ? (
            <Badge variant="secondary">{count}</Badge>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
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
          const workspace = row.original;

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
                    setSelectedWorkspace(workspace);
                    setEditDialogOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit workspace
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedWorkspace(workspace);
                    setDeleteAlertOpen(true);
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete workspace
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

      {selectedWorkspace && (
        <>
          <WorkspaceEditDialog
            workspace={selectedWorkspace}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
          />
          <WorkspaceDeleteAlert
            workspace={selectedWorkspace}
            open={deleteAlertOpen}
            onOpenChange={setDeleteAlertOpen}
          />
        </>
      )}
    </>
  );
}
