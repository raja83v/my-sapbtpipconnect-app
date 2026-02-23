import cron from "node-cron";

let scheduledTasks: cron.ScheduledTask[] = [];

/**
 * Start all cron jobs.
 * Called from instrumentation.ts on server boot.
 */
export function startScheduler() {
  console.log("[Cron] Starting scheduler...");

  // Sync all tenants every 5 minutes
  const syncTask = cron.schedule("*/5 * * * *", async () => {
    try {
      const { syncAllTenants } = await import("@/lib/cron/jobs/sync-tenants");
      await syncAllTenants();
    } catch (error) {
      console.error("[Cron] Sync tenants failed:", error);
    }
  });
  scheduledTasks.push(syncTask);

  // Clean up expired sessions every hour
  const cleanupTask = cron.schedule("0 * * * *", async () => {
    try {
      const { runCleanup } = await import("@/lib/cron/jobs/cleanup");
      await runCleanup();
    } catch (error) {
      console.error("[Cron] Cleanup failed:", error);
    }
  });
  scheduledTasks.push(cleanupTask);

  console.log("[Cron] Scheduler started with 2 jobs");
}

/**
 * Stop all cron jobs.
 */
export function stopScheduler() {
  console.log("[Cron] Stopping scheduler...");
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks = [];
  console.log("[Cron] Scheduler stopped");
}
