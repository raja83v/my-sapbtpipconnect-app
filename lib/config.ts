export const siteConfig = {
  name: "CPI Connect",
  title: "CPI Connect – Open-Source SAP CPI Monitoring & Analytics Platform",
  description:
    "CPI Connect is a free, open-source, self-hosted monitoring and analytics platform for SAP Cloud Platform Integration. Real-time insights into iFlows, payloads, message statuses, and performance metrics — with full data ownership.",
  url: "https://www.cpiconnect.io",
  ogImage: "/og.png",
  links: {
    twitter: "https://x.com/cpiconnect",
    linkedin: "https://www.linkedin.com/company/cpiconnect",
    github: "https://github.com/raja83v/my-sapbtpipconnect-app",
  },
  keywords: [
    "SAP CPI monitoring",
    "Cloud Platform Integration",
    "iFlow monitoring",
    "SAP integration analytics",
    "CPI dashboard",
    "SAP payload monitoring",
    "integration monitoring",
    "SAP CPI analytics",
    "enterprise integration",
    "real-time monitoring",
  ],
  authors: [
    {
      name: "CPI Connect",
      url: "https://www.cpiconnect.io",
    },
  ],
  creator: "CPI Connect",
  publisher: "CPI Connect",
  twitterHandle: "@cpiconnect",
  locale: "en_US",
  category: "Software",
  // Upgrade configuration
  upgrade: {
    href: "https://www.cpiconnect.io/pricing",
    label: "Upgrade to Pro",
  },
  // Email branding configuration
  email: {
    brandName: "CPI Connect",
    tagline:
      "Cloud-based monitoring and analytics platform for SAP Cloud Platform Integration.",
    supportEmail: "support@cpiconnect.io",
    fromEmail: "noreply@cpiconnect.io",
    fromName: "CPI Connect",
  },
};

export type SiteConfig = typeof siteConfig;
