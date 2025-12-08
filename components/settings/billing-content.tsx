"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  IconCheck,
  IconCreditCard,
  IconDownload,
  IconExternalLink,
  IconLoader2,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PRICING_PLANS, formatPrice, type PlanType } from "@/lib/stripe-config";
import {
  createCheckoutSession,
  createBillingPortalSession,
  cancelSubscription,
  resumeSubscription,
} from "@/app/actions/billing";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface BillingContentProps {
  subscription: {
    id: string;
    plan: PlanType;
    status: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    stripeCurrentPeriodEnd: Date | null;
    maxTenants: number;
    maxIFlows: number;
    maxTeamMembers: number;
    maxAIAgentCalls: number;
    currentTenantCount: number;
    currentIFlowCount: number;
    currentTeamMemberCount: number;
    currentAIAgentCalls: number;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
    trialEnd: Date | null;
    createdAt: Date;
  } | null;
  planDetails: (typeof PRICING_PLANS)[PlanType] | null;
  invoices: {
    id: string;
    stripeInvoiceId: string;
    amountPaid: number;
    amountDue: number;
    currency: string;
    status: string;
    invoiceUrl: string | null;
    invoicePdf: string | null;
    hostedInvoiceUrl: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    paidAt: Date | null;
    createdAt: Date;
  }[];
}

