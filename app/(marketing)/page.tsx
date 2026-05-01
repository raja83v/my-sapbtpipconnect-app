import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { 
  Activity, 
  AlertCircle, 
  Bell, 
  Database, 
  Eye, 
  Search, 
  Shield, 
  Zap,
  TrendingUp,
  Github,
  Check,
  Bot,
  FileText,
  Workflow,
  Heart,
  Server,
  Lock,
  Code2,
} from "lucide-react";

import { Container } from "@/components/marketing/container";
import { ProductTour } from "@/components/marketing/product-tour";
import { siteConfig } from "@/lib/config";
import { isCloudMode } from "@/lib/deployment";

export default function Home() {
  const cloud = isCloudMode();
  const primaryCtaHref = cloud
    ? `${siteConfig.links.github}#quick-start`
    : "/sign-up";
  const primaryCtaLabel = cloud ? "Self-Host Now" : "Get Started Free";

  return (
    <>
      {/* Hero Section */}
      <section
        id="home"
        className="overflow-hidden border-b [--color-border:var(--border-illustration)]"
      >
        <div className="relative">
          <div className="relative mx-auto max-w-5xl px-6 pt-32 text-center sm:pt-44">
            <div className="relative mx-auto max-w-3xl text-center">
              <Badge className="mb-4" variant="outline">
                SAP Cloud Platform Integration
              </Badge>
              <h1 className="text-foreground text-balance text-5xl font-semibold sm:text-6xl">
                Monitor Your SAP CPI{" "}
                <span className="relative text-indigo-500">
                  <svg
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 -bottom-3 w-full"
                    viewBox="0 0 283 22"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M1.24715 19.3744C72.4051 10.3594 228.122 -4.71194 281.724 7.12332"
                      stroke="url(#paint0_linear_pl)"
                      strokeWidth="4"
                    />
                    <defs>
                      <linearGradient
                        id="paint0_linear_pl"
                        x1="282"
                        y1="5.49999"
                        x2="40"
                        y2="13"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="var(--color-indigo-300)" />
                        <stop offset="1" stopColor="var(--color-blue-200)" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="relative">iFlows</span>
                </span>{" "}
                in Real-Time
              </h1>
              <p className="text-muted-foreground mb-9 mt-7 text-balance text-lg">
                CPI Connect provides real-time monitoring and analytics for your SAP Cloud Platform Integration. 
                Track iFlows, analyze payloads, and resolve issues faster with intelligent dashboards.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button
                  asChild
                  size="lg"
                  className="border-transparent px-6 text-sm shadow-xl shadow-indigo-950/30"
                >
                  <Link
                    href={primaryCtaHref}
                    {...(cloud
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {primaryCtaLabel}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="px-6 text-sm"
                >
                  <Link href={siteConfig.links.github} target="_blank" rel="noopener noreferrer">
                    <Github className="mr-2 h-4 w-4" />
                    Star on GitHub
                  </Link>
                </Button>
              </div>
              <span className="text-muted-foreground mt-4 block text-center text-sm">
                Cloud hosted or self-hosted &middot; Always open source
              </span>
            </div>
          </div>
          <Container className="bg-background **:data-[slot=content]:py-0 mt-8 sm:mt-16">
            <div
              aria-hidden
              className="h-3 w-full bg-[repeating-linear-gradient(-45deg,var(--color-foreground),var(--color-foreground)_1px,transparent_1px,transparent_4px)] opacity-5"
            />
            <div className="-mx-12 -mt-4 px-12 pt-4">
              <div className="bg-background ring-foreground/5 p-1 shadow-2xl shadow-indigo-900/35 ring-1">
                <div className="bg-background sm:aspect-3/2 relative origin-top overflow-hidden border-l-8 border-t-4 border-transparent">
                  <Image
                    className="object-top-left min-w-xl size-full object-cover"
                    src="/hero.png"
                    alt="CPI Connect Dashboard Overview"
                    width={1152}
                    height={768}
                    priority
                    fetchPriority="high"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1152px"
                  />
                </div>
              </div>
            </div>
          </Container>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-20">
        <Container>
          <div className="mx-auto max-w-2xl text-center mb-12">
            <Badge className="mb-4" variant="outline">
              Powerful Features
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything you need to monitor SAP CPI
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Comprehensive monitoring and analytics tools designed for enterprise SAP integrations
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <Activity className="h-10 w-10 text-indigo-500 mb-2" />
                <CardTitle>iFlow Monitoring</CardTitle>
                <CardDescription>
                  Real-time and historical execution logs with status tracking: Completed, Failed, Processing, Skipped
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Eye className="h-10 w-10 text-indigo-500 mb-2" />
                <CardTitle>Payload Visibility</CardTitle>
                <CardDescription>
                  Drill-down views for request and response payloads with formatted XML/JSON display for Inbound and Outbound messages
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <AlertCircle className="h-10 w-10 text-indigo-500 mb-2" />
                <CardTitle>Error Analysis</CardTitle>
                <CardDescription>
                  Categorized error lists (System, Network, Mapping, Security) with quick links to CPI message IDs and retry options
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Bell className="h-10 w-10 text-indigo-500 mb-2" />
                <CardTitle>Alerts & Notifications</CardTitle>
                <CardDescription>
                  Email, Slack, and Teams notifications for failed iFlows or performance threshold breaches
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Search className="h-10 w-10 text-indigo-500 mb-2" />
                <CardTitle>Global Search</CardTitle>
                <CardDescription>
                  Search across all tenants, iFlows, and payload content with advanced filters for rapid troubleshooting
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Database className="h-10 w-10 text-indigo-500 mb-2" />
                <CardTitle>Multi-Tenant Support</CardTitle>
                <CardDescription>
                  Securely connect to multiple SAP CPI tenants using OAuth or service keys for centralized monitoring
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-indigo-500 mb-2" />
                <CardTitle>Audit & History</CardTitle>
                <CardDescription>
                  Track user actions, iFlow executions, and configuration changes with comprehensive audit trails
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="h-10 w-10 text-indigo-500 mb-2" />
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>
                  Monitor execution times, throughput, and system health with real-time performance dashboards
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="h-10 w-10 text-indigo-500 mb-2" />
                <CardTitle>Analytics Dashboard</CardTitle>
                <CardDescription>
                  Visual analytics with charts and graphs showing trends, success rates, and system utilization
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </Container>
      </section>

      {/* Product Tour Section */}
      <ProductTour />

      {/* Why CPI Connect Section */}
      <section id="why-cpi-connect" className="py-12 sm:py-16 bg-muted/50">
        <Container>
          <div className="mx-auto max-w-2xl text-center mb-12">
            <Badge className="mb-4" variant="outline">
              Why CPI Connect
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Why CPI Connect?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Open source at its core, available as a managed cloud service or self-hosted on your infrastructure
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <Heart className="h-10 w-10 text-indigo-500 mb-2" />
                <CardTitle>Open Source & Transparent</CardTitle>
                <CardDescription>
                  Every feature is available on every plan. No hidden paywalls, no feature gates. Self-hosted users get the full experience, free forever.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Server className="h-10 w-10 text-indigo-500 mb-2" />
                <CardTitle>Your Choice of Deployment</CardTitle>
                <CardDescription>
                  Run it on our cloud for zero maintenance, or self-host with Docker Compose, Kubernetes, or bare metal — same codebase, your rules.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Lock className="h-10 w-10 text-indigo-500 mb-2" />
                <CardTitle>Data Ownership</CardTitle>
                <CardDescription>
                  Your SAP credentials and integration data never leave your network when self-hosted. Full control, zero vendor lock-in.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Code2 className="h-10 w-10 text-indigo-500 mb-2" />
                <CardTitle>Community-Driven</CardTitle>
                <CardDescription>
                  Built by SAP integration professionals. Contribute features, report bugs, or fork and customize to your needs.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </Container>
      </section>

      {/* What's Inside Section */}
      <section id="modules" className="py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-2xl text-center mb-12">
            <Badge className="mb-4" variant="outline">
              What&rsquo;s Inside
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              One app, six modules for the full CPI lifecycle
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Every capability ships in the open-source repo. No add-ons, no upsells — clone it and you have everything below.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Activity,
                title: "Monitoring & MPL",
                description:
                  "Live message processing logs across every tenant with payload viewer, error categorisation, and one-click resends.",
                bullets: ["Multi-tenant MPL stream", "Formatted XML / JSON payloads", "Bulk resend & retry"],
              },
              {
                icon: Workflow,
                title: "iFlow Studio",
                description:
                  "Design, test, and ship integration flows from the browser \u2014 with an AI co-pilot that drafts BPMN from a prompt.",
                bullets: ["AI-generated iFlow scaffolds", "In-browser test runs", "Runtime credential vault"],
              },
              {
                icon: Bot,
                title: "AI Agents",
                description:
                  "A multi-agent pipeline that reasons over your CPI landscape \u2014 explains errors, drafts fixes, and answers tenant questions.",
                bullets: ["Error root-cause analysis", "Conversational tenant Q&A", "Bring your own LLM (LiteLLM / Google)"],
              },
              {
                icon: FileText,
                title: "Documentation Generator",
                description:
                  "Turn any iFlow into reviewer-ready Word docs with diagrams, mappings, and step-by-step descriptions.",
                bullets: ["BPMN to narrative prose", "DOCX export", "Editable templates"],
              },
              {
                icon: TrendingUp,
                title: "Cost Analyzer",
                description:
                  "Spot expensive iFlows, idle tenants, and oversized payloads before they show up on the SAP invoice.",
                bullets: ["Per-iFlow cost attribution", "Anomaly detection", "Trend dashboards"],
              },
              {
                icon: Server,
                title: "MCP Server",
                description:
                  "A built-in Model Context Protocol server so Claude, Cursor, or VS Code Copilot can query your CPI data directly.",
                bullets: ["MPL & iFlow tools", "OAuth-scoped access", "Drop into any MCP client"],
              },
            ].map((mod) => {
              const Icon = mod.icon;
              return (
                <Card key={mod.title} className="border-foreground/10">
                  <CardHeader>
                    <div className="bg-indigo-50 dark:bg-indigo-950/40 mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg">
                      <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" strokeWidth={1.75} />
                    </div>
                    <CardTitle className="text-lg">{mod.title}</CardTitle>
                    <CardDescription className="mt-2">{mod.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {mod.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" strokeWidth={2.5} />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">Built on a modern, open stack</p>
            <ul className="flex flex-wrap items-center justify-center gap-2">
              {[
                "Next.js 16",
                "React 19",
                "TypeScript",
                "PostgreSQL",
                "Drizzle ORM",
                "Better-Auth",
                "Vercel AI SDK",
                "shadcn/ui",
                "Tailwind CSS",
              ].map((tech) => (
                <li
                  key={tech}
                  className="border-foreground/10 bg-background/60 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {tech}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden border-t">
        <div className="absolute inset-0 bg-linear-to-br from-indigo-50 via-blue-50 to-indigo-50 dark:from-indigo-950/20 dark:via-blue-950/20 dark:to-indigo-950/20" />
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(99 102 241 / 0.15) 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}
        />
        <Container className="relative py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-6" variant="outline">
              Get Started Today
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl mb-6">
              Ready to transform your{" "}
              <span className="bg-linear-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                SAP CPI monitoring?
              </span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
              Join the growing community of teams using CPI Connect to monitor, analyze, and optimize their SAP integrations.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                asChild
                size="lg"
                className="px-8 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-shadow"
              >
                <Link
                  href={primaryCtaHref}
                  {...(cloud
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {primaryCtaLabel}
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="px-8"
              >
                <Link href={siteConfig.links.github} target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2 h-4 w-4" />
                  View on GitHub
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Cloud hosted or self-hosted &middot; Always open source
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
