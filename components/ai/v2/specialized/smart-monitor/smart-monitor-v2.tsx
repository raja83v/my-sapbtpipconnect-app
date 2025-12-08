"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Activity,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Clock,
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Bell,
    Settings,
    BarChart3,
    Zap,
    Target,
    ChevronRight,
    Eye,
    EyeOff,
    Download,
    Filter,
    Search,
    Play,
    Pause
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SmartMonitorProps {
    tenantId: string;
    iflowId?: string;
}

interface Anomaly {
    id: string;
    iflowName: string;
    iflowId: string;
    type: "error_spike" | "performance_degradation" | "volume_spike" | "new_error" | "pattern_change";
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
    detectedAt: Date;
    currentValue: string;
    normalValue: string;
    confidence: number;
    affectedExecutions: number;
    actions: AnomalyAction[];
}

interface AnomalyAction {
    id: string;
    label: string;
    type: "investigate" | "dismiss" | "alert" | "fix";
}

interface MonitoringStats {
    activeIFlows: number;
    totalAnomalies: number;
    criticalAnomalies: number;
    warningAnomalies: number;
    avgConfidence: number;
    monitoringStatus: "active" | "paused";
}

interface TrendData {
    iflowName: string;
    trend: "up" | "down" | "stable";
    change: number;
    metric: string;
}

