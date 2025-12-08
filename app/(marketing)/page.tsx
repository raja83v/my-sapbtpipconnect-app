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
  CheckCircle2,
  TrendingUp,
  Users,
  Building2
} from "lucide-react";

import { Container } from "@/components/marketing/container";

export default function Home() {
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
                  <Link href="/sign-up">Start Free Trial</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="px-6 text-sm"
                >
                  <Link href="#features">View Features</Link>
                </Button>
              </div>
              <span className="text-muted-foreground mt-4 block text-center text-sm">
                14-day free trial • No credit card required
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

      {/* Pricing Section */}
      <section id="pricing" className="py-12 sm:py-16 bg-muted/50">
        <Container>
          <div className="mx-auto max-w-2xl text-center mb-12">
            <Badge className="mb-4" variant="outline">
              Pricing Plans
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Choose the right plan for your team
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Flexible pricing that scales with your SAP CPI monitoring needs
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-2xl">Starter</CardTitle>
                <CardDescription>Perfect for small teams getting started</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$299</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>Up to 2 CPI tenants</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>50 iFlows monitoring</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>30-day data retention</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>Email notifications</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>Basic analytics</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>5 team members</span>
                  </li>
                </ul>
                <Button className="w-full mt-8" variant="outline" asChild>
                  <Link href="/sign-up">Start Free Trial</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Professional Plan */}
            <Card className="flex flex-col border-indigo-500 border-2 relative">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Most Popular
              </Badge>
              <CardHeader>
                <CardTitle className="text-2xl">Professional</CardTitle>
                <CardDescription>For growing teams with multiple integrations</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$899</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>Up to 10 CPI tenants</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>Unlimited iFlows</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>90-day data retention</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>Email, Slack & Teams notifications</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>Advanced analytics & reporting</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>20 team members</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>Priority support</span>
                  </li>
                </ul>
                <Button className="w-full mt-8" asChild>
                  <Link href="/sign-up">Start Free Trial</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-2xl">Enterprise</CardTitle>
                <CardDescription>For large organizations with complex needs</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">Custom</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>Unlimited CPI tenants</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>Unlimited iFlows</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>Custom data retention</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>All notification channels</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>Custom integrations & APIs</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>Unlimited team members</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>Dedicated support & SLA</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500 mr-2 mt-0.5" />
                    <span>On-premise deployment option</span>
                  </li>
                </ul>
                <Button className="w-full mt-8" variant="outline" asChild>
                  <Link href="/sign-up">Contact Sales</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </Container>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-2xl text-center mb-12">
            <Badge className="mb-4" variant="outline">
              Client Success Stories
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Trusted by SAP integration teams worldwide
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              See how CPI Connect helps organizations monitor and optimize their SAP integrations
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">Reduced MTTR by 75%</CardTitle>
                    <CardDescription className="mt-2">
                      &ldquo;CPI Connect transformed our integration monitoring. We now identify and resolve issues in minutes instead of hours. The payload visibility feature alone has saved us countless debugging hours.&rdquo;
                    </CardDescription>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Michael Torres</p>
                    <p className="text-xs text-muted-foreground">Integration Lead, Global Manufacturing Corp</p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">Proactive Problem Detection</CardTitle>
                    <CardDescription className="mt-2">
                      &ldquo;The real-time alerts and analytics give us complete visibility into our SAP landscape. We catch issues before they impact business operations. It&apos;s like having a 24/7 integration expert on our team.&rdquo;
                    </CardDescription>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Sarah Chen</p>
                    <p className="text-xs text-muted-foreground">SAP Architect, Financial Services Inc</p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">Simplified Multi-Tenant Management</CardTitle>
                    <CardDescription className="mt-2">
                      &ldquo;Managing 8 different CPI tenants was a nightmare until we found CPI Connect. The unified dashboard and global search make it effortless to monitor all our integrations from one place.&rdquo;
                    </CardDescription>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">James Anderson</p>
                    <p className="text-xs text-muted-foreground">Head of IT Operations, Retail Enterprise</p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">Enhanced Team Collaboration</CardTitle>
                    <CardDescription className="mt-2">
                      &ldquo;The audit trail and notification features have streamlined our team collaboration. Everyone knows what&apos;s happening with our integrations, and we can track every change made to our CPI environment.&rdquo;
                    </CardDescription>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Priya Sharma</p>
                    <p className="text-xs text-muted-foreground">Integration Manager, Healthcare Systems</p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">Clear ROI in First Month</CardTitle>
                    <CardDescription className="mt-2">
                      &ldquo;The cost savings from reduced downtime and faster issue resolution paid for CPI Connect in the first month. The error categorization feature is brilliant for root cause analysis.&rdquo;
                    </CardDescription>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">David Mueller</p>
                    <p className="text-xs text-muted-foreground">CIO, Logistics Solutions GmbH</p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">Seamless Integration</CardTitle>
                    <CardDescription className="mt-2">
                      &ldquo;Setup was incredibly smooth with OAuth integration. Within hours, we had full visibility into our CPI landscape. The formatted payload views make debugging so much easier than working in raw XML.&rdquo;
                    </CardDescription>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Emma Williams</p>
                    <p className="text-xs text-muted-foreground">Senior Developer, Tech Innovations Ltd</p>
                  </div>
                </div>
              </CardHeader>
            </Card>
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
              Join hundreds of teams using CPI Connect to monitor, analyze, and optimize their SAP integrations.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                asChild
                size="lg"
                className="px-8 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-shadow"
              >
                <Link href="/sign-up">Start Free Trial</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="px-8"
              >
                <Link href="#pricing">View Pricing</Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              14-day free trial • No credit card required • Cancel anytime
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
