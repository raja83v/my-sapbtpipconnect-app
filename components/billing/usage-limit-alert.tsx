"use client";

import { AlertCircle, ArrowUpRight, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { useSubscriptionLimit, formatUsage, getUsageStatusColor, getRecommendedUpgrade } from "@/hooks/use-subscription";
import type { Id } from "@/convex/_generated/dataModel";
import type { PlanType } from "@/lib/stripe-config";

type LimitType = "tenants" | "iflows" | "teamMembers" | "aiAgentCalls";

interface UsageLimitAlertProps {
    userId: Id<"users"> | undefined;
    limitType: LimitType;
    currentPlan?: PlanType;
    showUpgradeButton?: boolean;
    className?: string;
}

const limitLabels: Record<LimitType, string> = {
    tenants: "CPI Tenants",
    iflows: "iFlows",
    teamMembers: "Team Members",
    aiAgentCalls: "AI Agent Calls",
};

/**
 * Alert component that shows when a usage limit is approaching or reached
 */
export function UsageLimitAlert({
    userId,
    limitType,
    currentPlan = "FREE",
    showUpgradeButton = true,
    className
}: UsageLimitAlertProps) {
    const limitData = useSubscriptionLimit(userId, limitType);

    if (limitData.isLoading) {
        return null;
    }

    // Don't show alert if unlimited
    if (limitData.isUnlimited) {
        return null;
    }

    // Only show alert if usage is at 80% or more
    if (limitData.percentUsed < 80) {
        return null;
    }

    const isLimitReached = !limitData.canAdd;
    const statusColor = getUsageStatusColor(limitData.percentUsed);
    const recommendedPlan = getRecommendedUpgrade(currentPlan);

    return (
        <Alert
            variant={isLimitReached ? "destructive" : "default"}
            className={className}
        >
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
                {isLimitReached ? (
                    <span>{limitLabels[limitType]} Limit Reached</span>
                ) : (
                    <span>{limitLabels[limitType]} Limit Approaching</span>
                )}
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
                <div className="flex items-center justify-between text-sm">
                    <span>
                        {formatUsage(limitData.current, limitData.max)} used
                    </span>
                    <span className={`font-medium ${statusColor === "danger" ? "text-destructive" :
                            statusColor === "warning" ? "text-yellow-600" :
                                "text-muted-foreground"
                        }`}>
                        {limitData.percentUsed.toFixed(0)}%
                    </span>
                </div>

                <Progress
                    value={Math.min(limitData.percentUsed, 100)}
                    className="h-2"
                />

                {isLimitReached ? (
                    <p className="text-sm">
                        You&apos;ve reached your {limitLabels[limitType].toLowerCase()} limit.
                        {recommendedPlan && ` Upgrade to ${recommendedPlan} to continue.`}
                    </p>
                ) : (
                    <p className="text-sm">
                        You&apos;re approaching your {limitLabels[limitType].toLowerCase()} limit.
                        {recommendedPlan && ` Consider upgrading to ${recommendedPlan} for more capacity.`}
                    </p>
                )}

                {showUpgradeButton && recommendedPlan && (
                    <Button asChild size="sm" className="mt-2">
                        <Link href="/dashboard/settings/billing">
                            <Zap className="mr-2 h-4 w-4" />
                            Upgrade Plan
                            <ArrowUpRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                )}
            </AlertDescription>
        </Alert>
    );
}