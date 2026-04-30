"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IconArrowLeft,
  IconApi,
  IconRoute,
  IconRefresh,
} from "@tabler/icons-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { APIProductOverviewTab } from "./api-product-overview-tab";
import { APIProductProxiesTab } from "./api-product-proxies-tab";
import type { APIProductDetailResult } from "@/app/actions/api-products";

interface APIProductDetailTabsProps {
  data: APIProductDetailResult;
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

export function APIProductDetailTabs({ data }: APIProductDetailTabsProps) {
  const { product, proxies } = data;
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {/* Back link */}
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/dashboard/apis">
              <IconArrowLeft className="h-4 w-4 mr-1" />
              Back to APIs
            </Link>
          </Button>

          {/* Title row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <IconApi className="h-6 w-6 text-muted-foreground shrink-0" />
              <h1 className="text-2xl font-bold tracking-tight">
                {product.title}
              </h1>
            </div>
            {getStatusBadge(product.status)}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <code className="bg-secondary px-2 py-0.5 rounded text-xs">
              {product.name}
            </code>
            {product.modifiedAt && (
              <span>
                Modified{" "}
                {formatDistanceToNow(new Date(product.modifiedAt), {
                  addSuffix: true,
                })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <IconRoute className="h-3.5 w-3.5" />
              {proxies.length} Prox{proxies.length === 1 ? "y" : "ies"}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            aria-label="Refresh product details"
          >
            <IconRefresh className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="proxies">
            API Proxies
            {proxies.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 h-5 min-w-5 px-1 text-xs"
              >
                {proxies.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <APIProductOverviewTab product={product} />
        </TabsContent>

        <TabsContent value="proxies" className="mt-6">
          <APIProductProxiesTab
            proxies={proxies}
            productName={product.name}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
