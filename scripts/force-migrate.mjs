import postgres from "postgres";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const s = postgres("postgres://app:app@127.0.0.1:5435/app");
const journal = JSON.parse(fs.readFileSync("drizzle/meta/_journal.json", "utf8"));
const applied = await s`SELECT hash FROM drizzle.__drizzle_migrations`;
const appliedHashes = new Set(applied.map((r) => r.hash));

for (const entry of journal.entries) {
  const sqlPath = path.join("drizzle", `${entry.tag}.sql`);
  const sql = fs.readFileSync(sqlPath, "utf8");
  const hash = crypto.createHash("sha256").update(sql).digest("hex");
  if (appliedHashes.has(hash)) {
    console.log(`SKIP ${entry.tag}`);
    continue;
  }
  console.log(`APPLY ${entry.tag}`);
  // Strip line comments (which may contain the literal "--> statement-breakpoint" in prose)
  const stripped = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  const statements = stripped.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try {
      await s.unsafe(stmt);
    } catch (e) {
      console.error(`  FAIL: ${e.message}`);
      console.error(`  STMT: ${stmt.slice(0, 200)}`);
      throw e;
    }
  }
  await s`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`;
  console.log(`  OK`);
}
await s.end();
console.log("Done.");
