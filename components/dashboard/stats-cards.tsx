"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Server, 
  Workflow,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/app/actions/dashboard";

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: "Total iFlows",
      value: stats.totalIFlows,
      description: `${stats.activeIFlows} active, ${stats.stoppedIFlows} stopped`,
      icon: Workflow,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
      trend: stats.activeIFlows > 0 ? "up" : "neutral",
    },
    {
      title: "Executions (30d)",
      value: stats.totalExecutions.toLocaleString(),
      description: `${stats.successfulExecutions.toLocaleString()} successful`,
      icon: Activity,
      iconColor: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      trend: stats.successRate >= 95 ? "up" : stats.successRate >= 80 ? "neutral" : "down",
    },
    {
      title: "Success Rate",
      value: `${stats.successRate.toFixed(1)}%`,
      description: `${stats.failedExecutions.toLocaleString()} failures`,
      icon: stats.successRate >= 95 ? CheckCircle2 : stats.successRate >= 80 ? Activity : XCircle,
      iconColor: stats.successRate >= 95 ? "text-green-500" : stats.successRate >= 80 ? "text-yellow-500" : "text-red-500",
      bgColor: stats.successRate >= 95 ? "bg-green-500/10" : stats.successRate >= 80 ? "bg-yellow-500/10" : "bg-red-500/10",
      trend: stats.successRate >= 95 ? "up" : stats.successRate >= 80 ? "neutral" : "down",
    },
    {
      title: "Connected Tenants",
      value: stats.activeTenants,
      description: `${stats.totalTenants} total tenants`,
      icon: Server,
      iconColor: "text-purple-500",
      bgColor: "bg-purple-500/10",
      trend: stats.activeTenants > 0 ? "up" : "neutral",
    },
    {
      title: "AI Interactions",
      value: stats.totalAIExecutions.toLocaleString(),
      description: `${(stats.totalTokensUsed / 1000).toFixed(1)}K tokens used`,
      icon: Sparkles,
      iconColor: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
      trend: stats.totalAIExecutions > 0 ? "up" : "neutral",
    },
  ];

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === "up") return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (trend === "down") return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card, index) => (
        <Card key={index} className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={cn("p-2 rounded-lg", card.bgColor)}>
              <card.icon className={cn("h-4 w-4", card.iconColor)} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{card.value}</div>
              <TrendIcon trend={card.trend} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
          </CardContent>
          {/* Decorative gradient */}
          <div className={cn(
            "absolute bottom-0 left-0 right-0 h-1",
            card.iconColor.replace("text-", "bg-")
          )} />
        </Card>
      ))}
    </div>
  );
}
