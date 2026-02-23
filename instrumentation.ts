export async function register() {
  // Only start the cron scheduler in the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/cron/scheduler");
    startScheduler();
  }
}
