"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  IconRefresh,
  IconFileCode,
  IconFileText,
  IconFile,
  IconFileZip,
  IconSchema,
  IconTransform,
  IconApi,
  IconBrandJavascript,
  IconBraces,
  IconSettings,
  IconFolder,
  IconEye,
} from "@tabler/icons-react";
import { IFlowDetailData } from "@/app/actions/iflows";
import { ResourceViewer } from "./resource-viewer";
import type { IFlowResource } from "@/lib/sap-cpi/client";

interface IFlowResourcesTabProps {
  iflow: IFlowDetailData;
  onRefresh: () => void;
}

const resourceTypeIcons: Record<string, React.ReactNode> = {
  script: <IconFileCode className="h-4 w-4 text-yellow-500" />,
  xslt: <IconTransform className="h-4 w-4 text-purple-500" />,
  schema: <IconSchema className="h-4 w-4 text-blue-500" />,
  wsdl: <IconApi className="h-4 w-4 text-green-500" />,
  edmx: <IconApi className="h-4 w-4 text-orange-500" />,
  mapping: <IconTransform className="h-4 w-4 text-cyan-500" />,
  manifest: <IconSettings className="h-4 w-4 text-gray-500" />,
  bpmn: <IconFileText className="h-4 w-4 text-indigo-500" />,
  jar: <IconFileZip className="h-4 w-4 text-red-500" />,
  properties: <IconBraces className="h-4 w-4 text-gray-500" />,
  json: <IconBrandJavascript className="h-4 w-4 text-amber-500" />,
  xml: <IconFileText className="h-4 w-4 text-teal-500" />,
  other: <IconFile className="h-4 w-4 text-gray-400" />,
};

const resourceTypeBadgeColors: Record<string, string> = {
  script: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  xslt: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  schema: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  wsdl: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  edmx: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  mapping: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  manifest: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  bpmn: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  jar: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  properties: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  json: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  xml: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function IFlowResourcesTab({ iflow, onRefresh }: IFlowResourcesTabProps) {
  const resources = iflow.configuration?.rawResources || [];
  const [selectedResource, setSelectedResource] = useState<IFlowResource | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const handleResourceClick = useCallback((resource: IFlowResource) => {
    // Binary files can't be viewed
    const binaryTypes = ['jar'];
    if (binaryTypes.includes(resource.type)) return;
    setSelectedResource(resource);
    setViewerOpen(true);
  }, []);

  const isViewable = useCallback((resource: IFlowResource) => {
    return resource.type !== 'jar';
  }, []);

  if (resources.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-12">
            <IconFolder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Resources Available</h3>
            <p className="text-muted-foreground mb-4">
              Unable to fetch iFlow resources from SAP CPI.
              This may happen if the iFlow is not deployed or credentials need to be refreshed.
            </p>
            <Button onClick={onRefresh} variant="outline">
              <IconRefresh className="h-4 w-4 mr-2" />
              Refresh Resources
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group resources by type
  const groupedResources = resources.reduce((acc, resource) => {
    if (!acc[resource.type]) {
      acc[resource.type] = [];
    }
    acc[resource.type].push(resource);
    return acc;
  }, {} as Record<string, typeof resources>);

  // Calculate totals
  const totalSize = resources.reduce((acc, r) => acc + r.size, 0);
  const typeOrder = ['bpmn', 'script', 'mapping', 'xslt', 'schema', 'wsdl', 'edmx', 'jar', 'json', 'xml', 'properties', 'manifest', 'other'];
  const sortedTypes = Object.keys(groupedResources).sort((a, b) => {
    return typeOrder.indexOf(a) - typeOrder.indexOf(b);
  });

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconFolder className="h-5 w-5" />
            Resources Overview
          </CardTitle>
          <CardDescription>
            All resources included in the iFlow package
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{resources.length}</div>
              <div className="text-sm text-muted-foreground">Total Files</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{formatFileSize(totalSize)}</div>
              <div className="text-sm text-muted-foreground">Total Size</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{groupedResources['script']?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Scripts</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{groupedResources['mapping']?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Mappings</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resources by Type */}
      {sortedTypes.map((type) => {
        const typeResources = groupedResources[type];
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
        const typeSize = typeResources.reduce((acc, r) => acc + r.size, 0);

        return (
          <Card key={type}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {resourceTypeIcons[type] || resourceTypeIcons.other}
                  {typeLabel} Files
                  <Badge variant="secondary">{typeResources.length}</Badge>
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  {formatFileSize(typeSize)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Path</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {typeResources.map((resource, idx) => {
                      const viewable = isViewable(resource);
                      return (
                        <TableRow
                          key={idx}
                          className={viewable ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}
                          onClick={() => viewable && handleResourceClick(resource)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {resourceTypeIcons[resource.type] || resourceTypeIcons.other}
                              <span className="truncate max-w-[200px]" title={resource.name}>
                                {resource.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded truncate block max-w-[300px]" title={resource.path}>
                              {resource.path}
                            </code>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatFileSize(resource.size)}
                          </TableCell>
                          <TableCell className="text-right">
                            {viewable && (
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleResourceClick(resource);
                                      }}
                                    >
                                      <IconEye className="h-4 w-4" />
                                      <span className="sr-only">View {resource.name}</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">
                                    <p>View resource</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Resource Viewer Sheet */}
      <ResourceViewer
        resource={selectedResource}
        iflowId={iflow.id}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </div>
  );
}
