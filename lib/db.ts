import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof createDb> | undefined;
  pgClient: ReturnType<typeof postgres> | undefined;
};

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Set it in .env or embedded postgres will set it at startup."
    );
  }

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
