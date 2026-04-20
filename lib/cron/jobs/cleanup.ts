import { db } from "@/lib/db";
import { sessions, tenantInvitations } from "@/lib/db/schema";
import { lt, and, isNull } from "drizzle-orm";

/**
 * Run periodic cleanup tasks:
 * - Remove expired sessions
 * - Clean up old expired invitations
 */
export async function runCleanup() {
  const now = new Date();

  // Clean expired sessions
  const deletedSessions = await db.delete(sessions).where(lt(sessions.expiresAt, now)).returning();

  if (deletedSessions.length > 0) {
  }

  // Clean expired invitations older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const deletedInvitations = await db.delete(tenantInvitations).where(
    and(
      lt(tenantInvitations.expiresAt, sevenDaysAgo),
      isNull(tenantInvitations.acceptedAt),
    )
  ).returning();

  if (deletedInvitations.length > 0) {
  }
}
