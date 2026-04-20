import { Suspense } from "react";
import { getAdminBillingStats, getAdminSubscriptions } from "@/app/actions/admin/billing";
import { SubscriptionOverview } from "@/components/admin/subscription-overview";
import { SubscriptionsTable } from "@/components/admin/subscriptions-table";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Billing Management | Admin",
  description: "Overview of subscriptions, MRR, and failed payments",
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    planType?: string;
  }>;
}

async function BillingContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page) : 1;

  const [statsResult, subsResult] = await Promise.all([
    getAdminBillingStats(),
    getAdminSubscriptions({
      page,
      pageSize: 25,
      search: params.search,
      status: params.status,
      planType: params.planType,
    }),
  ]);

  if (!statsResult.success || !statsResult.data) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <p className="text-destructive">{statsResult.error ?? "Failed to load billing stats"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SubscriptionOverview stats={statsResult.data} />

      <div>
        <h2 className="mb-3 text-base font-semibold">All Subscriptions</h2>
        {subsResult.success && subsResult.data ? (
          <SubscriptionsTable subscriptions={subsResult.data.subscriptions} />
        ) : (
          <p className="text-sm text-destructive">{subsResult.error}</p>
        )}
      </div>
    </div>
  );
}

export default async function AdminBillingPage(props: PageProps) {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Subscription metrics and payment history across all users.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        }
      >
        <BillingContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
