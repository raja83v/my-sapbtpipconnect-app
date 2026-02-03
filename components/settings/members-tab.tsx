"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Link2, Check, Users, Zap, ArrowUpRight } from "lucide-react";
import { IconTrash } from "@tabler/icons-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { MemberInviteDialog } from "./member-invite-dialog";
import { MembersDataTable } from "./members-data-table";
import { LimitReachedBanner } from "@/components/billing";
import {
  getTenantMembers,
} from "@/app/actions/tenant-members";
import {
  getPendingInvitations,
  cancelInvitation,
} from "@/app/actions/tenant-invitations";
import { getUserSubscription } from "@/app/actions/billing";
import type { TenantMemberWithUser, PendingInvitation } from "@/types/workspace";
import type { PlanType } from "@/lib/stripe-config";
import { formatDate } from "@/lib/format";
import Link from "next/link";

interface MembersTabProps {
  tenantId: string;
  currentUserId: string;
}

export function MembersTab({ tenantId, currentUserId }: MembersTabProps) {
  const [members, setMembers] = useState<TenantMemberWithUser[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);
  const [cancelingInvitationId, setCancelingInvitationId] = useState<string | null>(null);
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null);

  // Subscription state
  const [plan, setPlan] = useState<PlanType>("FREE");
  const [teamMembersCurrent, setTeamMembersCurrent] = useState(0);
  const [teamMembersMax, setTeamMembersMax] = useState(3);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);

  async function loadMembers() {
    setIsLoadingMembers(true);
    try {
      const result = await getTenantMembers(tenantId);
      if (result.success && result.data) {
        setMembers(result.data);
      } else {
        toast.error(result.error || "Failed to load members");
      }
    } catch (error) {
      console.error("Error loading members:", error);
      toast.error("Failed to load members");
    } finally {
      setIsLoadingMembers(false);
    }
  }

  async function loadInvitations() {
    setIsLoadingInvitations(true);
    try {
      const result = await getPendingInvitations(tenantId);
      if (result.success && result.data) {
        setInvitations(result.data);
      } else {
        toast.error(result.error || "Failed to load invitations");
      }
    } catch (error) {
      console.error("Error loading invitations:", error);
      toast.error("Failed to load invitations");
    } finally {
      setIsLoadingInvitations(false);
    }
  }

  async function loadSubscription() {
    setIsLoadingSubscription(true);
    try {
      const result = await getUserSubscription();
      if (result.success && result.data?.subscription) {
        const sub = result.data.subscription;
        setPlan(sub.plan);
        setTeamMembersCurrent(sub.currentTeamMemberCount);
        setTeamMembersMax(sub.maxTeamMembers);
      }
    } catch (error) {
      console.error("Error loading subscription:", error);
    } finally {
      setIsLoadingSubscription(false);
    }
  }

  async function handleCancelInvitation(invitationId: string, email: string) {
    setCancelingInvitationId(invitationId);
    try {
      const result = await cancelInvitation({ invitationId });
      if (result.success) {
        toast.success(`Invitation to ${email} canceled`);
        loadInvitations();
      } else {
        toast.error(result.error || "Failed to cancel invitation");
      }
    } catch (error) {
      console.error("Error canceling invitation:", error);
      toast.error("Failed to cancel invitation");
    } finally {
      setCancelingInvitationId(null);
    }
  }

  async function handleCopyInviteLink(invitationId: string, token: string) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const inviteUrl = `${baseUrl}/accept-invitation?token=${token}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvitationId(invitationId);
      toast.success("Invitation link copied to clipboard!");

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedInvitationId(null);
      }, 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast.error("Failed to copy link");
    }
  }

  function handleRefresh() {
    loadMembers();
    loadInvitations();
    loadSubscription();
  }

  useEffect(() => {
    loadMembers();
    loadInvitations();
    loadSubscription();
  }, [tenantId]);

  // Calculate usage
  const isUnlimited = teamMembersMax === -1;
  const teamMembersRemaining = isUnlimited ? Infinity : Math.max(0, teamMembersMax - teamMembersCurrent);
  const teamMembersPercent = isUnlimited ? 0 : Math.min((teamMembersCurrent / teamMembersMax) * 100, 100);
  const isLimitApproaching = !isUnlimited && teamMembersPercent >= 80;
  const isLimitReached = !isUnlimited && teamMembersCurrent >= teamMembersMax;

  return (
    <div className="space-y-6">
      {/* Team Member Limit Banner */}
      {isLimitReached && (
        <LimitReachedBanner
          limitType="teamMembers"
          current={teamMembersCurrent}
          max={teamMembersMax}
          currentPlan={plan}
          variant="warning"
        />
      )}

      {/* Members Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Team Members
                {!isLoadingSubscription && (
                  <span className={`text-sm font-normal ${isLimitReached ? "text-destructive" : isLimitApproaching ? "text-yellow-600" : "text-muted-foreground"}`}>
                    ({teamMembersCurrent}/{isUnlimited ? "∞" : teamMembersMax})
                  </span>
                )}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                Manage members and their roles in your workspace
                {isLimitApproaching && !isLimitReached && plan !== "ENTERPRISE" && (
                  <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                    <Link href="/dashboard/settings/billing">
                      <Zap className="mr-1 h-3 w-3" />
                      Upgrade for more
                    </Link>
                  </Button>
                )}
              </CardDescription>
            </div>
            <MemberInviteDialog
              workspaceId={tenantId}
              onInviteSent={handleRefresh}
            />
          </div>
          {!isUnlimited && !isLoadingSubscription && (
            <Progress
              value={teamMembersPercent}
              className={`h-1.5 mt-3 ${teamMembersPercent >= 100 ? "[&>div]:bg-destructive" : teamMembersPercent >= 80 ? "[&>div]:bg-yellow-500" : ""}`}
            />
          )}
        </CardHeader>
        <CardContent>
          {isLoadingMembers ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <MembersDataTable
              members={members}
              currentUserId={currentUserId}
              onUpdate={handleRefresh}
            />
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations Section */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            Invitations that have been sent but not yet accepted
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingInvitations ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending invitations
            </div>
          ) : (
            <div className="space-y-4">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{invitation.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Invited by {invitation.invitedBy.name || invitation.invitedBy.email}{" "}
                          on {formatDate(invitation.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      Role: {invitation.role}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleCopyInviteLink(invitation.id, invitation.token)}
                      disabled={copiedInvitationId === invitation.id}
                      title="Copy invitation link"
                    >
                      {copiedInvitationId === invitation.id ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleCancelInvitation(invitation.id, invitation.email)}
                      disabled={cancelingInvitationId === invitation.id}
                      title="Cancel invitation"
                    >
                      {cancelingInvitationId === invitation.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <IconTrash className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
