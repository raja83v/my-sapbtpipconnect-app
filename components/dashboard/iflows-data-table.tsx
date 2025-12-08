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
  IconArrowUp,
  IconArrowDown,
  IconRoute,
  IconRefresh,
} from "@tabler/icons-react";
import { getIFlows, type IFlowData } from "@/app/actions/iflows";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";
import { useTenantRefresh } from "@/components/tenant-context";

export function IFlowsDataTable() {
  const [iflows, setIFlows] = useState<IFlowData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  
  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Sorting
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const loadIFlows = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getIFlows({
        status: selectedStatus === "all" ? undefined : selectedStatus,
        search: searchQuery || undefined,
        page,
        pageSize,
        sortBy,
        sortOrder,
      });

      if (result.success && result.data) {
        setIFlows(result.data.iflows);
        setTotal(result.data.total);
        setTotalPages(result.data.totalPages);
      } else {
        toast.error(result.error || "Failed to load iFlows");
      }
    } catch (error) {
      toast.error("An error occurred while loading iFlows");
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }, [selectedStatus, searchQuery, page, pageSize, sortBy, sortOrder]);

  // Handle tenant change from sidebar - reload data automatically
  const handleTenantChange = useCallback(() => {
    setPage(1);
    loadIFlows();
  }, [loadIFlows]);

  // Subscribe to tenant changes from the sidebar TenantSelector
  useTenantRefresh(handleTenantChange);

  useEffect(() => {
    loadIFlows();
  }, [loadIFlows]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "STARTED":
        return (
          <Badge variant="default" className="bg-green-500">
            Started
          </Badge>
        );
      case "STOPPED":
        return <Badge variant="secondary">Stopped</Badge>;
      case "ERROR":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return null;
    return sortOrder === "asc" ? (
      <IconArrowUp className="h-3 w-3 inline ml-1" />
    ) : (
      <IconArrowDown className="h-3 w-3 inline ml-1" />
    );
  };

  return (
    <Card>
      <CardContent className="p-6">
        {/* Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search iFlows by name, ID, or package..."
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
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="STARTED">Started</SelectItem>
                <SelectItem value="STOPPED">Stopped</SelectItem>
                <SelectItem value="ERROR">Error</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={loadIFlows}
              disabled={isLoading}
            >
              <IconRefresh className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Results Count */}
          <div className="text-sm text-muted-foreground">
            {isInitialLoad ? (
              <div className="h-5 w-48 bg-muted animate-pulse rounded" />
            ) : (
              <>Showing {iflows.length} of {total} iFlows</>
            )}
          </div>
        </div>

        {/* Table */}
        {isInitialLoad ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : iflows.length === 0 ? (
          <div className="text-center py-12">
            <IconRoute className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No iFlows found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || selectedStatus !== "all"
                ? "Try adjusting your filters"
                : "Sync your tenant to fetch iFlows from SAP CPI"}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-hidden">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 w-[30%]"
                      onClick={() => handleSort("name")}
                    >
                      Name <SortIcon column="name" />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 w-[22%]"
                      onClick={() => handleSort("iFlowId")}
                    >
                      iFlow ID <SortIcon column="iFlowId" />
                    </TableHead>
                    <TableHead className="w-[15%]">Package</TableHead>
                    <TableHead className="w-[8%]">Version</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 w-[10%]"
                      onClick={() => handleSort("status")}
                    >
                      Status <SortIcon column="status" />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 w-[15%]"
                      onClick={() => handleSort("lastDeployedAt")}
                    >
                      Last Deployed <SortIcon column="lastDeployedAt" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {iflows.map((iflow) => (
                    <TableRow key={iflow.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link 
                          href={`/dashboard/iflows/${iflow.id}`} 
                          className="hover:underline block truncate"
                          title={iflow.name}
                        >
                          {iflow.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <code 
                          className="text-xs bg-secondary px-2 py-1 rounded block truncate"
                          title={iflow.iFlowId}
                        >
                          {iflow.iFlowId}
                        </code>
                      </TableCell>
                      <TableCell className="truncate" title={iflow.packageName || "-"}>
                        {iflow.packageName || "-"}
                      </TableCell>
                      <TableCell>{iflow.version || "-"}</TableCell>
                      <TableCell>{getStatusBadge(iflow.status)}</TableCell>
                      <TableCell>
                        {iflow.lastDeployedAt ? (
                          <div className="text-sm">
                            <div>
                              {formatDistanceToNow(new Date(iflow.lastDeployedAt), {
                                addSuffix: true,
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(iflow.lastDeployedAt), "MMM dd, yyyy HH:mm")}
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
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
