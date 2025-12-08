"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  IconChartBar,
  IconTrendingUp,
  IconTrendingDown,
  IconActivity,
  IconClock,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { IFlowDetailData } from "@/app/actions/iflows";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface IFlowAnalyticsTabProps {
  iflow: IFlowDetailData;
}

const chartConfig: ChartConfig = {
  completed: {
    label: "Completed",
    color: "hsl(142, 76%, 36%)", // green
  },
  failed: {
    label: "Failed",
    color: "hsl(0, 84%, 60%)", // red
  },
  total: {
    label: "Total",
    color: "hsl(221, 83%, 53%)", // blue
  },
};

export function IFlowAnalyticsTab({ iflow }: IFlowAnalyticsTabProps) {
  const stats = iflow.stats;

  if (!stats || stats.totalExecutions === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-12">
            <IconChartBar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Analytics Data</h3>
            <p className="text-muted-foreground">
              No execution data available for this iFlow yet.
              Start running the iFlow to see analytics here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare pie chart data
  const pieData = [
    { name: "Completed", value: stats.completedExecutions, color: "hsl(142, 76%, 36%)" },
    { name: "Failed", value: stats.failedExecutions, color: "hsl(0, 84%, 60%)" },
  ].filter(d => d.value > 0);

  // Calculate trend (compare first half vs second half of the week)
  const midPoint = Math.floor(stats.executionsByDay.length / 2);
  const firstHalf = stats.executionsByDay.slice(0, midPoint);
  const secondHalf = stats.executionsByDay.slice(midPoint);
  
  const firstHalfTotal = firstHalf.reduce((sum, d) => sum + d.completed + d.failed, 0);
  const secondHalfTotal = secondHalf.reduce((sum, d) => sum + d.completed + d.failed, 0);
  
  const trend = firstHalfTotal > 0 
    ? ((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100 
    : 0;
  const trendUp = trend > 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Executions"
          value={stats.totalExecutions.toLocaleString()}
          subtitle="Last 7 days"
          icon={<IconActivity className="h-4 w-4" />}
          trend={trend !== 0 ? { value: Math.abs(trend), up: trendUp } : undefined}
        />
        <MetricCard
          title="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
          subtitle={`${stats.completedExecutions} successful`}
          icon={<IconCheck className="h-4 w-4" />}
          valueColor={
            stats.successRate >= 95
              ? "text-green-600"
              : stats.successRate >= 80
                ? "text-yellow-600"
                : "text-red-600"
          }
        />
        <MetricCard
          title="Failed"
          value={stats.failedExecutions.toLocaleString()}
          subtitle="Requires attention"
          icon={<IconX className="h-4 w-4" />}
          valueColor={stats.failedExecutions > 0 ? "text-red-600" : undefined}
        />
        <MetricCard
          title="Avg Duration"
          value={formatDuration(stats.avgDuration)}
          subtitle="Per execution"
          icon={<IconClock className="h-4 w-4" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Execution Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Execution Trend</CardTitle>
            <CardDescription>Daily execution counts over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <AreaChart
                data={stats.executionsByDay}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('en-US', { weekday: 'short' });
                  }}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'short', 
                      day: 'numeric' 
                    });
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stackId="1"
                  stroke="var(--color-completed)"
                  fill="var(--color-completed)"
                  fillOpacity={0.6}
                  name="Completed"
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  stackId="1"
                  stroke="var(--color-failed)"
                  fill="var(--color-failed)"
                  fillOpacity={0.6}
                  name="Failed"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status Distribution</CardTitle>
            <CardDescription>Breakdown by execution status</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
            
            {/* Legend */}
            <div className="flex justify-center gap-6 mt-4">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {entry.name}: {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Breakdown</CardTitle>
          <CardDescription>Execution counts by day</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px]">
            <BarChart
              data={stats.executionsByDay}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                }}
                className="text-xs"
              />
              <YAxis className="text-xs" />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                labelFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric' 
                  });
                }}
              />
              <Bar 
                dataKey="completed" 
                fill="var(--color-completed)" 
                radius={[4, 4, 0, 0]}
                name="Completed"
              />
              <Bar 
                dataKey="failed" 
                fill="var(--color-failed)" 
                radius={[4, 4, 0, 0]}
                name="Failed"
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance Insights</CardTitle>
          <CardDescription>Key observations and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Success Rate Insight */}
            <InsightItem
              type={stats.successRate >= 95 ? "success" : stats.successRate >= 80 ? "warning" : "error"}
              title={
                stats.successRate >= 95
                  ? "Excellent Success Rate"
                  : stats.successRate >= 80
                    ? "Good Success Rate"
                    : "Low Success Rate"
              }
              description={
                stats.successRate >= 95
                  ? `Your iFlow has a ${stats.successRate.toFixed(1)}% success rate. Keep up the good work!`
                  : stats.successRate >= 80
                    ? `Your iFlow has a ${stats.successRate.toFixed(1)}% success rate. Consider reviewing failed executions to improve reliability.`
                    : `Your iFlow has only ${stats.successRate.toFixed(1)}% success rate. Immediate attention is recommended to diagnose and fix recurring issues.`
              }
            />

            {/* Volume Trend Insight */}
            {trend !== 0 && (
              <InsightItem
                type={trendUp ? "info" : "warning"}
                title={trendUp ? "Increasing Volume" : "Decreasing Volume"}
                description={
                  trendUp
                    ? `Execution volume has increased by ${Math.abs(trend).toFixed(0)}% compared to the beginning of the week.`
                    : `Execution volume has decreased by ${Math.abs(trend).toFixed(0)}% compared to the beginning of the week.`
                }
              />
            )}

            {/* Duration Insight */}
            <InsightItem
              type={stats.avgDuration < 5000 ? "success" : stats.avgDuration < 30000 ? "info" : "warning"}
              title="Average Duration"
              description={
                stats.avgDuration < 5000
                  ? `Average execution time is ${formatDuration(stats.avgDuration)}, which is excellent for most use cases.`
                  : stats.avgDuration < 30000
                    ? `Average execution time is ${formatDuration(stats.avgDuration)}. Consider optimization if this affects downstream processes.`
                    : `Average execution time is ${formatDuration(stats.avgDuration)}, which may be impacting performance. Review for optimization opportunities.`
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper Components

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  valueColor?: string;
  trend?: { value: number; up: boolean };
}

