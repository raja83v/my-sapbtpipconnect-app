"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IFlowDescription, IFlowDesign } from "../types";
import { generateIFlowDesign } from "@/app/actions/iflow-creator";
import {
    ArrowLeft,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Zap,
    Code,
    Workflow,
    Shield,
    TrendingUp,
    RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AIDesignReviewStepProps {
    description: IFlowDescription;
    value?: IFlowDesign;
    onChange: (design: IFlowDesign) => void;
    onNext: () => void;
    onBack: () => void;
}

export function AIDesignReviewStep({
    description,
    value,
    onChange,
    onNext,
    onBack,
}: AIDesignReviewStepProps) {
    const [design, setDesign] = useState<IFlowDesign | null>(value || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await generateIFlowDesign(description);

            if (result.success && result.data) {
                setDesign(result.data);
                onChange(result.data);
            } else {
                setError(result.error || "Failed to generate design");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const getComplexityColor = (complexity: string) => {
        switch (complexity) {
            case "low":
                return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
            case "medium":
                return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
            case "high":
                return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
            default:
                return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Generating iFlow Design...</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                        Our AI is analyzing your requirements and designing a complete integration flow.
                        This may take 10-30 seconds.
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Generation Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>

                <div className="flex justify-between">
                    <Button variant="outline" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Description
                    </Button>
                    <Button onClick={handleGenerate}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    if (!design) {
        return (
            <div className="space-y-6">
                <div className="text-center py-8">
                    <h2 className="text-2xl font-bold tracking-tight">Ready to Generate Design</h2>
                    <p className="text-muted-foreground mt-2">
                        Click the button below to let AI design your integration flow
                    </p>
                </div>

                <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <CardHeader>
                        <CardTitle className="text-base">What will be generated?</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            <li>Complete adapter configurations (sender and receiver)</li>
                            <li>Data transformation scripts (Groovy/JavaScript)</li>
                            <li>Field mappings and transformations</li>
                            <li>Error handling with retry logic</li>
                            <li>Performance and security recommendations</li>
                        </ul>
                    </CardContent>
                </Card>

                <div className="flex justify-between">
                    <Button variant="outline" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Description
                    </Button>
                    <Button onClick={handleGenerate} size="lg">
                        <Zap className="h-4 w-4 mr-2" />
                        Generate Design with AI
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">AI-Generated Design</h2>
                    <p className="text-muted-foreground mt-2">
                        Review the proposed integration flow design
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleGenerate}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                </Button>
            </div>

            {/* Overview Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle>{design.metadata.name}</CardTitle>
                            <CardDescription className="mt-2">
                                {design.metadata.description}
                            </CardDescription>
                        </div>
                        <Badge className={getComplexityColor(design.estimatedComplexity)}>
                            {design.estimatedComplexity} complexity
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="text-2xl font-bold">{design.adapters.length}</div>
                            <div className="text-sm text-muted-foreground">Adapters</div>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="text-2xl font-bold">{design.scripts.length}</div>
                            <div className="text-sm text-muted-foreground">Scripts</div>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="text-2xl font-bold">{design.mappings.length}</div>
                            <div className="text-sm text-muted-foreground">Mappings</div>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="text-2xl font-bold">{design.errorHandlers.length}</div>
                            <div className="text-sm text-muted-foreground">Error Handlers</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Detailed Tabs */}
            <Tabs defaultValue="adapters" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="adapters">Adapters</TabsTrigger>
                    <TabsTrigger value="scripts">Scripts</TabsTrigger>
                    <TabsTrigger value="mappings">Mappings</TabsTrigger>
                    <TabsTrigger value="errors">Error Handling</TabsTrigger>
                    <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                </TabsList>

                <TabsContent value="adapters" className="space-y-4">
                    {design.adapters.map((adapter) => (
                        <Card key={adapter.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-base">{adapter.name}</CardTitle>
                                        <CardDescription>
                                            {adapter.type} • {adapter.direction} • {adapter.protocol}
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline">{adapter.direction}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {adapter.address && (
                                    <div>
                                        <span className="text-sm font-medium">Address:</span>
                                        <p className="text-sm text-muted-foreground font-mono">{adapter.address}</p>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    {adapter.timeout && (
                                        <div>
                                            <span className="font-medium">Timeout:</span>
                                            <span className="text-muted-foreground ml-2">{adapter.timeout}ms</span>
                                        </div>
                                    )}
                                    {adapter.poolSize && (
                                        <div>
                                            <span className="font-medium">Pool Size:</span>
                                            <span className="text-muted-foreground ml-2">{adapter.poolSize}</span>
                                        </div>
                                    )}
                                    {adapter.authentication && (
                                        <div>
                                            <span className="font-medium">Auth:</span>
                                            <span className="text-muted-foreground ml-2">{adapter.authentication.type}</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </TabsContent>

                <TabsContent value="scripts" className="space-y-4">
                    {design.scripts.length === 0 ? (
                        <Card>
                            <CardContent className="pt-6 text-center text-muted-foreground">
                                No scripts required for this integration
                            </CardContent>
                        </Card>
                    ) : (
                        design.scripts.map((script) => (
                            <Card key={script.id}>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Code className="h-4 w-4" />
                                                {script.name}
                                            </CardTitle>
                                            <CardDescription>{script.purpose}</CardDescription>
                                        </div>
                                        <Badge className={getComplexityColor(script.complexity)}>
                                            {script.complexity}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="font-medium">Type:</span>
                                            <span className="text-muted-foreground ml-2">{script.type}</span>
                                        </div>
                                        {script.estimatedLines && (
                                            <div>
                                                <span className="font-medium">Est. Lines:</span>
                                                <span className="text-muted-foreground ml-2">{script.estimatedLines}</span>
                                            </div>
                                        )}
                                    </div>
                                    {script.scriptContent && (
                                        <details className="mt-2">
                                            <summary className="cursor-pointer text-sm font-medium">View Code</summary>
                                            <pre className="mt-2 p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                                                <code>{script.scriptContent}</code>
                                            </pre>
                                        </details>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                <TabsContent value="mappings" className="space-y-4">
                    {design.mappings.map((mapping) => (
                        <Card key={mapping.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Workflow className="h-4 w-4" />
                                            {mapping.name}
                                        </CardTitle>
                                        <CardDescription>{mapping.type}</CardDescription>
                                    </div>
                                    <Badge className={getComplexityColor(mapping.complexity)}>
                                        {mapping.complexity}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {mapping.transformations && mapping.transformations.length > 0 && (
                                    <div>
                                        <span className="text-sm font-medium">Transformations:</span>
                                        <ul className="mt-1 list-disc list-inside text-sm text-muted-foreground">
                                            {mapping.transformations.map((t, idx) => (
                                                <li key={idx}>{t}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </TabsContent>

                <TabsContent value="errors" className="space-y-4">
                    {design.errorHandlers.map((handler) => (
                        <Card key={handler.id}>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    {handler.name}
                                </CardTitle>
                                <CardDescription>Handles {handler.errorType} errors</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    {handler.retryCount && (
                                        <div>
                                            <span className="font-medium">Retry Count:</span>
                                            <span className="text-muted-foreground ml-2">{handler.retryCount}</span>
                                        </div>
                                    )}
                                    {handler.retryInterval && (
                                        <div>
                                            <span className="font-medium">Retry Interval:</span>
                                            <span className="text-muted-foreground ml-2">{handler.retryInterval}ms</span>
                                        </div>
                                    )}
                                </div>
                                {handler.fallbackAction && (
                                    <div>
                                        <span className="text-sm font-medium">Fallback Action:</span>
                                        <p className="text-sm text-muted-foreground">{handler.fallbackAction}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </TabsContent>

                <TabsContent value="recommendations" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Performance Recommendations
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2">
                                {design.performanceNotes.map((note, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                        <span className="text-sm">{note}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    {design.securityNotes && design.securityNotes.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    Security Considerations
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {design.securityNotes.map((note, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm">{note}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            <div className="flex justify-between">
                <Button variant="outline" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Description
                </Button>
                <Button onClick={onNext} size="lg">
                    Continue to Review & Approve
                </Button>
            </div>
        </div>
    );
}