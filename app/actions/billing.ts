"use server";

import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { stripe, PRICING_PLANS, getPlanByPriceId, absoluteUrl, type PlanType } from "@/lib/stripe";
import { getCurrentUser } from "./user";
import { revalidatePath } from "next/cache";

export type ActionResponse<T = void> = 
  | { success: true; data?: T }
  | { success: false; error: string };

// Get user's subscription
export async function getUserSubscription(): Promise<ActionResponse<{
  subscription: {
    id: string;
    plan: PlanType;
    status: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    stripeCurrentPeriodEnd: number | null;
    maxTenants: number;
    maxIFlows: number;
    maxTeamMembers: number;
    maxAIAgentCalls: number;
    currentTenantCount: number;
    currentIFlowCount: number;
    currentTeamMemberCount: number;
    currentAIAgentCalls: number;
    cancelAtPeriodEnd: boolean;
    canceledAt: number | null;
    trialEnd: number | null;
    createdAt: number;
  } | null;
  planDetails: typeof PRICING_PLANS[PlanType];
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const subscription = await convex.query(api.billing.getSubscription, {
      userId: user.id as any,
    });

    const plan = (subscription?.plan as PlanType) || "FREE";
    const planDetails = PRICING_PLANS[plan];

    return {
      success: true,
      data: {
        subscription: subscription ? {
          id: subscription._id,
          plan: subscription.plan as PlanType,
          status: subscription.status,
          stripeCustomerId: subscription.stripeCustomerId || null,
          stripeSubscriptionId: subscription.stripeSubscriptionId || null,
          stripePriceId: subscription.stripePriceId || null,
          stripeCurrentPeriodEnd: subscription.stripeCurrentPeriodEnd || null,
          maxTenants: subscription.maxTenants,
          maxIFlows: subscription.maxIFlows,
          maxTeamMembers: subscription.maxTeamMembers,
          maxAIAgentCalls: subscription.maxAIAgentCalls,
          currentTenantCount: subscription.currentTenantCount,
          currentIFlowCount: subscription.currentIFlowCount,
          currentTeamMemberCount: subscription.currentTeamMemberCount,
          currentAIAgentCalls: subscription.currentAIAgentCalls,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          canceledAt: subscription.canceledAt || null,
          trialEnd: subscription.trialEnd || null,
          createdAt: subscription._creationTime,
        } : null,
        planDetails,
      },
    };
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return { success: false, error: "Failed to fetch subscription" };
  }
}

// Create or get Stripe customer
export async function getOrCreateStripeCustomer(): Promise<ActionResponse<string>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if user already has a subscription with a Stripe customer
    const subscription = await convex.query(api.billing.getSubscription, {
      userId: user.id as any,
    });

    if (subscription?.stripeCustomerId) {
      return { success: true, data: subscription.stripeCustomerId };
    }

    // Check user model for stripe customer id (legacy)
    const dbUser = await convex.query(api.users.getById, {
      id: user.id as any,
    });

    if (dbUser?.stripeCustomerId) {
      // Update subscription if exists
      if (subscription) {
        await convex.mutation(api.billingMutations.updateSubscription, {
          subscriptionId: subscription._id,
          data: { stripeCustomerId: dbUser.stripeCustomerId },
        });
      }
      return { success: true, data: dbUser.stripeCustomerId };
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: {
        userId: user.id,
      },
    });

    // Update user with customer ID
    await convex.mutation(api.userMutations.update, {
      userId: user.id as any,
      data: { stripeCustomerId: customer.id },
    });

    if (subscription) {
      await convex.mutation(api.billingMutations.updateSubscription, {
        subscriptionId: subscription._id,
        data: { stripeCustomerId: customer.id },
      });
    }

    return { success: true, data: customer.id };
  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    return { success: false, error: "Failed to create Stripe customer" };
  }
}

