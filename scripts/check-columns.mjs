import postgres from "postgres";
const s = postgres("postgres://app:app@127.0.0.1:5435/app");
const cols = await s`SELECT column_name FROM information_schema.columns WHERE table_name='iflow_pipeline' ORDER BY column_name`;
console.log("Columns:", cols.map((c) => c.column_name).join(", "));
const j = await s`SELECT * FROM "__drizzle_migrations" ORDER BY id`.catch(() => []);
console.log("Applied migrations:", j.length, j.map((x) => x.hash || x.tag || JSON.stringify(x)).join("\n"));
await s.end();
