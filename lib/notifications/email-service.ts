import { Resend } from "resend";
import { render } from "@react-email/components";
import { getEmailTemplate } from "@/emails";
import { siteConfig } from "@/lib/config";
import type {
  EmailTemplateId,
  EmailTemplateData,
  SendEmailOptions,
  SendEmailResult,
} from "./types";

/**
 * Initialize Resend client
 * Throws error if RESEND_API_KEY is not set
 */
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "RESEND_API_KEY is not set. Emails will be logged to console."
      );
      return null;
    }
    throw new Error(
      "RESEND_API_KEY environment variable is not set. Please add it to your .env.local file."
    );
  }

  return new Resend(apiKey);
}

/**
 * Default sender email address
 * Override with SendEmailOptions.from if needed
 */
const DEFAULT_FROM_EMAIL =
  process.env.EMAIL_FROM || siteConfig.email.fromEmail;

/**
 * Send an email using a template
 *
 * @param templateId - The ID of the email template to use
 * @param data - The data required for the template
 * @param options - Email sending options (to, from, cc, bcc, etc.)
 * @returns Promise with send result
 *
 * @example
 * ```typescript
 * await sendTemplateEmail(
 *   EmailTemplateId.WORKSPACE_WELCOME,
 *   { firstName: "John", dashboardUrl: "https://..." },
 *   { to: "john@example.com" }
 * );
 * ```
 */
export async function sendTemplateEmail<T extends EmailTemplateId>(
  templateId: T,
  data: EmailTemplateData[T],
  options: SendEmailOptions
): Promise<SendEmailResult> {
  try {
    const resend = getResendClient();
    const template = getEmailTemplate(templateId);
    const { subject, component } = template.render(data);

    // Render the React component to HTML
    const html = await render(component);

    if (!resend) {
      console.log(`
=================================================================
[DEV MODE] Email Mock Send
=================================================================
To: ${Array.isArray(options.to) ? options.to.join(", ") : options.to}
Subject: ${subject}
Template: ${templateId}
-----------------------------------------------------------------
HTML Content (Preview):
${html.substring(0, 500)}...
-----------------------------------------------------------------
Full HTML content logged above.
In a real scenario, this would be sent via Resend.
=================================================================
      `);
      
      // If it's a magic link, try to extract and log the link specifically for easier access
      if (templateId === "magic-link" && (data as any).magicLinkUrl) {
        console.log(`
>>> MAGIC LINK URL: ${(data as any).magicLinkUrl}
        `);
      }

      return {
        id: "mock-email-id-" + Date.now(),
        success: true,
      };
    }

    // Send the email
    const result = await resend.emails.send({
      from: options.from || DEFAULT_FROM_EMAIL,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject,
      html,
      ...(options.replyTo && { reply_to: options.replyTo }),
      ...(options.cc && {
        cc: Array.isArray(options.cc) ? options.cc : [options.cc],
      }),
      ...(options.bcc && {
        bcc: Array.isArray(options.bcc) ? options.bcc : [options.bcc],
      }),
      ...(options.tags && { tags: options.tags }),
    });

    if (!result.data) {
      return {
        id: "",
        success: false,
        error: result.error?.message || "Failed to send email",
      };
    }

    return {
      id: result.data.id,
      success: true,
    };
  } catch (error) {
    console.error(`Failed to send email (${templateId}):`, error);

    return {
      id: "",
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unknown error occurred while sending email",
    };
  }
}

/**
 * Send a custom email without using a template
 *
 * @param subject - Email subject line
 * @param html - HTML content of the email
 * @param options - Email sending options (to, from, cc, bcc, etc.)
 * @returns Promise with send result
 *
 * @example
 * ```typescript
 * await sendCustomEmail(
 *   "Welcome!",
 *   "<h1>Hello World</h1>",
 *   { to: "user@example.com" }
 * );
 * ```
 */
export async function sendCustomEmail(
  subject: string,
  html: string,
  options: SendEmailOptions
): Promise<SendEmailResult> {
  try {
    const resend = getResendClient();

    if (!resend) {
      console.log(`
=================================================================
[DEV MODE] Custom Email Mock Send
=================================================================
To: ${Array.isArray(options.to) ? options.to.join(", ") : options.to}
Subject: ${subject}
-----------------------------------------------------------------
HTML Content (Preview):
${html.substring(0, 500)}...
-----------------------------------------------------------------
Full HTML content logged above.
In a real scenario, this would be sent via Resend.
=================================================================
      `);

      return {
        id: "mock-email-id-" + Date.now(),
        success: true,
      };
    }

    const result = await resend.emails.send({
      from: options.from || DEFAULT_FROM_EMAIL,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject,
      html,
      ...(options.replyTo && { reply_to: options.replyTo }),
      ...(options.cc && {
        cc: Array.isArray(options.cc) ? options.cc : [options.cc],
      }),
      ...(options.bcc && {
        bcc: Array.isArray(options.bcc) ? options.bcc : [options.bcc],
      }),
      ...(options.tags && { tags: options.tags }),
    });

    if (!result.data) {
      return {
        id: "",
        success: false,
        error: result.error?.message || "Failed to send email",
      };
    }

    return {
      id: result.data.id,
      success: true,
    };
  } catch (error) {
    console.error("Failed to send custom email:", error);

    return {
      id: "",
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unknown error occurred while sending email",
    };
  }
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Batch send emails (useful for notifications to multiple users)
 *
 * @param templateId - The ID of the email template to use
 * @param recipients - Array of recipient data with email and template data
 * @param options - Base email sending options (from, replyTo, etc.)
 * @returns Promise with array of send results
 *
 * @example
 * ```typescript
 * await sendBatchEmails(
 *   EmailTemplateId.WORKSPACE_WELCOME,
 *   [
 *     { to: "user1@example.com", data: { firstName: "John", dashboardUrl: "..." } },
 *     { to: "user2@example.com", data: { firstName: "Jane", dashboardUrl: "..." } }
 *   ],
 *   { from: "welcome@example.com" }
 * );
 * ```
 */
export async function sendBatchEmails<T extends EmailTemplateId>(
  templateId: T,
  recipients: Array<{ to: string; data: EmailTemplateData[T] }>,
  options: Omit<SendEmailOptions, "to"> = {}
): Promise<SendEmailResult[]> {
  const results = await Promise.all(
    recipients.map((recipient) =>
      sendTemplateEmail(templateId, recipient.data, {
        ...options,
        to: recipient.to,
      })
    )
  );

  return results;
}
