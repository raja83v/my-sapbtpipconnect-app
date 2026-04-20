import * as React from "react";
import { Section, Text } from "@react-email/components";
import type { EmailTemplateRenderResult, EmailTemplateData } from "@/lib/notifications/types";
import { EmailTemplateId } from "@/lib/notifications/types";
import { siteConfig } from "@/lib/config";
import { EmailLayout, PrimaryButton } from "./components/email-layout";

type Data = EmailTemplateData[EmailTemplateId.BILLING_PAYMENT_FAILED];

export function PaymentFailedEmail({
  firstName,
  planName,
  amount,
  retryDate,
  billingPortalUrl,
}: Data) {
  return (
    <EmailLayout
      previewText={`Action required: payment failed for your ${planName} subscription`}
      heading="Payment failed"
    >
      <Text style={{ margin: 0 }}>Hi {firstName},</Text>
      <Text style={{ margin: 0 }}>
        We were unable to charge <strong>{amount}</strong> for your <strong>{planName}</strong> subscription.
        We&apos;ll automatically retry on <strong>{retryDate}</strong>.
      </Text>
      <Text style={{ margin: 0 }}>
        To avoid any interruption to your service, please update your payment method now:
      </Text>
      <Section style={{ textAlign: "center" }}>
        <PrimaryButton href={billingPortalUrl}>Update Payment Method</PrimaryButton>
      </Section>
      <Text style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>
        If you have any questions, reply to this email or contact{" "}
        <a href={`mailto:${siteConfig.email.supportEmail}`} style={{ color: "#6366F1" }}>
          {siteConfig.email.supportEmail}
        </a>
        .
      </Text>
      <Text style={{ margin: 0 }}>The {siteConfig.name} Team</Text>
    </EmailLayout>
  );
}

export const paymentFailedEmailTemplate = {
  render: (data: Data): EmailTemplateRenderResult => ({
    subject: `Action required: payment failed for your ${data.planName} plan`,
    previewText: `Update your payment method to keep your ${data.planName} subscription active`,
    component: <PaymentFailedEmail {...data} />,
  }),
};
