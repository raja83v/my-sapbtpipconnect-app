import { prisma } from "@/lib/db";

/**
 * Run periodic cleanup tasks:
 * - Remove expired sessions
 * - Clean up old expired invitations
 */
export async function runCleanup() {
  const now = new Date();

  // Clean expired sessions
  const deletedSessions = await prisma.session.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  if (deletedSessions.count > 0) {
    console.log(`[Cleanup] Removed ${deletedSessions.count} expired session(s)`);
  }

  // Clean expired invitations older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const deletedInvitations = await prisma.tenantInvitation.deleteMany({
    where: {
      expiresAt: { lt: sevenDaysAgo },
      acceptedAt: null,
    },
  });

  if (deletedInvitations.count > 0) {
    console.log(
      `[Cleanup] Removed ${deletedInvitations.count} expired invitation(s)`
    );
  }
}
