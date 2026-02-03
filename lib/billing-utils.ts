// Billing utility functions (client-safe, no server actions)

/**
 * Get usage limit error message for a specific limit type
 */
export function getUsageLimitErrorMessage(
    usageType: "tenants" | "iflows" | "teamMembers" | "aiAgentCalls",
    current: number,
    max: number
): string {
    const limitNames: Record<string, { singular: string; plural: string }> = {
        tenants: { singular: "CPI tenant", plural: "CPI tenants" },
        iflows: { singular: "iFlow", plural: "iFlows" },
        teamMembers: { singular: "team member", plural: "team members" },
        aiAgentCalls: { singular: "AI agent call", plural: "AI agent calls" },
    };

    const { singular, plural } = limitNames[usageType];
    const name = max === 1 ? singular : plural;

    if (usageType === "aiAgentCalls") {
        return `You've used all ${max} monthly ${name}. Upgrade your plan for more AI capabilities.`;
    }

    return `You've reached your limit of ${max} ${name}. Upgrade your plan to add more.`;
}

/**
 * Format usage for display
 */
export function formatUsageDisplay(current: number, max: number): string {
    if (max === -1) return `${current} / Unlimited`;
    return `${current} / ${max}`;
}

/**
 * Get usage percentage
 */
export function getUsagePercentage(current: number, max: number): number {
    if (max === -1) return 0; // Unlimited
    return Math.min((current / max) * 100, 100);
}

/**
 * Get usage status based on percentage
 */
export function getUsageStatus(current: number, max: number): "ok" | "warning" | "danger" {
    if (max === -1) return "ok"; // Unlimited
    const percentage = (current / max) * 100;
    if (percentage >= 100) return "danger";
    if (percentage >= 80) return "warning";
    return "ok";
}