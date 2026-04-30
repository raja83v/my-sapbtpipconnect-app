import postgres from "postgres";
import fs from "fs";
import crypto from "crypto";

const s = postgres("postgres://app:app@127.0.0.1:5435/app");
const journal = JSON.parse(fs.readFileSync("drizzle/meta/_journal.json", "utf8"));

for (const entry of journal.entries) {
  const sql = fs.readFileSync(`drizzle/${entry.tag}.sql`, "utf8");
  const hash = crypto.createHash("sha256").update(sql).digest("hex");
  const existing = await s`SELECT id, hash FROM drizzle.__drizzle_migrations WHERE created_at = ${entry.when}`;
  if (existing.length === 0) {
    await s`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`;
    console.log(`INSERT ${entry.tag} -> ${hash.slice(0, 12)}...`);
  } else if (existing[0].hash !== hash) {
    await s`UPDATE drizzle.__drizzle_migrations SET hash = ${hash} WHERE id = ${existing[0].id}`;
    console.log(`UPDATE ${entry.tag} -> ${hash.slice(0, 12)}...`);
  } else {
    console.log(`OK     ${entry.tag}`);
  }
}
await s.end();
