"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Spinner } from "@/components/ui/spinner";
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";

function SSOCallbackContent() {
  const { isLoaded, user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRedirected = useRef(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    async function checkOnboarding() {
      // Prevent multiple redirects
      if (!isLoaded || !user || hasRedirected.current || isChecking) {
        return;
      }

      hasRedirected.current = true;
      setIsChecking(true);

      try {
        // Fetch user from database to check onboarding status
        const response = await fetch("/api/auth/onboarding-status");
        
        if (!response.ok) {
          // If user doesn't exist in DB yet, redirect to onboarding
          console.log("User not found in DB, redirecting to onboarding");
          router.push("/onboarding");
          return;
        }

        const data = await response.json();
        
        // Get the intended redirect URL from the search params
        const redirectUrl = searchParams.get("redirect_url") || "/dashboard";

        if (!data.onboardingCompleted) {
          console.log("Onboarding not completed, redirecting to onboarding");
          router.push("/onboarding");
        } else {
          console.log("Onboarding completed, redirecting to:", redirectUrl);
          router.push(redirectUrl);
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
        // Default to onboarding on error
        router.push("/onboarding");
      }
    }

    checkOnboarding();
  }, [isLoaded, user, router, searchParams, isChecking]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Spinner className="mx-auto mb-4 size-8" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}

export default function SSOCallback() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <Spinner className="mx-auto mb-4 size-8" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <SSOCallbackContent />
    </Suspense>
  );
}
