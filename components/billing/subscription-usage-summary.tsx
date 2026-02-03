"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowUpRight, Bot, GitBranch, Server, Users, Zap } from "lucide-react";
import Link from "next/link";
import { PlanBadge } from "./plan-badge";
import type { PlanType } from "@/lib/stripe-config";
import { cn } from "@/lib/utils";

interface UsageData {
    tenants: { current: number; max: number };
    iFlows: { current: number; max: number };
    teamMembers: { current: number; max: number };
    aiAgentCalls: { current: number; max: number };
}

interface SubscriptionUsageSummaryProps {
    plan: PlanType;
    usage: UsageData;
    showUpgradeButton?: boolean;
    className?: string;
}

function getUsageColor(current: number, max: number): string {
    if (max === -1) return "text-muted-foreground";
    const percent = (current / max) * 100;
    if (percent >= 100) return "text-destructive";
    if (percent >= 80) return "text-yellow-600";
    return "text-muted-foreground";
}

function getProgressColor(current: number, max: number): string {
    if (max === -1) return "";
    const percent = (current / max) * 100;
    if (percent >= 100) return "[&>div]:bg-destructive";
    if (percent >= 80) return "[&>div]:bg-yellow-500";
    return "";
}

function formatUsage(current: number, max: number): string {
    if (max === -1) return `${current}`;
    return `${current}/${max}`;
}

interface UsageItemProps {
    icon: React.ReactNode;
    label: string;
    current: number;
    max: number;
}

function UsageItem({ icon, label, current, max }: UsageItemProps) {
    const isUnlimited = max === -1;
    const percent = isUnlimited ? 0 : Math.min((current / max) * 100, 100);
    const isOverLimit = !isUnlimited && current >= max;

    return (
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 text-muted-foreground">{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{label}</span>
                    <span className={cn("font-medium", getUsageColor(current, max))}>
                        {formatUsage(current, max)}
                    </span>
                </div>
                {!isUnlimited && (
                    <Progress
                        value={percent}
                        className={cn("h-1.5 mt-1", getProgressColor(current, max))}
                    />
                )}
            </div>
        </div>
    );
}

/**
 * Compact subscription usage summary for dashboard
 */
export function SubscriptionUsageSummary({
    plan,
    usage,
    showUpgradeButton = true,
    className,
}: SubscriptionUsageSummaryProps) {
    const hasApproachingLimit = Object.values(usage).some(({ current, max }) => {
        if (max === -1) return false;
        return (current / max) * 100 >= 80;
    });

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Subscription Usage</CardTitle>
                    <PlanBadge plan={plan} size="sm" />
                </div>
                <CardDescription className="text-xs">
                    Current usage across your plan limits
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <UsageItem
                    icon={<Server className="h-4 w-4" />}
                    label="CPI Tenants"
                    current={usage.tenants.current}
                    max={usage.tenants.max}
                />
                <UsageItem
                    icon={<GitBranch className="h-4 w-4" />}
                    label="iFlows"
                    current={usage.iFlows.current}
                    max={usage.iFlows.max}
                />
                <UsageItem
                    icon={<Users className="h-4 w-4" />}
                    label="Team Members"
                    current={usage.teamMembers.current}
                    max={usage.teamMembers.max}
                />
                <UsageItem
                    icon={<Bot className="h-4 w-4" />}
                    label="AI Calls"
                    current={usage.aiAgentCalls.current}
                    max={usage.aiAgentCalls.max}
                />

                {showUpgradeButton && hasApproachingLimit && plan !== "ENTERPRISE" && (
                    <div className="pt-2 border-t">
                        <Button asChild size="sm" className="w-full">
                            <Link href="/dashboard/settings/billing">
                                <Zap className="mr-2 h-3.5 w-3.5" />
                                Upgrade Plan
                                <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
                            </Link>
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Inline AI calls remaining indicator
 */
export function AICallsRemaining({
    current,
    max,
    plan,
    showUpgrade = true,
    className,
}: {
    current: number;
    max: number;
    plan: PlanType;
    showUpgrade?: boolean;
    className?: string;
}) {
    const isUnlimited = max === -1;
    const remaining = isUnlimited ? Infinity : Math.max(0, max - current);
    const percent = isUnlimited ? 0 : Math.min((current / max) * 100, 100);
    const isLow = !isUnlimited && percent >= 80;
    const isExhausted = !isUnlimited && current >= max;

    return (
        <div className={cn("flex items-center gap-3", className)}>
            <div className="flex items-center gap-2">
                <Bot className={cn("h-4 w-4", isExhausted ? "text-destructive" : isLow ? "text-yellow-600" : "text-muted-foreground")} />
                <span className="text-sm">
                    {isUnlimited ? (
                        <span className="text-muted-foreground">Unlimited AI calls</span>
                    ) : isExhausted ? (
                        <span className="text-destructive font-medium">No AI calls remaining</span>
                    ) : (
                        <>
                            <span className={cn("font-medium", isLow && "text-yellow-600")}>
                                {remaining.toLocaleString()}
                            </span>
                            <span className="text-muted-foreground"> AI calls remaining</span>
                        </>
                    )}
                </span>
            </div>

            {showUpgrade && isLow && plan !== "ENTERPRISE" && (
                <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/settings/billing">
                        <Zap className="mr-1.5 h-3 w-3" />
                        Upgrade
                    </Link>
                </Button>
            )}
        </div>
    );
}

/**
 * Team members remaining indicator
 */
export function TeamMembersRemaining({
    current,
    max,
    plan,
    showUpgrade = true,
    className,
}: {
    current: number;
    max: number;
    plan: PlanType;
    showUpgrade?: boolean;
    className?: string;
}) {
    const isUnlimited = max === -1;
    const remaining = isUnlimited ? Infinity : Math.max(0, max - current);
    const percent = isUnlimited ? 0 : Math.min((current / max) * 100, 100);
    const isLow = !isUnlimited && percent >= 80;
    const isExhausted = !isUnlimited && current >= max;

    return (
        <div className={cn("flex items-center gap-3", className)}>
            <div className="flex items-center gap-2">
                <Users className={cn("h-4 w-4", isExhausted ? "text-destructive" : isLow ? "text-yellow-600" : "text-muted-foreground")} />
                <span className="text-sm">
                    {isUnlimited ? (
                        <span className="text-muted-foreground">Unlimited team members</span>
                    ) : isExhausted ? (
                        <span className="text-destructive font-medium">Team member limit reached</span>
                    ) : (
                        <>
                            <span className={cn("font-medium", isLow && "text-yellow-600")}>
                                {remaining}
                            </span>
                            <span className="text-muted-foreground"> team {remaining === 1 ? "slot" : "slots"} remaining</span>
                        </>
                    )}
                </span>
            </div>

            {showUpgrade && isLow && plan !== "ENTERPRISE" && (
                <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/settings/billing">
                        <Zap className="mr-1.5 h-3 w-3" />
                        Upgrade
                    </Link>
                </Button>
            )}
        </div>
    );
}