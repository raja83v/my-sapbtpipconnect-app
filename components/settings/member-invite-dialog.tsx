"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { IconUserPlus } from "@tabler/icons-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { inviteMember } from "@/app/actions/workspace-invitations";
import type { InviteMemberInput } from "@/lib/validations/workspace";
import type { WorkspaceRole } from "@/types/workspace";
import { z } from "zod";

// Form-specific schema with explicit role field
const inviteFormSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type InviteFormInput = z.infer<typeof inviteFormSchema>;

interface MemberInviteDialogProps {
  workspaceId: string;
  onInviteSent?: () => void;
}

export function MemberInviteDialog({ workspaceId, onInviteSent }: MemberInviteDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<WorkspaceRole>("MEMBER");

  const form = useForm<InviteFormInput>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: InviteFormInput) {
    setIsLoading(true);
    try {
      const result = await inviteMember({
        workspaceId,
        email: data.email,
        role: selectedRole,
      });

      if (result.success) {
        toast.success("Invitation sent successfully");
        setIsOpen(false);
        form.reset();
        setSelectedRole("MEMBER");
        onInviteSent?.();
      } else {
        toast.error(result.error || "Failed to send invitation");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Error inviting member:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <IconUserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation email to add a new member to your workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            {/* Email Field */}
            <Field>
              <FieldLabel htmlFor="invite-email">Email Address</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                disabled={isLoading}
                {...form.register("email")}
              />
              <FieldDescription>
                The email address of the person you want to invite.
              </FieldDescription>
              <FieldError errors={[form.formState.errors.email]} />
            </Field>

            {/* Role Field */}
            <Field>
              <FieldLabel htmlFor="invite-role">Role</FieldLabel>
              <Select
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as WorkspaceRole)}
                disabled={isLoading}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">Viewer - Read-only access</SelectItem>
                  <SelectItem value="MEMBER">Member - Standard access</SelectItem>
                  <SelectItem value="ADMIN">Admin - Can manage members and settings</SelectItem>
                  <SelectItem value="OWNER">Owner - Full control</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Defines what this member can do in the workspace.
              </FieldDescription>
            </Field>

            {/* Action Buttons */}
            <Field orientation="horizontal">
              <div className="flex justify-end gap-3 w-full">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Invitation
                </Button>
              </div>
            </Field>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
