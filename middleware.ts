import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/sign-in",
  "/sign-up",
  "/setup",
  "/blog",
  "/help",
  "/authors",
  "/team",
  "/legal",
];

// Route prefixes that don't require authentication
const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/auth/callback",
  "/blog/",
  "/help/",
  "/authors/",
  "/team/",
  "/legal/",
  "/_next/",
  "/favicon",
  "/images/",
  "/icons/",
];

function isPublicRoute(pathname: string): boolean {
  // Exact match
  if (PUBLIC_ROUTES.includes(pathname)) return true;

  // Prefix match
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }

  // Static file extensions
  if (/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot)$/.test(pathname)) {
    return true;
  }

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    // Still refresh session cookies on public routes
    const { supabaseResponse } = await updateSession(request);
    return supabaseResponse;
  }

  // Refresh session and check for authenticated user
  const { user, supabaseResponse } = await updateSession(request);

  if (!user) {
    // Redirect to sign-in for page requests, return 401 for API requests
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
