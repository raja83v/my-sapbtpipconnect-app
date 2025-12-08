/**
 * Workspace and Tenant related type definitions
 * Note: "Workspace" is now a legacy alias for "Tenant" (CpiTenant)
 */

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type TenantRole = WorkspaceRole; // Alias

export interface TenantMemberWithUser {
  id: string;
  role: TenantRole;
  joinedAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
}

// Legacy alias
export type WorkspaceMemberWithUser = TenantMemberWithUser;

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

export interface TenantWithRole {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tenantUrl: string;
  authType: string;
  status: string;
  isConnected: boolean;
  lastSyncAt: Date | null;
  connectionTestAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  memberRole: WorkspaceRole;
}

// Legacy workspace type - maps to tenant
export interface WorkspaceWithRole {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  memberRole: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
}

// Helper to convert TenantWithRole to WorkspaceWithRole for legacy components
export function tenantToWorkspace(tenant: TenantWithRole): WorkspaceWithRole {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    image: null, // Tenants don't have images
    memberRole: tenant.memberRole,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}
