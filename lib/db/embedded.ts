import EmbeddedPostgres from "embedded-postgres";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { logger } from "@/lib/logger";

let embeddedInstance: EmbeddedPostgres | null = null;
let isStarted = false;

/**
 * Check whether a process with the given PID is currently alive.
 */
function isProcessAlive(pid: number): boolean {
  if (!pid || Number.isNaN(pid)) return false;
  try {
    // Signal 0 is a no-op probe; throws if the process doesn't exist
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect and clean up an orphaned embedded-postgres cluster left behind
 * when the parent Node process was killed without a graceful shutdown.
 *
 * Looks at `postmaster.pid` in the data dir: if the recorded PID is dead
 * (or belongs to a stale cluster), remove the lock file and forcibly kill
 * any orphan postgres workers still listening on the configured port so
 * the next start can re-use it.
 */
function cleanupStalePostgres(dataDir: string, port: number): void {
  const pidFile = path.join(dataDir, "postmaster.pid");
  if (!fs.existsSync(pidFile)) return;

  let postmasterPid = 0;
  try {
    const firstLine = fs.readFileSync(pidFile, "utf8").split("\n")[0]?.trim();
    postmasterPid = parseInt(firstLine || "0", 10);
  } catch {
    // unreadable — treat as stale
  }

  const stale = !postmasterPid || !isProcessAlive(postmasterPid);
  if (!stale) return;

  logger.debug(
    `[embedded-postgres] Found stale postmaster.pid (pid=${postmasterPid}); cleaning up`,
  );

  // Kill any orphan postgres.exe workers that may still be holding the port.
  // embedded-postgres spawns child workers (io_worker, etc.) that can outlive
  // the parent if the Node process was SIGKILLed.
  try {
    if (process.platform === "win32") {
      execSync(
        `wmic process where "name='postgres.exe' and commandline like '%%${dataDir.replace(/\\/g, "\\\\").replace(/'/g, "''")}%%'" call terminate`,
        { stdio: "ignore" },
      );
    } else {
      execSync(`pkill -f "postgres.*${dataDir}" || true`, { stdio: "ignore" });
    }
  } catch {
    // best-effort
  }

  try {
    fs.unlinkSync(pidFile);
  } catch {
    // ignore — embedded-postgres may also clean it up
  }

  // Also remove unix socket lock file if present (no-op on Windows)
  try {
    const sockLock = path.join(dataDir, `.s.PGSQL.${port}.lock`);
    if (fs.existsSync(sockLock)) fs.unlinkSync(sockLock);
  } catch {
    // ignore
  }
}

/**
 * Get the data directory for embedded postgres.
 * Uses APP_DATA_DIR env var or defaults to `.data/db` in project root.
 */
function getDataDir(): string {
  return process.env.APP_DATA_DIR
    ? path.join(process.env.APP_DATA_DIR, "db")
    : path.join(process.cwd(), ".data", "db");
}

/**
 * Build a connection string for embedded postgres.
 */
function buildConnectionString(port: number): string {
  return `postgres://app:app@127.0.0.1:${port}/app`;
}

/**
 * Check if port is available
 */
async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require("net");
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port, "127.0.0.1");
  });
}

/**
 * Find a free port starting from the given port.
 */
