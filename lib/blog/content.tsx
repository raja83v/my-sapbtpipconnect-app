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
      "Project announcements, roadmap updates, and milestones for the open-source CPI Connect community.",
  },
  {
    title: "Marketing",
    slug: "marketing",
    description:
      "How teams adopt and roll out CPI Connect across their SAP integration landscape.",
  },
  {
    title: "Newsroom",
    slug: "newsroom",
    description:
      "Releases, security advisories, and notable mentions of CPI Connect in the SAP community.",
  },
  {
    title: "Partners",
    slug: "partners",
    description:
      "Integrations, plugins, and community projects built around CPI Connect.",
  },
  {
    title: "Engineering",
    slug: "engineering",
    description:
      "Deep dives into the AI agents, MCP server, BPMN2 generator, and the rest of the CPI Connect stack.",
  },
  {
    title: "Press",
    slug: "press",
    description:
      "Talks, podcasts, and articles featuring CPI Connect.",
  },
];

export const POPULAR_ARTICLES = [
  "what-is-cpi-connect",
  "connect-your-sap-cpi-tenant",
  "using-the-mcp-server",
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
    title: "CPI Connect Overview",
    slug: "overview",
    description:
      "Understand the CPI Connect platform, core capabilities, and the problems it solves for modern teams.",
    icon: <IconBuildingSkyscraper className="h-6 w-6 text-gray-500" />,
  },
  {
    title: "Getting Started",
    slug: "getting-started",
    description:
      "Self-host CPI Connect, register your first SAP CPI tenant, generate API tokens, and bring your team into the dashboard.",
    icon: <IconChartBar className="h-6 w-6 text-gray-500" />,
  },
  {
    title: "Concepts & Terminology",
    slug: "terms",
    description:
      "Brush up on iFlows, message processing logs, OData management APIs, the APIM add-on, and the CPI artefacts CPI Connect works with.",
    icon: <IconBook2 className="h-6 w-6 text-gray-500" />,
  },
  {
    title: "Operations Playbooks",
    slug: "for-investors",
    description:
      "Patterns for running CPI in production: alert routing, on-call workflows, retention policies, and dev/qa/prod tenant comparison.",
    icon: <IconFileAnalytics className="h-6 w-6 text-gray-500" />,
  },
  {
    title: "AI & MCP",
    slug: "analysis",
    description:
      "How the planner / specialist / patch agents work, configuring AI providers, and using the MCP server from Claude, Cursor, and VS Code.",
    icon: <IconChartPie className="h-6 w-6 text-gray-500" />,
  },
  {
    title: "Tuning & Diagnostics",
    slug: "valuation",
    description:
      "Diagnose iFlow failures, profile slow integrations, optimize message mappings, and keep your CPI tenants healthy.",
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
