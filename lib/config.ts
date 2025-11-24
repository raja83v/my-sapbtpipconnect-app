export const siteConfig = {
  name: "HagenKit",
  title: "HagenKit – Production-ready SaaS boilerplate",
  description:
    "HagenKit by Codehagen is a production-ready boilerplate for SaaS apps, combining design, auth, and billing into a unified starter kit.",
  url: "https://www.prismstack.com/hagenkit",
  ogImage: "/og.png",
  upgrade: {
    label: "Upgrade to HagenKit Pro",
    href: "https://www.prismstack.com/hagenkit/pro",
  },
  links: {
    twitter: "https://x.com/codehagen",
    linkedin: "https://www.linkedin.com/company/codehagen",
  },
  keywords: [
    "SaaS boilerplate",
    "Next.js starter kit",
    "Codehagen",
    "subscription billing",
    "frontend design system",
    "authentication templates",
    "SaaS infrastructure",
    "productized boilerplate",
    "SaaS launch platform",
  ],
  authors: [
    {
      name: "Codehagen",
      url: "https://www.prismstack.com",
    },
  ],
  creator: "Codehagen",
  publisher: "Codehagen",
  twitterHandle: "@codehagen",
  locale: "en_US",
  category: "Software",
  // Email branding configuration
  email: {
    brandName: "HagenKit",
    tagline:
      "Production-ready SaaS boilerplate with authentication, billing, and design system built-in.",
    supportEmail: "support@prismstack.com",
    fromEmail: "noreply@prismstack.com",
    fromName: "HagenKit",
  },
};

export type SiteConfig = typeof siteConfig;