export function BillingContent({
  subscription,
  planDetails,
  invoices,
}: BillingContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  // Handle success/cancel params from Stripe redirect
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      toast.success("Subscription updated successfully!");
      // Clear the URL params
      router.replace("/dashboard/settings/billing");
    } else if (canceled === "true") {
      toast.info("Subscription update canceled");
      router.replace("/dashboard/settings/billing");
    }
  }, [searchParams, router]);

  const currentPlan = subscription?.plan || "FREE";
  const currentPlanDetails = PRICING_PLANS[currentPlan];

  const handleUpgrade = async (priceId: string) => {
    setIsLoading(priceId);
    try {
      const result = await createCheckoutSession(priceId);
      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        toast.error(result.error || "Failed to create checkout session");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading("portal");
    try {
      const result = await createBillingPortalSession();
      if (result.success && result.data?.url) {
        window.location.href = result.data.url;
      } else {
        toast.error(result.error || "Failed to open billing portal");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCanceling(true);
    try {
      const result = await cancelSubscription();
      if (result.success) {
        toast.success("Subscription will be canceled at the end of the billing period");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to cancel subscription");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsCanceling(false);
    }
  };

  const handleResumeSubscription = async () => {
    setIsResuming(true);
    try {
      const result = await resumeSubscription();
      if (result.success) {
        toast.success("Subscription resumed successfully!");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to resume subscription");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsResuming(false);
    }
  };

  const getUsagePercentage = (current: number, max: number) => {
    if (max === -1) return 0; // Unlimited
    return Math.min((current / max) * 100, 100);
  };

  const formatUsage = (current: number, max: number) => {
    if (max === -1) return `${current} / Unlimited`;
    return `${current} / ${max}`;
  };

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconCreditCard className="h-5 w-5" />
                Current Plan
              </CardTitle>
              <CardDescription>
                Manage your subscription and billing
              </CardDescription>
            </div>
            <Badge
              variant={subscription?.status === "ACTIVE" ? "default" : "secondary"}
              className="text-sm"
            >
              {subscription?.status || "FREE"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">{currentPlanDetails.name}</h3>
              <p className="text-muted-foreground">
                {formatPrice(currentPlanDetails.price)}
              </p>
            </div>
            {subscription?.cancelAtPeriodEnd && (
              <Badge variant="destructive">Cancels at period end</Badge>
            )}
          </div>

          {subscription?.stripeCurrentPeriodEnd && (
            <p className="text-sm text-muted-foreground">
              {subscription.cancelAtPeriodEnd
                ? "Your subscription will end on "
                : "Next billing date: "}
              <span className="font-medium text-foreground">
                {format(new Date(subscription.stripeCurrentPeriodEnd), "MMMM d, yyyy")}
              </span>
            </p>
          )}

          {/* Usage Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>CPI Tenants</span>
                <span className="text-muted-foreground">
                  {formatUsage(
                    subscription?.currentTenantCount || 0,
                    subscription?.maxTenants || 1
                  )}
                </span>
              </div>
              <Progress
                value={getUsagePercentage(
                  subscription?.currentTenantCount || 0,
                  subscription?.maxTenants || 1
                )}
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>iFlows</span>
                <span className="text-muted-foreground">
                  {formatUsage(
                    subscription?.currentIFlowCount || 0,
                    subscription?.maxIFlows || 10
                  )}
                </span>
              </div>
              <Progress
                value={getUsagePercentage(
                  subscription?.currentIFlowCount || 0,
                  subscription?.maxIFlows || 10
                )}
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Team Members</span>
                <span className="text-muted-foreground">
                  {formatUsage(
                    subscription?.currentTeamMemberCount || 0,
                    subscription?.maxTeamMembers || 3
                  )}
                </span>
              </div>
              <Progress
                value={getUsagePercentage(
                  subscription?.currentTeamMemberCount || 0,
                  subscription?.maxTeamMembers || 3
                )}
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>AI Agent Calls</span>
                <span className="text-muted-foreground">
                  {formatUsage(
                    subscription?.currentAIAgentCalls || 0,
                    subscription?.maxAIAgentCalls || 100
                  )}
                </span>
              </div>
              <Progress
                value={getUsagePercentage(
                  subscription?.currentAIAgentCalls || 0,
                  subscription?.maxAIAgentCalls || 100
                )}
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          {subscription?.stripeSubscriptionId && (
            <Button
              variant="outline"
              onClick={handleManageBilling}
              disabled={isLoading === "portal"}
            >
              {isLoading === "portal" && (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Manage Billing
              <IconExternalLink className="ml-2 h-4 w-4" />
            </Button>
          )}

          {subscription?.cancelAtPeriodEnd ? (
            <Button
              onClick={handleResumeSubscription}
              disabled={isResuming}
            >
              {isResuming && (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Resume Subscription
            </Button>
          ) : subscription?.stripeSubscriptionId ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isCanceling}>
                  Cancel Subscription
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel your subscription? You will
                    continue to have access until the end of your current billing
                    period.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelSubscription}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isCanceling && (
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Cancel Subscription
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </CardFooter>
      </Card>

      {/* Pricing Plans */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(PRICING_PLANS) as [PlanType, (typeof PRICING_PLANS)[PlanType]][]).map(
            ([planKey, plan]) => {
              const isCurrentPlan = currentPlan === planKey;
              const isPro = planKey === "PROFESSIONAL";

              return (
                <Card
                  key={planKey}
                  className={cn(
                    "relative",
                    isPro && "border-primary shadow-md",
                    isCurrentPlan && "bg-muted/50"
                  )}
                >
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary">
                        <IconSparkles className="mr-1 h-3 w-3" />
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {plan.name}
                      {isCurrentPlan && (
                        <Badge variant="secondary">Current</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <span className="text-3xl font-bold">
                        {formatPrice(plan.price)}
                      </span>
                    </div>
                    <ul className="space-y-2 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <IconCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    {isCurrentPlan ? (
                      <Button disabled className="w-full">
                        Current Plan
                      </Button>
                    ) : planKey === "FREE" ? (
                      <Button
                        variant="outline"
                        disabled
                        className="w-full"
                      >
                        Free Forever
                      </Button>
                    ) : planKey === "ENTERPRISE" ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        asChild
                      >
                        <a href="mailto:sales@cpiconnect.io">Contact Sales</a>
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant={isPro ? "default" : "outline"}
                        onClick={() => plan.priceId && handleUpgrade(plan.priceId)}
                        disabled={isLoading === plan.priceId || !plan.priceId}
                      >
                        {isLoading === plan.priceId && (
                          <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {currentPlan === "FREE" ? "Get Started" : "Upgrade"}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            }
          )}
        </div>
      </div>

      {/* Billing History */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>
              View your past invoices and payment history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {format(new Date(invoice.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      ${(invoice.amountPaid / 100).toFixed(2)}{" "}
                      {invoice.currency.toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.status === "PAID"
                            ? "default"
                            : invoice.status === "OPEN"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {invoice.hostedInvoiceUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a
                              href={invoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <IconExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {invoice.invoicePdf && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a
                              href={invoice.invoicePdf}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <IconDownload className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