async function findFreePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 100; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${startPort}-${startPort + 99}`);
}

/**
 * Starts embedded postgres if no DATABASE_URL is set.
 * Returns the database URL to use (either external or embedded).
 */
export async function ensureDatabase(): Promise<string> {
  // If DATABASE_URL is already set, use external postgres
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Already started embedded postgres
  if (isStarted && embeddedInstance) {
    const port = parseInt(process.env.EMBEDDED_PG_PORT || "5435", 10);
    return buildConnectionString(port);
  }

  const dataDir = getDataDir();
  const preferredPort = parseInt(process.env.EMBEDDED_PG_PORT || "5435", 10);

  logger.debug("[embedded-postgres] Starting embedded PostgreSQL...");
  logger.debug(`[embedded-postgres] Data directory: ${dataDir}`);

  // Ensure data directory exists
  fs.mkdirSync(dataDir, { recursive: true });

  // Clean up any stale postmaster.pid / orphan workers from a prior crash
  cleanupStalePostgres(dataDir, preferredPort);

  // Find available port
  const port = await findFreePort(preferredPort);
  if (port !== preferredPort) {
    logger.debug(`[embedded-postgres] Port ${preferredPort} busy, using ${port}`);
  }

  embeddedInstance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "app",
    password: "app",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-messages=C"],
    onLog: (msg: unknown) => {
      if (process.env.EMBEDDED_PG_VERBOSE === "true") {
        logger.debug(`[embedded-postgres] ${String(msg)}`);
      }
    },
    onError: (msg: unknown) => {
      logger.error(`[embedded-postgres] ERROR: ${String(msg)}`);
    },
  });

  try {
    // Check if cluster already exists
    const pgVersionFile = path.join(dataDir, "PG_VERSION");
    if (!fs.existsSync(pgVersionFile)) {
      // If the data directory exists but has no PG_VERSION, it's a stale/corrupt
      // cluster. Remove its contents so initdb can start fresh.
      const entries = fs.readdirSync(dataDir);
      if (entries.length > 0) {
        logger.debug(
          "[embedded-postgres] Data directory exists but has no PG_VERSION; cleaning stale cluster…",
        );
        fs.rmSync(dataDir, { recursive: true, force: true });
        fs.mkdirSync(dataDir, { recursive: true });
      }

      logger.debug("[embedded-postgres] Initialising new database cluster…");
      await embeddedInstance.initialise();
    }

    await embeddedInstance.start();
    isStarted = true;

    // Store port for subsequent calls
    process.env.EMBEDDED_PG_PORT = String(port);

    // Ensure the "app" database exists
    await ensureAppDatabase(port);

    const connectionString = buildConnectionString(port);
    process.env.DATABASE_URL = connectionString;

    logger.debug(`[embedded-postgres] Ready on port ${port}`);
    return connectionString;
  } catch (error) {
    // embedded-postgres rejects with a plain string, not an Error object.
    // Wrap it so downstream code can safely access .message / .stack.
    const wrapped =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : String(error));
    logger.error("[embedded-postgres] Failed to start:", wrapped);
    throw wrapped;
  }
}

/**
 * Create the "app" database if it doesn't already exist.
 */
async function ensureAppDatabase(port: number): Promise<void> {
  const pg = await import("postgres");
  // Connect to default "postgres" database to create our app database
  const sql = pg.default(`postgres://app:app@127.0.0.1:${port}/postgres`);
  try {
    const result = await sql`SELECT 1 FROM pg_database WHERE datname = 'app'`;
    if (result.length === 0) {
      await sql`CREATE DATABASE app ENCODING 'UTF8'`;
      logger.debug("[embedded-postgres] Created 'app' database");
    }
  } finally {
    await sql.end();
  }
}

/**
 * Gracefully stop embedded postgres.
 */
export async function stopEmbeddedPostgres(): Promise<void> {
  if (embeddedInstance && isStarted) {
    logger.debug("[embedded-postgres] Shutting down...");
    try {
      await embeddedInstance.stop();
    } catch {
      // Already stopped
    }
    isStarted = false;
    embeddedInstance = null;
  }
}

// Register shutdown handlers. We must await stop() before exiting so that
// embedded-postgres can send `pg_ctl stop -m fast` and reap its workers —
// otherwise orphan postgres.exe processes keep the port bound.
if (typeof process !== "undefined") {
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await stopEmbeddedPostgres();
    } catch (err) {
      logger.error("Failed to stop embedded postgres", err);
    } finally {
      // Re-raise default behaviour so the parent (e.g. pnpm/Next.js) exits
      // with the expected code.
      process.exit(signal === "SIGINT" ? 130 : 0);
    }
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGHUP", () => void shutdown("SIGHUP"));
  // Windows: Ctrl+Break
  process.once("SIGBREAK" as NodeJS.Signals, () => void shutdown("SIGBREAK"));
  // Best-effort sync stop on uncaught fatal errors
  process.on("uncaughtException", (err) => {
    logger.error("uncaughtException; stopping embedded postgres", err);
    void shutdown("uncaughtException");
  });
}
