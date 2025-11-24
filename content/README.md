# Content Collections Documentation

This directory contains all the content for the application, organized into six distinct collections. Each collection serves a specific purpose and has its own schema and routing.

## 📂 Collections Overview

### 1. Blog Posts (`/content/blog/`)
Articles and blog content for the main blog section.

**Route Pattern:** `/blog/{slug}` or `/blog/category/{category-slug}`

**Schema:**
```yaml
title: string (required)
publishedAt: YYYY-MM-DD (required)
summary: string (required)
image: string URL (required)
author: string (required)
categories: array of ["company", "valuation", "market-analysis", "casestudies"]
featured: boolean (default: false)
seoTitle: string (optional)
seoDescription: string (optional)
seoKeywords: array of strings (optional)
slug: string (optional, auto-generated from title if not provided)
related: array of slugs (optional)
```

**Example:**
```mdx
---
title: Welcome to Our Platform
publishedAt: 2025-01-15
summary: Learn about our new features and improvements.
image: https://example.com/image.jpg
author: johndoe
categories:
  - company
featured: true
slug: welcome-to-platform
related:
  - getting-started
  - feature-overview
---

## Your Content Here

Write your blog content using MDX...
```

### 2. Changelog Posts (`/content/changelog/`)
Product updates, feature releases, and version changelogs.

**Schema:**
```yaml
title: string (required)
publishedAt: YYYY-MM-DD (required)
summary: string (required)
image: string URL (required)
author: string (required)
seoTitle: string (optional)
seoDescription: string (optional)
slug: string (optional)
```

### 3. Customer Stories (`/content/customers/`)
Case studies and customer success stories.

**Schema:**
```yaml
title: string (required)
publishedAt: string (required)
summary: string (required)
image: string URL (required)
company: string (required)
companyLogo: string URL (required)
companyUrl: string URL (required)
companyDescription: string (required)
companyIndustry: string (required)
companySize: string (required)
companyFounded: number (required)
plan: string (required)
seoTitle: string (optional)
seoDescription: string (optional)
slug: string (optional)
```

### 4. Help Center (`/content/help/`)
Support articles and documentation for users.

**Route Pattern:** `/help/article/{slug}` or `/help/category/{category-slug}`

**Schema:**
```yaml
title: string (required)
updatedAt: string (required)
summary: string (required)
author: string (required)
categories: array of ["overview", "getting-started", "terms", "for-investors", "analysis", "valuation"]
related: array of slugs (optional)
excludeHeadingsFromSearch: boolean (optional)
seoTitle: string (optional)
seoDescription: string (optional)
slug: string (optional)
```

### 5. Legal Documents (`/content/legal/`)
Terms of service, privacy policy, and other legal pages.

**Schema:**
```yaml
title: string (required)
updatedAt: string (required)
seoTitle: string (optional)
seoDescription: string (optional)
slug: string (optional)
```

### 6. Integrations (`/content/integrations/`)
Integration guides and documentation.

**Schema:**
```yaml
title: string (required)
publishedAt: string (required)
summary: string (required)
image: string URL (required)
company: string (required)
companyLogo: string URL (required)
companyUrl: string URL (required)
companyDescription: string (required)
integrationType: string (required)
integrationDescription: string (required)
compatibility: string (required)
seoTitle: string (optional)
seoDescription: string (optional)
slug: string (optional)
```

## ✍️ Writing Content with MDX

All content files use MDX format (`.mdx`), which combines Markdown with React components.

### Basic Syntax

````mdx
---
title: My Article
publishedAt: 2025-01-15
summary: A brief description
---

## Introduction

Regular markdown content works here.

### Subsections

