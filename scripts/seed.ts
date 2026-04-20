import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Seeding database...");

  // Check if any users exist
  const [{ c: userCount }] = await db.select({ c: count() }).from(users);

  if (userCount > 0) {
    console.log("Database already has users. Skipping seed.");
    return;
  }

  // Create default admin user
  const adminEmail = process.env.ADMIN_EMAIL || "admin@cpiconnect.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminName = process.env.ADMIN_NAME || "Admin";

  // Create user in Supabase first
  const { data: supabaseUser, error } =
    await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

  if (error) {
    throw new Error(`Failed to create Supabase user: ${error.message}`);
  }

  const [admin] = await db.insert(users).values({
    email: adminEmail,
    name: adminName,
    supabaseId: supabaseUser.user.id,
    role: "admin",
    status: "ACTIVE",
    emailVerified: true,
    onboardingCompleted: false,
    updatedAt: new Date(),
  }).returning();

  console.log(`Admin user created: ${admin.email} (id: ${admin.id})`);
  console.log("Default password: admin123 (change this immediately!)");
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
