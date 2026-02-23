import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    // Look up Prisma user
    const user = await prisma.user.findUnique({
      where: { email: data.user.email! },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });

    if (user?.status === "SUSPENDED") {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Your account has been suspended" },
        { status: 403 }
      );
    }

    if (user?.status === "DELETED") {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Update last login time if user exists in Prisma
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    return NextResponse.json({
      success: true,
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          }
        : {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.full_name,
            role: "user",
          },
    });
  } catch (error) {
    console.error("Sign-in error:", error);
    return NextResponse.json(
      { error: "An error occurred during sign-in" },
      { status: 500 }
    );
  }
}
