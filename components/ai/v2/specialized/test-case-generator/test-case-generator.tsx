"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { TestTube,
    ArrowLeft,
    Download,
    RefreshCw,
    Play,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    AlertCircle,
    ChevronRight,
    Code,
    Copy,
    Check,
    FileJson,
    FileCode,
    Layers,
    Target,
    Sparkles,
    ChevronsUpDown,
    Search,
    Plus,
    Trash2,
    Edit,
    Eye,
    Clock,
    Zap,
    FileText,
    Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { getIFlowsForTestGenerator, generateTestCases, getIFlowMetadata, type IFlowForTestGenerator, type IFlowMetadata as ServerIFlowMetadata, type TestCaseGenerationResult, type TestCase as ServerTestCase } from "@/app/actions/test-case-generator";

interface TestCaseGeneratorProps {
    tenantId: string;
    iflowId?: string;
}

// Use server types directly - TestSuite is just the generation result
type TestSuite = TestCaseGenerationResult;
type IFlowMetadata = ServerIFlowMetadata;
type TestCase = ServerTestCase;

interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export function TestCaseGenerator({ tenantId, iflowId }: TestCaseGeneratorProps) {
    // State
    const [iflows, setIflows] = useState<IFlowForTestGenerator[]>([]);
    const [selectedIflowId, setSelectedIflowId] = useState<string>(iflowId || "");
    const [iflowMetadata, setIflowMetadata] = useState<IFlowMetadata | null>(null);
    const [testSuite, setTestSuite] = useState<TestSuite | null>(null);
    const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
    const [generationCount, setGenerationCount] = useState(0);
    
    // Generation options
    const [generationOptions, setGenerationOptions] = useState({
        includePositive: true,
        includeNegative: true,
        includeEdgeCases: true,
        includePerformance: false,
        includeSecurity: false,
        customScenarios: "",
    });

    // Sort and filter iFlows
    const sortedAndFilteredIflows = useMemo(() => {
        return iflows
            .filter(iflow =>
                iflow.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [iflows, searchQuery]);

    // Load iFlows on mount
    useEffect(() => {
        loadIflows();
    }, [tenantId]);

    // Load metadata when iFlow is selected
    useEffect(() => {
        if (selectedIflowId) {
            loadIflowMetadata();
        } else {
            setIflowMetadata(null);
            setTestSuite(null);
        }
    }, [selectedIflowId]);

    const loadIflows = async () => {
        setIsLoading(true);
        try {
            const result = await getIFlowsForTestGenerator({ tenantId });

            if (result.success && result.data) {
                const sortedIflows = result.data.sort((a: IFlowForTestGenerator, b: IFlowForTestGenerator) => a.name.localeCompare(b.name));
                setIflows(sortedIflows);

                if (iflowId) {
                    setSelectedIflowId(iflowId);
                }
            } else {
                toast.error(result.error || "Failed to load iFlows");
            }
        } catch (error) {
            console.error("Error loading iFlows:", error);
            toast.error("Failed to load iFlows");
        } finally {
            setIsLoading(false);
        }
    };

    const loadIflowMetadata = async () => {
        if (!selectedIflowId) return;

        setIsLoadingMetadata(true);
        try {
            const result = await getIFlowMetadata({ tenantId, iflowId: selectedIflowId });

            if (result.success && result.data) {
                setIflowMetadata(result.data);
            } else {
                toast.error(result.error || "Failed to load iFlow metadata");
            }
        } catch (error) {
            console.error("Error loading iFlow metadata:", error);
            toast.error("Failed to load iFlow metadata");
        } finally {
            setIsLoadingMetadata(false);
        }
    };

    const handleGenerateTestCases = async () => {
        if (!selectedIflowId || !iflowMetadata) {
            toast.error("Please select an iFlow first");
            return;
        }

        setIsGenerating(true);
        try {
            // Build categories array from options
            const categories: string[] = [];
            if (generationOptions.includePositive) categories.push('functional');
            if (generationOptions.includeNegative) categories.push('error');
            if (generationOptions.includeEdgeCases) categories.push('integration');
            if (generationOptions.includePerformance) categories.push('performance');
            if (generationOptions.includeSecurity) categories.push('security');

            const result = await generateTestCases({
                tenantId,
                iflowId: selectedIflowId,
                metadata: iflowMetadata,
                categories,
            });

            if (result.success && result.data) {
                setTestSuite(result.data);
                setGenerationCount(prev => prev + 1);
                setActiveTab("test-cases");
                toast.success(`Generated ${result.data.totalTestCases} test cases`);
            } else {
                toast.error(result.error || "Failed to generate test cases");
            }
        } catch (error) {
            console.error("Error generating test cases:", error);
            toast.error("Failed to generate test cases");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleExportTestSuite = () => {
        if (!testSuite) return;

        const exportData = {
            ...testSuite,
            exportedAt: new Date().toISOString(),
            iflowId: selectedIflowId,
            iflowName: iflowMetadata?.name,
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `test-suite-${selectedIflowId}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Test suite exported");
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case "functional":
                return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case "integration":
                return <Layers className="h-4 w-4 text-blue-500" />;
            case "error":
                return <XCircle className="h-4 w-4 text-red-500" />;
            case "performance":
                return <Zap className="h-4 w-4 text-purple-500" />;
            case "security":
                return <AlertCircle className="h-4 w-4 text-orange-500" />;
            default:
                return <TestTube className="h-4 w-4 text-gray-500" />;
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case "functional":
                return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
            case "integration":
                return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
            case "error":
                return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
            case "performance":
                return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
            case "security":
                return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
            default:
                return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
        }
    };

    const getPriorityColor = (priority: TestCase["priority"]) => {
        switch (priority) {
            case "critical":
                return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
            case "high":
                return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
            case "medium":
                return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
            case "low":
                return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
        }
    };

    // Render loading state
    if (isLoading) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-72" />
                    </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                            <TestTube className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Test Case Generator</h1>
                            <p className="text-sm text-muted-foreground">
                                Generate comprehensive test cases for your iFlow integrations
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {tokenUsage && (
                        <Badge variant="outline" className="gap-1">
                            <Sparkles className="h-3 w-3" />
                            {tokenUsage.totalTokens.toLocaleString()} tokens
                        </Badge>
                    )}
                    {generationCount > 0 && (
                        <Badge variant="secondary" className="gap-1">
                            <RefreshCw className="h-3 w-3" />
                            {generationCount} generations
                        </Badge>
                    )}
                </div>
            </div>

            {/* iFlow Selection */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-base">Select iFlow</CardTitle>
                    <CardDescription>
                        Choose an iFlow to generate test cases for
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className="w-full justify-between"
                            >
                                {selectedIflowId
                                    ? iflows.find(iflow => iflow.id === selectedIflowId)?.name || "Select iFlow..."
                                    : "Select iFlow..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[500px] p-0" align="start">
                            <Command>
                                <CommandInput
                                    placeholder="Search iFlows..."
                                    value={searchQuery}
                                    onValueChange={setSearchQuery}
                                />
                                <CommandList>
                                    <CommandEmpty>No iFlows found.</CommandEmpty>
                                    <CommandGroup>
                                        {sortedAndFilteredIflows.map((iflow) => (
                                            <CommandItem
                                                key={iflow.id}
                                                value={iflow.id}
                                                onSelect={(value) => {
                                                    setSelectedIflowId(value);
                                                    setOpen(false);
                                                    setSearchQuery("");
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        selectedIflowId === iflow.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                {iflow.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </CardContent>
            </Card>

            {/* Main Content */}
            {selectedIflowId && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="overview" className="gap-2">
                            <Target className="h-4 w-4" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="generate" className="gap-2">
                            <Sparkles className="h-4 w-4" />
                            Generate
                        </TabsTrigger>
                        <TabsTrigger value="test-cases" className="gap-2" disabled={!testSuite}>
                            <Layers className="h-4 w-4" />
                            Test Cases
                            {testSuite && (
                                <Badge variant="secondary" className="ml-1">
                                    {testSuite.testCases.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="export" className="gap-2" disabled={!testSuite}>
                            <Download className="h-4 w-4" />
                            Export
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-4">
                        {isLoadingMetadata ? (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                {[...Array(4)].map((_, i) => (
                                    <Skeleton key={i} className="h-32" />
                                ))}
                            </div>
                        ) : iflowMetadata ? (
                            <>
                                {/* Metadata Cards */}
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                iFlow Name
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-lg font-semibold truncate">
                                                {iflowMetadata.name}
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                Adapters
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-2xl font-bold">
                                                {iflowMetadata.adapters.length}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {iflowMetadata.adapters.map(a => a.type).join(", ") || "None"}
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                Scripts
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-2xl font-bold">
                                                {iflowMetadata.scripts.length}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {iflowMetadata.scripts.map(s => s.type).join(", ") || "None"}
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                Mappings
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-2xl font-bold">
                                                {iflowMetadata.mappings.length}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {iflowMetadata.mappings.map(m => m.type).join(", ") || "None"}
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* iFlow Details */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>iFlow Configuration</CardTitle>
                                        <CardDescription>
                                            Extracted metadata that will be used to generate test cases
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {iflowMetadata.description && (
                                            <div>
                                                <Label className="text-muted-foreground">Description</Label>
                                                <p className="text-sm mt-1">{iflowMetadata.description}</p>
                                            </div>
                                        )}

                                        {iflowMetadata.adapters.length > 0 && (
                                            <div>
                                                <Label className="text-muted-foreground">Adapters</Label>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {iflowMetadata.adapters.map((adapter, i) => (
                                                        <Badge key={i} variant="outline">
                                                            {adapter.type} ({adapter.direction})
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {iflowMetadata.scripts.length > 0 && (
                                            <div>
                                                <Label className="text-muted-foreground">Scripts</Label>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {iflowMetadata.scripts.map((script, i) => (
                                                        <Badge key={i} variant="secondary">
                                                            <FileCode className="h-3 w-3 mr-1" />
                                                            {script.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {iflowMetadata.mappings.length > 0 && (
                                            <div>
                                                <Label className="text-muted-foreground">Mappings</Label>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {iflowMetadata.mappings.map((mapping, i) => (
                                                        <Badge key={i} variant="secondary">
                                                            {mapping.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </>
                        ) : (
                            <Card>
                                <CardContent className="flex flex-col items-center justify-center py-12">
                                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">
                                        Unable to load iFlow metadata. Please try again.
                                    </p>
                                    <Button variant="outline" className="mt-4" onClick={loadIflowMetadata}>
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Retry
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Generate Tab */}
                    <TabsContent value="generate" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Generation Options</CardTitle>
                                <CardDescription>
                                    Configure what types of test cases to generate
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Test Categories */}
                                <div className="space-y-4">
                                    <Label>Test Categories</Label>
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        <div className="flex items-center space-x-3 rounded-lg border p-4">
                                            <Checkbox
                                                id="positive"
                                                checked={generationOptions.includePositive}
                                                onCheckedChange={(checked) =>
                                                    setGenerationOptions(prev => ({
                                                        ...prev,
                                                        includePositive: !!checked
                                                    }))
                                                }
                                            />
                                            <div className="flex-1">
                                                <label htmlFor="positive" className="flex items-center gap-2 font-medium cursor-pointer">
                                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                    Positive Tests
                                                </label>
                                                <p className="text-xs text-muted-foreground">
                                                    Valid input scenarios
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-3 rounded-lg border p-4">
                                            <Checkbox
                                                id="negative"
                                                checked={generationOptions.includeNegative}
                                                onCheckedChange={(checked) =>
                                                    setGenerationOptions(prev => ({
                                                        ...prev,
                                                        includeNegative: !!checked
                                                    }))
                                                }
                                            />
                                            <div className="flex-1">
                                                <label htmlFor="negative" className="flex items-center gap-2 font-medium cursor-pointer">
                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                    Negative Tests
                                                </label>
                                                <p className="text-xs text-muted-foreground">
                                                    Invalid/error scenarios
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-3 rounded-lg border p-4">
                                            <Checkbox
                                                id="edge"
                                                checked={generationOptions.includeEdgeCases}
                                                onCheckedChange={(checked) =>
                                                    setGenerationOptions(prev => ({
                                                        ...prev,
                                                        includeEdgeCases: !!checked
                                                    }))
                                                }
                                            />
                                            <div className="flex-1">
                                                <label htmlFor="edge" className="flex items-center gap-2 font-medium cursor-pointer">
                                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                                    Edge Cases
                                                </label>
                                                <p className="text-xs text-muted-foreground">
                                                    Boundary conditions
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-3 rounded-lg border p-4">
                                            <Checkbox
                                                id="performance"
                                                checked={generationOptions.includePerformance}
                                                onCheckedChange={(checked) =>
                                                    setGenerationOptions(prev => ({
                                                        ...prev,
                                                        includePerformance: !!checked
                                                    }))
                                                }
                                            />
                                            <div className="flex-1">
                                                <label htmlFor="performance" className="flex items-center gap-2 font-medium cursor-pointer">
                                                    <Zap className="h-4 w-4 text-purple-500" />
                                                    Performance Tests
                                                </label>
                                                <p className="text-xs text-muted-foreground">
                                                    Load & stress tests
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-3 rounded-lg border p-4">
                                            <Checkbox
                                                id="security"
                                                checked={generationOptions.includeSecurity}
                                                onCheckedChange={(checked) =>
                                                    setGenerationOptions(prev => ({
                                                        ...prev,
                                                        includeSecurity: !!checked
                                                    }))
                                                }
                                            />
                                            <div className="flex-1">
                                                <label htmlFor="security" className="flex items-center gap-2 font-medium cursor-pointer">
                                                    <AlertCircle className="h-4 w-4 text-orange-500" />
                                                    Security Tests
                                                </label>
                                                <p className="text-xs text-muted-foreground">
                                                    Auth & validation
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Custom Scenarios */}
                                <div className="space-y-2">
                                    <Label htmlFor="custom">Custom Scenarios (Optional)</Label>
                                    <Textarea
                                        id="custom"
                                        placeholder="Describe any specific test scenarios you want to include..."
                                        value={generationOptions.customScenarios}
                                        onChange={(e) =>
                                            setGenerationOptions(prev => ({
                                                ...prev,
                                                customScenarios: e.target.value
                                            }))
                                        }
                                        rows={4}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Add specific test scenarios or business rules to include in the generated test cases.
                                    </p>
                                </div>

                                <Separator />

                                {/* Generate Button */}
                                <Button
                                    className="w-full"
                                    size="lg"
                                    onClick={handleGenerateTestCases}
                                    disabled={isGenerating || !iflowMetadata}
                                >
                                    {isGenerating ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                            Generating Test Cases...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4 mr-2" />
                                            Generate Test Cases
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Test Cases Tab */}
                    <TabsContent value="test-cases" className="space-y-4">
                        {testSuite && (
                            <>
                                {/* Coverage Summary */}
                                <div className="grid gap-4 md:grid-cols-5">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                Total Test Cases
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-2xl font-bold">{testSuite.totalTestCases}</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                Functional
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-2xl font-bold">{testSuite.categories.functional}</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <Layers className="h-4 w-4 text-blue-500" />
                                                Integration
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-2xl font-bold">{testSuite.categories.integration}</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <XCircle className="h-4 w-4 text-red-500" />
                                                Error Handling
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-2xl font-bold">{testSuite.categories.error}</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                                Performance/Security
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-2xl font-bold">{testSuite.categories.performance + testSuite.categories.security}</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Test Cases List */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Generated Test Cases</CardTitle>
                                        <CardDescription>
                                            {testSuite.testCases.length} test cases generated for {iflowMetadata?.name}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ScrollArea className="h-[500px]">
                                            <Accordion type="single" collapsible className="space-y-2">
                                                {testSuite.testCases.map((testCase) => (
                                                    <AccordionItem
                                                        key={testCase.id}
                                                        value={testCase.id}
                                                        className="border rounded-lg px-4"
                                                    >
                                                        <AccordionTrigger className="hover:no-underline">
                                                            <div className="flex items-center gap-3 flex-1 text-left">
                                                                {getCategoryIcon(testCase.category)}
                                                                <div className="flex-1">
                                                                    <p className="font-medium">{testCase.name}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {testCase.description}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge className={cn("text-xs", getCategoryColor(testCase.category))}>
                                                                        {testCase.category.replace("_", " ")}
                                                                    </Badge>
                                                                    <Badge className={cn("text-xs", getPriorityColor(testCase.priority))}>
                                                                        {testCase.priority}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="space-y-4 pt-4">
                                                            {/* Preconditions */}
                                                            {testCase.preconditions.length > 0 && (
                                                                <div>
                                                                    <Label className="text-muted-foreground">Preconditions</Label>
                                                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                                                        {testCase.preconditions.map((precondition, idx) => (
                                                                            <li key={idx} className="text-sm">{precondition}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            {/* Test Steps */}
                                                            <div>
                                                                <Label className="text-muted-foreground">Test Steps</Label>
                                                                <div className="mt-2 space-y-3">
                                                                    {testCase.steps.map((step) => (
                                                                        <div key={step.step} className="bg-muted/50 rounded-lg p-3">
                                                                            <div className="flex items-start gap-3">
                                                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                                                                                    {step.step}
                                                                                </span>
                                                                                <div className="flex-1 space-y-1">
                                                                                    <p className="text-sm font-medium">{step.action}</p>
                                                                                    <p className="text-xs text-muted-foreground">
                                                                                        <span className="font-medium">Expected: </span>
                                                                                        {step.expectedResult}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Test Data */}
                                                            {testCase.testData && (
                                                                <div>
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <Label className="text-muted-foreground">Test Data</Label>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleCopy(JSON.stringify(testCase.testData, null, 2), `testdata-${testCase.id}`)}
                                                                        >
                                                                            {copiedId === `testdata-${testCase.id}` ? (
                                                                                <Check className="h-4 w-4" />
                                                                            ) : (
                                                                                <Copy className="h-4 w-4" />
                                                                            )}
                                                                        </Button>
                                                                    </div>
                                                                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-48">
                                                                        <code>{JSON.stringify(testCase.testData, null, 2)}</code>
                                                                    </pre>
                                                                </div>
                                                            )}

                                                            {/* Automation Hints */}
                                                            {testCase.automationHints && testCase.automationHints.length > 0 && (
                                                                <div>
                                                                    <Label className="text-muted-foreground flex items-center gap-2">
                                                                        <Sparkles className="h-4 w-4" />
                                                                        Automation Hints
                                                                    </Label>
                                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                                        {testCase.automationHints.map((hint, idx) => (
                                                                            <Badge key={idx} variant="outline" className="text-xs">
                                                                                {hint}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                ))}
                                            </Accordion>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </TabsContent>

                    {/* Export Tab */}
                    <TabsContent value="export" className="space-y-4">
                        {testSuite && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Export Test Suite</CardTitle>
                                    <CardDescription>
                                        Download your generated test cases in various formats
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Button
                                            variant="outline"
                                            className="h-24 flex-col gap-2"
                                            onClick={handleExportTestSuite}
                                        >
                                            <FileJson className="h-8 w-8" />
                                            <span>Export as JSON</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="h-24 flex-col gap-2"
                                            onClick={() => {
                                                toast.info("Postman collection export coming soon!");
                                            }}
                                        >
                                            <Send className="h-8 w-8" />
                                            <span>Export as Postman Collection</span>
                                        </Button>
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">Test Suite Summary</Label>
                                        <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                                            <p><strong>iFlow:</strong> {testSuite.iflowName}</p>
                                            <p><strong>Total Test Cases:</strong> {testSuite.totalTestCases}</p>
                                            <p><strong>Generated At:</strong> {new Date(testSuite.generatedAt).toLocaleString()}</p>
                                            <p><strong>Coverage:</strong></p>
                                            <div className="pl-4 space-y-1 text-xs text-muted-foreground">
                                                <p>Adapters: {testSuite.coverage.adaptersCovered}/{testSuite.coverage.adaptersTotal}</p>
                                                <p>Scripts: {testSuite.coverage.scriptsCovered}/{testSuite.coverage.scriptsTotal}</p>
                                                <p>Mappings: {testSuite.coverage.mappingsCovered}/{testSuite.coverage.mappingsTotal}</p>
                                                <p>Error Handlers: {testSuite.coverage.errorHandlersCovered}/{testSuite.coverage.errorHandlersTotal}</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            )}

            {/* Empty State */}
            {!selectedIflowId && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <TestTube className="h-16 w-16 text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Select an iFlow</h3>
                        <p className="text-muted-foreground text-center max-w-md">
                            Choose an iFlow from the dropdown above to generate comprehensive test cases
                            based on its configuration and metadata.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
