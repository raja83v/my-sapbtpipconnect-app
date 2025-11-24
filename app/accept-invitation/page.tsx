import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/actions/user";
import { AcceptInvitationClient } from "@/components/invitations/accept-invitation-client";

interface AcceptInvitationPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function AcceptInvitationPage({
  searchParams,
}: AcceptInvitationPageProps) {
  const params = await searchParams;
  const token = params.token;

  // Check if token exists
  if (!token) {
    redirect("/dashboard");
  }

  // Check if user is authenticated
  const user = await getCurrentUser();

  if (!user) {
    // Redirect to sign-up with callback URL to return here after login
    const callbackUrl = encodeURIComponent(`/accept-invitation?token=${token}`);
    redirect(`/sign-up?callbackUrl=${callbackUrl}`);
  }

  // User is authenticated, render client component to handle acceptance
  return <AcceptInvitationClient token={token} userEmail={user.email} />;
}
