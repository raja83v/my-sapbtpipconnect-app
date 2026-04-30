"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconRoute, IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import type { APIProxyInfo } from "@/app/actions/api-products";

interface APIProductProxiesTabProps {
  proxies: APIProxyInfo[];
  productName: string;
}

function getStateBadge(state: string) {
  switch (state.toUpperCase()) {
    case "DEPLOYED":
      return (
        <Badge className="bg-green-500 hover:bg-green-600 text-white gap-1">
          <IconCircleCheck className="h-3 w-3" />
          Deployed
        </Badge>
      );
    case "UNDEPLOYED":
      return (
        <Badge variant="secondary" className="gap-1">
          <IconCircleX className="h-3 w-3" />
          Undeployed
        </Badge>
      );
    default:
      return <Badge variant="outline">{state}</Badge>;
  }
}

export function APIProductProxiesTab({
  proxies,
  productName,
}: APIProductProxiesTabProps) {
  if (proxies.length === 0) {
    return (
      <div className="text-center py-12">
        <IconRoute className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No API Proxies</h3>
        <p className="text-sm text-muted-foreground">
          No API Proxies are associated with the{" "}
          <span className="font-medium">{productName}</span> product.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {proxies.length} API Prox{proxies.length === 1 ? "y" : "ies"} in this
        product
      </p>

      <div className="rounded-md border overflow-hidden">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[22%]">Name</TableHead>
              <TableHead className="w-[20%]">Title</TableHead>
              <TableHead className="w-[18%]">Base Path</TableHead>
              <TableHead className="w-[10%]">State</TableHead>
              <TableHead className="w-[8%]">Version</TableHead>
              <TableHead className="w-[22%]">Service Endpoint</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proxies.map((proxy) => (
              <TableRow key={proxy.name}>
                <TableCell className="font-medium">
                  <code
                    className="text-xs bg-secondary px-2 py-1 rounded block truncate"
                    title={proxy.name}
                  >
                    {proxy.name}
                  </code>
                </TableCell>
                <TableCell
                  className="truncate text-sm"
                  title={proxy.title}
                >
                  {proxy.title}
                </TableCell>
                <TableCell>
                  {proxy.basePath ? (
                    <code
                      className="text-xs bg-secondary px-2 py-1 rounded block truncate"
                      title={proxy.basePath}
                    >
                      {proxy.basePath}
                    </code>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{getStateBadge(proxy.state)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {proxy.version || "—"}
                </TableCell>
                <TableCell>
                  {proxy.serviceEndPoint ? (
                    <a
                      href={proxy.serviceEndPoint}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline block truncate"
                      title={proxy.serviceEndPoint}
                    >
                      {proxy.serviceEndPoint}
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
