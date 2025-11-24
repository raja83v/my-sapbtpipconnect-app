"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import {
  IconInnerShadowTop,
  IconCheck,
  IconAlertCircle,
  IconX,
} from "@tabler/icons-react";
import { buttonVariants } from "@/components/ui/button";

// Password strength validation
const validatePasswordStrength = (password: string) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return {
    isValid:
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumber &&
      hasSpecialChar,
    checks: {
      minLength: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumber,
      hasSpecialChar,
    },
  };
};

export default function ResetPasswordAuth() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const tokenError = searchParams.get("error");

  const passwordValidation = validatePasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== "";

  useEffect(() => {
    if (tokenError === "INVALID_TOKEN") {
      setError("This password reset link is invalid or has expired. Please request a new one.");
    }
  }, [tokenError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate token exists
    if (!token) {
      setError("No reset token provided. Please use the link from your email.");
      setLoading(false);
      return;
    }

    // Validate password strength
    if (!passwordValidation.isValid) {
      setError("Please ensure your password meets all requirements.");
      setLoading(false);
      return;
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const result = await authClient.resetPassword({
        newPassword,
        token,
      });

      if (result.error) {
        if (result.error.message?.includes("token")) {
          setError("This reset link has expired or is invalid. Please request a new one.");
        } else {
          setError(result.error.message || "Failed to reset password. Please try again.");
        }
        return;
      }

      setSuccess(true);
      // Redirect to sign-in after 2 seconds
      setTimeout(() => {
        router.push("/sign-in?reset=success");
      }, 2000);
    } catch (err) {
      console.error("Password reset failed:", err);
      setError("Failed to reset password. Please try again.");
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
                &ldquo;Security first. Strong passwords protect your account and
                your team's data.&rdquo;
              </p>
              <footer className="text-sm">Security Team</footer>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[380px]">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Set new password
              </h1>
              <p className="text-sm text-muted-foreground">
                Choose a strong password for your account
              </p>
            </div>

            {success ? (
              <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                <div className="flex items-start gap-3">
                  <IconCheck className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-500">
                      Password reset successful!
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your password has been updated. Redirecting you to sign in...
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
                        <div className="flex items-start gap-2">
                          <IconAlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                          <p className="text-sm text-red-500">{error}</p>
                        </div>
                      </div>
                    )}

                    {tokenError && (
                      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
                        <div className="flex items-center gap-2">
                          <IconAlertCircle className="h-4 w-4 text-yellow-500" />
                          <p className="text-sm text-yellow-600">
                            Invalid or expired token.{" "}
                            <Link
                              href="/forgot-password"
                              className="underline hover:no-underline"
                            >
                              Request a new reset link
                            </Link>
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label htmlFor="password">New Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setShowValidation(true);
                        }}
                        value={newPassword}
                        disabled={loading || !!tokenError}
                        autoComplete="new-password"
                      />
                    </div>

                    {showValidation && newPassword && (
                      <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                        <p className="font-medium mb-2">Password must contain:</p>
                        <div className="space-y-1">
                          <PasswordRequirement
                            met={passwordValidation.checks.minLength}
                            text="At least 8 characters"
                          />
                          <PasswordRequirement
                            met={passwordValidation.checks.hasUpperCase}
                            text="One uppercase letter"
                          />
                          <PasswordRequirement
                            met={passwordValidation.checks.hasLowerCase}
                            text="One lowercase letter"
                          />
                          <PasswordRequirement
                            met={passwordValidation.checks.hasNumber}
                            text="One number"
                          />
                          <PasswordRequirement
                            met={passwordValidation.checks.hasSpecialChar}
                            text="One special character (!@#$%^&*)"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="••••••••"
                        required
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        value={confirmPassword}
                        disabled={loading || !!tokenError}
                        autoComplete="new-password"
                      />
                      {confirmPassword && !passwordsMatch && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <IconX className="h-3 w-3" />
                          Passwords do not match
                        </p>
                      )}
                      {confirmPassword && passwordsMatch && (
                        <p className="text-xs text-green-500 flex items-center gap-1">
                          <IconCheck className="h-3 w-3" />
                          Passwords match
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={
                        loading ||
                        !!tokenError ||
                        !passwordValidation.isValid ||
                        !passwordsMatch
                      }
                      className="w-full"
                    >
                      {loading ? (
                        <>
                          <Spinner className="mr-2" />
                          Resetting password...
                        </>
                      ) : (
                        "Reset password"
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
              Set new password
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose a strong password for your account
            </p>
          </div>

          {success ? (
            <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
              <div className="flex items-start gap-3">
                <IconCheck className="h-5 w-5 text-green-500 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-500">
                    Password reset successful!
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your password has been updated. Redirecting you to sign in...
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
                      <div className="flex items-start gap-2">
                        <IconAlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                        <p className="text-sm text-red-500">{error}</p>
                      </div>
                    </div>
                  )}

                  {tokenError && (
                    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
                      <div className="flex items-center gap-2">
                        <IconAlertCircle className="h-4 w-4 text-yellow-500" />
                        <p className="text-sm text-yellow-600">
                          Invalid or expired token.{" "}
                          <Link
                            href="/forgot-password"
                            className="underline hover:no-underline"
                          >
                            Request a new reset link
                          </Link>
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="password-mobile">New Password</Label>
                    <Input
                      id="password-mobile"
                      type="password"
                      placeholder="••••••••"
                      required
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setShowValidation(true);
                      }}
                      value={newPassword}
                      disabled={loading || !!tokenError}
                      autoComplete="new-password"
                    />
                  </div>

                  {showValidation && newPassword && (
                    <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                      <p className="font-medium mb-2">Password must contain:</p>
                      <div className="space-y-1">
                        <PasswordRequirement
                          met={passwordValidation.checks.minLength}
                          text="At least 8 characters"
                        />
                        <PasswordRequirement
                          met={passwordValidation.checks.hasUpperCase}
                          text="One uppercase letter"
                        />
                        <PasswordRequirement
                          met={passwordValidation.checks.hasLowerCase}
                          text="One lowercase letter"
                        />
                        <PasswordRequirement
                          met={passwordValidation.checks.hasNumber}
                          text="One number"
                        />
                        <PasswordRequirement
                          met={passwordValidation.checks.hasSpecialChar}
                          text="One special character (!@#$%^&*)"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="confirm-password-mobile">Confirm Password</Label>
                    <Input
                      id="confirm-password-mobile"
                      type="password"
                      placeholder="••••••••"
                      required
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      value={confirmPassword}
                      disabled={loading || !!tokenError}
                      autoComplete="new-password"
                    />
                    {confirmPassword && !passwordsMatch && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <IconX className="h-3 w-3" />
                        Passwords do not match
                      </p>
                    )}
                    {confirmPassword && passwordsMatch && (
                      <p className="text-xs text-green-500 flex items-center gap-1">
                        <IconCheck className="h-3 w-3" />
                        Passwords match
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      loading ||
                      !!tokenError ||
                      !passwordValidation.isValid ||
                      !passwordsMatch
                    }
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Spinner className="mr-2" />
                        Resetting password...
                      </>
                    ) : (
                      "Reset password"
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

// Helper component for password requirements
function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <IconCheck className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <IconX className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className={cn("text-xs", met ? "text-green-600" : "text-muted-foreground")}>
        {text}
      </span>
    </div>
  );
}
