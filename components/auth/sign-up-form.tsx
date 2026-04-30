"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { Cloud } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

export function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  // Preserve ?plan= and ?interval= from the pricing page through onboarding
  const planParam = searchParams.get("plan");
  const intervalParam = searchParams.get("interval");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const { error: signUpError } = await authClient.signUp.email({
        email: email.toLowerCase().trim(),
        password,
        name: name.trim() || email.split("@")[0],
      });

      if (signUpError) {
        setError(signUpError.message ?? "Registration failed");
        return;
      }

      await refreshUser();
      // Pass the selected plan and billing interval forward so onboarding can pre-select them
      const params = new URLSearchParams();
      if (planParam) params.set("plan", planParam);
      if (intervalParam) params.set("interval", intervalParam);
      const query = params.toString();
      const dest = query ? `/onboarding?${query}` : "/onboarding";
      router.push(dest);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  const formContent = (idSuffix: string = "") => (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-4">
          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor={`name${idSuffix}`}>Name</Label>
            <Input
              id={`name${idSuffix}`}
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`email${idSuffix}`}>Email</Label>
            <Input
              id={`email${idSuffix}`}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`password${idSuffix}`}>Password</Label>
            <Input
              id={`password${idSuffix}`}
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`confirmPassword${idSuffix}`}>
              Confirm Password
            </Label>
            <Input
              id={`confirmPassword${idSuffix}`}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              disabled={isLoading}
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Spinner className="mr-2" />
                Creating account…
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </div>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="underline underline-offset-4 hover:text-primary"
        >
          Sign in
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: Two-panel layout */}
      <div className="container relative hidden h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <Link
          href="/sign-in"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "absolute right-4 top-4 md:right-8 md:top-8"
          )}
        >
          Sign In
        </Link>

        <AuthBrandPanel />

        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Create an account
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your details to get started
              </p>
            </div>
            {formContent()}
          </div>
        </div>
      </div>

      {/* Mobile: Full-screen centered form */}
      <div className="flex min-h-screen flex-col items-center justify-center p-6 md:hidden">
        <div className="flex items-center gap-2 text-lg font-medium mb-8">
          <Cloud className="h-6 w-6 text-indigo-600" strokeWidth={1.5} />
          <span className="bg-linear-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent font-bold">
            CPI Connect
          </span>
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Create an account
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your details to get started
            </p>
          </div>
          {formContent("-mobile")}
        </div>
      </div>
    </>
  );
}
