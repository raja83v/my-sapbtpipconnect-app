import { getCurrentUser } from "@/app/actions/user";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { agentConfigs } from "@/lib/ai/agent-types";
import { TrendingUp, Zap, Clock, DollarSign } from "lucide-react";

export default async function AgentAnalyticsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Get comprehensive analytics
  const executions = await prisma.aIAgentExecution.findMany({
    where: { userId: user.id },
    take: 1000,
    orderBy: { createdAt: 'desc' },
  });

  const totalExecutions = executions.length;
  const totalTokens = executions.reduce((sum, e) => sum + e.tokensUsed, 0);
  const avgDuration = executions.length > 0
    ? executions.reduce((sum, e) => sum + (e.duration || 0), 0) / executions.length
    : 0;
  const completedCount = executions.filter((e) => e.status === "COMPLETED").length;
  const failedCount = executions.filter((e) => e.status === "FAILED").length;
  const successRate = totalExecutions > 0 ? (completedCount / totalExecutions) * 100 : 0;

  // Cost estimation (based on Gemini pricing: $0.075 per 1M input tokens, $0.30 per 1M output tokens)
  // Rough estimate: assume 50/50 split
  const estimatedCost = (totalTokens / 1000000) * 0.1875;

  // Group by agent type
  const byAgentType = executions.reduce((acc, e) => {
    if (!acc[e.agentType]) {
      acc[e.agentType] = { executions: 0, tokens: 0, avgDuration: 0, durations: [] as number[] };
    }
    acc[e.agentType].executions++;
    acc[e.agentType].tokens += e.tokensUsed;
    if (e.duration) {
      acc[e.agentType].durations.push(e.duration);
    }
    return acc;
  }, {} as Record<string, { executions: number; tokens: number; avgDuration: number; durations: number[] }>);

  // Calculate average duration for each agent type
  Object.keys(byAgentType).forEach((agentType) => {
    const stats = byAgentType[agentType];
    if (stats.durations.length > 0) {
      stats.avgDuration = stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length;
    }
  });

  // Recent activity
  const recentActivity = executions.slice(0, 10);

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Agent Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track your AI agent usage, performance, and costs
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalExecutions}</div>
              <p className="text-xs text-muted-foreground">
                {successRate.toFixed(1)}% success rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tokens Used</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(totalTokens / 1000).toFixed(1)}K
              </div>
              <p className="text-xs text-muted-foreground">
                Across all agents
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(avgDuration / 1000).toFixed(1)}s
              </div>
              <p className="text-xs text-muted-foreground">
                Per execution
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${estimatedCost.toFixed(4)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total API costs
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Usage by Agent Type */}
        <Card>
          <CardHeader>
            <CardTitle>Usage by Agent Type</CardTitle>
            <CardDescription>
              Breakdown of executions and tokens by each AI agent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(byAgentType)
                .sort((a, b) => b[1].executions - a[1].executions)
                .map(([agentType, stats]) => {
                  const agent = agentConfigs[agentType as keyof typeof agentConfigs];
                  if (!agent) return null;

                  const Icon = agent.icon;
                  const percentage = (stats.executions / totalExecutions) * 100;

                  return (
                    <div key={agentType} className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${agent.color}-500/10 shrink-0`}>
                        <Icon className={`h-5 w-5 text-${agent.color}-500`} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{agent.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {stats.executions} uses ({percentage.toFixed(1)}%)
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{(stats.tokens / 1000).toFixed(1)}K tokens</span>
                          <span>•</span>
                          <span>{(stats.avgDuration / 1000).toFixed(1)}s avg</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-${agent.color}-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest AI agent executions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((execution) => {
                const agent = agentConfigs[execution.agentType as keyof typeof agentConfigs];
                if (!agent) return null;

                const Icon = agent.icon;

                return (
                  <div key={execution.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-${agent.color}-500/10 shrink-0`}>
                      <Icon className={`h-4 w-4 text-${agent.color}-500`} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium">{agent.name}</p>
                        <Badge
                          variant={execution.status === "COMPLETED" ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {execution.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {execution.inputPrompt}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{new Date(execution.createdAt).toLocaleString()}</span>
                        <span>•</span>
                        <span>{execution.tokensUsed} tokens</span>
                        {execution.duration && (
                          <>
                            <span>•</span>
                            <span>{(execution.duration / 1000).toFixed(2)}s</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
