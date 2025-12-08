export const siteConfig = {
  name: "CPI Connect",
  title: "CPI Connect – SAP CPI Monitoring & Analytics Platform",
  description:
    "CPI Connect is a cloud-based monitoring and analytics platform for SAP Cloud Platform Integration. Real-time insights into iFlows, payloads, message statuses, and performance metrics.",
  url: "https://www.cpiconnect.io",
  ogImage: "/og.png",
  upgrade: {
    label: "Upgrade to CPI Connect Enterprise",
    href: "https://www.cpiconnect.io/pricing",
  },
  links: {
    twitter: "https://x.com/cpiconnect",
    linkedin: "https://www.linkedin.com/company/cpiconnect",
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
