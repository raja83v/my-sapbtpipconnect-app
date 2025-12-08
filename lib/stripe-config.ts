// Shared Stripe configuration - safe to import on client and server

// Pricing plans configuration
export const PRICING_PLANS = {
  FREE: {
    name: "Free",
    description: "Perfect for trying out CPI Connect",
    price: 0,
    priceId: null,
    features: [
      "1 CPI Tenant",
      "10 iFlow Monitoring",
      "3 Team Members",
      "100 AI Agent Calls/month",
      "7-day Data Retention",
      "Email Support",
    ],
    limits: {
      maxTenants: 1,
      maxIFlows: 10,
      maxTeamMembers: 3,
      maxAIAgentCalls: 100,
    },
  },
  STARTER: {
    name: "Starter",
    description: "For small teams getting started",
    price: 29,
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || null,
    features: [
      "3 CPI Tenants",
      "50 iFlow Monitoring",
      "10 Team Members",
      "500 AI Agent Calls/month",
      "30-day Data Retention",
      "Priority Email Support",
      "Basic Analytics",
    ],
    limits: {
      maxTenants: 3,
      maxIFlows: 50,
      maxTeamMembers: 10,
      maxAIAgentCalls: 500,
    },
  },
  PROFESSIONAL: {
    name: "Professional",
    description: "For growing businesses",
    price: 99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID || null,
    features: [
      "10 CPI Tenants",
      "Unlimited iFlow Monitoring",
      "25 Team Members",
      "2,000 AI Agent Calls/month",
      "90-day Data Retention",
      "Priority Support",
      "Advanced Analytics",
      "Custom Alerts",
      "API Access",
    ],
    limits: {
      maxTenants: 10,
      maxIFlows: -1, // unlimited
      maxTeamMembers: 25,
      maxAIAgentCalls: 2000,
    },
  },
  ENTERPRISE: {
    name: "Enterprise",
    description: "For large organizations",
    price: null, // Custom pricing
    priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID || null,
    features: [
      "Unlimited CPI Tenants",
      "Unlimited iFlow Monitoring",
      "Unlimited Team Members",
      "Unlimited AI Agent Calls",
      "1-year Data Retention",
      "24/7 Dedicated Support",
      "Custom Integrations",
      "SLA Guarantee",
      "SSO/SAML",
      "Audit Logs",
      "Custom Training",
    ],
    limits: {
      maxTenants: -1,
      maxIFlows: -1,
      maxTeamMembers: -1,
      maxAIAgentCalls: -1,
    },
  },
} as const;

export type PlanType = keyof typeof PRICING_PLANS;

// Helper to get plan by price ID
export function getPlanByPriceId(priceId: string): PlanType | null {
  const entries = Object.entries(PRICING_PLANS);
  for (const [key, plan] of entries) {
    if (plan.priceId === priceId) {
      return key as PlanType;
    }
  }
  return null;
}

// Helper to get plan limits
export function getPlanLimits(plan: PlanType) {
  return PRICING_PLANS[plan].limits;
}

// Helper to check if user can use a feature based on their plan
export function canUseFeature(
  userPlan: PlanType,
  feature: keyof (typeof PRICING_PLANS)[PlanType]["limits"],
  currentUsage: number
): boolean {
  const limit = PRICING_PLANS[userPlan].limits[feature];
  if (limit === -1) return true; // unlimited
  return currentUsage < limit;
}

// Format price for display
export function formatPrice(price: number | null): string {
  if (price === null) return "Custom";
  if (price === 0) return "Free";
  return `$${price}/month`;
}

// Get absolute URL for redirects
export function absoluteUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}${path}`;
}
