"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    DollarSign,
    ArrowLeft,
    Download,
    RefreshCw,
    Sparkles,
    TrendingUp,
    TrendingDown,
    Minus,
    Settings,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Zap,
    Activity,
    PieChart,
    BarChart3,
    Target,
    Lightbulb,
    ArrowUpRight,
    ArrowDownRight,
    Info,
    Calculator,
    FileJson,
    FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import {
    getIFlowsForCostAnalyzer,
    getCostMetrics,
    analyzeCostsWithAI,
    type CostAnalysisResult,
    type CostPricingConfig,
    type IFlowCostBreakdown,
    type CostDriver,
    type CostOptimization,
} from "@/app/actions/cost-analyzer";
import {
    DEFAULT_PRICING_CONFIG,
    formatCurrency,
    formatCompactNumber,
    getSeverityColor,
} from "@/types/cost-analyzer";

interface CostAnalyzerProps {
    tenantId: string;
    iflowId?: string;
}

// Period options
const PERIOD_OPTIONS = [
    { value: "7", label: "Last 7 days" },
    { value: "14", label: "Last 14 days" },
    { value: "30", label: "Last 30 days" },
    { value: "60", label: "Last 60 days" },
    { value: "90", label: "Last 90 days" },
];

export function CostAnalyzer({ tenantId }: CostAnalyzerProps) {
    // State
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [costAnalysis, setCostAnalysis] = useState<CostAnalysisResult | null>(null);
    const [aiInsights, setAiInsights] = useState<string>("");
    const [activeTab, setActiveTab] = useState("overview");
    const [daysBack, setDaysBack] = useState("30");
    const [pricingConfig, setPricingConfig] = useState<CostPricingConfig>(DEFAULT_PRICING_CONFIG);
    const [showPricingDialog, setShowPricingDialog] = useState(false);
    const [budgetThreshold, setBudgetThreshold] = useState<number | undefined>();
    const [sortColumn, setSortColumn] = useState<keyof IFlowCostBreakdown>("estimatedCost");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

    // Fetch cost metrics on mount and when parameters change
    useEffect(() => {
        fetchCostMetrics();
    }, [tenantId, daysBack]);

    const fetchCostMetrics = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await getCostMetrics({
                tenantId,
                daysBack: parseInt(daysBack),
                pricingConfig,
            });

            if (result.success && result.data) {
                setCostAnalysis(result.data);
            } else {
                setError(result.error || "Failed to fetch cost metrics");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnalyzeWithAI = async () => {
        if (!costAnalysis) return;

        setIsAnalyzing(true);
        setAiInsights("");

        try {
            const result = await analyzeCostsWithAI({
                tenantId,
                costAnalysis,
                budgetThreshold,
            });

            if (result.success && result.data) {
                setAiInsights(result.data.executiveSummary);
                setActiveTab("insights");
                toast.success("AI analysis complete");
            } else {
                toast.error(result.error || "Failed to analyze costs");
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Analysis failed");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleExportCSV = () => {
        if (!costAnalysis) return;

        const headers = ["iFlow Name", "iFlow ID", "Executions", "Success", "Failed", "Error Rate", "Avg Duration (s)", "Execution Cost", "Runtime Cost", "Data Cost", "Total Cost", "% of Total"];
        const rows = costAnalysis.iflowBreakdown.map(iflow => [
            iflow.iflowName,
            iflow.iflowId,
            iflow.executionCount,
            iflow.successCount,
            iflow.failedCount,
            `${iflow.errorRate.toFixed(1)}%`,
            (iflow.avgDuration / 1000).toFixed(2),
            iflow.costBreakdown.executionCost.toFixed(4),
            iflow.costBreakdown.runtimeCost.toFixed(4),
            iflow.costBreakdown.dataTransferCost.toFixed(4),
            iflow.estimatedCost.toFixed(4),
            `${iflow.percentOfTotal.toFixed(1)}%`,
        ]);

        const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cost-analysis-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Cost analysis exported as CSV");
    };

    const handleExportJSON = () => {
        if (!costAnalysis) return;

        const blob = new Blob([JSON.stringify(costAnalysis, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cost-analysis-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Cost analysis exported as JSON");
    };

    const handleUpdatePricing = () => {
        setShowPricingDialog(false);
        fetchCostMetrics();
        toast.success("Pricing configuration updated");
    };

    // Sort iFlow breakdown
    const sortedBreakdown = useMemo(() => {
        if (!costAnalysis) return [];
        return [...costAnalysis.iflowBreakdown].sort((a, b) => {
            const aVal = a[sortColumn];
            const bVal = b[sortColumn];
            if (typeof aVal === "number" && typeof bVal === "number") {
                return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
            }
            return sortDirection === "asc" 
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });
    }, [costAnalysis, sortColumn, sortDirection]);

    const handleSort = (column: keyof IFlowCostBreakdown) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortColumn(column);
            setSortDirection("desc");
        }
    };

    // Render trend icon
    const TrendIcon = ({ trend, percent }: { trend: "up" | "down" | "stable"; percent: number }) => {
        if (trend === "up") {
            return (
                <span className="flex items-center text-red-500">
                    <ArrowUpRight className="h-4 w-4" />
                    <span className="text-xs ml-1">+{percent.toFixed(1)}%</span>
                </span>
            );
        }
        if (trend === "down") {
            return (
                <span className="flex items-center text-green-500">
                    <ArrowDownRight className="h-4 w-4" />
                    <span className="text-xs ml-1">-{Math.abs(percent).toFixed(1)}%</span>
                </span>
            );
        }
        return (
            <span className="flex items-center text-muted-foreground">
                <Minus className="h-4 w-4" />
                <span className="text-xs ml-1">0%</span>
            </span>
        );
    };

    // Render severity badge
    const SeverityBadge = ({ severity }: { severity: "low" | "medium" | "high" | "critical" }) => {
        const colors = {
            low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
            medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
            high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
            critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
        };
        return (
            <Badge className={cn("capitalize", colors[severity])}>
                {severity}
            </Badge>
        );
    };

    // Render effort badge
    const EffortBadge = ({ effort }: { effort: "low" | "medium" | "high" }) => {
        const colors = {
            low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
            medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
            high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
        };
        return (
            <Badge variant="outline" className={cn("capitalize", colors[effort])}>
                {effort} effort
            </Badge>
        );
    };

    // Loading state
    if (isLoading && !costAnalysis) {
        return (
            <div className="flex flex-col gap-6 p-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    // Error state
    if (error && !costAnalysis) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
                <Card className="max-w-md">
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center gap-4">
                            <AlertCircle className="h-12 w-12 text-red-500" />
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Error Loading Cost Data</h3>
                                <p className="text-sm text-muted-foreground">{error}</p>
                            </div>
                            <Button onClick={fetchCostMetrics}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Try Again
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/ai-agents">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                            <DollarSign className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold">Cost Analyzer</h1>
                            <p className="text-sm text-muted-foreground">
                                Analyze and optimize your SAP CPI costs
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Select value={daysBack} onValueChange={setDaysBack}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PERIOD_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="icon">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Pricing Configuration</DialogTitle>
                                <DialogDescription>
                                    Customize the pricing model to match your SAP CPI contract
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="costPerExecution">Cost per Execution ($)</Label>
                                    <Input
                                        id="costPerExecution"
                                        type="number"
                                        step="0.0001"
                                        value={pricingConfig.costPerExecution}
                                        onChange={e => setPricingConfig(prev => ({
                                            ...prev,
                                            costPerExecution: parseFloat(e.target.value) || 0,
                                        }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="costPerMinute">Cost per Minute Runtime ($)</Label>
                                    <Input
                                        id="costPerMinute"
                                        type="number"
                                        step="0.001"
                                        value={pricingConfig.costPerMinuteRuntime}
                                        onChange={e => setPricingConfig(prev => ({
                                            ...prev,
                                            costPerMinuteRuntime: parseFloat(e.target.value) || 0,
                                        }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="costPerMB">Cost per MB Data Transfer ($)</Label>
                                    <Input
                                        id="costPerMB"
                                        type="number"
                                        step="0.01"
                                        value={pricingConfig.costPerMBTransferred}
                                        onChange={e => setPricingConfig(prev => ({
                                            ...prev,
                                            costPerMBTransferred: parseFloat(e.target.value) || 0,
                                        }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="budget">Monthly Budget (optional)</Label>
                                    <Input
                                        id="budget"
                                        type="number"
                                        step="100"
                                        placeholder="Enter budget threshold"
                                        value={budgetThreshold || ""}
                                        onChange={e => setBudgetThreshold(e.target.value ? parseFloat(e.target.value) : undefined)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => {
                                    setPricingConfig(DEFAULT_PRICING_CONFIG);
                                    setBudgetThreshold(undefined);
                                }}>
                                    Reset to Defaults
                                </Button>
                                <Button onClick={handleUpdatePricing}>
                                    Apply Changes
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Button
                        variant="outline"
                        onClick={fetchCostMetrics}
                        disabled={isLoading}
                    >
                        <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                        Refresh
                    </Button>

                    <Button
                        onClick={handleAnalyzeWithAI}
                        disabled={isAnalyzing || !costAnalysis}
                    >
                        <Sparkles className={cn("mr-2 h-4 w-4", isAnalyzing && "animate-pulse")} />
                        {isAnalyzing ? "Analyzing..." : "AI Analysis"}
                    </Button>
                </div>
            </div>

            {costAnalysis && (
                <>
                    {/* Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Estimated Cost</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(costAnalysis.summary.totalCost, pricingConfig.currency)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    for {costAnalysis.periodDays} days
                                </p>
                                {budgetThreshold && (
                                    <div className="mt-2">
                                        <Progress 
                                            value={Math.min((costAnalysis.forecast.currentMonthlyRate / budgetThreshold) * 100, 100)} 
                                            className="h-2"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {((costAnalysis.forecast.currentMonthlyRate / budgetThreshold) * 100).toFixed(0)}% of monthly budget
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatCompactNumber(costAnalysis.summary.totalExecutions)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    across {costAnalysis.summary.iflowCount} iFlows
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Monthly Run Rate</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(costAnalysis.forecast.currentMonthlyRate, pricingConfig.currency)}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <TrendIcon 
                                        trend={costAnalysis.forecast.growthTrend === "increasing" ? "up" : costAnalysis.forecast.growthTrend === "decreasing" ? "down" : "stable"} 
                                        percent={costAnalysis.forecast.growthRate} 
                                    />
                                    <span className="text-xs text-muted-foreground">vs. last period</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
                                <Target className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {formatCurrency(
                                        costAnalysis.optimizations.reduce((sum, opt) => sum + opt.estimatedSavings, 0),
                                        pricingConfig.currency
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    from {costAnalysis.optimizations.length} optimizations
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Main Content Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="overview" className="gap-2">
                                <PieChart className="h-4 w-4" />
                                Overview
                            </TabsTrigger>
                            <TabsTrigger value="breakdown" className="gap-2">
                                <BarChart3 className="h-4 w-4" />
                                Cost Breakdown
                            </TabsTrigger>
                            <TabsTrigger value="drivers" className="gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Cost Drivers
                            </TabsTrigger>
                            <TabsTrigger value="optimizations" className="gap-2">
                                <Lightbulb className="h-4 w-4" />
                                Optimizations
                            </TabsTrigger>
                            <TabsTrigger value="forecast" className="gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Forecast
                            </TabsTrigger>
                            <TabsTrigger value="insights" className="gap-2">
                                <Sparkles className="h-4 w-4" />
                                AI Insights
                            </TabsTrigger>
                        </TabsList>

                        {/* Overview Tab */}
                        <TabsContent value="overview" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Top iFlows by Cost */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Top 5 iFlows by Cost</CardTitle>
                                        <CardDescription>Highest cost contributors</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {costAnalysis.iflowBreakdown.slice(0, 5).map((iflow, idx) => (
                                                <div key={iflow.iflowId} className="flex items-center gap-4">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{iflow.iflowName}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatCompactNumber(iflow.executionCount)} executions
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-medium">
                                                            {formatCurrency(iflow.estimatedCost, pricingConfig.currency)}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {iflow.percentOfTotal.toFixed(1)}%
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Cost Distribution */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Cost Distribution</CardTitle>
                                        <CardDescription>By cost category</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {[
                                                {
                                                    name: "Execution Costs",
                                                    value: costAnalysis.iflowBreakdown.reduce((sum, i) => sum + i.costBreakdown.executionCost, 0),
                                                    color: "bg-blue-500",
                                                },
                                                {
                                                    name: "Runtime Costs",
                                                    value: costAnalysis.iflowBreakdown.reduce((sum, i) => sum + i.costBreakdown.runtimeCost, 0),
                                                    color: "bg-green-500",
                                                },
                                                {
                                                    name: "Data Transfer Costs",
                                                    value: costAnalysis.iflowBreakdown.reduce((sum, i) => sum + i.costBreakdown.dataTransferCost, 0),
                                                    color: "bg-purple-500",
                                                },
                                            ].map(category => {
                                                const percentage = (category.value / costAnalysis.summary.totalCost) * 100;
                                                return (
                                                    <div key={category.name} className="space-y-2">
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="flex items-center gap-2">
                                                                <div className={cn("h-3 w-3 rounded-full", category.color)} />
                                                                {category.name}
                                                            </span>
                                                            <span className="font-medium">
                                                                {formatCurrency(category.value, pricingConfig.currency)}
                                                            </span>
                                                        </div>
                                                        <Progress value={percentage} className="h-2" />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Quick Stats */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Quick Stats</CardTitle>
                                        <CardDescription>Key metrics at a glance</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Avg Cost/Execution</p>
                                                <p className="text-lg font-semibold">
                                                    {formatCurrency(costAnalysis.summary.avgCostPerExecution, pricingConfig.currency)}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Avg Cost/iFlow</p>
                                                <p className="text-lg font-semibold">
                                                    {formatCurrency(costAnalysis.summary.avgCostPerIFlow, pricingConfig.currency)}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Total Runtime</p>
                                                <p className="text-lg font-semibold">
                                                    {costAnalysis.summary.totalRuntimeHours.toFixed(1)}h
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Cost Drivers</p>
                                                <p className="text-lg font-semibold">
                                                    {costAnalysis.costDrivers.length}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Top Optimization */}
                                {costAnalysis.optimizations.length > 0 && (
                                    <Card className="border-green-200 dark:border-green-900">
                                        <CardHeader>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Lightbulb className="h-4 w-4 text-green-500" />
                                                Top Recommendation
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="font-medium">{costAnalysis.optimizations[0].title}</p>
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        {costAnalysis.optimizations[0].description}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-1">
                                                        <DollarSign className="h-4 w-4 text-green-500" />
                                                        <span className="text-sm font-medium text-green-600">
                                                            {formatCurrency(costAnalysis.optimizations[0].estimatedSavings, pricingConfig.currency)}/mo
                                                        </span>
                                                    </div>
                                                    <EffortBadge effort={costAnalysis.optimizations[0].effort} />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </TabsContent>

                        {/* Cost Breakdown Tab */}
                        <TabsContent value="breakdown">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Cost Breakdown by iFlow</CardTitle>
                                        <CardDescription>
                                            Detailed cost analysis for each integration flow
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={handleExportCSV}>
                                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                                            Export CSV
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleExportJSON}>
                                            <FileJson className="mr-2 h-4 w-4" />
                                            Export JSON
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <ScrollArea className="h-[500px]">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead 
                                                        className="cursor-pointer hover:bg-muted/50"
                                                        onClick={() => handleSort("iflowName")}
                                                    >
                                                        iFlow Name
                                                    </TableHead>
                                                    <TableHead 
                                                        className="text-right cursor-pointer hover:bg-muted/50"
                                                        onClick={() => handleSort("executionCount")}
                                                    >
                                                        Executions
                                                    </TableHead>
                                                    <TableHead 
                                                        className="text-right cursor-pointer hover:bg-muted/50"
                                                        onClick={() => handleSort("avgDuration")}
                                                    >
                                                        Avg Duration
                                                    </TableHead>
                                                    <TableHead 
                                                        className="text-right cursor-pointer hover:bg-muted/50"
                                                        onClick={() => handleSort("errorRate")}
                                                    >
                                                        Error Rate
                                                    </TableHead>
                                                    <TableHead 
                                                        className="text-right cursor-pointer hover:bg-muted/50"
                                                        onClick={() => handleSort("estimatedCost")}
                                                    >
                                                        Est. Cost
                                                    </TableHead>
                                                    <TableHead 
                                                        className="text-right cursor-pointer hover:bg-muted/50"
                                                        onClick={() => handleSort("percentOfTotal")}
                                                    >
                                                        % of Total
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sortedBreakdown.map(iflow => (
                                                    <TableRow key={iflow.iflowId}>
                                                        <TableCell className="font-medium">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger className="max-w-[200px] truncate block">
                                                                        {iflow.iflowName}
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>{iflow.iflowId}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {iflow.executionCount.toLocaleString()}
                                                            <span className="text-xs text-muted-foreground ml-1">
                                                                ({iflow.successCount} / {iflow.failedCount})
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {(iflow.avgDuration / 1000).toFixed(2)}s
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span className={cn(
                                                                iflow.errorRate > 10 && "text-red-500",
                                                                iflow.errorRate > 5 && iflow.errorRate <= 10 && "text-yellow-500"
                                                            )}>
                                                                {iflow.errorRate.toFixed(1)}%
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            {formatCurrency(iflow.estimatedCost, pricingConfig.currency)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Progress 
                                                                    value={iflow.percentOfTotal} 
                                                                    className="w-16 h-2" 
                                                                />
                                                                <span className="w-12 text-right">
                                                                    {iflow.percentOfTotal.toFixed(1)}%
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Cost Drivers Tab */}
                        <TabsContent value="drivers">
                            <div className="grid gap-4">
                                {costAnalysis.costDrivers.length === 0 ? (
                                    <Card>
                                        <CardContent className="pt-6">
                                            <div className="flex flex-col items-center text-center gap-4">
                                                <CheckCircle2 className="h-12 w-12 text-green-500" />
                                                <div>
                                                    <h3 className="text-lg font-semibold">No Major Cost Drivers Found</h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        Your integrations appear to be well-optimized!
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    costAnalysis.costDrivers.map((driver, idx) => (
                                        <Card key={idx}>
                                            <CardHeader>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "flex h-10 w-10 items-center justify-center rounded-lg",
                                                            driver.severity === "critical" && "bg-red-500/10",
                                                            driver.severity === "high" && "bg-orange-500/10",
                                                            driver.severity === "medium" && "bg-yellow-500/10",
                                                            driver.severity === "low" && "bg-green-500/10",
                                                        )}>
                                                            <AlertTriangle className={cn(
                                                                "h-5 w-5",
                                                                getSeverityColor(driver.severity)
                                                            )} />
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-base">{driver.name}</CardTitle>
                                                            <CardDescription>{driver.description}</CardDescription>
                                                        </div>
                                                    </div>
                                                    <SeverityBadge severity={driver.severity} />
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid gap-4 md:grid-cols-3">
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Cost Impact</p>
                                                        <p className="text-lg font-semibold text-red-600">
                                                            {formatCurrency(driver.costImpact, pricingConfig.currency)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Potential Savings</p>
                                                        <p className="text-lg font-semibold text-green-600">
                                                            {formatCurrency(driver.potentialSavings, pricingConfig.currency)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Affected iFlows</p>
                                                        <p className="text-lg font-semibold">{driver.affectedIFlows.length}</p>
                                                    </div>
                                                </div>
                                                {driver.affectedIFlows.length > 0 && (
                                                    <div className="mt-4">
                                                        <p className="text-sm text-muted-foreground mb-2">Affected iFlows:</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {driver.affectedIFlows.map(name => (
                                                                <Badge key={name} variant="secondary">
                                                                    {name}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </TabsContent>

                        {/* Optimizations Tab */}
                        <TabsContent value="optimizations">
                            <div className="grid gap-4">
                                {costAnalysis.optimizations.length === 0 ? (
                                    <Card>
                                        <CardContent className="pt-6">
                                            <div className="flex flex-col items-center text-center gap-4">
                                                <CheckCircle2 className="h-12 w-12 text-green-500" />
                                                <div>
                                                    <h3 className="text-lg font-semibold">No Optimizations Needed</h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        Your integrations are running efficiently!
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    costAnalysis.optimizations.map((opt) => (
                                        <Card key={opt.id}>
                                            <CardHeader>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                                                            <Lightbulb className="h-5 w-5 text-green-500" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="text-xs">
                                                                    #{opt.priority}
                                                                </Badge>
                                                                <CardTitle className="text-base">{opt.title}</CardTitle>
                                                            </div>
                                                            <CardDescription className="mt-1">{opt.description}</CardDescription>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <EffortBadge effort={opt.effort} />
                                                        <Badge variant="outline">{opt.category}</Badge>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid gap-4 md:grid-cols-4 mb-4">
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Est. Monthly Savings</p>
                                                        <p className="text-lg font-semibold text-green-600">
                                                            {formatCurrency(opt.estimatedSavings, pricingConfig.currency)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Implementation Risk</p>
                                                        <p className="text-lg font-semibold capitalize">{opt.risk}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">ROI Score</p>
                                                        <p className="text-lg font-semibold">{opt.roiScore.toFixed(1)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Affected iFlows</p>
                                                        <p className="text-lg font-semibold">{opt.affectedIFlows.length || "All"}</p>
                                                    </div>
                                                </div>
                                                
                                                <Separator className="my-4" />
                                                
                                                <div>
                                                    <p className="text-sm font-medium mb-2">Implementation Steps:</p>
                                                    <ol className="list-decimal list-inside space-y-1">
                                                        {opt.implementationSteps.map((step, idx) => (
                                                            <li key={idx} className="text-sm text-muted-foreground">
                                                                {step}
                                                            </li>
                                                        ))}
                                                    </ol>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </TabsContent>

                        {/* Forecast Tab */}
                        <TabsContent value="forecast">
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>6-Month Cost Projection</CardTitle>
                                        <CardDescription>
                                            Based on current trends ({costAnalysis.forecast.confidence * 100}% confidence)
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {costAnalysis.forecast.monthlyProjections.map((proj) => (
                                                <div key={proj.month} className="flex items-center justify-between">
                                                    <span className="text-sm font-medium">{proj.month}</span>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatCurrency(proj.lowerBound, pricingConfig.currency)} - {formatCurrency(proj.upperBound, pricingConfig.currency)}
                                                        </span>
                                                        <span className="text-sm font-semibold w-24 text-right">
                                                            {formatCurrency(proj.projectedCost, pricingConfig.currency)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Forecast Summary</CardTitle>
                                        <CardDescription>Key projections and alerts</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm">Current Monthly Rate</span>
                                                </div>
                                                <span className="font-semibold">
                                                    {formatCurrency(costAnalysis.forecast.currentMonthlyRate, pricingConfig.currency)}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    {costAnalysis.forecast.growthTrend === "increasing" ? (
                                                        <TrendingUp className="h-4 w-4 text-red-500" />
                                                    ) : costAnalysis.forecast.growthTrend === "decreasing" ? (
                                                        <TrendingDown className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <Minus className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                    <span className="text-sm">Growth Trend</span>
                                                </div>
                                                <span className={cn(
                                                    "font-semibold",
                                                    costAnalysis.forecast.growthTrend === "increasing" && "text-red-500",
                                                    costAnalysis.forecast.growthTrend === "decreasing" && "text-green-500"
                                                )}>
                                                    {costAnalysis.forecast.growthRate > 0 ? "+" : ""}
                                                    {costAnalysis.forecast.growthRate}% monthly
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <Target className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm">6-Month Projection</span>
                                                </div>
                                                <span className="font-semibold">
                                                    {formatCurrency(
                                                        costAnalysis.forecast.monthlyProjections[5]?.projectedCost || 0,
                                                        pricingConfig.currency
                                                    )}
                                                </span>
                                            </div>

                                            {budgetThreshold && (
                                                <div className={cn(
                                                    "flex items-center justify-between p-3 rounded-lg",
                                                    costAnalysis.forecast.currentMonthlyRate > budgetThreshold * 0.9
                                                        ? "bg-red-500/10"
                                                        : costAnalysis.forecast.currentMonthlyRate > budgetThreshold * 0.7
                                                        ? "bg-yellow-500/10"
                                                        : "bg-green-500/10"
                                                )}>
                                                    <div className="flex items-center gap-2">
                                                        <AlertCircle className={cn(
                                                            "h-4 w-4",
                                                            costAnalysis.forecast.currentMonthlyRate > budgetThreshold * 0.9
                                                                ? "text-red-500"
                                                                : costAnalysis.forecast.currentMonthlyRate > budgetThreshold * 0.7
                                                                ? "text-yellow-500"
                                                                : "text-green-500"
                                                        )} />
                                                        <span className="text-sm">Budget Status</span>
                                                    </div>
                                                    <span className="font-semibold">
                                                        {((costAnalysis.forecast.currentMonthlyRate / budgetThreshold) * 100).toFixed(0)}% utilized
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* AI Insights Tab */}
                        <TabsContent value="insights">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <Sparkles className="h-5 w-5 text-purple-500" />
                                                AI-Powered Cost Insights
                                            </CardTitle>
                                            <CardDescription>
                                                In-depth analysis and recommendations from AI
                                            </CardDescription>
                                        </div>
                                        <Button
                                            onClick={handleAnalyzeWithAI}
                                            disabled={isAnalyzing}
                                        >
                                            <RefreshCw className={cn("mr-2 h-4 w-4", isAnalyzing && "animate-spin")} />
                                            {aiInsights ? "Regenerate" : "Generate Insights"}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {isAnalyzing ? (
                                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                                            <div className="relative">
                                                <Sparkles className="h-8 w-8 text-purple-500 animate-pulse" />
                                            </div>
                                            <p className="text-sm text-muted-foreground">Analyzing cost data...</p>
                                            {aiInsights && (
                                                <ScrollArea className="h-[400px] w-full mt-4">
                                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                                        <div className="whitespace-pre-wrap">{aiInsights}</div>
                                                    </div>
                                                </ScrollArea>
                                            )}
                                        </div>
                                    ) : aiInsights ? (
                                        <ScrollArea className="h-[500px]">
                                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                                <div className="whitespace-pre-wrap">{aiInsights}</div>
                                            </div>
                                        </ScrollArea>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                                            <Sparkles className="h-12 w-12 text-muted-foreground" />
                                            <div className="text-center">
                                                <h3 className="text-lg font-semibold">No AI Insights Yet</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Click &quot;Generate Insights&quot; to get AI-powered cost analysis
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    );
}