function MetricCard({ title, value, subtitle, icon, valueColor, trend }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="flex items-center gap-2">
              <p className={`text-2xl font-bold ${valueColor || ""}`}>{value}</p>
              {trend && (
                <Badge 
                  variant="outline" 
                  className={`text-xs ${trend.up ? "text-green-600" : "text-red-600"}`}
                >
                  {trend.up ? <IconTrendingUp className="h-3 w-3 mr-1" /> : <IconTrendingDown className="h-3 w-3 mr-1" />}
                  {trend.value.toFixed(0)}%
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className="p-2 rounded-lg bg-secondary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface InsightItemProps {
  type: "success" | "warning" | "error" | "info";
  title: string;
  description: string;
}

function InsightItem({ type, title, description }: InsightItemProps) {
  const colors = {
    success: "border-l-green-500 bg-green-50 dark:bg-green-950/20",
    warning: "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
    error: "border-l-red-500 bg-red-50 dark:bg-red-950/20",
    info: "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20",
  };

  const textColors = {
    success: "text-green-700 dark:text-green-400",
    warning: "text-yellow-700 dark:text-yellow-400",
    error: "text-red-700 dark:text-red-400",
    info: "text-blue-700 dark:text-blue-400",
  };

  return (
    <div className={`p-4 rounded-lg border-l-4 ${colors[type]}`}>
      <h4 className={`font-medium ${textColors[type]}`}>{title}</h4>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
