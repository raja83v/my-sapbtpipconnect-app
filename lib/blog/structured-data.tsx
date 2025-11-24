import type { BlogPost, HelpPost } from "content-collections"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hagenkit.com"
const organizationName = "HagenKit"
const organizationLogo = `${baseUrl}/logo.png`

interface Author {
  name: string
  role?: string
  avatar?: string
  twitter?: string
  linkedin?: string
}

export function generateBlogPostStructuredData(post: BlogPost, author?: Author) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    image: post.image ? `${baseUrl}${post.image}` : undefined,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: author
      ? {
          "@type": "Person",
          name: author.name,
          jobTitle: author.role,
          image: author.avatar ? `${baseUrl}${author.avatar}` : undefined,
          sameAs: [author.twitter, author.linkedin].filter(Boolean),
        }
      : {
          "@type": "Person",
          name: post.author,
        },
    publisher: {
      "@type": "Organization",
      name: organizationName,
      logo: {
        "@type": "ImageObject",
        url: organizationLogo,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${baseUrl}/blog/${post.slug}`,
    },
    keywords: post.seoKeywords?.join(", "),
    articleSection: post.categories?.join(", "),
    timeRequired: post.readingTime ? `PT${post.readingTime}M` : undefined,
  }

  return structuredData
}

export function generateHelpArticleStructuredData(post: HelpPost, author?: Author) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: post.title,
    description: post.summary,
    datePublished: post.updatedAt,
    dateModified: post.updatedAt,
    author: author
      ? {
          "@type": "Person",
          name: author.name,
          jobTitle: author.role,
          image: author.avatar ? `${baseUrl}${author.avatar}` : undefined,
          sameAs: [author.twitter, author.linkedin].filter(Boolean),
        }
      : {
          "@type": "Person",
          name: post.author,
        },
    publisher: {
      "@type": "Organization",
      name: organizationName,
      logo: {
        "@type": "ImageObject",
        url: organizationLogo,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${baseUrl}/help/article/${post.slug}`,
    },
    keywords: post.seoKeywords?.join(", "),
    articleSection: post.categories?.join(", "),
    timeRequired: post.readingTime ? `PT${post.readingTime}M` : undefined,
  }

  return structuredData
}

export function generateBreadcrumbStructuredData(
  items: Array<{ name: string; url: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.url}`,
    })),
  }
}

export function generateOrganizationStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: organizationName,
    url: baseUrl,
    logo: organizationLogo,
    sameAs: [
      // Add your social media URLs here
      "https://twitter.com/yourcompany",
      "https://linkedin.com/company/yourcompany",
      "https://github.com/yourcompany",
    ],
  }
}

export function generateWebsiteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: organizationName,
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

export function generateFAQStructuredData(
  faqs: Array<{ question: string; answer: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  }
}

export function generateHowToStructuredData(props: {
  name: string
  description: string
  steps: Array<{ name: string; text: string; image?: string }>
  totalTime?: string
  estimatedCost?: string
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: props.name,
    description: props.description,
    totalTime: props.totalTime,
    estimatedCost: props.estimatedCost
      ? {
          "@type": "MonetaryAmount",
          currency: "USD",
          value: props.estimatedCost,
        }
      : undefined,
    step: props.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      image: step.image ? `${baseUrl}${step.image}` : undefined,
    })),
  }
}

// Helper to inject structured data into page
export function StructuredData({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
