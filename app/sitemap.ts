import { MetadataRoute } from "next"
import {
  allBlogPosts,
  allChangelogPosts,
  allCustomersPosts,
  allHelpPosts,
  allIntegrationsPosts,
  allLegalPosts,
} from "content-collections"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hagenkit.com"

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/changelog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/customers`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/integrations`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/team`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ]

  // Blog posts
  const blogPages: MetadataRoute.Sitemap = allBlogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: post.featured ? 0.9 : 0.7,
  }))

  // Help articles
  const helpPages: MetadataRoute.Sitemap = allHelpPosts.map((post) => ({
    url: `${baseUrl}/help/article/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }))

  // Changelog posts
  const changelogPages: MetadataRoute.Sitemap = allChangelogPosts.map(
    (post) => ({
      url: `${baseUrl}/changelog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }),
  )

  // Customer stories
  const customerPages: MetadataRoute.Sitemap = allCustomersPosts.map(
    (post) => ({
      url: `${baseUrl}/customers/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }),
  )

  // Integration pages
  const integrationPages: MetadataRoute.Sitemap = allIntegrationsPosts.map(
    (post) => ({
      url: `${baseUrl}/integrations/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }),
  )

  // Legal pages
  const legalPages: MetadataRoute.Sitemap = allLegalPosts.map((post) => ({
    url: `${baseUrl}/legal/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "yearly" as const,
    priority: 0.3,
  }))

  return [
    ...staticPages,
    ...blogPages,
    ...helpPages,
    ...changelogPages,
    ...customerPages,
    ...integrationPages,
    ...legalPages,
  ]
}
