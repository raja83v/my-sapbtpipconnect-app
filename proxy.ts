// For now, we're using the simpler approach:
// 1. Sign-up redirects to /onboarding (components/auth/sign-up.tsx)
// 2. Dashboard layout checks onboardingCompleted (app/dashboard/layout.tsx)
// This works well for our current use case and is easier to maintain.

import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  // Redirect authenticated users away from auth pages
  if (sessionCookie && ["/sign-in", "/sign-up"].includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Quick redirect for unauthenticated users (cookie check only)
  // Note: This only checks cookie existence, not validity
  // Actual authentication verification happens in server components
  if (!sessionCookie) {
    // Protected routes that require authentication
    const protectedPaths = ["/dashboard", "/admin", "/onboarding"];

    const isProtectedPath = protectedPaths.some((path) =>
      pathname.startsWith(path)
    );

    if (isProtectedPath) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/onboarding",
    "/settings/:path*",
    "/app-ideas/:path*",
    "/sign-in",
    "/sign-up",
  ],
};
