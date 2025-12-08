"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Target,
    Lightbulb,
    BookOpen,
    CheckCircle,
    ExternalLink,
    Copy,
    Check
} from "lucide-react";
import { SolutionCard } from "./solution-card";
import type { ErrorItem, Diagnosis } from "./error-diagnostician";
import { useState } from "react";

interface DiagnosisViewProps {
    error: ErrorItem;
    diagnosis: Diagnosis | null;
    isLoading: boolean;
}

export function DiagnosisView({ error, diagnosis, isLoading }: DiagnosisViewProps) {
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-32" />
                <Skeleton className="h-64" />
                <Skeleton className="h-48" />
            </div>
        );
    }

    if (!diagnosis) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                    <p className="text-muted-foreground">No diagnosis available</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Error Summary */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle className="text-xl">Diagnosis: {error.iflowName}</CardTitle>
                            <CardDescription className="mt-2">
                                {error.errorMessage}
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500">
                            {Math.round(diagnosis.confidence * 100)}% Confidence
                        </Badge>
                    </div>
                </CardHeader>
            </Card>

            {/* Root Cause */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-red-500" />
                        Root Cause
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <p className="text-base font-medium">{diagnosis.rootCause}</p>
                        <div className="rounded-lg bg-muted/50 p-4">
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {diagnosis.detailedAnalysis}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Recommended Solutions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        Recommended Solutions
                    </CardTitle>
                    <CardDescription>
                        Ranked by effort and impact - start with the highest priority
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {diagnosis.solutions
                        .sort((a, b) => b.priority - a.priority)
                        .map((solution, index) => (
                            <SolutionCard
                                key={solution.id}
                                solution={solution}
                                rank={index + 1}
                                onCopy={copyToClipboard}
                                copiedId={copiedId}
                            />
                        ))}
                </CardContent>
            </Card>

            {/* Related Issues */}
            {diagnosis.relatedIssues.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-blue-500" />
                            Related Issues
                        </CardTitle>
                        <CardDescription>
                            Similar problems and helpful resources
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {diagnosis.relatedIssues.map((issue) => (
                                <div
                                    key={issue.id}
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        {issue.type === "similar_error" && (
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                                                <Target className="h-4 w-4 text-red-500" />
                                            </div>
                                        )}
                                        {issue.type === "team_discussion" && (
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                                                <BookOpen className="h-4 w-4 text-blue-500" />
                                            </div>
                                        )}
                                        {issue.type === "documentation" && (
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-sm font-medium">{issue.title}</p>
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
            )}
        </div>
    );
}