"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Info, CheckCircle } from "lucide-react";

export type SeverityLevel = "critical" | "warning" | "info" | "success";

interface SeverityBadgeProps {
    severity: SeverityLevel;
    label?: string;
    showIcon?: boolean;
    className?: string;
}

const severityConfig = {
    critical: {
        icon: AlertCircle,
        className: "bg-red-500/10 text-red-500 border-red-500/20",
        label: "Critical",
    },
    warning: {
        icon: AlertTriangle,
        className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        label: "Warning",
    },
    info: {
        icon: Info,
        className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        label: "Info",
    },
    success: {
        icon: CheckCircle,
        className: "bg-green-500/10 text-green-500 border-green-500/20",
        label: "Success",
    },
};

export function SeverityBadge({
    severity,
    label,
    showIcon = true,
    className,
}: SeverityBadgeProps) {
    const config = severityConfig[severity];
    const Icon = config.icon;
    const displayLabel = label || config.label;

    return (
        <Badge variant="outline" className={cn(config.className, className)}>
            {showIcon && <Icon className="mr-1 h-3 w-3" />}
            {displayLabel}
        </Badge>
    );
}