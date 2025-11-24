import type { EmailTemplateId, EmailTemplateData } from "./types";
import { siteConfig } from "@/lib/config";

/**
 * Build a dashboard URL for the application
 */
export function buildDashboardUrl(path: string = ""): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : siteConfig.url);

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Build welcome email data
 */
export function buildWelcomeEmailData(
  firstName: string,
  dashboardPath: string = "/dashboard"
): EmailTemplateData[EmailTemplateId.WORKSPACE_WELCOME] {
  return {
    firstName,
    dashboardUrl: buildDashboardUrl(dashboardPath),
  };
}

/**
 * Build workspace invitation email data
 */
export function buildWorkspaceInvitationData(
  inviterName: string,
  workspaceName: string,
  inviteeEmail: string,
  invitationToken: string,
  includeDecline: boolean = true
): EmailTemplateData[EmailTemplateId.WORKSPACE_INVITATION] {
  return {
    inviterName,
    workspaceName,
    inviteeEmail,
    acceptUrl: buildDashboardUrl(`/accept-invitation?token=${invitationToken}`),
    declineUrl: includeDecline
      ? buildDashboardUrl(`/decline-invitation?token=${invitationToken}`)
      : undefined,
  };
}

/**
 * Build email verification data
 */
export function buildEmailVerificationData(
  firstName: string,
  verificationToken: string
): EmailTemplateData[EmailTemplateId.EMAIL_VERIFICATION] {
  return {
    firstName,
    verificationUrl: buildDashboardUrl(`/verify-email?token=${verificationToken}`),
  };
}

/**
 * Build password reset email data
 */
export function buildPasswordResetData(
  firstName: string,
  resetToken: string,
  expiresInMinutes: number = 60
): EmailTemplateData[EmailTemplateId.PASSWORD_RESET] {
  return {
    firstName,
    resetUrl: buildDashboardUrl(`/reset-password?token=${resetToken}`),
    expiresInMinutes,
  };
}

/**
 * Extract first name from a full name
 * Falls back to the full name if no space is found
 */
export function extractFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(" ");
  return spaceIndex > 0 ? trimmed.substring(0, spaceIndex) : trimmed;
}

/**
 * Format email address for display
 * Masks the local part for privacy if requested
 */
export function formatEmailAddress(
  email: string,
  maskLocalPart: boolean = false
): string {
  if (!maskLocalPart) return email;

  const [localPart, domain] = email.split("@");
  if (!domain) return email;

  const visibleChars = Math.min(3, Math.floor(localPart.length / 2));
  const masked = localPart.substring(0, visibleChars) + "***";

  return `${masked}@${domain}`;
}

/**
 * Validate multiple email addresses
 * Returns array of invalid emails (empty if all valid)
 */
export function validateEmails(emails: string[]): string[] {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emails.filter((email) => !emailRegex.test(email));
}

/**
 * Create email tags for tracking/analytics
 */
export function createEmailTags(tags: Record<string, string>): Array<{
  name: string;
  value: string;
}> {
  return Object.entries(tags).map(([name, value]) => ({ name, value }));
}

/**
 * Get environment-specific email sender
 */
export function getEmailSender(
  customSender?: string
): { email: string; name: string } {
  const defaultEmail =
    process.env.EMAIL_FROM || siteConfig.email.fromEmail;
  const defaultName = process.env.EMAIL_FROM_NAME || siteConfig.email.fromName;

  if (customSender) {
    return {
      email: customSender,
      name: defaultName,
    };
  }

  return {
    email: defaultEmail,
    name: defaultName,
  };
}

/**
 * Build support email address
 */
export function getSupportEmail(): string {
  return process.env.SUPPORT_EMAIL || siteConfig.email.supportEmail;
}

/**
 * Check if email sending is enabled
 * Useful for development/testing environments
 */
export function isEmailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Log email event (for debugging)
 */
export function logEmailEvent(
  templateId: EmailTemplateId,
  to: string | string[],
  success: boolean,
  error?: string
): void {
  if (process.env.NODE_ENV === "development") {
    console.log("[Email Event]", {
      templateId,
      to,
      success,
      error,
      timestamp: new Date().toISOString(),
    });
  }
}
