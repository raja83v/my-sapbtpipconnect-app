import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-5 w-80 mt-2" />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Sidebar Navigation */}
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>

          {/* Content Area */}
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