// Create checkout session for subscription
export async function createCheckoutSession(
  priceId: string,
  successUrl?: string,
  cancelUrl?: string
): Promise<ActionResponse<{ url: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const customerResult = await getOrCreateStripeCustomer();
    if (!customerResult.success) {
      return { success: false, error: customerResult.error };
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerResult.data,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || absoluteUrl("/dashboard/settings/billing?success=true"),
      cancel_url: cancelUrl || absoluteUrl("/dashboard/settings/billing?canceled=true"),
      metadata: {
        userId: user.id,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "required",
    });

    if (!session.url) {
      return { success: false, error: "Failed to create checkout session" };
    }

    return { success: true, data: { url: session.url } };
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return { success: false, error: "Failed to create checkout session" };
  }
}

// Create onboarding checkout session (with different redirect URLs)
export async function createOnboardingCheckoutSession(
  priceId: string
): Promise<ActionResponse<{ url: string }>> {
  return createCheckoutSession(
    priceId,
    absoluteUrl("/onboarding?step=tenant&subscription=success"),
    absoluteUrl("/onboarding?step=plan&subscription=canceled")
  );
}

// Create customer portal session
export async function createBillingPortalSession(): Promise<ActionResponse<{ url: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const subscription = await convex.query(api.billing.getSubscription, {
      userId: user.id as any,
    });

    if (!subscription?.stripeCustomerId) {
      return { success: false, error: "No subscription found" };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: absoluteUrl("/dashboard/settings/billing"),
    });

    return { success: true, data: { url: session.url } };
  } catch (error) {
    console.error("Error creating billing portal session:", error);
    return { success: false, error: "Failed to create billing portal session" };
  }
}

// Cancel subscription
export async function cancelSubscription(): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const subscription = await convex.query(api.billing.getSubscription, {
      userId: user.id as any,
    });

    if (!subscription?.stripeSubscriptionId) {
      return { success: false, error: "No active subscription found" };
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await convex.mutation(api.billingMutations.updateSubscription, {
      subscriptionId: subscription._id,
      data: {
        cancelAtPeriodEnd: true,
        canceledAt: Date.now(),
      },
    });

    revalidatePath("/dashboard/settings/billing");
    return { success: true };
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return { success: false, error: "Failed to cancel subscription" };
  }
}

// Resume subscription (undo cancel)
export async function resumeSubscription(): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const subscription = await convex.query(api.billing.getSubscription, {
      userId: user.id as any,
    });

    if (!subscription?.stripeSubscriptionId) {
      return { success: false, error: "No subscription found" };
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await convex.mutation(api.billingMutations.updateSubscription, {
      subscriptionId: subscription._id,
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: undefined,
      },
    });

    revalidatePath("/dashboard/settings/billing");
    return { success: true };
  } catch (error) {
    console.error("Error resuming subscription:", error);
    return { success: false, error: "Failed to resume subscription" };
  }
}

// Get billing history (invoices)
export async function getBillingHistory(): Promise<ActionResponse<{
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
    periodStart: number | null;
    periodEnd: number | null;
    paidAt: number | null;
    createdAt: number;
  }[];
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const invoices = await convex.query(api.billing.getInvoices, {
      userId: user.id as any,
      limit: 10,
    });

    return { 
      success: true, 
      data: { 
        invoices: invoices.map(inv => ({
          id: inv._id,
          stripeInvoiceId: inv.stripeInvoiceId,
          amountPaid: inv.amountPaid,
          amountDue: inv.amountDue,
          currency: inv.currency,
          status: inv.status,
          invoiceUrl: inv.invoiceUrl || null,
          invoicePdf: inv.invoicePdf || null,
          hostedInvoiceUrl: inv.hostedInvoiceUrl || null,
          periodStart: inv.periodStart || null,
          periodEnd: inv.periodEnd || null,
          paidAt: inv.paidAt || null,
          createdAt: inv._creationTime,
        }))
      } 
    };
  } catch (error) {
    console.error("Error fetching billing history:", error);
    return { success: false, error: "Failed to fetch billing history" };
  }
}

