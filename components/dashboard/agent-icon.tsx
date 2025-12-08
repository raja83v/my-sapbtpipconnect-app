"use client";

import {
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
  type LucideIcon,
} from "lucide-react";

// Map of icon names to components - this allows us to render icons dynamically in Client Components
const iconMap: Record<string, LucideIcon> = {
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
};

interface AgentIconProps {
  iconName: string;
  color: string;
  className?: string;
}

export function AgentIcon({ iconName, color, className }: AgentIconProps) {
  const Icon = iconMap[iconName];
  
  if (!Icon) {
    return null;
  }

  return <Icon className={className} />;
}

interface AgentIconWithBackgroundProps {
  iconName: string;
  color: string;
}

export function AgentIconWithBackground({ iconName, color }: AgentIconWithBackgroundProps) {
  const Icon = iconMap[iconName];
  
  if (!Icon) {
    return null;
  }

  // Using inline styles since dynamic Tailwind classes don't work well
  const colorStyles: Record<string, { bg: string; text: string }> = {
    indigo: { bg: "rgba(99, 102, 241, 0.1)", text: "rgb(99, 102, 241)" },
    red: { bg: "rgba(239, 68, 68, 0.1)", text: "rgb(239, 68, 68)" },
    yellow: { bg: "rgba(234, 179, 8, 0.1)", text: "rgb(234, 179, 8)" },
    green: { bg: "rgba(34, 197, 94, 0.1)", text: "rgb(34, 197, 94)" },
    blue: { bg: "rgba(59, 130, 246, 0.1)", text: "rgb(59, 130, 246)" },
    purple: { bg: "rgba(168, 85, 247, 0.1)", text: "rgb(168, 85, 247)" },
    orange: { bg: "rgba(249, 115, 22, 0.1)", text: "rgb(249, 115, 22)" },
    cyan: { bg: "rgba(6, 182, 212, 0.1)", text: "rgb(6, 182, 212)" },
    pink: { bg: "rgba(236, 72, 153, 0.1)", text: "rgb(236, 72, 153)" },
    teal: { bg: "rgba(20, 184, 166, 0.1)", text: "rgb(20, 184, 166)" },
  };

  const style = colorStyles[color] || colorStyles.indigo;

  return (
    <div
      className="p-2 rounded-lg flex-shrink-0"
      style={{ backgroundColor: style.bg }}
    >
      <Icon className="h-5 w-5" style={{ color: style.text }} />
    </div>
  );
}

interface AgentProgressBarProps {
  color: string;
  percentage: number;
}

export function AgentProgressBar({ color, percentage }: AgentProgressBarProps) {
  const colorStyles: Record<string, string> = {
    indigo: "rgb(99, 102, 241)",
    red: "rgb(239, 68, 68)",
    yellow: "rgb(234, 179, 8)",
    green: "rgb(34, 197, 94)",
    blue: "rgb(59, 130, 246)",
    purple: "rgb(168, 85, 247)",
    orange: "rgb(249, 115, 22)",
    cyan: "rgb(6, 182, 212)",
    pink: "rgb(236, 72, 153)",
    teal: "rgb(20, 184, 166)",
  };

  const bgColor = colorStyles[color] || colorStyles.indigo;

  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all"
        style={{ width: `${percentage}%`, backgroundColor: bgColor }}
      />
    </div>
  );
}
