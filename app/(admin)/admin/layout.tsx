import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/app/actions/user";
import { toSidebarUser } from "@/types/user";
import { getImpersonationStatus } from "@/app/actions/admin/impersonate";
import { ImpersonationBanner } from "@/components/impersonation-banner";

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();

  // Protect admin routes - redirect if not admin
  if (currentUser?.role !== "admin") {
    redirect("/dashboard");
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
      <AdminSidebar variant="inset" user={user} />
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
