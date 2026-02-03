"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, ArrowRight, Loader2 } from "lucide-react";
import { PRICING_PLANS, type PlanType, formatPrice } from "@/lib/stripe-config";
import { getRecommendedUpgrade } from "@/hooks/use-subscription";
import { createCheckoutSession } from "@/app/actions/billing";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface UpgradePromptDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentPlan: PlanType;
    limitType?: "tenants" | "iflows" | "teamMembers" | "aiAgentCalls";
    customMessage?: string;
}

const limitMessages: Record<string, string> = {
    tenants: "You've reached your CPI tenant limit.",
    iflows: "You've reached your iFlow monitoring limit.",
    teamMembers: "You've reached your team member limit.",
    aiAgentCalls: "You've used all your AI agent calls for this month.",
};

/**
 * Dialog prompting user to upgrade their plan
 */
export function UpgradePromptDialog({
    open,
    onOpenChange,
    currentPlan,
    limitType,
    customMessage,
}: UpgradePromptDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const recommendedPlan = getRecommendedUpgrade(currentPlan);

    if (!recommendedPlan) {
        return null;
    }

    const recommendedPlanConfig = PRICING_PLANS[recommendedPlan];
    const currentPlanConfig = PRICING_PLANS[currentPlan];

    const handleUpgrade = async () => {
        if (!recommendedPlanConfig.priceId) {
            // Enterprise plan - redirect to contact
            router.push("/contact?plan=enterprise");
            onOpenChange(false);
            return;
        }

        setIsLoading(true);
        try {
            const result = await createCheckoutSession(recommendedPlan);
            if (result.success && result.data?.url) {
                window.location.href = result.data.url;
            } else if (!result.success) {
                toast.error((result as { success: false; error?: string }).error || "Failed to create checkout session");
            }
        } catch (error) {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const message = customMessage || (limitType ? limitMessages[limitType] : "Upgrade to unlock more features.");

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-full bg-primary/10">
                            <Zap className="h-5 w-5 text-primary" />
                        </div>
                        <Badge variant="secondary">{currentPlanConfig.name} Plan</Badge>
                    </div>
                    <DialogTitle>Upgrade to {recommendedPlanConfig.name}</DialogTitle>
                    <DialogDescription>
                        {message} Upgrade to {recommendedPlanConfig.name} for more capacity and features.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <div className="rounded-lg border p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-semibold">{recommendedPlanConfig.name}</h4>
                                <p className="text-sm text-muted-foreground">
                                    {recommendedPlanConfig.description}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold">
                                    {formatPrice(recommendedPlanConfig.price)}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium">What you&apos;ll get:</p>
                            <ul className="space-y-1.5">
                                {recommendedPlanConfig.features.slice(0, 5).map((feature, index) => (
                                    <li key={index} className="flex items-center gap-2 text-sm">
                                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                                {recommendedPlanConfig.features.length > 5 && (
                                    <li className="text-sm text-muted-foreground pl-6">
                                        +{recommendedPlanConfig.features.length - 5} more features
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >
                        Maybe Later
                    </Button>
                    <Button onClick={handleUpgrade} disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing…
                            </>
                        ) : (
                            <>
                                Upgrade Now
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}