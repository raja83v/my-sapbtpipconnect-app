"use server";

import { getCurrentUser as getAuthUser } from "@/lib/auth-helpers";
import type { CurrentUser } from "@/types/user";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
export async function getCurrentUser(): Promise<CurrentUser> {
  try {
    const authUser = await getAuthUser();

    if (!authUser) {
      return null;
    }

    // Fetch full user data from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, authUser.id),
    });

    if (!user) return null;

    // Transform to CurrentUser type
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      phone: user.phone ?? null,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
      defaultTenantId: user.defaultTenantId ?? null,
      createdAt: user.createdAt,
    };
  } catch (error) {
    console.error("Error fetching current user:", error);
    return null;
  }
}
