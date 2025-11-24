import BlogCardSkeleton from "@/components/blog/blog-card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function BlogPageSkeleton() {
  const filters = ['all', 'company', 'marketing', 'newsroom', 'partners', 'engineering', 'press'];

  return (
    <section className="bg-background">
      {/* Hero skeleton - mirrors BlogHero structure */}
      <div className="bg-muted @container py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="max-w-md">
            <span className="text-muted-foreground">Blog</span>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-4/5" />
            </div>
          </div>

          {/* Category filter skeleton */}
          <div className="-ml-0.5 mb-6 mt-12 flex gap-4 max-md:-mx-6 md:mt-16">
            <div className="flex gap-2 overflow-x-auto py-3 max-md:px-6">
              {filters.map((_, index) => (
                <Skeleton key={index} className="h-8 w-24 shrink-0" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6">
        {/* Top articles grid (2 skeletons) */}
        <div className="relative">
          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:gap-12">
            <BlogCardSkeleton />
            <BlogCardSkeleton />
          </div>
        </div>

        {/* More articles section */}
        <div className="mt-12 md:mt-16">
          <div className="relative space-y-8">
            <h2 className="text-foreground text-2xl font-semibold">More Articles</h2>
            <div className="grid gap-6 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-3">
              <BlogCardSkeleton />
              <BlogCardSkeleton />
              <BlogCardSkeleton />
              <BlogCardSkeleton />
              <BlogCardSkeleton />
              <BlogCardSkeleton />
            </div>
          </div>
        </div>

        {/* Bottom padding */}
        <div className="pb-16 md:pb-24" />
      </div>
    </section>
  );
}
