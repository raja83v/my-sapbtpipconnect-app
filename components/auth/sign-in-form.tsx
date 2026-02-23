"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Cloud } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  const redirectUrl = searchParams.get("redirect") || "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      await refreshUser();
      router.push(redirectUrl);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* Desktop: Two-panel layout */}
      <div className="container relative hidden h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <Link
          href="/sign-up"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "absolute right-4 top-4 md:right-8 md:top-8"
          )}
        >
          Create Account
        </Link>

        <AuthBrandPanel
          testimonial={{
            quote:
              "CPI Connect transformed our integration monitoring. We now identify and resolve issues in minutes instead of hours.",
            author: "Michael Torres",
            title: "Integration Lead, Global Manufacturing Corp",
          }}
        />

        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Welcome back
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your email and password to sign in
              </p>
            </div>

            <div className="grid gap-6">
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4">
                  {error && (
                    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3">
                      <p className="text-sm text-red-500">{error}</p>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      disabled={isLoading}
                    />
                  </div>

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <>
                        <Spinner className="mr-2" />
                        Signing in…
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              </form>

              <div className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link
                  href="/sign-up"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Sign up
                </Link>
              </div>
            </div>
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
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your email and password to sign in
            </p>
          </div>

          <div className="grid gap-6">
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4">
                {error && (
                  <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3">
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="email-mobile">Email</Label>
                  <Input
                    id="email-mobile"
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password-mobile">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password-mobile"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                </div>

                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Spinner className="mr-2" />
                      Signing in…
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </div>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/sign-up"
                className="underline underline-offset-4 hover:text-primary"
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
