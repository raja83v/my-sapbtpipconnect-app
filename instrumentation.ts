export async function register() {
  // Only run in the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 0. Apply corporate network TLS fix FIRST (before any fetch calls)
    //    Only activates when CORPORATE_NETWORK=true is set in .env.local
    const { applyCorporateTLSFix } = await import("@/lib/corporate-tls");
    applyCorporateTLSFix();

    // 1. Ensure database is running (starts embedded postgres if no DATABASE_URL)
    const { ensureDatabase } = await import("@/lib/db/embedded");
    await ensureDatabase();

    // 2. Run Drizzle migrations
    const { runMigrations } = await import("@/lib/db/migrate");
    await runMigrations(process.env.DATABASE_URL!);

    // 3. Start the cron scheduler
    const { startScheduler } = await import("@/lib/cron/scheduler");
    startScheduler();
  }
}
