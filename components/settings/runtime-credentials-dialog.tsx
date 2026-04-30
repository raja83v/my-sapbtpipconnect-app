"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { IconLock, IconInfoCircle, IconUpload } from "@tabler/icons-react";
import { toast } from "sonner";

import {
  getRuntimeCredentialsStatus,
  saveRuntimeCredentials,
} from "@/app/actions/iflow-testing";

interface RuntimeCredentialsDialogProps {
  tenantId: string;
  tenantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AuthType = "" | "OAUTH" | "BASIC_AUTH" | "CERTIFICATE";

export function RuntimeCredentialsDialog({
  tenantId,
  tenantName,
  open,
  onOpenChange,
}: RuntimeCredentialsDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [configured, setConfigured] = useState(false);

  const [authType, setAuthType] = useState<AuthType>("");
  const [tokenUrl, setTokenUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [clientCertPem, setClientCertPem] = useState("");
  const [clientKeyPem, setClientKeyPem] = useState("");
  const [clientKeyPassphrase, setClientKeyPassphrase] = useState("");
  const [hasClientCert, setHasClientCert] = useState(false);
  const [hasClientKey, setHasClientKey] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatusLoading(true);
    getRuntimeCredentialsStatus(tenantId)
      .then((r) => {
        if (r.success && r.data) {
          setConfigured(r.data.configured);
          setAuthType((r.data.authType as AuthType) ?? "");
          setHasClientCert(r.data.hasClientCert);
          setHasClientKey(r.data.hasClientKey);
        }
      })
      .finally(() => setStatusLoading(false));
  }, [open, tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await saveRuntimeCredentials(tenantId, {
        authType: authType ? authType : null,
        tokenUrl: tokenUrl.trim() || null,
        clientId: clientId.trim() || null,
        clientSecret: clientSecret.trim() || undefined,
        username: username.trim() || null,
        password: password.trim() || undefined,
        clientCertPem: clientCertPem.trim() || undefined,
        clientKeyPem: clientKeyPem.trim() || undefined,
        clientKeyPassphrase: clientKeyPassphrase.trim() || undefined,
      });
      if (r.success) {
        toast.success("Runtime credentials saved");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Runtime Credentials</DialogTitle>
          <DialogDescription>
            Optional credentials used by the test runner to invoke deployed iFlows on{" "}
            <strong>{tenantName}</strong>. If left blank, the management credentials
            are used as fallback.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Alert>
            <IconInfoCircle className="h-4 w-4" />
            <AlertTitle>How this is used</AlertTitle>
            <AlertDescription>
              Runtime credentials must be authorized in your CPI runtime tenant
              for the iFlow’s endpoint URL. Secrets are encrypted with AES-256.
            </AlertDescription>
          </Alert>

          <div className="grid gap-2">
            <Label htmlFor="rt-auth-type">Authentication type</Label>
            <Select value={authType} onValueChange={(v) => setAuthType(v as AuthType)}>
              <SelectTrigger id="rt-auth-type">
                <SelectValue placeholder="Use management credentials (default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OAUTH">OAuth 2.0 (client credentials)</SelectItem>
                <SelectItem value="BASIC_AUTH">Basic Authentication</SelectItem>
                <SelectItem value="CERTIFICATE">Client Certificate (mTLS)</SelectItem>
              </SelectContent>
            </Select>
            {statusLoading && (
              <p className="text-xs text-muted-foreground">Loading current status…</p>
            )}
            {configured && (
              <p className="text-xs text-emerald-600">
                Runtime credentials are currently configured.
              </p>
            )}
          </div>

          {authType === "OAUTH" && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="rt-token-url">Token URL *</Label>
                <Input
                  id="rt-token-url"
                  type="url"
                  value={tokenUrl}
                  onChange={(e) => setTokenUrl(e.target.value)}
                  placeholder="https://…/oauth/token"
                  required
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rt-client-id">Client ID *</Label>
                <Input
                  id="rt-client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rt-client-secret">
                  Client Secret{" "}
                  <span className="text-muted-foreground font-normal">
                    {configured ? "(leave blank to keep)" : "*"}
                  </span>
                </Label>
                <div className="relative">
                  <IconLock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="rt-client-secret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={configured ? "•••••••• (unchanged)" : "Enter client secret"}
                    className="pl-10"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </>
          )}

          {authType === "BASIC_AUTH" && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="rt-username">Username *</Label>
                <Input
                  id="rt-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rt-password">
                  Password{" "}
                  <span className="text-muted-foreground font-normal">
                    {configured ? "(leave blank to keep)" : "*"}
                  </span>
                </Label>
                <div className="relative">
                  <IconLock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="rt-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={configured ? "•••••••• (unchanged)" : "Enter password"}
                    className="pl-10"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </>
          )}

          {authType === "CERTIFICATE" && (
            <>
              <Alert>
                <IconInfoCircle className="h-4 w-4" />
                <AlertTitle>Client certificate (mTLS)</AlertTitle>
                <AlertDescription>
                  The certificate must be trusted by the iFlow’s runtime—typically
                  mapped via the tenant’s Client Certificate-to-User Mapping in the
                  BTP cockpit. PEM material is encrypted with AES-256 at rest.
                </AlertDescription>
              </Alert>
              <PemField
                id="rt-cert"
                label="Client certificate (PEM)"
                placeholder={
                  hasClientCert && !clientCertPem
                    ? "•••••••• (unchanged — paste new PEM to replace)"
                    : "-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----"
                }
                accept=".pem,.crt,.cer,.txt"
                value={clientCertPem}
                onChange={setClientCertPem}
                configured={hasClientCert}
                required={!hasClientCert}
              />
              <PemField
                id="rt-key"
                label="Private key (PEM)"
                placeholder={
                  hasClientKey && !clientKeyPem
                    ? "•••••••• (unchanged — paste new PEM to replace)"
                    : "-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----"
                }
                accept=".pem,.key,.txt"
                value={clientKeyPem}
                onChange={setClientKeyPem}
                configured={hasClientKey}
                required={!hasClientKey}
                sensitive
              />
              <div className="grid gap-2">
                <Label htmlFor="rt-key-passphrase">
                  Key passphrase{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <div className="relative">
                  <IconLock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="rt-key-passphrase"
                    type="password"
                    value={clientKeyPassphrase}
                    onChange={(e) => setClientKeyPassphrase(e.target.value)}
                    placeholder="Leave blank if the private key is not encrypted"
                    className="pl-10"
                    autoComplete="new-password"
                    spellCheck={false}
                  />
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PemFieldProps {
  id: string;
  label: string;
  placeholder: string;
  accept: string;
  value: string;
  onChange: (next: string) => void;
  configured: boolean;
  required?: boolean;
  sensitive?: boolean;
}

function PemField({
  id,
  label,
  placeholder,
  accept,
  value,
  onChange,
  configured,
  required,
  sensitive,
}: PemFieldProps) {
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 256 * 1024) {
      toast.error("File is too large (max 256 KB)");
      return;
    }
    const text = await file.text();
    if (!/-----BEGIN [A-Z ]+-----/.test(text)) {
      toast.error("File does not look like a PEM-encoded certificate or key");
      return;
    }
    onChange(text.trim());
  };
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>
          {label}{" "}
          <span className="text-muted-foreground font-normal">
            {configured ? "(leave blank to keep)" : required ? "*" : ""}
          </span>
        </Label>
        <div className="flex items-center gap-2">
          {configured && !value && (
            <Badge variant="secondary" className="text-xs">
              Configured
            </Badge>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
            <IconUpload className="h-3.5 w-3.5" />
            Upload
            <input
              type="file"
              accept={accept}
              className="sr-only"
              onChange={handleFile}
            />
          </label>
        </div>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={6}
        className="max-h-40 min-h-24 resize-y overflow-auto whitespace-pre font-mono text-xs [field-sizing:fixed]"
        spellCheck={false}
        autoComplete={sensitive ? "new-password" : "off"}
        required={required && !configured}
        wrap="off"
      />
    </div>
  );
}
