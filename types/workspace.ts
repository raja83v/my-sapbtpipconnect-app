/**
 * Workspace-related type definitions
 */

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export interface WorkspaceMemberWithUser {
  id: string;
  role: WorkspaceRole;
  joinedAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface WorkspaceWithRole {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  memberRole: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
}
