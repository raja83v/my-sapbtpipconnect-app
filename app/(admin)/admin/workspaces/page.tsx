import { Suspense } from "react";
import { getWorkspaces } from "@/app/actions/admin/workspaces";
import { WorkspacesDataTable } from "@/components/admin/workspaces-data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { WorkspaceCreateDialog } from "@/components/admin/workspace-create-dialog";

export const metadata = {
  title: "Workspace Management | Admin",
  description: "Manage workspaces and their members",
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }>;
}

async function WorkspacesContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page) : 1;
  const pageSize = params.pageSize ? parseInt(params.pageSize) : 10;
  const search = params.search;
  const sortBy = params.sortBy;
  const sortOrder = params.sortOrder;

  const result = await getWorkspaces({
    page,
    pageSize,
    search,
    sortBy,
    sortOrder,
  });

  if (!result.success || !result.data) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">{result.error || "Failed to load workspaces"}</p>
        </div>
      </div>
    );
  }

  return (
    <WorkspacesDataTable
      data={result.data.workspaces}
      pageCount={result.data.pageCount}
      total={result.data.total}
    />
  );
}

export default function WorkspacesPage(props: PageProps) {
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Workspace Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage workspaces and their members
            </p>
          </div>
          <WorkspaceCreateDialog>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Workspace
            </Button>
          </WorkspaceCreateDialog>
        </div>

        <Suspense fallback={<Skeleton className="h-[500px] w-full" />}>
          <WorkspacesContent searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
