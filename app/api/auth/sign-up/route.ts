import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
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

    // Check if user already exists in Prisma
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Use the admin client to create the Supabase auth user.
    // This bypasses email-confirmation and avoids "User already registered"
    // issues when the client has already attempted signUp().
    const admin = createAdminClient();

    // Check if user already exists in Supabase auth (e.g. from a previous
    // failed attempt that created the auth user but not the Prisma row)
    let supabaseUserId: string | undefined;

    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existingSupabaseUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (existingSupabaseUser) {
      // Supabase user exists but Prisma user doesn't — reuse the Supabase user
      supabaseUserId = existingSupabaseUser.id;
    } else {
      // Create new Supabase auth user via admin API (auto-confirms email)
      const { data: newUser, error: createError } =
        await admin.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: name?.trim() || undefined,
          },
        });

      if (createError) {
        console.error("Supabase admin createUser error:", createError);
        return NextResponse.json(
          { error: createError.message },
          { status: 400 }
        );
      }

      supabaseUserId = newUser.user.id;
    }

    // Check if this is the first user (make them admin)
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    // Create Prisma user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name?.trim() || undefined,
        supabaseId: supabaseUserId,
        role: isFirstUser ? "admin" : "user",
        status: "ACTIVE",
        emailVerified: true,
        onboardingCompleted: false,
      },
    });

    // Sign the user in so the session cookie is set server-side
    const supabase = await createClient();
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      isFirstUser,
    });
  } catch (error) {
    console.error("Sign-up error:", error);
    return NextResponse.json(
      { error: "An error occurred during registration" },
      { status: 500 }
    );
  }
}
