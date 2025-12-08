"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  IconRefresh,
  IconPlugConnected,
  IconTransform,
  IconCode,
  IconAlertTriangle,
  IconSettings,
  IconArrowRight,
  IconArrowLeft,
  IconCloud,
  IconDatabase,
  IconFileText,
  IconApi,
} from "@tabler/icons-react";
import { IFlowDetailData, AdapterConfig, MappingConfig, ScriptConfig } from "@/app/actions/iflows";

interface IFlowConfigurationTabProps {
  iflow: IFlowDetailData;
  onRefresh: () => void;
}

export function IFlowConfigurationTab({ iflow, onRefresh }: IFlowConfigurationTabProps) {
  const config = iflow.configuration;

  if (!config) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-12">
            <IconSettings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Configuration Not Available</h3>
            <p className="text-muted-foreground mb-4">
              Unable to fetch iFlow configuration from SAP CPI. 
              This may happen if the iFlow is not deployed or credentials need to be refreshed.
            </p>
            <Button onClick={onRefresh} variant="outline">
              <IconRefresh className="h-4 w-4 mr-2" />
              Refresh Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const senderAdapters = config.adapters.filter(a => a.direction === "sender");
  const receiverAdapters = config.adapters.filter(a => a.direction === "receiver");

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Adapters"
          count={config.adapters.length}
          icon={<IconPlugConnected className="h-4 w-4" />}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <SummaryCard
          title="Mappings"
          count={config.mappings.length}
          icon={<IconTransform className="h-4 w-4" />}
          iconBg="bg-green-500/10"
          iconColor="text-green-500"
        />
        <SummaryCard
          title="Scripts"
          count={config.scripts.length}
          icon={<IconCode className="h-4 w-4" />}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-500"
        />
        <SummaryCard
          title="Error Handling"
          count={config.errorHandling?.retryEnabled ? "Enabled" : "Disabled"}
          icon={<IconAlertTriangle className="h-4 w-4" />}
          iconBg="bg-orange-500/10"
          iconColor="text-orange-500"
        />
      </div>

      {/* Adapters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconPlugConnected className="h-5 w-5" />
            Adapters
          </CardTitle>
          <CardDescription>
            Sender and receiver adapter configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {config.adapters.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No adapters configured</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sender Adapters */}
              <div>
                <h4 className="font-medium flex items-center gap-2 mb-3">
                  <IconArrowRight className="h-4 w-4 text-green-500" />
                  Sender Adapters ({senderAdapters.length})
                </h4>
                <div className="space-y-3">
                  {senderAdapters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sender adapters</p>
                  ) : (
                    senderAdapters.map((adapter) => (
                      <AdapterCard key={adapter.id} adapter={adapter} />
                    ))
                  )}
                </div>
              </div>

              {/* Receiver Adapters */}
              <div>
                <h4 className="font-medium flex items-center gap-2 mb-3">
                  <IconArrowLeft className="h-4 w-4 text-blue-500" />
                  Receiver Adapters ({receiverAdapters.length})
                </h4>
                <div className="space-y-3">
                  {receiverAdapters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No receiver adapters</p>
                  ) : (
                    receiverAdapters.map((adapter) => (
                      <AdapterCard key={adapter.id} adapter={adapter} />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mappings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconTransform className="h-5 w-5" />
            Mappings
          </CardTitle>
          <CardDescription>
            Message transformation configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {config.mappings.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No mappings configured</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {config.mappings.map((mapping, index) => (
                <AccordionItem key={mapping.id} value={mapping.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{mapping.type}</Badge>
                      <span className="font-medium">{mapping.id}</span>
                      {mapping.complexity && (
                        <ComplexityBadge complexity={mapping.complexity} />
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {mapping.source && (
                        <div className="flex items-start gap-2">
                          <span className="text-sm text-muted-foreground min-w-20">Source:</span>
                          <code className="text-sm bg-secondary px-2 py-1 rounded break-all">
                            {mapping.source}
                          </code>
                        </div>
                      )}
                      {mapping.target && (
                        <div className="flex items-start gap-2">
                          <span className="text-sm text-muted-foreground min-w-20">Target:</span>
                          <code className="text-sm bg-secondary px-2 py-1 rounded break-all">
                            {mapping.target}
                          </code>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Scripts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCode className="h-5 w-5" />
            Scripts
          </CardTitle>
          <CardDescription>
            Custom script configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {config.scripts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No scripts configured</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {config.scripts.map((script) => (
                <ScriptCard key={script.id} script={script} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Handling */}
      {config.errorHandling && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5" />
              Error Handling
            </CardTitle>
            <CardDescription>
              Error handling and retry configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">Retry Enabled</p>
                <p className="text-lg font-semibold">
                  {config.errorHandling.retryEnabled ? "Yes" : "No"}
                </p>
              </div>
              {config.errorHandling.maxRetries !== undefined && (
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Max Retries</p>
                  <p className="text-lg font-semibold">{config.errorHandling.maxRetries}</p>
                </div>
              )}
              {config.errorHandling.retryInterval !== undefined && (
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Retry Interval</p>
                  <p className="text-lg font-semibold">{config.errorHandling.retryInterval}ms</p>
                </div>
              )}
              {config.errorHandling.errorHandlerType && (
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Handler Type</p>
                  <p className="text-lg font-semibold">{config.errorHandling.errorHandlerType}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resources */}
      {config.resources && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconCloud className="h-5 w-5" />
              Resources
            </CardTitle>
            <CardDescription>
              Resource allocation and limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {config.resources.memoryLimit && (
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Memory Limit</p>
                  <p className="text-lg font-semibold">{config.resources.memoryLimit}</p>
                </div>
              )}
              {config.resources.cpuLimit && (
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">CPU Limit</p>
                  <p className="text-lg font-semibold">{config.resources.cpuLimit}</p>
                </div>
              )}
              {config.resources.timeout !== undefined && (
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Timeout</p>
                  <p className="text-lg font-semibold">{config.resources.timeout}ms</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper Components

interface SummaryCardProps {
  title: string;
  count: number | string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

function SummaryCard({ title, count, icon, iconBg, iconColor }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconBg}`}>
            <div className={iconColor}>{icon}</div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-xl font-bold">{count}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdapterCard({ adapter }: { adapter: AdapterConfig }) {
  const getAdapterIcon = (type: string) => {
    const typeLower = type.toLowerCase();
    if (typeLower.includes("http") || typeLower.includes("rest")) {
      return <IconApi className="h-4 w-4" />;
    }
    if (typeLower.includes("odata") || typeLower.includes("soap")) {
      return <IconCloud className="h-4 w-4" />;
    }
    if (typeLower.includes("sftp") || typeLower.includes("file")) {
      return <IconFileText className="h-4 w-4" />;
    }
    if (typeLower.includes("jdbc") || typeLower.includes("database")) {
      return <IconDatabase className="h-4 w-4" />;
    }
    return <IconPlugConnected className="h-4 w-4" />;
  };

  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-secondary">
          {getAdapterIcon(adapter.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              {adapter.type}
            </Badge>
          </div>
          <p className="text-sm font-medium truncate">{adapter.id}</p>
          {adapter.address && (
            <p className="text-xs text-muted-foreground truncate mt-1">
              {adapter.address}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ScriptCard({ script }: { script: ScriptConfig }) {
  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-purple-500/10">
          <IconCode className="h-4 w-4 text-purple-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">
              {script.type}
            </Badge>
            {script.complexity && (
              <ComplexityBadge complexity={script.complexity} />
            )}
          </div>
          <p className="text-sm font-medium truncate">{script.name}</p>
          {script.linesOfCode !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              {script.linesOfCode} lines
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ComplexityBadge({ complexity }: { complexity: "simple" | "medium" | "complex" }) {
  const colors = {
    simple: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    complex: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[complexity]}`}>
      {complexity}
    </span>
  );
}
