"use client";

import { useState } from "react";
import {
  IconCheck,
  IconLoader2,
  IconSparkles,
} from "@tabler/icons-react";
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
import { PRICING_PLANS, formatPrice, type PlanType } from "@/lib/stripe-config";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  planKey: PlanType;
  plan: (typeof PRICING_PLANS)[PlanType];
  isCurrentPlan?: boolean;
  onSelect?: (priceId: string) => void;
  onSelectFree?: () => void;
  isLoading?: boolean;
  mode?: "upgrade" | "select";
  selectedPlan?: PlanType | null;
}

export function PricingCard({
  planKey,
  plan,
  isCurrentPlan = false,
  onSelect,
  onSelectFree,
  isLoading = false,
  mode = "upgrade",
  selectedPlan,
}: PricingCardProps) {
  const isPro = planKey === "PROFESSIONAL";
  const isSelected = selectedPlan === planKey;

  const handleClick = () => {
    if (planKey === "FREE") {
      onSelectFree?.();
    } else if (plan.priceId) {
      onSelect?.(plan.priceId);
    }
  };

  return (
    <Card
      className={cn(
        "relative transition-all",
        isPro && "border-primary shadow-md",
        isCurrentPlan && "bg-muted/50",
        isSelected && "ring-2 ring-primary",
        mode === "select" && "cursor-pointer hover:border-primary/50"
      )}
      onClick={mode === "select" ? handleClick : undefined}
    >
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <Badge className="bg-primary">
            <IconSparkles className="mr-1 h-3 w-3" />
            Most Popular
          </Badge>
        </div>
      )}
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {plan.name}
          {isCurrentPlan && <Badge variant="secondary">Current</Badge>}
          {isSelected && mode === "select" && (
            <Badge variant="default">Selected</Badge>
          )}
        </CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
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
      {mode === "upgrade" && (
        <CardFooter>
          {isCurrentPlan ? (
            <Button disabled className="w-full">
              Current Plan
            </Button>
          ) : planKey === "FREE" ? (
            <Button variant="outline" disabled className="w-full">
              Free Forever
            </Button>
          ) : planKey === "ENTERPRISE" ? (
            <Button variant="outline" className="w-full" asChild>
              <a href="mailto:sales@cpiconnect.io">Contact Sales</a>
            </Button>
          ) : (
            <Button
              className="w-full"
              variant={isPro ? "default" : "outline"}
              onClick={() => plan.priceId && onSelect?.(plan.priceId)}
              disabled={isLoading || !plan.priceId}
            >
              {isLoading && (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Get Started
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

interface PricingGridProps {
  currentPlan?: PlanType;
  onSelect?: (priceId: string) => void;
  onSelectFree?: () => void;
  isLoading?: boolean;
  loadingPriceId?: string | null;
  mode?: "upgrade" | "select";
  selectedPlan?: PlanType | null;
  excludeFree?: boolean;
  excludeEnterprise?: boolean;
}

export function PricingGrid({
  currentPlan,
  onSelect,
  onSelectFree,
  isLoading = false,
  loadingPriceId = null,
  mode = "upgrade",
  selectedPlan = null,
  excludeFree = false,
  excludeEnterprise = false,
}: PricingGridProps) {
  const plans = Object.entries(PRICING_PLANS).filter(([key]) => {
    if (excludeFree && key === "FREE") return false;
    if (excludeEnterprise && key === "ENTERPRISE") return false;
    return true;
  });

  return (
    <div
      className={cn(
        "grid gap-4",
        plans.length <= 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"
      )}
    >
      {plans.map(([planKey, plan]) => (
        <PricingCard
          key={planKey}
          planKey={planKey as PlanType}
          plan={plan}
          isCurrentPlan={currentPlan === planKey}
          onSelect={onSelect}
          onSelectFree={onSelectFree}
          isLoading={isLoading || loadingPriceId === plan.priceId}
          mode={mode}
          selectedPlan={selectedPlan}
        />
      ))}
    </div>
  );
}
