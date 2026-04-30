import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users, accounts } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { createId } from "@paralleldrive/cuid2";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function main() {
  console.log("Seeding database...");

  const [{ c: userCount }] = await db.select({ c: count() }).from(users);

  if (userCount > 0) {
    console.log("Database already has users. Skipping seed.");
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@cpiconnect.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminName = process.env.ADMIN_NAME || "Admin";

  const userId = createId();
  const hashed = await hashPassword(adminPassword);

  const [admin] = await db
    .insert(users)
    .values({
      id: userId,
      email: adminEmail,
      name: adminName,
      role: "admin",
      status: "ACTIVE",
      emailVerified: true,
      onboardingCompleted: false,
      updatedAt: new Date(),
    })
    .returning();

  await db.insert(accounts).values({
    accountId: userId,
    providerId: "credential",
    userId,
    password: hashed,
    updatedAt: new Date(),
  });

  console.log(`Admin user created: ${admin.email} (id: ${admin.id})`);
  console.log(`Default password: ${adminPassword} (change this immediately!)`);
  console.log("");
  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
