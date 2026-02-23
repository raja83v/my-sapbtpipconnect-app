import { getCurrentUser } from "@/app/actions/user";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  Zap,
  MessageSquare,
  Clock,
  Calendar,
  BarChart3,
  Activity
} from "lucide-react";
import { agentConfigsV2 } from "@/lib/ai/agent-types-v2";
import { AgentIconWithBackground, AgentProgressBar } from "@/components/dashboard/agent-icon";

export const metadata = {
  title: "Analytics | CPI Connect",
  description: "Track your AI agent usage and performance",
};

export default async function AnalyticsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Get usage statistics
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [aggregates, byAgentTypeRaw, recentExecutions] = await Promise.all([
    prisma.aIAgentExecution.aggregate({
      where: { userId: user.id, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
      _sum: { tokensUsed: true },
      _avg: { duration: true },
    }),
    prisma.aIAgentExecution.groupBy({
      by: ['agentType'],
      where: { userId: user.id, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
    }),
    prisma.aIAgentExecution.findMany({
      where: { userId: user.id },
      take: 50,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const stats = {
    totalExecutions: aggregates._count.id,
    totalTokensUsed: aggregates._sum.tokensUsed || 0,
    avgDuration: aggregates._avg.duration || 0,
    byAgentType: Object.fromEntries(
      byAgentTypeRaw.map(s => [s.agentType, s._count.id])
    ) as Record<string, number>,
  };

  // Calculate additional metrics
  const totalTokens = stats.totalTokensUsed;
  const avgTokensPerExecution = stats.totalExecutions > 0
    ? Math.round(totalTokens / stats.totalExecutions)
    : 0;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
            <BarChart3 className="h-8 w-8 text-indigo-500" />
          </div>
          AI Agents Analytics
        </h1>
        <p className="text-muted-foreground mt-2">
          Track your AI agent usage, token consumption, and performance metrics
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalExecutions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens Used</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(totalTokens / 1000).toFixed(1)}K</div>
            <p className="text-xs text-muted-foreground">Total consumption</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Tokens/Chat</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgTokensPerExecution}</div>
            <p className="text-xs text-muted-foreground">Per interaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats.avgDuration / 1000).toFixed(1)}s</div>
            <p className="text-xs text-muted-foreground">Response time</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="by-agent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="by-agent">
            <Activity className="mr-2 h-4 w-4" />
            By Agent
          </TabsTrigger>
          <TabsTrigger value="history">
            <Calendar className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* By Agent Tab */}
        <TabsContent value="by-agent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage by Agent Type</CardTitle>
              <CardDescription>
                Breakdown of interactions and token usage per agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.byAgentType).map(([agentType, count]) => {
                  const agent = agentConfigsV2[agentType as keyof typeof agentConfigsV2];
                  if (!agent) return null;

                  const percentage = stats.totalExecutions > 0
                    ? Math.round((count / stats.totalExecutions) * 100)
                    : 0;

                  return (
                    <div key={agentType} className="flex items-center gap-4">
                      <AgentIconWithBackground iconName={agent.icon.name} color={agent.color} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{agent.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {count} interactions ({percentage}%)
                          </span>
                        </div>
                        <AgentProgressBar color={agent.color} percentage={percentage} />
                      </div>
                    </div>
                  );
                })}

                {Object.keys(stats.byAgentType).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No agent usage data yet. Start using AI agents to see analytics here.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Interactions</CardTitle>
              <CardDescription>
                Your latest AI agent conversations and executions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {recentExecutions.map((execution: any) => {
                    const agent = agentConfigsV2[execution.agentType as keyof typeof agentConfigsV2];
                    if (!agent) return null;

                    const date = new Date(execution.createdAt);
                    const statusColor = execution.status === "COMPLETED"
                      ? "text-green-500"
                      : execution.status === "FAILED"
                        ? "text-red-500"
                        : "text-yellow-500";

                    return (
                      <div
                        key={execution.id}
                        className="flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <AgentIconWithBackground iconName={agent.icon.name} color={agent.color} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium">{agent.name}</span>
                            <Badge variant="outline" className={statusColor}>
                              {execution.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {execution.input || execution.inputPrompt || "No input recorded"}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {execution.tokensUsed.toLocaleString()} tokens
                            </div>
                            {execution.duration && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {(execution.duration / 1000).toFixed(1)}s
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {date.toLocaleDateString()} {date.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {recentExecutions.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No interaction history yet</p>
                      <p className="text-sm mt-1">Start using AI agents to see your history here</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
