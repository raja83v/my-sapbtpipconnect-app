"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
    Zap,
    ArrowLeft,
    Download,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Clock,
    Target,
    Lightbulb,
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    ChevronRight,
    ChevronDown,
    Code,
    Copy,
    Check,
    BarChart3,
    Activity,
    Database,
    Network,
    Cpu,
    HardDrive,
    Search,
    Calendar as CalendarIcon,
    ChevronsUpDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getIFlowsForOptimizer, analyzeIFlowPerformance } from "@/app/actions/ai-agents-v2";
import { format, subDays } from "date-fns";

interface PerformanceOptimizerProps {
    tenantId: string;
    iflowId?: string;
}

interface PerformanceMetrics {
    score: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
    errorRate: number;
    successRate: number;
}

interface Bottleneck {
    id: string;
    title: string;
    category: "database" | "network" | "cpu" | "memory" | "payload" | "configuration";
    severity: "critical" | "high" | "medium" | "low";
    impact: number; // percentage impact on performance
    currentValue: string;
    targetValue: string;
    description: string;
    recommendations: Recommendation[];
}

interface Recommendation {
    id: string;
    title: string;
    description: string;
    effort: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    expectedImprovement: string;
    implementationTime: string;
    steps: string[];
    codeExample?: string;
}

interface OptimizationOpportunity {
    id: string;
    title: string;
    description: string;
    potentialGain: string;
    effort: "low" | "medium" | "high";
    category: string;
}

