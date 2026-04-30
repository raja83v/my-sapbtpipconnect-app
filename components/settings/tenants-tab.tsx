"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconPlus, IconServer, IconCheck, IconX, IconSettings, IconTrash, IconRefresh, IconKey } from "@tabler/icons-react";
import { TenantWithRole } from "@/app/actions/tenant";
import { AddTenantDialog } from "@/components/settings/add-tenant-dialog";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteTenant, syncTenantIFlows } from "@/app/actions/tenant";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { EditTenantDialog } from "@/components/settings/edit-tenant-dialog";
import { RuntimeCredentialsDialog } from "@/components/settings/runtime-credentials-dialog";

interface TenantsTabProps {
  tenants: TenantWithRole[];
}

export function TenantsTab({ tenants: initialTenants }: TenantsTabProps) {
  const [tenants, setTenants] = useState<TenantWithRole[]>(initialTenants);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [editingTenant, setEditingTenant] = useState<TenantWithRole | null>(null);
  const [runtimeCredsTenant, setRuntimeCredsTenant] = useState<TenantWithRole | null>(null);
  const router = useRouter();

  const handleSyncTenant = async (tenantId: string) => {
    setIsSyncing(tenantId);
    try {
      const result = await syncTenantIFlows(tenantId);
      if (result.success) {
        toast.success(`Successfully synced ${result.data?.count || 0} iFlows`);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to sync iFlows");
      }
    } catch (error) {
      toast.error("An error occurred while syncing iFlows");
    } finally {
      setIsSyncing(null);
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    setIsDeleting(tenantId);
    try {
      const result = await deleteTenant(tenantId);
      if (result.success) {
        setTenants(tenants.filter((t) => t.id !== tenantId));
        toast.success("Tenant deleted successfully");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete tenant");
      }
    } catch (error) {
      toast.error("An error occurred while deleting the tenant");
    } finally {
      setIsDeleting(null);
    }
  };

  const getStatusBadge = (status: string, isConnected: boolean) => {
    if (status === "ACTIVE" && isConnected) {
      return (
        <Badge variant="default" className="bg-green-500">
          <IconCheck className="h-3 w-3 mr-1" />
          Connected
        </Badge>
      );
    }
    if (status === "ACTIVE" && !isConnected) {
      return (
        <Badge variant="secondary">
          <IconX className="h-3 w-3 mr-1" />
          Not Connected
        </Badge>
      );
    }
    if (status === "ERROR") {
      return <Badge variant="destructive">Error</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>CPI Tenants</CardTitle>
              <CardDescription>
                Manage your SAP Cloud Integration tenant connections
              </CardDescription>
            </div>
            <AddTenantDialog onSuccess={() => {
              router.refresh();
            }}>
              <Button>
                <IconPlus className="h-4 w-4 mr-2" />
                Add Tenant
              </Button>
            </AddTenantDialog>
          </div>
        </CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <div className="text-center py-12">
              <IconServer className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tenants configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add your first CPI tenant to start monitoring iFlows
              </p>
              <AddTenantDialog onSuccess={() => {
                router.refresh();
              }}>
                <Button>
                  <IconPlus className="h-4 w-4 mr-2" />
                  Add Tenant
                </Button>
              </AddTenantDialog>
            </div>
          ) : (
            <div className="space-y-4">
              {tenants.map((tenant) => (
                <Card key={tenant.id} className="border-2">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <IconServer className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{tenant.name}</h3>
                            {getStatusBadge(tenant.status, tenant.isConnected)}
                            <Badge variant="outline">{tenant.memberRole}</Badge>
                          </div>
                          {tenant.description && (
                            <p className="text-sm text-muted-foreground mb-3">
                              {tenant.description}
                            </p>
                          )}
                          <div className="grid gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">URL:</span>
                              <code className="text-xs bg-secondary px-2 py-1 rounded">
                                {tenant.tenantUrl}
                              </code>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Auth Type:</span>
                              <span className="font-medium">{tenant.authType}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                Created {formatDistanceToNow(new Date(tenant.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            {tenant.lastSyncAt && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Last synced:</span>
                                <span className="font-medium text-green-600">
                                  {formatDistanceToNow(new Date(tenant.lastSyncAt), { addSuffix: true })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSyncTenant(tenant.id)}
                          disabled={isSyncing === tenant.id}
                        >
                          <IconRefresh className={`h-4 w-4 mr-2 ${isSyncing === tenant.id ? 'animate-spin' : ''}`} />
                          {isSyncing === tenant.id ? 'Syncing...' : 'Sync'}
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={() => setEditingTenant(tenant)}
                        >
                          <IconSettings className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRuntimeCredsTenant(tenant)}
                          title="Configure runtime credentials for the iFlow Test runner"
                        >
                          <IconKey className="h-4 w-4 mr-2" />
                          Runtime
                        </Button>
                        {tenant.memberRole === "OWNER" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isDeleting === tenant.id}
                              >
                                <IconTrash className="h-4 w-4 mr-2" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{tenant.name}"? This action
                                  cannot be undone. All iFlows and monitoring data associated
                                  with this tenant will be permanently deleted.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteTenant(tenant.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete Tenant
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editingTenant && (
        <EditTenantDialog
          tenant={editingTenant}
          open={!!editingTenant}
          onOpenChange={(open) => { if (!open) setEditingTenant(null); }}
        />
      )}

      {runtimeCredsTenant && (
        <RuntimeCredentialsDialog
          tenantId={runtimeCredsTenant.id}
          tenantName={runtimeCredsTenant.name}
          open={!!runtimeCredsTenant}
          onOpenChange={(open) => { if (!open) setRuntimeCredsTenant(null); }}
        />
      )}
    </div>
  );
}
