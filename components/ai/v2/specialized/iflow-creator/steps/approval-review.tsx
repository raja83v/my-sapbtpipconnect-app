"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    CheckCircle2,
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Package,
    FileCode,
    Settings,
    Info
} from "lucide-react";
import type { WizardState } from "../types";

interface ApprovalReviewProps {
    state: WizardState;
    onBack: () => void;
    onApprove: () => void;
}

export function ApprovalReview({ state, onBack, onApprove }: ApprovalReviewProps) {
    const [isApproving, setIsApproving] = useState(false);

    const handleApprove = async () => {
        setIsApproving(true);
        try {
            await onApprove();
        } finally {
            setIsApproving(false);
        }
    };

    if (!state.packageSelection || !state.description || !state.design) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    Missing required data. Please go back and complete all steps.
                </AlertDescription>
            </Alert>
        );
    }

    const { packageSelection, description, design } = state;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold">Review & Approve</h2>
                <p className="text-muted-foreground mt-1">
                    Review the iFlow design before creating it in SAP CPI
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Package
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm">
                            <p className="font-semibold">{packageSelection.packageName}</p>
                            <p className="text-muted-foreground text-xs mt-1">
                                {packageSelection.packageId}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <FileCode className="h-4 w-4" />
                            iFlow Name
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm">
                            <p className="font-semibold">{design.metadata.name}</p>
                            <p className="text-muted-foreground text-xs mt-1">
                                Version {design.metadata.version}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Complexity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge
                            variant={
                                design.estimatedComplexity === 'low' ? 'default' :
                                    design.estimatedComplexity === 'medium' ? 'secondary' :
                                        'destructive'
                            }
                        >
                            {design.estimatedComplexity}
                        </Badge>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Review */}
            <Card>
                <CardHeader>
                    <CardTitle>Design Details</CardTitle>
                    <CardDescription>
                        Review the complete iFlow configuration
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="adapters">
                                Adapters ({design.adapters.length})
                            </TabsTrigger>
                            <TabsTrigger value="processing">
                                Processing ({design.scripts.length + design.mappings.length})
                            </TabsTrigger>
                            <TabsTrigger value="error-handling">
                                Error Handling
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <h4 className="font-semibold">Description</h4>
                                <p className="text-sm text-muted-foreground">
                                    {description.description}
                                </p>
                            </div>

                            {description.sourceSystem && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold">Source System</h4>
                                    <p className="text-sm text-muted-foreground">
                                        {description.sourceSystem}
                                    </p>
                                </div>
                            )}

                            {description.targetSystem && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold">Target System</h4>
                                    <p className="text-sm text-muted-foreground">
                                        {description.targetSystem}
                                    </p>
                                </div>
                            )}

                            {description.dataFormat && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold">Data Format</h4>
                                    <p className="text-sm text-muted-foreground">
                                        {description.dataFormat}
                                    </p>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="adapters" className="space-y-4 mt-4">
                            {design.adapters.map((adapter, idx) => (
                                <Card key={idx}>
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm">
                                                {adapter.name}
                                            </CardTitle>
                                            <div className="flex gap-2">
                                                <Badge variant="outline">
                                                    {adapter.type}
                                                </Badge>
                                                <Badge variant={adapter.direction === 'Sender' ? 'default' : 'secondary'}>
                                                    {adapter.direction}
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 text-sm">
                                            {adapter.address && (
                                                <div>
                                                    <span className="font-medium">Address: </span>
                                                    <span className="text-muted-foreground">{adapter.address}</span>
                                                </div>
                                            )}
                                            {adapter.properties && Object.keys(adapter.properties).length > 0 && (
                                                <div>
                                                    <span className="font-medium">Properties: </span>
                                                    <span className="text-muted-foreground">
                                                        {Object.keys(adapter.properties).length} configured
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </TabsContent>

                        <TabsContent value="processing" className="space-y-4 mt-4">
                            {design.scripts.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold">Scripts ({design.scripts.length})</h4>
                                    {design.scripts.map((script, idx) => (
                                        <Card key={idx}>
                                            <CardContent className="pt-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium">{script.name}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {script.type} • {script.estimatedLines || 0} lines
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline">{script.complexity}</Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}

                            {design.mappings.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold">Mappings ({design.mappings.length})</h4>
                                    {design.mappings.map((mapping, idx) => (
                                        <Card key={idx}>
                                            <CardContent className="pt-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium">{mapping.name}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {mapping.type}
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline">{mapping.complexity}</Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="error-handling" className="space-y-4 mt-4">
                            {design.errorHandlers.map((handler, idx) => (
                                <Card key={idx}>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm">{handler.name}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 text-sm">
                                            <div>
                                                <span className="font-medium">Type: </span>
                                                <span className="text-muted-foreground">{handler.errorType}</span>
                                            </div>
                                            {handler.retryCount && handler.retryCount > 0 && (
                                                <div>
                                                    <span className="font-medium">Retry: </span>
                                                    <span className="text-muted-foreground">
                                                        {handler.retryCount} attempts, {handler.retryInterval}ms interval
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* AI Recommendations */}
            {design.performanceNotes && design.performanceNotes.length > 0 && (
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        <p className="font-semibold mb-2">Performance Notes:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            {design.performanceNotes.map((note: string, idx: number) => (
                                <li key={idx}>{note}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4">
                <Button
                    variant="outline"
                    onClick={onBack}
                    disabled={isApproving}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Design
                </Button>
                <Button
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="bg-green-600 hover:bg-green-700"
                >
                    {isApproving ? (
                        <>Creating iFlow...</>
                    ) : (
                        <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approve & Create
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}