import { getCurrentUser } from "@/app/actions/user";
import { getUserTenants } from "@/app/actions/tenant";
import { SettingsNavigation } from "@/components/settings/settings-navigation";
import { SettingsContent } from "@/components/settings/settings-content";

export default async function DashboardSettingsPage() {
  // Fetch user and tenants in parallel for better performance
  const [user, tenantsResult] = await Promise.all([
    getCurrentUser(),
    getUserTenants(),
  ]);

  // Layout handles auth, so user will always exist here
  if (!user) {
    return null;
  }

  const tenants = tenantsResult.success && tenantsResult.data ? tenantsResult.data : [];

  // Check if user is admin (OWNER or ADMIN of any tenant) OR platform admin
  const isTenantAdmin = tenants.some(
    (tenant) => tenant.memberRole === "OWNER" || tenant.memberRole === "ADMIN"
  );
  const isPlatformAdmin = user.role === "admin";
  const isAdmin = isTenantAdmin || isPlatformAdmin;

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account and CPI tenant connections
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Sidebar Navigation */}
          <SettingsNavigation isAdmin={isAdmin} />

          {/* Content Area - Conditional Rendering based on URL */}
          <SettingsContent
            user={{
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              image: user.image,
            }}
            tenants={tenants}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </div>
  );
}
