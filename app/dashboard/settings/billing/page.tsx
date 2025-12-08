import { getCurrentUser } from "@/app/actions/user";
import { getUserSubscription, getBillingHistory } from "@/app/actions/billing";
import { redirect } from "next/navigation";
import { BillingContent } from "@/components/settings/billing-content";

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [subscriptionResult, historyResult] = await Promise.all([
    getUserSubscription(),
    getBillingHistory(),
  ]);

  const subscription = subscriptionResult.success ? subscriptionResult.data?.subscription : null;
  const planDetails = subscriptionResult.success ? subscriptionResult.data?.planDetails : null;
  const invoices = historyResult.success ? historyResult.data?.invoices : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and billing information
        </p>
      </div>

      {/* Billing Content */}
      <BillingContent
        subscription={subscription}
        planDetails={planDetails}
        invoices={invoices || []}
      />
    </div>
  );
}