export function PerformanceOptimizer({ tenantId, iflowId }: PerformanceOptimizerProps) {
    const [iflows, setIflows] = useState<Array<{ id: string; name: string }>>([]);
    const [selectedIflowId, setSelectedIflowId] = useState<string>(iflowId || "");
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
    const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
    const [opportunities, setOpportunities] = useState<OptimizationOpportunity[]>([]);
    const [bpmn2Analysis, setBpmn2Analysis] = useState<any>(null);
    const [dataSource, setDataSource] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [selectedBottleneck, setSelectedBottleneck] = useState<Bottleneck | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [daysBack, setDaysBack] = useState(7);
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    // Sort and filter iFlows
    const sortedAndFilteredIflows = useMemo(() => {
        return iflows
            .filter(iflow =>
                iflow.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [iflows, searchQuery]);

    useEffect(() => {
        loadIflows();
    }, [tenantId]);

    const loadIflows = async () => {
        setIsLoading(true);
        try {
            const result = await getIFlowsForOptimizer({ tenantId });

            if (result.success && result.data) {
                // Sort iFlows alphabetically by name
                const sortedIflows = result.data.sort((a, b) => a.name.localeCompare(b.name));
                setIflows(sortedIflows);

                // If iflowId prop is provided, select it
                if (iflowId) {
                    setSelectedIflowId(iflowId);
                }
            } else {
                toast.error(result.error || "Failed to load iFlows");
            }
        } catch (error) {
            console.error("Error loading iFlows:", error);
            toast.error("Failed to load iFlows");
        } finally {
            setIsLoading(false);
        }
    };

    const analyzePerformance = async () => {
        if (!selectedIflowId) {
            toast.error("Please select an iFlow to analyze");
            return;
        }

        setIsAnalyzing(true);

        try {
            const result = await analyzeIFlowPerformance({
                tenantId,
                iflowId: selectedIflowId,
                daysBack,
            });

            if (result.success && result.data) {
                const {
                    metrics: performanceMetrics,
                    bottlenecks: analysisBottlenecks,
                    opportunities: analysisOpportunities,
                    bpmn2Analysis: bpmn2Data,
                    dataSource: sourceInfo
                } = result.data;

                setMetrics(performanceMetrics);
                setBottlenecks(analysisBottlenecks);
                setOpportunities(analysisOpportunities);
                setBpmn2Analysis(bpmn2Data);
                setDataSource(sourceInfo);

                toast.success("Performance analysis complete");
            } else {
                toast.error(result.error || "Failed to analyze performance");
            }
        } catch (error) {
            toast.error("Failed to analyze performance");
            console.error(error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        toast.success("Copied to clipboard");
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-green-500";
        if (score >= 60) return "text-yellow-500";
        return "text-red-500";
    };

    const getScoreBg = (score: number) => {
        if (score >= 80) return "bg-green-500/10";
        if (score >= 60) return "bg-yellow-500/10";
        return "bg-red-500/10";
    };

    if (selectedBottleneck) {
        return (
            <BottleneckDetailView
                bottleneck={selectedBottleneck}
                onBack={() => setSelectedBottleneck(null)}
                onCopy={copyToClipboard}
                copiedId={copiedId}
            />
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20">
                            <Zap className="h-8 w-8 text-purple-500" />
                        </div>
                        Performance Optimizer
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        AI-powered performance analysis and optimization recommendations
                    </p>
                </div>
            </div>

            {/* iFlow Selection */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-[2fr_1.5fr_1.5fr]">
                        {/* iFlow Selector */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Select iFlow</Label>
                            <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={open}
                                        className="w-full justify-between"
                                    >
                                        {selectedIflowId
                                            ? iflows.find((iflow) => iflow.id === selectedIflowId)?.name
                                            : "Search iFlows..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0">
                                    <Command>
                                        <CommandInput
                                            placeholder="Search iFlows..."
                                            value={searchQuery}
                                            onValueChange={setSearchQuery}
                                        />
                                        <CommandList>
                                            <CommandEmpty>No iFlow found.</CommandEmpty>
                                            <CommandGroup>
                                                <ScrollArea className="h-[300px]">
                                                    {sortedAndFilteredIflows.map((iflow) => (
                                                        <CommandItem
                                                            key={iflow.id}
                                                            value={iflow.name}
                                                            onSelect={() => {
                                                                setSelectedIflowId(iflow.id);
                                                                setOpen(false);
                                                                setSearchQuery("");
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedIflowId === iflow.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {iflow.name}
                                                        </CommandItem>
                                                    ))}
                                                </ScrollArea>
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Date Range Selector */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Analysis Period (Days)</Label>
                            <div className="space-y-1">
                                <Input
                                    type="number"
                                    min="1"
                                    max="90"
                                    value={daysBack}
                                    onChange={(e) => {
                                        const days = parseInt(e.target.value) || 7;
                                        setDaysBack(days);
                                        setDateRange({
                                            from: subDays(new Date(), days),
                                            to: new Date(),
                                        });
                                    }}
                                    placeholder="Days back"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd, yyyy")}
                                </p>
                            </div>
                        </div>

                        {/* Analyze Button */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium opacity-0">Action</Label>
                            <Button
                                onClick={analyzePerformance}
                                disabled={!selectedIflowId || isAnalyzing}
                                className="w-full"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <BarChart3 className="mr-2 h-4 w-4" />
                                        Analyze Performance
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results */}
            {isAnalyzing ? (
                <div className="space-y-4">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-64" />
                    <Skeleton className="h-96" />
                </div>
            ) : metrics ? (
                <>
                    {/* Performance Score */}
                    <Card className={cn("border-2", getScoreBg(metrics.score))}>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-muted-foreground">Performance Score</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className={cn("text-5xl font-bold", getScoreColor(metrics.score))}>
                                            {metrics.score}
                                        </span>
                                        <span className="text-2xl text-muted-foreground">/100</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {metrics.score >= 80 ? "Excellent" : metrics.score >= 60 ? "Good" : "Needs Improvement"}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Button variant="outline" size="sm">
                                        <Download className="mr-2 h-4 w-4" />
                                        Export Report
                                    </Button>
                                    <Button variant="outline" size="sm">
                                        <Clock className="mr-2 h-4 w-4" />
                                        Schedule Analysis
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Metrics Grid */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <MetricCard
                            title="Avg Response Time"
                            value={`${(metrics.avgResponseTime / 1000).toFixed(2)}s`}
                            icon={Clock}
                            trend={metrics.avgResponseTime > 5000 ? "down" : "up"}
                            trendValue="vs 2s target"
                        />
                        <MetricCard
                            title="Throughput"
                            value={`${metrics.throughput} req/min`}
                            icon={Activity}
                            trend="up"
                            trendValue="+12% from last week"
                        />
                        <MetricCard
                            title="Success Rate"
                            value={`${metrics.successRate.toFixed(1)}%`}
                            icon={CheckCircle2}
                            trend={metrics.successRate >= 95 ? "up" : "down"}
                            trendValue={`${metrics.errorRate.toFixed(1)}% errors`}
                        />
                    </div>

                    {/* Bottlenecks */}
                    {bottlenecks.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-red-500" />
                                    Critical Bottlenecks ({bottlenecks.filter(b => b.severity === "critical" || b.severity === "high").length})
                                </CardTitle>
                                <CardDescription>
                                    Performance issues ranked by impact
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {bottlenecks
                                    .sort((a, b) => b.impact - a.impact)
                                    .map((bottleneck, index) => (
                                        <BottleneckCard
                                            key={bottleneck.id}
                                            bottleneck={bottleneck}
                                            rank={index + 1}
                                            onClick={() => setSelectedBottleneck(bottleneck)}
                                        />
                                    ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Optimization Opportunities */}
                    {opportunities.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                                    Optimization Opportunities ({opportunities.length})
                                </CardTitle>
                                <CardDescription>
                                    Additional improvements to consider
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {opportunities.map((opp) => (
                                        <OpportunityCard key={opp.id} opportunity={opp} />
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* BPMN2 Configuration Analysis */}
                    {bpmn2Analysis && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Code className="h-5 w-5 text-blue-500" />
                                    iFlow Configuration Analysis
                                </CardTitle>
                                <CardDescription>
                                    Detailed analysis from BPMN2 XML package
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Tabs defaultValue="overview" className="w-full">
                                    <TabsList className="grid w-full grid-cols-5">
                                        <TabsTrigger value="overview">Overview</TabsTrigger>
                                        <TabsTrigger value="adapters">Adapters ({bpmn2Analysis.adapters?.length || 0})</TabsTrigger>
                                        <TabsTrigger value="scripts">Scripts ({bpmn2Analysis.scripts?.length || 0})</TabsTrigger>
                                        <TabsTrigger value="mappings">Mappings ({bpmn2Analysis.mappings?.length || 0})</TabsTrigger>
                                        <TabsTrigger value="errors">Error Handling</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="overview" className="space-y-4 mt-4">
                                        <div className="grid gap-4 md:grid-cols-3">
                                            <Card>
                                                <CardHeader className="pb-3">
                                                    <CardTitle className="text-sm font-medium">Total Steps</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold">{bpmn2Analysis.metadata?.totalSteps || 0}</div>
                                                </CardContent>
                                            </Card>
                                            <Card>
                                                <CardHeader className="pb-3">
                                                    <CardTitle className="text-sm font-medium">Parallel Processing</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold">
                                                        {bpmn2Analysis.metadata?.hasParallelProcessing ? 'Yes' : 'No'}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            <Card>
                                                <CardHeader className="pb-3">
                                                    <CardTitle className="text-sm font-medium">Contains Loops</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="text-2xl font-bold">
                                                        {bpmn2Analysis.metadata?.hasLoops ? 'Yes' : 'No'}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="adapters" className="space-y-3 mt-4">
                                        {bpmn2Analysis.adapters?.length > 0 ? (
                                            bpmn2Analysis.adapters.map((adapter: any, idx: number) => (
                                                <Card key={idx} className={adapter.performanceIssues?.length > 0 ? "border-orange-500/20" : ""}>
                                                    <CardHeader className="pb-3">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <CardTitle className="text-base">{adapter.name}</CardTitle>
                                                                <CardDescription className="mt-1">
                                                                    {adapter.type} - {adapter.direction}
                                                                </CardDescription>
                                                            </div>
                                                            {adapter.performanceIssues?.length > 0 && (
                                                                <Badge variant="outline" className="bg-orange-500/10 text-orange-500">
                                                                    {adapter.performanceIssues.length} issue{adapter.performanceIssues.length > 1 ? 's' : ''}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="space-y-2">
                                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                                            <div>
                                                                <span className="text-muted-foreground">Connection Timeout:</span>
                                                                <span className="ml-2 font-medium">
                                                                    {adapter.connectionTimeout ? `${adapter.connectionTimeout}ms` : 'Not configured'}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-muted-foreground">Response Timeout:</span>
                                                                <span className="ml-2 font-medium">
                                                                    {adapter.responseTimeout ? `${adapter.responseTimeout}ms` : 'Not configured'}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-muted-foreground">Pool Size:</span>
                                                                <span className="ml-2 font-medium">
                                                                    {adapter.poolSize || 'Not configured'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {adapter.performanceIssues?.length > 0 && (
                                                            <div className="mt-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                                                                <p className="text-sm font-medium text-orange-500 mb-2">⚠️ Performance Issues:</p>
                                                                <ul className="text-sm space-y-1">
                                                                    {adapter.performanceIssues.map((issue: string, i: number) => (
                                                                        <li key={i} className="text-muted-foreground">• {issue}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-8">No adapters found</p>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="scripts" className="space-y-3 mt-4">
                                        {bpmn2Analysis.scripts?.length > 0 ? (
                                            bpmn2Analysis.scripts.map((script: any, idx: number) => (
                                                <Card key={idx} className={script.issues?.length > 0 ? "border-orange-500/20" : ""}>
                                                    <CardHeader className="pb-3">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <CardTitle className="text-base">{script.name}</CardTitle>
                                                                <CardDescription className="mt-1">{script.type}</CardDescription>
                                                            </div>
                                                            <Badge variant="outline" className={
                                                                script.complexity === 'complex' ? 'bg-red-500/10 text-red-500' :
                                                                    script.complexity === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                                                                        'bg-green-500/10 text-green-500'
                                                            }>
                                                                {script.complexity}
                                                            </Badge>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="space-y-2">
                                                        <div className="text-sm">
                                                            <span className="text-muted-foreground">Lines of Code:</span>
                                                            <span className="ml-2 font-medium">{script.linesOfCode}</span>
                                                        </div>
                                                        {script.issues?.length > 0 && (
                                                            <div className="mt-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                                                                <p className="text-sm font-medium text-orange-500 mb-2">⚠️ Issues:</p>
                                                                <ul className="text-sm space-y-1">
                                                                    {script.issues.map((issue: string, i: number) => (
                                                                        <li key={i} className="text-muted-foreground">• {issue}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-8">No scripts found</p>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="mappings" className="space-y-3 mt-4">
                                        {bpmn2Analysis.mappings?.length > 0 ? (
                                            bpmn2Analysis.mappings.map((mapping: any, idx: number) => (
                                                <Card key={idx}>
                                                    <CardHeader className="pb-3">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <CardTitle className="text-base">{mapping.name}</CardTitle>
                                                                <CardDescription className="mt-1">{mapping.type}</CardDescription>
                                                            </div>
                                                            <Badge variant="outline" className={
                                                                mapping.complexity === 'complex' ? 'bg-red-500/10 text-red-500' :
                                                                    mapping.complexity === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                                                                        'bg-green-500/10 text-green-500'
                                                            }>
                                                                {mapping.complexity}
                                                            </Badge>
                                                        </div>
                                                    </CardHeader>
                                                </Card>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-8">No mappings found</p>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="errors" className="space-y-3 mt-4">
                                        {bpmn2Analysis.errorHandlers?.length > 0 ? (
                                            bpmn2Analysis.errorHandlers.map((handler: any, idx: number) => (
                                                <Card key={idx}>
                                                    <CardContent className="pt-6">
                                                        <div className="space-y-2 text-sm">
                                                            <div>
                                                                <span className="text-muted-foreground">Retry Enabled:</span>
                                                                <span className="ml-2 font-medium">{handler.retryEnabled ? 'Yes' : 'No'}</span>
                                                            </div>
                                                            {handler.maxRetries && (
                                                                <div>
                                                                    <span className="text-muted-foreground">Max Retries:</span>
                                                                    <span className="ml-2 font-medium">{handler.maxRetries}</span>
                                                                </div>
                                                            )}
                                                            {handler.retryInterval && (
                                                                <div>
                                                                    <span className="text-muted-foreground">Retry Interval:</span>
                                                                    <span className="ml-2 font-medium">{handler.retryInterval}ms</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-8">No error handlers configured</p>
                                        )}
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>
                    )}

                    {/* Data Source Info */}
                    {dataSource && (
                        <Card className="border-blue-500/20 bg-blue-500/5">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-2 text-sm">
                                    <Database className="h-4 w-4 text-blue-500" />
                                    <span className="font-medium">Data Sources:</span>
                                    {dataSource.hasDatabase && <Badge variant="outline">Database</Badge>}
                                    {dataSource.hasSAPCPI && <Badge variant="outline">SAP CPI Monitoring</Badge>}
                                    {dataSource.hasBPMN2 && <Badge variant="outline">BPMN2 Package</Badge>}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            ) : (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Ready to Analyze</h3>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            Select an iFlow and click "Analyze Performance" to get AI-powered optimization recommendations.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// Metric Card Component
function MetricCard({
    title,
    value,
    icon: Icon,
    trend,
    trendValue
}: {
    title: string;
    value: string;
    icon: any;
    trend: "up" | "down";
    trendValue: string;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    {trend === "up" ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    {trendValue}
                </p>
            </CardContent>
        </Card>
    );
}

// Bottleneck Card Component
function BottleneckCard({
    bottleneck,
    rank,
    onClick
}: {
    bottleneck: Bottleneck;
    rank: number;
    onClick: () => void;
}) {
    const categoryIcons = {
        database: Database,
        network: Network,
        cpu: Cpu,
        memory: HardDrive,
        payload: Code,
        configuration: Target
    };

    const severityConfig = {
        critical: { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
        high: { color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
        medium: { color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
        low: { color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    };

    const Icon = categoryIcons[bottleneck.category];
    const config = severityConfig[bottleneck.severity];

    return (
        <div
            className={cn(
                "flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer hover:shadow-lg transition-all group",
                config.border
            )}
            onClick={onClick}
        >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 font-bold text-lg text-purple-500">
                {rank}
            </div>

            <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-semibold">{bottleneck.title}</h4>
                            <Badge variant="outline" className={cn(config.bg, config.color, "capitalize")}>
                                {bottleneck.severity}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{bottleneck.description}</p>
                    </div>
                    <Button variant="ghost" className="group-hover:bg-primary group-hover:text-primary-foreground">
                        View Details
                        <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Impact:</span>
                        <Badge variant="secondary" className={cn(config.bg, config.color)}>
                            -{bottleneck.impact}% performance
                        </Badge>
                    </div>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Current:</span>
                        <span className="font-medium">{bottleneck.currentValue}</span>
                    </div>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Target:</span>
                        <span className="font-medium text-green-500">{bottleneck.targetValue}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Opportunity Card Component
function OpportunityCard({ opportunity }: { opportunity: OptimizationOpportunity }) {
    const effortConfig = {
        low: { color: "text-green-500", bg: "bg-green-500/10" },
        medium: { color: "text-yellow-500", bg: "bg-yellow-500/10" },
        high: { color: "text-red-500", bg: "bg-red-500/10" },
    };

    const config = effortConfig[opportunity.effort];

    return (
        <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3 flex-1">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{opportunity.title}</p>
                        <Badge variant="secondary" className="text-xs">{opportunity.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{opportunity.description}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="text-right">
                    <p className="text-sm font-semibold text-green-500">{opportunity.potentialGain}</p>
                    <Badge variant="outline" className={cn(config.bg, config.color, "text-xs capitalize")}>
                        {opportunity.effort} effort
                    </Badge>
                </div>
                <Button variant="ghost" size="sm">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// Bottleneck Detail View
function BottleneckDetailView({
    bottleneck,
    onBack,
    onCopy,
    copiedId
}: {
    bottleneck: Bottleneck;
    onBack: () => void;
    onCopy: (text: string, id: string) => void;
    copiedId: string | null;
}) {
    const [expandedRec, setExpandedRec] = useState<string | null>(bottleneck.recommendations[0]?.id || null);

    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{bottleneck.title}</h1>
                        <p className="text-muted-foreground mt-1">Performance Bottleneck Analysis</p>
                    </div>
                </div>
                <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                </Button>
            </div>

            {/* Bottleneck Summary */}
            <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-red-500/5">
                <CardHeader>
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-orange-500/10">
                            <AlertTriangle className="h-6 w-6 text-orange-500" />
                        </div>
                        <div className="flex-1">
                            <CardTitle className="text-xl">Impact Analysis</CardTitle>
                            <CardDescription className="mt-2 text-base">
                                {bottleneck.description}
                            </CardDescription>
                            <div className="flex items-center gap-3 mt-4">
                                <Badge variant="outline">-{bottleneck.impact}% performance</Badge>
                                <Badge variant="outline">Current: {bottleneck.currentValue}</Badge>
                                <Badge variant="outline" className="bg-green-500/10 text-green-500">
                                    Target: {bottleneck.targetValue}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Recommendations */}
            <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Lightbulb className="h-6 w-6 text-yellow-500" />
                    Recommended Solutions ({bottleneck.recommendations.length})
                </h2>
                {bottleneck.recommendations.map((rec, index) => (
                    <RecommendationCard
                        key={rec.id}
                        recommendation={rec}
                        rank={index + 1}
                        isExpanded={expandedRec === rec.id}
                        onToggle={() => setExpandedRec(expandedRec === rec.id ? null : rec.id)}
                        onCopy={onCopy}
                        copiedId={copiedId}
                    />
                ))}
            </div>
        </div>
    );
}

// Recommendation Card Component
function RecommendationCard({
    recommendation,
    rank,
    isExpanded,
    onToggle,
    onCopy,
    copiedId
}: {
    recommendation: Recommendation;
    rank: number;
    isExpanded: boolean;
    onToggle: () => void;
    onCopy: (text: string, id: string) => void;
    copiedId: string | null;
}) {
    const effortConfig = {
        low: { color: "text-green-500", bg: "bg-green-500/10", label: "Low Effort" },
        medium: { color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Medium Effort" },
        high: { color: "text-red-500", bg: "bg-red-500/10", label: "High Effort" },
    };

    const impactConfig = {
        low: { color: "text-gray-500", bg: "bg-gray-500/10", label: "Low Impact" },
        medium: { color: "text-blue-500", bg: "bg-blue-500/10", label: "Medium Impact" },
        high: { color: "text-purple-500", bg: "bg-purple-500/10", label: "High Impact" },
    };

    const effort = effortConfig[recommendation.effort];
    const impact = impactConfig[recommendation.impact];

    return (
        <Card className="overflow-hidden">
            <div
                className="flex items-start justify-between p-6 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={onToggle}
            >
                <div className="flex items-start gap-4 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 font-bold text-lg text-purple-500">
                        {rank}
                    </div>
                    <div className="flex-1 space-y-3">
                        <div>
                            <h4 className="font-semibold text-lg mb-2">{recommendation.title}</h4>
                            <p className="text-sm text-muted-foreground">{recommendation.description}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={cn(effort.bg, effort.color)}>
                                {effort.label}
                            </Badge>
                            <Badge variant="outline" className={cn(impact.bg, impact.color)}>
                                {impact.label}
                            </Badge>
                            <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                                {recommendation.expectedImprovement}
                            </Badge>
                            <Badge variant="secondary">
                                <Clock className="mr-1 h-3 w-3" />
                                {recommendation.implementationTime}
                            </Badge>
                        </div>
                    </div>
                </div>
                <Button variant="ghost" size="sm">
                    {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                    ) : (
                        <ChevronRight className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {isExpanded && (
                <div className="border-t bg-muted/20 p-6 space-y-6">
                    {/* Implementation Steps */}
                    <div>
                        <h5 className="font-semibold mb-4 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Implementation Steps
                        </h5>
                        <div className="space-y-3">
                            {recommendation.steps.map((step, index) => (
                                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                                        {index + 1}
                                    </div>
                                    <p className="text-sm flex-1 pt-0.5">{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Code Example */}
                    {recommendation.codeExample && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h5 className="font-semibold flex items-center gap-2">
                                    <Code className="h-4 w-4" />
                                    Code Example
                                </h5>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCopy(recommendation.codeExample!, `code-${recommendation.id}`);
                                    }}
                                >
                                    {copiedId === `code-${recommendation.id}` ? (
                                        <>
                                            <Check className="mr-2 h-4 w-4 text-green-500" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="mr-2 h-4 w-4" />
                                            Copy
                                        </>
                                    )}
                                </Button>
                            </div>
                            <ScrollArea className="h-[200px] w-full rounded-lg border">
                                <pre className="p-4 bg-zinc-950 dark:bg-zinc-900">
                                    <code className="text-xs font-mono text-zinc-100">
                                        {recommendation.codeExample}
                                    </code>
                                </pre>
                            </ScrollArea>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                        <Button className="flex-1">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Apply Fix
                        </Button>
                        <Button variant="outline" className="flex-1">
                            <Code className="mr-2 h-4 w-4" />
                            View Implementation Guide
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
}