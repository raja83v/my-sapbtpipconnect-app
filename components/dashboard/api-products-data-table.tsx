"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconSearch,
  IconChevronLeft,
  IconChevronRight,
  IconApi,
  IconRefresh,
  IconExternalLink,
  IconSettings,
} from "@tabler/icons-react";
import { getAPIProducts, type APIProductListItem } from "@/app/actions/api-products";
import { APIM_NOT_CONFIGURED } from "@/app/actions/api-products-errors";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";
import { useTenantRefresh } from "@/components/tenant-context";

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

function formatQuota(
  quota?: number,
  quotaInterval?: number,
  quotaTimeUnit?: string
): string {
  if (!quota) return "—";
  const interval = quotaInterval ? `${quotaInterval} ` : "";
  const unit = quotaTimeUnit ? quotaTimeUnit.toLowerCase() : "";
  return `${quota.toLocaleString()} / ${interval}${unit}`.trim();
}

export function APIProductsDataTable() {
  const [products, setProducts] = useState<APIProductListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  // Inline error state — distinct from toasts so we can render an actionable
  // empty state for cases like "APIM not configured" without spamming toasts
  // on every reload.
  const [loadError, setLoadError] = useState<
    | { code: string; message: string }
    | null
  >(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getAPIProducts({
        status: selectedStatus === "all" ? undefined : selectedStatus,
        search: searchQuery || undefined,
        page,
        pageSize,
      });

      if (result.success && result.data) {
        setProducts(result.data.products);
        setTotal(result.data.total);
        setTotalPages(result.data.totalPages);
        setLoadError(null);
      } else {
        const message = result.error || "Failed to load API Products";
        setProducts([]);
        setTotal(0);
        setTotalPages(0);
        setLoadError({ code: result.code ?? "", message });
        // Don't toast for the "not configured" case — the inline empty state
        // already explains it clearly and offers a CTA.
        if (result.code !== APIM_NOT_CONFIGURED) {
          toast.error(message);
        }
      }
    } catch {
      const message = "Something went wrong while loading API Products. Please try again.";
      setProducts([]);
      setLoadError({ code: "", message });
      toast.error(message);
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }, [selectedStatus, searchQuery, page, pageSize]);

  // Handle tenant change from sidebar — reload data automatically
  const handleTenantChange = useCallback(() => {
    setPage(1);
    loadProducts();
  }, [loadProducts]);

  // Subscribe to tenant changes from the sidebar TenantSelector
  useTenantRefresh(handleTenantChange);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return (
    <Card>
      <CardContent className="p-6">
        {/* Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search API Products by name or title…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select
              value={selectedStatus}
              onValueChange={(value) => {
                setSelectedStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="DEPRECATED">Deprecated</SelectItem>
                <SelectItem value="RETIRED">Retired</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={loadProducts}
              disabled={isLoading}
              aria-label="Refresh API Products"
            >
              <IconRefresh
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          {/* Results Count */}
          <div className="text-sm text-muted-foreground">
            {isInitialLoad ? (
              <div className="h-5 w-56 bg-muted animate-pulse rounded" />
            ) : (
              <>
                Showing {products.length} of {total} API Product
                {total !== 1 ? "s" : ""}
              </>
            )}
          </div>
        </div>

        {/* Table */}
        {isInitialLoad ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-16 w-full bg-muted animate-pulse rounded-md"
              />
            ))}
          </div>
        ) : loadError && loadError.code === APIM_NOT_CONFIGURED ? (
          <div className="text-center py-12 max-w-md mx-auto">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <IconSettings className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              API Management not configured
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {loadError.message}
            </p>
            <Button asChild>
              <Link href="/dashboard/settings">Open Settings</Link>
            </Button>
          </div>
        ) : loadError ? (
          <div className="text-center py-12 max-w-md mx-auto">
            <IconApi className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Couldn’t load API Products
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {loadError.message}
            </p>
            <Button variant="outline" onClick={loadProducts}>
              <IconRefresh className="h-4 w-4 mr-2" />
              Try again
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <IconApi className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No API Products found
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || selectedStatus !== "all"
                ? "Try adjusting your filters"
                : "No API Products are available in this tenant"}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-hidden">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[28%]">Title</TableHead>
                    <TableHead className="w-[22%]">Name</TableHead>
                    <TableHead className="w-[10%]">Status</TableHead>
                    <TableHead className="w-[18%]">Quota</TableHead>
                    <TableHead className="w-[17%]">Last Modified</TableHead>
                    <TableHead className="w-[5%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow
                      key={product.name}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/apis/${encodeURIComponent(product.name)}`}
                          className="hover:underline block truncate"
                          title={product.title}
                        >
                          {product.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <code
                          className="text-xs bg-secondary px-2 py-1 rounded block truncate"
                          title={product.name}
                        >
                          {product.name}
                        </code>
                      </TableCell>
                      <TableCell>{getStatusBadge(product.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatQuota(
                          product.quota,
                          product.quotaInterval,
                          product.quotaTimeUnit
                        )}
                      </TableCell>
                      <TableCell>
                        {product.modifiedAt ? (
                          <div className="text-sm">
                            <div>
                              {formatDistanceToNow(
                                new Date(product.modifiedAt),
                                { addSuffix: true }
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(
                                new Date(product.modifiedAt),
                                "MMM dd, yyyy HH:mm"
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          aria-label={`View details for ${product.title}`}
                        >
                          <Link
                            href={`/dashboard/apis/${encodeURIComponent(product.name)}`}
                          >
                            <IconExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1 || isLoading}
                  >
                    <IconChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages || isLoading}
                  >
                    Next
                    <IconChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
