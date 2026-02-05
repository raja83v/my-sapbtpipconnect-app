"use client";

/**
 * XI Adapter Configuration Card
 * Displays and allows editing of XI adapter settings for SAP PI/PO integration
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Layers, Network, Settings2 } from "lucide-react";
import { XIAdapterConfig } from "../types";

interface XIAdapterCardProps {
    adapter: Partial<XIAdapterConfig>;
    onChange: (updates: Partial<XIAdapterConfig>) => void;
    readOnly?: boolean;
}

export function XIAdapterCard({ adapter, onChange, readOnly = false }: XIAdapterCardProps) {
    const [isOpen, setIsOpen] = useState(true);
    const isSender = adapter.direction === "Sender";

    return (
        <Card className="border-teal-500/50">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="pb-3">
                    <CollapsibleTrigger className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-teal-500/10">
                                <Layers className="h-5 w-5 text-teal-500" />
                            </div>
                            <div className="text-left">
                                <CardTitle className="text-base">
                                    {adapter.name || "XI Adapter"}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    SAP PI/PO Integration
                                </p>
                            </div>
                            <Badge
                                variant="outline"
                                className={isSender ? "border-green-500 text-green-600" : "border-blue-500 text-blue-600"}
                            >
                                {isSender ? "Sender" : "Receiver"}
                            </Badge>
                        </div>
                        <ChevronDown
                            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                    </CollapsibleTrigger>
                </CardHeader>

                <CollapsibleContent>
                    <CardContent className="space-y-4">
                        {/* Connection Settings */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Network className="h-4 w-4" />
                                XI Connection
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2">
                                    <Label htmlFor="xiUrl">PI/PO System URL</Label>
                                    <Input
                                        id="xiUrl"
                                        placeholder="https://pi-system.company.com:50000"
                                        value={adapter.xiUrl || ""}
                                        onChange={(e) => onChange({ xiUrl: e.target.value })}
                                        disabled={readOnly}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="senderService">Sender Service</Label>
                                    <Input
                                        id="senderService"
                                        placeholder="e.g., CPI_SENDER"
                                        value={adapter.senderService || ""}
                                        onChange={(e) => onChange({ senderService: e.target.value })}
                                        disabled={readOnly}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="senderParty">Sender Party</Label>
                                    <Input
                                        id="senderParty"
                                        placeholder="Optional party"
                                        value={adapter.senderParty || ""}
                                        onChange={(e) => onChange({ senderParty: e.target.value })}
                                        disabled={readOnly}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="receiverService">Receiver Service</Label>
                                    <Input
                                        id="receiverService"
                                        placeholder="e.g., ECC_RECEIVER"
                                        value={adapter.receiverService || ""}
                                        onChange={(e) => onChange({ receiverService: e.target.value })}
                                        disabled={readOnly}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="receiverParty">Receiver Party</Label>
                                    <Input
                                        id="receiverParty"
                                        placeholder="Optional party"
                                        value={adapter.receiverParty || ""}
                                        onChange={(e) => onChange({ receiverParty: e.target.value })}
                                        disabled={readOnly}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Interface Settings */}
                        <div className="space-y-3 pt-2 border-t">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Settings2 className="h-4 w-4" />
                                XI Interface Configuration
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="interfaceNamespace">Interface Namespace</Label>
                                    <Input
                                        id="interfaceNamespace"
                                        placeholder="e.g., urn:sap-com:document:sap:rfc:functions"
                                        value={adapter.interfaceNamespace || ""}
                                        onChange={(e) => onChange({ interfaceNamespace: e.target.value })}
                                        disabled={readOnly}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="interfaceName">Interface Name</Label>
                                        <Input
                                            id="interfaceName"
                                            placeholder="e.g., OrderInterface"
                                            value={adapter.interfaceName || ""}
                                            onChange={(e) => onChange({ interfaceName: e.target.value })}
                                            disabled={readOnly}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="operationName">Operation Name</Label>
                                        <Input
                                            id="operationName"
                                            placeholder="e.g., CreateOrder"
                                            value={adapter.operationName || ""}
                                            onChange={(e) => onChange({ operationName: e.target.value })}
                                            disabled={readOnly}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quality of Service */}
                        <div className="space-y-3 pt-2 border-t">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Layers className="h-4 w-4" />
                                Quality of Service
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="qualityOfService">QoS Level</Label>
                                    <Select
                                        value={adapter.qualityOfService || "ExactlyOnce"}
                                        onValueChange={(value: any) => onChange({ qualityOfService: value })}
                                        disabled={readOnly}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="BestEffort">Best Effort (BE)</SelectItem>
                                            <SelectItem value="ExactlyOnce">Exactly Once (EO)</SelectItem>
                                            <SelectItem value="ExactlyOnceInOrder">Exactly Once In Order (EOIO)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        EO: Guaranteed delivery • EOIO: Ordered delivery • BE: High throughput
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="deliveryAssurance">Delivery Assurance</Label>
                                    <Select
                                        value={adapter.deliveryAssurance || "ExactlyOnce"}
                                        onValueChange={(value: any) => onChange({ deliveryAssurance: value })}
                                        disabled={readOnly}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="AtMostOnce">At Most Once</SelectItem>
                                            <SelectItem value="AtLeastOnce">At Least Once</SelectItem>
                                            <SelectItem value="ExactlyOnce">Exactly Once</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="communicationChannel">Communication Channel</Label>
                                    <Input
                                        id="communicationChannel"
                                        placeholder="Optional channel name"
                                        value={adapter.communicationChannel || ""}
                                        onChange={(e) => onChange({ communicationChannel: e.target.value })}
                                        disabled={readOnly}
                                    />
                                </div>

                                {adapter.qualityOfService === "ExactlyOnceInOrder" && (
                                    <div className="space-y-2">
                                        <Label htmlFor="queueId">Queue ID (for EOIO)</Label>
                                        <Input
                                            id="queueId"
                                            placeholder="e.g., ORDER_QUEUE"
                                            value={adapter.queueId || ""}
                                            onChange={(e) => onChange({ queueId: e.target.value })}
                                            disabled={readOnly}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}

export default XIAdapterCard;
