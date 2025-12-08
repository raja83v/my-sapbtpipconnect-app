"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Sparkles, 
  Bot,
  Zap,
  FileText,
  Shield,
  TestTube,
  TrendingUp,
  DollarSign,
  AlertCircle,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { AIAgentUsage } from "@/app/actions/dashboard";

interface AIAgentUsageCardProps {
  usage: AIAgentUsage[];
  totalTokens: number;
}

const agentConfig: Record<string, { icon: any; color: string; name: string }> = {
  IFLOW_CREATOR: { icon: Zap, color: "text-amber-500", name: "iFlow Creator" },
  SMART_MONITOR: { icon: TrendingUp, color: "text-green-500", name: "Smart Monitor" },
  PERFORMANCE_OPTIMIZER: { icon: Zap, color: "text-orange-500", name: "Performance Optimizer" },
  ERROR_DIAGNOSTICIAN: { icon: AlertCircle, color: "text-red-500", name: "Error Diagnostician" },
  SECURITY_AUDITOR: { icon: Shield, color: "text-purple-500", name: "Security Auditor" },
  DOCUMENTATION_GENERATOR: { icon: FileText, color: "text-blue-500", name: "Documentation Generator" },
  TEST_CASE_GENERATOR: { icon: TestTube, color: "text-cyan-500", name: "Test Case Generator" },
  COST_ANALYZER: { icon: DollarSign, color: "text-emerald-500", name: "Cost Analyzer" },
  PREDICTIVE_INSIGHTS: { icon: TrendingUp, color: "text-indigo-500", name: "Predictive Insights" },
};

export function AIAgentUsageCard({ usage, totalTokens }: AIAgentUsageCardProps) {
  const totalInteractions = usage.reduce((sum, u) => sum + u.count, 0);
  const maxCount = Math.max(...usage.map((u) => u.count), 1);

  if (usage.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            AI Agent Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Bot className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No AI interactions yet</p>
            <p className="text-sm text-muted-foreground/70 mb-4">
              Try our AI agents for intelligent automation
            </p>
            <Button asChild>
              <Link href="/dashboard/ai-agents">
                <Sparkles className="h-4 w-4 mr-2" />
                Explore AI Agents
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          AI Agent Usage
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/ai-agents" className="gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <p className="text-2xl font-bold">{totalInteractions}</p>
            <p className="text-xs text-muted-foreground">Total Interactions</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{(totalTokens / 1000).toFixed(1)}K</p>
            <p className="text-xs text-muted-foreground">Tokens Used</p>
          </div>
        </div>

        {/* Usage by Agent */}
        <div className="space-y-3">
          {usage.slice(0, 5).map((agent) => {
            const config = agentConfig[agent.agentType] || { 
              icon: Bot, 
              color: "text-gray-500", 
              name: agent.agentType 
            };
            const Icon = config.icon;
            const percentage = (agent.count / maxCount) * 100;

            return (
              <div key={agent.agentType} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", config.color)} />
                    <span className="font-medium">{config.name}</span>
                  </div>
                  <span className="text-muted-foreground">{agent.count} uses</span>
                </div>
                <Progress value={percentage} className="h-1.5" />
              </div>
            );
          })}
        </div>

        {usage.length > 5 && (
          <p className="text-xs text-muted-foreground text-center">
            +{usage.length - 5} more agents used
          </p>
        )}
      </CardContent>
    </Card>
  );
}
