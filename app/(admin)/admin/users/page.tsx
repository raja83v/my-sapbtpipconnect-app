import { Suspense } from "react";
import { getUsers } from "@/app/actions/admin/users";
import { UsersDataTable } from "@/components/admin/users-data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { UserCreateDialog } from "@/components/admin/user-create-dialog";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

export const metadata = {
  title: "User Management | Admin",
  description: "Manage users and their permissions",
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    role?: string;
    status?: string;
  }>;
}

async function UsersContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page) : 1;
  const pageSize = params.pageSize ? parseInt(params.pageSize) : 10;
  const search = params.search;
  const sortBy = params.sortBy;
  const sortOrder = params.sortOrder;
  const role = params.role;
  const status = params.status;

  const result = await getUsers({
    page,
    pageSize,
    search,
    sortBy,
    sortOrder,
    role,
    status,
  });

  if (!result.success || !result.data) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">{result.error || "Failed to load users"}</p>
        </div>
      </div>
    );
  }

  return (
    <UsersDataTable
      data={result.data.users}
      pageCount={result.data.pageCount}
      total={result.data.total}
    />
  );
}

export default function UsersPage(props: PageProps) {
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage user accounts and permissions
            </p>
          </div>
          <UserCreateDialog>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </UserCreateDialog>
        </div>

        <Suspense
          fallback={
            <DataTableSkeleton
              columnCount={9}
              rowCount={4}
              filterCount={2}
              withViewOptions={true}
              withPagination={true}
              cellRenderer={(rowIndex, colIndex) => {
                if (colIndex === 0) {
                  return (
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                      <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-[150px]" />
                        <Skeleton className="h-3 w-[200px]" />
                      </div>
                    </div>
                  );
                }
                return <Skeleton className="h-4 w-full" />;
              }}
            />
          }
        >
          <UsersContent searchParams={props.searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
