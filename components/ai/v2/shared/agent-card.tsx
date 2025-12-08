"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    ArrowRight,
    Sparkles,
    Activity,
    Zap,
    AlertCircle,
    Shield,
    FileText,
    TestTube,
    DollarSign,
    TrendingUp,
    MessageSquare,
    type LucideIcon
} from "lucide-react";
import Link from "next/link";

interface AgentCardProps {
    name: string;
    description: string;
    iconName: string;
    color: string;
    slug: string;
    capabilities: string[];
    stats?: {
        executions?: number;
        successRate?: number;
    };
    priority?: "high" | "medium" | "low";
    className?: string;
}

// Map icon names to components
const iconMap: Record<string, LucideIcon> = {
    MessageSquare,
    Sparkles,
    Activity,
    Zap,
    AlertCircle,
    Shield,
    FileText,
    TestTube,
    DollarSign,
    TrendingUp,
};

export function AgentCard({
    name,
    description,
    iconName,
    color,
    slug,
    capabilities,
    stats,
    priority,
    className,
}: AgentCardProps) {
    const Icon = iconMap[iconName] || MessageSquare;
    const priorityColors = {
        high: "bg-red-500/10 text-red-500 border-red-500/20",
        medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    };

    return (
        <Card
            className={cn(
                "group relative overflow-hidden border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all hover:shadow-lg",
                className
            )}
        >
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div
                        className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-lg",
                            `bg-${color}-500/10`
                        )}
                    >
                        <Icon className={cn("h-6 w-6", `text-${color}-500`)} />
                    </div>
                    {priority && (
                        <Badge variant="outline" className={cn("text-xs", priorityColors[priority])}>
                            {priority === "high" ? "Priority" : priority}
                        </Badge>
                    )}
                </div>
                <CardTitle className="text-lg mt-4">{name}</CardTitle>
                <CardDescription className="line-clamp-2">{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Capabilities */}
                    <div className="flex flex-wrap gap-1">
                        {capabilities.slice(0, 3).map((capability, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                                {capability}
                            </Badge>
                        ))}
                        {capabilities.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                                +{capabilities.length - 3} more
                            </Badge>
                        )}
                    </div>

                    {/* Stats */}
                    {stats && (
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {stats.executions !== undefined && (
                                <div>
                                    <span className="font-semibold text-foreground">{stats.executions}</span> uses
                                </div>
                            )}
                            {stats.successRate !== undefined && (
                                <div>
                                    <span className="font-semibold text-foreground">{stats.successRate}%</span>{" "}
                                    success
                                </div>
                            )}
                        </div>
                    )}

                    {/* Launch Button */}
                    <Button asChild className="w-full group-hover:bg-primary">
                        <Link href={`/dashboard/ai-agents/${slug}`}>
                            Launch Agent
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}