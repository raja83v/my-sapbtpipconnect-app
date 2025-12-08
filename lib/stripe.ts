import Stripe from "stripe";

// Re-export everything from stripe-config for convenience
export * from "./stripe-config";

// Initialize Stripe with secret key - SERVER ONLY
// This file should only be imported in server components, server actions, or API routes
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    "STRIPE_SECRET_KEY is not set. Please add it to your .env file."
  );
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-04-30.basil",
  typescript: true,
});
