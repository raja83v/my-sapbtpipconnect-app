"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IconTrash } from "@tabler/icons-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { updateMemberRole, removeMember } from "@/app/actions/workspace-members";
import type { WorkspaceMemberWithUser, WorkspaceRole } from "@/types/workspace";
import { formatDate } from "@/lib/format";

interface MembersDataTableProps {
  members: WorkspaceMemberWithUser[];
  currentUserId: string;
  onUpdate?: () => void;
}

export function MembersDataTable({
  members,
  currentUserId,
  onUpdate,
}: MembersDataTableProps) {
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  async function handleRoleChange(memberId: string, newRole: WorkspaceRole) {
    setUpdatingMemberId(memberId);
    try {
      const result = await updateMemberRole({
        memberId,
        role: newRole,
      });

      if (result.success) {
        toast.success("Member role updated successfully");
        onUpdate?.();
      } else {
        toast.error(result.error || "Failed to update role");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Error updating role:", error);
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function handleRemoveMember(memberId: string, memberName: string) {
    setRemovingMemberId(memberId);
    try {
      const result = await removeMember({ memberId });

      if (result.success) {
        toast.success(`${memberName} removed from workspace`);
        onUpdate?.();
      } else {
        toast.error(result.error || "Failed to remove member");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Error removing member:", error);
    } finally {
      setRemovingMemberId(null);
    }
  }

  const getRoleBadgeVariant = (role: WorkspaceRole) => {
    switch (role) {
      case "OWNER":
        return "default";
      case "ADMIN":
        return "secondary";
      case "MEMBER":
        return "outline";
      case "VIEWER":
        return "outline";
      default:
        return "outline";
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No members found
              </TableCell>
            </TableRow>
          ) : (
            members.map((member) => {
              const isCurrentUser = member.user.id === currentUserId;
              const isUpdating = updatingMemberId === member.id;
              const isRemoving = removingMemberId === member.id;

              return (
                <TableRow key={member.id}>
                  {/* Member Info */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={member.user.image || undefined}
                          alt={member.user.name || member.user.email}
                        />
                        <AvatarFallback className="text-xs">
                          {getInitials(member.user.name, member.user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {member.user.name || member.user.email}
                          {isCurrentUser && (
                            <Badge variant="outline" className="ml-2">
                              You
                            </Badge>
                          )}
                        </span>
                        {member.user.name && (
                          <span className="text-xs text-muted-foreground">
                            {member.user.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Role */}
                  <TableCell>
                    {isCurrentUser ? (
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                    ) : (
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          handleRoleChange(member.id, value as WorkspaceRole)
                        }
                        disabled={isUpdating || isRemoving}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                          <SelectItem value="MEMBER">Member</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="OWNER">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>

                  {/* Joined Date */}
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(member.joinedAt)}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    {!isCurrentUser && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={isUpdating || isRemoving}
                          >
                            {isRemoving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <IconTrash className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Member</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove{" "}
                              <span className="font-semibold">
                                {member.user.name || member.user.email}
                              </span>{" "}
                              from this workspace? They will lose access to all workspace
                              resources.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleRemoveMember(
                                  member.id,
                                  member.user.name || member.user.email
                                )
                              }
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
