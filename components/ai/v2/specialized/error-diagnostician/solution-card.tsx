"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { Solution } from "./error-diagnostician";

interface SolutionCardProps {
    solution: Solution;
    rank: number;
    onCopy: (text: string, id: string) => void;
    copiedId: string | null;
}

const effortColors = {
    low: "bg-green-500/10 text-green-500 border-green-500/20",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    high: "bg-red-500/10 text-red-500 border-red-500/20",
};

const impactColors = {
    low: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    medium: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    high: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

const priorityStars = (priority: number) => {
    const maxStars = 3;
    const stars = Math.min(Math.max(Math.round(priority / 33.33), 1), maxStars);
    return "⭐".repeat(stars);
};

export function SolutionCard({ solution, rank, onCopy, copiedId }: SolutionCardProps) {
    const [isExpanded, setIsExpanded] = useState(rank === 1); // First solution expanded by default

    return (
        <Card className="overflow-hidden">
            <CardContent className="p-0">
                {/* Header */}
                <div
                    className="flex items-start justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-start gap-3 flex-1">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary">
                            {rank}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">{solution.title}</h4>
                                <span className="text-sm">{priorityStars(solution.priority)}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{solution.description}</p>
                            <div className="flex items-center gap-2 mt-3">
                                <Badge variant="outline" className={effortColors[solution.effort]}>
                                    Effort: {solution.effort}
                                </Badge>
                                <Badge variant="outline" className={impactColors[solution.impact]}>
                                    Impact: {solution.impact}
                                </Badge>
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm">
                        {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </Button>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="border-t bg-muted/20 p-4 space-y-4">
                        {/* Implementation Steps */}
                        <div>
                            <h5 className="font-medium text-sm mb-2">Implementation Steps:</h5>
                            <ol className="space-y-2">
                                {solution.steps.map((step, index) => (
                                    <li key={index} className="flex items-start gap-2 text-sm">
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                            {index + 1}
                                        </span>
                                        <span className="text-muted-foreground">{step}</span>
                                    </li>
                                ))}
                            </ol>
                        </div>

                        {/* Code Example */}
                        {solution.codeExample && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h5 className="font-medium text-sm">Code Example:</h5>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCopy(solution.codeExample!, `code-${solution.id}`);
                                        }}
                                    >
                                        {copiedId === `code-${solution.id}` ? (
                                            <Check className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                                <pre className="overflow-x-auto bg-zinc-950 dark:bg-zinc-900 p-4 rounded-lg border border-zinc-800">
                                    <code className="text-xs font-mono text-zinc-100">
                                        {solution.codeExample}
                                    </code>
                                </pre>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-2">
                            <Button size="sm" variant="default">
                                Apply Fix
                            </Button>
                            <Button size="sm" variant="outline">
                                View Documentation
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}