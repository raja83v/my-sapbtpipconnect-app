"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Link2, Check } from "lucide-react";
import { IconTrash } from "@tabler/icons-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MemberInviteDialog } from "./member-invite-dialog";
import { MembersDataTable } from "./members-data-table";
import {
  getWorkspaceMembers,
} from "@/app/actions/workspace-members";
import {
  getPendingInvitations,
  cancelInvitation,
} from "@/app/actions/workspace-invitations";
import type { WorkspaceMemberWithUser, PendingInvitation } from "@/types/workspace";
import { formatDate } from "@/lib/format";

interface MembersTabProps {
  workspaceId: string;
  currentUserId: string;
}

export function MembersTab({ workspaceId, currentUserId }: MembersTabProps) {
  const [members, setMembers] = useState<WorkspaceMemberWithUser[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);
  const [cancelingInvitationId, setCancelingInvitationId] = useState<string | null>(null);
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null);

  async function loadMembers() {
    setIsLoadingMembers(true);
    try {
      const result = await getWorkspaceMembers(workspaceId);
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
      const result = await getPendingInvitations(workspaceId);
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
  }

  useEffect(() => {
    loadMembers();
    loadInvitations();
  }, [workspaceId]);

  return (
    <div className="space-y-6">
      {/* Members Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Manage members and their roles in your workspace
              </CardDescription>
            </div>
            <MemberInviteDialog
              workspaceId={workspaceId}
              onInviteSent={handleRefresh}
            />
          </div>
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
