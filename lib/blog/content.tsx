// import { Logo } from "#/ui/icons";
import {
  IconBook2,
  IconBuildingSkyscraper,
  IconChartBar,
  IconChartPie,
  IconFileAnalytics,
  IconScale,
} from "@tabler/icons-react";
import { allHelpPosts } from "content-collections";

export const BLOG_CATEGORIES = [
  {
    title: "Company",
    slug: "company",
    description:
      "Stay current on company updates, milestones, culture insights, and announcements about our journey and vision.",
  },
  {
    title: "Marketing",
    slug: "marketing",
    description:
      "Explore marketing strategies, growth tactics, and insights on building and scaling successful campaigns.",
  },
  {
    title: "Newsroom",
    slug: "newsroom",
    description:
      "Latest news, press releases, and important announcements from our team and industry.",
  },
  {
    title: "Partners",
    slug: "partners",
    description:
      "Discover partnership opportunities, collaborations, and success stories from our partner ecosystem.",
  },
  {
    title: "Engineering",
    slug: "engineering",
    description:
      "Deep dives into technical innovations, architecture decisions, and engineering best practices.",
  },
  {
    title: "Press",
    slug: "press",
    description:
      "Media coverage, press mentions, and official statements for journalists and media professionals.",
  },
];

export const POPULAR_ARTICLES = [
  "what-is-hagenkit",
  "organize-with-labels",
  "azure-saml-sso",
];

export const HELP_CATEGORIES: {
  title: string;
  slug:
    | "overview"
    | "getting-started"
    | "terms"
    | "for-investors"
    | "analysis"
    | "valuation";
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    title: "HagenKit Overview",
    slug: "overview",
    description:
      "Understand the HagenKit platform, core capabilities, and the problems it solves for modern teams.",
    icon: <IconBuildingSkyscraper className="h-6 w-6 text-gray-500" />,
  },
  {
    title: "Getting Started",
    slug: "getting-started",
    description:
      "Launch quickly with setup checklists, workspace walkthroughs, and best practices for connecting your first HagenKit projects and inviting collaborators.",
    icon: <IconChartBar className="h-6 w-6 text-gray-500" />,
  },
  {
    title: "Key Concepts",
    slug: "terms",
    description:
      "Build fluency with HagenKit terminology, core objects, and workspace roles so every teammate knows how launches, automations, and permissions connect.",
    icon: <IconBook2 className="h-6 w-6 text-gray-500" />,
  },
  {
    title: "Agency Playbooks",
    slug: "for-investors",
    description:
      "Detailed playbooks for agencies orchestrating multiple HagenKit clients, with templates, automation tips, and workflow handoffs that scale.",
    icon: <IconFileAnalytics className="h-6 w-6 text-gray-500" />,
  },
  {
    title: "AI Insights",
    slug: "analysis",
    description:
      "Dive into HagenKit AI workflows, enrichment techniques, and automation explainers to understand how data powers each step of your launch process.",
    icon: <IconChartPie className="h-6 w-6 text-gray-500" />,
  },
  {
    title: "Optimization Guides",
    slug: "valuation",
    description:
      "Optimize live HagenKit sites with guidance on performance tuning, design refinements, copy testing, and analytics workflows that keep launches improving.",
    icon: <IconScale className="h-6 w-6 text-gray-500" />,
  },
];

export const getPopularArticles = () => {
  const popularArticles = POPULAR_ARTICLES.map((slug) => {
    const post = allHelpPosts.find((post) => post.slug === slug);
    if (!post) {
      console.warn(`Popular article with slug "${slug}" not found`);
    }
    return post;
  }).filter((post) => post != null);

  return popularArticles;
};
