'use client'

import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { allBlogPosts } from 'content-collections'
import BlogCard from '@/components/blog/blog-card'
import { BlogHero } from '@/components/blog/blog-hero'
import { getBlurDataURL } from '@/lib/blog/images'
import BlogPageSkeleton from '@/components/blog/blog-page-skeleton'

type Category = 'company' | 'marketing' | 'newsroom' | 'partners' | 'engineering' | 'press'

type Filter = 'all' | Category

interface ArticleWithBlur {
  title: string
  summary: string
  publishedAt: string
  image: string
  author: string
  slug: string
  categories: Category[]
  blurDataURL: string
}

export default function BlogClient() {
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category') as Filter | null

  const [activeFilter, setActiveFilter] = useState<Filter>(
    categoryParam && ['company', 'marketing', 'newsroom', 'partners', 'engineering', 'press'].includes(categoryParam)
      ? categoryParam
      : 'all'
  )
  const [articles, setArticles] = useState<ArticleWithBlur[]>([])
  const [loading, setLoading] = useState(true)

  const filters: Filter[] = ['all', 'company', 'marketing', 'newsroom', 'partners', 'engineering', 'press']

  useEffect(() => {
    async function loadArticles() {
      const articlesWithBlur = await Promise.all(
        allBlogPosts
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
          .map(async (post) => ({
            ...post,
            blurDataURL: await getBlurDataURL(post.image),
          }))
      )
      setArticles(articlesWithBlur as ArticleWithBlur[])
      setLoading(false)
    }
    loadArticles()
  }, [])

  const categoryCounts = useMemo(() => {
    const counts: Record<Filter, number> = {
      all: 0,
      company: 0,
      marketing: 0,
      newsroom: 0,
      partners: 0,
      engineering: 0,
      press: 0,
    }
    for (const article of articles) {
      counts.all++
      if (article.categories && article.categories.length > 0) {
        for (const category of article.categories) {
          counts[category]++
        }
      }
    }
    return counts
  }, [articles])

  const filteredArticles = useMemo(
    () =>
      activeFilter === 'all'
        ? articles
        : articles.filter(
            (article) =>
              article.categories && article.categories.includes(activeFilter as Category)
          ),
    [articles, activeFilter]
  )

  const topArticles = useMemo(() => filteredArticles.slice(0, 2), [filteredArticles])

  const moreArticles = useMemo(() => filteredArticles.slice(2), [filteredArticles])

  if (loading) {
    return <BlogPageSkeleton />
  }

  return (
    <section className="bg-background">
      <BlogHero
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        categoryCounts={categoryCounts}
        filters={filters}
      />

      <div className="mx-auto max-w-5xl px-6">
        <div className="relative">
          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:gap-12">
            {topArticles.map((article, index) => (
              <BlogCard
                key={`${article.slug}-${index}`}
                data={article}
                priority={index === 0}
              />
            ))}
          </div>
        </div>

        {moreArticles.length > 0 && (
          <div className="mt-12 md:mt-16">
            <div className="relative space-y-8">
              <h2 className="text-foreground text-2xl font-semibold">More Articles</h2>
              <div className="grid gap-6 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-3">
                {moreArticles.map((article, index) => (
                  <BlogCard
                    key={`${article.slug}-${index}`}
                    data={article}
                    priority={false}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="pb-16 md:pb-24" />
      </div>
    </section>
  )
}
