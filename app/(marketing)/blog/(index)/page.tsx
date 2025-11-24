import { Suspense } from 'react'
import BlogClient from './blog-client'
import BlogPageSkeleton from '@/components/blog/blog-page-skeleton'

export default function BlogPage() {
  return (
    <Suspense fallback={<BlogPageSkeleton />}>
      <BlogClient />
    </Suspense>
  )
}
