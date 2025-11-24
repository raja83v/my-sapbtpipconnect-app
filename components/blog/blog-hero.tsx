'use client'

import { cn } from '@/lib/utils'

type Category = 'company' | 'marketing' | 'newsroom' | 'partners' | 'engineering' | 'press'

type Filter = 'all' | Category

interface BlogHeroProps {
  activeFilter: Filter
  setActiveFilter: (filter: Filter) => void
  categoryCounts: Record<Filter, number>
  filters: Filter[]
}

export function BlogHero({ activeFilter, setActiveFilter, categoryCounts, filters }: BlogHeroProps) {
  return (
    <div className="bg-muted @container py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="max-w-md">
          <span className="text-muted-foreground">Blog</span>
          <h2 className="text-muted-foreground mt-4 text-balance text-4xl font-semibold">
            News, insights and more from <strong className="text-foreground font-semibold">Tailark Quartz</strong>
          </h2>
        </div>

        <div className="-ml-0.5 mb-6 mt-12 flex justify-between gap-4 max-md:-mx-6 md:mt-16">
          <div
            className="-ml-0.5 flex snap-x snap-mandatory overflow-x-auto py-3 max-md:px-6"
            role="tablist"
            aria-label="Blog categories">
            {filters.map((category, index) => (
              <button
                key={index}
                onClick={() => setActiveFilter(category)}
                disabled={categoryCounts[category] === 0}
                role="tab"
                aria-selected={activeFilter === category}
                className="text-muted-foreground group snap-center px-1 disabled:pointer-events-none disabled:opacity-50">
                <span className={cn('flex w-fit items-center gap-2 rounded-md px-3 py-1 text-sm transition-colors [&>svg]:size-4', activeFilter === category ? 'bg-card ring-foreground/5 text-primary font-medium shadow-sm ring-1' : 'hover:text-foreground group-hover:bg-foreground/5')}>
                  <span className="capitalize">{category}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
