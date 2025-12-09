import { auth, clerkClient } from "@clerk/nextjs/server";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { CurrentUser } from "@/types/user";
import { cache } from "react";

export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  try {
    const { userId } = await auth();

    if (!userId) {
      return null;
    }

    // Try to get user from Convex
    let user = await convex.query(api.users.getByClerkId, { clerkId: userId });

    // If user doesn't exist in our database, create them
    // This handles cases where webhook failed or wasn't configured
    if (!user) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);

        const convexUserId = await convex.mutation(api.userMutations.findOrCreateByClerkId, {
          clerkId: userId,
          email: clerkUser.emailAddresses[0].emailAddress,
          name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || undefined,
          emailVerified: clerkUser.emailAddresses[0].verification?.status === "verified",
          image: clerkUser.imageUrl || undefined,
        });

        user = await convex.query(api.users.getById, { id: convexUserId });
      } catch (createError) {
        console.error("[getCurrentUser] Failed to create user:", createError);
        return null;
      }
    }

    if (!user) return null;

    // Transform Convex user to CurrentUser type
    return {
      id: user._id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      phone: user.phone ?? null,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
      defaultTenantId: user.defaultTenantId ?? null,
      createdAt: new Date(user._creationTime),
    };
  } catch (error) {
    console.error("Error fetching current user:", error);
    return null;
  }
});