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
    AlertCircle,
    ArrowLeft,
    Download,
    RefreshCw,
    TrendingUp,
    Clock,
    Zap,
    Target,
    Lightbulb,
    BookOpen,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    ChevronRight,
    Copy,
    Check,
    ExternalLink,
    Filter,
    Search
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { diagnoseError, getFailedExecutions } from "@/app/actions/ai-agents-v2";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ErrorDiagnosticianProps {
    tenantId: string;
    iflowId?: string;
}

export interface ErrorItem {
    id: string;
    messageId: string;
    iflowName: string;
    errorMessage: string;
    errorCategory: string | null;
    occurrences: number;
    lastOccurrence: Date;
    status: "FAILED";
    severity: "critical" | "high" | "medium" | "low";
}

export interface Diagnosis {
    executionId: string;
    rootCause: string;
    detailedAnalysis: string;
    solutions: Solution[];
    relatedIssues: RelatedIssue[];
    confidence: number;
}

export interface Solution {
    id: string;
    title: string;
    description: string;
    effort: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    priority: number;
    steps: string[];
    codeExample?: string;
}

export interface RelatedIssue {
    id: string;
    title: string;
    type: "similar_error" | "team_discussion" | "documentation";
    url?: string;
}

export function ErrorDiagnostician({ tenantId, iflowId }: ErrorDiagnosticianProps) {
    const [errors, setErrors] = useState<ErrorItem[]>([]);
    const [selectedError, setSelectedError] = useState<ErrorItem | null>(null);
    const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [severityFilter, setSeverityFilter] = useState<string>("all");
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        loadErrors();
    }, [tenantId, iflowId]);

    const loadErrors = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await getFailedExecutions({
                tenantId,
                limit: 100,
            });

            if (result.success && result.data) {
                const errorItems: ErrorItem[] = result.data.map((item: any) => ({
                    id: item.id,
                    messageId: item.messageId,
                    iflowName: item.iflowName,
                    errorMessage: item.errorMessage,
                    errorCategory: item.errorCategory,
                    occurrences: item.occurrences,
                    lastOccurrence: new Date(item.lastOccurrence),
                    status: "FAILED" as const,
                    severity: item.severity,
                }));

                setErrors(errorItems);
            } else {
                setError(result.error || "Failed to load errors");
                toast.error("Failed to load errors", {
                    description: result.error,
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load errors");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDiagnose = async (errorItem: ErrorItem) => {
        setSelectedError(errorItem);
        setIsDiagnosing(true);
        setDiagnosis(null);
        setError(null);

        try {
            const result = await diagnoseError({
                executionId: errorItem.id,
                tenantId,
                iflowId: iflowId || errorItem.iflowName,
            });

            if (result.success && result.data) {
                setDiagnosis(result.data);
            } else {
                setError(result.error || "Failed to diagnose error");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to diagnose error");
        } finally {
            setIsDiagnosing(false);
        }
    };

    const filteredErrors = errors.filter(err => {
        const matchesSearch = err.iflowName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            err.errorMessage.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSeverity = severityFilter === "all" || err.severity === severityFilter;
        return matchesSearch && matchesSeverity;
    });

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (selectedError) {
        return <DiagnosisDetailView
            error={selectedError}
            diagnosis={diagnosis}
            isLoading={isDiagnosing}
            onBack={() => {
                setSelectedError(null);
                setDiagnosis(null);
            }}
            onCopy={copyToClipboard}
            copiedId={copiedId}
        />;
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20">
                            <AlertCircle className="h-8 w-8 text-red-500" />
                        </div>
                        Error Diagnostician
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        AI-powered root cause analysis and intelligent solutions
                    </p>
                </div>
                <Button variant="outline" onClick={loadErrors} disabled={isLoading}>
                    <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{errors.length}</div>
                        <p className="text-xs text-muted-foreground">Last 24 hours</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Critical</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">
                            {errors.filter(e => e.severity === "critical").length}
                        </div>
                        <p className="text-xs text-muted-foreground">Requires immediate attention</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Occurrences</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {errors.reduce((sum, e) => sum + e.occurrences, 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Total failures</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1.2s</div>
                        <p className="text-xs text-muted-foreground">AI diagnosis time</p>
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
                                placeholder="Search errors by iFlow name or message..."
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
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Error List */}
            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
                </div>
            ) : filteredErrors.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Errors Found</h3>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            {searchQuery || severityFilter !== "all"
                                ? "No errors match your current filters."
                                : "Great news! All your integrations are running smoothly."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filteredErrors.map((errorItem) => (
                        <ErrorCard
                            key={errorItem.id}
                            error={errorItem}
                            onDiagnose={() => handleDiagnose(errorItem)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// Error Card Component
function ErrorCard({ error, onDiagnose }: { error: ErrorItem; onDiagnose: () => void }) {
    const severityConfig = {
        critical: { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", icon: AlertTriangle },
        high: { color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: AlertCircle },
        medium: { color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: AlertCircle },
        low: { color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: AlertCircle },
    };

    const config = severityConfig[error.severity];
    const Icon = config.icon;

    return (
        <Card className={cn("hover:shadow-lg transition-all cursor-pointer group", config.border)} onClick={onDiagnose}>
            <CardContent className="p-6">
                <div className="flex items-start gap-4">
                    <div className={cn("p-3 rounded-xl", config.bg)}>
                        <Icon className={cn("h-6 w-6", config.color)} />
                    </div>

                    <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-lg">{error.iflowName}</h3>
                                    <Badge variant="outline" className={cn(config.bg, config.color, "capitalize")}>
                                        {error.severity}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {error.errorMessage}
                                </p>
                            </div>

                            <Button variant="ghost" className="group-hover:bg-primary group-hover:text-primary-foreground">
                                Diagnose
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <TrendingUp className="h-4 w-4" />
                                <span className="font-medium">{error.occurrences}</span> occurrences
                            </div>
                            <Separator orientation="vertical" className="h-4" />
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4" />
                                Last: {formatTimeAgo(error.lastOccurrence)}
                            </div>
                            {error.errorCategory && (
                                <>
                                    <Separator orientation="vertical" className="h-4" />
                                    <Badge variant="secondary" className="text-xs">
                                        {error.errorCategory.replace(/_/g, " ")}
                                    </Badge>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Diagnosis Detail View Component
function DiagnosisDetailView({
    error,
    diagnosis,
    isLoading,
    onBack,
    onCopy,
    copiedId
}: {
    error: ErrorItem;
    diagnosis: Diagnosis | null;
    isLoading: boolean;
    onBack: () => void;
    onCopy: (text: string, id: string) => void;
    copiedId: string | null;
}) {
    const [expandedSolution, setExpandedSolution] = useState<string | null>(diagnosis?.solutions[0]?.id || null);

    // Show loading state while diagnosing
    if (isLoading) {
        return (
            <div className="container mx-auto p-6 max-w-7xl space-y-6">
                {/* Header Skeleton */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={onBack}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <Skeleton className="h-9 w-64 mb-2" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                    </div>
                </div>
                <Skeleton className="h-32" />
                <Skeleton className="h-64" />
                <Skeleton className="h-96" />
            </div>
        );
    }

    // If no diagnosis yet (shouldn't happen but safety check)
    if (!diagnosis) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No diagnosis available</p>
                        <Button onClick={onBack} className="mt-4">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Errors
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{error.iflowName}</h1>
                        <p className="text-muted-foreground mt-1">AI-Powered Diagnosis</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20">
                        <Zap className="mr-1 h-3 w-3" />
                        {Math.round(diagnosis.confidence * 100)}% Confidence
                    </Badge>
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Error Summary */}
            <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-orange-500/5">
                <CardHeader>
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-red-500/10">
                            <AlertCircle className="h-6 w-6 text-red-500" />
                        </div>
                        <div className="flex-1">
                            <CardTitle className="text-xl">Error Details</CardTitle>
                            <CardDescription className="mt-2 text-base">
                                {error.errorMessage}
                            </CardDescription>
                            <div className="flex items-center gap-3 mt-4">
                                <Badge variant="outline">{error.occurrences} occurrences</Badge>
                                <Badge variant="outline">{error.errorCategory?.replace(/_/g, " ")}</Badge>
                                <Badge variant="outline">Last: {formatTimeAgo(error.lastOccurrence)}</Badge>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Tabs for organized content */}
            <Tabs defaultValue="diagnosis" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="diagnosis">
                        <Target className="mr-2 h-4 w-4" />
                        Root Cause
                    </TabsTrigger>
                    <TabsTrigger value="solutions">
                        <Lightbulb className="mr-2 h-4 w-4" />
                        Solutions
                    </TabsTrigger>
                    <TabsTrigger value="related">
                        <BookOpen className="mr-2 h-4 w-4" />
                        Related
                    </TabsTrigger>
                </TabsList>

                {/* Root Cause Tab */}
                <TabsContent value="diagnosis" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="h-5 w-5 text-red-500" />
                                Root Cause Analysis
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 rounded-lg bg-muted/50 border-l-4 border-red-500">
                                <p className="font-semibold text-lg mb-2">{diagnosis.rootCause}</p>
                            </div>
                            <Separator />
                            <div>
                                <h4 className="font-medium mb-3">Detailed Analysis</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                    {diagnosis.detailedAnalysis}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Solutions Tab */}
                <TabsContent value="solutions" className="space-y-4">
                    {diagnosis.solutions
                        .sort((a, b) => b.priority - a.priority)
                        .map((solution, index) => (
                            <SolutionCardEnhanced
                                key={solution.id}
                                solution={solution}
                                rank={index + 1}
                                isExpanded={expandedSolution === solution.id}
                                onToggle={() => setExpandedSolution(expandedSolution === solution.id ? null : solution.id)}
                                onCopy={onCopy}
                                copiedId={copiedId}
                            />
                        ))}
                </TabsContent>

                {/* Related Issues Tab */}
                <TabsContent value="related" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Related Issues & Resources</CardTitle>
                            <CardDescription>
                                Similar problems and helpful documentation
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {diagnosis.relatedIssues.map((issue) => (
                                    <div
                                        key={issue.id}
                                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {issue.type === "similar_error" && (
                                                <div className="p-2 rounded-lg bg-red-500/10">
                                                    <Target className="h-4 w-4 text-red-500" />
                                                </div>
                                            )}
                                            {issue.type === "team_discussion" && (
                                                <div className="p-2 rounded-lg bg-blue-500/10">
                                                    <BookOpen className="h-4 w-4 text-blue-500" />
                                                </div>
                                            )}
                                            {issue.type === "documentation" && (
                                                <div className="p-2 rounded-lg bg-green-500/10">
                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-medium">{issue.title}</p>
                                                <p className="text-xs text-muted-foreground capitalize">
                                                    {issue.type.replace(/_/g, " ")}
                                                </p>
                                            </div>
                                        </div>
                                        {issue.url && (
                                            <Button variant="ghost" size="sm" asChild>
                                                <a href={issue.url} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Enhanced Solution Card
function SolutionCardEnhanced({
    solution,
    rank,
    isExpanded,
    onToggle,
    onCopy,
    copiedId
}: {
    solution: Solution;
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

    const effort = effortConfig[solution.effort];
    const impact = impactConfig[solution.impact];
    const stars = "⭐".repeat(Math.min(Math.max(Math.round(solution.priority / 33.33), 1), 3));

    return (
        <Card className="overflow-hidden">
            <div
                className="flex items-start justify-between p-6 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={onToggle}
            >
                <div className="flex items-start gap-4 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 font-bold text-lg text-indigo-500">
                        {rank}
                    </div>
                    <div className="flex-1 space-y-3">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-lg">{solution.title}</h4>
                                <span className="text-lg">{stars}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{solution.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn(effort.bg, effort.color)}>
                                {effort.label}
                            </Badge>
                            <Badge variant="outline" className={cn(impact.bg, impact.color)}>
                                {impact.label}
                            </Badge>
                        </div>
                    </div>
                </div>
                <Button variant="ghost" size="sm">
                    <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
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
                            {solution.steps.map((step, index) => (
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
                    {solution.codeExample && (
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
                                        onCopy(solution.codeExample!, `code-${solution.id}`);
                                    }}
                                >
                                    {copiedId === `code-${solution.id}` ? (
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
                                        {solution.codeExample}
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
                            <BookOpen className="mr-2 h-4 w-4" />
                            View Docs
                        </Button>
                    </div>
                </div>
            )}
        </Card>
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

function Code({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
    return <code className={cn("relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm", className)} {...props} />;
}