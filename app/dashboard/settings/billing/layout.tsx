import { getCurrentUser } from "@/app/actions/user";
import { getUserTenants } from "@/app/actions/tenant";
import { SettingsNavigation } from "@/components/settings/settings-navigation";
import { redirect } from "next/navigation";

export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, tenantsResult] = await Promise.all([
    getCurrentUser(),
    getUserTenants(),
  ]);

  if (!user) {
    redirect("/sign-in");
  }

  const tenants = tenantsResult.success && tenantsResult.data ? tenantsResult.data : [];

  // Check if user is admin
  const isTenantAdmin = tenants.some(
    (tenant) => tenant.memberRole === "OWNER" || tenant.memberRole === "ADMIN"
  );
  const isPlatformAdmin = user.role === "admin";
  const isAdmin = isTenantAdmin || isPlatformAdmin;

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Sidebar Navigation */}
          <SettingsNavigation isAdmin={isAdmin} />

          {/* Content Area */}
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}
