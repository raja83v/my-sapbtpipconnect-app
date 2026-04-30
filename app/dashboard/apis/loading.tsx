import { Skeleton } from "@/components/ui/skeleton";

export default function APIsLoading() {
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-5 w-80 mt-2" />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <Skeleton className="h-10 flex-1 max-w-md" />
            <Skeleton className="h-10 w-40" />
          </div>
          <Skeleton className="h-10 w-10" />
        </div>

        {/* Results count */}
        <Skeleton className="h-5 w-48" />

        {/* Table */}
        <div className="rounded-lg border">
          <div className="border-b bg-muted/50 p-4">
            <div className="grid grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-4" />
              ))}
            </div>
          </div>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="border-b p-4">
              <div className="grid grid-cols-6 gap-4">
                {[...Array(6)].map((_, j) => (
                  <Skeleton key={j} className="h-4" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
