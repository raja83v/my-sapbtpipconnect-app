"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  IconShieldCheck,
  IconClock,
  IconCalendar,
  IconKey,
  IconGauge,
} from "@tabler/icons-react";
import { format } from "date-fns";
import type { APIProductListItem } from "@/app/actions/api-products";

interface APIProductOverviewTabProps {
  product: APIProductListItem;
}

function getStatusBadge(status: string) {
  switch (status.toUpperCase()) {
    case "PUBLISHED":
      return (
        <Badge className="bg-green-500 hover:bg-green-600 text-white">
          Published
        </Badge>
      );
    case "DEPRECATED":
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white">
          Deprecated
        </Badge>
      );
    case "RETIRED":
      return <Badge variant="destructive">Retired</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
      <dt className="text-sm font-medium text-muted-foreground min-w-[140px] shrink-0">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export function APIProductOverviewTab({ product }: APIProductOverviewTabProps) {
  const hasQuota = product.quota !== undefined && product.quota !== null;

  return (
    <div className="space-y-6">
      {/* Status & Identity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <IconShieldCheck className="h-4 w-4 text-muted-foreground" />
            Product Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <InfoRow label="Technical Name" value={
              <code className="text-xs bg-secondary px-2 py-1 rounded">
                {product.name}
              </code>
            } />
            <InfoRow label="Display Title" value={product.title} />
            <InfoRow label="Status" value={getStatusBadge(product.status)} />
            {product.description && (
              <>
                <Separator />
                <div className="space-y-1">
                  <dt className="text-sm font-medium text-muted-foreground">
                    Description
                  </dt>
                  <dd className="text-sm text-muted-foreground leading-relaxed">
                    {product.description}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Access & Security */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <IconKey className="h-4 w-4 text-muted-foreground" />
            Access &amp; Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <InfoRow
              label="OAuth Scope"
              value={
                product.scope ? (
                  <code className="text-xs bg-secondary px-2 py-1 rounded">
                    {product.scope}
                  </code>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )
              }
            />
          </dl>
        </CardContent>
      </Card>

      {/* Quota */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <IconGauge className="h-4 w-4 text-muted-foreground" />
            Rate Limiting &amp; Quota
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasQuota ? (
            <dl className="space-y-4">
              <InfoRow
                label="Quota Limit"
                value={
                  <span className="font-mono">
                    {product.quota!.toLocaleString()} calls
                  </span>
                }
              />
              <InfoRow
                label="Interval"
                value={
                  product.quotaInterval !== undefined ? (
                    <span className="font-mono">{product.quotaInterval}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
              <InfoRow
                label="Time Unit"
                value={
                  product.quotaTimeUnit ? (
                    <span className="capitalize">
                      {product.quotaTimeUnit.toLowerCase()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No quota configured — unlimited access
            </p>
          )}
        </CardContent>
      </Card>

      {/* Timestamps */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <IconClock className="h-4 w-4 text-muted-foreground" />
            Timestamps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <InfoRow
              label="Created"
              value={
                product.createdAt ? (
                  <span className="flex items-center gap-2">
                    <IconCalendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(new Date(product.createdAt), "PPP p")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )
              }
            />
            <InfoRow
              label="Last Modified"
              value={
                product.modifiedAt ? (
                  <span className="flex items-center gap-2">
                    <IconCalendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(new Date(product.modifiedAt), "PPP p")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )
              }
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
