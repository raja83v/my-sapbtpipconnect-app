import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/sign-in",
  "/sign-up",
  "/setup",
  "/forgot-password",
  "/reset-password",
  "/blog",
  "/help",
  "/authors",
  "/team",
  "/legal",
];

// Route prefixes that don't require authentication
const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/health",
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
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  if (/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot)$/.test(pathname)) {
    return true;
  }
  return false;
}

// Routes that are completely disabled in cloud (open-source landing) mode.
// btpiconnect.com is a marketing-only site for the open-source project; user
// accounts only exist on self-hosted installs.
const CLOUD_DISABLED_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/setup",
  "/accept-invitation",
  "/onboarding",
  "/dashboard",
  "/admin",
];

const CLOUD_DISABLED_API_PREFIXES = [
  "/api/auth/",
];

function isCloudDisabledRoute(pathname: string): boolean {
  for (const route of CLOUD_DISABLED_ROUTES) {
    if (pathname === route || pathname.startsWith(`${route}/`)) return true;
  }
  for (const prefix of CLOUD_DISABLED_API_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isCloudMode = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === "cloud";

  // Cloud (btpiconnect.com): no authentication / app surface — only the
  // marketing site is available. Anyone hitting an auth or app route is
  // bounced back to the landing page.
  if (isCloudMode) {
    if (isCloudDisabledRoute(pathname)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Not available in cloud mode" },
          { status: 404 },
        );
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
    // Marketing routes are public; skip auth checks entirely.
    if (isPublicRoute(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.next();
  }

  // Self-hosted mode: send anonymous visitors straight to sign-in instead of
  // showing the marketing landing page.
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Fast cookie-only check (no DB call). Full session validation happens in
  // route handlers / server components via auth.api.getSession.
  const sessionCookie = getSessionCookie(request, {
    cookiePrefix: "cpiconnect",
  });

  if (!sessionCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
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
