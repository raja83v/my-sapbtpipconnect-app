import { z } from "zod";

// Schema for creating a new workspace
export const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(100, "Name is too long"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50, "Slug is too long")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
    .regex(/^[a-z0-9]/, "Slug must start with a letter or number")
    .regex(/[a-z0-9]$/, "Slug must end with a letter or number"),
  image: z.string().url("Invalid image URL").optional().or(z.literal("")),
});

// Schema for updating a workspace
export const updateWorkspaceSchema = z.object({
  id: z.string().min(1, "Workspace ID is required"),
  name: z.string().min(1, "Workspace name is required").max(100, "Name is too long").optional(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50, "Slug is too long")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
    .regex(/^[a-z0-9]/, "Slug must start with a letter or number")
    .regex(/[a-z0-9]$/, "Slug must end with a letter or number")
    .optional(),
  image: z.string().url("Invalid image URL").optional().or(z.literal("")),
});

// Schema for deleting a workspace
export const deleteWorkspaceSchema = z.object({
  id: z.string().min(1, "Workspace ID is required"),
});

// Workspace role enum
export const workspaceRoleEnum = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);

// Schema for inviting a member to workspace
export const inviteMemberSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required"),
  email: z.string().email("Invalid email address"),
  role: workspaceRoleEnum.default("MEMBER"),
});

// Schema for updating a member's role
export const updateMemberRoleSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
  role: workspaceRoleEnum,
});

// Schema for removing a member
export const removeMemberSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
});

// Schema for canceling an invitation
export const cancelInvitationSchema = z.object({
  invitationId: z.string().min(1, "Invitation ID is required"),
});

// Schema for accepting an invitation
export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

// TypeScript types from schemas
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type DeleteWorkspaceInput = z.infer<typeof deleteWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
export type CancelInvitationInput = z.infer<typeof cancelInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
