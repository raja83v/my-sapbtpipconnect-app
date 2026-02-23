import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    if (!supabaseUser?.email) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: supabaseUser.email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        image: true,
        onboardingCompleted: true,
        defaultTenantId: true,
      },
    });

    if (!user || user.status === "DELETED") {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        image: user.image,
        onboardingCompleted: user.onboardingCompleted,
        defaultTenantId: user.defaultTenantId,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
