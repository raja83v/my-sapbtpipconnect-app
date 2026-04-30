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
import { IconServer, IconKey, IconLock, IconApi } from "@tabler/icons-react";
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

  // â”€â”€ CPI form state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [tenantName, setTenantName] = useState("");
  const [description, setDescription] = useState("");
  const [tenantUrl, setTenantUrl] = useState("");
  const [authType, setAuthType] = useState<
    "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY"
  >("OAUTH");
  const [authenticationUrl, setAuthenticationUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // â”€â”€ APIM form state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [apimUrl, setApimUrl] = useState("");
  // "" = same as CPI, "OAUTH" / "BASIC_AUTH" = separate credentials
  const [apimAuthType, setApimAuthType] = useState<"" | "OAUTH" | "BASIC_AUTH">(
    "",
  );
  const [apimTokenUrl, setApimTokenUrl] = useState("");
  const [apimClientId, setApimClientId] = useState("");
  const [apimClientSecret, setApimClientSecret] = useState("");
  const [apimUsername, setApimUsername] = useState("");
  const [apimPassword, setApimPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validate CPI connection first
      const validationResponse = await fetch("/api/tenant/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantUrl: tenantUrl.trim(),
          authType,
          authenticationUrl:
            authType === "OAUTH" ? authenticationUrl.trim() : undefined,
          clientId: authType === "OAUTH" ? clientId.trim() : undefined,
          clientSecret: authType === "OAUTH" ? clientSecret.trim() : undefined,
          username: authType === "BASIC_AUTH" ? username.trim() : undefined,
          password: authType === "BASIC_AUTH" ? password.trim() : undefined,
        }),
      });

      const validationData = await validationResponse.json();

      if (!validationResponse.ok || !validationData.success) {
        throw new Error(
          validationData.error ||
            "Failed to connect to CPI tenant. Please verify your credentials and URLs.",
        );
      }

      const result = await createTenant({
        tenantName: tenantName.trim(),
        tenantUrl: tenantUrl.trim(),
        description: description.trim() || undefined,
        authType,
        authenticationUrl:
          authType === "OAUTH" ? authenticationUrl.trim() : undefined,
        clientId: authType === "OAUTH" ? clientId.trim() : undefined,
        clientSecret: authType === "OAUTH" ? clientSecret.trim() : undefined,
        username: authType === "BASIC_AUTH" ? username.trim() : undefined,
        password: authType === "BASIC_AUTH" ? password.trim() : undefined,
        apimUrl: apimUrl.trim() || undefined,
        // APIM token URL: used for both "same as CPI + APIM URL" and separate OAUTH
        tokenUrl: apimTokenUrl.trim() || undefined,
        // Separate APIM credentials (null when using CPI credentials)
        apimAuthType: apimAuthType || null,
        apimClientId:
          apimAuthType === "OAUTH" ? apimClientId.trim() : undefined,
        apimClientSecret:
          apimAuthType === "OAUTH" ? apimClientSecret.trim() : undefined,
        apimUsername:
          apimAuthType === "BASIC_AUTH" ? apimUsername.trim() : undefined,
        apimPassword:
          apimAuthType === "BASIC_AUTH" ? apimPassword.trim() : undefined,
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
    setApimUrl("");
    setApimAuthType("");
    setApimTokenUrl("");
    setApimClientId("");
    setApimClientSecret("");
    setApimUsername("");
    setApimPassword("");
    setError("");
  };

  const isFormValid = () => {
    if (!tenantName.trim() || !tenantUrl.trim()) return false;
    if (authType === "OAUTH") {
      if (!authenticationUrl.trim() || !clientId.trim() || !clientSecret.trim())
        return false;
    }
    if (authType === "BASIC_AUTH") {
      if (!username.trim() || !password.trim()) return false;
    }
    // Validate separate APIM creds when explicitly selected
    if (apimAuthType === "OAUTH") {
      if (
        !apimTokenUrl.trim() ||
        !apimClientId.trim() ||
        !apimClientSecret.trim()
      )
        return false;
    }
    if (apimAuthType === "BASIC_AUTH") {
      if (!apimUsername.trim() || !apimPassword.trim()) return false;
    }
    return true;
  };

  // Show APIM token URL when: APIM OAUTH is selected, or when using CPI creds + APIM URL
  const showApimTokenUrl =
    apimAuthType === "OAUTH" ||
    (apimAuthType === "" && authType === "OAUTH" && apimUrl.trim() !== "");

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add CPI Tenant</DialogTitle>
          <DialogDescription>
            Connect a new SAP Cloud Integration tenant to monitor iFlows
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* â”€â”€ CPI Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                placeholder="https://example.it-cpi002.cfapps.ap10.hana.ondemand.com"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Your SAP Cloud Integration runtime URL
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="authType">CPI Authentication Type *</Label>
              <Select
                value={authType}
                onValueChange={(
                  value: "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY",
                ) => setAuthType(value)}
                disabled={loading}
              >
                <SelectTrigger id="authType">
                  <SelectValue placeholder="Select authentication type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OAUTH">OAuth 2.0</SelectItem>
                  <SelectItem value="BASIC_AUTH">
                    Basic Authentication
                  </SelectItem>
                  <SelectItem value="SERVICE_KEY">Service Key</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {authType === "OAUTH" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="authenticationUrl">CPI Token URL *</Label>
                  <Input
                    id="authenticationUrl"
                    type="url"
                    value={authenticationUrl}
                    onChange={(e) => setAuthenticationUrl(e.target.value)}
                    placeholder="https://example.authentication.eu10.hana.ondemand.com/oauth/token"
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    OAuth 2.0 token endpoint from your CPI service key
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="clientId">CPI Client ID *</Label>
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
                  <Label htmlFor="clientSecret">CPI Client Secret *</Label>
                  <div className="relative">
                    <IconLock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="clientSecret"
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="••••••••••••••••"
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
                  <Label htmlFor="username">CPI Username *</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your-username"
                    disabled={loading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">CPI Password *</Label>
                  <div className="relative">
                    <IconLock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••••••"
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
                  Service key authentication is not yet available. Please use
                  OAuth 2.0 or Basic Authentication.
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
              Configure SAP API Management (APIM) if your Integration Suite has
              the API portal enabled. APIM can use separate service key
              credentials from CPI.
            </p>

            <div className="grid gap-2">
              <Label htmlFor="apimUrl">APIM Portal URL</Label>
              <Input
                id="apimUrl"
                type="url"
                value={apimUrl}
                onChange={(e) => setApimUrl(e.target.value)}
                placeholder="https://example.integrationsuite.cfapps.ap10.hana.ondemand.com"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                The <code className="bg-muted px-1 rounded text-xs">url</code>{" "}
                field from your APIM service key (apiportal-apiaccess plan).
                Required for the APIs dashboard.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="apimAuthType">APIM Authentication</Label>
              <Select
                value={apimAuthType}
                onValueChange={(v: "" | "OAUTH" | "BASIC_AUTH") =>
                  setApimAuthType(v)
                }
                disabled={loading}
              >
                <SelectTrigger id="apimAuthType">
                  <SelectValue placeholder="Select APIM authentication" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Same as CPI (default)</SelectItem>
                  <SelectItem value="OAUTH">
                    OAuth 2.0 â€” separate APIM credentials
                  </SelectItem>
                  <SelectItem value="BASIC_AUTH">
                    Basic Auth â€” separate APIM credentials
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose "Same as CPI" if your APIM service key credentials match
                CPI. Choose a separate type when your APIM uses a different
                service key.
              </p>
            </div>

            {/* APIM Token URL â€” shown for OAUTH modes */}
            {showApimTokenUrl && (
              <div className="grid gap-2">
                <Label htmlFor="apimTokenUrl">
                  APIM Token URL
                  {apimAuthType === "OAUTH" ? " *" : " (Optional)"}
                </Label>
                <Input
                  id="apimTokenUrl"
                  type="url"
                  value={apimTokenUrl}
                  onChange={(e) => setApimTokenUrl(e.target.value)}
                  placeholder="https://example.authentication.ap10.hana.ondemand.com/oauth/token"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  The{" "}
                  <code className="bg-muted px-1 rounded text-xs">
                    tokenUrl
                  </code>{" "}
                  from your APIM service key.
                  {apimAuthType === "" &&
                    " Leave blank to use the CPI token URL."}
                </p>
              </div>
            )}

            {/* Separate APIM OAuth credentials */}
            {apimAuthType === "OAUTH" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="apimClientId">APIM Client ID *</Label>
                  <div className="relative">
                    <IconKey className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="apimClientId"
                      value={apimClientId}
                      onChange={(e) => setApimClientId(e.target.value)}
                      placeholder="apim-client-id"
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="apimClientSecret">APIM Client Secret *</Label>
                  <div className="relative">
                    <IconLock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="apimClientSecret"
                      type="password"
                      value={apimClientSecret}
                      onChange={(e) => setApimClientSecret(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="pl-10"
                      autoComplete="new-password"
                      disabled={loading}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Separate APIM Basic Auth credentials */}
            {apimAuthType === "BASIC_AUTH" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="apimUsername">APIM Username *</Label>
                  <Input
                    id="apimUsername"
                    value={apimUsername}
                    onChange={(e) => setApimUsername(e.target.value)}
                    placeholder="apim-username"
                    disabled={loading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="apimPassword">APIM Password *</Label>
                  <div className="relative">
                    <IconLock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="apimPassword"
                      type="password"
                      value={apimPassword}
                      onChange={(e) => setApimPassword(e.target.value)}
                      placeholder="••••••••••••••••"
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
              🔒 All credentials are encrypted with AES-256 before storage.
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
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Connecting…" : "Add Tenant"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
