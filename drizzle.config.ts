import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load .env so DATABASE_URL (if set) is picked up.
config();

// Default to the embedded Postgres started by `pnpm dev`
// (lib/db/embedded.ts on port 5435). Override with DATABASE_URL when using
// an external instance.
const url =
  process.env.DATABASE_URL ?? "postgresql://app:app@127.0.0.1:5435/app";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
