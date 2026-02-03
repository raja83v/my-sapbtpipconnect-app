"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Zap, Server, GitBranch, Users, Bot } from "lucide-react";
import Link from "next/link";
import { useSubscription, formatUsage, getUsageStatusColor, getRecommendedUpgrade } from "@/hooks/use-subscription";
import type { Id } from "@/convex/_generated/dataModel";
import { PRICING_PLANS } from "@/lib/stripe-config";

interface UsageCardProps {
    userId: Id<"users"> | undefined;
    showUpgradeButton?: boolean;
    compact?: boolean;
    className?: string;
}

interface UsageItemProps {
    label: string;
    icon: React.ReactNode;
    current: number;
    max: number;
    compact?: boolean;
}

function UsageItem({ label, icon, current, max, compact }: UsageItemProps) {
    const isUnlimited = max === -1;
    const percentUsed = isUnlimited ? 0 : Math.min((current / max) * 100, 100);
    const statusColor = getUsageStatusColor(percentUsed);

    return (
        <div className={compact ? "space-y-1" : "space-y-2"}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                    {icon}
                    <span>{label}</span>
                </div>
                <span className={`text-sm ${statusColor === "danger" ? "text-destructive font-medium" :
                        statusColor === "warning" ? "text-yellow-600 font-medium" :
                            "text-muted-foreground"
                    }`}>
                    {formatUsage(current, max)}
                </span>
            </div>
            {!isUnlimited && (
                <Progress
                    value={percentUsed}
                    className={compact ? "h-1.5" : "h-2"}
                />
            )}
            {isUnlimited && (
                <div className="h-2 flex items-center">
                    <Badge variant="secondary" className="text-xs">Unlimited</Badge>
                </div>
            )}
        </div>
    );
}

/**
 * Card component showing all usage metrics
 */
export function UsageCard({
    userId,
    showUpgradeButton = true,
    compact = false,
    className
}: UsageCardProps) {
    const subscription = useSubscription(userId);

    if (subscription.isLoading) {
        return (
            <Card className={className}>
                <CardHeader className={compact ? "pb-2" : undefined}>
                    <CardTitle className={compact ? "text-base" : undefined}>Usage</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4 animate-pulse">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="space-y-2">
                                <div className="h-4 bg-muted rounded w-1/3" />
                                <div className="h-2 bg-muted rounded" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const planConfig = PRICING_PLANS[subscription.plan];
    const recommendedPlan = getRecommendedUpgrade(subscription.plan);

    // Check if any limit is approaching (80%+)
    const hasApproachingLimit = [
        { current: subscription.usage.tenants, max: subscription.limits.maxTenants },
        { current: subscription.usage.iFlows, max: subscription.limits.maxIFlows },
        { current: subscription.usage.teamMembers, max: subscription.limits.maxTeamMembers },
        { current: subscription.usage.aiAgentCalls, max: subscription.limits.maxAIAgentCalls },
    ].some(({ current, max }) => {
        if (max === -1) return false;
        return (current / max) * 100 >= 80;
    });

    return (
        <Card className={className}>
            <CardHeader className={compact ? "pb-2" : undefined}>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className={compact ? "text-base" : undefined}>
                            Usage
                        </CardTitle>
                        {!compact && (
                            <CardDescription>
                                Current plan: <span className="font-medium">{planConfig.name}</span>
                            </CardDescription>
                        )}
                    </div>
                    <Badge variant={subscription.plan === "FREE" ? "secondary" : "default"}>
                        {planConfig.name}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className={compact ? "space-y-3" : "space-y-4"}>
                <UsageItem
                    label="CPI Tenants"
                    icon={<Server className="h-4 w-4 text-muted-foreground" />}
                    current={subscription.usage.tenants}
                    max={subscription.limits.maxTenants}
                    compact={compact}
                />

                <UsageItem
                    label="iFlows"
                    icon={<GitBranch className="h-4 w-4 text-muted-foreground" />}
                    current={subscription.usage.iFlows}
                    max={subscription.limits.maxIFlows}
                    compact={compact}
                />

                <UsageItem
                    label="Team Members"
                    icon={<Users className="h-4 w-4 text-muted-foreground" />}
                    current={subscription.usage.teamMembers}
                    max={subscription.limits.maxTeamMembers}
                    compact={compact}
                />

                <UsageItem
                    label="AI Agent Calls"
                    icon={<Bot className="h-4 w-4 text-muted-foreground" />}
                    current={subscription.usage.aiAgentCalls}
                    max={subscription.limits.maxAIAgentCalls}
                    compact={compact}
                />

                {showUpgradeButton && recommendedPlan && hasApproachingLimit && (
                    <div className="pt-2 border-t">
                        <Button asChild size="sm" className="w-full">
                            <Link href="/dashboard/settings/billing">
                                <Zap className="mr-2 h-4 w-4" />
                                Upgrade to {recommendedPlan}
                                <ArrowUpRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}