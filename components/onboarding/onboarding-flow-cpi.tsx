"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveTenantConfig, finalizeOnboarding } from "@/app/actions/onboarding";
import { toast } from "sonner";
import {
  IconServer,
  IconCheck,
  IconRocket,
  IconLock,
  IconKey,
  IconLoader2,
} from "@tabler/icons-react";
import { Cloud } from "lucide-react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { siteConfig } from "@/lib/config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AIModelSelectionStep } from "./ai-model-selection-step";

interface OnboardingFlowProps {
  userName: string | null;
  userEmail: string;
}

const organizationTypes = [
  { value: "enterprise", label: "Enterprise" },
  { value: "mid-market", label: "Mid-Market" },
  { value: "startup", label: "Startup" },
  { value: "consulting", label: "Consulting/Partner" },
  { value: "education", label: "Education/Non-Profit" },
  { value: "other", label: "Other" },
];

const companySizes = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-1000", label: "201-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

type StepType = "profile" | "tenant" | "ai" | "complete";

export function OnboardingFlowCpi({ userName, userEmail }: OnboardingFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Determine initial step from URL
  const getInitialStep = (): StepType => {
    const step = searchParams.get("step");
    if (step === "tenant" || step === "ai" || step === "complete") {
      return step as StepType;
    }
    return "profile";
  };

  const [currentStep, setCurrentStep] = useState<StepType>(getInitialStep());
  const [firstName, setFirstName] = useState(userName || "");
  const [organizationType, setOrganizationType] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [companyName, setCompanyName] = useState("");

  // CPI Tenant Configuration
  const [tenantName, setTenantName] = useState("");
  const [tenantUrl, setTenantUrl] = useState("");
  const [authType, setAuthType] = useState<"OAUTH" | "BASIC_AUTH" | "SERVICE_KEY">("OAUTH");
  const [authenticationUrl, setAuthenticationUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tokenUrl, setTokenUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  };

  const handleProfileNext = () => {
    setCurrentStep("tenant");
    router.replace("/onboarding?step=tenant");
  };

  const handleTenantCreation = async () => {
    setIsLoading(true);
    setIsValidating(true);
    setError("");

    try {
      // First, validate the tenant connection
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

      setIsValidating(false);

      // If validation passes, save tenant config (without completing onboarding)
      const result = await saveTenantConfig({
        organizationType,
        companySize,
        companyName: companyName.trim(),
        firstName: firstName.trim(),
        tenantName: tenantName.trim(),
        tenantUrl: tenantUrl.trim(),
        authType,
        authenticationUrl: authType === "OAUTH" ? authenticationUrl.trim() : undefined,
        clientId: authType === "OAUTH" ? clientId.trim() : undefined,
        clientSecret: authType === "OAUTH" ? clientSecret.trim() : undefined,
        tokenUrl: authType === "OAUTH" ? tokenUrl.trim() : undefined,
        username: authType === "BASIC_AUTH" ? username.trim() : undefined,
        password: authType === "BASIC_AUTH" ? password.trim() : undefined,
      });

      if (result.success) {
        setCurrentStep("ai");
        router.replace("/onboarding?step=ai");
        toast.success("CPI Tenant connected successfully!");
      }
    } catch (err: unknown) {
      setError(
        (err as Error).message ||
          "Failed to create tenant. Please try again."
      );
      toast.error((err as Error).message || "Failed to create tenant");
    } finally {
      setIsLoading(false);
      setIsValidating(false);
    }
  };

  // Trigger confetti on completion step
  useEffect(() => {
    if (currentStep === "complete") {
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) =>
        Math.random() * (max - min) + min;

      const interval = window.setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [currentStep]);

  const slug = tenantName ? generateSlug(tenantName) : "";

  // Step indicator
  const steps = [
    { key: "profile", label: "Profile" },
    { key: "tenant", label: "Tenant" },
    { key: "ai", label: "AI Provider" },
    { key: "complete", label: "Complete" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="container relative min-h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      {/* Left Side - Branding */}
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <Cloud className="mr-2 h-6 w-6" />
          {siteConfig.name}
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;CPI Connect transformed how we monitor our SAP integrations.
              Real-time visibility into iFlows and instant error alerts have
              reduced our mean time to resolution by 75%.&rdquo;
            </p>
            <footer className="text-sm">
              — Michael Torres, Integration Lead at Global Manufacturing Corp
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right Side - Onboarding Content */}
      <div className="lg:p-8 overflow-y-auto max-h-screen">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[550px] py-8">

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    index < currentStepIndex
                      ? "bg-primary text-primary-foreground"
                      : index === currentStepIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {index < currentStepIndex ? (
                    <IconCheck className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-12 h-0.5 mx-2",
                      index < currentStepIndex ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Profile */}
          {currentStep === "profile" && (
            <>
              <div className="flex flex-col space-y-4 text-center">
                <div className="flex flex-col space-y-2 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Welcome to CPI Connect! 👋
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Let&apos;s get started by setting up your profile
                  </p>
                </div>
              </div>

              <div className="grid gap-6">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">First name *</Label>
                    <Input
                      id="firstName"
                      placeholder="Your name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="companyName">Company name *</Label>
                    <Input
                      id="companyName"
                      placeholder="Acme Corporation"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-3">
                    <Label>What best describes your organization? *</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {organizationTypes.map((orgType) => (
                        <button
                          key={orgType.value}
                          onClick={() => setOrganizationType(orgType.value)}
                          type="button"
                          className={`p-4 text-left border-2 rounded-lg transition-all ${
                            organizationType === orgType.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <span className="font-medium text-sm">
                            {orgType.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <Label>Company size *</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {companySizes.map((size) => (
                        <button
                          key={size.value}
                          onClick={() => setCompanySize(size.value)}
                          type="button"
                          className={`p-4 text-left border-2 rounded-lg transition-all ${
                            companySize === size.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <span className="font-medium text-sm">
                            {size.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleProfileNext}
                    disabled={!firstName.trim() || !companyName.trim() || !organizationType || !companySize}
                    className="w-full"
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>

              <p className="px-8 text-center text-sm text-muted-foreground">
                Need help?{" "}
                <a
                  href="mailto:support@cpiconnect.io"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Contact Support
                </a>
              </p>
            </>
          )}

          {/* Step 2: CPI Tenant Configuration */}
          {currentStep === "tenant" && (
            <>
              <div className="flex flex-col space-y-2 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Connect your SAP CPI Tenant
                </h1>
                <p className="text-sm text-muted-foreground">
                  Add your first CPI tenant to start monitoring iFlows
                </p>
              </div>

              <div className="grid gap-6">
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
                      />
                    </div>
                    {slug && (
                      <p className="text-sm text-muted-foreground">
                        Tenant ID:{" "}
                        <code className="text-xs bg-secondary px-1 py-0.5 rounded">
                          {slug}
                        </code>
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="tenantUrl">CPI Tenant URL *</Label>
                    <Input
                      id="tenantUrl"
                      type="url"
                      value={tenantUrl}
                      onChange={(e) => setTenantUrl(e.target.value)}
                      placeholder="https://example.it-cpi.cfapps.eu10.hana.ondemand.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your SAP Cloud Integration tenant URL
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="authType">Authentication Type *</Label>
                    <Select value={authType} onValueChange={(value: "OAUTH" | "BASIC_AUTH" | "SERVICE_KEY") => setAuthType(value)}>
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

                  {/* OAuth 2.0 Fields */}
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
                        Service key authentication will be available in the next step.
                        You can configure it later in the tenant settings.
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

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCurrentStep("profile");
                        router.replace("/onboarding?step=profile");
                      }}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleTenantCreation}
                      disabled={
                        isLoading ||
                        !tenantName.trim() ||
                        !tenantUrl.trim() ||
                        (authType === "OAUTH" && (!authenticationUrl.trim() || !clientId.trim() || !clientSecret.trim())) ||
                        (authType === "BASIC_AUTH" && (!username.trim() || !password.trim()))
                      }
                      className="flex-1"
                    >
                      {isLoading ? (
                        isValidating ? "Validating Connection…" : "Creating Tenant…"
                      ) : (
                        "Connect Tenant"
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <p className="px-8 text-center text-sm text-muted-foreground">
                Need help?{" "}
                <a
                  href="mailto:support@cpiconnect.io"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Contact Support
                </a>
              </p>
            </>
          )}

          {/* Step 3: AI Model Selection */}
          {currentStep === "ai" && (
            <AIModelSelectionStep
              onComplete={async () => {
                await finalizeOnboarding();
                setCurrentStep("complete");
                router.replace("/onboarding?step=complete");
              }}
              onBack={() => {
                setCurrentStep("tenant");
                router.replace("/onboarding?step=tenant");
              }}
            />
          )}

          {/* Step 4: Success */}
          {currentStep === "complete" && (
            <>
              <div className="flex flex-col space-y-2 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">
                  You&apos;re all set! 🎉
                </h1>
                <p className="text-sm text-muted-foreground">
                  Your CPI tenant has been connected and you&apos;re ready to start monitoring
                </p>
              </div>

              <div className="grid gap-6">
                <div className="flex items-center justify-center p-6">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <IconCheck className="h-10 w-10 text-primary" />
                    </div>
                  </div>
                </div>

                <div className="bg-secondary/50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-3">
                    <IconServer className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <h3 className="font-medium">CPI Tenant Connected</h3>
                      <p className="text-sm text-muted-foreground">{tenantName}</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1 ml-8">
                    <p>✓ Authentication configured</p>
                    <p>✓ Ready to monitor iFlows</p>
                    <p>✓ Real-time alerts enabled</p>
                  </div>
                </div>

                <Button asChild size="lg" className="w-full">
                  <Link href="/dashboard">
                    <IconRocket className="h-4 w-4 mr-2" />
                    Go to Dashboard
                  </Link>
                </Button>
              </div>

              <p className="px-8 text-center text-sm text-muted-foreground">
                Need help?{" "}
                <a
                  href="mailto:support@cpiconnect.io"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Contact Support
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
