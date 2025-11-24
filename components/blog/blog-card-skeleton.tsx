import { Skeleton } from "@/components/ui/skeleton";

export default function BlogCardSkeleton() {
  return (
    <div className="group relative">
      <article className="group relative space-y-6 rounded-xl">
        {/* Image skeleton - mirrors lines 39-54 of BlogCard */}
        <div className="bg-card/75 ring-border-illustration rounded-xl border border-transparent p-0.5 shadow-md ring-1">
          <div className="before:border-border-illustration relative aspect-video overflow-hidden rounded-[10px] before:absolute before:inset-0 before:rounded-[10px] before:border">
            <Skeleton className="h-full w-full rounded-[10px]" />
          </div>
        </div>

        {/* Content skeleton - mirrors lines 56-111 of BlogCard */}
        <div className="grid gap-3 p-0.5">
          {/* Metadata skeleton (date + reading time) - line 57-67 */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <span className="text-muted-foreground">•</span>
            <Skeleton className="h-4 w-16" />
          </div>

          {/* Title skeleton (2 lines) - line 68-74 */}
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-4/5" />
          </div>

          {/* Summary skeleton (3 lines) - line 75 */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          {/* Footer skeleton - mirrors lines 77-110 */}
          <div className="grid grid-cols-[1fr_auto] items-end gap-2 pt-4">
            {/* Author info skeleton - lines 78-96 */}
            <div className="grid grid-cols-[auto_1fr] items-center gap-2">
              <Skeleton className="size-6 rounded-md" />
              <Skeleton className="h-4 w-24" />
            </div>

            {/* Read button skeleton - lines 98-109 */}
            <div className="flex h-6 items-center">
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
