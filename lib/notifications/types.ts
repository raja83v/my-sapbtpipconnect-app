import type { ReactElement } from "react";

/**
 * Enum of all available email templates
 * These are generic templates suitable for any application
 */
export enum EmailTemplateId {
  // User onboarding
  WORKSPACE_WELCOME = "workspace-welcome",
  EMAIL_VERIFICATION = "email-verification",

  // Workspace management
  WORKSPACE_INVITATION = "workspace-invitation",

  // Authentication
  PASSWORD_RESET = "password-reset",
  MAGIC_LINK = "magic-link",

  // Billing
  BILLING_SUBSCRIPTION_ACTIVATED = "billing-subscription-activated",
  BILLING_PAYMENT_FAILED = "billing-payment-failed",
  BILLING_SUBSCRIPTION_CANCELED = "billing-subscription-canceled",
  BILLING_INVOICE_PAID = "billing-invoice-paid",
  BILLING_USAGE_WARNING = "billing-usage-warning",
  BILLING_TRIAL_ENDING = "billing-trial-ending",
}

/**
 * Data required for each email template
 */
export type EmailTemplateData = {
  [EmailTemplateId.WORKSPACE_WELCOME]: {
    firstName: string;
    dashboardUrl: string;
  };

  [EmailTemplateId.WORKSPACE_INVITATION]: {
    inviterName: string;
    workspaceName: string;
    inviteeEmail: string;
    acceptUrl: string;
    declineUrl?: string;
  };

  [EmailTemplateId.EMAIL_VERIFICATION]: {
    firstName: string;
    verificationUrl: string;
  };

  [EmailTemplateId.PASSWORD_RESET]: {
    firstName: string;
    resetUrl: string;
    expiresInMinutes: number;
  };

  [EmailTemplateId.MAGIC_LINK]: {
    firstName: string;
    magicLinkUrl: string;
    expiresInMinutes: number;
  };

  [EmailTemplateId.BILLING_SUBSCRIPTION_ACTIVATED]: {
    firstName: string;
    planName: string;
    priceMonthly: string;
    periodEnd: string;
    dashboardUrl: string;
    billingPortalUrl: string;
  };

  [EmailTemplateId.BILLING_PAYMENT_FAILED]: {
    firstName: string;
    planName: string;
    amount: string;
    retryDate: string;
    billingPortalUrl: string;
  };

  [EmailTemplateId.BILLING_SUBSCRIPTION_CANCELED]: {
    firstName: string;
    planName: string;
    accessUntil: string;
    resubscribeUrl: string;
  };

  [EmailTemplateId.BILLING_INVOICE_PAID]: {
    firstName: string;
    invoiceNumber: string;
    amount: string;
    periodStart: string;
    periodEnd: string;
    invoiceUrl?: string;
    billingPortalUrl: string;
  };

  [EmailTemplateId.BILLING_USAGE_WARNING]: {
    firstName: string;
    resource: string;
    current: number;
    limit: number;
    percentage: number;
    upgradeUrl: string;
  };

  [EmailTemplateId.BILLING_TRIAL_ENDING]: {
    firstName: string;
    daysLeft: number;
    trialEndsDate: string;
    upgradeUrl: string;
  };
};

/**
 * Result returned by email template render functions
 */
export interface EmailTemplateRenderResult {
  subject: string;
  previewText: string;
  component: ReactElement;
}

/**
 * Standard email template interface
 */
export interface EmailTemplate<T extends EmailTemplateId> {
  render: (data: EmailTemplateData[T]) => EmailTemplateRenderResult;
}

/**
 * Email send options
 */
export interface SendEmailOptions {
  to: string | string[];
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Email send result
 */
export interface SendEmailResult {
  id: string;
  success: boolean;
  error?: string;
}
