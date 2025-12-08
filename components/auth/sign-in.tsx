"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { IconCloud } from "@tabler/icons-react";
import { buttonVariants } from "@/components/ui/button";
import { useSignIn, useAuth } from "@clerk/nextjs";
import type { EmailCodeFactor, SignInResource } from "@clerk/types";

export default function SignInAuth() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useAuth();
  const [mounted, setMounted] = useState(false);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [pendingEmailCode, setPendingEmailCode] = useState(false);

  // Extract callbackURL from query parameters for post-login redirect
  const rawCallbackUrl = searchParams.get("callbackUrl");

  // Prevent open redirects - only allow same-origin paths
  const callbackURL =
    rawCallbackUrl && rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//")
      ? rawCallbackUrl
      : "/dashboard";

  const isInvitation = rawCallbackUrl?.includes("accept-invitation");

  const signUpUrl = rawCallbackUrl
    ? `/sign-up?callbackUrl=${encodeURIComponent(rawCallbackUrl)}`
    : "/sign-up";

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push(callbackURL);
    }
  }, [isLoaded, isSignedIn, router, callbackURL]);

  if (!mounted || (isLoaded && isSignedIn)) {
    return (
      <div className="container relative hidden h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            <div className="flex items-center justify-center">
              <Spinner className="size-8" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle password sign-in
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || isRedirecting) return;

    setLoading(true);

    try {
      const signInAttempt = await signIn.create({
        identifier: email,
        password,
      });

      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        setIsRedirecting(true);
        router.push(callbackURL);
      } else {
        toast.error("Sign-in incomplete. Please try again.");
        setLoading(false);
      }
    } catch (err: any) {
      setLoading(false);
      if (err.errors?.[0]?.code === "form_identifier_not_found") {
        toast.error("Account not found", {
          description: "We couldn't find an account with that email.",
          action: {
            label: "Sign Up",
            onClick: () => router.push(signUpUrl),
          },
        });
      } else {
        toast.error(err.errors?.[0]?.message || "Failed to sign in");
      }
    }
  };

  // Handle email code sign-in (magic link alternative)
  const handleEmailCodeSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || isRedirecting) return;

    setLoading(true);

    try {
      if (!pendingEmailCode) {
        // Step 1: Create sign-in with email code strategy
        const signInAttempt = await signIn.create({
          identifier: email,
          strategy: "email_code",
        });

        const emailCodeFactor = signInAttempt.supportedFirstFactors.find(
          (factor): factor is EmailCodeFactor => factor.strategy === "email_code"
        );

        if (emailCodeFactor) {
          await signIn.prepareFirstFactor({
            strategy: "email_code",
            emailAddressId: emailCodeFactor.emailAddressId,
          });
          setPendingEmailCode(true);
          toast.success("Check your email for the verification code!");
        }
        setLoading(false);
      } else {
        // Step 2: Verify the email code
        const signInAttempt = await signIn.attemptFirstFactor({
          strategy: "email_code",
          code: emailCode,
        });

        if (signInAttempt.status === "complete") {
          await setActive({ session: signInAttempt.createdSessionId });
          setIsRedirecting(true);
          router.push(callbackURL);
        } else {
          toast.error("Verification incomplete. Please try again.");
          setLoading(false);
        }
      }
    } catch (err: any) {
      setLoading(false);
      toast.error(err.errors?.[0]?.message || "Failed to sign in");
    }
  };

  // Handle Google OAuth
  const handleGoogleSignIn = async () => {
    if (!isLoaded || isRedirecting) return;
    
    setLoading(true);

    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: callbackURL,
      });
      setIsRedirecting(true);
    } catch (err: any) {
      setLoading(false);
      toast.error(err.errors?.[0]?.message || "Failed to sign in with Google");
    }
  };

  return (
    <>
      <div className="container relative hidden h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <Link
          href={signUpUrl}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "absolute right-4 top-4 md:right-8 md:top-8"
          )}
        >
          Sign Up
        </Link>
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
          <div className="absolute inset-0 bg-zinc-900" />
          <Link href="/" className="relative z-20 flex items-center text-lg font-medium hover:opacity-80 transition-opacity">
            <IconCloud className="mr-2 h-6 w-6" />
            CPI Connect
          </Link>
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
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Sign in to your account
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your email below to sign in
              </p>
              {isInvitation && (
                <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Please sign in to accept your invitation.
                </div>
              )}
            </div>
            <div className="grid gap-6">
              <Tabs defaultValue="password" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="password">Login</TabsTrigger>
                  <TabsTrigger value="email-code">Email Code</TabsTrigger>
                </TabsList>
                <TabsContent value="password">
                  <form onSubmit={handlePasswordSignIn}>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="email-password">Email</Label>
                        <Input
                          id="email-password"
                          type="email"
                          placeholder="name@example.com"
                          required
                          onChange={(e) => setEmail(e.target.value)}
                          value={email}
                          disabled={loading}
                        />
                      </div>
                      <div className="grid gap-2">
                        <div className="flex items-center">
                          <Label htmlFor="password">Password</Label>
                          <a
                            href="https://accounts.clerk.com/sign-in"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto inline-block text-sm underline"
                          >
                            Forgot password?
                          </a>
                        </div>
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={loading}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="remember"
                          checked={rememberMe}
                          onCheckedChange={(checked) =>
                            setRememberMe(checked as boolean)
                          }
                        />
                        <label
                          htmlFor="remember"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Remember me
                        </label>
                      </div>
                      <Button
                        type="submit"
                        className="w-full justify-center"
                        disabled={loading || isRedirecting}
                      >
                        {(loading || isRedirecting) && (
                          <Spinner className="mr-2 size-4" aria-hidden="true" />
                        )}
                        <span>{isRedirecting ? "Redirecting..." : "Sign in with Password"}</span>
                      </Button>
                    </div>
                  </form>
                </TabsContent>
                <TabsContent value="email-code">
                  <form onSubmit={handleEmailCodeSignIn}>
                    <div className="grid gap-4 py-4">
                      {!pendingEmailCode ? (
                        <div className="grid gap-2">
                          <Label htmlFor="email-code">Email</Label>
                          <Input
                            id="email-code"
                            type="email"
                            placeholder="name@example.com"
                            required
                            onChange={(e) => setEmail(e.target.value)}
                            value={email}
                            disabled={loading}
                          />
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          <Label htmlFor="code">Verification Code</Label>
                          <Input
                            id="code"
                            type="text"
                            placeholder="Enter code from email"
                            required
                            onChange={(e) => setEmailCode(e.target.value)}
                            value={emailCode}
                            disabled={loading}
                            autoComplete="one-time-code"
                          />
                          <p className="text-xs text-muted-foreground">
                            Check your email for the verification code
                          </p>
                        </div>
                      )}
                      <Button
                        type="submit"
                        className="w-full justify-center"
                        disabled={loading || isRedirecting}
                      >
                        {loading && (
                          <Spinner className="mr-2 size-4" aria-hidden="true" />
                        )}
                        <span>{pendingEmailCode ? "Verify Code" : "Send Verification Code"}</span>
                      </Button>
                      {pendingEmailCode && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full"
                          onClick={() => {
                            setPendingEmailCode(false);
                            setEmailCode("");
                          }}
                        >
                          Use a different email
                        </Button>
                      )}
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full justify-center"
                disabled={loading || isRedirecting}
                onClick={handleGoogleSignIn}
              >
                {loading ? (
                  <Spinner className="mr-2 size-4" aria-hidden="true" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mr-2 h-4 w-4"
                    viewBox="0 0 256 262"
                    aria-hidden="true"
                  >
                    <path
                      fill="#4285F4"
                      d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
                    />
                    <path
                      fill="#34A853"
                      d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
                    />
                    <path
                      fill="#FBBC05"
                      d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
                    />
                    <path
                      fill="#EB4335"
                      d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
                    />
                  </svg>
                )}
                <span>Google</span>
              </Button>
            </div>
            <p className="px-8 text-center text-sm text-muted-foreground">
              By continuing, you agree to our{" "}
              <Link
                href="/terms"
                className="underline underline-offset-4 hover:text-primary"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="underline underline-offset-4 hover:text-primary"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
