import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { count } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * First-run admin setup endpoint.
 * Only works when there are no users in the database.
 */
export async function POST(request: NextRequest) {
  try {
    // Check if any users exist
    const [{ total: userCount }] = await db.select({ total: count() }).from(users);
    if (userCount > 0) {
      return NextResponse.json(
        { error: "Setup has already been completed" },
        { status: 403 }
      );
    }

    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Create user in Supabase via admin client
    const supabaseAdmin = createAdminClient();
    const { data: supabaseData, error: supabaseError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name: name?.trim() || "Admin" },
      });

    if (supabaseError || !supabaseData.user) {
      return NextResponse.json(
        { error: supabaseError?.message || "Failed to create Supabase user" },
        { status: 500 }
      );
    }

    // Create admin user
    const [admin] = await db.insert(users).values({
      email: email.toLowerCase().trim(),
      name: name?.trim() || "Admin",
      supabaseId: supabaseData.user.id,
      role: "admin",
      status: "ACTIVE",
      emailVerified: true,
      onboardingCompleted: false,
    }).returning();

    // Sign in the newly created admin
    const supabase = await createClient();
    await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "An error occurred during setup" },
      { status: 500 }
    );
  }
}

/**
 * Check if setup is needed (no users exist)
 */
export async function GET() {
  try {
    const [{ total: userCount }] = await db.select({ total: count() }).from(users);
    return NextResponse.json({ setupRequired: userCount === 0 });
  } catch (error) {
    console.error("Setup check error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
