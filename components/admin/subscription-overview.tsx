import type { BillingStats } from "@/app/actions/admin/billing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUpIcon, UsersIcon, AlertCircleIcon, DollarSignIcon } from "lucide-react";

interface SubscriptionOverviewProps {
  stats: BillingStats;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function SubscriptionOverview({ stats }: SubscriptionOverviewProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
          <UsersIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {stats.totalActiveSubscriptions.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Currently active paid plans</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">MRR</CardTitle>
          <TrendingUpIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(stats.mrr)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Monthly recurring revenue</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revenue This Month</CardTitle>
          <DollarSignIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(stats.revenueThisMonth)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Paid invoices this calendar month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
          <AlertCircleIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div
            className="text-2xl font-bold"
            style={{ fontVariantNumeric: "tabular-nums", color: stats.failedPaymentsCount > 0 ? "#EF4444" : undefined }}
          >
            {stats.failedPaymentsCount.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Invoices with failed payment</p>
        </CardContent>
      </Card>

      {/* Plan breakdown */}
      {Object.keys(stats.planBreakdown).length > 0 && (
        <Card className="sm:col-span-2 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Subscriptions by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(stats.planBreakdown).map(([plan, count]) => (
                <div key={plan} className="flex items-center gap-2">
                  <span className="text-sm capitalize text-muted-foreground">{plan}</span>
                  <span className="text-sm font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
