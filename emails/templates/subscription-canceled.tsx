import * as React from "react";
import { Section, Text } from "@react-email/components";
import type { EmailTemplateRenderResult, EmailTemplateData } from "@/lib/notifications/types";
import { EmailTemplateId } from "@/lib/notifications/types";
import { siteConfig } from "@/lib/config";
import { EmailLayout, PrimaryButton } from "./components/email-layout";

type Data = EmailTemplateData[EmailTemplateId.BILLING_SUBSCRIPTION_CANCELED];

export function SubscriptionCanceledEmail({
  firstName,
  planName,
  accessUntil,
  resubscribeUrl,
}: Data) {
  return (
    <EmailLayout
      previewText={`Your ${planName} subscription has been canceled`}
      heading="Subscription canceled"
    >
      <Text style={{ margin: 0 }}>Hi {firstName},</Text>
      <Text style={{ margin: 0 }}>
        Your <strong>{planName}</strong> subscription has been canceled. You&apos;ll retain access
        to all features until <strong>{accessUntil}</strong>, after which your account will
        move to the free tier.
      </Text>
      <Text style={{ margin: 0 }}>
        Changed your mind? You can reactivate at any time:
      </Text>
      <Section style={{ textAlign: "center" }}>
        <PrimaryButton href={resubscribeUrl}>Reactivate Subscription</PrimaryButton>
      </Section>
      <Text style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>
        We&apos;d love to hear why you canceled — reply to this email with any feedback.
      </Text>
      <Text style={{ margin: 0 }}>The {siteConfig.name} Team</Text>
    </EmailLayout>
  );
}

export const subscriptionCanceledEmailTemplate = {
  render: (data: Data): EmailTemplateRenderResult => ({
    subject: `Your ${data.planName} subscription has been canceled`,
    previewText: `You have access until ${data.accessUntil}`,
    component: <SubscriptionCanceledEmail {...data} />,
  }),
};
