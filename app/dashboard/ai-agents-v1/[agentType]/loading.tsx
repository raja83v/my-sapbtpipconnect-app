import { Skeleton } from "@/components/ui/skeleton";

export default function AgentLoading() {
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10" />
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div>
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-64 mt-1" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-6 w-24" />
                ))}
              </div>
            </div>
          </div>
          <Skeleton className="h-10 w-10" />
        </div>

        {/* Tenant/iFlow selectors */}
        <Skeleton className="h-24 rounded-xl" />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-3">
            <Skeleton className="h-[400px] rounded-xl" />
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-9">
            <Skeleton className="h-[400px] rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
