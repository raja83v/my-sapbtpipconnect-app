import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { cache } from "react";

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
 * Get the current authenticated user from Supabase session and fetch associated Prisma user data.
 * Lazy-creates the Prisma user on first login (first user becomes admin).
 * This is cached per request to avoid multiple database calls.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser?.email) {
    return null;
  }

  // Look up existing Prisma user by email
  let user = await prisma.user.findUnique({
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
      supabaseId: true,
    },
  });

  // Lazy-create Prisma user if missing (e.g. first Supabase sign-up)
  if (!user) {
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    user = await prisma.user.create({
      data: {
        email: supabaseUser.email,
        name:
          supabaseUser.user_metadata?.full_name ??
          supabaseUser.user_metadata?.name ??
          undefined,
        supabaseId: supabaseUser.id,
        role: isFirstUser ? "admin" : "user",
        status: "ACTIVE",
        emailVerified: !!supabaseUser.email_confirmed_at,
        onboardingCompleted: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        image: true,
        onboardingCompleted: true,
        defaultTenantId: true,
        supabaseId: true,
      },
    });
  }

  // Backfill supabaseId if user was created before migration
  if (!user.supabaseId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { supabaseId: supabaseUser.id },
    });
  }

  if (user.status === "DELETED") {
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

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

/**
 * Require authentication - throws if not authenticated
 */
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

/**
 * Require admin role - throws if not admin
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}
