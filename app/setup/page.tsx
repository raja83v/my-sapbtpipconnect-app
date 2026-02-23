"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminSetupForm } from "@/components/auth/admin-setup-form";

export default function SetupPage() {
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkSetup() {
      try {
        const res = await fetch("/api/auth/setup");
        const data = await res.json();
        if (!data.setupRequired) {
          router.push("/sign-in");
        } else {
          setSetupRequired(true);
        }
      } catch {
        setSetupRequired(false);
      }
    }
    checkSetup();
  }, [router]);

  if (setupRequired === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!setupRequired) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <AdminSetupForm />
    </div>
  );
}
