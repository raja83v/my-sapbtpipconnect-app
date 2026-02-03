"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Crown, Sparkles, Star, Zap } from "lucide-react";
import type { PlanType } from "@/lib/stripe-config";
import { PRICING_PLANS } from "@/lib/stripe-config";

interface PlanBadgeProps {
    plan: PlanType;
    showIcon?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const planIcons: Record<PlanType, React.ReactNode> = {
    FREE: null,
    STARTER: <Zap className="h-3 w-3" />,
    PROFESSIONAL: <Star className="h-3 w-3" />,
    ENTERPRISE: <Crown className="h-3 w-3" />,
};

const planStyles: Record<PlanType, string> = {
    FREE: "bg-muted text-muted-foreground hover:bg-muted",
    STARTER: "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300",
    PROFESSIONAL: "bg-purple-100 text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300",
    ENTERPRISE: "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300",
};

/**
 * Badge component displaying the user's current plan
 */
export function PlanBadge({
    plan,
    showIcon = true,
    size = "md",
    className,
}: PlanBadgeProps) {
    const planConfig = PRICING_PLANS[plan];
    const icon = planIcons[plan];

    const sizeClasses = {
        sm: "text-xs px-1.5 py-0.5",
        md: "text-xs px-2 py-0.5",
        lg: "text-sm px-2.5 py-1",
    };

    return (
        <Badge
            variant="secondary"
            className={cn(
                "font-medium gap-1",
                planStyles[plan],
                sizeClasses[size],
                className
            )}
        >
            {showIcon && icon}
            {planConfig.name}
        </Badge>
    );
}

/**
 * Compact plan indicator for headers/navigation
 */
export function PlanIndicator({
    plan,
    className,
}: {
    plan: PlanType;
    className?: string;
}) {
    const planConfig = PRICING_PLANS[plan];

    if (plan === "FREE") {
        return (
            <span className={cn("text-xs text-muted-foreground", className)}>
                Free Plan
            </span>
        );
    }

    return (
        <div className={cn("flex items-center gap-1.5", className)}>
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">{planConfig.name}</span>
        </div>
    );
}

/**
 * Plan upgrade prompt badge
 */
export function UpgradeBadge({
    currentPlan,
    className,
}: {
    currentPlan: PlanType;
    className?: string;
}) {
    // Don't show for Enterprise users
    if (currentPlan === "ENTERPRISE") return null;

    return (
        <Badge
            variant="outline"
            className={cn(
                "gap-1 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors",
                className
            )}
        >
            <Zap className="h-3 w-3" />
            Upgrade
        </Badge>
    );
}