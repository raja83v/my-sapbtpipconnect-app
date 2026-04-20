import {
  EmailTemplateId,
  type EmailTemplateData,
  type EmailTemplateRenderResult,
} from "@/lib/notifications/types";
import { welcomeEmailTemplate } from "./templates/welcome-email";
import { workspaceInvitationTemplate } from "./templates/workspace-invitation";
import { emailVerificationTemplate } from "./templates/email-verification";
import { passwordResetTemplate } from "./templates/password-reset";
import { magicLinkTemplate } from "./templates/magic-link";
import { subscriptionActivatedEmailTemplate } from "./templates/subscription-activated";
import { paymentFailedEmailTemplate } from "./templates/payment-failed";
import { subscriptionCanceledEmailTemplate } from "./templates/subscription-canceled";
import { invoicePaidEmailTemplate } from "./templates/invoice-paid";
import { usageWarningEmailTemplate } from "./templates/usage-warning";
import { trialEndingEmailTemplate } from "./templates/trial-ending";

/**
 * Type-safe email template registry
 * Maps each EmailTemplateId to its corresponding render function
 */
export type EmailTemplateRegistry = {
  [K in EmailTemplateId]: {
    render: (data: EmailTemplateData[K]) => EmailTemplateRenderResult;
  };
};

/**
 * Central registry of all email templates
 * Use this to render emails in a type-safe manner
 */
export const emailTemplates: EmailTemplateRegistry = {
  [EmailTemplateId.WORKSPACE_WELCOME]: welcomeEmailTemplate,
  [EmailTemplateId.WORKSPACE_INVITATION]: workspaceInvitationTemplate,
  [EmailTemplateId.EMAIL_VERIFICATION]: emailVerificationTemplate,
  [EmailTemplateId.PASSWORD_RESET]: passwordResetTemplate,
  [EmailTemplateId.MAGIC_LINK]: magicLinkTemplate,
  [EmailTemplateId.BILLING_SUBSCRIPTION_ACTIVATED]: subscriptionActivatedEmailTemplate,
  [EmailTemplateId.BILLING_PAYMENT_FAILED]: paymentFailedEmailTemplate,
  [EmailTemplateId.BILLING_SUBSCRIPTION_CANCELED]: subscriptionCanceledEmailTemplate,
  [EmailTemplateId.BILLING_INVOICE_PAID]: invoicePaidEmailTemplate,
  [EmailTemplateId.BILLING_USAGE_WARNING]: usageWarningEmailTemplate,
  [EmailTemplateId.BILLING_TRIAL_ENDING]: trialEndingEmailTemplate,
};

/**
 * Get an email template by ID (type-safe)
 */
export function getEmailTemplate<T extends EmailTemplateId>(
  templateId: T
): EmailTemplateRegistry[T] {
  return emailTemplates[templateId];
}
