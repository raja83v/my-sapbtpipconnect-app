import { getCurrentUser } from "@/app/actions/user";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { agentConfigs, agentCategories, type AIAgentType } from "@/lib/ai/agent-types";
import { getAgentBySlugV2 } from "@/lib/ai/agent-types-v2";
import { ArrowRight, Sparkles, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/db";

export default async function AIAgentsPage() {
  // getCurrentUser is cached via React's cache(), so this is efficient
  const user = await getCurrentUser();

  // Layout handles auth redirects, so user will always exist here
  // But we still need it for the database query
  if (!user) {
    return null;
  }

  // Get usage statistics for the user from Prisma
  const agentStatsRaw = await prisma.aIAgentExecution.groupBy({
    by: ['agentType'],
    where: { userId: user.id },
    _count: { id: true },
    _sum: { tokensUsed: true },
  });
  const agentStats = agentStatsRaw.map(stat => ({
    agentType: stat.agentType,
    executions: stat._count.id,
    tokens: stat._sum.tokensUsed || 0,
  }));

  const statsMap = new Map(
    agentStats.map((stat) => [
      stat.agentType,
      {
        executions: stat.executions,
        tokens: stat.tokens,
      },
    ])
  );

  // Get total usage
  const totalExecutions = agentStats.reduce((sum, stat) => sum + stat.executions, 0);
  const totalTokens = agentStats.reduce((sum, stat) => sum + stat.tokens, 0);

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-indigo-500" />
              AI Agents
            </h1>
            <p className="text-muted-foreground mt-1">
              Intelligent automation for your SAP CPI integrations
            </p>
          </div>
          <div className="flex gap-3">
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Usage</p>
                    <p className="text-lg font-semibold">{totalExecutions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tokens Used</p>
                    <p className="text-lg font-semibold">
                      {(totalTokens / 1000).toFixed(1)}K
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Agent Categories */}
        {Object.entries(agentCategories).map(([categoryKey, category]) => {
          const categoryAgents = Object.values(agentConfigs).filter(
            (agent) => agent.category === categoryKey
          );

          return (
            <div key={categoryKey} className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">{category.name}</h2>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {categoryAgents.map((agent) => {
                  const stats = statsMap.get(agent.type as AIAgentType);
                  const agentV2 = getAgentBySlugV2(agent.slug);
                  const hasSpecializedUI = agentV2 && agentV2.uiType !== "chat";

                  // Get icon component dynamically
                  const iconName = typeof agent.icon === 'object' && 'name' in agent.icon
                    ? agent.icon.name
                    : 'Sparkles';

                  // Import icon dynamically
                  const iconModule = require('lucide-react');
                  const Icon = iconModule[iconName] || iconModule.Sparkles;

                  return (
                    <Card
                      key={agent.type}
                      className="group relative overflow-hidden border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all hover:shadow-lg"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <div
                            className={cn(
                              "flex h-12 w-12 items-center justify-center rounded-lg",
                              `bg-${agent.color}-500/10`
                            )}
                          >
                            <Icon className={cn("h-6 w-6", `text-${agent.color}-500`)} />
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            {hasSpecializedUI && (
                              <Badge variant="outline" className="text-xs bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
                                <Zap className="mr-1 h-3 w-3" />
                                Enhanced UI
                              </Badge>
                            )}
                            {stats && stats.executions > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {stats.executions} uses
                              </Badge>
                            )}
                          </div>
                        </div>
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {agent.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-1">
                            {agent.capabilities.slice(0, 3).map((capability, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {capability}
                              </Badge>
                            ))}
                            {agent.capabilities.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{agent.capabilities.length - 3} more
                              </Badge>
                            )}
                          </div>

                          <Button asChild className="w-full group-hover:bg-primary">
                            <Link href={`/dashboard/ai-agents/${agent.slug}`}>
                              Launch Agent
                              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Link>
                          </Button>

                          {stats && stats.tokens > 0 && (
                            <p className="text-xs text-muted-foreground text-center">
                              {(stats.tokens / 1000).toFixed(1)}K tokens used
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Info Card */}
        <Card className="border-indigo-500/20 bg-indigo-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              About AI Agents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              AI Agents are specialized assistants powered by advanced language models to help you
              with various aspects of SAP CPI integration management.
            </p>
            <p>
              Each agent is trained for specific tasks and can access your integration data to
              provide contextual, actionable insights and automation.
            </p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/ai-agents/analytics">View Analytics</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/help">Learn More</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
