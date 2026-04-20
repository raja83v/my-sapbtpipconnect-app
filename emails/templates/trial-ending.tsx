import * as React from "react";
import { Section, Text } from "@react-email/components";
import type { EmailTemplateRenderResult, EmailTemplateData } from "@/lib/notifications/types";
import { EmailTemplateId } from "@/lib/notifications/types";
import { siteConfig } from "@/lib/config";
import { EmailLayout, PrimaryButton } from "./components/email-layout";

type Data = EmailTemplateData[EmailTemplateId.BILLING_TRIAL_ENDING];

export function TrialEndingEmail({ firstName, daysLeft, trialEndsDate, upgradeUrl }: Data) {
  const isLastDay = daysLeft <= 1;

  return (
    <EmailLayout
      previewText={
        isLastDay
          ? `Your free trial ends today — upgrade to keep access`
          : `Your free trial ends in ${daysLeft} days`
      }
      heading={isLastDay ? "Your trial ends today" : `Your trial ends in ${daysLeft} days`}
    >
      <Text style={{ margin: 0 }}>Hi {firstName},</Text>
      <Text style={{ margin: 0 }}>
        {isLastDay ? (
          <>
            Your free trial <strong>ends today</strong>. After today, your account will move to
            the free tier and some features will be restricted.
          </>
        ) : (
          <>
            Your free trial expires on <strong>{trialEndsDate}</strong> — just {daysLeft} day
            {daysLeft !== 1 ? "s" : ""} left. After that, your account will move to the free tier.
          </>
        )}
      </Text>
      <Text style={{ margin: 0 }}>
        Upgrade now to keep full access to all your integrations and AI features:
      </Text>
      <Section style={{ textAlign: "center" }}>
        <PrimaryButton href={upgradeUrl}>Upgrade Now</PrimaryButton>
      </Section>
      <Text style={{ margin: 0, fontSize: "14px", color: "#6B7280" }}>
        Questions about pricing?{" "}
        <a href={`mailto:${siteConfig.email.supportEmail}`} style={{ color: "#6366F1" }}>
          Talk to our team
        </a>
        .
      </Text>
      <Text style={{ margin: 0 }}>The {siteConfig.name} Team</Text>
    </EmailLayout>
  );
}

export const trialEndingEmailTemplate = {
  render: (data: Data): EmailTemplateRenderResult => ({
    subject:
      data.daysLeft <= 1
        ? `Your free trial ends today`
        : `Your free trial ends in ${data.daysLeft} days`,
    previewText:
      data.daysLeft <= 1
        ? `Upgrade today to keep full access`
        : `Trial expires on ${data.trialEndsDate} — upgrade to continue`,
    component: <TrialEndingEmail {...data} />,
  }),
};
