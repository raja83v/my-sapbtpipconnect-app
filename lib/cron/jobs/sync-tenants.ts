import { prisma } from "@/lib/db";

/**
 * Sync all active, connected tenants that haven't been synced recently.
 * This is called by the cron scheduler every 5 minutes.
 */
export async function syncAllTenants() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const tenants = await prisma.cpiTenant.findMany({
    where: {
      status: "ACTIVE",
      isConnected: true,
      OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: fiveMinutesAgo } }],
    },
    take: 10,
    orderBy: { lastSyncAt: "asc" },
  });

  if (tenants.length === 0) {
    return;
  }

  console.log(`[Cron] Syncing ${tenants.length} tenant(s)...`);

  for (const tenant of tenants) {
    try {
      // Dynamic import to avoid circular dependencies
      const { SapCpiClient } = await import("@/lib/sap-cpi/client");
      const { decrypt } = await import("@/lib/encryption");

      // Decrypt credentials
      const clientSecret = tenant.clientSecret
        ? await decrypt(tenant.clientSecret)
        : undefined;
      const password = tenant.password
        ? await decrypt(tenant.password)
        : undefined;

      const client = new SapCpiClient({
        tenantUrl: tenant.tenantUrl,
        authType: tenant.authType,
        authenticationUrl: tenant.authenticationUrl ?? undefined,
        clientId: tenant.clientId ?? undefined,
        clientSecret,
        username: tenant.username ?? undefined,
        password,
      });

      // Fetch deployed iFlows
      const deployedIFlows = await client.listDeployedIFlows();

      // Batch upsert iFlows
      if (deployedIFlows && deployedIFlows.length > 0) {
        const { batchUpsert } = await import("@/lib/db/iflows");
        await batchUpsert(
          tenant.id,
          deployedIFlows.map((iflow: { Id: string; Name: string; Version?: string; Status?: string }) => ({
            iFlowId: iflow.Id,
            name: iflow.Name,
            version: iflow.Version,
            status: mapStatus(iflow.Status),
          }))
        );
      }

      // Update last sync time
      await prisma.cpiTenant.update({
        where: { id: tenant.id },
        data: { lastSyncAt: new Date() },
      });

      console.log(`[Cron] Synced tenant: ${tenant.name}`);
    } catch (error) {
      console.error(`[Cron] Failed to sync tenant ${tenant.name}:`, error);

      // Mark tenant as errored if sync fails consistently
      await prisma.cpiTenant.update({
        where: { id: tenant.id },
        data: { lastSyncAt: new Date() }, // Still update to avoid retrying immediately
      });
    }
  }
}

function mapStatus(
  status?: string
): "STARTED" | "STOPPED" | "STARTING" | "STOPPING" | "ERROR" {
  switch (status?.toUpperCase()) {
    case "STARTED":
      return "STARTED";
    case "STARTING":
      return "STARTING";
    case "STOPPING":
      return "STOPPING";
    case "ERROR":
      return "ERROR";
    default:
      return "STOPPED";
  }
}
