import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "../actions/user";
import { getUserTenants } from "../actions/tenant";
import { toSidebarUser } from "@/types/user";
import { getImpersonationStatus } from "@/app/actions/admin/impersonate";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { TenantProvider } from "@/components/tenant-context";
import { redirect } from "next/navigation";
import { Suspense } from "react";

// Force dynamic rendering for all dashboard routes since they require authentication
export const dynamic = 'force-dynamic';

async function DashboardContent({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch user, tenants, and impersonation status in parallel for better performance
  const [currentUser, tenantsResult, impersonationResult] = await Promise.all([
    getCurrentUser(),
    getUserTenants(),
    getImpersonationStatus(),
  ]);

  // Redirect to login if user is not authenticated
  if (!currentUser) {
    redirect("/sign-in");
  }

  // Redirect to onboarding if user hasn't completed it
  if (!currentUser.onboardingCompleted) {
    redirect("/onboarding");
  }

  const user = toSidebarUser(currentUser);
  const impersonationStatus = impersonationResult.success
    ? impersonationResult.data
    : { isImpersonating: false };

  // Transform tenants for the selector
  const tenants = tenantsResult.success && tenantsResult.data
    ? tenantsResult.data.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      isConnected: t.isConnected,
    }))
    : [];

  return (
    <TenantProvider initialTenantId={currentUser.defaultTenantId ?? null}>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar
          variant="inset"
          user={user}
          tenants={tenants}
          currentTenantId={currentUser.defaultTenantId}
        />
        <SidebarInset>
          {impersonationStatus && (
            <ImpersonationBanner impersonationStatus={impersonationStatus} />
          )}
          <SiteHeader />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TenantProvider>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}
