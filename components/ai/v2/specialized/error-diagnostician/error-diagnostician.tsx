"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, Download, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ErrorList } from "./error-list";
import { DiagnosisView } from "./diagnosis-view";
import { diagnoseError } from "@/app/actions/ai-agents-v2";

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

    // Load errors on mount
    useEffect(() => {
        loadErrors();
    }, [tenantId, iflowId]);

    const loadErrors = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // TODO: Implement actual API call to fetch errors
            // For now, using mock data
            const mockErrors: ErrorItem[] = [
                {
                    id: "1",
                    messageId: "msg-001",
                    iflowName: "Payment-API-v2",
                    errorMessage: "Connection timeout: Database connection pool exhausted",
                    errorCategory: "CONNECTION_TIMEOUT",
                    occurrences: 15,
                    lastOccurrence: new Date(Date.now() - 2 * 60 * 1000), // 2 min ago
                    status: "FAILED",
                },
                {
                    id: "2",
                    messageId: "msg-002",
                    iflowName: "Auth-Service",
                    errorMessage: "Invalid credentials: Authentication failed",
                    errorCategory: "AUTHENTICATION_ERROR",
                    occurrences: 8,
                    lastOccurrence: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
                    status: "FAILED",
                },
                {
                    id: "3",
                    messageId: "msg-003",
                    iflowName: "Order-Sync",
                    errorMessage: "Mapping error: Invalid XML namespace",
                    errorCategory: "MAPPING_ERROR",
                    occurrences: 3,
                    lastOccurrence: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
                    status: "FAILED",
                },
            ];

            setErrors(mockErrors);
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

    const handleBack = () => {
        setSelectedError(null);
        setDiagnosis(null);
    };

    const handleExport = () => {
        if (!diagnosis || !selectedError) return;

        const exportData = {
            error: selectedError,
            diagnosis,
            exportedAt: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `error-diagnosis-${selectedError.id}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {selectedError && (
                        <Button variant="ghost" size="icon" onClick={handleBack}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <AlertCircle className="h-8 w-8 text-red-500" />
                            Error Diagnostician
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {selectedError
                                ? `Diagnosing: ${selectedError.iflowName}`
                                : "Select an error to diagnose"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {diagnosis && (
                        <Button variant="outline" onClick={handleExport}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Diagnosis
                        </Button>
                    )}
                    <Button variant="outline" onClick={loadErrors} disabled={isLoading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <Card className="border-red-500/50 bg-red-500/5">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                            <div>
                                <p className="font-medium text-red-500">Error</p>
                                <p className="text-sm text-muted-foreground">{error}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="space-y-4">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                </div>
            )}

            {/* Content */}
            {!isLoading && !selectedError && (
                <ErrorList
                    errors={errors}
                    onDiagnose={handleDiagnose}
                    totalErrors={errors.length}
                />
            )}

            {!isLoading && selectedError && (
                <DiagnosisView
                    error={selectedError}
                    diagnosis={diagnosis}
                    isLoading={isDiagnosing}
                />
            )}

            {/* Empty State */}
            {!isLoading && !selectedError && errors.length === 0 && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <AlertCircle className="h-16 w-16 text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Errors Found</h3>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                            Great news! There are no failed executions in the last 24 hours.
                            {iflowId
                                ? " This iFlow is running smoothly."
                                : " All your integrations are running smoothly."}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}