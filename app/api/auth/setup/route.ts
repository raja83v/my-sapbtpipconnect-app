import { NextRequest, NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * First-run admin setup endpoint.
 * Only works when there are no users in the database.
 */
export async function POST(request: NextRequest) {
  try {
    const [{ total: userCount }] = await db
      .select({ total: count() })
      .from(users);
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

    const normalizedEmail = email.toLowerCase().trim();
    const displayName = name?.trim() || "Admin";

    // Sign up via BetterAuth (creates user + account + session)
    const result = await auth.api.signUpEmail({
      body: {
        email: normalizedEmail,
        password,
        name: displayName,
      },
      returnHeaders: true,
    });

    if (!result?.response?.user?.id) {
      return NextResponse.json(
        { error: "Failed to create admin user" },
        { status: 500 }
      );
    }

    const adminId = result.response.user.id;

    // Promote to admin and mark email as verified
    const [admin] = await db
      .update(users)
      .set({ role: "admin", emailVerified: true })
      .where(eq(users.id, adminId))
      .returning();

    // Forward Set-Cookie headers from BetterAuth so the user is signed in
    const setCookies = result.headers?.getSetCookie?.() ?? [];
    const response = NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
    for (const cookie of setCookies) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch (error) {
    console.error("Setup error:", error);
    const message =
      error instanceof Error ? error.message : "An error occurred during setup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Check if setup is needed (no users exist).
 */
export async function GET() {
  try {
    const [{ total: userCount }] = await db
      .select({ total: count() })
      .from(users);
    return NextResponse.json({ setupRequired: userCount === 0 });
  } catch (error) {
    console.error("Setup check error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
