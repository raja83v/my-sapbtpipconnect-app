import cron, { type ScheduledTask } from "node-cron";

let scheduledTasks: ScheduledTask[] = [];

/**
 * Start all cron jobs.
 * Called from instrumentation.ts on server boot.
 */
export function startScheduler() {

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

  // Send trial-ending reminder emails once per day at 09:00 UTC
  const trialReminderTask = cron.schedule("0 9 * * *", async () => {
    try {
      const { checkExpiringTrials } = await import("@/lib/cron/jobs/trial-reminders");
      await checkExpiringTrials();
    } catch (error) {
      console.error("[Cron] Trial reminders failed:", error);
    }
  });
  scheduledTasks.push(trialReminderTask);

}

/**
 * Stop all cron jobs.
 */
export function stopScheduler() {
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks = [];
}
