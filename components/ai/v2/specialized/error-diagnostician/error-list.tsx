"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ChevronRight, Clock } from "lucide-react";
import { SeverityBadge } from "../../shared/severity-badge";
import type { ErrorItem } from "./error-diagnostician";

interface ErrorListProps {
    errors: ErrorItem[];
    onDiagnose: (error: ErrorItem) => void;
    totalErrors: number;
}

function getErrorSeverity(occurrences: number): "critical" | "warning" | "info" {
    if (occurrences >= 10) return "critical";
    if (occurrences >= 5) return "warning";
    return "info";
}

function formatTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    return `${days} day${days > 1 ? "s" : ""} ago`;
}

export function ErrorList({ errors, onDiagnose, totalErrors }: ErrorListProps) {
    return (
        <div className="space-y-6">
            {/* Summary */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Recent Errors (Last 24h)</CardTitle>
                    <CardDescription>
                        {totalErrors} failure{totalErrors !== 1 ? "s" : ""} detected across your integrations
                    </CardDescription>
                </CardHeader>
            </Card>

            {/* Error List */}
            <div className="space-y-4">
                {errors.map((error) => {
                    const severity = getErrorSeverity(error.occurrences);

                    return (
                        <Card
                            key={error.id}
                            className="hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => onDiagnose(error)}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4 flex-1">
                                        {/* Icon */}
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                                            <AlertCircle className="h-5 w-5 text-red-500" />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 space-y-2">
                                            {/* Header */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <h3 className="font-semibold text-base">{error.iflowName}</h3>
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        {error.errorMessage}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Metadata */}
                                            <div className="flex items-center gap-3 text-sm">
                                                <SeverityBadge severity={severity} />
                                                <Badge variant="outline">
                                                    {error.occurrences} occurrence{error.occurrences !== 1 ? "s" : ""}
                                                </Badge>
                                                <div className="flex items-center gap-1 text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    <span>Last: {formatTimeAgo(error.lastOccurrence)}</span>
                                                </div>
                                                {error.errorCategory && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        {error.errorCategory.replace(/_/g, " ")}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action */}
                                    <Button variant="ghost" size="sm" className="shrink-0">
                                        Diagnose
                                        <ChevronRight className="ml-1 h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}