// Ensure user has a subscription record (called during onboarding or first login)
export async function ensureUserSubscription(): Promise<ActionResponse<{ subscriptionId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if subscription already exists
    let subscription = await convex.query(api.billing.getSubscription, {
      userId: user.id as any,
    });

    if (!subscription) {
      // Create free tier subscription
      const subscriptionId = await convex.mutation(api.billingMutations.createSubscription, {
        userId: user.id as any,
        plan: "FREE",
        status: "ACTIVE",
        maxTenants: PRICING_PLANS.FREE.limits.maxTenants,
        maxIFlows: PRICING_PLANS.FREE.limits.maxIFlows,
        maxTeamMembers: PRICING_PLANS.FREE.limits.maxTeamMembers,
        maxAIAgentCalls: PRICING_PLANS.FREE.limits.maxAIAgentCalls,
      });

      return { success: true, data: { subscriptionId } };
    }

    return { success: true, data: { subscriptionId: subscription._id } };
  } catch (error) {
    console.error("Error ensuring user subscription:", error);
    return { success: false, error: "Failed to ensure user subscription" };
  }
}

// Update subscription from Stripe webhook
export async function updateSubscriptionFromStripe(
  stripeSubscriptionId: string,
  stripeCustomerId: string,
  stripePriceId: string,
  status: string,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: boolean
): Promise<ActionResponse> {
  try {
    // Find user by Stripe customer ID
    const user = await convex.query(api.users.getByStripeCustomerId, {
      stripeCustomerId,
    });

    if (!user) {
      console.error("User not found for Stripe customer:", stripeCustomerId);
      return { success: false, error: "User not found" };
    }

    // Determine plan from price ID
    const plan = getPlanByPriceId(stripePriceId) || "FREE";
    const planLimits = PRICING_PLANS[plan].limits;

    // Map Stripe status to our enum
    const statusMap: Record<string, string> = {
      active: "ACTIVE",
      canceled: "CANCELED",
      incomplete: "INCOMPLETE",
      incomplete_expired: "INCOMPLETE_EXPIRED",
      past_due: "PAST_DUE",
      trialing: "TRIALING",
      unpaid: "UNPAID",
      paused: "PAUSED",
    };

    const dbStatus = statusMap[status] || "ACTIVE";

    // Check if subscription exists
    const existingSubscription = await convex.query(api.billing.getSubscription, {
      userId: user._id,
    });

    if (existingSubscription) {
      // Update existing subscription
      await convex.mutation(api.billingMutations.updateSubscription, {
        subscriptionId: existingSubscription._id,
        data: {
          stripeSubscriptionId,
          stripeCustomerId,
          stripePriceId,
          plan,
          status: dbStatus,
          stripeCurrentPeriodStart: currentPeriodStart.getTime(),
          stripeCurrentPeriodEnd: currentPeriodEnd.getTime(),
          cancelAtPeriodEnd,
          maxTenants: planLimits.maxTenants,
          maxIFlows: planLimits.maxIFlows,
          maxTeamMembers: planLimits.maxTeamMembers,
          maxAIAgentCalls: planLimits.maxAIAgentCalls,
        },
      });
    } else {
      // Create new subscription
      await convex.mutation(api.billingMutations.createSubscription, {
        userId: user._id,
        stripeSubscriptionId,
        stripeCustomerId,
        stripePriceId,
        plan,
        status: dbStatus,
        stripeCurrentPeriodStart: currentPeriodStart.getTime(),
        stripeCurrentPeriodEnd: currentPeriodEnd.getTime(),
        cancelAtPeriodEnd,
        maxTenants: planLimits.maxTenants,
        maxIFlows: planLimits.maxIFlows,
        maxTeamMembers: planLimits.maxTeamMembers,
        maxAIAgentCalls: planLimits.maxAIAgentCalls,
      });
    }

    // Also update user model
    await convex.mutation(api.userMutations.update, {
      userId: user._id,
      data: {
        stripeCustomerId,
        stripeSubscriptionId,
        stripePriceId,
        stripeCurrentPeriodEnd: currentPeriodEnd.getTime(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating subscription from Stripe:", error);
    return { success: false, error: "Failed to update subscription" };
  }
}

// Create invoice record from Stripe webhook
export async function createInvoiceFromStripe(
  stripeInvoiceId: string,
  stripeCustomerId: string,
  stripePaymentIntentId: string | null,
  amountPaid: number,
  amountDue: number,
  currency: string,
  status: string,
  invoiceUrl: string | null,
  invoicePdf: string | null,
  hostedInvoiceUrl: string | null,
  periodStart: Date | null,
  periodEnd: Date | null,
  paidAt: Date | null
): Promise<ActionResponse> {
  try {
    // Find user by Stripe customer ID
    const user = await convex.query(api.users.getByStripeCustomerId, {
      stripeCustomerId,
    });

    if (!user) {
      console.error("User not found for Stripe customer:", stripeCustomerId);
      return { success: false, error: "User not found" };
    }

    // Map Stripe status to our enum
    const statusMap: Record<string, string> = {
      draft: "DRAFT",
      open: "OPEN",
      paid: "PAID",
      void: "VOID",
      uncollectible: "UNCOLLECTIBLE",
    };

    const dbStatus = statusMap[status] || "DRAFT";

    // Check if invoice exists
    const existingInvoice = await convex.query(api.billing.getInvoiceByStripeId, {
      stripeInvoiceId,
    });

    if (existingInvoice) {
      // Update existing invoice
      await convex.mutation(api.billingMutations.updateInvoice, {
        invoiceId: existingInvoice._id,
        data: {
          stripePaymentIntentId: stripePaymentIntentId || undefined,
          amountPaid,
          amountDue,
          currency,
          status: dbStatus,
          invoiceUrl: invoiceUrl || undefined,
          invoicePdf: invoicePdf || undefined,
          hostedInvoiceUrl: hostedInvoiceUrl || undefined,
          periodStart: periodStart?.getTime(),
          periodEnd: periodEnd?.getTime(),
          paidAt: paidAt?.getTime(),
        },
      });
    } else {
      // Create new invoice
      await convex.mutation(api.billingMutations.createInvoice, {
        userId: user._id,
        stripeInvoiceId,
        stripePaymentIntentId: stripePaymentIntentId || undefined,
        amountPaid,
        amountDue,
        currency,
        status: dbStatus,
        invoiceUrl: invoiceUrl || undefined,
        invoicePdf: invoicePdf || undefined,
        hostedInvoiceUrl: hostedInvoiceUrl || undefined,
        periodStart: periodStart?.getTime(),
        periodEnd: periodEnd?.getTime(),
        paidAt: paidAt?.getTime(),
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error creating invoice from Stripe:", error);
    return { success: false, error: "Failed to create invoice" };
  }
}

// Check if user can perform an action based on their subscription limits
export async function checkSubscriptionLimit(
  limitType: "tenants" | "iflows" | "teamMembers" | "aiAgentCalls"
): Promise<ActionResponse<{ allowed: boolean; current: number; max: number; plan: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const result = await convex.query(api.billing.checkLimits, {
      userId: user.id as any,
      limitType,
    });

    return { 
      success: true, 
      data: result,
    };
  } catch (error) {
    console.error("Error checking subscription limit:", error);
    return { success: false, error: "Failed to check subscription limit" };
  }
}

// Increment usage counter
export async function incrementUsage(
  usageType: "tenants" | "iflows" | "teamMembers" | "aiAgentCalls"
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    await convex.mutation(api.billingMutations.incrementUsage, {
      userId: user.id as any,
      usageType,
    });

    return { success: true };
  } catch (error) {
    console.error("Error incrementing usage:", error);
    return { success: false, error: "Failed to increment usage" };
  }
}

// Decrement usage counter
export async function decrementUsage(
  usageType: "tenants" | "iflows" | "teamMembers" | "aiAgentCalls"
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    await convex.mutation(api.billingMutations.decrementUsage, {
      userId: user.id as any,
      usageType,
    });

    return { success: true };
  } catch (error) {
    console.error("Error decrementing usage:", error);
    return { success: false, error: "Failed to decrement usage" };
  }
}
