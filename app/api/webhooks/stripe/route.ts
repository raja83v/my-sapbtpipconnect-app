import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { updateSubscriptionFromStripe, createInvoiceFromStripe } from "@/app/actions/billing";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("Stripe-Signature");

  if (!signature) {
    return new NextResponse("Missing Stripe signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return new NextResponse(`Webhook Error: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Handle subscription checkout completion
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          
          await handleSubscriptionChange(subscription);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      case "invoice.finalized": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceFinalized(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error(`Webhook handler error:`, error);
    return new NextResponse(`Webhook handler failed`, { status: 500 });
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id;
  
  if (!priceId) {
    console.error("No price ID found in subscription");
    return;
  }

  await updateSubscriptionFromStripe(
    subscription.id,
    subscription.customer as string,
    priceId,
    subscription.status,
    new Date(subscription.current_period_start * 1000),
    new Date(subscription.current_period_end * 1000),
    subscription.cancel_at_period_end
  );
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // When subscription is deleted, update to FREE plan
  const priceId = subscription.items.data[0]?.price.id || "";
  
  await updateSubscriptionFromStripe(
    subscription.id,
    subscription.customer as string,
    priceId,
    "canceled",
    new Date(subscription.current_period_start * 1000),
    new Date(subscription.current_period_end * 1000),
    true
  );
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  await createInvoiceFromStripe(
    invoice.id,
    invoice.customer as string,
    invoice.payment_intent as string | null,
    invoice.amount_paid,
    invoice.amount_due,
    invoice.currency,
    invoice.status || "paid",
    invoice.invoice_pdf || null,
    invoice.invoice_pdf || null,
    invoice.hosted_invoice_url || null,
    invoice.period_start ? new Date(invoice.period_start * 1000) : null,
    invoice.period_end ? new Date(invoice.period_end * 1000) : null,
    invoice.status_transitions?.paid_at 
      ? new Date(invoice.status_transitions.paid_at * 1000) 
      : new Date()
  );
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Update invoice status
  await createInvoiceFromStripe(
    invoice.id,
    invoice.customer as string,
    invoice.payment_intent as string | null,
    invoice.amount_paid,
    invoice.amount_due,
    invoice.currency,
    "open", // Payment failed, invoice remains open
    invoice.invoice_pdf || null,
    invoice.invoice_pdf || null,
    invoice.hosted_invoice_url || null,
    invoice.period_start ? new Date(invoice.period_start * 1000) : null,
    invoice.period_end ? new Date(invoice.period_end * 1000) : null,
    null
  );

  // TODO: Send email notification about payment failure
  console.log(`Payment failed for invoice: ${invoice.id}`);
}

async function handleInvoiceFinalized(invoice: Stripe.Invoice) {
  await createInvoiceFromStripe(
    invoice.id,
    invoice.customer as string,
    invoice.payment_intent as string | null,
    invoice.amount_paid,
    invoice.amount_due,
    invoice.currency,
    invoice.status || "open",
    invoice.invoice_pdf || null,
    invoice.invoice_pdf || null,
    invoice.hosted_invoice_url || null,
    invoice.period_start ? new Date(invoice.period_start * 1000) : null,
    invoice.period_end ? new Date(invoice.period_end * 1000) : null,
    null
  );
}
