"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { IconKey, IconLock, IconApi } from "@tabler/icons-react";
import { updateTenant, type TenantWithRole } from "@/app/actions/tenant";
import { toast } from "sonner";

interface EditTenantDialogProps {
  tenant: TenantWithRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTenantDialog({ tenant, open, onOpenChange }: EditTenantDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // â”€â”€ CPI form state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [name, setName] = useState(tenant.name);
  const [description, setDescription] = useState(tenant.description ?? "");
  const [tenantUrl, setTenantUrl] = useState(tenant.tenantUrl);
  const [authType, setAuthType] = useState<"OAUTH" | "BASIC_AUTH" | "SERVICE_KEY">(
    tenant.authType as "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY"
  );
  const [authenticationUrl, setAuthenticationUrl] = useState(tenant.authenticationUrl ?? "");
  const [clientId, setClientId] = useState(tenant.clientId ?? "");
  const [clientSecret, setClientSecret] = useState(""); // never pre-filled
  const [username, setUsername] = useState(tenant.username ?? "");
  const [password, setPassword] = useState(""); // never pre-filled

  // â”€â”€ APIM form state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [apimUrl, setApimUrl] = useState(tenant.apimUrl ?? "");
  const [apimAuthType, setApimAuthType] = useState<"" | "OAUTH" | "BASIC_AUTH">(
    (tenant.apimAuthType as "" | "OAUTH" | "BASIC_AUTH") ?? ""
  );
  const [apimTokenUrl, setApimTokenUrl] = useState(tenant.tokenUrl ?? "");
  const [apimClientId, setApimClientId] = useState(tenant.apimClientId ?? "");
  const [apimClientSecret, setApimClientSecret] = useState(""); // never pre-filled
  const [apimUsername, setApimUsername] = useState(tenant.apimUsername ?? "");
  const [apimPassword, setApimPassword] = useState(""); // never pre-filled

  // Re-sync when tenant prop changes
  useEffect(() => {
    setName(tenant.name);
    setDescription(tenant.description ?? "");
    setTenantUrl(tenant.tenantUrl);
    setAuthType(tenant.authType as "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY");
    setAuthenticationUrl(tenant.authenticationUrl ?? "");
    setClientId(tenant.clientId ?? "");
    setClientSecret("");
    setUsername(tenant.username ?? "");
    setPassword("");
    setApimUrl(tenant.apimUrl ?? "");
    setApimAuthType((tenant.apimAuthType as "" | "OAUTH" | "BASIC_AUTH") ?? "");
    setApimTokenUrl(tenant.tokenUrl ?? "");
    setApimClientId(tenant.apimClientId ?? "");
    setApimClientSecret("");
    setApimUsername(tenant.apimUsername ?? "");
    setApimPassword("");
    setError("");
  }, [tenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await updateTenant(tenant.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        tenantUrl: tenantUrl.trim(),
        authType,
        // CPI OAuth
        authenticationUrl: authType === "OAUTH" ? authenticationUrl.trim() || undefined : undefined,
        clientId: authType === "OAUTH" ? clientId.trim() || undefined : undefined,
        clientSecret: authType === "OAUTH" && clientSecret.trim() ? clientSecret.trim() : undefined,
        // CPI Basic Auth
        username: authType === "BASIC_AUTH" ? username.trim() || undefined : undefined,
        password: authType === "BASIC_AUTH" && password.trim() ? password.trim() : undefined,
        // APIM
        apimUrl: apimUrl.trim() || null,
        tokenUrl: apimTokenUrl.trim() || null,
        apimAuthType: apimAuthType || null,
        apimClientId: apimAuthType === "OAUTH" ? apimClientId.trim() || null : null,
        apimClientSecret:
          apimAuthType === "OAUTH" && apimClientSecret.trim() ? apimClientSecret.trim() : undefined,
        apimUsername: apimAuthType === "BASIC_AUTH" ? apimUsername.trim() || null : null,
        apimPassword:
          apimAuthType === "BASIC_AUTH" && apimPassword.trim() ? apimPassword.trim() : undefined,
      });

      if (result.success) {
        toast.success("Tenant updated successfully!");
        onOpenChange(false);
        router.refresh();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      const msg = err.message || "Failed to update tenant";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const showApimTokenUrl =
    apimAuthType === "OAUTH" ||
    (apimAuthType === "" && authType === "OAUTH" && apimUrl.trim() !== "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Tenant</DialogTitle>
          <DialogDescription>
            Update the configuration for <strong>{tenant.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* â”€â”€ CPI Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Tenant Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production CPI"
                disabled={loading}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Main production environment for integration flows"
                disabled={loading}
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-tenantUrl">CPI Tenant URL *</Label>
              <Input
                id="edit-tenantUrl"
                type="url"
                value={tenantUrl}
                onChange={(e) => setTenantUrl(e.target.value)}
                placeholder="https://example.it-cpi002.cfapps.ap10.hana.ondemand.com"
                disabled={loading}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-authType">CPI Authentication Type *</Label>
              <Select
                value={authType}
                onValueChange={(v: "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY") => setAuthType(v)}
                disabled={loading}
              >
                <SelectTrigger id="edit-authType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OAUTH">OAuth 2.0</SelectItem>
                  <SelectItem value="BASIC_AUTH">Basic Authentication</SelectItem>
                  <SelectItem value="SERVICE_KEY">Service Key</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {authType === "OAUTH" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="edit-authenticationUrl">CPI Token URL *</Label>
                  <Input
                    id="edit-authenticationUrl"
                    type="url"
                    value={authenticationUrl}
                    onChange={(e) => setAuthenticationUrl(e.target.value)}
                    placeholder="https://example.authentication.eu10.hana.ondemand.com/oauth/token"
                    disabled={loading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-clientId">CPI Client ID *</Label>
                  <div className="relative">
                    <IconKey className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="edit-clientId"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="your-client-id"
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-clientSecret">
                    CPI Client Secret{" "}
                    <span className="text-muted-foreground font-normal">
                      {tenant.hasClientSecret ? "(leave blank to keep existing)" : "*"}
                    </span>
                  </Label>
                  <div className="relative">
                    <IconLock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="edit-clientSecret"
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder={tenant.hasClientSecret ? "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢  (unchanged)" : "Enter client secret"}
                      className="pl-10"
                      autoComplete="new-password"
                      disabled={loading}
                    />
                  </div>
                </div>
              </>
            )}

            {authType === "BASIC_AUTH" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="edit-username">CPI Username *</Label>
                  <Input
                    id="edit-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your-username"
                    disabled={loading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-password">
                    CPI Password{" "}
                    <span className="text-muted-foreground font-normal">
                      {tenant.hasPassword ? "(leave blank to keep existing)" : "*"}
                    </span>
                  </Label>
                  <div className="relative">
                    <IconLock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="edit-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={tenant.hasPassword ? "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢  (unchanged)" : "Enter password"}
                      className="pl-10"
                      autoComplete="new-password"
                      disabled={loading}
                    />
                  </div>
                </div>
              </>
            )}

            {authType === "SERVICE_KEY" && (
              <div className="bg-secondary/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Service key authentication is not yet available. Please use OAuth 2.0 or Basic Authentication.
                </p>
              </div>
            )}
          </div>

          {/* â”€â”€ APIM Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground flex items-center gap-1">
                <IconApi className="h-3 w-3" />
                SAP API Management
                <span className="normal-case font-normal">(Optional)</span>
              </span>
            </div>
          </div>

          <div className="grid gap-4">
            <p className="text-xs text-muted-foreground">
              Configure SAP API Management (APIM) if your Integration Suite has the API portal enabled.
              APIM can use separate service key credentials from CPI.
            </p>

            <div className="grid gap-2">
              <Label htmlFor="edit-apimUrl">APIM Portal URL</Label>
              <Input
                id="edit-apimUrl"
                type="url"
                value={apimUrl}
                onChange={(e) => setApimUrl(e.target.value)}
                placeholder="https://example.integrationsuite.cfapps.ap10.hana.ondemand.com"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                The <code className="bg-muted px-1 rounded text-xs">url</code> from your APIM service key.
                Required for the APIs dashboard.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-apimAuthType">APIM Authentication</Label>
              <Select
                value={apimAuthType}
                onValueChange={(v: "" | "OAUTH" | "BASIC_AUTH") => setApimAuthType(v)}
                disabled={loading}
              >
                <SelectTrigger id="edit-apimAuthType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Same as CPI (default)</SelectItem>
                  <SelectItem value="OAUTH">OAuth 2.0 â€” separate APIM credentials</SelectItem>
                  <SelectItem value="BASIC_AUTH">Basic Auth â€” separate APIM credentials</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose "Same as CPI" if your APIM service key credentials match CPI.
                Choose a separate type when your APIM uses a different service key.
              </p>
            </div>

            {showApimTokenUrl && (
              <div className="grid gap-2">
                <Label htmlFor="edit-apimTokenUrl">
                  APIM Token URL{apimAuthType === "OAUTH" ? " *" : " (Optional)"}
                </Label>
                <Input
                  id="edit-apimTokenUrl"
                  type="url"
                  value={apimTokenUrl}
                  onChange={(e) => setApimTokenUrl(e.target.value)}
                  placeholder="https://example.authentication.ap10.hana.ondemand.com/oauth/token"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  The <code className="bg-muted px-1 rounded text-xs">tokenUrl</code> from your APIM service key.
                  {apimAuthType === "" && " Leave blank to use the CPI token URL."}
                </p>
              </div>
            )}

            {apimAuthType === "OAUTH" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="edit-apimClientId">APIM Client ID *</Label>
                  <div className="relative">
                    <IconKey className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="edit-apimClientId"
                      value={apimClientId}
                      onChange={(e) => setApimClientId(e.target.value)}
                      placeholder="apim-client-id"
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-apimClientSecret">
                    APIM Client Secret{" "}
                    <span className="text-muted-foreground font-normal">
                      {tenant.hasApimClientSecret ? "(leave blank to keep existing)" : "*"}
                    </span>
                  </Label>
                  <div className="relative">
                    <IconLock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="edit-apimClientSecret"
                      type="password"
                      value={apimClientSecret}
                      onChange={(e) => setApimClientSecret(e.target.value)}
                      placeholder={
                        tenant.hasApimClientSecret ? "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢  (unchanged)" : "Enter APIM client secret"
                      }
                      className="pl-10"
                      autoComplete="new-password"
                      disabled={loading}
                    />
                  </div>
                </div>
              </>
            )}

            {apimAuthType === "BASIC_AUTH" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="edit-apimUsername">APIM Username *</Label>
                  <Input
                    id="edit-apimUsername"
                    value={apimUsername}
                    onChange={(e) => setApimUsername(e.target.value)}
                    placeholder="apim-username"
                    disabled={loading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-apimPassword">
                    APIM Password{" "}
                    <span className="text-muted-foreground font-normal">
                      {tenant.hasApimPassword ? "(leave blank to keep existing)" : "*"}
                    </span>
                  </Label>
                  <div className="relative">
                    <IconLock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="edit-apimPassword"
                      type="password"
                      value={apimPassword}
                      onChange={(e) => setApimPassword(e.target.value)}
                      placeholder={tenant.hasApimPassword ? "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢  (unchanged)" : "Enter APIM password"}
                      className="pl-10"
                      autoComplete="new-password"
                      disabled={loading}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-4 rounded-lg">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              ðŸ”’ Credentials are encrypted with AES-256 before storage. Secrets left blank
              will not be changed.
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !tenantUrl.trim()}>
              {loading ? "Savingâ€¦" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
