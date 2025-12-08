"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { IconCloud } from "@tabler/icons-react";
import { buttonVariants } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignUp, useAuth } from "@clerk/nextjs";

export default function SignUpAuth() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn } = useAuth();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);

  // Extract callbackURL from query parameters
  const rawCallbackUrl = searchParams.get("callbackUrl");
  const callbackURL =
    rawCallbackUrl && rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//")
      ? rawCallbackUrl
      : "/onboarding";

  const isInvitation = rawCallbackUrl?.includes("accept-invitation");

  const signInUrl = rawCallbackUrl
    ? `/sign-in?callbackUrl=${encodeURIComponent(rawCallbackUrl)}`
    : "/sign-in";

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  // Show loading state while checking auth or if already signed in
  if (!isLoaded || isSignedIn) {
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

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setLoading(true);

    try {
      if (!pendingVerification) {
        // Step 1: Create the sign-up
        await signUp.create({
          emailAddress: email,
          password,
          firstName: name.split(" ")[0],
          lastName: name.split(" ").slice(1).join(" ") || undefined,
        });

        // Step 2: Send email verification code
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

        setPendingVerification(true);
        toast.success("Check your email for a verification code");
        setLoading(false);
      } else {
        // Step 3: Verify the email code
        const completeSignUp = await signUp.attemptEmailAddressVerification({
          code: emailCode,
        });

        if (completeSignUp.status === "complete") {
          await setActive({ session: completeSignUp.createdSessionId });
          router.push("/onboarding");
        } else {
          toast.error("Verification incomplete. Please try again.");
          setLoading(false);
        }
      }
    } catch (err: any) {
      setLoading(false);
      toast.error(err.errors?.[0]?.message || "Failed to sign up");
    }
  };

  // Handle Google OAuth
  const handleGoogleSignUp = async () => {
    if (!isLoaded) return;

    setLoading(true);

    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: callbackURL,
      });
    } catch (err: any) {
      setLoading(false);
      toast.error(err.errors?.[0]?.message || "Failed to sign up with Google");
    }
  };

  return (
    <>
      <div className="container relative hidden h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <Link
          href={signInUrl}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "absolute right-4 top-4 md:right-8 md:top-8"
          )}
        >
          Sign In
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
                &ldquo;Managing 8 different CPI tenants was a nightmare until we
                found CPI Connect. The unified dashboard makes it effortless to
                monitor all our SAP integrations from one place.&rdquo;
              </p>
              <footer className="text-sm">
                — James Anderson, Head of IT Operations at Retail Enterprise
              </footer>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Create an account
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your email below to create your account
              </p>
              {isInvitation && (
                <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Create an account to accept your invitation.
                </div>
              )}
            </div>
            <div className="grid gap-6">
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4">
                  {!pendingVerification ? (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          placeholder="John Doe"
                          required
                          onChange={(e) => setName(e.target.value)}
                          value={name}
                          disabled={loading}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="name@example.com"
                          required
                          onChange={(e) => setEmail(e.target.value)}
                          value={email}
                          disabled={loading}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="new-password"
                          required
                          disabled={loading}
                        />
                      </div>
                    </>
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
                        We sent a verification code to {email}
                      </p>
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full justify-center"
                    disabled={loading}
                  >
                    {loading && (
                      <Spinner className="mr-2 size-4" aria-hidden="true" />
                    )}
                    <span>{pendingVerification ? "Verify Email" : "Create account"}</span>
                  </Button>
                  {pendingVerification && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setPendingVerification(false);
                        setEmailCode("");
                      }}
                    >
                      Use a different email
                    </Button>
                  )}
                </div>
              </form>
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
                disabled={loading || pendingVerification}
                onClick={handleGoogleSignUp}
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
