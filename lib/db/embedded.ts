import EmbeddedPostgres from "embedded-postgres";
import path from "path";
import fs from "fs";

let embeddedInstance: EmbeddedPostgres | null = null;
let isStarted = false;

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

  console.log("[embedded-postgres] Starting embedded PostgreSQL...");
  console.log(`[embedded-postgres] Data directory: ${dataDir}`);

  // Ensure data directory exists
  fs.mkdirSync(dataDir, { recursive: true });

  // Find available port
  const port = await findFreePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`[embedded-postgres] Port ${preferredPort} busy, using ${port}`);
  }

  embeddedInstance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "app",
    password: "app",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-messages=C"],
    onLog: (msg: string) => {
      if (process.env.EMBEDDED_PG_VERBOSE === "true") {
        console.log(`[embedded-postgres] ${msg}`);
      }
    },
    onError: (msg: string) => {
      console.error(`[embedded-postgres] ERROR: ${msg}`);
    },
  });

  try {
    // Check if cluster already exists
    const pgVersionFile = path.join(dataDir, "PG_VERSION");
    if (!fs.existsSync(pgVersionFile)) {
      console.log("[embedded-postgres] Initialising new database cluster...");
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

    console.log(`[embedded-postgres] Ready on port ${port}`);
    return connectionString;
  } catch (error) {
    console.error("[embedded-postgres] Failed to start:", error);
    throw error;
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
      console.log("[embedded-postgres] Created 'app' database");
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
    console.log("[embedded-postgres] Shutting down...");
    try {
      await embeddedInstance.stop();
    } catch {
      // Already stopped
    }
    isStarted = false;
    embeddedInstance = null;
  }
}

// Register shutdown handlers
if (typeof process !== "undefined") {
  const shutdown = () => {
    stopEmbeddedPostgres().catch(console.error);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
