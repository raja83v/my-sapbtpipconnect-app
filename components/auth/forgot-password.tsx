"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { IconInnerShadowTop, IconCheck, IconAlertCircle } from "@tabler/icons-react";
import { buttonVariants } from "@/components/ui/button";

export default function ForgotPasswordAuth() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await authClient.forgetPassword({
        email,
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
      });

      setSuccess(true);
    } catch (err) {
      console.error("Password reset request failed:", err);
      setError("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="container relative hidden h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <Link
          href="/sign-in"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "absolute right-4 top-4 md:right-8 md:top-8"
          )}
        >
          Back to Sign In
        </Link>
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
          <div className="absolute inset-0 bg-zinc-900" />
          <div className="relative z-20 flex items-center text-lg font-medium">
            <IconInnerShadowTop className="mr-2 h-6 w-6" />
            HagenKit
          </div>
          <div className="relative z-20 mt-auto">
            <blockquote className="space-y-2">
              <p className="text-lg">
                &ldquo;Password recovery made simple. Get back to building your
                product in seconds, not hours.&rdquo;
              </p>
              <footer className="text-sm">Security Team</footer>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Reset your password
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your email address and we'll send you a link to reset your
                password
              </p>
            </div>

            {success ? (
              <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                <div className="flex items-start gap-3">
                  <IconCheck className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-500">Check your email</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      We've sent a password reset link to <strong>{email}</strong>.
                      The link will expire in 1 hour.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Didn't receive the email? Check your spam folder or{" "}
                      <button
                        onClick={() => {
                          setSuccess(false);
                          setEmail("");
                        }}
                        className="text-green-500 underline hover:no-underline"
                      >
                        try again
                      </button>
                      .
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-6">
                <form onSubmit={handleSubmit}>
                  <div className="grid gap-4">
                    {error && (
                      <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3">
                        <div className="flex items-center gap-2">
                          <IconAlertCircle className="h-4 w-4 text-red-500" />
                          <p className="text-sm text-red-500">{error}</p>
                        </div>
                      </div>
                    )}

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
                        autoComplete="email"
                      />
                    </div>

                    <Button type="submit" disabled={loading} className="w-full">
                      {loading ? (
                        <>
                          <Spinner className="mr-2" />
                          Sending reset link...
                        </>
                      ) : (
                        "Send reset link"
                      )}
                    </Button>
                  </div>
                </form>

                <div className="text-center text-sm text-muted-foreground">
                  Remember your password?{" "}
                  <Link
                    href="/sign-in"
                    className="underline underline-offset-4 hover:text-primary"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile view */}
      <div className="flex min-h-screen flex-col items-center justify-center p-6 md:hidden">
        <div className="flex items-center text-lg font-medium mb-8">
          <IconInnerShadowTop className="mr-2 h-6 w-6" />
          HagenKit
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Reset your password
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your email address and we'll send you a link to reset your
              password
            </p>
          </div>

          {success ? (
            <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
              <div className="flex items-start gap-3">
                <IconCheck className="h-5 w-5 text-green-500 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-500">Check your email</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    We've sent a password reset link to <strong>{email}</strong>.
                    The link will expire in 1 hour.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Didn't receive the email? Check your spam folder or{" "}
                    <button
                      onClick={() => {
                        setSuccess(false);
                        setEmail("");
                      }}
                      className="text-green-500 underline hover:no-underline"
                    >
                      try again
                    </button>
                    .
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-6">
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4">
                  {error && (
                    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3">
                      <div className="flex items-center gap-2">
                        <IconAlertCircle className="h-4 w-4 text-red-500" />
                        <p className="text-sm text-red-500">{error}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="email-mobile">Email</Label>
                    <Input
                      id="email-mobile"
                      type="email"
                      placeholder="name@example.com"
                      required
                      onChange={(e) => setEmail(e.target.value)}
                      value={email}
                      disabled={loading}
                      autoComplete="email"
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <Spinner className="mr-2" />
                        Sending reset link...
                      </>
                    ) : (
                      "Send reset link"
                    )}
                  </Button>
                </div>
              </form>

              <div className="text-center text-sm text-muted-foreground">
                Remember your password?{" "}
                <Link
                  href="/sign-in"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Sign in
                </Link>
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link
              href="/sign-in"
              className={cn(buttonVariants({ variant: "ghost" }), "w-full")}
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
