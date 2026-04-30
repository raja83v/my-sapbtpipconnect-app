import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof createDb> | undefined;
  pgClient: ReturnType<typeof postgres> | undefined;
};

function createDb() {
  // Default to the embedded Postgres started by instrumentation.ts on port 5435.
  // In Next.js 16 + Turbopack, route handlers can run in worker threads that
  // don't see process.env mutations from instrumentation, so we fall back to
  // the well-known embedded URL rather than throwing.
  const url =
    process.env.DATABASE_URL ?? "postgresql://app:app@127.0.0.1:5435/app";

  const client = postgres(url, {
    max: process.env.NODE_ENV === "production" ? 20 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  globalForDb.pgClient = client;

  return drizzle(client, { schema });
}

export const db =
  globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

export type Database = typeof db;

// Re-export schema for convenience
export { schema };

// Export raw sql client for health checks and raw queries
export function getRawClient() {
  return globalForDb.pgClient;
}
