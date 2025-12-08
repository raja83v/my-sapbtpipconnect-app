"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    CheckCircle2,
    AlertCircle,
    Loader2,
    Package,
    Upload,
    Rocket,
    ExternalLink,
    Home,
    FileCode,
    Copy,
    Check,
    Download,
    FileArchive
} from "lucide-react";
import Link from "next/link";
import JSZip from "jszip";
import type { CreationResult, IFlowDesign } from "../types";

// Extended type to include generated XML and design
interface CreationResultWithXML extends CreationResult {
    generatedXML?: string;
    design?: IFlowDesign;
}

interface CreationProgressProps {
    result?: CreationResultWithXML;
    onReset: () => void;
}

type CreationStep = {
    id: string;
    label: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    message?: string;
};

export function CreationProgress({ result, onReset }: CreationProgressProps) {
    const [steps, setSteps] = useState<CreationStep[]>([
        { id: 'package', label: 'Creating/Verifying Package', status: 'pending' },
        { id: 'bpmn', label: 'Generating BPMN2 XML', status: 'pending' },
        { id: 'upload', label: 'Uploading iFlow to SAP CPI', status: 'pending' },
        { id: 'deploy', label: 'Deploying to Runtime', status: 'pending' },
    ]);

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [copied, setCopied] = useState(false);

    const handleCopyXML = () => {
        if (result?.generatedXML) {
            navigator.clipboard.writeText(result.generatedXML);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDownloadXML = () => {
        if (result?.generatedXML) {
            const blob = new Blob([result.generatedXML], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${result.iflowId || 'iflow'}.bpmn2.xml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const handleDownloadZIP = async () => {
        if (!result?.generatedXML || !result?.design) return;

        try {
            const zip = new JSZip();
            const iflowId = result.iflowId || 'iflow';
            const iflowName = result.design.metadata.name || iflowId;

            // Create the iFlow folder structure
            const iflowFolder = zip.folder(iflowId);
            if (!iflowFolder) return;

            // Add META-INF folder with MANIFEST.MF
            const metaInfFolder = iflowFolder.folder('META-INF');
            if (metaInfFolder) {
                const manifest = `Manifest-Version: 1.0
Bundle-SymbolicName: ${iflowId}
Bundle-Name: ${iflowName}
Bundle-Version: 1.0.0
Bundle-ManifestVersion: 2
Import-Package: com.sap.esb.application.services.cxf.interceptor,
 com.sap.esb.security,
 com.sap.it.op.agent.api,
 com.sap.it.op.agent.collector.camel,
 com.sap.it.op.agent.collector.cxf,
 com.sap.it.op.agent.mpl,
 javax.jms,
 javax.jws,
 javax.wsdl,
 javax.xml.bind.annotation,
 javax.xml.namespace,
 javax.xml.ws,
 org.apache.camel;version="2.8",
 org.apache.camel.builder;version="2.8",
 org.apache.camel.builder.xml;version="2.8",
 org.apache.camel.component;version="2.8",
 org.apache.camel.processor;version="2.8",
 org.apache.camel.processor.aggregate;version="2.8",
 org.apache.commons.logging,
 org.osgi.framework;version="1.3.0",
 org.osgi.service.blueprint;version="[1.0.0,2.0.0)",
 org.slf4j;version="1.6",
 org.springframework.osgi.context.support;version="1.2.1"
`;
                metaInfFolder.file('MANIFEST.MF', manifest);
            }

            // Add src/main/resources folder with BPMN2 XML
            const srcFolder = iflowFolder.folder('src');
            const mainFolder = srcFolder?.folder('main');
            const resourcesFolder = mainFolder?.folder('resources');

            if (resourcesFolder) {
                // Add the BPMN2 XML file
                resourcesFolder.file(`${iflowId}.bpmn`, result.generatedXML);

                // Add script files if any
                if (result.design.scripts && result.design.scripts.length > 0) {
                    const scriptsFolder = resourcesFolder.folder('script');
                    if (scriptsFolder) {
                        result.design.scripts.forEach(script => {
                            if (script.scriptContent) {
                                // Extract filename from path
                                const filename = script.scriptPath.split('/').pop() || `${script.id}.groovy`;
                                scriptsFolder.file(filename, script.scriptContent);
                            }
                        });
                    }
                }

                // Add parameters.prop file
                const parameters = `#
#${new Date().toISOString()}
`;
                resourcesFolder.file('parameters.prop', parameters);
            }

            // Generate the ZIP file
            const zipBlob = await zip.generateAsync({ type: 'blob' });

            // Download the ZIP
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${iflowId}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error creating ZIP:', error);
        }
    };

    useEffect(() => {
        if (!result) {
            // Simulate progress during creation
            const interval = setInterval(() => {
                setCurrentStepIndex((prev) => {
                    if (prev < steps.length - 1) {
                        // Update previous step to completed
                        setSteps((prevSteps) => {
                            const newSteps = [...prevSteps];
                            if (prev > 0) {
                                newSteps[prev - 1].status = 'completed';
                            }
                            newSteps[prev].status = 'in-progress';
                            return newSteps;
                        });
                        setProgress(((prev + 1) / steps.length) * 100);
                        return prev + 1;
                    }
                    return prev;
                });
            }, 2000); // 2 seconds per step

            return () => clearInterval(interval);
        } else {
            // When result is available, mark steps based on what actually succeeded
            setSteps((prevSteps) => {
                const newSteps = [...prevSteps];

                if (result.success) {
                    // All steps completed successfully
                    newSteps.forEach(step => {
                        step.status = 'completed';
                    });
                } else {
                    // Determine which step failed based on error message
                    const errorMsg = result.errors?.[0] || '';
                    let failedStepIndex = -1;

                    if (errorMsg.includes('package')) {
                        failedStepIndex = 0; // Package creation failed
                    } else if (errorMsg.includes('BPMN') || errorMsg.includes('XML')) {
                        failedStepIndex = 1; // BPMN generation failed
                    } else if (errorMsg.includes('upload')) {
                        failedStepIndex = 2; // Upload failed
                    } else if (errorMsg.includes('deploy')) {
                        failedStepIndex = 3; // Deployment failed
                    } else {
                        // Unknown error, mark last step as failed
                        failedStepIndex = newSteps.length - 1;
                    }

                    // Mark steps before the failed one as completed
                    for (let i = 0; i < failedStepIndex; i++) {
                        newSteps[i].status = 'completed';
                    }

                    // Mark the failed step
                    if (failedStepIndex >= 0 && failedStepIndex < newSteps.length) {
                        newSteps[failedStepIndex].status = 'error';
                        newSteps[failedStepIndex].message = errorMsg;
                    }

                    // Mark remaining steps as pending
                    for (let i = failedStepIndex + 1; i < newSteps.length; i++) {
                        newSteps[i].status = 'pending';
                    }
                }

                return newSteps;
            });
            setProgress(100);
        }
    }, [result]);

    const isComplete = result !== undefined;
    const isSuccess = result?.success === true;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold">
                    {!isComplete ? 'Creating iFlow...' : isSuccess ? 'iFlow Created Successfully!' : 'Creation Failed'}
                </h2>
                <p className="text-muted-foreground mt-1">
                    {!isComplete
                        ? 'Please wait while we create your integration flow in SAP CPI'
                        : isSuccess
                            ? 'Your iFlow has been created and deployed to SAP CPI'
                            : 'There was an error creating your iFlow'
                    }
                </p>
            </div>

            {/* Progress Bar */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Creation Progress</CardTitle>
                    <CardDescription>
                        {isComplete
                            ? isSuccess ? 'All steps completed' : 'Process interrupted'
                            : `Step ${currentStepIndex + 1} of ${steps.length}`
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Progress value={progress} className="h-2" />

                    {/* Step List */}
                    <div className="space-y-3">
                        {steps.map((step, index) => (
                            <div key={step.id} className="flex items-center gap-3">
                                {step.status === 'completed' && (
                                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                )}
                                {step.status === 'in-progress' && (
                                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0" />
                                )}
                                {step.status === 'pending' && (
                                    <div className="h-5 w-5 rounded-full border-2 border-muted flex-shrink-0" />
                                )}
                                {step.status === 'error' && (
                                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                                )}
                                <div className="flex-1">
                                    <p className={`text-sm font-medium ${step.status === 'completed' ? 'text-green-600' :
                                        step.status === 'in-progress' ? 'text-blue-600' :
                                            step.status === 'error' ? 'text-red-600' :
                                                'text-muted-foreground'
                                        }`}>
                                        {step.label}
                                    </p>
                                    {step.message && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {step.message}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Download Options */}
            {result?.generatedXML && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Download className="h-5 w-5" />
                            Download iFlow
                        </CardTitle>
                        <CardDescription>
                            Download the generated iFlow as a ZIP package or view the BPMN2 XML
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button
                            variant="default"
                            className="w-full"
                            onClick={handleDownloadZIP}
                        >
                            <FileArchive className="mr-2 h-4 w-4" />
                            Download ZIP Package
                        </Button>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    <FileCode className="mr-2 h-4 w-4" />
                                    View Generated XML
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                                <DialogHeader className="flex-shrink-0">
                                    <DialogTitle>Generated BPMN2 XML</DialogTitle>
                                    <DialogDescription>
                                        This is the BPMN2 XML that was generated from your iFlow design
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="flex-1 min-h-0 space-y-4">
                                    <div className="flex justify-between items-center flex-shrink-0">
                                        <Badge variant="outline">
                                            {result.generatedXML.length.toLocaleString()} characters
                                        </Badge>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleCopyXML}
                                            >
                                                {copied ? (
                                                    <>
                                                        <Check className="mr-2 h-4 w-4" />
                                                        Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="mr-2 h-4 w-4" />
                                                        Copy
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleDownloadXML}
                                            >
                                                <Download className="mr-2 h-4 w-4" />
                                                XML
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-hidden rounded-lg border bg-muted">
                                        <pre className="h-full max-h-[50vh] overflow-auto p-4 text-xs whitespace-pre-wrap break-all">
                                            <code className="block">{result.generatedXML}</code>
                                        </pre>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>
            )}

            {/* Result Details */}
            {isComplete && (
                <>
                    {isSuccess && result ? (
                        <Alert className="border-green-500 bg-green-50">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription>
                                <div className="space-y-2">
                                    <p className="font-semibold text-green-900">
                                        iFlow created successfully!
                                    </p>
                                    <div className="text-sm text-green-800 space-y-1">
                                        <p><strong>iFlow ID:</strong> {result.iflowId}</p>
                                        <p><strong>Package ID:</strong> {result.packageId}</p>
                                        {result.deploymentUrl && (
                                            <p className="flex items-center gap-2">
                                                <strong>Deployment URL:</strong>
                                                <a
                                                    href={result.deploymentUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                                                >
                                                    View in SAP CPI
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                <div className="space-y-2">
                                    <p className="font-semibold">
                                        Failed to create iFlow
                                    </p>
                                    {result?.errors && result.errors.length > 0 && (
                                        <ul className="list-disc list-inside text-sm space-y-1">
                                            {result.errors.map((error, idx) => (
                                                <li key={idx}>{error}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Warnings */}
                    {result?.warnings && result.warnings.length > 0 && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                <p className="font-semibold mb-2">Warnings:</p>
                                <ul className="list-disc list-inside text-sm space-y-1">
                                    {result.warnings.map((warning, idx) => (
                                        <li key={idx}>{warning}</li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Next Steps */}
                    {isSuccess && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Next Steps</CardTitle>
                                <CardDescription>
                                    What would you like to do next?
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button asChild className="w-full">
                                    <Link href={`/dashboard/iflows/${result.iflowId}`}>
                                        <Package className="mr-2 h-4 w-4" />
                                        View iFlow Details
                                    </Link>
                                </Button>
                                <Button asChild variant="outline" className="w-full">
                                    <Link href="/dashboard/iflows">
                                        <Home className="mr-2 h-4 w-4" />
                                        Go to iFlows Dashboard
                                    </Link>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={onReset}
                                >
                                    <Rocket className="mr-2 h-4 w-4" />
                                    Create Another iFlow
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Error Actions */}
                    {!isSuccess && (
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={onReset}
                            >
                                Start Over
                            </Button>
                            <Button asChild className="flex-1">
                                <Link href="/help">
                                    Get Help
                                </Link>
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}