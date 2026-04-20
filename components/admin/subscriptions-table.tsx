import type { AdminSubscriptionRow } from "@/app/actions/admin/billing";
import { Badge } from "@/components/ui/badge";

interface SubscriptionsTableProps {
  subscriptions: AdminSubscriptionRow[];
}

function statusVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  switch (status) {
    case "ACTIVE": return "default";
    case "PAST_DUE": return "destructive";
    case "CANCELED": return "secondary";
    case "TRIALING": return "outline";
    default: return "secondary";
  }
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function SubscriptionsTable({ subscriptions }: SubscriptionsTableProps) {
  if (subscriptions.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No subscriptions found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table
        className="w-full text-sm"
        style={{ fontVariantNumeric: "tabular-nums" }}
        aria-label="Subscriptions"
      >
        <thead>
          <tr className="border-b bg-muted/50 text-muted-foreground">
            <th className="px-4 py-2 text-left font-medium">User</th>
            <th className="px-4 py-2 text-left font-medium">Plan</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="px-4 py-2 text-left font-medium">Renews</th>
            <th className="px-4 py-2 text-left font-medium">Since</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => (
            <tr key={sub.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium">{sub.userName ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{sub.userEmail}</div>
              </td>
              <td className="px-4 py-3 capitalize">{sub.planType}</td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant(sub.status)} className="text-xs capitalize">
                  {sub.status.toLowerCase().replace("_", " ")}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(sub.currentPeriodEnd)}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(sub.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
