"use client";

import { useState, useEffect } from "react";
import { getIntegrationPackages, getPackageIFlows } from "@/app/actions/iflow-creator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { PackageSelection, SAPCPIPackage, SAPCPIIFlow } from "../types";
import { Package, PackagePlus, Loader2, Check, ChevronsUpDown, AlertTriangle, FileCode, FilePlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface PackageSelectionStepProps {
    tenantId: string;
    value?: PackageSelection;
    onChange: (selection: PackageSelection) => void;
    onNext: () => void;
}

export function PackageSelectionStep({
    tenantId,
    value,
    onChange,
    onNext,
}: PackageSelectionStepProps) {
    const [mode, setMode] = useState<'new' | 'existing'>(value?.mode || 'existing');
    const [packages, setPackages] = useState<SAPCPIPackage[]>([]);
    const [iflows, setIFlows] = useState<SAPCPIIFlow[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingIFlows, setLoadingIFlows] = useState(false);
    const [openPackage, setOpenPackage] = useState(false);
    const [openIFlow, setOpenIFlow] = useState(false);

    // Form state
    const [selectedPackageId, setSelectedPackageId] = useState(value?.packageId || "");
    const [selectedIFlowId, setSelectedIFlowId] = useState(value?.iflowId || "");
    const [newPackageName, setNewPackageName] = useState(value?.packageName || "");
    const [newPackageDescription, setNewPackageDescription] = useState(value?.packageDescription || "");
    const [createNewIFlow, setCreateNewIFlow] = useState(value?.createNewIFlow || false);

    // Load packages when mode is 'existing'
    useEffect(() => {
        if (mode === 'existing') {
            loadPackages();
        }
    }, [mode, tenantId]);

    const loadPackages = async () => {
        setLoading(true);
        try {
            const result = await getIntegrationPackages(tenantId);
            if (result.success && result.data) {
                setPackages(result.data);
            } else {
                console.error("Failed to load packages:", result.error);
            }
        } catch (error) {
            console.error("Failed to load packages:", error);
        } finally {
            setLoading(false);
        }
    };

    // Load iFlows when package is selected
    useEffect(() => {
        if (mode === 'existing' && selectedPackageId) {
            loadIFlows();
        } else {
            setIFlows([]);
            setSelectedIFlowId("");
        }
    }, [selectedPackageId, mode]);

    const loadIFlows = async () => {
        if (!selectedPackageId) return;

        setLoadingIFlows(true);
        try {
            const result = await getPackageIFlows(tenantId, selectedPackageId);
            if (result.success && result.data) {
                setIFlows(result.data);
            } else {
                console.error("Failed to load iFlows:", result.error);
                setIFlows([]);
            }
        } catch (error) {
            console.error("Failed to load iFlows:", error);
            setIFlows([]);
        } finally {
            setLoadingIFlows(false);
        }
    };

    // Update parent state
    useEffect(() => {
        if (mode === 'new') {
            onChange({
                mode: 'new',
                packageName: newPackageName,
                packageDescription: newPackageDescription,
                createNewIFlow: true, // Always create new iFlow in new package
            });
        } else {
            const selectedIFlow = iflows.find(iflow => iflow.Id === selectedIFlowId);
            onChange({
                mode: 'existing',
                packageId: selectedPackageId,
                iflowId: createNewIFlow ? undefined : selectedIFlowId,
                iflowName: createNewIFlow ? undefined : selectedIFlow?.Name,
                createNewIFlow: createNewIFlow,
            });
        }
    }, [mode, selectedPackageId, selectedIFlowId, newPackageName, newPackageDescription, iflows, createNewIFlow]);

    // Validation
    const isValid = mode === 'new'
        ? newPackageName.trim().length > 0
        : selectedPackageId.length > 0 && (createNewIFlow || selectedIFlowId.length > 0);

    // Get selected package and iFlow details
    const selectedPackage = packages.find(pkg => pkg.Id === selectedPackageId);
    const selectedIFlow = iflows.find(iflow => iflow.Id === selectedIFlowId);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Package Selection</h2>
                <p className="text-muted-foreground mt-2">
                    Choose where to create your new integration flow
                </p>
            </div>

            <RadioGroup
                value={mode}
                onValueChange={(value) => setMode(value as 'new' | 'existing')}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
                <Card className={mode === 'new' ? 'border-primary' : ''}>
                    <CardHeader className="space-y-1">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="new" id="new" />
                            <Label htmlFor="new" className="flex items-center gap-2 cursor-pointer">
                                <PackagePlus className="h-5 w-5" />
                                <span className="font-semibold">Create New Package</span>
                            </Label>
                        </div>
                        <CardDescription>
                            Start fresh with a new integration package
                        </CardDescription>
                    </CardHeader>
                    {mode === 'new' && (
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="packageName">
                                    Package Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="packageName"
                                    placeholder="e.g., Customer Integration Package"
                                    value={newPackageName}
                                    onChange={(e) => setNewPackageName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="packageDescription">Description</Label>
                                <Textarea
                                    id="packageDescription"
                                    placeholder="Describe the purpose of this package..."
                                    value={newPackageDescription}
                                    onChange={(e) => setNewPackageDescription(e.target.value)}
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    )}
                </Card>

                <Card className={mode === 'existing' ? 'border-primary' : ''}>
                    <CardHeader className="space-y-1">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="existing" id="existing" />
                            <Label htmlFor="existing" className="flex items-center gap-2 cursor-pointer">
                                <Package className="h-5 w-5" />
                                <span className="font-semibold">Use Existing Package</span>
                            </Label>
                        </div>
                        <CardDescription>
                            Update an existing iFlow in a package
                        </CardDescription>
                    </CardHeader>
                    {mode === 'existing' && (
                        <CardContent className="space-y-4">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="package">
                                                Select Package <span className="text-destructive">*</span>
                                            </Label>
                                            <Popover open={openPackage} onOpenChange={setOpenPackage}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={openPackage}
                                                        className="w-full justify-between"
                                                    >
                                                        {selectedPackageId
                                                            ? packages.find((pkg) => pkg.Id === selectedPackageId)?.Name
                                                            : "Search and select a package..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-full p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Search by name or ID..." />
                                                        <CommandList>
                                                            <CommandEmpty>No packages found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {packages.map((pkg) => (
                                                                    <CommandItem
                                                                        key={pkg.Id}
                                                                        value={`${pkg.Name} ${pkg.Id}`}
                                                                        onSelect={() => {
                                                                            setSelectedPackageId(pkg.Id);
                                                                            setSelectedIFlowId(""); // Reset iFlow selection
                                                                            setOpenPackage(false);
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                selectedPackageId === pkg.Id ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <div className="flex flex-col">
                                                                            <span className="font-medium">{pkg.Name}</span>
                                                                            <span className="text-xs text-muted-foreground">{pkg.Id}</span>
                                                                        </div>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        {selectedPackageId && (
                                            <>
                                                {/* Action Selection: Create New or Update Existing */}
                                                <div className="space-y-3 pt-2">
                                                    <Label>What would you like to do?</Label>
                                                    <RadioGroup
                                                        value={createNewIFlow ? "create" : "update"}
                                                        onValueChange={(v) => {
                                                            setCreateNewIFlow(v === "create");
                                                            if (v === "create") {
                                                                setSelectedIFlowId("");
                                                            }
                                                        }}
                                                        className="space-y-2"
                                                    >
                                                        <div className={cn(
                                                            "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                                            createNewIFlow ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                                                        )}>
                                                            <RadioGroupItem value="create" id="create-new" />
                                                            <Label htmlFor="create-new" className="flex items-center gap-2 cursor-pointer flex-1">
                                                                <FilePlus className="h-4 w-4 text-green-600" />
                                                                <div>
                                                                    <span className="font-medium">Create New iFlow</span>
                                                                    <p className="text-xs text-muted-foreground">AI will generate a new iFlow with a unique name</p>
                                                                </div>
                                                            </Label>
                                                        </div>
                                                        <div className={cn(
                                                            "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                                            !createNewIFlow ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                                                        )}>
                                                            <RadioGroupItem value="update" id="update-existing" />
                                                            <Label htmlFor="update-existing" className="flex items-center gap-2 cursor-pointer flex-1">
                                                                <FileCode className="h-4 w-4 text-blue-600" />
                                                                <div>
                                                                    <span className="font-medium">Update Existing iFlow</span>
                                                                    <p className="text-xs text-muted-foreground">Select an iFlow to overwrite with AI design</p>
                                                                </div>
                                                            </Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>

                                                {/* iFlow Selection (only shown when Update Existing is selected) */}
                                                {!createNewIFlow && (
                                                    <div className="space-y-2">
                                                        <Label htmlFor="iflow">
                                                            Select iFlow to Update <span className="text-destructive">*</span>
                                                        </Label>
                                                        {loadingIFlows ? (
                                                            <div className="flex items-center justify-center py-4 border rounded-md">
                                                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                            </div>
                                                        ) : iflows.length === 0 ? (
                                                            <Alert>
                                                                <AlertTriangle className="h-4 w-4" />
                                                                <AlertDescription>
                                                                    No iFlows found in this package. Select "Create New iFlow" instead or choose a different package.
                                                                </AlertDescription>
                                                            </Alert>
                                                        ) : (
                                                            <>
                                                                <Popover open={openIFlow} onOpenChange={setOpenIFlow}>
                                                                    <PopoverTrigger asChild>
                                                                        <Button
                                                                            variant="outline"
                                                                            role="combobox"
                                                                            aria-expanded={openIFlow}
                                                                            className="w-full justify-between"
                                                                        >
                                                                            {selectedIFlowId
                                                                                ? iflows.find((iflow) => iflow.Id === selectedIFlowId)?.Name
                                                                                : "Search and select an iFlow..."}
                                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-full p-0" align="start">
                                                                        <Command>
                                                                            <CommandInput placeholder="Search by name or ID..." />
                                                                            <CommandList>
                                                                                <CommandEmpty>No iFlows found.</CommandEmpty>
                                                                                <CommandGroup>
                                                                                    {iflows.map((iflow) => (
                                                                                        <CommandItem
                                                                                            key={iflow.Id}
                                                                                            value={`${iflow.Name} ${iflow.Id}`}
                                                                                            onSelect={() => {
                                                                                                setSelectedIFlowId(iflow.Id);
                                                                                                setOpenIFlow(false);
                                                                                            }}
                                                                                        >
                                                                                            <Check
                                                                                                className={cn(
                                                                                                    "mr-2 h-4 w-4",
                                                                                                    selectedIFlowId === iflow.Id ? "opacity-100" : "opacity-0"
                                                                                                )}
                                                                                            />
                                                                                            <div className="flex flex-col">
                                                                                                <span className="font-medium">{iflow.Name}</span>
                                                                                                <span className="text-xs text-muted-foreground">{iflow.Id}</span>
                                                                                            </div>
                                                                                        </CommandItem>
                                                                                    ))}
                                                                                </CommandGroup>
                                                                            </CommandList>
                                                                        </Command>
                                                                    </PopoverContent>
                                                                </Popover>

                                                                {selectedIFlow && (
                                                                    <>
                                                                        <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <FileCode className="h-4 w-4" />
                                                                                <span className="font-medium">{selectedIFlow.Name}</span>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-muted-foreground text-xs">{selectedIFlow.Id}</span>
                                                                            </div>
                                                                            {selectedIFlow.Description && (
                                                                                <div className="text-xs text-muted-foreground pt-1">
                                                                                    {selectedIFlow.Description}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        <Alert variant="destructive" className="border-orange-500 bg-orange-50">
                                                                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                                                                            <AlertDescription className="text-orange-900">
                                                                                <strong>Warning:</strong> The selected iFlow will be completely overwritten with the AI-generated design. Any existing configuration, scripts, or mappings will be replaced. This action cannot be undone.
                                                                            </AlertDescription>
                                                                        </Alert>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Info message for Create New */}
                                                {createNewIFlow && (
                                                    <Alert className="border-green-500 bg-green-50">
                                                        <FilePlus className="h-4 w-4 text-green-600" />
                                                        <AlertDescription className="text-green-900">
                                                            A new iFlow will be created in the selected package. The AI will generate a unique name and ID based on your description.
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    )}
                </Card>
            </RadioGroup>

            <div className="flex justify-end">
                <Button
                    onClick={onNext}
                    disabled={!isValid}
                    size="lg"
                >
                    Continue to Description
                </Button>
            </div>
        </div>
    );
}