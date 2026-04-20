"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "./user";
import type { ActionResult } from "@/types/actions";
import {
  updateProfileSchema,
  type UpdateProfileInput,
} from "@/lib/validations/user-settings";

/**
 * Update the current user's profile settings
 */
export async function updateUserProfile(
  input: UpdateProfileInput
): Promise<ActionResult<{ name: string | null; phone: string | null }>> {
  try {
    // Check authentication
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    const validatedData = updateProfileSchema.parse(input);

    // Update user profile
    await db.update(users).set({
      name: validatedData.name,
      phone: validatedData.phone === "" ? null : validatedData.phone,
    }).where(eq(users.id, currentUser.id));

    // Revalidate paths
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");

    return {
      success: true,
      data: {
        name: validatedData.name ?? null,
        phone: validatedData.phone ?? null,
      },
    };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return {
      success: false,
      error: "Failed to update profile. Please try again.",
    };
  }
}

/**
 * Delete the current user's account (soft delete by setting status to DELETED)
 */
export async function deleteUserAccount(): Promise<ActionResult<void>> {
  try {
    // Check authentication
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Soft delete by setting status to DELETED
    await db.update(users).set({ status: "DELETED" }).where(eq(users.id, currentUser.id));

    // Revalidate paths
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Error deleting user account:", error);
    return {
      success: false,
      error: "Failed to delete account. Please try again.",
    };
  }
}
