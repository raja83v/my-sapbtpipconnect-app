"use client";

import { AlertTriangle, ArrowUpRight, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import type { PlanType } from "@/lib/stripe-config";
import { getRecommendedUpgrade } from "@/hooks/use-subscription";

type LimitType = "tenants" | "iflows" | "teamMembers" | "aiAgentCalls";

interface LimitReachedBannerProps {
    limitType: LimitType;
    current: number;
    max: number;
    currentPlan?: PlanType;
    dismissible?: boolean;
    variant?: "warning" | "error" | "info";
    className?: string;
}

const limitLabels: Record<LimitType, { singular: string; plural: string }> = {
    tenants: { singular: "CPI tenant", plural: "CPI tenants" },
    iflows: { singular: "iFlow", plural: "iFlows" },
    teamMembers: { singular: "team member", plural: "team members" },
    aiAgentCalls: { singular: "AI agent call", plural: "AI agent calls" },
};

const limitActions: Record<LimitType, string> = {
    tenants: "connect more CPI tenants",
    iflows: "monitor more iFlows",
    teamMembers: "invite more team members",
    aiAgentCalls: "make more AI agent calls",
};

/**
 * Banner component shown when a usage limit is reached or exceeded
 */
export function LimitReachedBanner({
    limitType,
    current,
    max,
    currentPlan = "FREE",
    dismissible = true,
    variant = "warning",
    className,
}: LimitReachedBannerProps) {
    const [isDismissed, setIsDismissed] = useState(false);

    if (isDismissed) return null;

    // Don't show if unlimited
    if (max === -1) return null;

    // Only show if at or over limit
    if (current < max) return null;

    const isOverLimit = current > max;
    const recommendedPlan = getRecommendedUpgrade(currentPlan);
    const label = limitLabels[limitType];
    const action = limitActions[limitType];

    const variantStyles = {
        warning: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950/50 dark:border-yellow-800 dark:text-yellow-200",
        error: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200",
        info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-200",
    };

    const iconStyles = {
        warning: "text-yellow-600 dark:text-yellow-400",
        error: "text-red-600 dark:text-red-400",
        info: "text-blue-600 dark:text-blue-400",
    };

    return (
        <div
            className={cn(
                "relative flex items-center gap-3 rounded-lg border p-4",
                variantStyles[variant],
                className
            )}
            role="alert"
        >
            <AlertTriangle className={cn("h-5 w-5 flex-shrink-0", iconStyles[variant])} />

            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                    {isOverLimit ? (
                        <>
                            You have {current} {current === 1 ? label.singular : label.plural} but your plan only allows {max}.
                        </>
                    ) : (
                        <>
                            You&apos;ve reached your {label.plural} limit ({current}/{max}).
                        </>
                    )}
                </p>
                <p className="text-sm opacity-80 mt-0.5">
                    {recommendedPlan ? (
                        <>Upgrade to {recommendedPlan} to {action}.</>
                    ) : (
                        <>Contact sales for enterprise options.</>
                    )}
                </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
                {recommendedPlan && (
                    <Button
                        asChild
                        size="sm"
                        variant={variant === "error" ? "destructive" : "default"}
                        className="whitespace-nowrap"
                    >
                        <Link href="/dashboard/settings/billing">
                            <Zap className="mr-1.5 h-3.5 w-3.5" />
                            Upgrade
                            <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                    </Button>
                )}

                {dismissible && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-70 hover:opacity-100"
                        onClick={() => setIsDismissed(true)}
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Dismiss</span>
                    </Button>
                )}
            </div>
        </div>
    );
}

/**
 * Compact inline version of the limit banner
 */
export function LimitReachedInline({
    limitType,
    current,
    max,
    currentPlan = "FREE",
    className,
}: Omit<LimitReachedBannerProps, "dismissible" | "variant">) {
    // Don't show if unlimited or under limit
    if (max === -1 || current < max) return null;

    const recommendedPlan = getRecommendedUpgrade(currentPlan);
    const label = limitLabels[limitType];

    return (
        <div className={cn("flex items-center gap-2 text-sm text-destructive", className)}>
            <AlertTriangle className="h-4 w-4" />
            <span>
                {label.plural} limit reached ({current}/{max})
            </span>
            {recommendedPlan && (
                <Link
                    href="/dashboard/settings/billing"
                    className="font-medium underline underline-offset-4 hover:no-underline"
                >
                    Upgrade
                </Link>
            )}
        </div>
    );
}