import { Skeleton } from "@/components/ui/skeleton";

export default function AIAgentsLoading() {
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-80 mt-2" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-20 w-32" />
            <Skeleton className="h-20 w-32" />
          </div>
        </div>

        {/* Categories */}
        {[...Array(3)].map((_, categoryIdx) => (
          <div key={categoryIdx} className="space-y-4">
            <div>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64 mt-1" />
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
