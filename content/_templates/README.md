# Content Templates

This directory contains templates for all content collection types in the project. Use these templates as starting points when creating new content.

## Available Templates

### 📝 Blog Posts
**File:** `blog-post-template.mdx`
**Location:** Copy to `content/blog/`
**Use for:** Company announcements, technical articles, marketing content, engineering posts

### 📚 Help Articles
**File:** `help-article-template.mdx`
**Location:** Copy to `content/help/`
**Use for:** Documentation, tutorials, how-to guides, FAQs

### 🔔 Changelog Posts
**File:** `changelog-template.mdx`
**Location:** Copy to `content/changelog/`
**Use for:** Product updates, release notes, feature announcements

### ✍️ Authors
**File:** `author-template.mdx`
**Location:** Copy to `content/authors/`
**Use for:** Author profiles, contributor bios

### 👥 Team Members
**File:** `team-member-template.mdx`
**Location:** Copy to `content/team/`
**Use for:** Team member profiles for company page

### 🎯 Customer Stories
**File:** `customer-story-template.mdx`
**Location:** Copy to `content/customers/`
**Use for:** Case studies, success stories, testimonials

### 🔌 Integrations
**File:** `integration-template.mdx`
**Location:** Copy to `content/integrations/`
**Use for:** Integration documentation, setup guides

## How to Use

1. **Copy the template** to the appropriate content directory
2. **Rename the file** with a descriptive slug (e.g., `my-awesome-post.mdx`)
3. **Fill in the frontmatter** with your content's metadata
4. **Write your content** using MDX and the available components
5. **Save and commit** - the content will be automatically processed

## Frontmatter Guidelines

### Required vs Optional Fields

Each template includes comments indicating which fields are:
- **Required** - Must be filled in
- **Optional** - Can be omitted or left as default
- **Enum** - Must be one of the specified values

### Date Formats

All dates should follow the `YYYY-MM-DD` format:
```yaml
publishedAt: 2024-01-15
updatedAt: 2024-01-15
```

### Slugs

Slugs are auto-generated from titles, but you can override them:
```yaml
slug: custom-slug-here  # Optional
```

## Available MDX Components

All content supports these MDX components:

### Basic Components
- `<Image>` - Optimized images with zoom
- `<Video>` - YouTube, Vimeo, Loom embeds
- `<Note>` - Info, warning, success callouts
- `<Quote>` - Customer quotes with avatars
- `<CTA>` - Call-to-action blocks
- `<Info>` - Information blocks

### Advanced Components
- `<Mermaid>` - Diagrams and flowcharts
- `<CodeSandbox>` - Interactive code examples
- `<StackBlitz>` - Live code editor
- `<Tabs>` - Tabbed content
- `<Stepper>` - Step-by-step guides
- `<Example>` - Calculation examples
- `<Summary>` - Key points summary
- `<Prerequisites>` - Requirements list

### Content Components
- `<HelpArticles>` - Related help articles
- `<HelpCategories>` - Help category grid
- `<Changelog>` - Changelog listings

## Writing Tips

### SEO Best Practices
1. Write descriptive, engaging titles (50-60 characters)
2. Create compelling summaries (150-160 characters)
3. Use keywords naturally in content
4. Include alt text for all images
5. Use proper heading hierarchy (H1 > H2 > H3)

### Readability
1. Keep paragraphs short (2-4 sentences)
2. Use bullet points for lists
3. Include visual breaks (images, diagrams)
4. Write in active voice
5. Use simple, clear language

### Structure
1. Start with a clear introduction
2. Break content into logical sections
3. Use H2 headings for main sections
4. End with a conclusion or next steps
5. Link to related content

## Reading Time

Reading time is automatically calculated based on word count (~200 words per minute).

## File Naming

Use lowercase with hyphens for file names:
- ✅ `my-awesome-post.mdx`
- ✅ `how-to-setup-auth.mdx`
- ❌ `My Awesome Post.mdx`
- ❌ `how_to_setup_auth.mdx`

## Need Help?

- See the main content README: `content/README.md`
- Check existing content for examples
- Review the content collections config: `content-collections.ts`
- Ask the team in #content channel

## Validation

Content is validated at build time using Zod schemas. Common errors:

- **Missing required fields** - Check frontmatter
- **Invalid date format** - Use YYYY-MM-DD
- **Invalid enum value** - Check allowed categories
- **Invalid slug** - Use lowercase with hyphens

Build will fail if validation errors are found, helping maintain content quality.
