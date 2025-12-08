"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
    FileText,
    ArrowLeft,
    Download,
    RefreshCw,
    Sparkles,
    CheckCircle2,
    ChevronRight,
    Code,
    Copy,
    Check,
    FileJson,
    Layers,
    ChevronsUpDown,
    Search,
    Eye,
    FileCode,
    BookOpen,
    Settings,
    AlertCircle,
    Workflow,
    Users,
    Wrench,
    Server,
    Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import {
    getIFlowsForDocGenerator,
    getIFlowDocMetadata,
    generateDocumentation,
} from "@/app/actions/documentation-generator";
import {
    AVAILABLE_SECTIONS,
    generateMarkdownExportSync,
    type IFlowForDocGenerator,
    type IFlowDocMetadata,
    type DocumentationType,
    type GeneratedDocument,
} from "@/types/documentation-generator";

interface DocumentationGeneratorProps {
    tenantId: string;
    iflowId?: string;
}

// Document type definitions
const DOCUMENT_TYPES: Array<{
    type: DocumentationType;
    name: string;
    description: string;
    icon: React.ElementType;
    color: string;
}> = [
    {
        type: "technical-spec",
        name: "Technical Spec",
        description: "Comprehensive technical documentation for developers",
        icon: FileCode,
        color: "text-blue-500",
    },
    {
        type: "user-guide",
        name: "User Guide",
        description: "End-user focused documentation",
        icon: Users,
        color: "text-green-500",
    },
    {
        type: "ops-runbook",
        name: "Ops Runbook",
        description: "Operational procedures and monitoring",
        icon: Wrench,
        color: "text-orange-500",
    },
    {
        type: "api-docs",
        name: "API Docs",
        description: "API endpoint specifications",
        icon: Server,
        color: "text-purple-500",
    },
    {
        type: "deployment-guide",
        name: "Deployment Guide",
        description: "Installation and configuration guide",
        icon: Rocket,
        color: "text-cyan-500",
    },
];

