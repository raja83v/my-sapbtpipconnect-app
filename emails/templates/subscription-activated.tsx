import * as React from "react";
import { Section, Text } from "@react-email/components";
import type { EmailTemplateRenderResult, EmailTemplateData } from "@/lib/notifications/types";
import { EmailTemplateId } from "@/lib/notifications/types";
import { siteConfig } from "@/lib/config";
import { EmailLayout, PrimaryButton } from "./components/email-layout";

type Data = EmailTemplateData[EmailTemplateId.BILLING_SUBSCRIPTION_ACTIVATED];

export function SubscriptionActivatedEmail({
  firstName,
  planName,
  priceMonthly,
  periodEnd,
  dashboardUrl,
  billingPortalUrl,
}: Data) {
  return (
    <EmailLayout
      previewText={`Your ${planName} subscription is now active`}
      heading={`Subscription activated 🎉`}
    >
      <Text style={{ margin: 0 }}>Hi {firstName},</Text>
      <Text style={{ margin: 0 }}>
        Your <strong>{planName}</strong> subscription is active and you&apos;re all set.
        Your account will renew on <strong>{periodEnd}</strong> for <strong>{priceMonthly}/month</strong>.
      </Text>
      <Text style={{ margin: 0 }}>
        Head to the dashboard to monitor your SAP CPI integrations:
      </Text>
      <Section style={{ textAlign: "center" }}>
        <PrimaryButton href={dashboardUrl}>Open Dashboard</PrimaryButton>
      </Section>
      <Text style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>
        Need to update payment details or cancel?{" "}
        <a href={billingPortalUrl} style={{ color: "#6366F1" }}>Manage your subscription</a>.
      </Text>
      <Text style={{ margin: 0 }}>The {siteConfig.name} Team</Text>
    </EmailLayout>
  );
}

export const subscriptionActivatedEmailTemplate = {
  render: (data: Data): EmailTemplateRenderResult => ({
    subject: `Your ${data.planName} subscription is now active`,
    previewText: `Welcome to the ${data.planName} plan`,
    component: <SubscriptionActivatedEmail {...data} />,
  }),
};
