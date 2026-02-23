import { getCurrentUser } from "@/lib/auth-helpers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      onboardingCompleted: currentUser.onboardingCompleted,
      user: {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
      },
    });
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
