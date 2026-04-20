import { db } from "@/lib/db";
import { cpiTenants } from "@/lib/db/schema";
import { eq, and, or, lt, isNull, asc } from "drizzle-orm";
import { SAPCPIClient } from "@/lib/sap-cpi/client";

/**
 * Sync all active, connected tenants that haven't been synced recently.
 * This is called by the cron scheduler every 5 minutes.
 */
export async function syncAllTenants() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const tenants = await db.select().from(cpiTenants).where(
    and(
      eq(cpiTenants.status, "ACTIVE"),
      eq(cpiTenants.isConnected, true),
      or(isNull(cpiTenants.lastSyncAt), lt(cpiTenants.lastSyncAt, fiveMinutesAgo)),
    )
  ).limit(10).orderBy(asc(cpiTenants.lastSyncAt));

  if (tenants.length === 0) {
    return;
  }


  for (const tenant of tenants) {
    try {
      // Dynamic import to avoid circular dependencies
      const { SAPCPIClient } = await import("@/lib/sap-cpi/client");
      const { decrypt } = await import("@/lib/encryption");

      // Decrypt credentials
      const clientSecret = tenant.clientSecret
        ? await decrypt(tenant.clientSecret)
        : undefined;
      const password = tenant.password
        ? await decrypt(tenant.password)
        : undefined;

      const client = new SAPCPIClient({
        tenantUrl: tenant.tenantUrl,
        authType: tenant.authType,
        tokenUrl: tenant.authenticationUrl ?? undefined,
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
      await db.update(cpiTenants).set({ lastSyncAt: new Date() }).where(eq(cpiTenants.id, tenant.id));

    } catch (error) {
      console.error(`[Cron] Failed to sync tenant ${tenant.name}:`, error);

      // Mark tenant as errored if sync fails consistently
      await db.update(cpiTenants).set({ lastSyncAt: new Date() }).where(eq(cpiTenants.id, tenant.id)); // Still update to avoid retrying immediately
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
