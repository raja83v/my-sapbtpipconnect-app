"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconServer, IconKey, IconLock } from "@tabler/icons-react";
import { createTenant } from "@/app/actions/tenant";
import { toast } from "sonner";

interface AddTenantDialogProps {
  children: React.ReactNode;
  onSuccess?: (tenantId: string) => void;
}

export function AddTenantDialog({ children, onSuccess }: AddTenantDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Form state
  const [tenantName, setTenantName] = useState("");
  const [description, setDescription] = useState("");
  const [tenantUrl, setTenantUrl] = useState("");
  const [authType, setAuthType] = useState<"OAUTH" | "BASIC_AUTH" | "SERVICE_KEY">("OAUTH");
  const [authenticationUrl, setAuthenticationUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validate connection first
      const validationResponse = await fetch("/api/tenant/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantUrl: tenantUrl.trim(),
          authType,
          authenticationUrl: authType === "OAUTH" ? authenticationUrl.trim() : undefined,
          clientId: authType === "OAUTH" ? clientId.trim() : undefined,
          clientSecret: authType === "OAUTH" ? clientSecret.trim() : undefined,
          username: authType === "BASIC_AUTH" ? username.trim() : undefined,
          password: authType === "BASIC_AUTH" ? password.trim() : undefined,
        }),
      });

      const validationData = await validationResponse.json();

      if (!validationResponse.ok || !validationData.success) {
        throw new Error(
          validationData.error || "Failed to connect to CPI tenant. Please verify your credentials and URLs."
        );
      }

      // Create tenant
      const result = await createTenant({
        tenantName: tenantName.trim(),
        tenantUrl: tenantUrl.trim(),
        description: description.trim() || undefined,
        authType,
        authenticationUrl: authType === "OAUTH" ? authenticationUrl.trim() : undefined,
        clientId: authType === "OAUTH" ? clientId.trim() : undefined,
        clientSecret: authType === "OAUTH" ? clientSecret.trim() : undefined,
        username: authType === "BASIC_AUTH" ? username.trim() : undefined,
        password: authType === "BASIC_AUTH" ? password.trim() : undefined,
      });

      if (result.success) {
        toast.success("Tenant added successfully!");
        setOpen(false);
        resetForm();
        router.refresh();
        if (onSuccess && result.data) {
          onSuccess(result.data.tenantId);
        }
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      setError(err.message || "Failed to add tenant");
      toast.error(err.message || "Failed to add tenant");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTenantName("");
    setDescription("");
    setTenantUrl("");
    setAuthType("OAUTH");
    setAuthenticationUrl("");
    setClientId("");
    setClientSecret("");
    setUsername("");
    setPassword("");
    setError("");
  };

  const isFormValid = () => {
    if (!tenantName.trim() || !tenantUrl.trim()) return false;

    if (authType === "OAUTH") {
      return authenticationUrl.trim() && clientId.trim() && clientSecret.trim();
    }

    if (authType === "BASIC_AUTH") {
      return username.trim() && password.trim();
    }

    return false;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add CPI Tenant</DialogTitle>
          <DialogDescription>
            Connect a new SAP Cloud Integration tenant to monitor iFlows
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tenantName">Tenant Name *</Label>
              <div className="relative">
                <IconServer className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  id="tenantName"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Production CPI"
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Main production environment for integration flows"
                disabled={loading}
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tenantUrl">CPI Tenant URL *</Label>
              <Input
                id="tenantUrl"
                type="url"
                value={tenantUrl}
                onChange={(e) => setTenantUrl(e.target.value)}
                placeholder="https://example.it-cpi.cfapps.eu10.hana.ondemand.com"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Your SAP Cloud Integration tenant URL
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="authType">Authentication Type *</Label>
              <Select
                value={authType}
                onValueChange={(value: "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY") => setAuthType(value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select authentication type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OAUTH">OAuth 2.0</SelectItem>
                  <SelectItem value="BASIC_AUTH">Basic Authentication</SelectItem>
                  <SelectItem value="SERVICE_KEY">Service Key</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* OAuth Fields */}
            {authType === "OAUTH" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="authenticationUrl">Authentication URL *</Label>
                  <Input
                    id="authenticationUrl"
                    type="url"
                    value={authenticationUrl}
                    onChange={(e) => setAuthenticationUrl(e.target.value)}
                    placeholder="https://example.authentication.eu10.hana.ondemand.com/oauth/token"
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    OAuth 2.0 token endpoint URL for authentication
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="clientId">Client ID *</Label>
                  <div className="relative">
                    <IconKey className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="clientId"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="your-client-id"
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="clientSecret">Client Secret *</Label>
                  <div className="relative">
                    <IconLock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="clientSecret"
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="pl-10"
                      autoComplete="off"
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your credentials will be encrypted before storage
                  </p>
                </div>
              </>
            )}

            {/* Basic Auth Fields */}
            {authType === "BASIC_AUTH" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your-username"
                    disabled={loading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <IconLock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your credentials will be encrypted before storage
                  </p>
                </div>
              </>
            )}

            {/* Service Key Notice */}
            {authType === "SERVICE_KEY" && (
              <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium text-sm">Service Key Configuration</h4>
                <p className="text-sm text-muted-foreground">
                  Service key authentication will be available soon.
                  Please use OAuth 2.0 or Basic Authentication for now.
                </p>
              </div>
            )}

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-4 rounded-lg">
              <h4 className="font-medium text-sm text-amber-900 dark:text-amber-100 mb-1">
                🔒 Security Notice
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Your credentials are encrypted using AES-256 encryption before storage. We recommend using OAuth 2.0 for production environments.
              </p>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !isFormValid()}>
              {loading ? "Connecting..." : "Add Tenant"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
