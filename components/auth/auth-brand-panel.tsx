"use client";

import {
  Activity,
  Cloud,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}

const features: Feature[] = [
  {
    icon: <Activity className="h-5 w-5" strokeWidth={1.75} />,
    title: "Real-time monitoring",
    description:
      "Track every iflow, message and integration across all your SAP CPI tenants — live.",
    accent: "from-indigo-500/20 to-indigo-500/0 text-indigo-300 ring-indigo-400/30",
  },
  {
    icon: <Sparkles className="h-5 w-5" strokeWidth={1.75} />,
    title: "AI-powered insights",
    description:
      "Ask questions in plain English and get root-cause analysis, fixes and code suggestions.",
    accent: "from-fuchsia-500/20 to-fuchsia-500/0 text-fuchsia-300 ring-fuchsia-400/30",
  },
  {
    icon: <MessagesSquare className="h-5 w-5" strokeWidth={1.75} />,
    title: "Unified message logs",
    description:
      "Search, filter and replay APIM and CPI message traces from a single timeline.",
    accent: "from-sky-500/20 to-sky-500/0 text-sky-300 ring-sky-400/30",
  },
  {
    icon: <Zap className="h-5 w-5" strokeWidth={1.75} />,
    title: "API products dashboard",
    description:
      "Visualize traffic, latency and consumer adoption across every published API.",
    accent: "from-amber-500/20 to-amber-500/0 text-amber-300 ring-amber-400/30",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />,
    title: "Enterprise-grade security",
    description:
      "Multi-tenant isolation, encrypted credentials and SSO — built for regulated teams.",
    accent: "from-emerald-500/20 to-emerald-500/0 text-emerald-300 ring-emerald-400/30",
  },
];

export function AuthBrandPanel() {
  return (
    <div className="relative hidden h-full flex-col overflow-hidden bg-zinc-950 p-10 text-white dark:border-r lg:flex">
      {/* Gradient orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl"
      />

      {/* Dot grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.4) 1px, transparent 0)",
          backgroundSize: "22px 22px",
          maskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />

      {/* Top edge highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />

      {/* Logo */}
      <div className="relative z-20 flex items-center gap-2.5 text-lg font-medium">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30 ring-1 ring-white/10">
          <Cloud className="h-5 w-5 text-white" strokeWidth={2} />
        </div>
        <span className="bg-gradient-to-r from-white via-indigo-100 to-fuchsia-200 bg-clip-text text-transparent font-bold tracking-tight">
          CPI Connect
        </span>
      </div>

      {/* Headline */}
      <div className="relative z-20 mt-14">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Built for SAP&nbsp;BTP integration teams
        </div>
        <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight">
          Observability &amp; control for every
          <span className="bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">
            {" "}
            integration flow
          </span>
          .
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
          One workspace to monitor SAP CPI &amp; APIM, troubleshoot with AI,
          and ship reliable integrations faster.
        </p>
      </div>

      {/* Feature list */}
      <ul className="relative z-20 mt-10 space-y-3">
        {features.map((feature) => (
          <li
            key={feature.title}
            className="group relative flex gap-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 backdrop-blur-sm transition-colors hover:border-white/15 hover:bg-white/[0.05]"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ring-1 ${feature.accent}`}
            >
              {feature.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                {feature.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                {feature.description}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {/* Footer stat strip */}
      <div className="relative z-20 mt-auto pt-8">
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
          <Stat value="50+" label="Tenants" />
          <Stat value="99.9%" label="Uptime" />
          <Stat value="<2s" label="Insights" />
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-lg font-semibold text-transparent tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
    </div>
  );
}
