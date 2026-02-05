"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IFlowDescription, IFlowDesign, RFCAdapterConfig, IDocAdapterConfig, XIAdapterConfig } from "../types";
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
import { RFCAdapterCard } from "../components/rfc-adapter-card";
import { IDocAdapterCard } from "../components/idoc-adapter-card";
import { XIAdapterCard } from "../components/xi-adapter-card";

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
                            <li>Complete adapter configurations (50+ supported adapters)</li>
                            <li>Content-based routing, multicasting, and message splitting</li>
                            <li>Data transformation scripts (Groovy/JavaScript/XSLT)</li>
                            <li>Message converters (XML, JSON, CSV, EDI)</li>
                            <li>Field mappings and content modifiers</li>
                            <li>Security components (PGP, PKCS7, XML Digital Signature)</li>
                            <li>Data persistence (Data Stores, Variables)</li>
                            <li>Timer/scheduler for batch processing</li>
                            <li>Exception handling with dead letter channels</li>
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
                            <div className="text-2xl font-bold">{design.adapters?.length ?? 0}</div>
                            <div className="text-sm text-muted-foreground">Adapters</div>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="text-2xl font-bold">{design.scripts?.length ?? 0}</div>
                            <div className="text-sm text-muted-foreground">Scripts</div>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="text-2xl font-bold">{design.mappings?.length ?? 0}</div>
                            <div className="text-sm text-muted-foreground">Mappings</div>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="text-2xl font-bold">{design.errorHandlers?.length ?? 0}</div>
                            <div className="text-sm text-muted-foreground">Error Handlers</div>
                        </div>
                    </div>
                    {/* Extended component counts */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                        {(design.routers?.length ?? 0) > 0 && (
                            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                                <div className="text-xl font-bold">{design.routers?.length}</div>
                                <div className="text-xs text-muted-foreground">Routers</div>
                            </div>
                        )}
                        {(design.splitters?.length ?? 0) > 0 && (
                            <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                                <div className="text-xl font-bold">{design.splitters?.length}</div>
                                <div className="text-xs text-muted-foreground">Splitters</div>
                            </div>
                        )}
                        {(design.converters?.length ?? 0) > 0 && (
                            <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                                <div className="text-xl font-bold">{design.converters?.length}</div>
                                <div className="text-xs text-muted-foreground">Converters</div>
                            </div>
                        )}
                        {((design.encryptors?.length ?? 0) + (design.signers?.length ?? 0)) > 0 && (
                            <div className="text-center p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                                <div className="text-xl font-bold">{(design.encryptors?.length ?? 0) + (design.signers?.length ?? 0)}</div>
                                <div className="text-xs text-muted-foreground">Security</div>
                            </div>
                        )}
                        {(design.dataStores?.length ?? 0) > 0 && (
                            <div className="text-center p-3 bg-cyan-50 dark:bg-cyan-950 rounded-lg">
                                <div className="text-xl font-bold">{design.dataStores?.length}</div>
                                <div className="text-xs text-muted-foreground">Data Stores</div>
                            </div>
                        )}
                    </div>
                    {/* Integration pattern badge */}
                    {design.integrationPattern && (
                        <div className="mt-4 pt-4 border-t">
                            <span className="text-sm text-muted-foreground mr-2">Integration Pattern:</span>
                            <Badge variant="secondary">{design.integrationPattern}</Badge>
                        </div>
                    )}
                    {/* Timer config indicator */}
                    {design.timerConfig && (
                        <div className="mt-2">
                            <span className="text-sm text-muted-foreground mr-2">Trigger:</span>
                            <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950">
                                Timer - {design.timerConfig.scheduleType === 'Schedule'
                                    ? `CRON: ${design.timerConfig.cronExpression}`
                                    : 'Run Once'}
                            </Badge>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Detailed Tabs */}
            <Tabs defaultValue="adapters" className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
                    <TabsTrigger value="adapters">Adapters</TabsTrigger>
                    <TabsTrigger value="flowControl">Flow Control</TabsTrigger>
                    <TabsTrigger value="transformers">Transformers</TabsTrigger>
                    <TabsTrigger value="scripts">Scripts</TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                    <TabsTrigger value="errors">Errors</TabsTrigger>
                    <TabsTrigger value="recommendations">Tips</TabsTrigger>
                </TabsList>

                <TabsContent value="adapters" className="space-y-4">
                    {(design.adapters?.length ?? 0) === 0 ? (
                        <Card>
                            <CardContent className="pt-6 text-center text-muted-foreground">
                                No adapters defined
                            </CardContent>
                        </Card>
                    ) : (
                        design.adapters?.map((adapter) => {
                            // Use specialized cards for RFC, IDoc, XI adapters
                            if (adapter.type === 'RFC') {
                                return (
                                    <RFCAdapterCard
                                        key={adapter.id}
                                        adapter={adapter as RFCAdapterConfig}
                                        onChange={(updates) => {
                                            if (design.adapters) {
                                                const updated = design.adapters.map(a =>
                                                    a.id === adapter.id ? { ...a, ...updates } : a
                                                );
                                                onChange({ ...design, adapters: updated });
                                            }
                                        }}
                                        readOnly={false}
                                    />
                                );
                            }

                            if (adapter.type === 'IDoc') {
                                return (
                                    <IDocAdapterCard
                                        key={adapter.id}
                                        adapter={adapter as IDocAdapterConfig}
                                        onChange={(updates) => {
                                            if (design.adapters) {
                                                const updated = design.adapters.map(a =>
                                                    a.id === adapter.id ? { ...a, ...updates } : a
                                                );
                                                onChange({ ...design, adapters: updated });
                                            }
                                        }}
                                        readOnly={false}
                                    />
                                );
                            }

                            if (adapter.type === 'XI') {
                                return (
                                    <XIAdapterCard
                                        key={adapter.id}
                                        adapter={adapter as XIAdapterConfig}
                                        onChange={(updates) => {
                                            if (design.adapters) {
                                                const updated = design.adapters.map(a =>
                                                    a.id === adapter.id ? { ...a, ...updates } : a
                                                );
                                                onChange({ ...design, adapters: updated });
                                            }
                                        }}
                                        readOnly={false}
                                    />
                                );
                            }

                            // Default card for other adapter types
                            return (
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
                                            {adapter.queueName && (
                                                <div>
                                                    <span className="font-medium">Queue:</span>
                                                    <span className="text-muted-foreground ml-2">{adapter.queueName}</span>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </TabsContent>

                <TabsContent value="flowControl" className="space-y-4">
                    {/* Routers */}
                    {design.routers && design.routers.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Routers</h3>
                            {design.routers.map((router) => (
                                <Card key={router.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Workflow className="h-4 w-4" />
                                            {router.name}
                                        </CardTitle>
                                        <CardDescription>{router.type} with {router.routingConditions?.length ?? 0} conditions</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {router.routingConditions?.map((condition, idx) => (
                                                <div key={condition.id} className="flex items-center gap-2 text-sm">
                                                    <Badge variant="outline" className="text-xs">{idx + 1}</Badge>
                                                    <span className="font-medium">{condition.name}:</span>
                                                    <code className="text-xs bg-muted px-2 py-1 rounded">{condition.expression}</code>
                                                </div>
                                            ))}
                                            {router.defaultRoute && (
                                                <div className="text-sm text-muted-foreground">
                                                    Default route: {router.defaultRoute}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    )}

                    {/* Splitters */}
                    {design.splitters && design.splitters.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-4">Splitters</h3>
                            {design.splitters.map((splitter) => (
                                <Card key={splitter.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base">{splitter.name}</CardTitle>
                                        <CardDescription>{splitter.type} using {splitter.expressionType}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-sm">
                                        {splitter.expression && (
                                            <code className="bg-muted px-2 py-1 rounded text-xs">{splitter.expression}</code>
                                        )}
                                        {splitter.parallelProcessing && (
                                            <Badge variant="secondary" className="ml-2">Parallel</Badge>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    )}

                    {/* Aggregators */}
                    {design.aggregators && design.aggregators.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-4">Aggregators</h3>
                            {design.aggregators.map((agg) => (
                                <Card key={agg.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base">{agg.name}</CardTitle>
                                        <CardDescription>Strategy: {agg.aggregationStrategy}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-sm space-y-2">
                                        <div>
                                            <span className="font-medium">Correlation:</span>
                                            <code className="ml-2 bg-muted px-2 py-1 rounded text-xs">{agg.correlationExpression}</code>
                                        </div>
                                        <div>
                                            <span className="font-medium">Completion:</span>
                                            <span className="ml-2">{agg.completionCondition.type} = {agg.completionCondition.value}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    )}

                    {/* Multicasts */}
                    {design.multicasts && design.multicasts.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-4">Multicasts</h3>
                            {design.multicasts.map((mc) => (
                                <Card key={mc.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base">{mc.name}</CardTitle>
                                        <CardDescription>{mc.type} with {mc.branches.length} branches</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-sm">
                                        <div className="flex flex-wrap gap-2">
                                            {mc.branches.map((branch) => (
                                                <Badge key={branch.id} variant="outline">{branch.name}</Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    )}

                    {(!design.routers?.length && !design.splitters?.length && !design.aggregators?.length && !design.multicasts?.length) && (
                        <Card>
                            <CardContent className="pt-6 text-center text-muted-foreground">
                                No flow control components in this integration
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="transformers" className="space-y-4">
                    {/* Converters */}
                    {design.converters && design.converters.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Converters</h3>
                            {design.converters.map((conv) => (
                                <Card key={conv.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base">{conv.name}</CardTitle>
                                        <CardDescription>{conv.type}</CardDescription>
                                    </CardHeader>
                                </Card>
                            ))}
                        </>
                    )}

                    {/* Content Modifiers */}
                    {design.contentModifiers && design.contentModifiers.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-4">Content Modifiers</h3>
                            {design.contentModifiers.map((cm) => (
                                <Card key={cm.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base">{cm.name}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm">
                                        {cm.headerActions && cm.headerActions.length > 0 && (
                                            <div>Headers: {cm.headerActions.length} actions</div>
                                        )}
                                        {cm.propertyActions && cm.propertyActions.length > 0 && (
                                            <div>Properties: {cm.propertyActions.length} actions</div>
                                        )}
                                        {cm.bodyAction && (
                                            <div>Body: {cm.bodyAction.type}</div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    )}

                    {/* Mappings */}
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-4">Mappings</h3>
                    {(design.mappings?.length ?? 0) === 0 ? (
                        <Card>
                            <CardContent className="pt-6 text-center text-muted-foreground">
                                No mappings required
                            </CardContent>
                        </Card>
                    ) : (
                        design.mappings?.map((mapping) => (
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
                        ))
                    )}
                </TabsContent>

                <TabsContent value="scripts" className="space-y-4">
                    {(design.scripts?.length ?? 0) === 0 ? (
                        <Card>
                            <CardContent className="pt-6 text-center text-muted-foreground">
                                No scripts required for this integration
                            </CardContent>
                        </Card>
                    ) : (
                        design.scripts?.map((script) => (
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

                <TabsContent value="security" className="space-y-4">
                    {/* Encryptors */}
                    {design.encryptors && design.encryptors.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Encryption</h3>
                            {design.encryptors.map((enc) => (
                                <Card key={enc.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Shield className="h-4 w-4" />
                                            {enc.name}
                                        </CardTitle>
                                        <CardDescription>{enc.type}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-sm">
                                        {enc.keyAlias && <div>Key Alias: {enc.keyAlias}</div>}
                                        {enc.algorithm && <div>Algorithm: {enc.algorithm}</div>}
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    )}

                    {/* Decryptors */}
                    {design.decryptors && design.decryptors.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-4">Decryption</h3>
                            {design.decryptors.map((dec) => (
                                <Card key={dec.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base">{dec.name}</CardTitle>
                                        <CardDescription>{dec.type}</CardDescription>
                                    </CardHeader>
                                </Card>
                            ))}
                        </>
                    )}

                    {/* Signers */}
                    {design.signers && design.signers.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-4">Signing</h3>
                            {design.signers.map((sig) => (
                                <Card key={sig.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base">{sig.name}</CardTitle>
                                        <CardDescription>{sig.type}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-sm">
                                        {sig.keyAlias && <div>Key Alias: {sig.keyAlias}</div>}
                                        {sig.signatureAlgorithm && <div>Algorithm: {sig.signatureAlgorithm}</div>}
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    )}

                    {/* Verifiers */}
                    {design.verifiers && design.verifiers.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-4">Verification</h3>
                            {design.verifiers.map((ver) => (
                                <Card key={ver.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base">{ver.name}</CardTitle>
                                        <CardDescription>{ver.type}</CardDescription>
                                    </CardHeader>
                                </Card>
                            ))}
                        </>
                    )}

                    {/* Data Stores */}
                    {design.dataStores && design.dataStores.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-4">Data Stores</h3>
                            {design.dataStores.map((ds) => (
                                <Card key={ds.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base">{ds.name}</CardTitle>
                                        <CardDescription>{ds.operation} - {ds.dataStoreName}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-sm">
                                        <div>Visibility: {ds.visibility}</div>
                                        {ds.retentionPeriod && <div>Retention: {ds.retentionPeriod} days</div>}
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    )}

                    {(!design.encryptors?.length && !design.decryptors?.length &&
                        !design.signers?.length && !design.verifiers?.length && !design.dataStores?.length) && (
                            <Card>
                                <CardContent className="pt-6 text-center text-muted-foreground">
                                    No security or persistence components in this integration
                                </CardContent>
                            </Card>
                        )}
                </TabsContent>

                <TabsContent value="errors" className="space-y-4">
                    {/* Exception Subprocesses */}
                    {design.exceptionSubprocesses && design.exceptionSubprocesses.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Exception Subprocesses</h3>
                            {design.exceptionSubprocesses.map((esp) => (
                                <Card key={esp.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Shield className="h-4 w-4" />
                                            {esp.name}
                                        </CardTitle>
                                        <CardDescription>Trigger: {esp.triggerType}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="text-sm">
                                        {esp.sendToDeadLetter && (
                                            <Badge variant="secondary">Sends to Dead Letter</Badge>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    )}

                    {/* Error Handlers */}
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-4">Error Handlers</h3>
                    {(design.errorHandlers?.length ?? 0) === 0 ? (
                        <Card>
                            <CardContent className="pt-6 text-center text-muted-foreground">
                                No custom error handlers defined
                            </CardContent>
                        </Card>
                    ) : (
                        design.errorHandlers?.map((handler) => (
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
                                    {handler.deadLetterChannel?.enabled && (
                                        <div>
                                            <Badge variant="outline">Dead Letter Channel Enabled</Badge>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
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
                                {(design.performanceNotes?.length ?? 0) === 0 ? (
                                    <li className="text-sm text-muted-foreground">No specific performance recommendations</li>
                                ) : (
                                    design.performanceNotes?.map((note, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                            <span className="text-sm">{note}</span>
                                        </li>
                                    ))
                                )}
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
                                    {design.securityNotes?.map((note, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
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