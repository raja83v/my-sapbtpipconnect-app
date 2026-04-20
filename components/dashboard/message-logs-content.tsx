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
    IconMessages,
    IconDownload,
    IconFilterOff,
    IconCalendar,
    IconSearch,
    IconExternalLink,
    IconClock,
    IconPlayerPlay,
    IconPlayerPause,
    IconDotsVertical,
    IconEye,
    IconFileExport,
    IconLoader2,
    IconCheck,
    IconSelector,
} from "@tabler/icons-react";
import {
    getAllMessageLogs,
    getIFlowsForFilter,
    type GlobalMessageLog,
} from "@/app/actions/message-logs";
import { format, formatDistanceToNow, subHours, subDays, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MessageLogDetailSheet } from "./message-log-detail-sheet";
import { useTenantRefresh } from "@/components/tenant-context";

// Date range presets
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
    { label: "Completed", value: "COMPLETED" },
    { label: "Failed", value: "FAILED" },
    { label: "Processing", value: "PROCESSING" },
    { label: "Retry", value: "RETRY" },
];

const AUTO_REFRESH_OPTIONS = [
    { label: "Off", value: 0 },
    { label: "30 seconds", value: 30 },
    { label: "1 minute", value: 60 },
    { label: "5 minutes", value: 300 },
];

// Helper to parse SAP OData date format: /Date(1733580000000)/
function parseSAPDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    if (typeof dateValue === 'string') {
        // Handle OData format: /Date(timestamp)/
        const odataMatch = dateValue.match(/\/Date\((\d+)\)\//);
        if (odataMatch) return new Date(parseInt(odataMatch[1], 10));
        // Try parsing as ISO string
        const parsed = new Date(dateValue);
        if (!isNaN(parsed.getTime())) return parsed;
    }
    if (typeof dateValue === 'number') return new Date(dateValue);
    return null;
}

// Format SAP date for display
function formatSAPDate(dateValue: any, formatStr: string): string {
    const date = parseSAPDate(dateValue);
    if (!date) return "—";
    try {
        return format(date, formatStr);
    } catch {
        return "—";
    }
}

// Format SAP date as relative time
function formatSAPDateRelative(dateValue: any): string {
    const date = parseSAPDate(dateValue);
    if (!date) return "";
    try {
        return formatDistanceToNow(date, { addSuffix: true });
    } catch {
        return "";
    }
}

