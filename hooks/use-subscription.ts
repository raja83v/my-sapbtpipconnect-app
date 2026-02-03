"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PRICING_PLANS, type PlanType } from "@/lib/stripe-config";

export interface SubscriptionData {
    plan: PlanType;
    status: string;
    limits: {
        maxTenants: number;
        maxIFlows: number;
        maxTeamMembers: number;
        maxAIAgentCalls: number;
    };
    usage: {
        tenants: number;
        iFlows: number;
        teamMembers: number;
        aiAgentCalls: number;
    };
    canAddTenant: boolean;
    canAddIFlow: boolean;
    canAddTeamMember: boolean;
    canUseAIAgent: boolean;
    isLoading: boolean;
}

export interface UsageLimitData {
    current: number;
    max: number;
    canAdd: boolean;
    percentUsed: number;
    isUnlimited: boolean;
    isLoading: boolean;
}

/**
 * Hook to get subscription data for the current user
 * Uses Convex real-time queries for live updates
 */
export function useSubscription(userId: Id<"users"> | undefined): SubscriptionData {
    const subscription = useQuery(
        api.billing.getSubscription,
        userId ? { userId } : "skip"
    );

    const isLoading = subscription === undefined;

    if (isLoading || !subscription) {
        // Return default FREE tier limits while loading or if no subscription
        const freeLimits = PRICING_PLANS.FREE.limits;
        return {
            plan: "FREE",
            status: "ACTIVE",
            limits: {
                maxTenants: freeLimits.maxTenants,
                maxIFlows: freeLimits.maxIFlows,
                maxTeamMembers: freeLimits.maxTeamMembers,
                maxAIAgentCalls: freeLimits.maxAIAgentCalls,
            },
            usage: {
                tenants: 0,
                iFlows: 0,
                teamMembers: 0,
                aiAgentCalls: 0,
            },
            canAddTenant: true,
            canAddIFlow: true,
            canAddTeamMember: true,
            canUseAIAgent: true,
            isLoading,
        };
    }

    const limits = {
        maxTenants: subscription.maxTenants,
        maxIFlows: subscription.maxIFlows,
        maxTeamMembers: subscription.maxTeamMembers,
        maxAIAgentCalls: subscription.maxAIAgentCalls,
    };

    const usage = {
        tenants: subscription.currentTenantCount,
        iFlows: subscription.currentIFlowCount,
        teamMembers: subscription.currentTeamMemberCount,
        aiAgentCalls: subscription.currentAIAgentCalls,
    };

    // -1 means unlimited
    const canAddTenant = limits.maxTenants === -1 || usage.tenants < limits.maxTenants;
    const canAddIFlow = limits.maxIFlows === -1 || usage.iFlows < limits.maxIFlows;
    const canAddTeamMember = limits.maxTeamMembers === -1 || usage.teamMembers < limits.maxTeamMembers;
    const canUseAIAgent = limits.maxAIAgentCalls === -1 || usage.aiAgentCalls < limits.maxAIAgentCalls;

    return {
        plan: subscription.plan as PlanType,
        status: subscription.status,
        limits,
        usage,
        canAddTenant,
        canAddIFlow,
        canAddTeamMember,
        canUseAIAgent,
        isLoading: false,
    };
}

/**
 * Hook to get specific usage limit data
 */
export function useSubscriptionLimit(
    userId: Id<"users"> | undefined,
    limitType: "tenants" | "iflows" | "teamMembers" | "aiAgentCalls"
): UsageLimitData {
    const limitResult = useQuery(
        api.billing.checkLimits,
        userId ? { userId, limitType } : "skip"
    );

    const isLoading = limitResult === undefined;

    if (isLoading || !limitResult) {
        return {
            current: 0,
            max: 1,
            canAdd: true,
            percentUsed: 0,
            isUnlimited: false,
            isLoading,
        };
    }

    const { current, max, allowed } = limitResult;
    const isUnlimited = max === -1;
    const percentUsed = isUnlimited ? 0 : Math.min((current / max) * 100, 100);

    return {
        current,
        max,
        canAdd: allowed,
        percentUsed,
        isUnlimited,
        isLoading: false,
    };
}

/**
 * Get the recommended upgrade plan based on current plan
 */
export function getRecommendedUpgrade(currentPlan: PlanType): PlanType | null {
    const upgradeMap: Record<PlanType, PlanType | null> = {
        FREE: "STARTER",
        STARTER: "PROFESSIONAL",
        PROFESSIONAL: "ENTERPRISE",
        ENTERPRISE: null,
    };
    return upgradeMap[currentPlan];
}

/**
 * Format usage for display
 */
export function formatUsage(current: number, max: number): string {
    if (max === -1) return `${current} / Unlimited`;
    return `${current} / ${max}`;
}

/**
 * Get usage status color based on percentage
 */
export function getUsageStatusColor(percentUsed: number): "default" | "warning" | "danger" {
    if (percentUsed >= 95) return "danger";
    if (percentUsed >= 80) return "warning";
    return "default";
}