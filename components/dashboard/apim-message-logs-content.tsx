"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    IconChevronLeft,
    IconChevronRight,
    IconRefresh,
    IconApi,
    IconDownload,
    IconFilterOff,
    IconCalendar,
    IconSearch,
    IconClock,
    IconPlayerPlay,
    IconPlayerPause,
    IconDotsVertical,
    IconEye,
    IconLoader2,
    IconCheck,
    IconSelector,
    IconAlertTriangle,
    IconCircleCheck,
    IconArrowRight,
} from "@tabler/icons-react";
import {
    getApimMessageLogs,
    getApiProxiesForFilter,
    type GlobalAPIMLog,
    type APIProxyInfo,
} from "@/app/actions/apim-message-logs";
import { format, subHours, subDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { APIMLogDetailSheet } from "./apim-log-detail-sheet";
import { useTenantRefresh } from "@/components/tenant-context";

// ============================================================================
// Constants
// ============================================================================

const DATE_PRESETS = [
    { label: "Last 1 hour", value: "1h", getRange: () => ({ from: subHours(new Date(), 1), to: new Date() }) },
    { label: "Last 6 hours", value: "6h", getRange: () => ({ from: subHours(new Date(), 6), to: new Date() }) },
    { label: "Last 24 hours", value: "24h", getRange: () => ({ from: subHours(new Date(), 24), to: new Date() }) },
    { label: "Last 7 days", value: "7d", getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: "Last 30 days", value: "30d", getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: "Custom Range", value: "custom", getRange: () => null },
];

const STATUS_OPTIONS = [
    { label: "All Status", value: "all" },
    { label: "2xx Success", value: "2xx" },
    { label: "3xx Redirect", value: "3xx" },
    { label: "4xx Client Error", value: "4xx" },
    { label: "5xx Server Error", value: "5xx" },
    { label: "Errors Only", value: "error" },
];

const METHOD_OPTIONS = [
    { label: "All Methods", value: "all" },
    { label: "GET", value: "GET" },
    { label: "POST", value: "POST" },
    { label: "PUT", value: "PUT" },
    { label: "PATCH", value: "PATCH" },
    { label: "DELETE", value: "DELETE" },
];

const AUTO_REFRESH_OPTIONS = [
    { label: "Off", value: 0 },
    { label: "30 seconds", value: 30 },
    { label: "1 minute", value: 60 },
    { label: "5 minutes", value: 300 },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusBadge(statusCode: number, isError: boolean) {
    if (statusCode >= 200 && statusCode < 300) {
        return (
            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20 font-mono text-xs">
                {statusCode}
            </Badge>
        );
    }
    if (statusCode >= 300 && statusCode < 400) {
        return (
            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20 font-mono text-xs">
                {statusCode}
            </Badge>
        );
    }
    if (statusCode >= 400 && statusCode < 500) {
        return (
            <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20 font-mono text-xs">
                {statusCode}
            </Badge>
        );
    }
    if (statusCode >= 500) {
        return (
            <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20 font-mono text-xs">
                {statusCode}
            </Badge>
        );
    }
    if (isError) {
        return (
            <Badge variant="destructive" className="font-mono text-xs">
                Error
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="font-mono text-xs">
            {statusCode || "—"}
        </Badge>
    );
}

function getMethodBadge(method: string) {
    const colors: Record<string, string> = {
        GET: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
        POST: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
        PUT: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
        PATCH: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20",
        DELETE: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
    };
    const colorClass = colors[method?.toUpperCase()] || "bg-muted text-muted-foreground";
    return (
        <Badge className={cn("font-mono text-xs", colorClass)}>
            {method || "—"}
        </Badge>
    );
}

function formatResponseTime(ms: number): string {
    if (!ms) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes?: number): string {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ============================================================================
// Main Component
// ============================================================================

export function APIMMessageLogsContent() {
    // State
    const [logs, setLogs] = useState<GlobalAPIMLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [totalPages, setTotalPages] = useState(0);
    const [fetchedAt, setFetchedAt] = useState<string | null>(null);

    // Filters
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [selectedMethod, setSelectedMethod] = useState("all");
    const [selectedProxyName, setSelectedProxyName] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: subHours(new Date(), 24),
        to: new Date(),
    });
    const [datePreset, setDatePreset] = useState("24h");

    // Auto-refresh
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
    const [newLogCount, setNewLogCount] = useState(0);
    const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastFetchedLogsRef = useRef<string[]>([]);

    // Detail sheet
    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
    const [selectedProxyForDetail, setSelectedProxyForDetail] = useState<string | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Analytics availability
    const [analyticsAvailable, setAnalyticsAvailable] = useState<boolean | null>(null);
    const [analyticsWarning, setAnalyticsWarning] = useState<string | undefined>(undefined);

    // Filter data
    const [proxies, setProxies] = useState<APIProxyInfo[]>([]);
    const [isLoadingFilters, setIsLoadingFilters] = useState(false);

    // Combobox states
    const [proxyComboOpen, setProxyComboOpen] = useState(false);
    const [proxySearch, setProxySearch] = useState("");

    // Custom date range popover
    const [dateRangeOpen, setDateRangeOpen] = useState(false);

    // Load filter data
    const loadFilterData = useCallback(async () => {
        setIsLoadingFilters(true);
        try {
            const proxiesResult = await getApiProxiesForFilter();
            if (proxiesResult.success && proxiesResult.data) {
                setProxies(proxiesResult.data);
            }
        } catch (error) {
            console.error("Error loading APIM filter data:", error);
        } finally {
            setIsLoadingFilters(false);
        }
    }, []);

    // Load logs
    const loadLogs = useCallback(
        async (showToast = false) => {
            setIsLoading(true);
            try {
                const result = await getApimMessageLogs({
                    page,
                    pageSize,
                    proxyName: selectedProxyName !== "all" ? selectedProxyName : undefined,
                    statusCategory: selectedStatus !== "all" ? selectedStatus : undefined,
                    method: selectedMethod !== "all" ? selectedMethod : undefined,
                    fromDate: dateRange.from?.toISOString(),
                    toDate: dateRange.to?.toISOString(),
                    searchQuery: debouncedSearch || undefined,
                });

                if (result.success && result.data) {
                    const newLogIds = result.data.logs.map((l) => l.id);

                    // Detect new logs for auto-refresh notification
                    if (lastFetchedLogsRef.current.length > 0 && !isInitialLoad) {
                        const newCount = newLogIds.filter(
                            (id) => !lastFetchedLogsRef.current.includes(id)
                        ).length;
                        if (newCount > 0) {
                            setNewLogCount(newCount);
                        }
                    }

                    lastFetchedLogsRef.current = newLogIds;
                    setLogs(result.data.logs);
                    setTotal(result.data.total);
                    setTotalPages(result.data.totalPages);
                    setFetchedAt(result.data.fetchedAt);
                    setAnalyticsAvailable(result.data.analyticsAvailable);
                    setAnalyticsWarning(result.data.analyticsWarning);

                    if (showToast) {
                        toast.success("APIM logs refreshed");
                    }
                } else {
                    if (!isInitialLoad) {
                        toast.error(result.error || "Failed to load APIM logs");
                    }
                }
            } catch (error) {
                console.error("Error loading APIM logs:", error);
                if (!isInitialLoad) {
                    toast.error("An error occurred while loading APIM logs");
                }
            } finally {
                setIsLoading(false);
                setIsInitialLoad(false);
            }
        },
        [page, pageSize, selectedProxyName, selectedStatus, selectedMethod, dateRange, debouncedSearch, isInitialLoad]
    );

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Initial load
    useEffect(() => {
        loadFilterData();
    }, [loadFilterData]);

    // Load logs when filters change
    useEffect(() => {
        loadLogs();
    }, [page, selectedProxyName, selectedStatus, selectedMethod, dateRange, debouncedSearch]);

    // Auto-refresh
    useEffect(() => {
        if (autoRefreshTimerRef.current) {
            clearInterval(autoRefreshTimerRef.current);
            autoRefreshTimerRef.current = null;
        }

        if (autoRefreshInterval > 0) {
            autoRefreshTimerRef.current = setInterval(() => {
                loadLogs();
            }, autoRefreshInterval * 1000);
        }

        return () => {
            if (autoRefreshTimerRef.current) {
                clearInterval(autoRefreshTimerRef.current);
            }
        };
    }, [autoRefreshInterval, loadLogs]);

    // Tenant refresh
    useTenantRefresh(() => {
        setPage(1);
        setSelectedProxyName("all");
        loadFilterData();
        loadLogs();
    });

    const handleDatePresetChange = (preset: string) => {
        setDatePreset(preset);
        if (preset !== "custom") {
            const presetConfig = DATE_PRESETS.find((p) => p.value === preset);
            const range = presetConfig?.getRange();
            if (range) {
                setDateRange({ from: range.from, to: range.to });
                setPage(1);
            }
        }
    };

    const handleClearFilters = () => {
        setSelectedStatus("all");
        setSelectedMethod("all");
        setSelectedProxyName("all");
        setSearchQuery("");
        setDebouncedSearch("");
        setDatePreset("24h");
        setDateRange({ from: subHours(new Date(), 24), to: new Date() });
        setPage(1);
    };

    const hasActiveFilters =
        selectedStatus !== "all" ||
        selectedMethod !== "all" ||
        selectedProxyName !== "all" ||
        searchQuery !== "" ||
        datePreset !== "24h";

    const handleRowClick = (log: GlobalAPIMLog) => {
        setSelectedLogId(log.id);
        setSelectedProxyForDetail(log.apiProxyName);
        setIsDetailOpen(true);
        setNewLogCount(0);
    };

    const filteredProxies = proxies.filter((p) =>
        proxySearch === "" ||
        p.name.toLowerCase().includes(proxySearch.toLowerCase()) ||
        p.title.toLowerCase().includes(proxySearch.toLowerCase())
    );

    return (
        <div className="space-y-4">
            {/* Filter Bar */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search proxy, client IP, error…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 h-9"
                            />
                        </div>

                        {/* API Proxy Filter */}
                        <Popover open={proxyComboOpen} onOpenChange={setProxyComboOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={proxyComboOpen}
                                    aria-label="Select API proxy"
                                    className="h-9 min-w-[160px] justify-between"
                                    disabled={isLoadingFilters}
                                >
                                    <span className="truncate">
                                        {selectedProxyName === "all"
                                            ? "All Proxies"
                                            : proxies.find((p) => p.name === selectedProxyName)?.title ||
                                              selectedProxyName}
                                    </span>
                                    <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[280px] p-0" align="start">
                                <Command>
                                    <CommandInput
                                        placeholder="Search proxies…"
                                        value={proxySearch}
                                        onValueChange={setProxySearch}
                                    />
                                    <CommandList>
                                        <CommandEmpty>No proxies found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                value="all"
                                                onSelect={() => {
                                                    setSelectedProxyName("all");
                                                    setProxyComboOpen(false);
                                                    setPage(1);
                                                }}
                                            >
                                                <IconCheck
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        selectedProxyName === "all" ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                All Proxies
                                            </CommandItem>
                                            {filteredProxies.map((proxy) => (
                                                <CommandItem
                                                    key={proxy.name}
                                                    value={proxy.name}
                                                    onSelect={() => {
                                                        setSelectedProxyName(proxy.name);
                                                        setProxyComboOpen(false);
                                                        setPage(1);
                                                    }}
                                                >
                                                    <IconCheck
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedProxyName === proxy.name
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                        )}
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className="text-sm">{proxy.title}</span>
                                                        <span className="text-xs text-muted-foreground font-mono">
                                                            {proxy.basePath}
                                                        </span>
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>

                        {/* Status Filter */}
                        <Select
                            value={selectedStatus}
                            onValueChange={(v) => {
                                setSelectedStatus(v);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by status">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Method Filter */}
                        <Select
                            value={selectedMethod}
                            onValueChange={(v) => {
                                setSelectedMethod(v);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="h-9 w-[130px]" aria-label="Filter by HTTP method">
                                <SelectValue placeholder="Method" />
                            </SelectTrigger>
                            <SelectContent>
                                {METHOD_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Date Range */}
                        <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="h-9 gap-1.5"
                                    aria-label="Select date range"
                                >
                                    <IconCalendar className="h-4 w-4" />
                                    <span className="text-sm">
                                        {DATE_PRESETS.find((p) => p.value === datePreset)?.label ||
                                            "Custom Range"}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-4" align="start">
                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">Date Range</Label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {DATE_PRESETS.filter((p) => p.value !== "custom").map((preset) => (
                                            <Button
                                                key={preset.value}
                                                variant={datePreset === preset.value ? "default" : "outline"}
                                                size="sm"
                                                className="h-8 text-xs"
                                                onClick={() => {
                                                    handleDatePresetChange(preset.value);
                                                    if (preset.value !== "custom") setDateRangeOpen(false);
                                                }}
                                            >
                                                {preset.label}
                                            </Button>
                                        ))}
                                    </div>
                                    <Separator />
                                    <Label className="text-xs text-muted-foreground">Custom Range</Label>
                                    <Calendar
                                        mode="range"
                                        selected={{ from: dateRange.from, to: dateRange.to }}
                                        onSelect={(range) => {
                                            if (range) {
                                                setDateRange({ from: range.from, to: range.to });
                                                setDatePreset("custom");
                                                setPage(1);
                                            }
                                        }}
                                        numberOfMonths={1}
                                        disabled={{ after: new Date() }}
                                    />
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Clear Filters */}
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 gap-1.5 text-muted-foreground"
                                onClick={handleClearFilters}
                                aria-label="Clear all filters"
                            >
                                <IconFilterOff className="h-4 w-4" />
                                Clear
                            </Button>
                        )}

                        <div className="ml-auto flex items-center gap-2">
                            {/* Auto-refresh */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 gap-1.5"
                                        aria-label="Auto-refresh settings"
                                    >
                                        {autoRefreshInterval > 0 ? (
                                            <IconPlayerPause className="h-4 w-4" />
                                        ) : (
                                            <IconPlayerPlay className="h-4 w-4" />
                                        )}
                                        <span className="text-xs">
                                            {autoRefreshInterval > 0
                                                ? `${autoRefreshInterval}s`
                                                : "Auto"}
                                        </span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Auto-refresh</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {AUTO_REFRESH_OPTIONS.map((opt) => (
                                        <DropdownMenuItem
                                            key={opt.value}
                                            onClick={() => setAutoRefreshInterval(opt.value)}
                                        >
                                            <IconCheck
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    autoRefreshInterval === opt.value
                                                        ? "opacity-100"
                                                        : "opacity-0"
                                                )}
                                            />
                                            {opt.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Refresh Button */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9"
                                onClick={() => loadLogs(true)}
                                disabled={isLoading}
                                aria-label="Refresh logs"
                            >
                                <IconRefresh
                                    className={cn("h-4 w-4", isLoading && "animate-spin")}
                                />
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-0">
                    {/* Stats row */}
                    <div className="flex items-center justify-between mb-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-3">
                            {isInitialLoad ? (
                                <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                            ) : (
                                <>
                                    <span>
                                        {total.toLocaleString()} API call{total !== 1 ? "s" : ""}
                                    </span>
                                    {newLogCount > 0 && (
                                        <Badge
                                            variant="secondary"
                                            className="cursor-pointer"
                                            onClick={() => {
                                                setNewLogCount(0);
                                                loadLogs();
                                            }}
                                        >
                                            +{newLogCount} new
                                        </Badge>
                                    )}
                                </>
                            )}
                        </div>
                        {fetchedAt && (
                            <div className="flex items-center gap-1 text-xs">
                                <IconClock className="h-3 w-3" />
                                <span>
                                    Updated {format(new Date(fetchedAt), "HH:mm:ss")}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Table */}
                    {isInitialLoad ? (
                        <div className="space-y-2">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-md" />
                            ))}
                        </div>
                    ) : analyticsAvailable === false ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                            <IconApi className="h-12 w-12 text-muted-foreground/40 mb-4" />
                            <p className="text-sm font-medium text-muted-foreground">
                                API call logs unavailable
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-2 max-w-md">
                                {analyticsWarning ||
                                    "The SAP APIM Analytics service is not accessible on this tenant. " +
                                    "Per-call logs require the API Analytics capability to be enabled in SAP Integration Suite."}
                            </p>
                            <p className="text-xs text-muted-foreground/50 mt-3 max-w-md">
                                To enable API Analytics, go to your SAP BTP subaccount, subscribe to the
                                API Management service, and ensure the <strong>API Analytics</strong> capability
                                is activated.
                            </p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <IconApi className="h-12 w-12 text-muted-foreground/40 mb-4" />
                            <p className="text-sm font-medium text-muted-foreground">
                                No API calls found
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                                {hasActiveFilters
                                    ? "Try adjusting your filters"
                                    : "No API calls in the selected time range"}
                            </p>
                            {hasActiveFilters && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-3"
                                    onClick={handleClearFilters}
                                >
                                    Clear filters
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-[160px]">Timestamp</TableHead>
                                        <TableHead>API Proxy</TableHead>
                                        <TableHead className="w-[80px]">Method</TableHead>
                                        <TableHead className="w-[90px]">Status</TableHead>
                                        <TableHead className="w-[100px]">Response Time</TableHead>
                                        <TableHead className="w-[100px]">Size</TableHead>
                                        <TableHead>Client / App</TableHead>
                                        <TableHead className="w-[40px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow
                                            key={log.id}
                                            className={cn(
                                                "cursor-pointer hover:bg-muted/50 transition-colors",
                                                log.isError && "bg-red-500/5 hover:bg-red-500/10"
                                            )}
                                            onClick={() => handleRowClick(log)}
                                        >
                                            {/* Timestamp */}
                                            <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                                                {format(new Date(log.timestamp), "MMM d, HH:mm:ss")}
                                            </TableCell>

                                            {/* API Proxy */}
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm font-medium truncate max-w-[200px]">
                                                        {log.apiProxyName}
                                                    </span>
                                                    {log.apiProduct && (
                                                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                            {log.apiProduct}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Method */}
                                            <TableCell>
                                                {getMethodBadge(log.method)}
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    {log.isError ? (
                                                        <IconAlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                                    ) : (
                                                        <IconCircleCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                                    )}
                                                    {getStatusBadge(log.statusCode, log.isError)}
                                                </div>
                                            </TableCell>

                                            {/* Response Time */}
                                            <TableCell className="text-sm font-mono">
                                                <span
                                                    className={cn(
                                                        log.responseTime > 5000
                                                            ? "text-red-600 dark:text-red-400"
                                                            : log.responseTime > 2000
                                                            ? "text-orange-600 dark:text-orange-400"
                                                            : "text-muted-foreground"
                                                    )}
                                                >
                                                    {formatResponseTime(log.responseTime)}
                                                </span>
                                            </TableCell>

                                            {/* Size */}
                                            <TableCell className="text-xs text-muted-foreground font-mono">
                                                {log.responseSize
                                                    ? formatBytes(log.responseSize)
                                                    : "—"}
                                            </TableCell>

                                            {/* Client / App */}
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5">
                                                    {log.developerApp ? (
                                                        <span className="text-sm truncate max-w-[160px]">
                                                            {log.developerApp}
                                                        </span>
                                                    ) : log.clientIP ? (
                                                        <span className="text-sm font-mono text-muted-foreground">
                                                            {log.clientIP}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">—</span>
                                                    )}
                                                    {log.faultCode && (
                                                        <span className="text-xs text-red-500 font-mono truncate max-w-[160px]">
                                                            {log.faultCode}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            aria-label="More actions"
                                                        >
                                                            <IconDotsVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onClick={() => handleRowClick(log)}
                                                        >
                                                            <IconEye className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(log.id);
                                                                toast.success("Log ID copied");
                                                            }}
                                                        >
                                                            <IconDownload className="mr-2 h-4 w-4" />
                                                            Copy Log ID
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination */}
                    {!isInitialLoad && totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                            <p className="text-sm text-muted-foreground">
                                Page {page} of {totalPages} &middot;{" "}
                                {total.toLocaleString()} total
                            </p>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page <= 1 || isLoading}
                                    aria-label="Previous page"
                                >
                                    <IconChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages || isLoading}
                                    aria-label="Next page"
                                >
                                    <IconChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Detail Sheet */}
            <APIMLogDetailSheet
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                logId={selectedLogId}
                proxyName={selectedProxyForDetail}
                tenantId={undefined}
            />
        </div>
    );
}