export function MessageLogsContent() {
    // State
    const [logs, setLogs] = useState<GlobalMessageLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [totalPages, setTotalPages] = useState(0);
    const [fetchedAt, setFetchedAt] = useState<string | null>(null);

    // Filters
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [selectedIFlowId, setSelectedIFlowId] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: subHours(new Date(), 24),
        to: new Date(),
    });
    const [datePreset, setDatePreset] = useState("24h");

    // Auto-refresh
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
    const [newMessageCount, setNewMessageCount] = useState(0);
    const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastFetchedLogsRef = useRef<string[]>([]);

    // Detail sheet
    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Filter data
    const [iflows, setIflows] = useState<Array<{ id: string; iFlowId: string; name: string; packageName: string | null }>>([]);
    const [isLoadingFilters, setIsLoadingFilters] = useState(false);
    
    // Combobox states
    const [iflowComboOpen, setIflowComboOpen] = useState(false);
    const [iflowSearch, setIflowSearch] = useState("");
    
    // Custom date range popover
    const [dateRangeOpen, setDateRangeOpen] = useState(false);

    // Define loadFilterData as callback so it can be used in handleTenantChange
    const loadFilterData = useCallback(async () => {
        setIsLoadingFilters(true);
        try {
            // Fetch all iFlows - uses user's default tenant
            const iflowsResult = await getIFlowsForFilter();
            if (iflowsResult.success && iflowsResult.data) {
                setIflows(iflowsResult.data);
            }
        } catch (error) {
            console.error("Error loading filter data:", error);
        } finally {
            setIsLoadingFilters(false);
        }
    }, []);

    // Define loadLogs callback BEFORE useEffects that use it
    const loadLogs = useCallback(async (showToast = false) => {
        setIsLoading(true);

        try {
            const result = await getAllMessageLogs({
                page,
                pageSize,
                status: selectedStatus === "all" ? undefined : selectedStatus,
                iFlowId: selectedIFlowId === "all" ? undefined : selectedIFlowId,
                fromDate: dateRange.from?.toISOString(),
                toDate: dateRange.to?.toISOString(),
                searchQuery: debouncedSearch || undefined,
            });

            if (result.success && result.data) {
                setLogs(result.data.logs);
                setTotal(result.data.total);
                setTotalPages(result.data.totalPages);
                setFetchedAt(result.data.fetchedAt);
                
                // Store log IDs for new message detection
                lastFetchedLogsRef.current = result.data.logs.map(l => l.messageGuid);
                setNewMessageCount(0);

                if (showToast) {
                    toast.success("Message logs refreshed");
                }
            } else {
                toast.error(result.error || "Failed to load message logs");
            }
        } catch (error) {
            console.error("Error loading logs:", error);
            toast.error("An error occurred while loading message logs");
        } finally {
            setIsLoading(false);
            setIsInitialLoad(false);
        }
    }, [page, pageSize, selectedStatus, selectedIFlowId, dateRange, debouncedSearch]);

    // Define checkForNewMessages callback BEFORE useEffects that use it
    const checkForNewMessages = useCallback(async () => {
        try {
            const result = await getAllMessageLogs({
                page: 1,
                pageSize: 20,
                status: selectedStatus === "all" ? undefined : selectedStatus,
                iFlowId: selectedIFlowId === "all" ? undefined : selectedIFlowId,
                fromDate: dateRange.from?.toISOString(),
                toDate: new Date().toISOString(),
            });

            if (result.success && result.data) {
                const newLogs = result.data.logs.filter(
                    log => !lastFetchedLogsRef.current.includes(log.messageGuid)
                );

                if (newLogs.length > 0) {
                    setNewMessageCount(prev => prev + newLogs.length);
                }
            }
        } catch (error) {
            console.warn("Error checking for new messages:", error);
        }
    }, [selectedStatus, selectedIFlowId, dateRange]);

    // Handle tenant change from sidebar - reload data automatically
    const handleTenantChange = useCallback(async () => {
        // Reset filters and page
        setSelectedStatus("all");
        setSelectedIFlowId("all");
        setPage(1);
        setIsLoading(true);
        setIsLoadingFilters(true);
        
        try {
            // Reload filter data (iFlows for the new tenant)
            const iflowsResult = await getIFlowsForFilter();
            if (iflowsResult.success && iflowsResult.data) {
                setIflows(iflowsResult.data);
            }
            
            // Reload logs for the new tenant with reset filters
            const result = await getAllMessageLogs({
                page: 1,
                pageSize,
                status: undefined, // Reset to all
                iFlowId: undefined, // Reset to all
                fromDate: dateRange.from?.toISOString(),
                toDate: dateRange.to?.toISOString(),
                searchQuery: debouncedSearch || undefined,
            });

            if (result.success && result.data) {
                setLogs(result.data.logs);
                setTotal(result.data.total);
                setTotalPages(result.data.totalPages);
                setFetchedAt(result.data.fetchedAt);
                lastFetchedLogsRef.current = result.data.logs.map(l => l.messageGuid);
                setNewMessageCount(0);
            }
        } catch (error) {
            console.error("Error reloading data after tenant change:", error);
        } finally {
            setIsLoading(false);
            setIsLoadingFilters(false);
        }
    }, [pageSize, dateRange, debouncedSearch]);

    // Subscribe to tenant changes from the sidebar TenantSelector
    useTenantRefresh(handleTenantChange);

    // Load logs on mount and when filters change
    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Load filter data on mount
    useEffect(() => {
        loadFilterData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-refresh logic
    useEffect(() => {
        if (autoRefreshTimerRef.current) {
            clearInterval(autoRefreshTimerRef.current);
            autoRefreshTimerRef.current = null;
        }

        if (autoRefreshInterval > 0) {
            autoRefreshTimerRef.current = setInterval(() => {
                checkForNewMessages();
            }, autoRefreshInterval * 1000);
        }

        return () => {
            if (autoRefreshTimerRef.current) {
                clearInterval(autoRefreshTimerRef.current);
            }
        };
    }, [autoRefreshInterval, checkForNewMessages]);

    const handleRefresh = () => {
        loadLogs(true);
    };

    const handleClearFilters = () => {
        setSelectedStatus("all");
        setSelectedIFlowId("all");
        setSearchQuery("");
        setDateRange({ from: subHours(new Date(), 24), to: new Date() });
        setDatePreset("24h");
        setPage(1);
    };

    const handleDatePresetChange = (preset: string) => {
        setDatePreset(preset);
        if (preset === "custom") {
            // Open the date range picker popover
            setDateRangeOpen(true);
        } else {
            const presetConfig = DATE_PRESETS.find(p => p.value === preset);
            if (presetConfig) {
                const range = presetConfig.getRange();
                if (range) {
                    setDateRange(range);
                    setPage(1);
                }
            }
        }
    };

    const handleCustomDateRangeApply = () => {
        setDateRangeOpen(false);
        setPage(1);
    };

    // Format the date range display for custom range
    const getDateRangeLabel = () => {
        if (datePreset === "custom" && dateRange.from) {
            if (dateRange.to) {
                return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`;
            }
            return format(dateRange.from, "MMM d, yyyy");
        }
        return DATE_PRESETS.find(p => p.value === datePreset)?.label || "Date Range";
    };

    const handleRowClick = (log: GlobalMessageLog) => {
        setSelectedLogId(log.messageGuid);
        setIsDetailOpen(true);
    };

    const handleExportCSV = () => {
        if (logs.length === 0) {
            toast.error("No data to export");
            return;
        }

        const headers = [
            "Message GUID",
            "Status",
            "iFlow Name",
            "Sender",
            "Receiver",
            "Start Time",
            "End Time",
            "Duration (ms)",
            "Correlation ID",
            "Custom Status",
        ];

        const rows = logs.map(log => [
            log.messageGuid,
            log.status,
            log.integrationFlowName,
            log.sender || "",
            log.receiver || "",
            log.logStart,
            log.logEnd || "",
            log.duration?.toString() || "",
            log.correlationId || "",
            log.customStatus || "",
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `message-logs-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;
        link.click();

        toast.success(`Exported ${logs.length} records to CSV`);
    };

    const handleExportJSON = () => {
        if (logs.length === 0) {
            toast.error("No data to export");
            return;
        }

        const jsonContent = JSON.stringify(logs, null, 2);
        const blob = new Blob([jsonContent], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `message-logs-${format(new Date(), "yyyy-MM-dd-HHmmss")}.json`;
        link.click();

        toast.success(`Exported ${logs.length} records to JSON`);
    };

    const getStatusBadge = (status: string) => {
        switch (status.toUpperCase()) {
            case "COMPLETED":
                return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
            case "FAILED":
                return <Badge variant="destructive">Failed</Badge>;
            case "PROCESSING":
                return <Badge className="bg-blue-500 hover:bg-blue-600">Processing</Badge>;
            case "RETRY":
                return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">Retry</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const formatDuration = (duration: number | null) => {
        if (duration === null) return "—";
        if (duration < 1000) return `${duration}ms`;
        if (duration < 60000) return `${(duration / 1000).toFixed(2)}s`;
        return `${(duration / 60000).toFixed(2)}m`;
    };

    // iFlows list for filtering - filter based on search input
    const filteredIflows = iflowSearch
        ? iflows.filter(iflow => 
            iflow.name.toLowerCase().includes(iflowSearch.toLowerCase())
          )
        : iflows;

    const hasActiveFilters = 
        selectedStatus !== "all" || 
        selectedIFlowId !== "all" || 
        searchQuery.length > 0 ||
        datePreset !== "24h";

    // Show loading state during initial load
    if (isInitialLoad) {
        return (
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <div className="flex items-center justify-center h-64">
                    <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Message Logs</h1>
                        <p className="text-muted-foreground">
                            Monitor message processing across all integration flows
                        </p>
                    </div>
                    {newMessageCount > 0 && (
                        <Button 
                            variant="outline" 
                            onClick={handleRefresh}
                            className="animate-pulse"
                        >
                            <IconRefresh className="h-4 w-4 mr-2" />
                            {newMessageCount} new message{newMessageCount > 1 ? 's' : ''}
                        </Button>
                    )}
                </div>
            </div>

            {/* Filters Card */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* iFlow Filter - Searchable Combobox */}
                        <Popover 
                            open={iflowComboOpen} 
                            onOpenChange={(open) => {
                                setIflowComboOpen(open);
                                if (!open) setIflowSearch(""); // Reset search when closing
                            }}
                        >
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={iflowComboOpen}
                                    className="w-[220px] justify-between overflow-hidden"
                                    disabled={isLoadingFilters}
                                >
                                    <span className="truncate">
                                        {isLoadingFilters ? (
                                            "Loading..."
                                        ) : selectedIFlowId === "all" ? (
                                            "All iFlows"
                                        ) : (
                                            filteredIflows.find((i) => i.iFlowId === selectedIFlowId)?.name || "Select iFlow..."
                                        )}
                                    </span>
                                    <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                                <Command shouldFilter={false}>
                                    <CommandInput 
                                        placeholder="Search iFlows..." 
                                        value={iflowSearch}
                                        onValueChange={setIflowSearch}
                                    />
                                    <CommandList className="max-h-[300px]">
                                        <CommandEmpty>No iFlow found.</CommandEmpty>
                                        <CommandGroup>
                                            {!iflowSearch && (
                                                <CommandItem
                                                    value="__all_iflows__"
                                                    onSelect={() => {
                                                        setSelectedIFlowId("all");
                                                        setPage(1);
                                                        setIflowComboOpen(false);
                                                        setIflowSearch("");
                                                    }}
                                                >
                                                    <IconCheck
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedIFlowId === "all" ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    All iFlows
                                                </CommandItem>
                                            )}
                                            {filteredIflows.map((iflow) => (
                                                <CommandItem
                                                    key={iflow.id}
                                                    value={iflow.name}
                                                    onSelect={() => {
                                                        const newIFlowId = iflow.iFlowId;
                                                        setSelectedIFlowId(newIFlowId);
                                                        setPage(1);
                                                        setIflowComboOpen(false);
                                                        setIflowSearch("");
                                                    }}
                                                >
                                                    <IconCheck
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedIFlowId === iflow.iFlowId ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <span className="truncate">{iflow.name}</span>
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
                            onValueChange={(value) => {
                                setSelectedStatus(value);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Date Range - Dropdown with Custom Option */}
                        <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
                            <div className="flex items-center gap-1">
                                <Select value={datePreset} onValueChange={handleDatePresetChange}>
                                    <SelectTrigger className={cn(
                                        "w-[150px]",
                                        datePreset === "custom" && "w-[180px]"
                                    )}>
                                        <IconCalendar className="h-4 w-4 mr-2 shrink-0" />
                                        <span className="truncate">{getDateRangeLabel()}</span>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DATE_PRESETS.map((preset) => (
                                            <SelectItem key={preset.value} value={preset.value}>
                                                {preset.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {datePreset === "custom" && (
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="icon" className="shrink-0">
                                            <IconCalendar className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                )}
                            </div>
                            <PopoverContent className="w-auto p-0" align="start">
                                <div className="p-4 space-y-4">
                                    <div className="space-y-2">
                                        <Label>Select Date Range</Label>
                                        <div className="flex gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">From</Label>
                                                <Calendar
                                                    mode="single"
                                                    selected={dateRange.from}
                                                    onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                                                    disabled={(date) => date > new Date()}
                                                    initialFocus
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">To</Label>
                                                <Calendar
                                                    mode="single"
                                                    selected={dateRange.to}
                                                    onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                                                    disabled={(date) => date > new Date() || (dateRange.from ? date < dateRange.from : false)}
                                                    initialFocus
                                                />
                                            </div>
                                        </div>
                                        {dateRange.from && dateRange.to && (
                                            <div className="text-center text-sm text-muted-foreground border-t pt-3">
                                                <span className="font-medium text-foreground">
                                                    {differenceInDays(dateRange.to, dateRange.from) + 1}
                                                </span>
                                                {" "}
                                                {differenceInDays(dateRange.to, dateRange.from) + 1 === 1 ? "day" : "days"} selected
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => setDateRangeOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button 
                                            size="sm"
                                            onClick={handleCustomDateRangeApply}
                                            disabled={!dateRange.from}
                                        >
                                            Apply
                                        </Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by Message ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            {/* Clear Filters */}
                            {hasActiveFilters && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClearFilters}
                                    className="text-muted-foreground"
                                >
                                    <IconFilterOff className="h-4 w-4 mr-1" />
                                    Clear
                                </Button>
                            )}

                            {/* Auto-Refresh Toggle */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button 
                                        variant="outline" 
                                        size="icon"
                                        className={cn(autoRefreshInterval > 0 && "text-green-500")}
                                    >
                                        {autoRefreshInterval > 0 ? (
                                            <IconPlayerPlay className="h-4 w-4" />
                                        ) : (
                                            <IconPlayerPause className="h-4 w-4" />
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-48">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium">Auto-Refresh</Label>
                                        <Select 
                                            value={autoRefreshInterval.toString()} 
                                            onValueChange={(value) => setAutoRefreshInterval(parseInt(value))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {AUTO_REFRESH_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value.toString()}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            {/* Export Menu */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon">
                                        <IconDownload className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Export Data</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleExportCSV}>
                                        <IconFileExport className="h-4 w-4 mr-2" />
                                        Export as CSV
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportJSON}>
                                        <IconFileExport className="h-4 w-4 mr-2" />
                                        Export as JSON
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Refresh Button */}
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handleRefresh}
                                disabled={isLoading}
                            >
                                <IconRefresh className={cn("h-4 w-4", isLoading && "animate-spin")} />
                            </Button>
                        </div>
                    </div>

                    {/* Status bar */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
                        <div className="flex items-center gap-4">
                            <span>
                                Showing {logs.length} of {total} messages
                            </span>
                            {autoRefreshInterval > 0 && (
                                <span className="flex items-center gap-1 text-green-500">
                                    <IconClock className="h-3 w-3" />
                                    Auto-refreshing every {autoRefreshInterval}s
                                </span>
                            )}
                        </div>
                        {fetchedAt && (
                            <span>
                                Last updated {formatDistanceToNow(new Date(fetchedAt), { addSuffix: true })}
                            </span>
                        )}
                    </div>
                </CardHeader>
            </Card>

            {/* Data Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading && logs.length === 0 ? (
                        <div className="space-y-3 p-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-md" />
                            ))}
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12">
                            <IconMessages className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">
                                No message logs found for the selected filters
                            </p>
                            {hasActiveFilters && (
                                <Button 
                                    variant="link" 
                                    onClick={handleClearFilters}
                                    className="mt-2"
                                >
                                    Clear filters
                                </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>iFlow</TableHead>
                                        <TableHead>Sender → Receiver</TableHead>
                                        <TableHead>Start Time</TableHead>
                                        <TableHead className="text-right">Duration</TableHead>
                                        <TableHead className="w-[200px]">Message ID</TableHead>
                                        <TableHead className="w-[100px]">Status</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow 
                                            key={log.messageGuid}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => handleRowClick(log)}
                                        >
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium truncate max-w-[200px]">
                                                        {log.integrationFlowName}
                                                    </span>
                                                    {log.customStatus && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {log.customStatus}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm">
                                                    {log.sender || "—"} → {log.receiver || "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm">
                                                        {formatSAPDate(log.logStart, "MMM d, HH:mm:ss")}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatSAPDateRelative(log.logStart)}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-sm">
                                                {formatDuration(log.duration)}
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono text-xs text-muted-foreground truncate block max-w-[180px]">
                                                    {log.messageGuid.slice(0, 8)}...
                                                </span>
                                            </TableCell>
                                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <IconDotsVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRowClick(log);
                                                        }}>
                                                            <IconEye className="h-4 w-4 mr-2" />
                                                            View Details
                                                        </DropdownMenuItem>
                                                        {log.alternateWebLink && (
                                                            <DropdownMenuItem 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    window.open(log.alternateWebLink!, "_blank");
                                                                }}
                                                            >
                                                                <IconExternalLink className="h-4 w-4 mr-2" />
                                                                Open in SAP CPI
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            <div className="flex items-center justify-between p-4 border-t">
                                <div className="text-sm text-muted-foreground">
                                    Page {page} of {totalPages} ({total} total records)
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1 || isLoading}
                                    >
                                        <IconChevronLeft className="h-4 w-4 mr-1" />
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page >= totalPages || isLoading}
                                    >
                                        Next
                                        <IconChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Detail Sheet */}
            <MessageLogDetailSheet
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                messageGuid={selectedLogId}
            />
        </div>
    );
}