Use standard markdown features:
- Lists
- **Bold** and *italic*
- [Links](https://example.com)
- `code blocks`
````

### Available Custom Components

The following React components are available in your MDX content:

#### Images
```mdx
<Image
  src="https://example.com/image.jpg"
  alt="Description"
  width={1200}
  height={630}
/>
```

#### Call-to-Action Blocks
```mdx
<CTA
  title="Get Started Today"
  description="Join thousands of users already using our platform."
  buttonText="Sign Up"
  buttonLink="/signup"
/>
```

#### Notes and Alerts
```mdx
<Note type="info">
  This is an informational note.
</Note>

<Note type="warning">
  Important warning message.
</Note>

<Note type="success">
  Success message here.
</Note>
```

#### Quotes
```mdx
<Quote author="John Doe" role="CEO, Example Corp">
  This platform transformed how we work.
</Quote>
```

#### GitHub Repositories
```mdx
<GithubRepo url="https://github.com/username/repo" />
```

#### Tweet Embeds
```mdx
<Tweet id="1234567890" />
```

#### Help Articles (for blog/changelog posts)
```mdx
<HelpArticles articles={["getting-started", "faq"]} />
```

#### Help Categories
```mdx
<HelpCategories />
```

## 🔧 Computed Fields

When you create content, the following fields are automatically computed:

- **slug**: Generated from the title using GitHub-style slugs (or use your custom slug)
- **tableOfContents**: Extracted from H2 headings (`##`) in your content
- **images**: All `<Image />` components are extracted
- **tweetIds**: All `<Tweet />` IDs are extracted
- **githubRepos**: All `<GithubRepo />` URLs are extracted
- **mdx**: Compiled MDX code ready for rendering

## 📝 Content Authoring Guidelines

### 1. Frontmatter Best Practices

- Always include required fields for your collection type
- Use ISO date format (YYYY-MM-DD) for dates
- Provide descriptive SEO fields for better search visibility
- Use custom slugs to create clean, memorable URLs

### 2. Writing Style

- **Headings**: Use H2 (`##`) for main sections - these become table of contents entries
- **Images**: Always include alt text for accessibility
- **Links**: Use relative paths for internal links (`/blog/article-slug`)
- **Code**: Use syntax highlighting with language tags (```javascript)

### 3. SEO Optimization

```yaml
---
title: My Article Title
seoTitle: My Article Title | Brand Name
seoDescription: A compelling 150-160 character description that appears in search results
seoKeywords:
  - keyword1
  - keyword2
  - keyword3
---
```

### 4. Cross-Referencing Content

Link related articles using the `related` field:

```yaml
---
title: Getting Started Guide
related:
  - advanced-features
  - troubleshooting
  - faq
---
```

## 🚀 Working with Content

### Adding New Content

1. Create a new `.mdx` file in the appropriate collection directory
2. Add the required frontmatter fields
3. Write your content using MDX
4. The content will be automatically processed and made available

### Editing Content

Simply edit the `.mdx` file. Changes are automatically detected and the content is recompiled.

### Deleting Content

Remove the `.mdx` file from the collection directory.

## 🎨 Example Templates

### Blog Post Template

```mdx
---
title: Your Blog Post Title
publishedAt: 2025-01-15
summary: A compelling summary that hooks readers
image: https://example.com/featured-image.jpg
author: yourname
categories:
  - company
featured: false
seoTitle: Your Blog Post Title | Your Brand
seoDescription: A detailed description for search engines
slug: your-custom-slug
---

## Introduction

Start with a strong introduction that explains what readers will learn.

## Main Section

<Image
  src="https://example.com/content-image.jpg"
  alt="Descriptive alt text"
  width={1200}
  height={630}
/>

Your main content goes here.

## Conclusion

Wrap up with key takeaways.

<CTA
  title="Ready to Get Started?"
  description="Join us today and see the difference."
  buttonText="Get Started"
  buttonLink="/signup"
/>
```

### Help Article Template

```mdx
---
title: How to Configure Your Account
updatedAt: "2025-01-15"
summary: Step-by-step guide to account configuration
author: support
categories:
  - getting-started
seoTitle: Account Configuration Guide
---

## Overview

Brief overview of what this article covers.

<Note type="info">
  Pro tip: This will save you time!
</Note>

## Step 1: Initial Setup

Detailed instructions...

## Step 2: Configuration

More details...

## Troubleshooting

Common issues and solutions.
```

## 🔍 Querying Content

Content is made available through generated TypeScript modules:

```typescript
import {
  allBlogPosts,
  allChangelogPosts,
  allCustomersPosts,
  allHelpPosts,
  allLegalPosts,
  allIntegrationsPosts,
} from "content-collections"

// Find a specific post
const post = allBlogPosts.find(p => p.slug === "my-slug")

// Filter by category
const companyPosts = allBlogPosts.filter(p =>
  p.categories.includes("company")
)

// Sort by date
const latestPosts = allBlogPosts
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  .slice(0, 5)
```

## ⚙️ Technical Details

- **Framework**: Content Collections with MDX support
- **Compilation**: Automatic with rehype and remark plugins
- **Syntax**: GitHub Flavored Markdown (GFM)
- **Plugins**: Auto-generated heading IDs and anchor links
- **Output**: Type-safe TypeScript modules

## 📚 Additional Resources

- [Content Collections Documentation](https://www.content-collections.dev/)
- [MDX Documentation](https://mdxjs.com/)
- [GitHub Flavored Markdown Spec](https://github.github.com/gfm/)

---

**Questions or Issues?** Check the main documentation or open an issue in the repository.
