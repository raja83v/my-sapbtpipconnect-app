"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IFlowDescription, IFlowTemplate } from "../types";
import {
    Lightbulb,
    ArrowLeft,
    Sparkles,
    FileText,
    Database,
    Cloud,
    Workflow
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface DescriptionInputStepProps {
    value?: IFlowDescription;
    onChange: (description: IFlowDescription) => void;
    onNext: () => void;
    onBack: () => void;
}

// Common iFlow templates
const TEMPLATES: IFlowTemplate[] = [
    {
        id: "soap-to-rest",
        name: "SOAP to REST Conversion",
        description: "Convert SOAP web service calls to REST API calls",
        category: "integration",
        template: "Create an integration flow that receives SOAP requests, transforms the data, and forwards it to a REST API endpoint. Include error handling and response mapping.",
        tags: ["SOAP", "REST", "Transformation"],
    },
    {
        id: "file-to-database",
        name: "File to Database",
        description: "Process files and insert data into database",
        category: "integration",
        template: "Create an integration flow that reads CSV/XML files from SFTP, validates the data, transforms it, and inserts records into a database. Include duplicate checking and error notifications.",
        tags: ["SFTP", "Database", "File Processing"],
    },
    {
        id: "edi-processing",
        name: "EDI Document Processing",
        description: "Process EDI documents (X12, EDIFACT)",
        category: "transformation",
        template: "Create an integration flow that receives EDI documents, validates the structure, transforms to internal format, and routes to target systems based on document type. Include acknowledgment generation.",
        tags: ["EDI", "Validation", "Routing"],
    },
    {
        id: "api-orchestration",
        name: "API Orchestration",
        description: "Orchestrate multiple API calls",
        category: "orchestration",
        template: "Create an integration flow that orchestrates multiple REST API calls in sequence, aggregates responses, and returns a unified result. Include parallel processing where possible and comprehensive error handling.",
        tags: ["REST", "Orchestration", "Aggregation"],
    },
    {
        id: "data-sync",
        name: "Data Synchronization",
        description: "Sync data between two systems",
        category: "integration",
        template: "Create an integration flow that synchronizes data between two systems in real-time. Include change detection, conflict resolution, and bidirectional sync capabilities.",
        tags: ["Sync", "Real-time", "Bidirectional"],
    },
    {
        id: "event-driven",
        name: "Event-Driven Integration",
        description: "Process events from message queue",
        category: "integration",
        template: "Create an integration flow that consumes events from a message queue, processes them based on event type, and triggers appropriate actions in target systems. Include retry logic and dead letter handling.",
        tags: ["Events", "Queue", "Async"],
    },
];

export function DescriptionInputStep({
    value,
    onChange,
    onNext,
    onBack,
}: DescriptionInputStepProps) {
    const [description, setDescription] = useState(value?.description || "");
    const [sourceSystem, setSourceSystem] = useState(value?.sourceSystem || "");
    const [targetSystem, setTargetSystem] = useState(value?.targetSystem || "");
    const [dataFormat, setDataFormat] = useState(value?.dataFormat || "");
    const [requirements, setRequirements] = useState<string[]>(value?.requirements || []);
    const [newRequirement, setNewRequirement] = useState("");
    const [showTemplates, setShowTemplates] = useState(false);

    // Update parent state
    useEffect(() => {
        onChange({
            description,
            sourceSystem: sourceSystem || undefined,
            targetSystem: targetSystem || undefined,
            dataFormat: dataFormat || undefined,
            requirements: requirements.length > 0 ? requirements : undefined,
        });
    }, [description, sourceSystem, targetSystem, dataFormat, requirements]);

    const handleAddRequirement = () => {
        if (newRequirement.trim()) {
            setRequirements([...requirements, newRequirement.trim()]);
            setNewRequirement("");
        }
    };

    const handleRemoveRequirement = (index: number) => {
        setRequirements(requirements.filter((_, i) => i !== index));
    };

    const handleUseTemplate = (template: IFlowTemplate) => {
        setDescription(template.template);
        setShowTemplates(false);
    };

    // Validation
    const isValid = description.trim().length >= 100;
    const charCount = description.length;
    const minChars = 100;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Describe Your Integration Flow</h2>
                    <p className="text-muted-foreground mt-2">
                        Provide details about what you want to build
                    </p>
                </div>
                <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Lightbulb className="h-4 w-4 mr-2" />
                            Use Template
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Choose a Template</DialogTitle>
                            <DialogDescription>
                                Start with a pre-built template for common integration patterns
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            {TEMPLATES.map((template) => (
                                <Card
                                    key={template.id}
                                    className="cursor-pointer hover:border-primary transition-colors"
                                    onClick={() => handleUseTemplate(template)}
                                >
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                {template.category === 'integration' && <Cloud className="h-5 w-5 text-blue-500" />}
                                                {template.category === 'transformation' && <Workflow className="h-5 w-5 text-purple-500" />}
                                                {template.category === 'orchestration' && <Database className="h-5 w-5 text-green-500" />}
                                                <CardTitle className="text-base">{template.name}</CardTitle>
                                            </div>
                                        </div>
                                        <CardDescription className="text-xs">
                                            {template.description}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-1">
                                            {template.tags.map((tag) => (
                                                <Badge key={tag} variant="secondary" className="text-xs">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Integration Flow Description
                    </CardTitle>
                    <CardDescription>
                        Describe what your integration flow should do in natural language
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="description">
                                Description <span className="text-destructive">*</span>
                            </Label>
                            <span className={`text-sm ${charCount >= minChars ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {charCount} / {minChars} characters
                            </span>
                        </div>
                        <Textarea
                            id="description"
                            placeholder="Example: Create an integration flow that receives customer orders via SOAP, validates the order data, enriches it with customer information from a REST API, transforms it to the target format, and sends it to SAP ERP via IDoc. Include error handling for validation failures and retry logic for temporary connection issues."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={8}
                            className="resize-none"
                        />
                        {charCount < minChars && (
                            <p className="text-sm text-muted-foreground">
                                Please provide at least {minChars} characters for better AI analysis
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="sourceSystem">Source System (Optional)</Label>
                            <Input
                                id="sourceSystem"
                                placeholder="e.g., Salesforce, SAP"
                                value={sourceSystem}
                                onChange={(e) => setSourceSystem(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="targetSystem">Target System (Optional)</Label>
                            <Input
                                id="targetSystem"
                                placeholder="e.g., SAP ERP, Database"
                                value={targetSystem}
                                onChange={(e) => setTargetSystem(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dataFormat">Data Format (Optional)</Label>
                            <Input
                                id="dataFormat"
                                placeholder="e.g., JSON, XML, CSV"
                                value={dataFormat}
                                onChange={(e) => setDataFormat(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="requirements">Additional Requirements (Optional)</Label>
                        <div className="flex gap-2">
                            <Input
                                id="requirements"
                                placeholder="Add a requirement and press Enter"
                                value={newRequirement}
                                onChange={(e) => setNewRequirement(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddRequirement();
                                    }
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleAddRequirement}
                                disabled={!newRequirement.trim()}
                            >
                                Add
                            </Button>
                        </div>
                        {requirements.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {requirements.map((req, index) => (
                                    <Badge
                                        key={index}
                                        variant="secondary"
                                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                        onClick={() => handleRemoveRequirement(index)}
                                    >
                                        {req} ×
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        Tips for Better Results
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li>Be specific about source and target systems</li>
                        <li>Mention data formats (JSON, XML, CSV, etc.)</li>
                        <li>Include error handling requirements</li>
                        <li>Specify any performance needs (timeouts, batch sizes)</li>
                        <li>Mention security requirements (authentication, encryption)</li>
                    </ul>
                </CardContent>
            </Card>

            <div className="flex justify-between">
                <Button
                    variant="outline"
                    onClick={onBack}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Package Selection
                </Button>
                <Button
                    onClick={onNext}
                    disabled={!isValid}
                    size="lg"
                >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Design with AI
                </Button>
            </div>
        </div>
    );
}