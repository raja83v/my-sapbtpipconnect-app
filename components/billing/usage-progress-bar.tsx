"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface UsageProgressBarProps {
    current: number;
    max: number;
    label?: string;
    showPercentage?: boolean;
    showValues?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
}

/**
 * Get the color class based on usage percentage
 */
function getProgressColor(percentUsed: number): string {
    if (percentUsed >= 100) return "bg-destructive";
    if (percentUsed >= 80) return "bg-yellow-500";
    return "bg-primary";
}

/**
 * Format usage display
 */
function formatUsage(current: number, max: number): string {
    if (max === -1) return `${current} / Unlimited`;
    return `${current} / ${max}`;
}

/**
 * Reusable usage progress bar component
 */
export function UsageProgressBar({
    current,
    max,
    label,
    showPercentage = false,
    showValues = true,
    size = "md",
    className,
}: UsageProgressBarProps) {
    const isUnlimited = max === -1;
    const percentUsed = isUnlimited ? 0 : Math.min((current / max) * 100, 100);
    const isOverLimit = !isUnlimited && current >= max;

    const heightClass = {
        sm: "h-1.5",
        md: "h-2",
        lg: "h-3",
    }[size];

    return (
        <div className={cn("space-y-1.5", className)}>
            {(label || showValues || showPercentage) && (
                <div className="flex items-center justify-between text-sm">
                    {label && (
                        <span className="font-medium">{label}</span>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                        {showValues && (
                            <span className={cn(isOverLimit && "text-destructive font-medium")}>
                                {formatUsage(current, max)}
                            </span>
                        )}
                        {showPercentage && !isUnlimited && (
                            <span className={cn(
                                "text-xs",
                                percentUsed >= 100 && "text-destructive font-medium",
                                percentUsed >= 80 && percentUsed < 100 && "text-yellow-600 font-medium"
                            )}>
                                ({percentUsed.toFixed(0)}%)
                            </span>
                        )}
                    </div>
                </div>
            )}

            {isUnlimited ? (
                <div className={cn("rounded-full bg-muted", heightClass)}>
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-primary/20 to-primary/40" />
                </div>
            ) : (
                <div className="relative">
                    <Progress
                        value={percentUsed}
                        className={cn(heightClass, "[&>div]:transition-all")}
                    />
                    {/* Custom color overlay based on usage */}
                    <div
                        className={cn(
                            "absolute inset-0 rounded-full opacity-0",
                            percentUsed >= 80 && "opacity-100"
                        )}
                        style={{
                            background: percentUsed >= 100
                                ? "linear-gradient(to right, hsl(var(--destructive)), hsl(var(--destructive)))"
                                : percentUsed >= 80
                                    ? "linear-gradient(to right, hsl(45, 93%, 47%), hsl(45, 93%, 47%))"
                                    : undefined,
                            width: `${percentUsed}%`,
                        }}
                    />
                </div>
            )}
        </div>
    );
}