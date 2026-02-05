"use client";

/**
 * IDoc Adapter Configuration Card
 * Displays and allows editing of IDoc adapter settings for SAP EDI/B2B integration
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
import { Switch } from "@/components/ui/switch";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, FileJson, Users, Settings2 } from "lucide-react";
import { IDocAdapterConfig } from "../types";

interface IDocAdapterCardProps {
    adapter: Partial<IDocAdapterConfig>;
    onChange: (updates: Partial<IDocAdapterConfig>) => void;
    readOnly?: boolean;
}

// Common IDoc types with descriptions
const IDOC_TYPES = [
    { value: "ORDERS05", label: "ORDERS05 - Purchase Orders" },
    { value: "INVOIC02", label: "INVOIC02 - Invoices" },
    { value: "MATMAS05", label: "MATMAS05 - Material Master" },
    { value: "DEBMAS06", label: "DEBMAS06 - Customer Master" },
    { value: "CREMAS05", label: "CREMAS05 - Vendor Master" },
    { value: "DESADV01", label: "DESADV01 - Delivery Notification" },
    { value: "SHPMNT05", label: "SHPMNT05 - Shipment" },
    { value: "PORDCR05", label: "PORDCR05 - Purchase Requisition" },
];

export function IDocAdapterCard({ adapter, onChange, readOnly = false }: IDocAdapterCardProps) {
    const [isOpen, setIsOpen] = useState(true);
    const isSender = adapter.direction === "Sender";

    return (
        <Card className="border-purple-500/50">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="pb-3">
                    <CollapsibleTrigger className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                                <FileJson className="h-5 w-5 text-purple-500" />
                            </div>
                            <div className="text-left">
                                <CardTitle className="text-base">
                                    {adapter.name || "IDoc Adapter"}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    SAP EDI/B2B Document Exchange
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
                        {/* IDoc Settings */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <FileJson className="h-4 w-4" />
                                IDoc Configuration
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="idocType">IDoc Type</Label>
                                    <Select
                                        value={adapter.idocType || ""}
                                        onValueChange={(value) => onChange({ idocType: value })}
                                        disabled={readOnly}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select IDoc type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {IDOC_TYPES.map((type) => (
                                                <SelectItem key={type.value} value={type.value}>
                                                    {type.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="messageType">Message Type</Label>
                                    <Input
                                        id="messageType"
                                        placeholder="e.g., ORDERS, INVOIC"
                                        value={adapter.messageType || ""}
                                        onChange={(e) => onChange({ messageType: e.target.value })}
                                        disabled={readOnly}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="idocDestination">Cloud Connector Destination</Label>
                                    <Input
                                        id="idocDestination"
                                        placeholder="e.g., SAP_ECC_IDOC"
                                        value={adapter.idocDestination || ""}
                                        onChange={(e) => onChange({ idocDestination: e.target.value })}
                                        disabled={readOnly}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="sapClient">SAP Client</Label>
                                    <Input
                                        id="sapClient"
                                        placeholder="e.g., 100"
                                        value={adapter.sapClient || ""}
                                        onChange={(e) => onChange({ sapClient: e.target.value })}
                                        disabled={readOnly}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Partner Settings */}
                        <div className="space-y-3 pt-2 border-t">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Users className="h-4 w-4" />
                                Partner Configuration
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="senderPartnerNumber">Sender Partner Number</Label>
                                    <Input
                                        id="senderPartnerNumber"
                                        placeholder="e.g., CPICLIENT"
                                        value={adapter.senderPartnerNumber || ""}
                                        onChange={(e) => onChange({ senderPartnerNumber: e.target.value })}
                                        disabled={readOnly}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="senderPartnerType">Sender Partner Type</Label>
                                    <Select
                                        value={adapter.senderPartnerType || "LS"}
                                        onValueChange={(value: any) => onChange({ senderPartnerType: value })}
                                        disabled={readOnly}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LS">LS - Logical System</SelectItem>
                                            <SelectItem value="KU">KU - Customer</SelectItem>
                                            <SelectItem value="LI">LI - Vendor</SelectItem>
                                            <SelectItem value="US">US - User</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="receiverPartnerNumber">Receiver Partner Number</Label>
                                    <Input
                                        id="receiverPartnerNumber"
                                        placeholder="e.g., SAPCLNT100"
                                        value={adapter.receiverPartnerNumber || ""}
                                        onChange={(e) => onChange({ receiverPartnerNumber: e.target.value })}
                                        disabled={readOnly}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="receiverPartnerType">Receiver Partner Type</Label>
                                    <Select
                                        value={adapter.receiverPartnerType || "LS"}
                                        onValueChange={(value: any) => onChange({ receiverPartnerType: value })}
                                        disabled={readOnly}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LS">LS - Logical System</SelectItem>
                                            <SelectItem value="KU">KU - Customer</SelectItem>
                                            <SelectItem value="LI">LI - Vendor</SelectItem>
                                            <SelectItem value="US">US - User</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Processing Settings */}
                        <div className="space-y-3 pt-2 border-t">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Settings2 className="h-4 w-4" />
                                Processing Settings
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="idocVersion">IDoc Version</Label>
                                    <Select
                                        value={adapter.idocVersion || "4"}
                                        onValueChange={(value: any) => onChange({ idocVersion: value })}
                                        disabled={readOnly}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="3">Version 3</SelectItem>
                                            <SelectItem value="4">Version 4</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="serialization">Serialization</Label>
                                    <Select
                                        value={adapter.serialization || "Asynchronous"}
                                        onValueChange={(value: any) => onChange({ serialization: value })}
                                        disabled={readOnly}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Synchronous">Synchronous</SelectItem>
                                            <SelectItem value="Asynchronous">Asynchronous</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between space-x-2 pt-4">
                                    <Label htmlFor="testMode">Test Mode</Label>
                                    <Switch
                                        id="testMode"
                                        checked={adapter.testMode || false}
                                        onCheckedChange={(checked) => onChange({ testMode: checked })}
                                        disabled={readOnly}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}

export default IDocAdapterCard;
