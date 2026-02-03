import { Suspense } from "react";
import { getCurrentUser } from "@/app/actions/user";
import { getUserSubscription } from "@/app/actions/billing";
import { redirect } from "next/navigation";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, TrendingUp, Zap, Bot, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { AgentCard } from "@/components/ai/v2/shared/agent-card";
import { agentConfigsV2, agentCategoriesV2, getHighPriorityAgents } from "@/lib/ai/agent-types-v2";
import { LimitReachedBanner } from "@/components/billing";
import type { PlanType } from "@/lib/stripe-config";

export const metadata = {
    title: "AI Agents V2 | CPI Connect",
    description: "Intelligent AI agents for SAP CPI integration management",
};

export default async function AIAgentsV2Page() {
    const user = await getCurrentUser();

    if (!user) {
        redirect("/sign-in");
    }

    // Get usage statistics and subscription data
    const [agentStats, subscriptionResult] = await Promise.all([
        convex.query(api.aiAgents.getStatsByUser, {
            userId: user.id as Id<"users">,
        }),
        getUserSubscription(),
    ]);

    // Get subscription data
    const subscription = subscriptionResult.success ? subscriptionResult.data?.subscription : null;
    const plan = (subscription?.plan || "FREE") as PlanType;
    const aiCallsCurrent = subscription?.currentAIAgentCalls || 0;
    const aiCallsMax = subscription?.maxAIAgentCalls || 100;
    const aiCallsRemaining = aiCallsMax === -1 ? Infinity : Math.max(0, aiCallsMax - aiCallsCurrent);
    const aiCallsPercent = aiCallsMax === -1 ? 0 : Math.min((aiCallsCurrent / aiCallsMax) * 100, 100);
    const isAICallsLow = aiCallsMax !== -1 && aiCallsPercent >= 80;
    const isAICallsExhausted = aiCallsMax !== -1 && aiCallsCurrent >= aiCallsMax;

    const statsMap = new Map(
        agentStats.map((stat) => [
            stat.agentType,
            {
                executions: stat.executions,
                tokens: stat.tokens,
            },
        ])
    );

    const totalExecutions = agentStats.reduce((sum, stat) => sum + stat.executions, 0);
    const totalTokens = agentStats.reduce((sum, stat) => sum + stat.tokens, 0);

    // Get high priority agents for featured section
    const highPriorityAgents = getHighPriorityAgents();

    return (
        <div className="flex flex-col gap-8 p-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Sparkles className="h-8 w-8 text-indigo-500" />
                        AI Agents
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Intelligent assistants for your SAP CPI integrations
                    </p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/dashboard/ai-agents/analytics">
                        <TrendingUp className="mr-2 h-4 w-4" />
                        View Analytics
                    </Link>
                </Button>
            </div>

            {/* AI Calls Limit Banner */}
            {isAICallsExhausted && (
                <LimitReachedBanner
                    limitType="aiAgentCalls"
                    current={aiCallsCurrent}
                    max={aiCallsMax}
                    currentPlan={plan}
                    variant="error"
                    dismissible={false}
                />
            )}

            {/* Usage Summary */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">AI Calls Remaining</CardTitle>
                        <Bot className={`h-4 w-4 ${isAICallsExhausted ? "text-destructive" : isAICallsLow ? "text-yellow-600" : "text-muted-foreground"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${isAICallsExhausted ? "text-destructive" : isAICallsLow ? "text-yellow-600" : ""}`}>
                            {aiCallsMax === -1 ? "∞" : aiCallsRemaining.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {aiCallsMax === -1 ? "Unlimited" : `${aiCallsCurrent}/${aiCallsMax} used`}
                        </p>
                        {aiCallsMax !== -1 && (
                            <Progress
                                value={aiCallsPercent}
                                className={`h-1.5 mt-2 ${aiCallsPercent >= 100 ? "[&>div]:bg-destructive" : aiCallsPercent >= 80 ? "[&>div]:bg-yellow-500" : ""}`}
                            />
                        )}
                        {isAICallsLow && plan !== "ENTERPRISE" && (
                            <Button asChild variant="link" size="sm" className="px-0 mt-1 h-auto">
                                <Link href="/dashboard/settings/billing" className="text-xs">
                                    <Zap className="mr-1 h-3 w-3" />
                                    Upgrade for more
                                    <ArrowUpRight className="ml-1 h-3 w-3" />
                                </Link>
                            </Button>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalExecutions.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Across all agents</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tokens Used</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(totalTokens / 1000).toFixed(1)}K</div>
                        <p className="text-xs text-muted-foreground">This month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{agentStats.length}</div>
                        <p className="text-xs text-muted-foreground">Out of {Object.keys(agentConfigsV2).length}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Featured: High Priority Agents */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-semibold">Featured Agents</h2>
                        <p className="text-sm text-muted-foreground">
                            Most commonly used and high-impact agents
                        </p>
                    </div>
                    <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-500">
                        High Priority
                    </Badge>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {highPriorityAgents.map((agent) => {
                        const stats = statsMap.get(agent.type);

                        return (
                            <AgentCard
                                key={agent.type}
                                name={agent.name}
                                description={agent.description}
                                iconName={agent.icon.name}
                                color={agent.color}
                                slug={agent.slug}
                                capabilities={agent.capabilities}
                                stats={stats}
                                priority={agent.priority}
                            />
                        );
                    })}
                </div>
            </section>

            {/* All Agents by Category */}
            {Object.entries(agentCategoriesV2).map(([categoryKey, category]) => {
                const categoryAgents = Object.values(agentConfigsV2).filter(
                    (agent) => agent.category === categoryKey && agent.priority !== "high"
                );

                if (categoryAgents.length === 0) return null;

                return (
                    <section key={categoryKey}>
                        <div className="mb-4">
                            <h2 className="text-2xl font-semibold">{category.name}</h2>
                            <p className="text-sm text-muted-foreground">{category.description}</p>
                        </div>
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {categoryAgents.map((agent) => {
                                const stats = statsMap.get(agent.type);

                                return (
                                    <AgentCard
                                        key={agent.type}
                                        name={agent.name}
                                        description={agent.description}
                                        iconName={agent.icon.name}
                                        color={agent.color}
                                        slug={agent.slug}
                                        capabilities={agent.capabilities}
                                        stats={stats}
                                        priority={agent.priority}
                                    />
                                );
                            })}
                        </div>
                    </section>
                );
            })}

            {/* Getting Started */}
            {totalExecutions === 0 && (
                <Card className="border-dashed">
                    <CardHeader>
                        <CardTitle>Getting Started with AI Agents</CardTitle>
                        <CardDescription>
                            Choose an agent above to get started. Each agent is specialized for specific tasks:
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-start gap-2">
                                <Badge variant="outline" className="mt-0.5">💬</Badge>
                                <div>
                                    <strong>AI Assistant</strong> - Ask any question about SAP CPI or get general help
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <Badge variant="outline" className="mt-0.5">🔴</Badge>
                                <div>
                                    <strong>Error Diagnostician</strong> - Diagnose and fix integration errors
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <Badge variant="outline" className="mt-0.5">⚡</Badge>
                                <div>
                                    <strong>Performance Optimizer</strong> - Improve iFlow speed and efficiency
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <Badge variant="outline" className="mt-0.5">📊</Badge>
                                <div>
                                    <strong>Smart Monitor</strong> - Detect anomalies and unusual patterns
                                </div>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}