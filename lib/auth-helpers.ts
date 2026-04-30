import { cache } from "react";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | undefined;
  role: "user" | "admin";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  image: string | undefined;
  onboardingCompleted: boolean;
  defaultTenantId: string | undefined;
};

/**
 * Get the current authenticated user from the BetterAuth session.
 * Cached per request to avoid duplicate DB calls.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.email) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, session.user.email),
    columns: {
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
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? undefined,
    role: user.role,
    status: user.status,
    image: user.image ?? undefined,
    onboardingCompleted: user.onboardingCompleted,
    defaultTenantId: user.defaultTenantId ?? undefined,
  };
});

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (user.status === "SUSPENDED") {
    throw new Error("Account suspended");
  }
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}
