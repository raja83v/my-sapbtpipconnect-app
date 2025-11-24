import * as React from "react";
import { Section, Text } from "@react-email/components";
import type {
  EmailTemplateRenderResult,
  EmailTemplateData,
} from "@/lib/notifications/types";
import { EmailTemplateId } from "@/lib/notifications/types";
import { siteConfig } from "@/lib/config";
import {
  EmailLayout,
  PrimaryButton,
} from "./components/email-layout";

type EmailVerificationData =
  EmailTemplateData[EmailTemplateId.EMAIL_VERIFICATION];

const paragraphStyle = {
  margin: 0,
};

export function EmailVerification({
  firstName,
  verificationUrl,
}: EmailVerificationData) {
  const recipient = firstName?.trim() || "there";

  return (
    <EmailLayout
      previewText={`Verify your email address to complete your ${siteConfig.name} account setup`}
      heading="Verify your email address"
    >
      <Text style={paragraphStyle}>Hi {recipient},</Text>
      <Text style={paragraphStyle}>
        Thanks for signing up for {siteConfig.name}! Please verify your email address to
        complete your account setup and start using the platform.
      </Text>
      <Section style={{ textAlign: "center" }}>
        <PrimaryButton href={verificationUrl}>Verify Email</PrimaryButton>
      </Section>
      <Text style={paragraphStyle}>
        If you didn&apos;t create an account with {siteConfig.name}, you can safely ignore
        this email.
      </Text>
      <Text
        style={{
          ...paragraphStyle,
          marginTop: "24px",
          fontSize: "14px",
          color: "#6B7280",
        }}
      >
        If the button doesn&apos;t work, copy and paste this link into your
        browser:
        <br />
        <a
          href={verificationUrl}
          style={{ color: "#9B99FE", wordBreak: "break-all" }}
        >
          {verificationUrl}
        </a>
      </Text>
    </EmailLayout>
  );
}

export const emailVerificationTemplate = {
  render: (data: EmailVerificationData): EmailTemplateRenderResult => ({
    subject: "Verify your email address",
    previewText: `Complete your ${siteConfig.name} account setup`,
    component: <EmailVerification {...data} />,
  }),
};

EmailVerification.PreviewProps = {
  firstName: "Alex",
  verificationUrl: `${siteConfig.url}/verify-email?token=abc123`,
} satisfies EmailVerificationData;

export default EmailVerification;
