import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "../actions/user";
import { toSidebarUser } from "@/types/user";
import { getImpersonationStatus } from "@/app/actions/admin/impersonate";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();

  // Redirect to login if user is not authenticated
  if (!currentUser) {
    redirect("/sign-in");
  }

  // Redirect to onboarding if user hasn't completed it
  if (!currentUser.onboardingCompleted) {
    redirect("/onboarding");
  }

  const user = toSidebarUser(currentUser);

  // Check impersonation status
  const impersonationResult = await getImpersonationStatus();
  const impersonationStatus = impersonationResult.success
    ? impersonationResult.data
    : { isImpersonating: false };

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={user} />
      <SidebarInset>
        {impersonationStatus && (
          <ImpersonationBanner impersonationStatus={impersonationStatus} />
        )}
        <SiteHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
