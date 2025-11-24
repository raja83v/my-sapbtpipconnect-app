import { getCurrentUser } from "@/app/actions/user";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // If user already completed onboarding, redirect to dashboard
  if (user.onboardingCompleted) {
    redirect("/dashboard");
  }

  return (
    <OnboardingFlow
      userName={user.name}
      userEmail={user.email}
    />
  );
}
