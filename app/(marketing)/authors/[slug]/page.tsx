import { allAuthors, allBlogPosts, allHelpPosts } from "content-collections"
import { notFound } from "next/navigation"
import Link from "next/link"
import MaxWidthWrapper from "@/components/blog/max-width-wrapper"
import { MDX } from "@/components/blog/mdx"
import { Metadata } from "next"
import { constructMetadata } from "@/lib/constructMetadata"
import BlurImage from "@/lib/blog/blur-image"
import { formatDate } from "@/lib/utils"
import { Twitter, Linkedin, Github, Globe } from "lucide-react"

export async function generateStaticParams() {
  return allAuthors.map((author) => ({
    slug: author.slug,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata | undefined> {
  const { slug } = await params
  const author = allAuthors.find((author) => author.slug === slug)
  if (!author) {
    return
  }

  return constructMetadata({
    title: `${author.name} - Author Profile`,
    description: author.bio,
    image: author.avatar,
  })
}

export default async function AuthorProfile({
  params,
}: {
  params: Promise<{
    slug: string
  }>
}) {
  const { slug } = await params
  const author = allAuthors.find((author) => author.slug === slug)

  if (!author) {
    notFound()
  }

  // Find all blog posts by this author
  const authorBlogPosts = allBlogPosts.filter(
    (post) => post.author === slug || post.author === author.name
  )

  // Find all help articles by this author
  const authorHelpPosts = allHelpPosts.filter(
    (post) => post.author === slug || post.author === author.name
  )

  const totalArticles = authorBlogPosts.length + authorHelpPosts.length

  return (
    <MaxWidthWrapper className="py-28">
      <div className="mx-auto max-w-4xl">
        {/* Author Header */}
        <div className="mb-12 flex flex-col items-center gap-8 text-center sm:flex-row sm:text-left">
          <BlurImage
            src={author.avatar}
            alt={author.name}
            width={160}
            height={160}
            className="h-40 w-40 rounded-full object-cover ring-4 ring-gray-100"
          />
          <div className="flex-1">
            <h1 className="font-display mb-2 text-4xl font-bold text-gray-900">
              {author.name}
            </h1>
            <p className="mb-4 text-xl text-gray-600">{author.role}</p>
            <p className="mb-4 text-lg leading-relaxed text-gray-700">
              {author.bio}
            </p>

            {/* Social Links */}
            <div className="flex items-center justify-center gap-4 sm:justify-start">
              {author.twitter && (
                <a
                  href={author.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 transition-colors hover:text-blue-500"
                  aria-label="Twitter"
                >
                  <Twitter className="h-5 w-5" />
                </a>
              )}
              {author.linkedin && (
                <a
                  href={author.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 transition-colors hover:text-blue-700"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
              )}
              {author.github && (
                <a
                  href={author.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 transition-colors hover:text-gray-900"
                  aria-label="GitHub"
                >
                  <Github className="h-5 w-5" />
                </a>
              )}
              {author.website && (
                <a
                  href={author.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 transition-colors hover:text-gray-900"
                  aria-label="Website"
                >
                  <Globe className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Author Bio Content */}
        <div className="mb-12 rounded-lg border border-gray-200 bg-white p-8">
          <MDX code={author.mdx} />
        </div>

        {/* Author Statistics */}
        <div className="mb-12 grid gap-6 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <p className="text-4xl font-bold text-gray-900">{totalArticles}</p>
            <p className="text-sm text-gray-600">Total Articles</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <p className="text-4xl font-bold text-gray-900">
              {authorBlogPosts.length}
            </p>
            <p className="text-sm text-gray-600">Blog Posts</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <p className="text-4xl font-bold text-gray-900">
              {authorHelpPosts.length}
            </p>
            <p className="text-sm text-gray-600">Help Articles</p>
          </div>
        </div>

        {/* Recent Blog Posts */}
        {authorBlogPosts.length > 0 && (
          <div className="mb-12">
            <h2 className="font-display mb-6 text-2xl font-bold text-gray-900">
              Recent Blog Posts
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {authorBlogPosts.slice(0, 6).map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
                >
                  <h3 className="mb-2 font-semibold text-gray-900 group-hover:text-blue-600">
                    {post.title}
                  </h3>
                  <p className="mb-4 line-clamp-2 text-sm text-gray-600">
                    {post.summary}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatDate(post.publishedAt)}</span>
                    {post.readingTime && <span>{post.readingTime} min read</span>}
                  </div>
                </Link>
              ))}
            </div>
            {authorBlogPosts.length > 6 && (
              <div className="mt-6 text-center">
                <Link
                  href="/blog"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  View all blog posts →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Recent Help Articles */}
        {authorHelpPosts.length > 0 && (
          <div>
            <h2 className="font-display mb-6 text-2xl font-bold text-gray-900">
              Help Articles
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {authorHelpPosts.slice(0, 6).map((post) => (
                <Link
                  key={post.slug}
                  href={`/help/article/${post.slug}`}
                  className="group rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
                >
                  <h3 className="mb-2 font-semibold text-gray-900 group-hover:text-blue-600">
                    {post.title}
                  </h3>
                  <p className="mb-4 line-clamp-2 text-sm text-gray-600">
                    {post.summary}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Updated {formatDate(post.updatedAt)}</span>
                    {post.readingTime && <span>{post.readingTime} min read</span>}
                  </div>
                </Link>
              ))}
            </div>
            {authorHelpPosts.length > 6 && (
              <div className="mt-6 text-center">
                <Link
                  href="/help"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  View all help articles →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </MaxWidthWrapper>
  )
}
