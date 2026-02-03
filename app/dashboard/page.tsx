import { Suspense } from "react";
import { getCurrentUser } from "@/app/actions/user";
import { getDashboardData } from "@/app/actions/dashboard";
import { getUserSubscription } from "@/app/actions/billing";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentExecutions } from "@/components/dashboard/recent-executions";
import { TenantOverview } from "@/components/dashboard/tenant-overview";
import { IFlowStatusList } from "@/components/dashboard/iflow-status-list";
import { AIAgentUsageCard } from "@/components/dashboard/ai-agent-usage";
import { ExecutionTrendChart } from "@/components/dashboard/execution-trend-chart";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { SubscriptionUsageSummary } from "@/components/billing";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Zap,
  Clock
} from "lucide-react";
import type { PlanType } from "@/lib/stripe-config";

function StatsCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-32" />
      ))}
    </div>
  );
}

function CardSkeleton() {
  return <Skeleton className="h-80" />;
}

async function DashboardContent() {
  const [user, dashboardResult, subscriptionResult] = await Promise.all([
    getCurrentUser(),
    getDashboardData(),
    getUserSubscription(),
  ]);

  if (!dashboardResult.success || !dashboardResult.data) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground">Failed to load dashboard data</p>
        <p className="text-sm text-muted-foreground/70">{dashboardResult.error}</p>
      </div>
    );
  }

  const {
    stats,
    tenants,
    recentExecutions,
    iFlowStatuses,
    aiAgentUsage,
    executionTrend
  } = dashboardResult.data;

  // Get subscription data
  const subscription = subscriptionResult.success ? subscriptionResult.data?.subscription : null;
  const plan = (subscription?.plan || "FREE") as PlanType;
  const usageData = {
    tenants: {
      current: subscription?.currentTenantCount || 0,
      max: subscription?.maxTenants || 1
    },
    iFlows: {
      current: subscription?.currentIFlowCount || 0,
      max: subscription?.maxIFlows || 10
    },
    teamMembers: {
      current: subscription?.currentTeamMemberCount || 0,
      max: subscription?.maxTeamMembers || 3
    },
    aiAgentCalls: {
      current: subscription?.currentAIAgentCalls || 0,
      max: subscription?.maxAIAgentCalls || 100
    },
  };

  const greeting = getGreeting();
  const firstName = user?.name?.split(" ")[0] || "there";

  // Get selected tenant ID (default tenant or first available)
  const selectedTenantId = user?.defaultTenantId && tenants.some(t => t.id === user.defaultTenantId)
    ? user.defaultTenantId
    : tenants[0]?.id || null;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {greeting}, {firstName}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening with your SAP CPI integrations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1 py-1.5">
            <Clock className="h-3 w-3" />
            Last updated: {new Date().toLocaleTimeString()}
          </Badge>
          <Button asChild>
            <Link href="/dashboard/ai-agents" className="gap-2">
              <Sparkles className="h-4 w-4" />
              AI Agents
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <StatsCards stats={stats} />

      {/* Execution Trend Chart */}
      <ExecutionTrendChart data={executionTrend} />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Executions / Active iFlows - Takes 2 columns */}
        <div className="col-span-full lg:col-span-2">
          <RecentExecutions
            executions={recentExecutions}
            activeIFlows={iFlowStatuses}
          />
        </div>

        {/* Right Column - Stacked Cards */}
        <div className="space-y-6">
          <QuickActions tenantIds={selectedTenantId ? [selectedTenantId] : []} />
          <SubscriptionUsageSummary
            plan={plan}
            usage={usageData}
            showUpgradeButton={true}
          />
          <AIAgentUsageCard
            usage={aiAgentUsage}
            totalTokens={stats.totalTokensUsed}
          />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TenantOverview tenants={tenants} />
        <IFlowStatusList iflows={iFlowStatuses} />
      </div>

      {/* CTA Banner */}
      {stats.totalAIExecutions === 0 && (
        <Card className="border-indigo-500/30 bg-linear-to-r from-indigo-500/10 to-purple-500/10">
          <CardContent className="flex flex-col md:flex-row items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-indigo-500/20">
                <Sparkles className="h-8 w-8 text-indigo-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Try AI-Powered Automation</h3>
                <p className="text-sm text-muted-foreground">
                  Let our intelligent agents help you create, monitor, and optimize your integrations
                </p>
              </div>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link href="/dashboard/ai-agents">
                Get Started
                <Zap className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-5 w-96" />
          </div>
          <StatsCardsSkeleton />
          <Skeleton className="h-64" />
          <div className="grid gap-6 lg:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      }>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
