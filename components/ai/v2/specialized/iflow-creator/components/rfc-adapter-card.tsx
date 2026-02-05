"use client";

/**
 * RFC Adapter Configuration Card
 * Displays and allows editing of RFC adapter settings for SAP ERP integration
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { ChevronDown, Server, Settings2, ArrowRightLeft } from "lucide-react";
import { RFCAdapterConfig } from "../types";

interface RFCAdapterCardProps {
    adapter: Partial<RFCAdapterConfig>;
    onChange: (updates: Partial<RFCAdapterConfig>) => void;
    readOnly?: boolean;
}

export function RFCAdapterCard({ adapter, onChange, readOnly = false }: RFCAdapterCardProps) {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <Card className="border-orange-500/50">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="pb-3">
                    <CollapsibleTrigger className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-500/10">
                                <ArrowRightLeft className="h-5 w-5 text-orange-500" />
                            </div>
                            <div className="text-left">
                                <CardTitle className="text-base">
                                    {adapter.name || "RFC Adapter"}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    SAP Function Module Call
                                </p>
                            </div>
                            <Badge variant="outline" className="ml-2">
                                Receiver
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
                                <Server className="h-4 w-4" />
                                Connection Settings
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="rfcDestination">Cloud Connector Destination</Label>
                                    <Input
                                        id="rfcDestination"
                                        placeholder="e.g., SAP_ECC_RFC"
                                        value={adapter.rfcDestination || ""}
                                        onChange={(e) => onChange({ rfcDestination: e.target.value })}
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

                                <div className="space-y-2">
                                    <Label htmlFor="sapLanguage">Language</Label>
                                    <Select
                                        value={adapter.sapLanguage || "EN"}
                                        onValueChange={(value) => onChange({ sapLanguage: value })}
                                        disabled={readOnly}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select language" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="EN">English (EN)</SelectItem>
                                            <SelectItem value="DE">German (DE)</SelectItem>
                                            <SelectItem value="FR">French (FR)</SelectItem>
                                            <SelectItem value="ES">Spanish (ES)</SelectItem>
                                            <SelectItem value="JA">Japanese (JA)</SelectItem>
                                            <SelectItem value="ZH">Chinese (ZH)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="timeout">Timeout (ms)</Label>
                                    <Input
                                        id="timeout"
                                        type="number"
                                        placeholder="60000"
                                        value={adapter.timeout || ""}
                                        onChange={(e) => onChange({ timeout: parseInt(e.target.value) })}
                                        disabled={readOnly}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Function Module Settings */}
                        <div className="space-y-3 pt-2 border-t">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Settings2 className="h-4 w-4" />
                                Function Module
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="functionModule">Function Module Name</Label>
                                <Input
                                    id="functionModule"
                                    placeholder="e.g., BAPI_MATERIAL_GETDETAIL"
                                    value={adapter.functionModule || ""}
                                    onChange={(e) => onChange({ functionModule: e.target.value })}
                                    disabled={readOnly}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Common: BAPI_SALESORDER_CREATEFROMDAT2, RFC_READ_TABLE, BAPI_MATERIAL_GETLIST
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="rfcType">RFC Type</Label>
                                    <Select
                                        value={adapter.rfcType || "synchronous"}
                                        onValueChange={(value: any) => onChange({ rfcType: value })}
                                        disabled={readOnly}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="synchronous">Synchronous</SelectItem>
                                            <SelectItem value="transactional">Transactional (tRFC)</SelectItem>
                                            <SelectItem value="queued">Queued (qRFC)</SelectItem>
                                            <SelectItem value="background">Background</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between space-x-2 pt-6">
                                    <Label htmlFor="transactionCommit">Transaction Commit</Label>
                                    <Switch
                                        id="transactionCommit"
                                        checked={adapter.transactionCommit || false}
                                        onCheckedChange={(checked) => onChange({ transactionCommit: checked })}
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

export default RFCAdapterCard;