export function SmartMonitor({ tenantId, iflowId }: SmartMonitorProps) {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [stats, setStats] = useState<MonitoringStats | null>(null);
    const [trends, setTrends] = useState<TrendData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMonitoring, setIsMonitoring] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [severityFilter, setSeverityFilter] = useState<string>("all");
    const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);

    useEffect(() => {
        loadMonitoringData();

        // Simulate real-time updates
        const interval = setInterval(() => {
            if (isMonitoring) {
                loadMonitoringData();
            }
        }, 30000); // Refresh every 30 seconds

        return () => clearInterval(interval);
    }, [tenantId, isMonitoring]);

    const loadMonitoringData = async () => {
        setIsLoading(true);

        try {
            // TODO: Replace with actual API call
            // Mock data for demonstration
            await new Promise(resolve => setTimeout(resolve, 1000));

            setStats({
                activeIFlows: 12,
                totalAnomalies: 5,
                criticalAnomalies: 2,
                warningAnomalies: 3,
                avgConfidence: 87,
                monitoringStatus: isMonitoring ? "active" : "paused"
            });

            setAnomalies([
                {
                    id: "1",
                    iflowName: "Payment-API-v2",
                    iflowId: "payment-api-v2",
                    type: "error_spike",
                    severity: "critical",
                    title: "Unusual Error Spike Detected",
                    description: "Error rate increased from 0-2 failures/hour to 15 failures in the last 10 minutes",
                    detectedAt: new Date(Date.now() - 2 * 60000),
                    currentValue: "15 failures/10min",
                    normalValue: "0-2 failures/hour",
                    confidence: 95,
                    affectedExecutions: 15,
                    actions: [
                        { id: "a1", label: "Investigate", type: "investigate" },
                        { id: "a2", label: "Dismiss", type: "dismiss" },
                        { id: "a3", label: "Set Alert", type: "alert" }
                    ]
                },
                {
                    id: "2",
                    iflowName: "Auth-Service",
                    iflowId: "auth-service",
                    type: "performance_degradation",
                    severity: "critical",
                    title: "Response Time Degradation",
                    description: "Average response time increased from 1.2s to 8.2s over the past hour",
                    detectedAt: new Date(Date.now() - 15 * 60000),
                    currentValue: "8.2s avg",
                    normalValue: "1.2s avg",
                    confidence: 92,
                    affectedExecutions: 234,
                    actions: [
                        { id: "a4", label: "Investigate", type: "investigate" },
                        { id: "a5", label: "Dismiss", type: "dismiss" },
                        { id: "a6", label: "Set Alert", type: "alert" }
                    ]
                },
                {
                    id: "3",
                    iflowName: "Order-Sync",
                    iflowId: "order-sync",
                    type: "volume_spike",
                    severity: "warning",
                    title: "Volume Spike Detected",
                    description: "Message volume increased by 45% compared to typical patterns",
                    detectedAt: new Date(Date.now() - 30 * 60000),
                    currentValue: "145 msg/min",
                    normalValue: "100 msg/min",
                    confidence: 88,
                    affectedExecutions: 0,
                    actions: [
                        { id: "a7", label: "Investigate", type: "investigate" },
                        { id: "a8", label: "Dismiss", type: "dismiss" }
                    ]
                },
                {
                    id: "4",
                    iflowName: "Invoice-Process",
                    iflowId: "invoice-process",
                    type: "new_error",
                    severity: "warning",
                    title: "New Error Type Detected",
                    description: "A previously unseen error pattern has appeared in the last hour",
                    detectedAt: new Date(Date.now() - 45 * 60000),
                    currentValue: "3 occurrences",
                    normalValue: "Never seen before",
                    confidence: 85,
                    affectedExecutions: 3,
                    actions: [
                        { id: "a9", label: "Investigate", type: "investigate" },
                        { id: "a10", label: "Dismiss", type: "dismiss" }
                    ]
                },
                {
                    id: "5",
                    iflowName: "Customer-API",
                    iflowId: "customer-api",
                    type: "pattern_change",
                    severity: "info",
                    title: "Execution Pattern Change",
                    description: "Execution timing pattern has shifted compared to historical baseline",
                    detectedAt: new Date(Date.now() - 60 * 60000),
                    currentValue: "Peak at 2PM",
                    normalValue: "Peak at 10AM",
                    confidence: 78,
                    affectedExecutions: 0,
                    actions: [
                        { id: "a11", label: "Investigate", type: "investigate" },
                        { id: "a12", label: "Dismiss", type: "dismiss" }
                    ]
                }
            ]);

            setTrends([
                { iflowName: "Payment-API-v2", trend: "down", change: -35, metric: "Success Rate" },
                { iflowName: "Order-Sync", trend: "up", change: 45, metric: "Volume" },
                { iflowName: "Auth-Service", trend: "down", change: -85, metric: "Performance" },
            ]);

        } catch (error) {
            toast.error("Failed to load monitoring data");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnomalyAction = async (anomaly: Anomaly, actionType: string) => {
        if (actionType === "investigate") {
            setSelectedAnomaly(anomaly);
        } else if (actionType === "dismiss") {
            setAnomalies(prev => prev.filter(a => a.id !== anomaly.id));
            toast.success("Anomaly dismissed");
        } else if (actionType === "alert") {
            toast.success("Alert configured for this anomaly");
        }
    };

    const toggleMonitoring = () => {
        setIsMonitoring(!isMonitoring);
        toast.success(isMonitoring ? "Monitoring paused" : "Monitoring resumed");
    };

    const filteredAnomalies = anomalies.filter(anomaly => {
        const matchesSearch = anomaly.iflowName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            anomaly.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSeverity = severityFilter === "all" || anomaly.severity === severityFilter;
        return matchesSearch && matchesSeverity;
    });

    const criticalAnomalies = filteredAnomalies.filter(a => a.severity === "critical");
    const warningAnomalies = filteredAnomalies.filter(a => a.severity === "warning");
    const infoAnomalies = filteredAnomalies.filter(a => a.severity === "info");

    if (selectedAnomaly) {
        return (
            <AnomalyDetailView
                anomaly={selectedAnomaly}
                onBack={() => setSelectedAnomaly(null)}
            />
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20">
                            <Activity className="h-8 w-8 text-green-500" />
                        </div>
                        Smart Monitor
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        AI-powered anomaly detection and real-time monitoring
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={isMonitoring ? "default" : "outline"}
                        onClick={toggleMonitoring}
                    >
                        {isMonitoring ? (
                            <>
                                <Pause className="mr-2 h-4 w-4" />
                                Pause Monitoring
                            </>
                        ) : (
                            <>
                                <Play className="mr-2 h-4 w-4" />
                                Resume Monitoring
                            </>
                        )}
                    </Button>
                    <Button variant="outline" onClick={loadMonitoringData} disabled={isLoading}>
                        <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Monitoring</CardTitle>
                        <Activity className={cn("h-4 w-4", isMonitoring ? "text-green-500" : "text-gray-500")} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.activeIFlows || 0} iFlows</div>
                        <p className="text-xs text-muted-foreground">
                            {isMonitoring ? "Real-time monitoring active" : "Monitoring paused"}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Critical Anomalies</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">
                            {stats?.criticalAnomalies || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Requires immediate attention</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Warnings</CardTitle>
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-500">
                            {stats?.warningAnomalies || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Monitor closely</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.avgConfidence || 0}%</div>
                        <p className="text-xs text-muted-foreground">Detection accuracy</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search anomalies by iFlow name or description..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={severityFilter} onValueChange={setSeverityFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <Filter className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Filter by severity" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Severities</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="warning">Warning</SelectItem>
                                <SelectItem value="info">Info</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Anomalies */}
            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
                </div>
            ) : filteredAnomalies.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">All Clear!</h3>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            {searchQuery || severityFilter !== "all"
                                ? "No anomalies match your current filters."
                                : "No anomalies detected. Your integrations are running smoothly."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Tabs defaultValue="critical" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="critical" className="relative">
                            Critical
                            {criticalAnomalies.length > 0 && (
                                <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                                    {criticalAnomalies.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="warning" className="relative">
                            Warnings
                            {warningAnomalies.length > 0 && (
                                <Badge variant="outline" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-yellow-500/10 text-yellow-500">
                                    {warningAnomalies.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="trends">
                            Trends
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="critical" className="space-y-4">
                        {criticalAnomalies.length === 0 ? (
                            <Card className="border-dashed">
                                <CardContent className="flex flex-col items-center justify-center py-12">
                                    <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                                    <p className="text-sm text-muted-foreground">No critical anomalies</p>
                                </CardContent>
                            </Card>
                        ) : (
                            criticalAnomalies.map(anomaly => (
                                <AnomalyCard
                                    key={anomaly.id}
                                    anomaly={anomaly}
                                    onAction={handleAnomalyAction}
                                />
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="warning" className="space-y-4">
                        {warningAnomalies.length === 0 ? (
                            <Card className="border-dashed">
                                <CardContent className="flex flex-col items-center justify-center py-12">
                                    <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                                    <p className="text-sm text-muted-foreground">No warnings</p>
                                </CardContent>
                            </Card>
                        ) : (
                            [...warningAnomalies, ...infoAnomalies].map(anomaly => (
                                <AnomalyCard
                                    key={anomaly.id}
                                    anomaly={anomaly}
                                    onAction={handleAnomalyAction}
                                />
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="trends" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Trend Analysis</CardTitle>
                                <CardDescription>
                                    Significant changes in iFlow behavior patterns
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {trends.map((trend, index) => (
                                        <TrendCard key={index} trend={trend} />
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}

// Anomaly Card Component
function AnomalyCard({
    anomaly,
    onAction
}: {
    anomaly: Anomaly;
    onAction: (anomaly: Anomaly, actionType: string) => void;
}) {
    const severityConfig = {
        critical: {
            color: "text-red-500",
            bg: "bg-red-500/10",
            border: "border-red-500/20",
            icon: AlertTriangle
        },
        warning: {
            color: "text-yellow-500",
            bg: "bg-yellow-500/10",
            border: "border-yellow-500/20",
            icon: AlertCircle
        },
        info: {
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20",
            icon: AlertCircle
        },
    };

    const typeLabels = {
        error_spike: "Error Spike",
        performance_degradation: "Performance Issue",
        volume_spike: "Volume Spike",
        new_error: "New Error Type",
        pattern_change: "Pattern Change"
    };

    const config = severityConfig[anomaly.severity];
    const Icon = config.icon;

    return (
        <Card className={cn("hover:shadow-lg transition-all", config.border)}>
            <CardContent className="p-6">
                <div className="flex items-start gap-4">
                    <div className={cn("p-3 rounded-xl", config.bg)}>
                        <Icon className={cn("h-6 w-6", config.color)} />
                    </div>

                    <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-semibold text-lg">{anomaly.iflowName}</h3>
                                    <Badge variant="outline" className={cn(config.bg, config.color, "capitalize")}>
                                        {anomaly.severity}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                        {typeLabels[anomaly.type]}
                                    </Badge>
                                </div>
                                <p className="font-medium">{anomaly.title}</p>
                                <p className="text-sm text-muted-foreground">{anomaly.description}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Current:</span>
                                <span className={cn("font-medium", config.color)}>{anomaly.currentValue}</span>
                            </div>
                            <Separator orientation="vertical" className="h-4" />
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Normal:</span>
                                <span className="font-medium">{anomaly.normalValue}</span>
                            </div>
                            <Separator orientation="vertical" className="h-4" />
                            <div className="flex items-center gap-2">
                                <Target className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{anomaly.confidence}% confidence</span>
                            </div>
                            <Separator orientation="vertical" className="h-4" />
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {formatTimeAgo(anomaly.detectedAt)}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            {anomaly.actions.map(action => (
                                <Button
                                    key={action.id}
                                    variant={action.type === "investigate" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => onAction(anomaly, action.type)}
                                >
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Trend Card Component
function TrendCard({ trend }: { trend: TrendData }) {
    const isNegative = trend.trend === "down";
    const Icon = isNegative ? TrendingDown : TrendingUp;
    const color = isNegative ? "text-red-500" : "text-green-500";

    return (
        <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", isNegative ? "bg-red-500/10" : "bg-green-500/10")}>
                    <Icon className={cn("h-5 w-5", color)} />
                </div>
                <div>
                    <p className="font-medium">{trend.iflowName}</p>
                    <p className="text-sm text-muted-foreground">{trend.metric}</p>
                </div>
            </div>
            <div className="text-right">
                <p className={cn("text-lg font-bold", color)}>
                    {isNegative ? "" : "+"}{trend.change}%
                </p>
                <p className="text-xs text-muted-foreground capitalize">{trend.trend}</p>
            </div>
        </div>
    );
}

// Anomaly Detail View
function AnomalyDetailView({
    anomaly,
    onBack
}: {
    anomaly: Anomaly;
    onBack: () => void;
}) {
    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ChevronRight className="h-5 w-5 rotate-180" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{anomaly.iflowName}</h1>
                        <p className="text-muted-foreground mt-1">Anomaly Investigation</p>
                    </div>
                </div>
                <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export Report
                </Button>
            </div>

            {/* Anomaly Summary */}
            <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-red-500/5">
                <CardHeader>
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-orange-500/10">
                            <AlertTriangle className="h-6 w-6 text-orange-500" />
                        </div>
                        <div className="flex-1">
                            <CardTitle className="text-xl">{anomaly.title}</CardTitle>
                            <CardDescription className="mt-2 text-base">
                                {anomaly.description}
                            </CardDescription>
                            <div className="flex items-center gap-3 mt-4 flex-wrap">
                                <Badge variant="outline">{anomaly.confidence}% confidence</Badge>
                                <Badge variant="outline">Detected {formatTimeAgo(anomaly.detectedAt)}</Badge>
                                <Badge variant="outline">{anomaly.affectedExecutions} affected executions</Badge>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Investigation Details */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Current State</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Current Value</p>
                                <p className="text-2xl font-bold text-red-500">{anomaly.currentValue}</p>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Normal Baseline</p>
                                <p className="text-lg font-medium">{anomaly.normalValue}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recommended Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <Button className="w-full justify-start">
                                <Eye className="mr-2 h-4 w-4" />
                                View Affected Executions
                            </Button>
                            <Button variant="outline" className="w-full justify-start">
                                <BarChart3 className="mr-2 h-4 w-4" />
                                Analyze Historical Patterns
                            </Button>
                            <Button variant="outline" className="w-full justify-start">
                                <Bell className="mr-2 h-4 w-4" />
                                Configure Alert Rules
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function formatTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}