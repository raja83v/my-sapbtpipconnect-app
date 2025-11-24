"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitation } from "@/app/actions/workspace-invitations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";

interface AcceptInvitationClientProps {
  token: string;
  userEmail: string;
}

type InvitationState = "loading" | "success" | "error";

export function AcceptInvitationClient({
  token,
  userEmail,
}: AcceptInvitationClientProps) {
  const [state, setState] = useState<InvitationState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    async function handleAcceptInvitation() {
      try {
        const result = await acceptInvitation({ token });

        if (result.success && result.data) {
          setState("success");
          setWorkspaceId(result.data.workspaceId);
          toast.success("Invitation accepted successfully!");

          // Redirect to dashboard after 2 seconds with hard navigation
          // This ensures Better-auth session is refreshed and workspace membership is loaded
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 2000);
        } else {
          setState("error");
          setErrorMessage(result.error || "Failed to accept invitation");
          toast.error(result.error || "Failed to accept invitation");
        }
      } catch (error) {
        setState("error");
        setErrorMessage("An unexpected error occurred");
        toast.error("An unexpected error occurred");
        console.error("Error accepting invitation:", error);
      }
    }

    handleAcceptInvitation();
  }, [token, router]);

  return (
    <div className="container flex items-center justify-center min-h-screen py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {state === "loading" && (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            )}
            {state === "success" && (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            )}
            {state === "error" && <XCircle className="h-6 w-6 text-red-600" />}
          </div>
          <CardTitle>
            {state === "loading" && "Accepting Invitation..."}
            {state === "success" && "Invitation Accepted!"}
            {state === "error" && "Unable to Accept Invitation"}
          </CardTitle>
          <CardDescription>
            {state === "loading" &&
              "Please wait while we process your invitation"}
            {state === "success" &&
              "You've successfully joined the workspace. Redirecting..."}
            {state === "error" && errorMessage}
          </CardDescription>
        </CardHeader>

        {state === "error" && (
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-muted bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Signed in as:</p>
                  <p className="text-sm text-muted-foreground">{userEmail}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Common reasons for failure:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Invitation has expired</li>
                <li>Invitation was sent to a different email address</li>
                <li>You're already a member of this workspace</li>
                <li>Invalid invitation link</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/dashboard")}
              >
                Go to Dashboard
              </Button>
              <Button
                className="flex-1"
                onClick={() => router.push("/dashboard/settings?section=members")}
              >
                View Settings
              </Button>
            </div>
          </CardContent>
        )}

        {state === "success" && (
          <CardContent>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
              <p className="text-sm text-green-800 dark:text-green-200">
                You'll be redirected to your dashboard shortly...
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