export function DocumentationGenerator({ tenantId, iflowId }: DocumentationGeneratorProps) {
    // State
    const [iflows, setIflows] = useState<IFlowForDocGenerator[]>([]);
    const [selectedIflowId, setSelectedIflowId] = useState<string>(iflowId || "");
    const [iflowMetadata, setIflowMetadata] = useState<IFlowDocMetadata | null>(null);
    const [document, setDocument] = useState<GeneratedDocument | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [generationCount, setGenerationCount] = useState(0);

    // Document options
    const [documentationType, setDocumentationType] = useState<DocumentationType>("technical-spec");
    const [selectedSections, setSelectedSections] = useState<string[]>(
        AVAILABLE_SECTIONS.filter(s => s.enabled).map(s => s.id)
    );

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

    // Load metadata when iFlow changes
    useEffect(() => {
        if (selectedIflowId) {
            loadIflowMetadata();
        } else {
            setIflowMetadata(null);
            setDocument(null);
        }
    }, [selectedIflowId]);

    const loadIflows = async () => {
        setIsLoading(true);
        try {
            const result = await getIFlowsForDocGenerator({ tenantId });

            if (result.success && result.data) {
                setIflows(result.data);

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
            const result = await getIFlowDocMetadata({ tenantId, iflowId: selectedIflowId });

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

    const handleGenerateDocumentation = async () => {
        if (!selectedIflowId || !iflowMetadata) {
            toast.error("Please select an iFlow first");
            return;
        }

        if (selectedSections.length === 0) {
            toast.error("Please select at least one section");
            return;
        }

        setIsGenerating(true);
        try {
            const result = await generateDocumentation({
                tenantId,
                iflowId: selectedIflowId,
                metadata: iflowMetadata,
                documentationType,
                sections: selectedSections,
            });

            if (result.success && result.data) {
                setDocument(result.data);
                setGenerationCount(prev => prev + 1);
                setActiveTab("preview");
                toast.success(`Documentation generated with ${result.data.sections.length} sections`);
            } else {
                toast.error(result.error || "Failed to generate documentation");
            }
        } catch (error) {
            console.error("Error generating documentation:", error);
            toast.error("Failed to generate documentation");
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

    const handleExportMarkdown = () => {
        if (!document) return;

        const markdown = generateMarkdownExportSync(document);
        const blob = new Blob([markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement("a");
        a.href = url;
        a.download = `${document.iflowName}-${document.type}-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Documentation exported as Markdown");
    };

    const handleExportJson = () => {
        if (!document) return;

        const blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement("a");
        a.href = url;
        a.download = `${document.iflowName}-${document.type}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Documentation exported as JSON");
    };

    const handleCopyAllContent = () => {
        if (!document) return;

        const markdown = generateMarkdownExportSync(document);
        navigator.clipboard.writeText(markdown);
        toast.success("Documentation copied to clipboard");
    };

    const toggleSection = (sectionId: string) => {
        setSelectedSections(prev =>
            prev.includes(sectionId)
                ? prev.filter(id => id !== sectionId)
                : [...prev, sectionId]
        );
    };

    const selectAllSections = () => {
        setSelectedSections(AVAILABLE_SECTIONS.map(s => s.id));
    };

    const deselectAllSections = () => {
        setSelectedSections([]);
    };

    const selectedIflowName = useMemo(() => {
        return iflows.find(i => i.id === selectedIflowId)?.name || "";
    }, [iflows, selectedIflowId]);

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
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/ai-agents">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Documentation Generator</h1>
                            <p className="text-muted-foreground">
                                Generate comprehensive documentation from your iFlow configurations
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={loadIflows} disabled={isLoading}>
                        <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* iFlow Selector */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Select iFlow</CardTitle>
                    <CardDescription>
                        Choose an iFlow to generate documentation from its configuration
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
                                {selectedIflowId ? selectedIflowName : "Select an iFlow..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                                <CommandInput
                                    placeholder="Search iFlows..."
                                    value={searchQuery}
                                    onValueChange={setSearchQuery}
                                />
                                <CommandList>
                                    <CommandEmpty>No iFlow found.</CommandEmpty>
                                    <CommandGroup>
                                        {sortedAndFilteredIflows.map((iflow) => (
                                            <CommandItem
                                                key={iflow.id}
                                                value={iflow.name}
                                                onSelect={() => {
                                                    setSelectedIflowId(iflow.id);
                                                    setOpen(false);
                                                    setSearchQuery("");
                                                }}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span>{iflow.name}</span>
                                                    <Badge variant="outline" className="text-xs">
                                                        {iflow.status}
                                                    </Badge>
                                                </div>
                                                {selectedIflowId === iflow.id && (
                                                    <Check className="ml-2 h-4 w-4" />
                                                )}
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
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="overview" className="flex items-center gap-2">
                            <Layers className="h-4 w-4" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="generate" className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Configure
                        </TabsTrigger>
                        <TabsTrigger value="preview" className="flex items-center gap-2" disabled={!document}>
                            <Eye className="h-4 w-4" />
                            Preview
                        </TabsTrigger>
                        <TabsTrigger value="export" className="flex items-center gap-2" disabled={!document}>
                            <Download className="h-4 w-4" />
                            Export
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-4">
                        {isLoadingMetadata ? (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                {[...Array(4)].map((_, i) => (
                                    <Skeleton key={i} className="h-24" />
                                ))}
                            </div>
                        ) : iflowMetadata ? (
                            <>
                                {/* Stats Grid */}
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                Adapters
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-2xl font-bold">{iflowMetadata.adapters.length}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {iflowMetadata.adapters.filter(a => a.direction === 'sender').length} sender, {iflowMetadata.adapters.filter(a => a.direction === 'receiver').length} receiver
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
                                            <p className="text-2xl font-bold">{iflowMetadata.scripts.length}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {iflowMetadata.scripts.reduce((acc, s) => acc + s.linesOfCode, 0)} total lines
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
                                            <p className="text-2xl font-bold">{iflowMetadata.mappings.length}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Message transformations
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                                Error Handlers
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-2xl font-bold">{iflowMetadata.errorHandlers.length}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Exception configurations
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Detailed Info */}
                                <div className="grid gap-4 md:grid-cols-2">
                                    {/* Adapters */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Workflow className="h-4 w-4" />
                                                Adapters
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ScrollArea className="h-[200px]">
                                                <div className="space-y-3">
                                                    {iflowMetadata.adapters.map((adapter) => (
                                                        <div key={adapter.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                                                            <div>
                                                                <p className="font-medium text-sm">{adapter.name}</p>
                                                                <p className="text-xs text-muted-foreground">{adapter.type}</p>
                                                            </div>
                                                            <Badge variant={adapter.direction === 'sender' ? 'default' : 'secondary'}>
                                                                {adapter.direction}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                    {iflowMetadata.adapters.length === 0 && (
                                                        <p className="text-sm text-muted-foreground">No adapters configured</p>
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>

                                    {/* Scripts */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Code className="h-4 w-4" />
                                                Scripts
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ScrollArea className="h-[200px]">
                                                <div className="space-y-3">
                                                    {iflowMetadata.scripts.map((script) => (
                                                        <div key={script.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                                                            <div>
                                                                <p className="font-medium text-sm">{script.name}</p>
                                                                <p className="text-xs text-muted-foreground">{script.type} • {script.linesOfCode} lines</p>
                                                            </div>
                                                            <Badge variant="outline" className={cn(
                                                                script.complexity === 'high' && 'border-red-500 text-red-500',
                                                                script.complexity === 'medium' && 'border-yellow-500 text-yellow-500',
                                                                script.complexity === 'low' && 'border-green-500 text-green-500'
                                                            )}>
                                                                {script.complexity}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                    {iflowMetadata.scripts.length === 0 && (
                                                        <p className="text-sm text-muted-foreground">No scripts configured</p>
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>
                                </div>
                            </>
                        ) : (
                            <Card>
                                <CardContent className="flex flex-col items-center justify-center py-12">
                                    <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                                    <p className="text-muted-foreground">Failed to load iFlow metadata</p>
                                    <Button variant="outline" onClick={loadIflowMetadata} className="mt-4">
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Retry
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Generate Tab */}
                    <TabsContent value="generate" className="space-y-4">
                        <div className="grid gap-6 md:grid-cols-2">
                            {/* Document Type Selection */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Document Type</CardTitle>
                                    <CardDescription>
                                        Select the type of documentation to generate
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-3">
                                        {DOCUMENT_TYPES.map((docType) => (
                                            <div
                                                key={docType.type}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                                                    documentationType === docType.type
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border hover:bg-muted/50"
                                                )}
                                                onClick={() => setDocumentationType(docType.type)}
                                            >
                                                <docType.icon className={cn("h-5 w-5", docType.color)} />
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{docType.name}</p>
                                                    <p className="text-xs text-muted-foreground">{docType.description}</p>
                                                </div>
                                                {documentationType === docType.type && (
                                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Section Selection */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-base">Sections</CardTitle>
                                            <CardDescription>
                                                Choose which sections to include ({selectedSections.length} selected)
                                            </CardDescription>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" onClick={selectAllSections}>
                                                All
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={deselectAllSections}>
                                                None
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <ScrollArea className="h-[300px] pr-4">
                                        <div className="space-y-3">
                                            {AVAILABLE_SECTIONS.map((section) => (
                                                <div
                                                    key={section.id}
                                                    className="flex items-start gap-3"
                                                >
                                                    <Checkbox
                                                        id={section.id}
                                                        checked={selectedSections.includes(section.id)}
                                                        onCheckedChange={() => toggleSection(section.id)}
                                                    />
                                                    <div className="grid gap-1 leading-none">
                                                        <Label
                                                            htmlFor={section.id}
                                                            className="text-sm font-medium cursor-pointer"
                                                        >
                                                            {section.name}
                                                        </Label>
                                                        <p className="text-xs text-muted-foreground">
                                                            {section.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Generate Button */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Ready to generate</p>
                                        <p className="text-sm text-muted-foreground">
                                            {DOCUMENT_TYPES.find(d => d.type === documentationType)?.name} with {selectedSections.length} sections
                                        </p>
                                    </div>
                                    <Button
                                        onClick={handleGenerateDocumentation}
                                        disabled={isGenerating || !iflowMetadata || selectedSections.length === 0}
                                        className="min-w-[180px]"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="h-4 w-4 mr-2" />
                                                Generate Documentation
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Preview Tab */}
                    <TabsContent value="preview" className="space-y-4">
                        {document && (
                            <>
                                {/* Document Header */}
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle>{document.title}</CardTitle>
                                                <CardDescription>
                                                    Generated on {new Date(document.generatedAt).toLocaleString()}
                                                </CardDescription>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary">
                                                    {document.tokensUsed.toLocaleString()} tokens
                                                </Badge>
                                                <Badge variant="outline">
                                                    {document.sections.length} sections
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>

                                {/* Sections */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Document Content</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ScrollArea className="h-[500px] pr-4">
                                            <div className="space-y-6">
                                                {document.sections.map((section) => (
                                                    <div key={section.id} className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="font-semibold text-lg">{section.title}</h3>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleCopy(section.content, section.id)}
                                                            >
                                                                {copiedId === section.id ? (
                                                                    <Check className="h-4 w-4" />
                                                                ) : (
                                                                    <Copy className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                        <div className="prose prose-sm dark:prose-invert max-w-none">
                                                            <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg overflow-auto">
                                                                {section.content}
                                                            </pre>
                                                        </div>
                                                        <Separator />
                                                    </div>
                                                ))}

                                                {/* Diagrams */}
                                                {document.diagrams.length > 0 && (
                                                    <div className="space-y-4">
                                                        <h3 className="font-semibold text-lg">Diagrams</h3>
                                                        {document.diagrams.map((diagram) => (
                                                            <div key={diagram.id} className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="font-medium">{diagram.title}</p>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleCopy(diagram.mermaidCode, `diagram-${diagram.id}`)}
                                                                    >
                                                                        {copiedId === `diagram-${diagram.id}` ? (
                                                                            <Check className="h-4 w-4" />
                                                                        ) : (
                                                                            <Copy className="h-4 w-4" />
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto">
                                                                    <code>{diagram.mermaidCode}</code>
                                                                </pre>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </TabsContent>

                    {/* Export Tab */}
                    <TabsContent value="export" className="space-y-4">
                        {document && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Export Documentation</CardTitle>
                                    <CardDescription>
                                        Download your generated documentation in various formats
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <Button
                                            variant="outline"
                                            className="h-24 flex-col gap-2"
                                            onClick={handleExportMarkdown}
                                        >
                                            <FileText className="h-8 w-8" />
                                            <span>Export as Markdown</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="h-24 flex-col gap-2"
                                            onClick={handleExportJson}
                                        >
                                            <FileJson className="h-8 w-8" />
                                            <span>Export as JSON</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="h-24 flex-col gap-2"
                                            onClick={handleCopyAllContent}
                                        >
                                            <Copy className="h-8 w-8" />
                                            <span>Copy to Clipboard</span>
                                        </Button>
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">Document Summary</Label>
                                        <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                                            <p><strong>iFlow:</strong> {document.iflowName}</p>
                                            <p><strong>Type:</strong> {DOCUMENT_TYPES.find(d => d.type === document.type)?.name}</p>
                                            <p><strong>Sections:</strong> {document.sections.length}</p>
                                            <p><strong>Diagrams:</strong> {document.diagrams.length}</p>
                                            <p><strong>Generated:</strong> {new Date(document.generatedAt).toLocaleString()}</p>
                                            <p><strong>Tokens Used:</strong> {document.tokensUsed.toLocaleString()}</p>
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
                        <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Select an iFlow</h3>
                        <p className="text-muted-foreground text-center max-w-md">
                            Choose an iFlow from the dropdown above to generate comprehensive documentation
                            based on its configuration and metadata.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
