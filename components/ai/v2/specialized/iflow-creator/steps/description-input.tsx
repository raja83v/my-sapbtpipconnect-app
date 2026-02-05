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

// Common iFlow templates - organized by phase
const TEMPLATES: IFlowTemplate[] = [
    // === PHASE 1: BASIC INTEGRATION ===
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
    
    // === PHASE 2: ADVANCED FLOW CONTROL ===
    {
        id: "content-routing",
        name: "Content-Based Routing",
        description: "Route messages based on content conditions",
        category: "orchestration",
        template: "Create an integration flow that receives orders and routes them to different target systems based on order type: B2B orders to EDI gateway, B2C orders to e-commerce system, and internal orders to SAP ERP via IDoc. Use content-based routing with XPath conditions. Include a default route for unrecognized order types with error logging.",
        tags: ["Router", "XPath", "Conditional"],
    },
    {
        id: "multicast-broadcast",
        name: "Multicast Broadcasting",
        description: "Send messages to multiple recipients simultaneously",
        category: "orchestration",
        template: "Create an integration flow that receives inventory updates and broadcasts them to multiple systems in parallel: update the warehouse management system, notify the e-commerce platform, and log to an audit database. Use multicast with parallel processing. Include aggregation to collect responses and create a unified status report.",
        tags: ["Multicast", "Parallel", "Aggregation"],
    },
    {
        id: "batch-splitter",
        name: "Batch Message Splitter",
        description: "Split large batches into individual messages",
        category: "transformation",
        template: "Create an integration flow that receives a batch file containing 10,000+ customer records from SFTP, splits them into individual messages using iterating splitter, enriches each record with data from a REST API, and sends to Salesforce. Use data store to track processing status. Include aggregator to collect results and generate summary report.",
        tags: ["Splitter", "Aggregator", "Batch"],
    },
    {
        id: "idoc-splitter",
        name: "IDoc Batch Processing",
        description: "Process IDoc batches with parallel handling",
        category: "transformation",
        template: "Create an integration flow that receives IDoc batches from SAP ERP, uses IDoc splitter to separate individual IDocs, validates each one, transforms to target format, and sends to the appropriate target system based on IDoc type. Include gather step to consolidate processing results and send acknowledgment back to SAP.",
        tags: ["IDoc", "Splitter", "SAP"],
    },
    
    // === PHASE 3: SECURITY & ENCRYPTION ===
    {
        id: "secure-file-transfer",
        name: "PGP Encrypted File Transfer",
        description: "Secure file exchange with encryption",
        category: "integration",
        template: "Create an integration flow that receives files via SFTP, decrypts them using PGP decryption with the partner's public key, processes the content (validate, transform), encrypts the result using PGP encryption with the recipient's public key, and sends to the target SFTP server. Store the sender's public key in the keystore with alias 'partner_pgp_key'.",
        tags: ["PGP", "Encryption", "SFTP", "Security"],
    },
    {
        id: "pkcs7-signing",
        name: "Document Signing (PKCS7)",
        description: "Sign and verify documents for compliance",
        category: "integration",
        template: "Create an integration flow that receives invoice documents, validates the content, signs the document using PKCS7 signer with our private key (alias: 'company_signing_key'), adds a timestamp, and sends to the tax authority. For incoming responses, verify the signature using PKCS7 verifier. Include certificate chain validation.",
        tags: ["PKCS7", "Signing", "Compliance"],
    },
    {
        id: "xml-signature",
        name: "XML Digital Signature",
        description: "Sign XML documents for B2B exchanges",
        category: "integration",
        template: "Create an integration flow for B2B document exchange that receives XML purchase orders, validates against XSD schema, signs specific elements using XML Digital Signature (enveloped signature, RSA-SHA256 algorithm), and sends via AS2. For incoming documents, verify XML signatures and extract signed content. Store certificates with alias 'b2b_xml_sign'.",
        tags: ["XML Signature", "B2B", "AS2"],
    },
    
    // === PHASE 4: SCHEDULING & PERSISTENCE ===
    {
        id: "scheduled-sync",
        name: "Scheduled Data Synchronization",
        description: "Timer-based periodic data sync",
        category: "integration",
        template: "Create a scheduled integration flow that runs every hour (CRON: 0 0 * * * ?) to synchronize customer master data from SAP S/4HANA to Salesforce. Use data store to track last sync timestamp and only process changed records (delta sync). Include variables to store processing statistics. Send email notification on completion with record counts.",
        tags: ["Timer", "Scheduler", "Data Sync", "CRON"],
    },
    {
        id: "batch-processing",
        name: "Nightly Batch Processing",
        description: "Scheduled batch job with persistence",
        category: "integration",
        template: "Create a scheduled integration flow that runs nightly at 2 AM (CRON: 0 0 2 * * ?) to process pending orders stored in the data store. Read orders with 'Select' operation, process each order (validate, enrich, transform), send to SAP ERP via IDoc, and update the data store entry status to 'processed'. Include exception subprocess to handle failures and move failed records to dead letter data store.",
        tags: ["Batch", "Scheduler", "Data Store", "Nightly"],
    },
    {
        id: "stateful-processing",
        name: "Stateful Message Processing",
        description: "Track processing state with data stores",
        category: "orchestration",
        template: "Create an integration flow for order fulfillment that tracks order state across multiple stages. When an order is received, write it to data store with status 'received'. As it progresses through validation, enrichment, and submission stages, update the status in data store. Use variables to store intermediate results. Provide a separate flow endpoint to query order status from data store.",
        tags: ["Data Store", "Variables", "Stateful"],
    },
    {
        id: "idempotent-processing",
        name: "Idempotent Message Handler",
        description: "Prevent duplicate processing",
        category: "integration",
        template: "Create an integration flow that handles incoming messages idempotently. Extract unique message ID from header or payload, check data store if message was already processed, if yes skip processing and return cached result, if no process the message and store result in data store with the message ID as key. Set retention period to 7 days.",
        tags: ["Idempotent", "Data Store", "Deduplication"],
    },
    
    // === CROSS-CUTTING: MODULAR DESIGN ===
    {
        id: "modular-subprocess",
        name: "Modular Integration (ProcessDirect)",
        description: "Reusable integration modules",
        category: "orchestration",
        template: "Create a main integration flow that orchestrates customer order processing by calling reusable sub-flows via ProcessDirect adapter. The main flow receives orders and calls: 1) '/validateOrder' subprocess for validation, 2) '/enrichCustomer' subprocess to add customer details, 3) '/transformToIDoc' subprocess for format conversion. Each subprocess is a separate iFlow callable via ProcessDirect, enabling reuse across multiple integrations.",
        tags: ["ProcessDirect", "Modular", "Subprocess", "Reusable"],
    },
    {
        id: "edi-processing",
        name: "EDI Document Processing",
        description: "Process EDI documents (X12, EDIFACT)",
        category: "transformation",
        template: "Create an integration flow that receives EDI documents via AS2, validates the structure, uses EDI to XML converter to transform to internal format, and routes to target systems based on document type using content-based router. Include EDI acknowledgment (997/CONTRL) generation and send via AS2. Store original EDI in data store for audit.",
        tags: ["EDI", "AS2", "Converter", "Routing"],
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
        id: "event-driven",
        name: "Event-Driven Integration",
        description: "Process events from message queue",
        category: "integration",
        template: "Create an integration flow that consumes events from Kafka topic, deserializes JSON payloads, routes based on event type using content-based router, and triggers appropriate actions in target systems. Use data store to track event processing for exactly-once semantics. Include exception subprocess with dead letter handling to Kafka DLQ topic.",
        tags: ["Kafka", "Events", "Router", "Dead Letter"],
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
                <CardContent className="space-y-3 text-sm">
                    <div>
                        <p className="font-medium text-foreground mb-1">Basic Integration</p>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                            <li>Specify source and target systems clearly</li>
                            <li>Mention data formats (JSON, XML, CSV, EDI)</li>
                            <li>Include error handling requirements</li>
                        </ul>
                    </div>
                    <div>
                        <p className="font-medium text-foreground mb-1">Flow Control</p>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                            <li>Use &quot;route based on&quot; for content-based routing</li>
                            <li>Mention &quot;parallel&quot; or &quot;multicast&quot; for broadcasting</li>
                            <li>Say &quot;split&quot; or &quot;batch&quot; for message splitting</li>
                        </ul>
                    </div>
                    <div>
                        <p className="font-medium text-foreground mb-1">Security</p>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                            <li>Mention &quot;PGP encrypt/decrypt&quot; for file encryption</li>
                            <li>Say &quot;sign&quot; or &quot;verify&quot; for document signing</li>
                            <li>Include key alias names if known</li>
                        </ul>
                    </div>
                    <div>
                        <p className="font-medium text-foreground mb-1">Scheduling & Persistence</p>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                            <li>Specify schedule (e.g., &quot;every hour&quot;, &quot;nightly at 2 AM&quot;)</li>
                            <li>Use &quot;data store&quot; for stateful processing</li>
                            <li>Mention &quot;idempotent&quot; for duplicate prevention</li>
                        </ul>
                    </div>
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