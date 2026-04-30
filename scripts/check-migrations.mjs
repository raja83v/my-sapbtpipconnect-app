import postgres from "postgres";
const s = postgres("postgres://app:app@127.0.0.1:5435/app");
const j = await s`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`.catch((e) => { console.error(e.message); return []; });
console.log("Applied migrations count:", j.length);
for (const m of j) console.log(m.id, m.hash, new Date(Number(m.created_at)).toISOString());
await s.end();
