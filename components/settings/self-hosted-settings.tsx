"use client";

import { useEffect, useState } from "react";
import {
  IconServer,
  IconBrain,
  IconGauge,
  IconCheck,
  IconX,
  IconLoader2,
} from "@tabler/icons-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface HealthData {
  status: string;
  version?: string;
  deployment_mode?: string;
  timestamp?: string;
}

function StatusBadge({ ok }: { ok: boolean | null }) {
  if (ok === null) {
    return (
      <Badge variant="outline" className="gap-1">
        <IconLoader2 className="h-3 w-3 animate-spin" />
        Checking…
      </Badge>
    );
  }
  return ok ? (
    <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
      <IconCheck className="h-3 w-3" />
      Healthy
    </Badge>
  ) : (
    <Badge variant="destructive" className="gap-1">
      <IconX className="h-3 w-3" />
      Unhealthy
    </Badge>
  );
}

function LimitRow({ label, value }: { label: string; value: string | undefined }) {
  const display = value && value !== "-1" && value !== "" ? value : "Unlimited";
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{display}</span>
    </div>
  );
}

export function SelfHostedSettings() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        setHealthOk(res.ok);
        return res.json();
      })
      .then((data) => setHealth(data))
      .catch(() => setHealthOk(false));
  }, []);

  const aiProvider = process.env.NEXT_PUBLIC_AI_PROVIDER || "llmlite";

  return (
    <div className="space-y-6">
      {/* Instance Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconServer className="h-5 w-5" />
              <CardTitle>Instance</CardTitle>
            </div>
            <StatusBadge ok={healthOk} />
          </div>
          <CardDescription>
            Self-hosted CPI Connect instance information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Deployment Mode</span>
              <Badge variant="outline">Self-Hosted</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="text-sm font-medium">{health?.version ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">License</span>
              <span className="text-sm font-medium">AGPL-3.0 (Free Forever)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Provider */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconBrain className="h-5 w-5" />
            <CardTitle>AI Provider</CardTitle>
          </div>
          <CardDescription>
            AI model routing is handled by LiteLLM. Configure models in{" "}
            <code className="text-xs">docker/litellm-config.yaml</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Provider</span>
              <Badge variant="secondary" className="capitalize">{aiProvider}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resource Limits */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconGauge className="h-5 w-5" />
            <CardTitle>Resource Limits</CardTitle>
          </div>
          <CardDescription>
            Configured via environment variables. Leave empty for unlimited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            <LimitRow label="AI Calls / Month" value={process.env.NEXT_PUBLIC_SELF_HOSTED_AI_CALLS_LIMIT} />
            <LimitRow label="Max Tenants" value={process.env.NEXT_PUBLIC_SELF_HOSTED_MAX_TENANTS} />
            <LimitRow label="Max iFlows" value={process.env.NEXT_PUBLIC_SELF_HOSTED_MAX_IFLOWS} />
            <LimitRow label="Max Team Members" value={process.env.NEXT_PUBLIC_SELF_HOSTED_MAX_MEMBERS} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
